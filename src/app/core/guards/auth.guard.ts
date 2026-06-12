import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase/supabase';

export const authGuard: CanActivateFn = async (route, state) => {
  const router = inject(Router);
  const supabaseService = inject(SupabaseService);

  // Obtenemos la sesión actual de Supabase
  const { data: { session } } = await supabaseService.auth.getSession();

  // Si hay una sesión activa, permitimos el acceso
  if (session) {
    return true;
  }

  // Si no hay sesión (el usuario cerró sesión o no ha ingresado), redirigimos al login
  router.navigate(['/login']);
  return false;
};
