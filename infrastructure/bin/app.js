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
// Add tags to all resources
cdk.Tags.of(app).add('Application', 'PhotographerGallery');
cdk.Tags.of(app).add('Stage', stage);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsaUVBQTZEO0FBQzdELCtEQUEyRDtBQUMzRCx5REFBcUQ7QUFDckQsdURBQW1EO0FBRW5ELE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRTFCLE1BQU0sR0FBRyxHQUFHO0lBQ1YsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO0lBQ3hDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLFdBQVc7Q0FDdEQsQ0FBQztBQUVGLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssQ0FBQztBQUV2RCxpQkFBaUI7QUFDakIsTUFBTSxhQUFhLEdBQUcsSUFBSSw4QkFBYSxDQUFDLEdBQUcsRUFBRSwrQkFBK0IsS0FBSyxFQUFFLEVBQUU7SUFDbkYsR0FBRztJQUNILEtBQUs7Q0FDTixDQUFDLENBQUM7QUFFSCw0Q0FBNEM7QUFDNUMsTUFBTSxZQUFZLEdBQUcsSUFBSSw0QkFBWSxDQUFDLEdBQUcsRUFBRSw4QkFBOEIsS0FBSyxFQUFFLEVBQUU7SUFDaEYsR0FBRztJQUNILEtBQUs7SUFDTCxhQUFhO0NBQ2QsQ0FBQyxDQUFDO0FBRUgsYUFBYTtBQUNiLE1BQU0sU0FBUyxHQUFHLElBQUksc0JBQVMsQ0FBQyxHQUFHLEVBQUUsMkJBQTJCLEtBQUssRUFBRSxFQUFFO0lBQ3ZFLEdBQUc7SUFDSCxLQUFLO0NBQ04sQ0FBQyxDQUFDO0FBRUgsMENBQTBDO0FBQzFDLE1BQU0sUUFBUSxHQUFHLElBQUksb0JBQVEsQ0FBQyxHQUFHLEVBQUUsMEJBQTBCLEtBQUssRUFBRSxFQUFFO0lBQ3BFLEdBQUc7SUFDSCxLQUFLO0lBQ0wsYUFBYTtJQUNiLFlBQVk7SUFDWixTQUFTO0NBQ1YsQ0FBQyxDQUFDO0FBRUgsNEJBQTRCO0FBQzVCLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUscUJBQXFCLENBQUMsQ0FBQztBQUMzRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCB7IERhdGFiYXNlU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL2RhdGFiYXNlLXN0YWNrJztcbmltcG9ydCB7IFN0b3JhZ2VTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3Mvc3RvcmFnZS1zdGFjayc7XG5pbXBvcnQgeyBBdXRoU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL2F1dGgtc3RhY2snO1xuaW1wb3J0IHsgQXBpU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL2FwaS1zdGFjayc7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbmNvbnN0IGVudiA9IHtcbiAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcbiAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgJ3VzLWVhc3QtMScsXG59O1xuXG5jb25zdCBzdGFnZSA9IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ3N0YWdlJykgfHwgJ2Rldic7XG5cbi8vIERhdGFiYXNlIFN0YWNrXG5jb25zdCBkYXRhYmFzZVN0YWNrID0gbmV3IERhdGFiYXNlU3RhY2soYXBwLCBgUGhvdG9ncmFwaGVyR2FsbGVyeURhdGFiYXNlLSR7c3RhZ2V9YCwge1xuICBlbnYsXG4gIHN0YWdlLFxufSk7XG5cbi8vIFN0b3JhZ2UgU3RhY2sgKGluY2x1ZGVzIGltYWdlIHByb2Nlc3NpbmcpXG5jb25zdCBzdG9yYWdlU3RhY2sgPSBuZXcgU3RvcmFnZVN0YWNrKGFwcCwgYFBob3RvZ3JhcGhlckdhbGxlcnlTdG9yYWdlLSR7c3RhZ2V9YCwge1xuICBlbnYsXG4gIHN0YWdlLFxuICBkYXRhYmFzZVN0YWNrLFxufSk7XG5cbi8vIEF1dGggU3RhY2tcbmNvbnN0IGF1dGhTdGFjayA9IG5ldyBBdXRoU3RhY2soYXBwLCBgUGhvdG9ncmFwaGVyR2FsbGVyeUF1dGgtJHtzdGFnZX1gLCB7XG4gIGVudixcbiAgc3RhZ2UsXG59KTtcblxuLy8gQVBJIFN0YWNrIChkZXBlbmRzIG9uIGFsbCBvdGhlciBzdGFja3MpXG5jb25zdCBhcGlTdGFjayA9IG5ldyBBcGlTdGFjayhhcHAsIGBQaG90b2dyYXBoZXJHYWxsZXJ5QXBpLSR7c3RhZ2V9YCwge1xuICBlbnYsXG4gIHN0YWdlLFxuICBkYXRhYmFzZVN0YWNrLFxuICBzdG9yYWdlU3RhY2ssXG4gIGF1dGhTdGFjayxcbn0pO1xuXG4vLyBBZGQgdGFncyB0byBhbGwgcmVzb3VyY2VzXG5jZGsuVGFncy5vZihhcHApLmFkZCgnQXBwbGljYXRpb24nLCAnUGhvdG9ncmFwaGVyR2FsbGVyeScpO1xuY2RrLlRhZ3Mub2YoYXBwKS5hZGQoJ1N0YWdlJywgc3RhZ2UpO1xuIl19