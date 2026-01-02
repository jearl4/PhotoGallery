import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { DatabaseStack } from './database-stack';
export interface ProcessingStackProps extends cdk.StackProps {
    stage: string;
    originalBucketName: string;
    optimizedBucketName: string;
    thumbnailBucketName: string;
    databaseStack: DatabaseStack;
}
export declare class ProcessingStack extends cdk.Stack {
    readonly processingQueue: sqs.Queue;
    readonly processorFunction: lambda.Function;
    constructor(scope: Construct, id: string, props: ProcessingStackProps);
}
