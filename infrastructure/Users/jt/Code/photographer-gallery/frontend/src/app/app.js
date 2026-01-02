"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = void 0;
const core_1 = require("@angular/core");
const router_1 = require("@angular/router");
let App = class App {
    constructor() {
        this.title = (0, core_1.signal)('frontend');
    }
};
exports.App = App;
exports.App = App = __decorate([
    (0, core_1.Component)({
        selector: 'app-root',
        imports: [router_1.RouterOutlet],
        templateUrl: './app.html',
        styleUrl: './app.scss'
    })
], App);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLHdDQUFrRDtBQUNsRCw0Q0FBK0M7QUFReEMsSUFBTSxHQUFHLEdBQVQsTUFBTSxHQUFHO0lBQVQ7UUFDYyxVQUFLLEdBQUcsSUFBQSxhQUFNLEVBQUMsVUFBVSxDQUFDLENBQUM7SUFDaEQsQ0FBQztDQUFBLENBQUE7QUFGWSxrQkFBRztjQUFILEdBQUc7SUFOZixJQUFBLGdCQUFTLEVBQUM7UUFDVCxRQUFRLEVBQUUsVUFBVTtRQUNwQixPQUFPLEVBQUUsQ0FBQyxxQkFBWSxDQUFDO1FBQ3ZCLFdBQVcsRUFBRSxZQUFZO1FBQ3pCLFFBQVEsRUFBRSxZQUFZO0tBQ3ZCLENBQUM7R0FDVyxHQUFHLENBRWYiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb21wb25lbnQsIHNpZ25hbCB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgUm91dGVyT3V0bGV0IH0gZnJvbSAnQGFuZ3VsYXIvcm91dGVyJztcblxuQENvbXBvbmVudCh7XG4gIHNlbGVjdG9yOiAnYXBwLXJvb3QnLFxuICBpbXBvcnRzOiBbUm91dGVyT3V0bGV0XSxcbiAgdGVtcGxhdGVVcmw6ICcuL2FwcC5odG1sJyxcbiAgc3R5bGVVcmw6ICcuL2FwcC5zY3NzJ1xufSlcbmV4cG9ydCBjbGFzcyBBcHAge1xuICBwcm90ZWN0ZWQgcmVhZG9ubHkgdGl0bGUgPSBzaWduYWwoJ2Zyb250ZW5kJyk7XG59XG4iXX0=