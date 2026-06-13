import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase/supabase';

@Component({
  selector: 'app-actualizar-password',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './actualizar-password.html',
  styleUrl: './actualizar-password.css',
})
export class ActualizarPassword {
  private fb = inject(FormBuilder);
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  updateForm: FormGroup = this.fb.group({
    nuevaPassword: ['', [Validators.required, Validators.minLength(6)]]
  });

  isLoading = false;

  // Variables de estado del Modal
  showModal = false;
  modalTitle = '';
  modalMessage = '';
  isSuccessModal = false;

  cerrarModal() {
    this.showModal = false;
    if (this.isSuccessModal) {
      this.router.navigate(['/dashboard']);
    }
    this.cdr.detectChanges();
  }

  async onSubmit() {
    if (this.updateForm.invalid) return;
    
    this.isLoading = true;
    this.showModal = false;
    this.cdr.detectChanges();

    // Actualizamos al usuario que acaba de entrar por el Magic Link
    const { error } = await this.supabaseService.auth.updateUser({
      password: this.updateForm.value.nuevaPassword
    });

    this.isLoading = false;

    if (error) {
      this.isSuccessModal = false;
      this.modalTitle = 'Error al actualizar';
      this.modalMessage = 'Hubo un problema al intentar actualizar tu contraseña. Por favor, intenta nuevamente.';
      this.showModal = true;
    } else {
      this.isSuccessModal = true;
      this.modalTitle = '¡Contraseña actualizada!';
      this.modalMessage = 'Tu contraseña ha sido actualizada con éxito. Ahora puedes acceder al sistema.';
      this.showModal = true;
    }
    
    this.cdr.detectChanges();
  }
}
