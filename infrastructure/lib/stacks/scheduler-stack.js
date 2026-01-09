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
exports.SchedulerStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class SchedulerStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const { stage, databaseStack, storageStack } = props;
        // Create CloudWatch Log Group for scheduler Lambda
        const logGroup = new logs.LogGroup(this, 'SchedulerLogGroup', {
            logGroupName: `/aws/lambda/photographer-gallery-scheduler-${stage}`,
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Create scheduler Lambda function
        this.schedulerFunction = new lambda.Function(this, 'SchedulerFunction', {
            functionName: `photographer-gallery-scheduler-${stage}`,
            runtime: lambda.Runtime.PROVIDED_AL2023,
            architecture: lambda.Architecture.ARM_64,
            handler: 'bootstrap',
            code: lambda.Code.fromAsset('../backend/bin', {
                bundling: {
                    image: lambda.Runtime.PROVIDED_AL2023.bundlingImage,
                    command: ['bash', '-c', 'cp bootstrap-scheduler /asset-output/bootstrap'],
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
exports.SchedulerStack = SchedulerStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NoZWR1bGVyLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic2NoZWR1bGVyLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQywrREFBaUQ7QUFDakQsK0RBQWlEO0FBQ2pELHdFQUEwRDtBQUUxRCwyREFBNkM7QUFXN0MsTUFBYSxjQUFlLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFHM0MsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUEwQjtRQUNsRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsS0FBSyxFQUFFLGFBQWEsRUFBRSxZQUFZLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFckQsbURBQW1EO1FBQ25ELE1BQU0sUUFBUSxHQUFHLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDNUQsWUFBWSxFQUFFLDhDQUE4QyxLQUFLLEVBQUU7WUFDbkUsU0FBUyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUTtZQUN0QyxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1NBQ3pDLENBQUMsQ0FBQztRQUVILG1DQUFtQztRQUNuQyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUN0RSxZQUFZLEVBQUUsa0NBQWtDLEtBQUssRUFBRTtZQUN2RCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxlQUFlO1lBQ3ZDLFlBQVksRUFBRSxNQUFNLENBQUMsWUFBWSxDQUFDLE1BQU07WUFDeEMsT0FBTyxFQUFFLFdBQVc7WUFDcEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixFQUFFO2dCQUM1QyxRQUFRLEVBQUU7b0JBQ1IsS0FBSyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLGFBQWE7b0JBQ25ELE9BQU8sRUFBRSxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsZ0RBQWdELENBQUM7aUJBQzFFO2FBQ0YsQ0FBQztZQUNGLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDaEMsVUFBVSxFQUFFLEdBQUc7WUFDZixXQUFXLEVBQUU7Z0JBQ1gscUJBQXFCLEVBQUUsc0JBQXNCO2dCQUM3QyxLQUFLLEVBQUUsS0FBSztnQkFDWixrQkFBa0IsRUFBRSxZQUFZLENBQUMsY0FBYyxDQUFDLFVBQVU7Z0JBQzFELG1CQUFtQixFQUFFLFlBQVksQ0FBQyxlQUFlLENBQUMsVUFBVTtnQkFDNUQsbUJBQW1CLEVBQUUsWUFBWSxDQUFDLGVBQWUsQ0FBQyxVQUFVO2FBQzdEO1lBQ0QsUUFBUTtTQUNULENBQUMsQ0FBQztRQUVILDZCQUE2QjtRQUM3QixhQUFhLENBQUMsY0FBYyxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQ3hFLGFBQWEsQ0FBQyxXQUFXLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFFckUsOEJBQThCO1FBQzlCLFlBQVksQ0FBQyxjQUFjLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQ2hFLFlBQVksQ0FBQyxlQUFlLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQ2pFLFlBQVksQ0FBQyxlQUFlLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBRWpFLG1EQUFtRDtRQUNuRCxNQUFNLElBQUksR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQ3JELFFBQVEsRUFBRSxzQ0FBc0MsS0FBSyxFQUFFO1lBQ3ZELFdBQVcsRUFBRSwwQ0FBMEM7WUFDdkQsUUFBUSxFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDO2dCQUM3QixNQUFNLEVBQUUsR0FBRztnQkFDWCxJQUFJLEVBQUUsR0FBRztnQkFDVCxHQUFHLEVBQUUsR0FBRztnQkFDUixLQUFLLEVBQUUsR0FBRztnQkFDVixJQUFJLEVBQUUsR0FBRzthQUNWLENBQUM7U0FDSCxDQUFDLENBQUM7UUFFSCx1QkFBdUI7UUFDdkIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFO1lBQ2hFLGFBQWEsRUFBRSxDQUFDO1NBQ2pCLENBQUMsQ0FBQyxDQUFDO1FBRUosVUFBVTtRQUNWLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDOUMsS0FBSyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxXQUFXO1lBQ3pDLFdBQVcsRUFBRSwrQkFBK0I7U0FDN0MsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUMzQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFFBQVE7WUFDcEIsV0FBVyxFQUFFLHlDQUF5QztTQUN2RCxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUE3RUQsd0NBNkVDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBEYXRhYmFzZVN0YWNrIH0gZnJvbSAnLi9kYXRhYmFzZS1zdGFjayc7XG5pbXBvcnQgeyBTdG9yYWdlU3RhY2sgfSBmcm9tICcuL3N0b3JhZ2Utc3RhY2snO1xuXG5pbnRlcmZhY2UgU2NoZWR1bGVyU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgc3RhZ2U6IHN0cmluZztcbiAgZGF0YWJhc2VTdGFjazogRGF0YWJhc2VTdGFjaztcbiAgc3RvcmFnZVN0YWNrOiBTdG9yYWdlU3RhY2s7XG59XG5cbmV4cG9ydCBjbGFzcyBTY2hlZHVsZXJTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBzY2hlZHVsZXJGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBTY2hlZHVsZXJTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCB7IHN0YWdlLCBkYXRhYmFzZVN0YWNrLCBzdG9yYWdlU3RhY2sgfSA9IHByb3BzO1xuXG4gICAgLy8gQ3JlYXRlIENsb3VkV2F0Y2ggTG9nIEdyb3VwIGZvciBzY2hlZHVsZXIgTGFtYmRhXG4gICAgY29uc3QgbG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnU2NoZWR1bGVyTG9nR3JvdXAnLCB7XG4gICAgICBsb2dHcm91cE5hbWU6IGAvYXdzL2xhbWJkYS9waG90b2dyYXBoZXItZ2FsbGVyeS1zY2hlZHVsZXItJHtzdGFnZX1gLFxuICAgICAgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIHNjaGVkdWxlciBMYW1iZGEgZnVuY3Rpb25cbiAgICB0aGlzLnNjaGVkdWxlckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU2NoZWR1bGVyRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGBwaG90b2dyYXBoZXItZ2FsbGVyeS1zY2hlZHVsZXItJHtzdGFnZX1gLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFJPVklERURfQUwyMDIzLFxuICAgICAgYXJjaGl0ZWN0dXJlOiBsYW1iZGEuQXJjaGl0ZWN0dXJlLkFSTV82NCxcbiAgICAgIGhhbmRsZXI6ICdib290c3RyYXAnLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9iYWNrZW5kL2JpbicsIHtcbiAgICAgICAgYnVuZGxpbmc6IHtcbiAgICAgICAgICBpbWFnZTogbGFtYmRhLlJ1bnRpbWUuUFJPVklERURfQUwyMDIzLmJ1bmRsaW5nSW1hZ2UsXG4gICAgICAgICAgY29tbWFuZDogWydiYXNoJywgJy1jJywgJ2NwIGJvb3RzdHJhcC1zY2hlZHVsZXIgL2Fzc2V0LW91dHB1dC9ib290c3RyYXAnXSxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBEWU5BTU9EQl9UQUJMRV9QUkVGSVg6ICdwaG90b2dyYXBoZXItZ2FsbGVyeScsXG4gICAgICAgIFNUQUdFOiBzdGFnZSxcbiAgICAgICAgUzNfQlVDS0VUX09SSUdJTkFMOiBzdG9yYWdlU3RhY2sub3JpZ2luYWxCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgUzNfQlVDS0VUX09QVElNSVpFRDogc3RvcmFnZVN0YWNrLm9wdGltaXplZEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBTM19CVUNLRVRfVEhVTUJOQUlMOiBzdG9yYWdlU3RhY2sudGh1bWJuYWlsQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICB9LFxuICAgICAgbG9nR3JvdXAsXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBEeW5hbW9EQiBwZXJtaXNzaW9uc1xuICAgIGRhdGFiYXNlU3RhY2suZ2FsbGVyaWVzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHRoaXMuc2NoZWR1bGVyRnVuY3Rpb24pO1xuICAgIGRhdGFiYXNlU3RhY2sucGhvdG9zVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKHRoaXMuc2NoZWR1bGVyRnVuY3Rpb24pO1xuXG4gICAgLy8gR3JhbnQgUzMgZGVsZXRlIHBlcm1pc3Npb25zXG4gICAgc3RvcmFnZVN0YWNrLm9yaWdpbmFsQnVja2V0LmdyYW50RGVsZXRlKHRoaXMuc2NoZWR1bGVyRnVuY3Rpb24pO1xuICAgIHN0b3JhZ2VTdGFjay5vcHRpbWl6ZWRCdWNrZXQuZ3JhbnREZWxldGUodGhpcy5zY2hlZHVsZXJGdW5jdGlvbik7XG4gICAgc3RvcmFnZVN0YWNrLnRodW1ibmFpbEJ1Y2tldC5ncmFudERlbGV0ZSh0aGlzLnNjaGVkdWxlckZ1bmN0aW9uKTtcblxuICAgIC8vIENyZWF0ZSBFdmVudEJyaWRnZSBydWxlIHRvIHJ1biBkYWlseSBhdCAyIEFNIFVUQ1xuICAgIGNvbnN0IHJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ0RhaWx5Q2xlYW51cFJ1bGUnLCB7XG4gICAgICBydWxlTmFtZTogYHBob3RvZ3JhcGhlci1nYWxsZXJ5LWRhaWx5LWNsZWFudXAtJHtzdGFnZX1gLFxuICAgICAgZGVzY3JpcHRpb246ICdSdW5zIGRhaWx5IHRvIGNsZWFuIHVwIGV4cGlyZWQgZ2FsbGVyaWVzJyxcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuY3Jvbih7XG4gICAgICAgIG1pbnV0ZTogJzAnLFxuICAgICAgICBob3VyOiAnMicsXG4gICAgICAgIGRheTogJyonLFxuICAgICAgICBtb250aDogJyonLFxuICAgICAgICB5ZWFyOiAnKicsXG4gICAgICB9KSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBMYW1iZGEgYXMgdGFyZ2V0XG4gICAgcnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24odGhpcy5zY2hlZHVsZXJGdW5jdGlvbiwge1xuICAgICAgcmV0cnlBdHRlbXB0czogMixcbiAgICB9KSk7XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1NjaGVkdWxlckZ1bmN0aW9uQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuc2NoZWR1bGVyRnVuY3Rpb24uZnVuY3Rpb25Bcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1NjaGVkdWxlciBMYW1iZGEgRnVuY3Rpb24gQVJOJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTY2hlZHVsZXJSdWxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiBydWxlLnJ1bGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdFdmVudEJyaWRnZSBydWxlIG5hbWUgZm9yIGRhaWx5IGNsZWFudXAnLFxuICAgIH0pO1xuICB9XG59XG4iXX0=