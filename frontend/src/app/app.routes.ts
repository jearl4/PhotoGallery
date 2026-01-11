import { Routes } from '@angular/router';
import { authGuard, noAuthGuard } from './core/guards/auth.guard';
import { portalOnlyGuard } from './core/guards/domain.guard';

export const routes: Routes = [
  // Home / Login (main domain only)
  {
    path: '',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
    canActivate: [noAuthGuard]
  },

  // OAuth Callback
  {
    path: 'auth/callback',
    loadComponent: () => import('./features/auth/callback/callback.component').then(m => m.CallbackComponent)
  },

  // Portal Routes (custom domain only) - photographer's public-facing gallery list
  {
    path: 'portal',
    canActivate: [portalOnlyGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/portal/photographer-home/photographer-home.component')
          .then(m => m.PhotographerHomeComponent)
      },
      {
        path: ':customUrl',
        loadComponent: () => import('./features/client/gallery-access/gallery-access.component')
          .then(m => m.GalleryAccessComponent)
      },
      {
        path: ':customUrl/view',
        loadComponent: () => import('./features/client/gallery-view/gallery-view.component')
          .then(m => m.GalleryViewComponent)
      }
    ]
  },

  // Photographer Routes (Protected - for gallery management)
  {
    path: 'photographer',
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/photographer/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'galleries/new',
        loadComponent: () => import('./features/photographer/gallery-form/gallery-form.component').then(m => m.GalleryFormComponent)
      },
      {
        path: 'galleries/:id',
        loadComponent: () => import('./features/photographer/gallery-detail/gallery-detail.component').then(m => m.GalleryDetailComponent)
      },
      {
        path: 'galleries/:id/edit',
        loadComponent: () => import('./features/photographer/gallery-form/gallery-form.component').then(m => m.GalleryFormComponent)
      },
      {
        path: 'galleries/:id/upload',
        loadComponent: () => import('./features/photographer/photo-upload/photo-upload.component').then(m => m.PhotoUploadComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/photographer/settings/settings.component').then(m => m.SettingsComponent)
      },
      {
        path: 'analytics',
        loadComponent: () => import('./features/photographer/analytics/analytics.component').then(m => m.AnalyticsComponent)
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  },

  // Client Routes (Public - for accessing galleries)
  {
    path: 'client/access',
    loadComponent: () => import('./features/client/gallery-code/gallery-code.component').then(m => m.GalleryCodeComponent)
  },
  {
    path: 'gallery/:customUrl',
    loadComponent: () => import('./features/client/gallery-access/gallery-access.component').then(m => m.GalleryAccessComponent)
  },
  {
    path: 'gallery/:customUrl/view',
    loadComponent: () => import('./features/client/gallery-view/gallery-view.component').then(m => m.GalleryViewComponent)
  },

  // Fallback
  {
    path: '**',
    redirectTo: ''
  }
];
