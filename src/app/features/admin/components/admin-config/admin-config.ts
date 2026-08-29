import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { createClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../../../core/services/supabase/supabase';
import { environment } from '../../../../../environments/environment';

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
  personalEnviandoEmailId: string | null = null;
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

  private configId: any = 1;
  private columnasDisponibles = new Set<string>();

  ngOnInit(): void {
    this.inicializarFormularios();
    this.cargarDatos();
  }

  cambiarSubSeccion(seccion: 'negocio' | 'personal') {
    this.subSeccion = seccion;
    this.cdr.detectChanges();
  }

  private inicializarFormularios() {
    this.configForm = this.fb.group({
      precio_base: [0, [Validators.required, Validators.min(0)]],
      minutos_base: [30, [Validators.required, Validators.min(1)]],
      precio_minuto_extra: [3, [Validators.required, Validators.min(0)]],
      precio_adulto_extra: [2, [Validators.required, Validators.min(0)]],
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

  // Wrapper de seguridad para evitar bloqueos por peticiones colgadas en red o Supabase
  private async ejecutarConTimeout<T>(promesa: Promise<T>, timeoutMs = 8000, mensajeError = 'El servidor tardó demasiado en responder'): Promise<T> {
    let timer: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(mensajeError)), timeoutMs);
    });
    return Promise.race([promesa, timeoutPromise]).finally(() => clearTimeout(timer));
  }

  async cargarDatos() {
    this.isLoading = true;
    this.cdr.detectChanges();

    try {
      // Cargamos en paralelo de forma resiliente
      const [configResult, personalResult] = await Promise.allSettled([
        this.ejecutarConTimeout(
          this.supabase.from('configuracion_sistema').select('*').limit(1).single() as any,
          6000
        ),
        this.ejecutarConTimeout(
          this.supabase.from('perfiles').select('*').order('nombre', { ascending: true }) as any,
          6000
        )
      ]);

      if (configResult.status === 'fulfilled') {
        const resVal = configResult.value as any;
        if (resVal?.data) {
          const config = resVal.data;
          this.configId = config.id ?? 1;
          this.columnasDisponibles = new Set(Object.keys(config));

          let tituloGuardado = config.titulo_dashboard;
          if (!tituloGuardado && typeof window !== 'undefined' && window.localStorage) {
            tituloGuardado = localStorage.getItem('titulo_dashboard') || 'Panel de Control - Sucursal Norte';
          }

          let precioAdulto = config.precio_adulto_extra ?? config.precio_adulto;
          if (precioAdulto === undefined || precioAdulto === null) {
            if (typeof window !== 'undefined' && window.localStorage) {
              const localAdulto = localStorage.getItem('precio_adulto_extra');
              if (localAdulto) precioAdulto = parseFloat(localAdulto);
            }
          }
          if (precioAdulto === undefined || precioAdulto === null || isNaN(Number(precioAdulto))) {
            precioAdulto = 2;
          }

          this.configForm.patchValue({
            precio_base: config.precio_base ?? 0,
            minutos_base: config.minutos_base ?? 30,
            precio_minuto_extra: config.precio_minuto_extra ?? 3,
            precio_adulto_extra: Number(precioAdulto),
            msg_bienvenida: config.msg_bienvenida ?? '',
            msg_advertencia_5min: config.msg_advertencia_5min ?? '',
            msg_tiempo_cumplido: config.msg_tiempo_cumplido ?? '',
            titulo_dashboard: tituloGuardado || 'Panel de Control - Sucursal Norte'
          });
        }
      }

      if (personalResult.status === 'fulfilled') {
        const perVal = personalResult.value as any;
        if (perVal?.data) {
          this.listaPersonal = perVal.data;
        }
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
      const payload: Record<string, any> = {};

      // Construcción dinámica del payload según las columnas reales existentes
      if (this.columnasDisponibles.size === 0 || this.columnasDisponibles.has('precio_base')) {
        payload['precio_base'] = Number(formVal.precio_base);
      }
      if (this.columnasDisponibles.size === 0 || this.columnasDisponibles.has('minutos_base')) {
        payload['minutos_base'] = Number(formVal.minutos_base);
      }
      if (this.columnasDisponibles.size === 0 || this.columnasDisponibles.has('precio_minuto_extra')) {
        payload['precio_minuto_extra'] = Number(formVal.precio_minuto_extra);
      }
      if (this.columnasDisponibles.has('precio_adulto_extra')) {
        payload['precio_adulto_extra'] = Number(formVal.precio_adulto_extra);
      } else if (this.columnasDisponibles.has('precio_adulto')) {
        payload['precio_adulto'] = Number(formVal.precio_adulto_extra);
      }
      if (this.columnasDisponibles.size === 0 || this.columnasDisponibles.has('msg_bienvenida')) {
        payload['msg_bienvenida'] = formVal.msg_bienvenida;
      }
      if (this.columnasDisponibles.size === 0 || this.columnasDisponibles.has('msg_advertencia_5min')) {
        payload['msg_advertencia_5min'] = formVal.msg_advertencia_5min;
      }
      if (this.columnasDisponibles.size === 0 || this.columnasDisponibles.has('msg_tiempo_cumplido')) {
        payload['msg_tiempo_cumplido'] = formVal.msg_tiempo_cumplido;
      }
      if (this.columnasDisponibles.has('titulo_dashboard')) {
        payload['titulo_dashboard'] = formVal.titulo_dashboard;
      }

      // Guardado local persistente del título y precio adulto extra
      if (typeof window !== 'undefined' && window.localStorage) {
        if (formVal.titulo_dashboard) {
          localStorage.setItem('titulo_dashboard', formVal.titulo_dashboard);
        }
        if (formVal.precio_adulto_extra !== undefined && formVal.precio_adulto_extra !== null) {
          localStorage.setItem('precio_adulto_extra', formVal.precio_adulto_extra.toString());
        }
      }

      const updatePromise = this.supabase.from('configuracion_sistema')
        .update(payload)
        .eq('id', this.configId);

      const { error } = await this.ejecutarConTimeout(updatePromise as any, 7000) as any;

      if (error) {
        await this.abrirDialogo('Error', 'Error al guardar cambios: ' + error.message, 'Entendido');
      } else {
        this.mostrarFeedback('Ajustes del negocio guardados correctamente');
      }
    } catch (err: any) {
      console.error('Error al guardar configuración del negocio:', err);
      await this.abrirDialogo('Aviso', 'No se pudo guardar la configuración en el tiempo esperado: ' + (err?.message || err), 'Entendido');
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  async registrarColaborador() {
    if (this.personalForm.invalid || this.isSaving) return;
    this.isSaving = true;
    this.cdr.detectChanges();

    const { email, nombre, rol } = this.personalForm.value;
    const redirectTo = `${window.location.origin}/actualizar-password`;

    try {
      let useFallback = false;

      // 1. Intento primario: Invocación a Supabase Edge Function 'invitar-usuario'
      try {
        const invitePromise = this.supabase.functions.invoke('invitar-usuario', {
          body: {
            email: String(email).trim().toLowerCase(),
            nombre: String(nombre).trim(),
            rol: rol || 'ENCARGADO',
            redirectTo
          }
        });

        const response = await this.ejecutarConTimeout(invitePromise, 5000);
        const { data, error } = response;

        if (error || data?.error) {
          const msg = String(error?.message || data?.error || '');
          if (msg.includes('Failed to send') || msg.includes('404') || msg.includes('FunctionsFetchError') || msg.includes('Relay Error') || msg.includes('not found')) {
            useFallback = true;
          } else {
            await this.abrirDialogo('Aviso', msg, 'Entendido');
            return;
          }
        } else {
          await this.abrirDialogo(
            '¡Invitación Enviada!',
            data?.message || `Se ha enviado un correo con el enlace de acceso a ${email}.`,
            'Aceptar'
          );
          this.personalForm.reset({ rol: 'ENCARGADO' });
          await this.cargarDatos();
          return;
        }
      } catch (e) {
        useFallback = true;
      }

      // 2. Fallback Directo: Registro mediante cliente aislado (sin necesidad de desplegar Edge Function)
      if (useFallback) {
        await this.registrarDirectoFallback(email, nombre, rol);
      }
    } catch (err: any) {
      console.error('Error al registrar colaborador:', err);
      await this.abrirDialogo('Error al procesar registro', err?.message || err, 'Entendido');
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  private async registrarDirectoFallback(email: string, nombre: string, rol: string) {
    const emailNormalizado = String(email).trim().toLowerCase();
    const nombreNormalizado = String(nombre).trim();
    const rolValido = (rol === 'ADMINISTRADOR' || rol === 'ENCARGADO') ? rol : 'ENCARGADO';
    const redirectTo = `${window.location.origin}/actualizar-password`;

    // Cliente aislado temporal que no interfiere con la sesión actual del administrador
    const tempSupabase = createClient(environment.supabaseUrl, environment.supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

    // Generamos contraseña temporal segura
    const tempPassword = 'VP!' + Math.random().toString(36).slice(-8) + 'Aa9#';

    const { data: signUpData, error: signUpError } = await tempSupabase.auth.signUp({
      email: emailNormalizado,
      password: tempPassword,
      options: {
        data: {
          nombre: nombreNormalizado,
          rol: rolValido
        },
        emailRedirectTo: redirectTo
      }
    });

    if (signUpError) {
      if (signUpError.message?.toLowerCase().includes('already registered') || signUpError.message?.toLowerCase().includes('already exists')) {
        // Enviar correo de restablecimiento si ya existe
        await this.supabase.auth.resetPasswordForEmail(emailNormalizado, { redirectTo });
        await this.abrirDialogo(
          'Usuario Ya Existente',
          `El correo ${emailNormalizado} ya existe en el sistema. Se le ha enviado un correo para restablecer o definir su contraseña.`,
          'Aceptar'
        );
        this.personalForm.reset({ rol: 'ENCARGADO' });
        await this.cargarDatos();
        return;
      }
      throw signUpError;
    }

    const nuevoUsuario = signUpData.user;
    if (nuevoUsuario) {
      // Aseguramos el registro con su rol en la tabla perfiles
      const { error: perfilError } = await this.supabase.from('perfiles').upsert({
        id: nuevoUsuario.id,
        email: emailNormalizado,
        nombre: nombreNormalizado,
        rol: rolValido,
        activo: true
      });

      if (perfilError) {
        console.warn('Nota al sincronizar perfil:', perfilError);
      }

      // Enviar enlace de restablecimiento para que el colaborador elija su propia contraseña
      await this.supabase.auth.resetPasswordForEmail(emailNormalizado, { redirectTo });

      await this.abrirDialogo(
        '¡Colaborador Registrado Exitosamente!',
        `Se ha creado la cuenta en la base de datos para ${nombreNormalizado} (${rolValido === 'ENCARGADO' ? 'Anfitriona' : 'Administrador General'}).\n\nSe ha enviado un correo a ${emailNormalizado} con el enlace para definir su contraseña y acceder.`,
        'Aceptar'
      );

      this.personalForm.reset({ rol: 'ENCARGADO' });
      await this.cargarDatos();
    }
  }

  async enviarResetPassword(perfil: any) {
    if (!perfil || !perfil.email || this.personalEnviandoEmailId) return;

    this.personalEnviandoEmailId = perfil.id;
    this.cdr.detectChanges();

    try {
      const redirectTo = `${window.location.origin}/actualizar-password`;
      const resetPromise = this.supabase.auth.resetPasswordForEmail(perfil.email, {
        redirectTo
      });

      const { error } = await this.ejecutarConTimeout(resetPromise as any, 10000) as any;

      if (error) {
        await this.abrirDialogo(
          'Error al enviar correo',
          `No se pudo enviar el correo de acceso a ${perfil.email}: ${error.message}`,
          'Entendido'
        );
      } else {
        await this.abrirDialogo(
          'Correo Enviado',
          `Se ha enviado exitosamente el enlace para restablecer o definir la contraseña a ${perfil.email}.`,
          'Aceptar'
        );
      }
    } catch (err: any) {
      console.error('Error al enviar correo de contraseña:', err);
      await this.abrirDialogo('Error', 'No se pudo enviar el correo: ' + (err?.message || err), 'Entendido');
    } finally {
      this.personalEnviandoEmailId = null;
      this.cdr.detectChanges();
    }
  }

  async actualizarPersonal(perfil: any) {
    if (this.personalGuardandoId) return;
    this.personalGuardandoId = perfil.id;
    this.cdr.detectChanges();

    try {
      const updatePromise = this.supabase.from('perfiles')
        .update({
          hora_entrada: perfil.hora_entrada,
          hora_salida: perfil.hora_salida,
          activo: perfil.activo
        })
        .eq('id', perfil.id);

      const { error } = await this.ejecutarConTimeout(updatePromise as any, 7000) as any;

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
