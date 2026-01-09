import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { DatabaseStack } from './database-stack';
import { StorageStack } from './storage-stack';
interface SchedulerStackProps extends cdk.StackProps {
    stage: string;
    databaseStack: DatabaseStack;
    storageStack: StorageStack;
}
export declare class SchedulerStack extends cdk.Stack {
    readonly schedulerFunction: lambda.Function;
    constructor(scope: Construct, id: string, props: SchedulerStackProps);
}
export {};
