import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
import { DatabaseStack } from './database-stack';
interface StorageStackProps extends cdk.StackProps {
    stage: string;
    databaseStack: DatabaseStack;
}
export declare class StorageStack extends cdk.Stack {
    readonly originalBucket: s3.Bucket;
    readonly optimizedBucket: s3.Bucket;
    readonly thumbnailBucket: s3.Bucket;
    readonly distribution: cloudfront.Distribution;
    constructor(scope: Construct, id: string, props: StorageStackProps);
}
export {};
