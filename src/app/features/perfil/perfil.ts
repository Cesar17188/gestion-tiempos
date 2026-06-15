import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase/supabase';

@Component({
  selector: 'app-perfil',
  imports: [CommonModule, FormsModule],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class Perfil implements OnInit {
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  // Variables para almacenar los datos
  authUsuario: any = null;
  datosPerfil: any = null;
  isLoading = true;
  isSaving = false;

  // Variables de edición
  nombreEdit: string = '';
  fotoArchivo: File | null = null;
  fotoPreview: string | null = null;

  // Variables para Toast
  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  mostrarToast(mensaje: string, tipo: 'success' | 'error' = 'success') {
    this.toastMessage = mensaje;
    this.toastType = tipo;
    this.showToast = true;
    this.cdr.detectChanges();

    setTimeout(() => {
      this.showToast = false;
      this.cdr.detectChanges();
    }, 3000);
  }

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
        .eq('email', user.email)
        .single();

      if (dbError) {
        console.error('Error al obtener perfil de DB:', dbError);
      }

      if (!dbError && perfilData) {
        this.datosPerfil = perfilData;
        this.nombreEdit = perfilData.nombre || '';
        this.fotoPreview = perfilData.avatar_url || null;
      }
    } catch (error) {
      console.error('Error al cargar perfil:', error);
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      this.fotoArchivo = file;
      // Crear preview local para mostrarla inmediatamente
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.fotoPreview = e.target.result;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }

  async guardarCambios() {
    this.isSaving = true;
    this.cdr.detectChanges();

    try {
      let avatarUrl = this.datosPerfil?.avatar_url;

      // 1. Subir imagen a Supabase Storage si hay una nueva seleccionada
      if (this.fotoArchivo) {
        const fileExt = this.fotoArchivo.name.split('.').pop();
        const fileName = `${this.authUsuario.id}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await this.supabaseService.storage
          .from('avatares') // IMPORTANTE: Debe existir un bucket público llamado 'avatares'
          .upload(filePath, this.fotoArchivo);

        if (uploadError) {
          console.error('Error subiendo imagen:', uploadError);
          this.mostrarToast('Hubo un error al subir la imagen. Verifica que exista el bucket "avatares".', 'error');
          this.isSaving = false;
          this.cdr.detectChanges();
          return;
        }

        // Obtener la URL pública de la imagen recién subida
        const { data: publicUrlData } = this.supabaseService.storage
          .from('avatares')
          .getPublicUrl(filePath);

        avatarUrl = publicUrlData.publicUrl;
        }

        // 2. Actualizar los datos en la tabla perfiles
        const updateResponse = await this.supabaseService.db('perfiles')
        .update({
          nombre: this.nombreEdit,
          avatar_url: avatarUrl
        })
        .eq('id', this.datosPerfil.id)
        .select();

        console.log('Update Response:', updateResponse);
        const { error: updateError, data: updatedData } = updateResponse;

        if (updateError) {
        console.error('Error actualizando perfil:', updateError);
        this.mostrarToast('Error al guardar los datos del perfil.', 'error');
        } else if (!updatedData || updatedData.length === 0) {
        console.error('No se actualizó ninguna fila. Verifica las políticas RLS de Supabase.');
        this.mostrarToast('No se pudo actualizar (Permisos/RLS).', 'error');
        } else {
        // Actualizar el estado local para reflejar los cambios guardados
        if (this.datosPerfil) {
          this.datosPerfil.nombre = this.nombreEdit;
          this.datosPerfil.avatar_url = avatarUrl;
        }
        this.fotoArchivo = null; // Limpiamos el archivo subido
        this.mostrarToast('Información actualizada', 'success');
        }

        } catch(error) {
        console.error('Error en guardarCambios:', error);
        this.mostrarToast('Error inesperado al guardar los cambios.', 'error');
        } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
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
