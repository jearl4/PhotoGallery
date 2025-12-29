import { Routes } from '@angular/router';
import { authGuard, noAuthGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Home / Login
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

  // Photographer Routes (Protected)
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
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  },

  // Client Routes (Public)
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
