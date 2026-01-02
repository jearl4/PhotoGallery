"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const sqs = __importStar(require("aws-cdk-lib/aws-sqs"));
const lambdaEventSources = __importStar(require("aws-cdk-lib/aws-lambda-event-sources"));
const s3n = __importStar(require("aws-cdk-lib/aws-s3-notifications"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class StorageStack extends cdk.Stack {
    constructor(scope, id, props) {
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
            visibilityTimeout: cdk.Duration.seconds(30), // Must be >= Lambda timeout
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
            logRetention: logs.RetentionDays.ONE_WEEK, // Keep logs for 7 days
        });
        // Grant permissions
        props.databaseStack.photosTable.grantReadWriteData(processorFunction);
        this.originalBucket.grantRead(processorFunction);
        this.optimizedBucket.grantWrite(processorFunction);
        this.thumbnailBucket.grantWrite(processorFunction);
        // Connect Lambda to SQS queue
        processorFunction.addEventSource(new lambdaEventSources.SqsEventSource(processingQueue, {
            batchSize: 1,
            reportBatchItemFailures: true,
        }));
        // Add S3 event notification to trigger processing
        // Trigger on any file created in the originals bucket (all files need processing)
        this.originalBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.SqsDestination(processingQueue));
        // DLQ Reprocessor Lambda - handles automatic retry with exponential backoff
        const dlqReprocessorFunction = new lambda.Function(this, 'DLQReprocessorFunction', {
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
                            'GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -tags lambda.norpc -o /asset-output/bootstrap cmd/dlq-reprocessor/main.go',
                        ].join(' && '),
                    ],
                    user: 'root',
                },
            }),
            architecture: lambda.Architecture.ARM_64,
            timeout: cdk.Duration.seconds(30), // Must be <= DLQ visibility timeout
            memorySize: 256, // Minimal memory for lightweight message reprocessing
            environment: {
                STAGE: props.stage,
                AWS_REGION_NAME: this.region,
                DYNAMODB_TABLE_PREFIX: 'photographer-gallery',
                S3_BUCKET_ORIGINAL: this.originalBucket.bucketName,
                S3_BUCKET_OPTIMIZED: this.optimizedBucket.bucketName,
                S3_BUCKET_THUMBNAIL: this.thumbnailBucket.bucketName,
                PROCESSING_QUEUE_URL: processingQueue.queueUrl,
            },
            reservedConcurrentExecutions: 5,
            logRetention: logs.RetentionDays.ONE_WEEK, // Keep logs for 7 days
        });
        // Grant DLQ reprocessor permissions
        props.databaseStack.photosTable.grantReadWriteData(dlqReprocessorFunction);
        processingQueue.grantSendMessages(dlqReprocessorFunction);
        // Connect DLQ reprocessor to DLQ
        dlqReprocessorFunction.addEventSource(new lambdaEventSources.SqsEventSource(deadLetterQueue, {
            batchSize: 1,
            reportBatchItemFailures: true,
        }));
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
        new cdk.CfnOutput(this, 'DLQReprocessorFunctionArn', {
            value: dlqReprocessorFunction.functionArn,
            description: 'DLQ Reprocessor Lambda function ARN',
        });
    }
}
exports.StorageStack = StorageStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcmFnZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInN0b3JhZ2Utc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVEQUF5QztBQUN6Qyx1RUFBeUQ7QUFDekQsNEVBQThEO0FBQzlELCtEQUFpRDtBQUNqRCx5REFBMkM7QUFFM0MseUZBQTJFO0FBQzNFLHNFQUF3RDtBQUN4RCwyREFBNkM7QUFTN0MsTUFBYSxZQUFhLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFNekMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF3QjtRQUNoRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QiwwRUFBMEU7UUFDMUUsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLHNCQUFzQixFQUFFO1lBQ2hFLFVBQVUsRUFBRSxrQ0FBa0MsS0FBSyxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQzNFLFVBQVUsRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsVUFBVTtZQUMxQyxpQkFBaUIsRUFBRSxFQUFFLENBQUMsaUJBQWlCLENBQUMsU0FBUztZQUNqRCxJQUFJLEVBQUU7Z0JBQ0o7b0JBQ0UsY0FBYyxFQUFFLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7b0JBQzdFLGNBQWMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLHFDQUFxQztvQkFDNUQsY0FBYyxFQUFFLENBQUMsR0FBRyxDQUFDO29CQUNyQixNQUFNLEVBQUUsSUFBSTtpQkFDYjthQUNGO1lBQ0QsY0FBYyxFQUFFO2dCQUNkO29CQUNFLEVBQUUsRUFB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YXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgb3JpZ2lucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIHNxcyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3FzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxhbWJkYUV2ZW50U291cmNlcyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhLWV2ZW50LXNvdXJjZXMnO1xuaW1wb3J0ICogYXMgczNuIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMy1ub3RpZmljYXRpb25zJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBEYXRhYmFzZVN0YWNrIH0gZnJvbSAnLi9kYXRhYmFzZS1zdGFjayc7XG5cbmludGVyZmFjZSBTdG9yYWdlU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgc3RhZ2U6IHN0cmluZztcbiAgZGF0YWJhc2VTdGFjazogRGF0YWJhc2VTdGFjaztcbn1cblxuZXhwb3J0IGNsYXNzIFN0b3JhZ2VTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBvcmlnaW5hbEJ1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgb3B0aW1pemVkQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSB0aHVtYm5haWxCdWNrZXQ6IHMzLkJ1Y2tldDtcbiAgcHVibGljIHJlYWRvbmx5IGRpc3RyaWJ1dGlvbjogY2xvdWRmcm9udC5EaXN0cmlidXRpb247XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFN0b3JhZ2VTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBPcmlnaW5hbCBQaG90b3MgQnVja2V0IC0gd2l0aCBJbnRlbGxpZ2VudC1UaWVyaW5nIGZvciBjb3N0IG9wdGltaXphdGlvblxuICAgIHRoaXMub3JpZ2luYWxCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdPcmlnaW5hbFBob3Rvc0J1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBwaG90b2dyYXBoZXItZ2FsbGVyeS1vcmlnaW5hbHMtJHtwcm9wcy5zdGFnZX0tJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICBjb3JzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogW3MzLkh0dHBNZXRob2RzLkdFVCwgczMuSHR0cE1ldGhvZHMuUFVULCBzMy5IdHRwTWV0aG9kcy5QT1NUXSxcbiAgICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sIC8vIEluIHByb2R1Y3Rpb24sIHNwZWNpZnkgeW91ciBkb21haW5cbiAgICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgICAgbWF4QWdlOiAzMDAwLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0ludGVsbGlnZW50VGllcmluZ1J1bGUnLFxuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgdHJhbnNpdGlvbnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuSU5URUxMSUdFTlRfVElFUklORyxcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygwKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN0b3JhZ2VDbGFzczogczMuU3RvcmFnZUNsYXNzLkdMQUNJRVIsXG4gICAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoOTApLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IHByb3BzLnN0YWdlID09PSAncHJvZCcgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHByb3BzLnN0YWdlICE9PSAncHJvZCcsXG4gICAgfSk7XG5cbiAgICAvLyBPcHRpbWl6ZWQgUGhvdG9zIEJ1Y2tldCAoZm9yIHdlYiB2aWV3aW5nKVxuICAgIHRoaXMub3B0aW1pemVkQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnT3B0aW1pemVkUGhvdG9zQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYHBob3RvZ3JhcGhlci1nYWxsZXJ5LW9wdGltaXplZC0ke3Byb3BzLnN0YWdlfS0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIGNvcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbczMuSHR0cE1ldGhvZHMuR0VUXSxcbiAgICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICAgIG1heEFnZTogMzYwMCxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICByZW1vdmFsUG9saWN5OiBwcm9wcy5zdGFnZSA9PT0gJ3Byb2QnID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiBwcm9wcy5zdGFnZSAhPT0gJ3Byb2QnLFxuICAgIH0pO1xuXG4gICAgLy8gVGh1bWJuYWlsIEJ1Y2tldFxuICAgIHRoaXMudGh1bWJuYWlsQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnVGh1bWJuYWlsUGhvdG9zQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYHBob3RvZ3JhcGhlci1nYWxsZXJ5LXRodW1ibmFpbHMtJHtwcm9wcy5zdGFnZX0tJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICBjb3JzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogW3MzLkh0dHBNZXRob2RzLkdFVF0sXG4gICAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcbiAgICAgICAgICBtYXhBZ2U6IDM2MDAsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgcmVtb3ZhbFBvbGljeTogcHJvcHMuc3RhZ2UgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogcHJvcHMuc3RhZ2UgIT09ICdwcm9kJyxcbiAgICB9KTtcblxuICAgIC8vIENsb3VkRnJvbnQgT3JpZ2luIEFjY2VzcyBJZGVudGl0eVxuICAgIGNvbnN0IG9haSA9IG5ldyBjbG91ZGZyb250Lk9yaWdpbkFjY2Vzc0lkZW50aXR5KHRoaXMsICdPQUknLCB7XG4gICAgICBjb21tZW50OiAnT0FJIGZvciBwaG90b2dyYXBoZXIgZ2FsbGVyeScsXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBDbG91ZEZyb250IGFjY2VzcyB0byBvcHRpbWl6ZWQgYW5kIHRodW1ibmFpbCBidWNrZXRzXG4gICAgdGhpcy5vcHRpbWl6ZWRCdWNrZXQuZ3JhbnRSZWFkKG9haSk7XG4gICAgdGhpcy50aHVtYm5haWxCdWNrZXQuZ3JhbnRSZWFkKG9haSk7XG5cbiAgICAvLyBDbG91ZEZyb250IERpc3RyaWJ1dGlvbiBmb3IgQ0ROXG4gICAgdGhpcy5kaXN0cmlidXRpb24gPSBuZXcgY2xvdWRmcm9udC5EaXN0cmlidXRpb24odGhpcywgJ1Bob3Rvc0Rpc3RyaWJ1dGlvbicsIHtcbiAgICAgIGNvbW1lbnQ6ICdDRE4gZm9yIHBob3RvZ3JhcGhlciBnYWxsZXJ5IHBob3RvcycsXG4gICAgICBkZWZhdWx0QmVoYXZpb3I6IHtcbiAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5TM09yaWdpbih0aGlzLm9wdGltaXplZEJ1Y2tldCwge1xuICAgICAgICAgIG9yaWdpbkFjY2Vzc0lkZW50aXR5OiBvYWksXG4gICAgICAgIH0pLFxuICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfR0VUX0hFQURfT1BUSU9OUyxcbiAgICAgICAgY2FjaGVkTWV0aG9kczogY2xvdWRmcm9udC5DYWNoZWRNZXRob2RzLkNBQ0hFX0dFVF9IRUFEX09QVElPTlMsXG4gICAgICAgIGNvbXByZXNzOiB0cnVlLFxuICAgICAgICBjYWNoZVBvbGljeTogbmV3IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kodGhpcywgJ1Bob3Rvc0NhY2hlUG9saWN5Jywge1xuICAgICAgICAgIGNhY2hlUG9saWN5TmFtZTogYFBob3RvZ3JhcGhlckdhbGxlcnlDYWNoZS0ke3Byb3BzLnN0YWdlfWAsXG4gICAgICAgICAgZGVmYXVsdFR0bDogY2RrLkR1cmF0aW9uLmhvdXJzKDI0KSxcbiAgICAgICAgICBtYXhUdGw6IGNkay5EdXJhdGlvbi5kYXlzKDM2NSksXG4gICAgICAgICAgbWluVHRsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygwKSxcbiAgICAgICAgICBlbmFibGVBY2NlcHRFbmNvZGluZ0d6aXA6IHRydWUsXG4gICAgICAgICAgZW5hYmxlQWNjZXB0RW5jb2RpbmdCcm90bGk6IHRydWUsXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICAgIGFkZGl0aW9uYWxCZWhhdmlvcnM6IHtcbiAgICAgICAgJy90aHVtYm5haWxzLyonOiB7XG4gICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5TM09yaWdpbih0aGlzLnRodW1ibmFpbEJ1Y2tldCwge1xuICAgICAgICAgICAgb3JpZ2luQWNjZXNzSWRlbnRpdHk6IG9haSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICBjb21wcmVzczogdHJ1ZSxcbiAgICAgICAgICBjYWNoZVBvbGljeTogbmV3IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kodGhpcywgJ1RodW1ibmFpbHNDYWNoZVBvbGljeScsIHtcbiAgICAgICAgICAgIGNhY2hlUG9saWN5TmFtZTogYFBob3RvZ3JhcGhlckdhbGxlcnlUaHVtYm5haWxzQ2FjaGUtJHtwcm9wcy5zdGFnZX1gLFxuICAgICAgICAgICAgZGVmYXVsdFR0bDogY2RrLkR1cmF0aW9uLmhvdXJzKDI0KSxcbiAgICAgICAgICAgIG1heFR0bDogY2RrLkR1cmF0aW9uLmRheXMoMzY1KSxcbiAgICAgICAgICAgIG1pblR0bDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMCksXG4gICAgICAgICAgICBlbmFibGVBY2NlcHRFbmNvZGluZ0d6aXA6IHRydWUsXG4gICAgICAgICAgICBlbmFibGVBY2NlcHRFbmNvZGluZ0Jyb3RsaTogdHJ1ZSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBwcmljZUNsYXNzOiBjbG91ZGZyb250LlByaWNlQ2xhc3MuUFJJQ0VfQ0xBU1NfMTAwLCAvLyBVc2Ugb25seSBOb3J0aCBBbWVyaWNhIGFuZCBFdXJvcGUgZm9yIGNvc3Qgb3B0aW1pemF0aW9uXG4gICAgfSk7XG5cbiAgICAvLyA9PT0gSW1hZ2UgUHJvY2Vzc2luZyBSZXNvdXJjZXMgPT09XG5cbiAgICAvLyBEZWFkIExldHRlciBRdWV1ZSBmb3IgZmFpbGVkIHByb2Nlc3Npbmcgam9ic1xuICAgIGNvbnN0IGRlYWRMZXR0ZXJRdWV1ZSA9IG5ldyBzcXMuUXVldWUodGhpcywgJ1Byb2Nlc3NpbmdETFEnLCB7XG4gICAgICBxdWV1ZU5hbWU6IGBwaG90b2dyYXBoZXItZ2FsbGVyeS1wcm9jZXNzaW5nLWRscS0ke3Byb3BzLnN0YWdlfWAsXG4gICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5kYXlzKDE0KSxcbiAgICAgIHZpc2liaWxpdHlUaW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksIC8vIE11c3QgYmUgPj0gTGFtYmRhIHRpbWVvdXRcbiAgICB9KTtcblxuICAgIC8vIE1haW4gcHJvY2Vzc2luZyBxdWV1ZVxuICAgIGNvbnN0IHByb2Nlc3NpbmdRdWV1ZSA9IG5ldyBzcXMuUXVldWUodGhpcywgJ1Byb2Nlc3NpbmdRdWV1ZScsIHtcbiAgICAgIHF1ZXVlTmFtZTogYHBob3RvZ3JhcGhlci1nYWxsZXJ5LXByb2Nlc3NpbmctJHtwcm9wcy5zdGFnZX1gLFxuICAgICAgdmlzaWJpbGl0eVRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDE1KSxcbiAgICAgIHJlY2VpdmVNZXNzYWdlV2FpdFRpbWU6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDIwKSxcbiAgICAgIGRlYWRMZXR0ZXJRdWV1ZToge1xuICAgICAgICBxdWV1ZTogZGVhZExldHRlclF1ZXVlLFxuICAgICAgICBtYXhSZWNlaXZlQ291bnQ6IDMsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRhIGZ1bmN0aW9uIGZvciBwcm9jZXNzaW5nIHBob3Rvc1xuICAgIGNvbnN0IHByb2Nlc3NvckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUHJvY2Vzc29yRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QUk9WSURFRF9BTDIsXG4gICAgICBoYW5kbGVyOiAnYm9vdHN0cmFwJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vYmFja2VuZCcsIHtcbiAgICAgICAgYnVuZGxpbmc6IHtcbiAgICAgICAgICBpbWFnZTogbGFtYmRhLlJ1bnRpbWUuUFJPVklERURfQUwyLmJ1bmRsaW5nSW1hZ2UsXG4gICAgICAgICAgY29tbWFuZDogW1xuICAgICAgICAgICAgJ2Jhc2gnLCAnLWMnLCBbXG4gICAgICAgICAgICAgICd5dW0gaW5zdGFsbCAteSBnb2xhbmcgemlwJyxcbiAgICAgICAgICAgICAgJ2V4cG9ydCBHT1BBVEg9L3RtcC9nbycsXG4gICAgICAgICAgICAgICdleHBvcnQgR09DQUNIRT0vdG1wL2dvLWNhY2hlJyxcbiAgICAgICAgICAgICAgJ2NkIC9hc3NldC1pbnB1dCcsXG4gICAgICAgICAgICAgICdHT09TPWxpbnV4IEdPQVJDSD1hcm02NCBDR09fRU5BQkxFRD0wIGdvIGJ1aWxkIC10YWdzIGxhbWJkYS5ub3JwYyAtbyAvYXNzZXQtb3V0cHV0L2Jvb3RzdHJhcCBjbWQvcHJvY2Vzc29yL21haW4uZ28nLFxuICAgICAgICAgICAgXS5qb2luKCcgJiYgJyksXG4gICAgICAgICAgXSxcbiAgICAgICAgICB1c2VyOiAncm9vdCcsXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICAgIGFyY2hpdGVjdHVyZTogbGFtYmRhLkFyY2hpdGVjdHVyZS5BUk1fNjQsXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygxMCksXG4gICAgICBtZW1vcnlTaXplOiAyMDQ4LFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgU1RBR0U6IHByb3BzLnN0YWdlLFxuICAgICAgICBBV1NfUkVHSU9OX05BTUU6IHRoaXMucmVnaW9uLFxuICAgICAgICBEWU5BTU9EQl9UQUJMRV9QUkVGSVg6ICdwaG90b2dyYXBoZXItZ2FsbGVyeScsXG4gICAgICAgIFMzX0JVQ0tFVF9PUklHSU5BTDogdGhpcy5vcmlnaW5hbEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBTM19CVUNLRVRfT1BUSU1JWkVEOiB0aGlzLm9wdGltaXplZEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBTM19CVUNLRVRfVEhVTUJOQUlMOiB0aGlzLnRodW1ibmFpbEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgfSxcbiAgICAgIHJlc2VydmVkQ29uY3VycmVudEV4ZWN1dGlvbnM6IDEwLFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssIC8vIEtlZXAgbG9ncyBmb3IgNyBkYXlzXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9uc1xuICAgIHByb3BzLmRhdGFiYXNlU3RhY2sucGhvdG9zVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHByb2Nlc3NvckZ1bmN0aW9uKTtcbiAgICB0aGlzLm9yaWdpbmFsQnVja2V0LmdyYW50UmVhZChwcm9jZXNzb3JGdW5jdGlvbik7XG4gICAgdGhpcy5vcHRpbWl6ZWRCdWNrZXQuZ3JhbnRXcml0ZShwcm9jZXNzb3JGdW5jdGlvbik7XG4gICAgdGhpcy50aHVtYm5haWxCdWNrZXQuZ3JhbnRXcml0ZShwcm9jZXNzb3JGdW5jdGlvbik7XG5cbiAgICAvLyBDb25uZWN0IExhbWJkYSB0byBTUVMgcXVldWVcbiAgICBwcm9jZXNzb3JGdW5jdGlvbi5hZGRFdmVudFNvdXJjZShcbiAgICAgIG5ldyBsYW1iZGFFdmVudFNvdXJjZXMuU3FzRXZlbnRTb3VyY2UocHJvY2Vzc2luZ1F1ZXVlLCB7XG4gICAgICAgIGJhdGNoU2l6ZTogMSxcbiAgICAgICAgcmVwb3J0QmF0Y2hJdGVtRmFpbHVyZXM6IHRydWUsXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBBZGQgUzMgZXZlbnQgbm90aWZpY2F0aW9uIHRvIHRyaWdnZXIgcHJvY2Vzc2luZ1xuICAgIC8vIFRyaWdnZXIgb24gYW55IGZpbGUgY3JlYXRlZCBpbiB0aGUgb3JpZ2luYWxzIGJ1Y2tldCAoYWxsIGZpbGVzIG5lZWQgcHJvY2Vzc2luZylcbiAgICB0aGlzLm9yaWdpbmFsQnVja2V0LmFkZEV2ZW50Tm90aWZpY2F0aW9uKFxuICAgICAgczMuRXZlbnRUeXBlLk9CSkVDVF9DUkVBVEVELFxuICAgICAgbmV3IHMzbi5TcXNEZXN0aW5hdGlvbihwcm9jZXNzaW5nUXVldWUpXG4gICAgKTtcblxuICAgIC8vIERMUSBSZXByb2Nlc3NvciBMYW1iZGEgLSBoYW5kbGVzIGF1dG9tYXRpYyByZXRyeSB3aXRoIGV4cG9uZW50aWFsIGJhY2tvZmZcbiAgICBjb25zdCBkbHFSZXByb2Nlc3NvckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnRExRUmVwcm9jZXNzb3JGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBST1ZJREVEX0FMMixcbiAgICAgIGhhbmRsZXI6ICdib290c3RyYXAnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9iYWNrZW5kJywge1xuICAgICAgICBidW5kbGluZzoge1xuICAgICAgICAgIGltYWdlOiBsYW1iZGEuUnVudGltZS5QUk9WSURFRF9BTDIuYnVuZGxpbmdJbWFnZSxcbiAgICAgICAgICBjb21tYW5kOiBbXG4gICAgICAgICAgICAnYmFzaCcsICctYycsIFtcbiAgICAgICAgICAgICAgJ3l1bSBpbnN0YWxsIC15IGdvbGFuZyB6aXAnLFxuICAgICAgICAgICAgICAnZXhwb3J0IEdPUEFUSD0vdG1wL2dvJyxcbiAgICAgICAgICAgICAgJ2V4cG9ydCBHT0NBQ0hFPS90bXAvZ28tY2FjaGUnLFxuICAgICAgICAgICAgICAnY2QgL2Fzc2V0LWlucHV0JyxcbiAgICAgICAgICAgICAgJ0dPT1M9bGludXggR09BUkNIPWFybTY0IENHT19FTkFCTEVEPTAgZ28gYnVpbGQgLXRhZ3MgbGFtYmRhLm5vcnBjIC1vIC9hc3NldC1vdXRwdXQvYm9vdHN0cmFwIGNtZC9kbHEtcmVwcm9jZXNzb3IvbWFpbi5nbycsXG4gICAgICAgICAgICBdLmpvaW4oJyAmJiAnKSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHVzZXI6ICdyb290JyxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICAgYXJjaGl0ZWN0dXJlOiBsYW1iZGEuQXJjaGl0ZWN0dXJlLkFSTV82NCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSwgLy8gTXVzdCBiZSA8PSBETFEgdmlzaWJpbGl0eSB0aW1lb3V0XG4gICAgICBtZW1vcnlTaXplOiAyNTYsIC8vIE1pbmltYWwgbWVtb3J5IGZvciBsaWdodHdlaWdodCBtZXNzYWdlIHJlcHJvY2Vzc2luZ1xuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgU1RBR0U6IHByb3BzLnN0YWdlLFxuICAgICAgICBBV1NfUkVHSU9OX05BTUU6IHRoaXMucmVnaW9uLFxuICAgICAgICBEWU5BTU9EQl9UQUJMRV9QUkVGSVg6ICdwaG90b2dyYXBoZXItZ2FsbGVyeScsXG4gICAgICAgIFMzX0JVQ0tFVF9PUklHSU5BTDogdGhpcy5vcmlnaW5hbEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBTM19CVUNLRVRfT1BUSU1JWkVEOiB0aGlzLm9wdGltaXplZEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBTM19CVUNLRVRfVEhVTUJOQUlMOiB0aGlzLnRodW1ibmFpbEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBQUk9DRVNTSU5HX1FVRVVFX1VSTDogcHJvY2Vzc2luZ1F1ZXVlLnF1ZXVlVXJsLFxuICAgICAgfSxcbiAgICAgIHJlc2VydmVkQ29uY3VycmVudEV4ZWN1dGlvbnM6IDUsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSywgLy8gS2VlcCBsb2dzIGZvciA3IGRheXNcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IERMUSByZXByb2Nlc3NvciBwZXJtaXNzaW9uc1xuICAgIHByb3BzLmRhdGFiYXNlU3RhY2sucGhvdG9zVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGRscVJlcHJvY2Vzc29yRnVuY3Rpb24pO1xuICAgIHByb2Nlc3NpbmdRdWV1ZS5ncmFudFNlbmRNZXNzYWdlcyhkbHFSZXByb2Nlc3NvckZ1bmN0aW9uKTtcblxuICAgIC8vIENvbm5lY3QgRExRIHJlcHJvY2Vzc29yIHRvIERMUVxuICAgIGRscVJlcHJvY2Vzc29yRnVuY3Rpb24uYWRkRXZlbnRTb3VyY2UoXG4gICAgICBuZXcgbGFtYmRhRXZlbnRTb3VyY2VzLlNxc0V2ZW50U291cmNlKGRlYWRMZXR0ZXJRdWV1ZSwge1xuICAgICAgICBiYXRjaFNpemU6IDEsXG4gICAgICAgIHJlcG9ydEJhdGNoSXRlbUZhaWx1cmVzOiB0cnVlLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gQ2xvdWRXYXRjaCBBbGFybXNcbiAgICBwcm9jZXNzaW5nUXVldWUubWV0cmljQXBwcm94aW1hdGVBZ2VPZk9sZGVzdE1lc3NhZ2UoKS5jcmVhdGVBbGFybSh0aGlzLCAnT2xkZXN0TWVzc2FnZUFsYXJtJywge1xuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICB0aHJlc2hvbGQ6IDYwMCxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdBbGVydCBpZiBtZXNzYWdlcyBhcmUgc3R1Y2sgaW4gcXVldWUgZm9yIHRvbyBsb25nJyxcbiAgICB9KTtcblxuICAgIGRlYWRMZXR0ZXJRdWV1ZS5tZXRyaWNBcHByb3hpbWF0ZU51bWJlck9mTWVzc2FnZXNWaXNpYmxlKCkuY3JlYXRlQWxhcm0odGhpcywgJ0RMUUFsYXJtJywge1xuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICB0aHJlc2hvbGQ6IDEsXG4gICAgICBhbGFybURlc2NyaXB0aW9uOiAnQWxlcnQgd2hlbiBtZXNzYWdlcyBlbmQgdXAgaW4gRExRIChwcm9jZXNzaW5nIGZhaWx1cmVzKScsXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ09yaWdpbmFsQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLm9yaWdpbmFsQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBleHBvcnROYW1lOiBgT3JpZ2luYWxCdWNrZXQtJHtwcm9wcy5zdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ09wdGltaXplZEJ1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5vcHRpbWl6ZWRCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGV4cG9ydE5hbWU6IGBPcHRpbWl6ZWRCdWNrZXQtJHtwcm9wcy5zdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1RodW1ibmFpbEJ1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy50aHVtYm5haWxCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGV4cG9ydE5hbWU6IGBUaHVtYm5haWxCdWNrZXQtJHtwcm9wcy5zdGFnZX1gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Nsb3VkRnJvbnREb21haW4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZSxcbiAgICAgIGV4cG9ydE5hbWU6IGBDbG91ZEZyb250RG9tYWluLSR7cHJvcHMuc3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDbG91ZEZyb250RGlzdHJpYnV0aW9uSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWQsXG4gICAgICBleHBvcnROYW1lOiBgQ2xvdWRGcm9udERpc3RyaWJ1dGlvbklkLSR7cHJvcHMuc3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQcm9jZXNzaW5nUXVldWVVcmwnLCB7XG4gICAgICB2YWx1ZTogcHJvY2Vzc2luZ1F1ZXVlLnF1ZXVlVXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdQcm9jZXNzaW5nIHF1ZXVlIFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUHJvY2Vzc29yRnVuY3Rpb25Bcm4nLCB7XG4gICAgICB2YWx1ZTogcHJvY2Vzc29yRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1Byb2Nlc3NvciBMYW1iZGEgZnVuY3Rpb24gQVJOJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEZWFkTGV0dGVyUXVldWVVcmwnLCB7XG4gICAgICB2YWx1ZTogZGVhZExldHRlclF1ZXVlLnF1ZXVlVXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdEZWFkIGxldHRlciBxdWV1ZSBVUkwnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RMUVJlcHJvY2Vzc29yRnVuY3Rpb25Bcm4nLCB7XG4gICAgICB2YWx1ZTogZGxxUmVwcm9jZXNzb3JGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnRExRIFJlcHJvY2Vzc29yIExhbWJkYSBmdW5jdGlvbiBBUk4nLFxuICAgIH0pO1xuICB9XG59XG4iXX0=