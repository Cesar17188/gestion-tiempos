import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase/supabase';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  // Inyección de dependencias (sintaxis moderna de Angular)
  private fb = inject(FormBuilder);
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);
  // Definición del formulario con validaciones estrictas
  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  // Estados de la interfaz
  errorMessage: string = '';
  isLoading: boolean = false;

  async onSubmit() {
    // Si el formulario tiene errores, no hacemos la petición
    if (this.loginForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    const { email, password } = this.loginForm.value;

    // Llamada directa a Supabase Auth
    const { error } = await this.supabaseService.auth.signInWithPassword({
      email,
      password
    });

    this.isLoading = false;

    if (error) {
      this.errorMessage = 'Credenciales incorrectas. Por favor, verifica tu correo y contraseña.';
    } else {
      // Si el login es exitoso, redirigimos al dashboard
      this.router.navigate(['/dashboard']);
    }
  }
}
