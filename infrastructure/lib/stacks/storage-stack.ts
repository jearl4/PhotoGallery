import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { Construct } from 'constructs';
import { DatabaseStack } from './database-stack';

interface StorageStackProps extends cdk.StackProps {
  stage: string;
  databaseStack: DatabaseStack;
}

export class StorageStack extends cdk.Stack {
  public readonly originalBucket: s3.Bucket;
  public readonly optimizedBucket: s3.Bucket;
  public readonly thumbnailBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    // Original Photos Bucket - with Intelligent-Tiering for cost optimization
    this.originalBucket = new s3.Bucket(this, 'OriginalPhotosBucket', {
      bucketName: `photographer-gallery-originals-${props.stage}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'], // In production, specify your domain
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          id: 'IntelligentTieringRule',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(0),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
      removalPolicy: props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.stage !== 'prod',
    });

    // Optimized Photos Bucket (for web viewing)
    this.optimizedBucket = new s3.Bucket(this, 'OptimizedPhotosBucket', {
      bucketName: `photographer-gallery-optimized-${props.stage}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
      removalPolicy: props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.stage !== 'prod',
    });

    // Thumbnail Bucket
    this.thumbnailBucket = new s3.Bucket(this, 'ThumbnailPhotosBucket', {
      bucketName: `photographer-gallery-thumbnails-${props.stage}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
      removalPolicy: props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.stage !== 'prod',
    });

    // CloudFront Origin Access Identity
    const oai = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: 'OAI for photographer gallery',
    });

    // Grant CloudFront access to optimized and thumbnail buckets
    this.optimizedBucket.grantRead(oai);
    this.thumbnailBucket.grantRead(oai);

    // CloudFront Distribution for CDN
    this.distribution = new cloudfront.Distribution(this, 'PhotosDistribution', {
      comment: 'CDN for photographer gallery photos',
      defaultBehavior: {
        origin: new origins.S3Origin(this.optimizedBucket, {
          originAccessIdentity: oai,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: new cloudfront.CachePolicy(this, 'PhotosCachePolicy', {
          cachePolicyName: `PhotographerGalleryCache-${props.stage}`,
          defaultTtl: cdk.Duration.hours(24),
          maxTtl: cdk.Duration.days(365),
          minTtl: cdk.Duration.seconds(0),
          enableAcceptEncodingGzip: true,
          enableAcceptEncodingBrotli: true,
        }),
      },
      additionalBehaviors: {
        '/thumbnails/*': {
          origin: new origins.S3Origin(this.thumbnailBucket, {
            originAccessIdentity: oai,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          compress: true,
          cachePolicy: new cloudfront.CachePolicy(this, 'ThumbnailsCachePolicy', {
            cachePolicyName: `PhotographerGalleryThumbnailsCache-${props.stage}`,
            defaultTtl: cdk.Duration.hours(24),
            maxTtl: cdk.Duration.days(365),
            minTtl: cdk.Duration.seconds(0),
            enableAcceptEncodingGzip: true,
            enableAcceptEncodingBrotli: true,
          }),
        },
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Use only North America and Europe for cost optimization
    });

    // === Image Processing Resources ===

    // Dead Letter Queue for failed processing jobs
    const deadLetterQueue = new sqs.Queue(this, 'ProcessingDLQ', {
      queueName: `photographer-gallery-processing-dlq-${props.stage}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // Main processing queue
    const processingQueue = new sqs.Queue(this, 'ProcessingQueue', {
      queueName: `photographer-gallery-processing-${props.stage}`,
      visibilityTimeout: cdk.Duration.minutes(15),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // Lambda function for processing photos
    const processorFunction = new lambda.Function(this, 'ProcessorFunction', {
      runtime: lambda.Runtime.PROVIDED_AL2,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../backend', {
        bundling: {
          image: lambda.Runtime.PROVIDED_AL2.bundlingImage,
          command: [
            'bash', '-c', [
              'yum install -y golang zip',
              'export GOPATH=/tmp/go',
              'export GOCACHE=/tmp/go-cache',
              'cd /asset-input',
              'GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -tags lambda.norpc -o /asset-output/bootstrap cmd/processor/main.go',
            ].join(' && '),
          ],
          user: 'root',
        },
      }),
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.minutes(10),
      memorySize: 2048,
      environment: {
        STAGE: props.stage,
        AWS_REGION_NAME: this.region,
        DYNAMODB_TABLE_PREFIX: 'photographer-gallery',
        S3_BUCKET_ORIGINAL: this.originalBucket.bucketName,
        S3_BUCKET_OPTIMIZED: this.optimizedBucket.bucketName,
        S3_BUCKET_THUMBNAIL: this.thumbnailBucket.bucketName,
      },
      reservedConcurrentExecutions: 10,
    });

    // Grant permissions
    props.databaseStack.photosTable.grantReadWriteData(processorFunction);
    this.originalBucket.grantRead(processorFunction);
    this.optimizedBucket.grantWrite(processorFunction);
    this.thumbnailBucket.grantWrite(processorFunction);

    // Connect Lambda to SQS queue
    processorFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(processingQueue, {
        batchSize: 1,
        reportBatchItemFailures: true,
      })
    );

    // Add S3 event notification to trigger processing
    // Trigger on any file created in the originals bucket (all files need processing)
    this.originalBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.SqsDestination(processingQueue)
    );

    // CloudWatch Alarms
    processingQueue.metricApproximateAgeOfOldestMessage().createAlarm(this, 'OldestMessageAlarm', {
      evaluationPeriods: 1,
      threshold: 600,
      alarmDescription: 'Alert if messages are stuck in queue for too long',
    });

    deadLetterQueue.metricApproximateNumberOfMessagesVisible().createAlarm(this, 'DLQAlarm', {
      evaluationPeriods: 1,
      threshold: 1,
      alarmDescription: 'Alert when messages end up in DLQ (processing failures)',
    });

    // Outputs
    new cdk.CfnOutput(this, 'OriginalBucketName', {
      value: this.originalBucket.bucketName,
      exportName: `OriginalBucket-${props.stage}`,
    });

    new cdk.CfnOutput(this, 'OptimizedBucketName', {
      value: this.optimizedBucket.bucketName,
      exportName: `OptimizedBucket-${props.stage}`,
    });

    new cdk.CfnOutput(this, 'ThumbnailBucketName', {
      value: this.thumbnailBucket.bucketName,
      exportName: `ThumbnailBucket-${props.stage}`,
    });

    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      value: this.distribution.distributionDomainName,
      exportName: `CloudFrontDomain-${props.stage}`,
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: this.distribution.distributionId,
      exportName: `CloudFrontDistributionId-${props.stage}`,
    });

    new cdk.CfnOutput(this, 'ProcessingQueueUrl', {
      value: processingQueue.queueUrl,
      description: 'Processing queue URL',
    });

    new cdk.CfnOutput(this, 'ProcessorFunctionArn', {
      value: processorFunction.functionArn,
      description: 'Processor Lambda function ARN',
    });

    new cdk.CfnOutput(this, 'DeadLetterQueueUrl', {
      value: deadLetterQueue.queueUrl,
      description: 'Dead letter queue URL',
    });
  }
}
