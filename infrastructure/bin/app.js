#!/usr/bin/env node
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
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const database_stack_1 = require("../lib/stacks/database-stack");
const storage_stack_1 = require("../lib/stacks/storage-stack");
const auth_stack_1 = require("../lib/stacks/auth-stack");
const api_stack_1 = require("../lib/stacks/api-stack");
const scheduler_stack_1 = require("../lib/stacks/scheduler-stack");
const app = new cdk.App();
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};
const stage = app.node.tryGetContext('stage') || 'dev';
// Database Stack
const databaseStack = new database_stack_1.DatabaseStack(app, `PhotographerGalleryDatabase-${stage}`, {
    env,
    stage,
});
// Storage Stack (includes image processing)
const storageStack = new storage_stack_1.StorageStack(app, `PhotographerGalleryStorage-${stage}`, {
    env,
    stage,
    databaseStack,
});
// Auth Stack
const authStack = new auth_stack_1.AuthStack(app, `PhotographerGalleryAuth-${stage}`, {
    env,
    stage,
});
// API Stack (depends on all other stacks)
const apiStack = new api_stack_1.ApiStack(app, `PhotographerGalleryApi-${stage}`, {
    env,
    stage,
    databaseStack,
    storageStack,
    authStack,
});
// Scheduler Stack (for daily cleanup of expired galleries)
const schedulerStack = new scheduler_stack_1.SchedulerStack(app, `PhotographerGalleryScheduler-${stage}`, {
    env,
    stage,
    databaseStack,
    storageStack,
});
// Add tags to all resources
cdk.Tags.of(app).add('Application', 'PhotographerGallery');
cdk.Tags.of(app).add('Stage', stage);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsaUVBQTZEO0FBQzdELCtEQUEyRDtBQUMzRCx5REFBcUQ7QUFDckQsdURBQW1EO0FBQ25ELG1FQUErRDtBQUUvRCxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQixNQUFNLEdBQUcsR0FBRztJQUNWLE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtJQUN4QyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxXQUFXO0NBQ3RELENBQUM7QUFFRixNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsSUFBSSxLQUFLLENBQUM7QUFFdkQsaUJBQWlCO0FBQ2pCLE1BQU0sYUFBYSxHQUFHLElBQUksOEJBQWEsQ0FBQyxHQUFHLEVBQUUsK0JBQStCLEtBQUssRUFBRSxFQUFFO0lBQ25GLEdBQUc7SUFDSCxLQUFLO0NBQ04sQ0FBQyxDQUFDO0FBRUgsNENBQTRDO0FBQzVDLE1BQU0sWUFBWSxHQUFHLElBQUksNEJBQVksQ0FBQyxHQUFHLEVBQUUsOEJBQThCLEtBQUssRUFBRSxFQUFFO0lBQ2hGLEdBQUc7SUFDSCxLQUFLO0lBQ0wsYUFBYTtDQUNkLENBQUMsQ0FBQztBQUVILGFBQWE7QUFDYixNQUFNLFNBQVMsR0FBRyxJQUFJLHNCQUFTLENBQUMsR0FBRyxFQUFFLDJCQUEyQixLQUFLLEVBQUUsRUFBRTtJQUN2RSxHQUFHO0lBQ0gsS0FBSztDQUNOLENBQUMsQ0FBQztBQUVILDBDQUEwQztBQUMxQyxNQUFNLFFBQVEsR0FBRyxJQUFJLG9CQUFRLENBQUMsR0FBRyxFQUFFLDBCQUEwQixLQUFLLEVBQUUsRUFBRTtJQUNwRSxHQUFHO0lBQ0gsS0FBSztJQUNMLGFBQWE7SUFDYixZQUFZO0lBQ1osU0FBUztDQUNWLENBQUMsQ0FBQztBQUVILDJEQUEyRDtBQUMzRCxNQUFNLGNBQWMsR0FBRyxJQUFJLGdDQUFjLENBQUMsR0FBRyxFQUFFLGdDQUFnQyxLQUFLLEVBQUUsRUFBRTtJQUN0RixHQUFHO0lBQ0gsS0FBSztJQUNMLGFBQWE7SUFDYixZQUFZO0NBQ2IsQ0FBQyxDQUFDO0FBRUgsNEJBQTRCO0FBQzVCLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUscUJBQXFCLENBQUMsQ0FBQztBQUMzRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IERhdGFiYXNlU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL2RhdGFiYXNlLXN0YWNrJztcbmltcG9ydCB7IFN0b3JhZ2VTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3Mvc3RvcmFnZS1zdGFjayc7XG5pbXBvcnQgeyBBdXRoU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL2F1dGgtc3RhY2snO1xuaW1wb3J0IHsgQXBpU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL2FwaS1zdGFjayc7XG5pbXBvcnQgeyBTY2hlZHVsZXJTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3Mvc2NoZWR1bGVyLXN0YWNrJztcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcblxuY29uc3QgZW52ID0ge1xuICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxuICByZWdpb246IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCAndXMtZWFzdC0xJyxcbn07XG5cbmNvbnN0IHN0YWdlID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnc3RhZ2UnKSB8fCAnZGV2JztcblxuLy8gRGF0YWJhc2UgU3RhY2tcbmNvbnN0IGRhdGFiYXNlU3RhY2sgPSBuZXcgRGF0YWJhc2VTdGFjayhhcHAsIGBQaG90b2dyYXBoZXJHYWxsZXJ5RGF0YWJhc2UtJHtzdGFnZX1gLCB7XG4gIGVudixcbiAgc3RhZ2UsXG59KTtcblxuLy8gU3RvcmFnZSBTdGFjayAoaW5jbHVkZXMgaW1hZ2UgcHJvY2Vzc2luZylcbmNvbnN0IHN0b3JhZ2VTdGFjayA9IG5ldyBTdG9yYWdlU3RhY2soYXBwLCBgUGhvdG9ncmFwaGVyR2FsbGVyeVN0b3JhZ2UtJHtzdGFnZX1gLCB7XG4gIGVudixcbiAgc3RhZ2UsXG4gIGRhdGFiYXNlU3RhY2ssXG59KTtcblxuLy8gQXV0aCBTdGFja1xuY29uc3QgYXV0aFN0YWNrID0gbmV3IEF1dGhTdGFjayhhcHAsIGBQaG90b2dyYXBoZXJHYWxsZXJ5QXV0aC0ke3N0YWdlfWAsIHtcbiAgZW52LFxuICBzdGFnZSxcbn0pO1xuXG4vLyBBUEkgU3RhY2sgKGRlcGVuZHMgb24gYWxsIG90aGVyIHN0YWNrcylcbmNvbnN0IGFwaVN0YWNrID0gbmV3IEFwaVN0YWNrKGFwcCwgYFBob3RvZ3JhcGhlckdhbGxlcnlBcGktJHtzdGFnZX1gLCB7XG4gIGVudixcbiAgc3RhZ2UsXG4gIGRhdGFiYXNlU3RhY2ssXG4gIHN0b3JhZ2VTdGFjayxcbiAgYXV0aFN0YWNrLFxufSk7XG5cbi8vIFNjaGVkdWxlciBTdGFjayAoZm9yIGRhaWx5IGNsZWFudXAgb2YgZXhwaXJlZCBnYWxsZXJpZXMpXG5jb25zdCBzY2hlZHVsZXJTdGFjayA9IG5ldyBTY2hlZHVsZXJTdGFjayhhcHAsIGBQaG90b2dyYXBoZXJHYWxsZXJ5U2NoZWR1bGVyLSR7c3RhZ2V9YCwge1xuICBlbnYsXG4gIHN0YWdlLFxuICBkYXRhYmFzZVN0YWNrLFxuICBzdG9yYWdlU3RhY2ssXG59KTtcblxuLy8gQWRkIHRhZ3MgdG8gYWxsIHJlc291cmNlc1xuY2RrLlRhZ3Mub2YoYXBwKS5hZGQoJ0FwcGxpY2F0aW9uJywgJ1Bob3RvZ3JhcGhlckdhbGxlcnknKTtcbmNkay5UYWdzLm9mKGFwcCkuYWRkKCdTdGFnZScsIHN0YWdlKTtcbiJdfQ==