import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SupabaseService } from '../../../../core/services/supabase/supabase';

@Component({
  selector: 'app-admin-config',
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './admin-config.html',
  styleUrl: './admin-config.css',
})
export class AdminConfig implements OnInit {

  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);

  isLoading = true;
  isSaving = false;
  subSeccion: 'negocio' | 'personal' = 'negocio'; // Control de sub-pestañas
  mensajeFeedback = '';

  configForm!: FormGroup;
  personalForm!: FormGroup;
  listaPersonal: any[] = [];

  ngOnInit(): void {
    this.inicializarFormularios();
    this.cargarDatos();
  }

  private inicializarFormularios() {
    this.configForm = this.fb.group({
      precio_base: [0, [Validators.required, Validators.min(0)]],
      minutos_base: [30, [Validators.required, Validators.min(1)]],
      precio_minuto_extra: [3, [Validators.required, Validators.min(0)]],
      msg_bienvenida: ['', Validators.required],
      msg_advertencia_5min: ['', Validators.required],
      msg_tiempo_cumplido: ['', Validators.required]
    });

    this.personalForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      rol: ['ENCARGADO', Validators.required]
    });
  }

  async cargarDatos() {
    this.isLoading = true;
    try {
      // 1. Cargar Configuración Global
      const { data: config } = await this.supabase.from('configuracion_sistema').select('*').eq('id', 1).single();
      if (config) {
        this.configForm.patchValue(config);
      }

      // 2. Cargar Lista de Personal Existente
      const { data: personal } = await this.supabase.from('perfiles').select('*').order('nombre', { ascending: true });
      if (personal) this.listaPersonal = personal;

    } catch (error) {
      console.error('Error al cargar configuraciones:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async guardarConfiguracion() {
    if (this.configForm.invalid) return;
    this.isSaving = true;

    const { error } = await this.supabase.from('configuracion_sistema')
      .update(this.configForm.value)
      .eq('id', 1);

    this.isSaving = false;
    if (error) {
      alert('Error al guardar cambios: ' + error.message);
    } else {
      this.mostrarFeedback('Cambios guardados exitosamente');
    }
  }

  async registrarColaborador() {
    if (this.personalForm.invalid) return;
    this.isSaving = true;

    const { email, nombre, rol } = this.personalForm.value;

    alert(`Nota técnica: Para producción, se enviará una invitación por correo a ${email}. El perfil se creará automáticamente cuando acepte.`);

    this.personalForm.reset({ rol: 'ENCARGADO' });
    this.isSaving = false;
    await this.cargarDatos();
  }

  async actualizarPersonal(perfil: any) {
    this.isSaving = true;

    const { error } = await this.supabase.from('perfiles')
      .update({
        hora_entrada: perfil.hora_entrada,
        hora_salida: perfil.hora_salida,
        activo: perfil.activo
      })
      .eq('id', perfil.id);

    this.isSaving = false;
    if (error) {
      alert('Error al actualizar el personal: ' + error.message);
    } else {
      this.mostrarFeedback('cambios realizados correctamente');
    }
  }

  private mostrarFeedback(msg: string) {
    this.mensajeFeedback = msg;
    setTimeout(() => this.mensajeFeedback = '', 4000);
  }
}
