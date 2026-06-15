import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase/supabase';

@Component({
  selector: 'app-perfil',
  imports: [CommonModule],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class Perfil implements OnInit {
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);

  // Variables para almacenar los datos
  authUsuario: any = null;
  datosPerfil: any = null;
  isLoading = true;

  async ngOnInit() {
    await this.cargarPerfil();
  }

  async cargarPerfil() {
    try {
      // 1. Obtenemos el usuario autenticado
      const { data: { user }, error: authError } = await this.supabaseService.auth.getUser();

      if (authError || !user) {
        this.router.navigate(['/login']);
        return;
      }
      this.authUsuario = user;

      // 2. Buscamos sus datos extra (Rol y Nombre) en la tabla 'perfiles'
      const { data: perfilData, error: dbError } = await this.supabaseService.db('perfiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!dbError && perfilData) {
        this.datosPerfil = perfilData;
      }
    } catch (error) {
      console.error('Error al cargar perfil:', error);
    } finally {
      this.isLoading = false;
    }
  }

  volver() {
    this.router.navigate(['/dashboard']);
  }

  async cerrarSesion() {
    await this.supabaseService.auth.signOut();
    this.router.navigate(['/login']);
  }
}
