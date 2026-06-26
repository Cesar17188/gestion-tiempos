import { Component, inject, ChangeDetectorRef } from '@angular/core';
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
  private cdr = inject(ChangeDetectorRef);
  // Definición del formulario con validaciones estrictas
  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  // Estados de la interfaz
  errorMessage: string = '';
  isLoading: boolean = false;
  recoveryMessage: string = '';
  isRecovering: boolean = false;
  showModal: boolean = false;
  modalMessage: string = '';

  cerrarModal() {
    this.showModal = false;
    this.cdr.detectChanges();
  }

  async onSubmit() {
    // Si el formulario tiene errores, no hacemos la petición
    if (this.loginForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.recoveryMessage = '';
    this.showModal = false;
    this.cdr.detectChanges();

    const { email, password } = this.loginForm.value;
    let timerId: any;

    try {
      // Promesa que rechaza después de 10 segundos (tiempo prudencial)
      const timeoutPromise = new Promise<any>((_, reject) => {
        timerId = setTimeout(() => {
          reject(new Error('TIMEOUT'));
        }, 10000); // 10 segundos
      });

      // Usamos Promise.race para competir entre la autenticación y el timeout
      const response = await Promise.race([
        this.supabaseService.auth.signInWithPassword({ email, password }),
        timeoutPromise
      ]);

      clearTimeout(timerId);
      this.isLoading = false;

      if (response && response.error) {
        this.modalMessage = 'El usuario no fue encontrado en el sistema o las credenciales son incorrectas.';
        this.showModal = true;
      } else {
        // Verificar perfil y restricciones de horario para encargados
        const { data: perfil, error: perfilError } = await this.supabaseService.db('perfiles')
          .select('rol, activo, hora_entrada, hora_salida')
          .eq('email', email)
          .single();

        if (perfil && perfil.rol === 'ENCARGADO') {
          // 1. Verificar si está activo (puede ser false, por defecto asumimos true si es null)
          if (perfil.activo === false) {
            await this.supabaseService.auth.signOut();
            this.modalMessage = 'Tu cuenta ha sido deshabilitada por el administrador.';
            this.showModal = true;
            this.cdr.detectChanges();
            return;
          }

          // 2. Verificar horario laboral
          if (perfil.hora_entrada && perfil.hora_salida) {
            const now = new Date();
            const currentHours = now.getHours().toString().padStart(2, '0');
            const currentMinutes = now.getMinutes().toString().padStart(2, '0');
            const currentTime = `${currentHours}:${currentMinutes}`;

            // Si el horario de fin es menor al inicio, significa que cruza la medianoche (ej. 22:00 a 06:00)
            let fueraDeHorario = false;
            if (perfil.hora_entrada <= perfil.hora_salida) {
              // Horario diurno normal
              fueraDeHorario = (currentTime < perfil.hora_entrada || currentTime > perfil.hora_salida);
            } else {
              // Horario nocturno
              fueraDeHorario = (currentTime < perfil.hora_entrada && currentTime > perfil.hora_salida);
            }

            if (fueraDeHorario) {
              await this.supabaseService.auth.signOut();
              this.modalMessage = `Acceso denegado. Estás intentando ingresar fuera de tu horario laboral asignado (${perfil.hora_entrada} a ${perfil.hora_salida}).`;
              this.showModal = true;
              this.cdr.detectChanges();
              return;
            }
          }
        }

        // Si el login es exitoso y cumple las reglas, redirigimos al dashboard
        this.router.navigate(['/dashboard']);
      }
      this.cdr.detectChanges();
    } catch (error: any) {
      clearTimeout(timerId);
      this.isLoading = false;
      if (error && error.message === 'TIMEOUT') {
        this.modalMessage = 'Usuario no encontrado. El tiempo de búsqueda se ha agotado.';
        this.showModal = true;
      } else {
        // Captura errores 400 u otras excepciones lanzadas directamente por el cliente de Supabase
        this.modalMessage = 'El usuario no fue encontrado en el sistema o las credenciales son incorrectas.';
        this.showModal = true;
      }
      this.cdr.detectChanges();
    }
  }

  async recoverPassword() {
    const emailControl = this.loginForm.get('email');
    if (emailControl?.invalid) {
      this.errorMessage = 'Por favor, ingresa un correo electrónico válido para recuperar tu contraseña.';
      this.cdr.detectChanges();
      return;
    }

    this.isRecovering = true;
    this.errorMessage = '';
    this.recoveryMessage = '';
    this.cdr.detectChanges();

    const email = emailControl?.value;

    try {
      // 1. Verificamos si el correo existe en la tabla "perfiles"
      const { data: perfil, error: dbError } = await this.supabaseService.db('perfiles')
        .select('id') // O cualquier otra columna (asumiendo que tiene la columna email)
        .eq('email', email)
        .maybeSingle();

      if (dbError) {
        console.error('Error de Supabase al consultar la tabla perfiles:', dbError);
      }

      // Si no encuentra resultados o hay error, asumimos que no está registrado
      if (dbError || !perfil) {
        this.isRecovering = false;
        this.errorMessage = 'El correo ingresado no está registrado en el sistema.';
        this.cdr.detectChanges();
        return;
      }

      // 2. Si existe, enviamos el correo de recuperación
      const { error: authError } = await this.supabaseService.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/actualizar-password`,
      });

      this.isRecovering = false;

      if (authError) {
        this.errorMessage = 'Error al intentar enviar el correo de recuperación. Inténtalo de nuevo.';
      } else {
        this.recoveryMessage = 'Se ha enviado un enlace de recuperación a tu correo electrónico.';
      }

    } catch (err) {
      this.isRecovering = false;
      this.errorMessage = 'Ocurrió un error inesperado al verificar el correo.';
    }

    this.cdr.detectChanges();
  }
}
