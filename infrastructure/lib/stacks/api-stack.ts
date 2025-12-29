import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { DatabaseStack } from './database-stack';
import { StorageStack } from './storage-stack';
import { AuthStack } from './auth-stack';

interface ApiStackProps extends cdk.StackProps {
  stage: string;
  databaseStack: DatabaseStack;
  storageStack: StorageStack;
  authStack: AuthStack;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly apiHandler: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { stage, databaseStack, storageStack, authStack } = props;

    // Lambda function for API
    // CDK will automatically build the Go binary during deployment
    this.apiHandler = new lambda.Function(this, 'ApiHandler', {
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
              'GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -tags lambda.norpc -o /asset-output/bootstrap cmd/api/main.go',
            ].join(' && '),
          ],
          user: 'root',
        },
      }),
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        STAGE: stage,
        AWS_REGION_NAME: this.region,
        DYNAMODB_TABLE_PREFIX: 'photographer-gallery',
        S3_BUCKET_ORIGINAL: storageStack.originalBucket.bucketName,
        S3_BUCKET_OPTIMIZED: storageStack.optimizedBucket.bucketName,
        S3_BUCKET_THUMBNAIL: storageStack.thumbnailBucket.bucketName,
        COGNITO_USER_POOL_ID: authStack.userPool.userPoolId,
        COGNITO_CLIENT_ID: authStack.userPoolClient.userPoolClientId,
        SIGNED_URL_EXPIRATION: '24',
        JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant permissions to DynamoDB tables
    databaseStack.galleriesTable.grantReadWriteData(this.apiHandler);
    databaseStack.photosTable.grantReadWriteData(this.apiHandler);
    databaseStack.favoritesTable.grantReadWriteData(this.apiHandler);
    databaseStack.clientSessionsTable.grantReadWriteData(this.apiHandler);

    // Grant permissions to S3 buckets
    storageStack.originalBucket.grantReadWrite(this.apiHandler);
    storageStack.optimizedBucket.grantReadWrite(this.apiHandler);
    storageStack.thumbnailBucket.grantReadWrite(this.apiHandler);

    // Grant permissions to Cognito
    this.apiHandler.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:AdminGetUser',
        'cognito-idp:GetUser',
      ],
      resources: [authStack.userPool.userPoolArn],
    }));

    // API Gateway
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: `photographer-gallery-api-${stage}`,
      description: 'Photographer Gallery API',
      deployOptions: {
        stageName: stage,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: stage === 'prod'
          ? ['https://your-production-domain.com']
          : apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
    });

    // Lambda integration
    const integration = new apigateway.LambdaIntegration(this.apiHandler, {
      proxy: true,
      allowTestInvoke: true,
    });

    // API routes
    const api = this.api.root.addResource('api');
    const v1 = api.addResource('v1');

    // Proxy all requests to Lambda
    v1.addProxy({
      defaultIntegration: integration,
      anyMethod: true,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
      exportName: `photographer-gallery-api-url-${stage}`,
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'API Gateway ID',
      exportName: `photographer-gallery-api-id-${stage}`,
    });
  }
}
