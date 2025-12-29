#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { AuthStack } from '../lib/stacks/auth-stack';
import { ApiStack } from '../lib/stacks/api-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

const stage = app.node.tryGetContext('stage') || 'dev';

// Database Stack
const databaseStack = new DatabaseStack(app, `PhotographerGalleryDatabase-${stage}`, {
  env,
  stage,
});

// Storage Stack
const storageStack = new StorageStack(app, `PhotographerGalleryStorage-${stage}`, {
  env,
  stage,
});

// Auth Stack
const authStack = new AuthStack(app, `PhotographerGalleryAuth-${stage}`, {
  env,
  stage,
});

// API Stack (depends on all other stacks)
const apiStack = new ApiStack(app, `PhotographerGalleryApi-${stage}`, {
  env,
  stage,
  databaseStack,
  storageStack,
  authStack,
});

// Add tags to all resources
cdk.Tags.of(app).add('Application', 'PhotographerGallery');
cdk.Tags.of(app).add('Stage', stage);
