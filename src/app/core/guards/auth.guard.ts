import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase/supabase';

export const authGuard: CanActivateFn = async (route, state) => {
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);
  const supabaseService = inject(SupabaseService);

  // Si estamos en el servidor (SSR), no hay localStorage. 
  // Retornamos true para no bloquear el enrutador en el servidor y evitar el error 404.
  // El cliente (navegador) re-ejecutará el Guard e hidratará correctamente la sesión.
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  // Obtenemos el usuario actual de Supabase. getUser() espera a que se restaure la sesión
  const { data: { user } } = await supabaseService.auth.getUser();

  // Si hay un usuario activo, permitimos el acceso
  if (user) {
    return true;
  }

  // Si no hay usuario (cerró sesión o no ha ingresado), redirigimos al login
  router.navigate(['/login']);
  return false;
};
