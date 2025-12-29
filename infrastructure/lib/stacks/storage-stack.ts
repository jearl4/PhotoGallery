import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

interface StorageStackProps extends cdk.StackProps {
  stage: string;
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
  }
}
