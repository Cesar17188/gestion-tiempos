import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
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
  private cdr = inject(ChangeDetectorRef);

  isLoading = true;
  isSaving = false;
  personalGuardandoId: string | null = null;
  subSeccion: 'negocio' | 'personal' = 'negocio'; // Control de sub-pestañas
  mensajeFeedback = '';

  // Variables para Dialog Modal
  showConfirmDialog = false;
  dialogTitle = '';
  dialogMessage = '';
  dialogPrimaryBtn = 'Aceptar';
  dialogSecondaryBtn = '';
  private dialogResolver?: (value: boolean) => void;

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
      msg_tiempo_cumplido: ['', Validators.required],
      titulo_dashboard: ['Panel de Control - Sucursal Norte', Validators.required]
    });

    this.personalForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      rol: ['ENCARGADO', Validators.required]
    });
  }

  private tieneColumnaTituloDashboard = false;

  async cargarDatos() {
    this.isLoading = true;
    this.cdr.detectChanges();
    try {
      // 1. Cargar Configuración Global y Personal en paralelo para acelerar la respuesta
      const [configRes, personalRes] = await Promise.all([
        this.supabase.from('configuracion_sistema').select('*').eq('id', 1).single(),
        this.supabase.from('perfiles').select('*').order('nombre', { ascending: true })
      ]);

      if (configRes.data) {
        this.tieneColumnaTituloDashboard = 'titulo_dashboard' in configRes.data;
        let tituloGuardado = configRes.data.titulo_dashboard;
        if (!tituloGuardado && typeof window !== 'undefined' && window.localStorage) {
          tituloGuardado = localStorage.getItem('titulo_dashboard') || 'Panel de Control - Sucursal Norte';
        }

        this.configForm.patchValue({
          precio_base: configRes.data.precio_base,
          minutos_base: configRes.data.minutos_base,
          precio_minuto_extra: configRes.data.precio_minuto_extra,
          msg_bienvenida: configRes.data.msg_bienvenida,
          msg_advertencia_5min: configRes.data.msg_advertencia_5min,
          msg_tiempo_cumplido: configRes.data.msg_tiempo_cumplido,
          titulo_dashboard: tituloGuardado || 'Panel de Control - Sucursal Norte'
        });
      }

      if (personalRes.data) {
        this.listaPersonal = personalRes.data;
      }
    } catch (error) {
      console.error('Error al cargar configuraciones:', error);
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  async guardarConfiguracion() {
    if (this.configForm.invalid || this.isSaving) return;
    this.isSaving = true;
    this.cdr.detectChanges();

    try {
      const formVal = this.configForm.value;
      const payload: any = {
        precio_base: Number(formVal.precio_base),
        minutos_base: Number(formVal.minutos_base),
        precio_minuto_extra: Number(formVal.precio_minuto_extra),
        msg_bienvenida: formVal.msg_bienvenida,
        msg_advertencia_5min: formVal.msg_advertencia_5min,
        msg_tiempo_cumplido: formVal.msg_tiempo_cumplido
      };

      if (this.tieneColumnaTituloDashboard) {
        payload.titulo_dashboard = formVal.titulo_dashboard;
      }

      if (typeof window !== 'undefined' && window.localStorage && formVal.titulo_dashboard) {
        localStorage.setItem('titulo_dashboard', formVal.titulo_dashboard);
      }

      const { error } = await this.supabase.from('configuracion_sistema')
        .update(payload)
        .eq('id', 1);

      if (error) {
        await this.abrirDialogo('Error', 'Error al guardar cambios: ' + error.message, 'Entendido');
      } else {
        this.mostrarFeedback('Cambios guardados exitosamente');
      }
    } catch (err: any) {
      console.error('Error inesperado al guardar configuración:', err);
      await this.abrirDialogo('Error', 'Ocurrió un error inesperado al guardar los cambios: ' + (err?.message || err), 'Entendido');
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  async registrarColaborador() {
    if (this.personalForm.invalid || this.isSaving) return;
    this.isSaving = true;
    this.cdr.detectChanges();

    try {
      const { email } = this.personalForm.value;

      await this.abrirDialogo(
        'Invitación Enviada',
        `Nota técnica: Para producción, se enviará una invitación por correo a ${email}. El perfil se creará automáticamente cuando acepte.`,
        'Entendido'
      );

      this.personalForm.reset({ rol: 'ENCARGADO' });
      await this.cargarDatos();
    } catch (err: any) {
      console.error('Error al registrar colaborador:', err);
      await this.abrirDialogo('Error', 'No se pudo completar el registro: ' + (err?.message || err), 'Entendido');
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  async actualizarPersonal(perfil: any) {
    if (this.personalGuardandoId) return;
    this.personalGuardandoId = perfil.id;
    this.cdr.detectChanges();

    try {
      const { error } = await this.supabase.from('perfiles')
        .update({
          hora_entrada: perfil.hora_entrada,
          hora_salida: perfil.hora_salida,
          activo: perfil.activo
        })
        .eq('id', perfil.id);

      if (error) {
        await this.abrirDialogo('Error', 'Error al actualizar el personal: ' + error.message, 'Entendido');
      } else {
        this.mostrarFeedback('Cambios del colaborador guardados correctamente');
      }
    } catch (err: any) {
      console.error('Error inesperado al actualizar personal:', err);
      await this.abrirDialogo('Error', 'Error al actualizar: ' + (err?.message || err), 'Entendido');
    } finally {
      this.personalGuardandoId = null;
      this.cdr.detectChanges();
    }
  }

  private mostrarFeedback(msg: string) {
    this.mensajeFeedback = msg;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.mensajeFeedback = '';
      this.cdr.detectChanges();
    }, 3500);
  }

  // DIALOGO CUSTOM
  abrirDialogo(titulo: string, mensaje: string, btnPrimario: string = 'Aceptar', btnSecundario: string = ''): Promise<boolean> {
    this.dialogTitle = titulo;
    this.dialogMessage = mensaje;
    this.dialogPrimaryBtn = btnPrimario;
    this.dialogSecondaryBtn = btnSecundario;
    this.showConfirmDialog = true;
    this.cdr.detectChanges();
    
    return new Promise((resolve) => {
      this.dialogResolver = resolve;
    });
  }

  cerrarDialogo(resultado: boolean) {
    this.showConfirmDialog = false;
    if (this.dialogResolver) {
      this.dialogResolver(resultado);
      this.dialogResolver = undefined;
    }
    this.cdr.detectChanges();
  }
}
