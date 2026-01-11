import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

interface DatabaseStackProps extends cdk.StackProps {
  stage: string;
}

export class DatabaseStack extends cdk.Stack {
  public readonly photographersTable: dynamodb.Table;
  public readonly galleriesTable: dynamodb.Table;
  public readonly photosTable: dynamodb.Table;
  public readonly favoritesTable: dynamodb.Table;
  public readonly clientSessionsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    // Photographers Table
    this.photographersTable = new dynamodb.Table(this, 'PhotographersTable', {
      tableName: `photographer-gallery-photographers-${props.stage}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: props.stage === 'prod',
      removalPolicy: props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for email lookup
    this.photographersTable.addGlobalSecondaryIndex({
      indexName: 'EmailIndex',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for subdomain lookup (custom domain support)
    this.photographersTable.addGlobalSecondaryIndex({
      indexName: 'SubdomainIndex',
      partitionKey: { name: 'subdomain', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for custom domain lookup
    this.photographersTable.addGlobalSecondaryIndex({
      indexName: 'CustomDomainIndex',
      partitionKey: { name: 'customDomain', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Galleries Table
    this.galleriesTable = new dynamodb.Table(this, 'GalleriesTable', {
      tableName: `photographer-gallery-galleries-${props.stage}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: props.stage === 'prod',
      removalPolicy: props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI1: Gallery lookup by ID
    this.galleriesTable.addGlobalSecondaryIndex({
      indexName: 'GalleryIdIndex',
      partitionKey: { name: 'galleryId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI2: Lookup by custom URL
    this.galleriesTable.addGlobalSecondaryIndex({
      indexName: 'CustomUrlIndex',
      partitionKey: { name: 'customUrl', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI3: Expiration processing
    this.galleriesTable.addGlobalSecondaryIndex({
      indexName: 'StatusExpirationIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'expiresAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Photos Table
    this.photosTable = new dynamodb.Table(this, 'PhotosTable', {
      tableName: `photographer-gallery-photos-${props.stage}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: props.stage === 'prod',
      removalPolicy: props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI1: Photo lookup by ID
    this.photosTable.addGlobalSecondaryIndex({
      indexName: 'PhotoIdIndex',
      partitionKey: { name: 'photoId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Favorites Table
    this.favoritesTable = new dynamodb.Table(this, 'FavoritesTable', {
      tableName: `photographer-gallery-favorites-${props.stage}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI1: Check if photo is favorited
    this.favoritesTable.addGlobalSecondaryIndex({
      indexName: 'PhotoSessionIndex',
      partitionKey: { name: 'photoId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Client Sessions Table
    this.clientSessionsTable = new dynamodb.Table(this, 'ClientSessionsTable', {
      tableName: `photographer-gallery-sessions-${props.stage}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: props.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Outputs
    new cdk.CfnOutput(this, 'PhotographersTableName', {
      value: this.photographersTable.tableName,
      exportName: `PhotographersTable-${props.stage}`,
    });

    new cdk.CfnOutput(this, 'GalleriesTableName', {
      value: this.galleriesTable.tableName,
      exportName: `GalleriesTable-${props.stage}`,
    });

    new cdk.CfnOutput(this, 'PhotosTableName', {
      value: this.photosTable.tableName,
      exportName: `PhotosTable-${props.stage}`,
    });

    new cdk.CfnOutput(this, 'FavoritesTableName', {
      value: this.favoritesTable.tableName,
      exportName: `FavoritesTable-${props.stage}`,
    });

    new cdk.CfnOutput(this, 'ClientSessionsTableName', {
      value: this.clientSessionsTable.tableName,
      exportName: `ClientSessionsTable-${props.stage}`,
    });
  }
}
