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
exports.ProcessingStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const sqs = __importStar(require("aws-cdk-lib/aws-sqs"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const lambdaEventSources = __importStar(require("aws-cdk-lib/aws-lambda-event-sources"));
class ProcessingStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        this.processorFunction.addEventSource(new lambdaEventSources.SqsEventSource(this.processingQueue, {
            batchSize: 1, // Process one photo at a time
            reportBatchItemFailures: true, // Enable partial batch responses
        }));
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
exports.ProcessingStack = ProcessingStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzc2luZy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInByb2Nlc3Npbmctc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLCtEQUFpRDtBQUNqRCx5REFBMkM7QUFDM0MseURBQTJDO0FBQzNDLHlGQUEyRTtBQVkzRSxNQUFhLGVBQWdCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFJNUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUEyQjtRQUNuRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsS0FBSyxFQUFFLGtCQUFrQixFQUFFLG1CQUFtQixFQUFFLG1CQUFtQixFQUFFLGFBQWEsRUFBRSxHQUFHLEtBQUssQ0FBQztRQUVyRywrQ0FBK0M7UUFDL0MsTUFBTSxlQUFlLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDM0QsU0FBUyxFQUFFLHVDQUF1QyxLQUFLLEVBQUU7WUFDekQsZUFBZSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztTQUN2QyxDQUFDLENBQUM7UUFFSCx3QkFBd0I7UUFDeEIsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQzVELFNBQVMsRUFBRSxtQ0FBbUMsS0FBSyxFQUFFO1lBQ3JELGlCQUFpQixFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxFQUFFLDRCQUE0QjtZQUN6RSxzQkFBc0IsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsRUFBRSxlQUFlO1lBQ2pFLGVBQWUsRUFBRTtnQkFDZixLQUFLLEVBQUUs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LEVBQUUsYUFBYTtZQUM3QixnQkFBZ0IsRUFBRSxtREFBbUQ7U0FDdEUsQ0FBQyxDQUFDO1FBRUgsZUFBZSxDQUFDLHdDQUF3QyxFQUFFLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUU7WUFDdkYsaUJBQWlCLEVBQUUsQ0FBQztZQUNwQixTQUFTLEVBQUUsQ0FBQztZQUNaLGdCQUFnQixFQUFFLHlEQUF5RDtTQUM1RSxDQUFDLENBQUM7UUFFSCxVQUFVO1FBQ1YsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUM1QyxLQUFLLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxRQUFRO1lBQ3BDLFdBQVcsRUFBRSxzQkFBc0I7U0FDcEMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtZQUM5QyxLQUFLLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFdBQVc7WUFDekMsV0FBVyxFQUFFLCtCQUErQjtTQUM3QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQzVDLEtBQUssRUFBRSxlQUFlLENBQUMsUUFBUTtZQUMvQixXQUFXLEVBQUUsdUJBQXVCO1NBQ3JDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXJIRCwwQ0FxSEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgc3FzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zcXMnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbGFtYmRhRXZlbnRTb3VyY2VzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEtZXZlbnQtc291cmNlcyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IERhdGFiYXNlU3RhY2sgfSBmcm9tICcuL2RhdGFiYXNlLXN0YWNrJztcblxuZXhwb3J0IGludGVyZmFjZSBQcm9jZXNzaW5nU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgc3RhZ2U6IHN0cmluZztcbiAgb3JpZ2luYWxCdWNrZXROYW1lOiBzdHJpbmc7XG4gIG9wdGltaXplZEJ1Y2tldE5hbWU6IHN0cmluZztcbiAgdGh1bWJuYWlsQnVja2V0TmFtZTogc3RyaW5nO1xuICBkYXRhYmFzZVN0YWNrOiBEYXRhYmFzZVN0YWNrO1xufVxuXG5leHBvcnQgY2xhc3MgUHJvY2Vzc2luZ1N0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHByb2Nlc3NpbmdRdWV1ZTogc3FzLlF1ZXVlO1xuICBwdWJsaWMgcmVhZG9ubHkgcHJvY2Vzc29yRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogUHJvY2Vzc2luZ1N0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgc3RhZ2UsIG9yaWdpbmFsQnVja2V0TmFtZSwgb3B0aW1pemVkQnVja2V0TmFtZSwgdGh1bWJuYWlsQnVja2V0TmFtZSwgZGF0YWJhc2VTdGFjayB9ID0gcHJvcHM7XG5cbiAgICAvLyBEZWFkIExldHRlciBRdWV1ZSBmb3IgZmFpbGVkIHByb2Nlc3Npbmcgam9ic1xuICAgIGNvbnN0IGRlYWRMZXR0ZXJRdWV1ZSA9IG5ldyBzcXMuUXVldWUodGhpcywgJ1Byb2Nlc3NpbmdETFEnLCB7XG4gICAgICBxdWV1ZU5hbWU6IGBwaG90b2dyYXBoZXItZ2FsbGVyeS1wcm9jZXNzaW5nLWRscS0ke3N0YWdlfWAsXG4gICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5kYXlzKDE0KSxcbiAgICB9KTtcblxuICAgIC8vIE1haW4gcHJvY2Vzc2luZyBxdWV1ZVxuICAgIHRoaXMucHJvY2Vzc2luZ1F1ZXVlID0gbmV3IHNxcy5RdWV1ZSh0aGlzLCAnUHJvY2Vzc2luZ1F1ZXVlJywge1xuICAgICAgcXVldWVOYW1lOiBgcGhvdG9ncmFwaGVyLWdhbGxlcnktcHJvY2Vzc2luZy0ke3N0YWdlfWAsXG4gICAgICB2aXNpYmlsaXR5VGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTUpLCAvLyBNdXN0IGJlID49IExhbWJkYSB0aW1lb3V0XG4gICAgICByZWNlaXZlTWVzc2FnZVdhaXRUaW1lOiBjZGsuRHVyYXRpb24uc2Vjb25kcygyMCksIC8vIExvbmcgcG9sbGluZ1xuICAgICAgZGVhZExldHRlclF1ZXVlOiB7XG4gICAgICAgIHF1ZXVlOiBkZWFkTGV0dGVyUXVldWUsXG4gICAgICAgIG1heFJlY2VpdmVDb3VudDogMywgLy8gUmV0cnkgMyB0aW1lcyBiZWZvcmUgc2VuZGluZyB0byBETFFcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgZnVuY3Rpb24gZm9yIHByb2Nlc3NpbmcgcGhvdG9zXG4gICAgdGhpcy5wcm9jZXNzb3JGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1Byb2Nlc3NvckZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFJPVklERURfQUwyLFxuICAgICAgaGFuZGxlcjogJ2Jvb3RzdHJhcCcsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2JhY2tlbmQnLCB7XG4gICAgICAgIGJ1bmRsaW5nOiB7XG4gICAgICAgICAgaW1hZ2U6IGxhbWJkYS5SdW50aW1lLlBST1ZJREVEX0FMMi5idW5kbGluZ0ltYWdlLFxuICAgICAgICAgIGNvbW1hbmQ6IFtcbiAgICAgICAgICAgICdiYXNoJywgJy1jJywgW1xuICAgICAgICAgICAgICAneXVtIGluc3RhbGwgLXkgZ29sYW5nIHppcCcsXG4gICAgICAgICAgICAgICdleHBvcnQgR09QQVRIPS90bXAvZ28nLFxuICAgICAgICAgICAgICAnZXhwb3J0IEdPQ0FDSEU9L3RtcC9nby1jYWNoZScsXG4gICAgICAgICAgICAgICdjZCAvYXNzZXQtaW5wdXQnLFxuICAgICAgICAgICAgICAnR09PUz1saW51eCBHT0FSQ0g9YXJtNjQgQ0dPX0VOQUJMRUQ9MCBnbyBidWlsZCAtdGFncyBsYW1iZGEubm9ycGMgLW8gL2Fzc2V0LW91dHB1dC9ib290c3RyYXAgY21kL3Byb2Nlc3Nvci9tYWluLmdvJyxcbiAgICAgICAgICAgIF0uam9pbignICYmICcpLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgdXNlcjogJ3Jvb3QnLFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICBhcmNoaXRlY3R1cmU6IGxhbWJkYS5BcmNoaXRlY3R1cmUuQVJNXzY0LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTApLCAvLyBJbWFnZSBwcm9jZXNzaW5nIGNhbiB0YWtlIHRpbWVcbiAgICAgIG1lbW9yeVNpemU6IDIwNDgsIC8vIE1vcmUgbWVtb3J5IGZvciBpbWFnZSBwcm9jZXNzaW5nIChmYXN0ZXIgQ1BVIHRvbylcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFNUQUdFOiBzdGFnZSxcbiAgICAgICAgQVdTX1JFR0lPTl9OQU1FOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgRFlOQU1PREJfVEFCTEVfUFJFRklYOiAncGhvdG9ncmFwaGVyLWdhbGxlcnknLFxuICAgICAgICBTM19CVUNLRVRfT1JJR0lOQUw6IG9yaWdpbmFsQnVja2V0TmFtZSxcbiAgICAgICAgUzNfQlVDS0VUX09QVElNSVpFRDogb3B0aW1pemVkQnVja2V0TmFtZSxcbiAgICAgICAgUzNfQlVDS0VUX1RIVU1CTkFJTDogdGh1bWJuYWlsQnVja2V0TmFtZSxcbiAgICAgIH0sXG4gICAgICByZXNlcnZlZENvbmN1cnJlbnRFeGVjdXRpb25zOiAxMCwgLy8gTGltaXQgY29uY3VycmVudCBwcm9jZXNzaW5nIHRvIGNvbnRyb2wgY29zdHNcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IER5bmFtb0RCIHBlcm1pc3Npb25zXG4gICAgZGF0YWJhc2VTdGFjay5waG90b3NUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5wcm9jZXNzb3JGdW5jdGlvbik7XG5cbiAgICAvLyBHcmFudCBTMyBwZXJtaXNzaW9ucyB1c2luZyBidWNrZXQgQVJOcyAoYXZvaWRzIGNpcmN1bGFyIGRlcGVuZGVuY3kpXG4gICAgY29uc3Qgb3JpZ2luYWxCdWNrZXRBcm4gPSBgYXJuOmF3czpzMzo6OiR7b3JpZ2luYWxCdWNrZXROYW1lfWA7XG4gICAgY29uc3Qgb3B0aW1pemVkQnVja2V0QXJuID0gYGFybjphd3M6czM6Ojoke29wdGltaXplZEJ1Y2tldE5hbWV9YDtcbiAgICBjb25zdCB0aHVtYm5haWxCdWNrZXRBcm4gPSBgYXJuOmF3czpzMzo6OiR7dGh1bWJuYWlsQnVja2V0TmFtZX1gO1xuXG4gICAgdGhpcy5wcm9jZXNzb3JGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydzMzpHZXRPYmplY3QnXSxcbiAgICAgIHJlc291cmNlczogW2Ake29yaWdpbmFsQnVja2V0QXJufS8qYF0sXG4gICAgfSkpO1xuXG4gICAgdGhpcy5wcm9jZXNzb3JGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydzMzpQdXRPYmplY3QnXSxcbiAgICAgIHJlc291cmNlczogW2Ake29wdGltaXplZEJ1Y2tldEFybn0vKmAsIGAke3RodW1ibmFpbEJ1Y2tldEFybn0vKmBdLFxuICAgIH0pKTtcblxuICAgIC8vIENvbm5lY3QgTGFtYmRhIHRvIFNRUyBxdWV1ZVxuICAgIHRoaXMucHJvY2Vzc29yRnVuY3Rpb24uYWRkRXZlbnRTb3VyY2UoXG4gICAgICBuZXcgbGFtYmRhRXZlbnRTb3VyY2VzLlNxc0V2ZW50U291cmNlKHRoaXMucHJvY2Vzc2luZ1F1ZXVlLCB7XG4gICAgICAgIGJhdGNoU2l6ZTogMSwgLy8gUHJvY2VzcyBvbmUgcGhvdG8gYXQgYSB0aW1lXG4gICAgICAgIHJlcG9ydEJhdGNoSXRlbUZhaWx1cmVzOiB0cnVlLCAvLyBFbmFibGUgcGFydGlhbCBiYXRjaCByZXNwb25zZXNcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIE5vdGU6IFMzIGV2ZW50IG5vdGlmaWNhdGlvbiBpcyBhZGRlZCBpbiBhcHAudHMgYWZ0ZXIgc3RhY2sgY3JlYXRpb25cbiAgICAvLyB0byBhdm9pZCBjaXJjdWxhciBkZXBlbmRlbmN5IGJldHdlZW4gU3RvcmFnZVN0YWNrIGFuZCBQcm9jZXNzaW5nU3RhY2tcblxuICAgIC8vIENsb3VkV2F0Y2ggQWxhcm1zIGZvciBtb25pdG9yaW5nXG4gICAgdGhpcy5wcm9jZXNzaW5nUXVldWUubWV0cmljQXBwcm94aW1hdGVBZ2VPZk9sZGVzdE1lc3NhZ2UoKS5jcmVhdGVBbGFybSh0aGlzLCAnT2xkZXN0TWVzc2FnZUFsYXJtJywge1xuICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICB0aHJlc2hvbGQ6IDYwMCwgLy8gMTAgbWludXRlc1xuICAgICAgYWxhcm1EZXNjcmlwdGlvbjogJ0FsZXJ0IGlmIG1lc3NhZ2VzIGFyZSBzdHVjayBpbiBxdWV1ZSBmb3IgdG9vIGxvbmcnLFxuICAgIH0pO1xuXG4gICAgZGVhZExldHRlclF1ZXVlLm1ldHJpY0FwcHJveGltYXRlTnVtYmVyT2ZNZXNzYWdlc1Zpc2libGUoKS5jcmVhdGVBbGFybSh0aGlzLCAnRExRQWxhcm0nLCB7XG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgIHRocmVzaG9sZDogMSxcbiAgICAgIGFsYXJtRGVzY3JpcHRpb246ICdBbGVydCB3aGVuIG1lc3NhZ2VzIGVuZCB1cCBpbiBETFEgKHByb2Nlc3NpbmcgZmFpbHVyZXMpJyxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUHJvY2Vzc2luZ1F1ZXVlVXJsJywge1xuICAgICAgdmFsdWU6IHRoaXMucHJvY2Vzc2luZ1F1ZXVlLnF1ZXVlVXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdQcm9jZXNzaW5nIHF1ZXVlIFVSTCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUHJvY2Vzc29yRnVuY3Rpb25Bcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5wcm9jZXNzb3JGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnUHJvY2Vzc29yIExhbWJkYSBmdW5jdGlvbiBBUk4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RlYWRMZXR0ZXJRdWV1ZVVybCcsIHtcbiAgICAgIHZhbHVlOiBkZWFkTGV0dGVyUXVldWUucXVldWVVcmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ0RlYWQgbGV0dGVyIHF1ZXVlIFVSTCcsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==