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
exports.ApiStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class ApiStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        databaseStack.photographersTable.grantReadWriteData(this.apiHandler);
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
exports.ApiStack = ApiStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBpLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUVuQywrREFBaUQ7QUFDakQsdUVBQXlEO0FBQ3pELHlEQUEyQztBQUMzQywyREFBNkM7QUFZN0MsTUFBYSxRQUFTLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFJckMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFvQjtRQUM1RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsS0FBSyxFQUFFLGFBQWEsRUFBRSxZQUFZLEVBQUUsU0FBUyxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRWhFLDBCQUEwQjtRQUMxQiwrREFBK0Q7UUFDL0QsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUN4RCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxZQUFZO1lBQ3BDLE9BQU8sRUFBRSxXQUFXO1lBQ3BCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEVBQUU7Z0JBQ3hDLFFBQVEsRUFBRTtvQkFDUixLQUFLLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsYUFBYTtvQkFDaEQsT0FBTyxFQUFFO3dCQUNQLE1BQU0sRUFBRSxJQUFJLEVBQUU7NEJBQ1osMkJBQTJCOzRCQUMzQix1QkFBdUI7NEJBQ3ZCLDhCQUE4Qjs0QkFDOUIsaUJBQWlCOzRCQUNqQiw4R0FBOEc7eUJBQy9HLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztxQkFDZjtvQkFDRCxJQUFJLEVBQUUsTUFBTTtpQkFDYjthQUNGLENBQUM7WUFDRixZQUFZLEVBQUUsTUFBTSxDQUFDLFlBQVksQ0FB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QUNYLHNCQUFzQjtpQkFDdkI7Z0JBQ0QsZ0JBQWdCLEVBQUUsSUFBSTthQUN2QjtTQUNGLENBQUMsQ0FBQztRQUVILHFCQUFxQjtRQUNyQixNQUFNLFdBQVcsR0FBRyxJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFO1lBQ3BFLEtBQUssRUFBRSxJQUFJO1lBQ1gsZUFBZSxFQUFFLElBQUk7U0FDdEIsQ0FBQyxDQUFDO1FBRUgsYUFBYTtRQUNiLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM3QyxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRWpDLCtCQUErQjtRQUMvQixFQUFFLENBQUMsUUFBUSxDQUFDO1lBQ1Ysa0JBQWtCLEVBQUUsV0FBVztZQUMvQixTQUFTLEVBQUUsSUFBSTtTQUNoQixDQUFDLENBQUM7UUFFSCxVQUFVO1FBQ1YsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUU7WUFDaEMsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRztZQUNuQixXQUFXLEVBQUUsaUJBQWlCO1lBQzlCLFVBQVUsRUFBRSxnQ0FBZ0MsS0FBSyxFQUFFO1NBQ3BELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFO1lBQy9CLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVM7WUFDekIsV0FBVyxFQUFFLGdCQUFnQjtZQUM3QixVQUFVLEVBQUUsK0JBQStCLEtBQUssRUFBRTtTQUNuRCxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUE1SEQsNEJBNEhDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCB7IERhdGFiYXNlU3RhY2sgfSBmcm9tICcuL2RhdGFiYXNlLXN0YWNrJztcbmltcG9ydCB7IFN0b3JhZ2VTdGFjayB9IGZyb20gJy4vc3RvcmFnZS1zdGFjayc7XG5pbXBvcnQgeyBBdXRoU3RhY2sgfSBmcm9tICcuL2F1dGgtc3RhY2snO1xuXG5pbnRlcmZhY2UgQXBpU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgc3RhZ2U6IHN0cmluZztcbiAgZGF0YWJhc2VTdGFjazogRGF0YWJhc2VTdGFjaztcbiAgc3RvcmFnZVN0YWNrOiBTdG9yYWdlU3RhY2s7XG4gIGF1dGhTdGFjazogQXV0aFN0YWNrO1xufVxuXG5leHBvcnQgY2xhc3MgQXBpU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgYXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XG4gIHB1YmxpYyByZWFkb25seSBhcGlIYW5kbGVyOiBsYW1iZGEuRnVuY3Rpb247XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEFwaVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgc3RhZ2UsIGRhdGFiYXNlU3RhY2ssIHN0b3JhZ2VTdGFjaywgYXV0aFN0YWNrIH0gPSBwcm9wcztcblxuICAgIC8vIExhbWJkYSBmdW5jdGlvbiBmb3IgQVBJXG4gICAgLy8gQ0RLIHdpbGwgYXV0b21hdGljYWxseSBidWlsZCB0aGUgR28gYmluYXJ5IGR1cmluZyBkZXBsb3ltZW50XG4gICAgdGhpcy5hcGlIYW5kbGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQXBpSGFuZGxlcicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBST1ZJREVEX0FMMixcbiAgICAgIGhhbmRsZXI6ICdib290c3RyYXAnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9iYWNrZW5kJywge1xuICAgICAgICBidW5kbGluZzoge1xuICAgICAgICAgIGltYWdlOiBsYW1iZGEuUnVudGltZS5QUk9WSURFRF9BTDIuYnVuZGxpbmdJbWFnZSxcbiAgICAgICAgICBjb21tYW5kOiBbXG4gICAgICAgICAgICAnYmFzaCcsICctYycsIFtcbiAgICAgICAgICAgICAgJ3l1bSBpbnN0YWxsIC15IGdvbGFuZyB6aXAnLFxuICAgICAgICAgICAgICAnZXhwb3J0IEdPUEFUSD0vdG1wL2dvJyxcbiAgICAgICAgICAgICAgJ2V4cG9ydCBHT0NBQ0hFPS90bXAvZ28tY2FjaGUnLFxuICAgICAgICAgICAgICAnY2QgL2Fzc2V0LWlucHV0JyxcbiAgICAgICAgICAgICAgJ0dPT1M9bGludXggR09BUkNIPWFybTY0IENHT19FTkFCTEVEPTAgZ28gYnVpbGQgLXRhZ3MgbGFtYmRhLm5vcnBjIC1vIC9hc3NldC1vdXRwdXQvYm9vdHN0cmFwIGNtZC9hcGkvbWFpbi5nbycsXG4gICAgICAgICAgICBdLmpvaW4oJyAmJiAnKSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHVzZXI6ICdyb290JyxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICAgYXJjaGl0ZWN0dXJlOiBsYW1iZGEuQXJjaGl0ZWN0dXJlLkFSTV82NCxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFNUQUdFOiBzdGFnZSxcbiAgICAgICAgQVdTX1JFR0lPTl9OQU1FOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgRFlOQU1PREJfVEFCTEVfUFJFRklYOiAncGhvdG9ncmFwaGVyLWdhbGxlcnknLFxuICAgICAgICBTM19CVUNLRVRfT1JJR0lOQUw6IHN0b3JhZ2VTdGFjay5vcmlnaW5hbEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBTM19CVUNLRVRfT1BUSU1JWkVEOiBzdG9yYWdlU3RhY2sub3B0aW1pemVkQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIFMzX0JVQ0tFVF9USFVNQk5BSUw6IHN0b3JhZ2VTdGFjay50aHVtYm5haWxCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgQ09HTklUT19VU0VSX1BPT0xfSUQ6IGF1dGhTdGFjay51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICBDT0dOSVRPX0NMSUVOVF9JRDogYXV0aFN0YWNrLnVzZXJQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICAgIFNJR05FRF9VUkxfRVhQSVJBVElPTjogJzI0JyxcbiAgICAgICAgSldUX1NFQ1JFVDogcHJvY2Vzcy5lbnYuSldUX1NFQ1JFVCB8fCAnZGV2LXNlY3JldC1jaGFuZ2UtaW4tcHJvZHVjdGlvbicsXG4gICAgICB9LFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyB0byBEeW5hbW9EQiB0YWJsZXNcbiAgICBkYXRhYmFzZVN0YWNrLnBob3RvZ3JhcGhlcnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5hcGlIYW5kbGVyKTtcbiAgICBkYXRhYmFzZVN0YWNrLmdhbGxlcmllc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh0aGlzLmFwaUhhbmRsZXIpO1xuICAgIGRhdGFiYXNlU3RhY2sucGhvdG9zVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHRoaXMuYXBpSGFuZGxlcik7XG4gICAgZGF0YWJhc2VTdGFjay5mYXZvcml0ZXNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5hcGlIYW5kbGVyKTtcbiAgICBkYXRhYmFzZVN0YWNrLmNsaWVudFNlc3Npb25zVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHRoaXMuYXBpSGFuZGxlcik7XG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyB0byBTMyBidWNrZXRzXG4gICAgc3RvcmFnZVN0YWNrLm9yaWdpbmFsQnVja2V0LmdyYW50UmVhZFdyaXRlKHRoaXMuYXBpSGFuZGxlcik7XG4gICAgc3RvcmFnZVN0YWNrLm9wdGltaXplZEJ1Y2tldC5ncmFudFJlYWRXcml0ZSh0aGlzLmFwaUhhbmRsZXIpO1xuICAgIHN0b3JhZ2VTdGFjay50aHVtYm5haWxCdWNrZXQuZ3JhbnRSZWFkV3JpdGUodGhpcy5hcGlIYW5kbGVyKTtcblxuICAgIC8vIEdyYW50IHBlcm1pc3Npb25zIHRvIENvZ25pdG9cbiAgICB0aGlzLmFwaUhhbmRsZXIuYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluR2V0VXNlcicsXG4gICAgICAgICdjb2duaXRvLWlkcDpHZXRVc2VyJyxcbiAgICAgIF0sXG4gICAgICByZXNvdXJjZXM6IFthdXRoU3RhY2sudXNlclBvb2wudXNlclBvb2xBcm5dLFxuICAgIH0pKTtcblxuICAgIC8vIEFQSSBHYXRld2F5XG4gICAgdGhpcy5hcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdBcGknLCB7XG4gICAgICByZXN0QXBpTmFtZTogYHBob3RvZ3JhcGhlci1nYWxsZXJ5LWFwaS0ke3N0YWdlfWAsXG4gICAgICBkZXNjcmlwdGlvbjogJ1Bob3RvZ3JhcGhlciBHYWxsZXJ5IEFQSScsXG4gICAgICBkZXBsb3lPcHRpb25zOiB7XG4gICAgICAgIHN0YWdlTmFtZTogc3RhZ2UsXG4gICAgICAgIGxvZ2dpbmdMZXZlbDogYXBpZ2F0ZXdheS5NZXRob2RMb2dnaW5nTGV2ZWwuSU5GTyxcbiAgICAgICAgZGF0YVRyYWNlRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgbWV0cmljc0VuYWJsZWQ6IHRydWUsXG4gICAgICB9LFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogc3RhZ2UgPT09ICdwcm9kJ1xuICAgICAgICAgID8gWydodHRwczovL3lvdXItcHJvZHVjdGlvbi1kb21haW4uY29tJ11cbiAgICAgICAgICA6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXG4gICAgICAgIGFsbG93SGVhZGVyczogW1xuICAgICAgICAgICdDb250ZW50LVR5cGUnLFxuICAgICAgICAgICdYLUFtei1EYXRlJyxcbiAgICAgICAgICAnQXV0aG9yaXphdGlvbicsXG4gICAgICAgICAgJ1gtQXBpLUtleScsXG4gICAgICAgICAgJ1gtQW16LVNlY3VyaXR5LVRva2VuJyxcbiAgICAgICAgXSxcbiAgICAgICAgYWxsb3dDcmVkZW50aWFsczogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgaW50ZWdyYXRpb25cbiAgICBjb25zdCBpbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHRoaXMuYXBpSGFuZGxlciwge1xuICAgICAgcHJveHk6IHRydWUsXG4gICAgICBhbGxvd1Rlc3RJbnZva2U6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgcm91dGVzXG4gICAgY29uc3QgYXBpID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnYXBpJyk7XG4gICAgY29uc3QgdjEgPSBhcGkuYWRkUmVzb3VyY2UoJ3YxJyk7XG5cbiAgICAvLyBQcm94eSBhbGwgcmVxdWVzdHMgdG8gTGFtYmRhXG4gICAgdjEuYWRkUHJveHkoe1xuICAgICAgZGVmYXVsdEludGVncmF0aW9uOiBpbnRlZ3JhdGlvbixcbiAgICAgIGFueU1ldGhvZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpVXJsJywge1xuICAgICAgdmFsdWU6IHRoaXMuYXBpLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBwaG90b2dyYXBoZXItZ2FsbGVyeS1hcGktdXJsLSR7c3RhZ2V9YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmFwaS5yZXN0QXBpSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBwaG90b2dyYXBoZXItZ2FsbGVyeS1hcGktaWQtJHtzdGFnZX1gLFxuICAgIH0pO1xuICB9XG59XG4iXX0=