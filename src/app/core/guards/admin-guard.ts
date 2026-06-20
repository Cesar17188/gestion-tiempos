import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, type CanMatchFn } from '@angular/router';
import { SupabaseService } from '../services/supabase/supabase';

export const adminGuard: CanMatchFn = async (route, segments) => {
  const platformId = inject(PLATFORM_ID);
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  // Retornamos true en el servidor para evitar el 404. El navegador verificará de nuevo.
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  // 1. Verificamos si hay un usuario en sesión
  const { data: { user } } = await supabaseService.auth.getUser();
  if (!user) {
    router.navigate(['/login']);
    return false;
  }

  // 2. Verificamos su rol en la tabla de perfiles
  const { data } = await supabaseService.db('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (data && data.rol === 'ADMINISTRADOR') {
    return true; // Match exitoso: Angular reconoce y carga la ruta
  }

  // Si es un encargado (o no tiene rol), no hay match. Lo enviamos a su panel.
  router.navigate(['/dashboard']);
  return false;
};