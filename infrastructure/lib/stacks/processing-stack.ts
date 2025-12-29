import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import { DatabaseStack } from './database-stack';

export interface ProcessingStackProps extends cdk.StackProps {
  stage: string;
  originalBucketName: string;
  optimizedBucketName: string;
  thumbnailBucketName: string;
  databaseStack: DatabaseStack;
}

export class ProcessingStack extends cdk.Stack {
  public readonly processingQueue: sqs.Queue;
  public readonly processorFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: ProcessingStackProps) {
    super(scope, id, props);

    const { stage, originalBucketName, optimizedBucketName, thumbnailBucketName, databaseStack } = props;

    // Dead Letter Queue for failed processing jobs
    const deadLetterQueue = new sqs.Queue(this, 'ProcessingDLQ', {
      queueName: `photographer-gallery-processing-dlq-${stage}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // Main processing queue
    this.processingQueue = new sqs.Queue(this, 'ProcessingQueue', {
      queueName: `photographer-gallery-processing-${stage}`,
      visibilityTimeout: cdk.Duration.minutes(15), // Must be >= Lambda timeout
      receiveMessageWaitTime: cdk.Duration.seconds(20), // Long polling
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3, // Retry 3 times before sending to DLQ
      },
    });

    // Lambda function for processing photos
    this.processorFunction = new lambda.Function(this, 'ProcessorFunction', {
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
      timeout: cdk.Duration.minutes(10), // Image processing can take time
      memorySize: 2048, // More memory for image processing (faster CPU too)
      environment: {
        STAGE: stage,
        AWS_REGION_NAME: this.region,
        DYNAMODB_TABLE_PREFIX: 'photographer-gallery',
        S3_BUCKET_ORIGINAL: originalBucketName,
        S3_BUCKET_OPTIMIZED: optimizedBucketName,
        S3_BUCKET_THUMBNAIL: thumbnailBucketName,
      },
      reservedConcurrentExecutions: 10, // Limit concurrent processing to control costs
    });

    // Grant DynamoDB permissions
    databaseStack.photosTable.grantReadWriteData(this.processorFunction);

    // Grant S3 permissions using bucket ARNs (avoids circular dependency)
    const originalBucketArn = `arn:aws:s3:::${originalBucketName}`;
    const optimizedBucketArn = `arn:aws:s3:::${optimizedBucketName}`;
    const thumbnailBucketArn = `arn:aws:s3:::${thumbnailBucketName}`;

    this.processorFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [`${originalBucketArn}/*`],
    }));

    this.processorFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:PutObject'],
      resources: [`${optimizedBucketArn}/*`, `${thumbnailBucketArn}/*`],
    }));

    // Connect Lambda to SQS queue
    this.processorFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(this.processingQueue, {
        batchSize: 1, // Process one photo at a time
        reportBatchItemFailures: true, // Enable partial batch responses
      })
    );

    // Note: S3 event notification is added in app.ts after stack creation
    // to avoid circular dependency between StorageStack and ProcessingStack

    // CloudWatch Alarms for monitoring
    this.processingQueue.metricApproximateAgeOfOldestMessage().createAlarm(this, 'OldestMessageAlarm', {
      evaluationPeriods: 1,
      threshold: 600, // 10 minutes
      alarmDescription: 'Alert if messages are stuck in queue for too long',
    });

    deadLetterQueue.metricApproximateNumberOfMessagesVisible().createAlarm(this, 'DLQAlarm', {
      evaluationPeriods: 1,
      threshold: 1,
      alarmDescription: 'Alert when messages end up in DLQ (processing failures)',
    });

    // Outputs
    new cdk.CfnOutput(this, 'ProcessingQueueUrl', {
      value: this.processingQueue.queueUrl,
      description: 'Processing queue URL',
    });

    new cdk.CfnOutput(this, 'ProcessorFunctionArn', {
      value: this.processorFunction.functionArn,
      description: 'Processor Lambda function ARN',
    });

    new cdk.CfnOutput(this, 'DeadLetterQueueUrl', {
      value: deadLetterQueue.queueUrl,
      description: 'Dead letter queue URL',
    });
  }
}
