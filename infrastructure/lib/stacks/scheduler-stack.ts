import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { DatabaseStack } from './database-stack';
import { StorageStack } from './storage-stack';

interface SchedulerStackProps extends cdk.StackProps {
  stage: string;
  databaseStack: DatabaseStack;
  storageStack: StorageStack;
}

export class SchedulerStack extends cdk.Stack {
  public readonly schedulerFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: SchedulerStackProps) {
    super(scope, id, props);

    const { stage, databaseStack, storageStack } = props;

    // Create CloudWatch Log Group for scheduler Lambda
    const logGroup = new logs.LogGroup(this, 'SchedulerLogGroup', {
      logGroupName: `/aws/lambda/photographer-gallery-scheduler-${stage}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create scheduler Lambda function
    // Build Go code during CDK deployment (same pattern as API Lambda)
    this.schedulerFunction = new lambda.Function(this, 'SchedulerFunction', {
      functionName: `photographer-gallery-scheduler-${stage}`,
      runtime: lambda.Runtime.PROVIDED_AL2,
      architecture: lambda.Architecture.ARM_64,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../backend', {
        bundling: {
          image: lambda.Runtime.PROVIDED_AL2.bundlingImage,
          command: [
            'bash', '-c', [
              'yum install -y golang',
              'export GOPATH=/tmp/go',
              'export GOCACHE=/tmp/go-cache',
              'cd /asset-input',
              'GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -tags lambda.norpc -o /asset-output/bootstrap cmd/scheduler/main.go',
            ].join(' && '),
          ],
          user: 'root',
        },
      }),
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      environment: {
        DYNAMODB_TABLE_PREFIX: 'photographer-gallery',
        STAGE: stage,
        S3_BUCKET_ORIGINAL: storageStack.originalBucket.bucketName,
        S3_BUCKET_OPTIMIZED: storageStack.optimizedBucket.bucketName,
        S3_BUCKET_THUMBNAIL: storageStack.thumbnailBucket.bucketName,
      },
      logGroup,
    });

    // Grant DynamoDB permissions
    databaseStack.galleriesTable.grantReadWriteData(this.schedulerFunction);
    databaseStack.photosTable.grantReadWriteData(this.schedulerFunction);

    // Grant S3 delete permissions
    storageStack.originalBucket.grantDelete(this.schedulerFunction);
    storageStack.optimizedBucket.grantDelete(this.schedulerFunction);
    storageStack.thumbnailBucket.grantDelete(this.schedulerFunction);

    // Create EventBridge rule to run daily at 2 AM UTC
    const rule = new events.Rule(this, 'DailyCleanupRule', {
      ruleName: `photographer-gallery-daily-cleanup-${stage}`,
      description: 'Runs daily to clean up expired galleries',
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '2',
        day: '*',
        month: '*',
        year: '*',
      }),
    });

    // Add Lambda as target
    rule.addTarget(new targets.LambdaFunction(this.schedulerFunction, {
      retryAttempts: 2,
    }));

    // Outputs
    new cdk.CfnOutput(this, 'SchedulerFunctionArn', {
      value: this.schedulerFunction.functionArn,
      description: 'Scheduler Lambda Function ARN',
    });

    new cdk.CfnOutput(this, 'SchedulerRuleName', {
      value: rule.ruleName,
      description: 'EventBridge rule name for daily cleanup',
    });
  }
}
