#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { DomainStack } from '../lib/stacks/domain-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { AuthStack } from '../lib/stacks/auth-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { SchedulerStack } from '../lib/stacks/scheduler-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

const stage = app.node.tryGetContext('stage') || 'dev';

// Get base domain from context (required for custom domain support)
// Usage: cdk deploy -c baseDomain=photographergallery.com
const baseDomain = app.node.tryGetContext('baseDomain');
const hostedZoneId = app.node.tryGetContext('hostedZoneId');

// Database Stack
const databaseStack = new DatabaseStack(app, `PhotographerGalleryDatabase-${stage}`, {
  env,
  stage,
});

// Domain Stack (optional - only created if baseDomain is provided)
let domainStack: DomainStack | undefined;
if (baseDomain) {
  domainStack = new DomainStack(app, `PhotographerGalleryDomain-${stage}`, {
    env,
    stage,
    baseDomain,
    hostedZoneId,
  });
}

// Storage Stack (includes image processing)
const storageStack = new StorageStack(app, `PhotographerGalleryStorage-${stage}`, {
  env,
  stage,
  databaseStack,
  domainStack, // Pass domain stack for CloudFront custom domain config
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

// Scheduler Stack (for daily cleanup of expired galleries)
const schedulerStack = new SchedulerStack(app, `PhotographerGalleryScheduler-${stage}`, {
  env,
  stage,
  databaseStack,
  storageStack,
});

// Add tags to all resources
cdk.Tags.of(app).add('Application', 'PhotographerGallery');
cdk.Tags.of(app).add('Stage', stage);
