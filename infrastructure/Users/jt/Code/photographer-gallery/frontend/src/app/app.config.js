"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appConfig = void 0;
const core_1 = require("@angular/core");
const router_1 = require("@angular/router");
const app_routes_1 = require("./app.routes");
exports.appConfig = {
    providers: [
        (0, core_1.provideBrowserGlobalErrorListeners)(),
        (0, router_1.provideRouter)(app_routes_1.routes)
    ]
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImFwcC5jb25maWcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsd0NBQXNGO0FBQ3RGLDRDQUFnRDtBQUVoRCw2Q0FBc0M7QUFFekIsUUFBQSxTQUFTLEdBQXNCO0lBQzFDLFNBQVMsRUFBRTtRQUNULElBQUEseUNBQWtDLEdBQUU7UUFDcEMsSUFBQSxzQkFBYSxFQUFDLG1CQUFNLENBQUM7S0FDdEI7Q0FDRixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQXBwbGljYXRpb25Db25maWcsIHByb3ZpZGVCcm93c2VyR2xvYmFsRXJyb3JMaXN0ZW5lcnMgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7IHByb3ZpZGVSb3V0ZXIgfSBmcm9tICdAYW5ndWxhci9yb3V0ZXInO1xuXG5pbXBvcnQgeyByb3V0ZXMgfSBmcm9tICcuL2FwcC5yb3V0ZXMnO1xuXG5leHBvcnQgY29uc3QgYXBwQ29uZmlnOiBBcHBsaWNhdGlvbkNvbmZpZyA9IHtcbiAgcHJvdmlkZXJzOiBbXG4gICAgcHJvdmlkZUJyb3dzZXJHbG9iYWxFcnJvckxpc3RlbmVycygpLFxuICAgIHByb3ZpZGVSb3V0ZXIocm91dGVzKVxuICBdXG59O1xuIl19