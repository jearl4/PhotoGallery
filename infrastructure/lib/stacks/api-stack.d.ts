import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { DatabaseStack } from './database-stack';
import { StorageStack } from './storage-stack';
import { AuthStack } from './auth-stack';
interface ApiStackProps extends cdk.StackProps {
    stage: string;
    databaseStack: DatabaseStack;
    storageStack: StorageStack;
    authStack: AuthStack;
}
export declare class ApiStack extends cdk.Stack {
    readonly api: apigateway.RestApi;
    readonly apiHandler: lambda.Function;
    constructor(scope: Construct, id: string, props: ApiStackProps);
}
export {};
