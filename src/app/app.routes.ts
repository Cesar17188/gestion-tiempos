import { Routes } from '@angular/router';
import { Splash } from './features/splash/splash';
import { Login } from './features/auth/login/login';
import { ActualizarPassword } from './features/auth/actualizar-password/actualizar-password';
import { Dashboard } from './features/dashboard/dashboard/dashboard';
import { Perfil } from './features/perfil/perfil';
import { Ingreso } from './features/ingreso/ingreso';
import { DashboardAdmin } from './features/admin/dashboard-admin/dashboard-admin';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin-guard';

export const routes: Routes = [
  { path: '', component: Splash, pathMatch: 'full' }, // Redirige la raíz al splash
  { path: 'login', component: Login },
  { path: 'actualizar-password', component: ActualizarPassword },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  { path: 'perfil', component: Perfil, canActivate: [authGuard] },
  { path: 'ingreso', component: Ingreso, canActivate: [authGuard] },
  { path: 'admin', loadComponent: () => import('./features/admin/dashboard-admin/dashboard-admin').then(m => m.DashboardAdmin), canMatch: [adminGuard] }
];
