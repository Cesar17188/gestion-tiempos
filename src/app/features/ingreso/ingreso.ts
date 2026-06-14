import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { SupabaseService } from '../../core/services/supabase/supabase';

@Component({
  selector: 'app-ingreso',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ingreso.html',
  styleUrl: './ingreso.css',
  host: {
    '[@slideRightLeft]': '',
    style: 'display: block; width: 100%;'
  },
  animations: [
    trigger('slideRightLeft', [
      transition(':enter', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('400ms cubic-bezier(0.25, 1, 0.5, 1)', style({ transform: 'translateX(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        style({ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: -1 }),
        animate('400ms cubic-bezier(0.25, 1, 0.5, 1)', style({ transform: 'translateX(100%)', opacity: 0 }))
      ])
    ])
  ]
})
export class Ingreso {
  private fb = inject(FormBuilder);
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);

  isLoading = false;
  errorMessage = '';

  // Estructura del formulario con validaciones requeridas
  ingresoForm: FormGroup = this.fb.group({
    // Datos del Tutor
    tutorNombre: ['', [Validators.required, Validators.minLength(4)]],
    tutorWhatsapp: ['', [Validators.required, Validators.pattern('^[0-9]{9,15}$')]], // Permite formatos internacionales

    // Datos del Niño
    ninoNombre: ['', [Validators.required, Validators.minLength(3)]],
    ninoEdad: ['', [Validators.required, Validators.min(0), Validators.max(15)]],
    ninoNotas: [''], // Alergias, observaciones, quién lo retira, etc.

    // Configuración de la Sesión
    tiempoMinutos: ['30', [Validators.required]] // Por defecto 30 minutos
  });

  async onSubmit() {
    if (this.ingresoForm.invalid) {
      this.ingresoForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const values = this.ingresoForm.value;

    try {
      // 1. PASO UNO: Insertar el Tutor en la tabla 'tutores'
      const { data: tutorData, error: tutorError } = await this.supabaseService.db('tutores')
        .insert({
          nombres_apellidos: values.tutorNombre,
          whatsapp: values.tutorWhatsapp
        })
        .select('id')
        .single();

      if (tutorError) throw new Error(`Error al registrar tutor: ${tutorError.message}`);
      const tutorId = tutorData.id;

      // 2. PASO DOS: Insertar el Niño vinculado al Tutor
      const { data: ninoData, error: ninoError } = await this.supabaseService.db('ninos')
        .insert({
          nombres_apellidos: values.ninoNombre,
          edad: parseInt(values.ninoEdad),
          notas: values.ninoNotas,
          tutor_id: tutorId
        })
        .select('id')
        .single();

      if (ninoError) throw new Error(`Error al registrar niño: ${ninoError.message}`);
      const ninoId = ninoData.id;

      // 3. PASO TRES: Calcular tiempos y abrir la sesión de juego
      const horaIngreso = new Date();
      const minutosAAgregar = parseInt(values.tiempoMinutos);
      const horaSalidaEstimada = new Date(horaIngreso.getTime() + minutosAAgregar * 60000);

      const { error: sesionError } = await this.supabaseService.db('sesiones_juego')
        .insert({
          nino_id: ninoId,
          ingreso_at: horaIngreso.toISOString(),
          salida_estimada_at: horaSalidaEstimada.toISOString(),
          estado: 'ACTIVO'
        });

      if (sesionError) throw new Error(`Error al iniciar sesión: ${sesionError.message}`);

      // Éxito absoluto -> Volvemos al panel de control para ver la tarjeta corriendo
      this.router.navigate(['/dashboard']);

    } catch (err: any) {
      console.error(err);
      this.errorMessage = err.message || 'Ocurrió un error inesperado en el servidor.';
    } finally {
      this.isLoading = false;
    }
  }

  cancelar() {
    this.router.navigate(['/dashboard']);
  }
}
