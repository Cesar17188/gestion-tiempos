import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    // Inicializamos el cliente de Supabase con las variables de entorno
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  // Getter para exponer el cliente de autenticación de forma segura
  get auth() {
    return this.supabase.auth;
  }

  // Getter para exponer las consultas a la base de datos
  get db() {
    return this.supabase.from.bind(this.supabase);
  }

  // Getter para el canal en tiempo real (WebSockets)
  get channel() {
    return this.supabase.channel.bind(this.supabase);
  }
}
