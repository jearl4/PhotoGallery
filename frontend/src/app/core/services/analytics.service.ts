import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DashboardSummary,
  GalleriesAnalyticsResponse,
  TopPhotosResponse,
  ClientBehaviorAnalytics
} from '../models/analytics.model';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/analytics`;

  getDashboardSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.baseUrl}/summary`);
  }

  getGalleriesAnalytics(
    limit = 20,
    sortBy: 'views' | 'downloads' | 'favorites' | 'clients' = 'views'
  ): Observable<GalleriesAnalyticsResponse> {
    const params = new HttpParams()
      .set('limit', limit.toString())
      .set('sortBy', sortBy);
    return this.http.get<GalleriesAnalyticsResponse>(
      `${this.baseUrl}/galleries`,
      { params }
    );
  }

  getTopPhotos(
    limit = 10,
    metric: 'favorites' | 'downloads' = 'favorites'
  ): Observable<TopPhotosResponse> {
    const params = new HttpParams()
      .set('limit', limit.toString())
      .set('metric', metric);
    return this.http.get<TopPhotosResponse>(
      `${this.baseUrl}/photos/top`,
      { params }
    );
  }

  getClientBehavior(): Observable<ClientBehaviorAnalytics> {
    return this.http.get<ClientBehaviorAnalytics>(`${this.baseUrl}/clients`);
  }
}
