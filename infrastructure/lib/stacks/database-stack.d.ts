import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
interface DatabaseStackProps extends cdk.StackProps {
    stage: string;
}
export declare class DatabaseStack extends cdk.Stack {
    readonly photographersTable: dynamodb.Table;
    readonly galleriesTable: dynamodb.Table;
    readonly photosTable: dynamodb.Table;
    readonly favoritesTable: dynamodb.Table;
    readonly clientSessionsTable: dynamodb.Table;
    constructor(scope: Construct, id: string, props: DatabaseStackProps);
}
export {};
