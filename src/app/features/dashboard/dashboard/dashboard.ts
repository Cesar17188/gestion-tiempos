import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { interval, Subscription } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';
import { SupabaseService } from '../../../core/services/supabase/supabase';
import { 
  validarCorreo, 
  validarTelefono, 
  validarCedulaOPasaporte, 
  normalizarTelefono, 
  formatearTelefonoParaVista, 
  sanitizarTexto, 
  sanitizarCorreo 
} from '../../../core/validators/custom-validators';

// Interfaz para tipar los datos de la sesión
export interface SesionJuego {
  id: string;
  ninoId: string;
  nombreNino: string;
  aliasNino?: string;
  ninoFechaNacimiento?: string;
  ninoNotas?: string;
  tutorId?: string;
  tutorCedula?: string;
  nombreTutor: string;
  aliasTutor?: string;
  parentescoTutor: string;
  whatsapp: string;
  tutorCorreo?: string;
  tutorContactoAdicional?: string;
  horaIngreso: Date;
  horaSalidaEstimada: Date;
  minutosRestantes: number;
  tiempoRestanteStr: string;
  estadoAlerta: 'normal' | 'advertencia' | 'expirado';
  costoBase: number;
  minutosExtra: number;
  costoExtra: number;
  costoTotal: number;
  adultosAdicionales: number;
  extensionAplicada: boolean;
  progresoColor?: string;
  oculta?: boolean;
  tipologia?: string;
  observacionesTipologia?: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  host: {
    '[@fadeAnimation]': '',
    style: 'display: block; width: 100%;'
  },
  animations: [
    trigger('fadeAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.98)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'scale(0.98)' }))
      ])
    ])
  ]
})
export class Dashboard implements OnInit, OnDestroy {
  // Inyectamos nuestro servicio real y el enrutador
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);
  private fb = inject(FormBuilder);

  // Configuración y datos del usuario
  saludoPersonalizado = 'Hola, Equipo';
  rolUsuario = 'Encargada de Sala';
  precioHoraBase = 7.00;
  precioFraccionBase = 4.00;
  precioAdultoExtra = 2.00;
  precioPaqueteExtra: number = 3;
  minutosToleranciaAlerta = 5;
  tituloDashboard: string = 'Panel de Control - Sucursal Norte';
  msgExpirado = '';
  msgAdvertencia5min: string = '';
  msgTiempoCumplido: string = '';
  msgBienvenida: string = '';

  // Usuario y estado
  esAdmin: boolean = false;
  userGreeting: string = 'Cargando...';
  userName: string = '';
  avatarUrl: string | null = null;
  horarioTurno: string = '';
  horaEntrada?: string;
  horaSalida?: string;
  cerrandoSesion: boolean = false;

  // Lista de sesiones activas en sala
  sesiones: SesionJuego[] = [];
  cantidadVisibles: number = 0;
  isLoading = true;
  haySesionesCargadas = false;
  private timerSubscription?: Subscription;
  private realtimeChannel: any;

  // Estado para el modal de extensión de tiempo
  showExtensionDialog = false;
  selectedSesionForExtension: SesionJuego | null = null;
  tiempoExtensionSeleccionado: number = 30; // 30 o 60 min
  isApplyingExtension = false;

  // Toast / Alerta flotante
  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  // Variables para Dialog Modal
  showConfirmDialog = false;
  dialogTitle = '';
  dialogMessage = '';
  dialogPrimaryBtn = 'Aceptar';
  dialogSecondaryBtn = 'Cancelar';
  private dialogResolver?: (value: boolean) => void;

  // Variables para Actualización de Tutor
  showUpdateTutorDialog = false;
  selectedSesionForUpdate: SesionJuego | null = null;
  isSearchingTutor = false;
  isSavingTutor = false;
  searchTutorMessage = '';

  // Variables para Actualización de Niño
  showUpdateNinoDialog = false;
  isSavingNino = false;

  tutorUpdateForm: FormGroup = this.fb.group({
    tutorNombre: ['', [Validators.required, Validators.minLength(4)]],
    tutorCedula: ['', [Validators.required, validarCedulaOPasaporte()]],
    tutorAlias: [''],
    tutorParentesco: ['', [Validators.required]],
    tutorCorreo: ['', [validarCorreo()]],
    tutorContactoAdicional: [''],
    tutorWhatsapp: ['', [Validators.required, validarTelefono()]]
  });

  ninoUpdateForm: FormGroup = this.fb.group({
    ninoNombre: ['', [Validators.required, Validators.minLength(3)]],
    ninoAlias: [''],
    ninoFechaNacimiento: ['', [Validators.required]],
    ninoNotas: ['']
  });

  async ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      await this.verificarPermisos();
      await this.establecerSaludoPorRol();
      await this.cargarConfiguracion();
      await this.cargarSesionesActivas();
      this.cdr.detectChanges(); // Forzamos actualización inicial al terminar la carga

      this.iniciarTemporizador();
      this.suscribirseCambiosEnVivo();
    }
  }

  ngOnDestroy() {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
    // La forma correcta de apagar el canal en Supabase v2 es directamente desde el cliente:
    if (this.realtimeChannel) {
      this.supabaseService.supabase.removeChannel(this.realtimeChannel);
    }
  }

  async cargarConfiguracion() {
    try {
      const { data } = await this.supabaseService.db('configuracion_sistema').select('*').limit(1).maybeSingle();
      if (data) {
        if (data.precio_minuto_extra !== undefined && data.precio_minuto_extra !== null) {
          this.precioPaqueteExtra = data.precio_minuto_extra;
        }
        if (data.titulo_dashboard) {
          this.tituloDashboard = data.titulo_dashboard;
        } else if (typeof window !== 'undefined' && window.localStorage) {
          const localTitle = localStorage.getItem('titulo_dashboard');
          if (localTitle) this.tituloDashboard = localTitle;
        }
        if (data.msg_advertencia_5min) {
          this.msgAdvertencia5min = data.msg_advertencia_5min;
        }
        if (data.msg_tiempo_cumplido) {
          this.msgTiempoCumplido = data.msg_tiempo_cumplido;
        }
        if (data.msg_bienvenida) {
          this.msgBienvenida = data.msg_bienvenida;
        }
      }
    } catch (e) {
      console.error('Error al cargar configuración:', e);
    }
  }

  // OBTENER ROL DEL USUARIO Y ESTABLECER SALUDO
  async establecerSaludoPorRol() {
    try {
      const { data: { user }, error: authError } = await this.supabaseService.supabase.auth.getUser();
      if (authError) throw authError;

      if (user) {
        const { data: perfil, error: profileError } = await this.supabaseService.supabase
          .from('perfiles')
          .select('rol, nombre, avatar_url, hora_entrada, hora_salida')
          .eq('email', user.email)
          .single();

        if (profileError) throw profileError;

        if (perfil) {
          const rolUsuario = perfil.rol?.toUpperCase();
          this.userName = perfil.nombre || '';
          this.avatarUrl = perfil.avatar_url || null;
          if (rolUsuario === 'ADMINISTRADOR') {
            this.userGreeting = 'Hola, Administrador';
          } else if (rolUsuario === 'ENCARGADO') {
            this.userGreeting = 'Hola, Anfitriona';
            if (perfil.hora_entrada && perfil.hora_salida) {
              this.horaEntrada = perfil.hora_entrada;
              this.horaSalida = perfil.hora_salida;
              this.horarioTurno = `(${perfil.hora_entrada} - ${perfil.hora_salida})`;
            }
          } else {
            this.userGreeting = 'Hola, Usuario';
          }
        }
      }
    } catch (error) {
      console.error('Error al obtener el perfil del usuario:', error);
      this.userGreeting = 'Hola';
    } finally {
      this.cdr.detectChanges(); // Informamos a Angular que la variable userGreeting ha cambiado
    }
  }

  // MOSTRAR TOAST
  mostrarToast(mensaje: string, tipo: 'success' | 'error' = 'success') {
    this.toastMessage = mensaje;
    this.toastType = tipo;
    this.showToast = true;
    setTimeout(() => {
      this.showToast = false;
      this.cdr.detectChanges();
    }, 3000);
    this.cdr.detectChanges();
  }

  // DIALOGO CONFIRMACIÓN CUSTOM
  abrirDialogo(titulo: string, mensaje: string, btnPrimario: string = 'Aceptar', btnSecundario: string = 'Cancelar'): Promise<boolean> {
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

  // CERRAR SESIÓN
  async cerrarSesion() {
    const { error } = await this.supabaseService.auth.signOut();
    if (error) {
      console.error('Error al cerrar sesión:', error);
    } else {
      this.router.navigate(['/login']);
    }
  }

  // 1. CONSULTA REAL A LA BASE DE DATOS
  async cargarSesionesActivas() {
    const hace3Minutos = new Date(Date.now() - 180000).toISOString();
    // Traemos sesiones activas, sesiones finalizadas recientes (últimos 3 min), Y todas las sesiones finalizadas que aún NO tengan tipología u observaciones registradas
    const { data, error } = await this.supabaseService.db('sesiones_juego')
      .select(`
        id,
        nino_id,
        ingreso_at,
        salida_estimada_at,
        costo_base,
        minutos_extra,
        costo_extra,
        adultos_adicionales,
        tipologia,
        observaciones_tipologia,
        ninos (
          id,
          nombres_apellidos,
          alias,
          fecha_nacimiento,
          notas,
          tutores (
            id,
            cedula,
            nombres_apellidos,
            alias,
            whatsapp,
            parentesco,
            correo,
            contacto_adicional_nombre
          )
        )
      `)
      .or(`estado.eq.ACTIVO,tipologia.is.null,tipologia.eq.,observaciones_tipologia.is.null,observaciones_tipologia.eq.,and(estado.eq.FINALIZADO,salida_estimada_at.gte.${hace3Minutos})`);

    if (error) {
      console.error('Error al cargar las sesiones:', error);
      return;
    }

    // Mapeamos los datos de Supabase a nuestra interfaz visual de Angular
    if (data) {
      this.sesiones = data.map((item: any) => {
        const tutoresArray = item.ninos?.tutores;
        let ultimoTutor: any = null;
        if (Array.isArray(tutoresArray) && tutoresArray.length > 0) {
          const sesionPrevia = this.sesiones.find(s => s.id === item.id || s.ninoId === item.nino_id);
          if (sesionPrevia?.tutorId) {
            ultimoTutor = tutoresArray.find((t: any) => t.id === sesionPrevia.tutorId) || tutoresArray[tutoresArray.length - 1];
          } else {
            ultimoTutor = tutoresArray[tutoresArray.length - 1];
          }
        } else {
          ultimoTutor = tutoresArray;
        }
        
        return {
          id: item.id,
          ninoId: item.nino_id,
          nombreNino: item.ninos?.nombres_apellidos || 'Desconocido',
          aliasNino: item.ninos?.alias?.trim() || '',
          ninoFechaNacimiento: item.ninos?.fecha_nacimiento || '',
          ninoNotas: item.ninos?.notas || '',
          tutorId: ultimoTutor?.id || '',
          tutorCedula: ultimoTutor?.cedula || '',
          nombreTutor: ultimoTutor?.nombres_apellidos || 'Desconocido',
          aliasTutor: ultimoTutor?.alias?.trim() || '',
          parentescoTutor: ultimoTutor?.parentesco || '',
          whatsapp: ultimoTutor?.whatsapp || '',
          tutorCorreo: ultimoTutor?.correo || '',
          tutorContactoAdicional: ultimoTutor?.contacto_adicional_nombre || '',
          horaIngreso: new Date(item.ingreso_at),
          horaSalidaEstimada: new Date(item.salida_estimada_at),
          minutosRestantes: 0,
          tiempoRestanteStr: '00:00',
          estadoAlerta: 'normal',
          costoBase: item.costo_base || 30, // Fallback si no está seteado
          minutosExtra: item.minutos_extra || 0,
          costoExtra: item.costo_extra || 0,
          adultosAdicionales: item.adultos_adicionales || 0,
          extensionAplicada: (item.minutos_extra || 0) > 0,
          costoTotal: (item.costo_base || 30) + (item.costo_extra || 0),
          tipologia: item.tipologia || '',
          observacionesTipologia: item.observaciones_tipologia || ''
        };
      });

      this.actualizarTiempos(); // Calculamos el tiempo inmediatamente
      this.cdr.detectChanges(); // Informamos a Angular sobre el cambio de sesiones
    }
  }

  // 2. MAGIA EN TIEMPO REAL (WEBSOCKETS)
  suscribirseCambiosEnVivo() {
    this.realtimeChannel = this.supabaseService.supabase.channel('cambios-sesiones')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sesiones_juego' },
        () => {
          this.cargarSesionesActivas();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tutores' },
        () => {
          this.cargarSesionesActivas();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ninos' },
        () => {
          this.cargarSesionesActivas();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ninos_tutores' },
        () => {
          this.cargarSesionesActivas();
        }
      )
      .subscribe();
  }

  // 3. LA MATEMÁTICA DEL TIEMPO (Se mantiene igual que antes)
  iniciarTemporizador() {
    this.timerSubscription = interval(1000).subscribe(() => {
      this.actualizarTiempos();
    });
  }

  actualizarTiempos() {
    // 1. Verificación automática de fin de turno para encargados
    if (this.horaEntrada && this.horaSalida && !this.cerrandoSesion) {
      const now = new Date();
      const currentHours = now.getHours().toString().padStart(2, '0');
      const currentMinutes = now.getMinutes().toString().padStart(2, '0');
      const currentTime = `${currentHours}:${currentMinutes}`;
      
      let fueraDeHorario = false;
      if (this.horaEntrada <= this.horaSalida) {
        fueraDeHorario = (currentTime < this.horaEntrada || currentTime > this.horaSalida);
      } else {
        fueraDeHorario = (currentTime < this.horaEntrada && currentTime > this.horaSalida);
      }

      if (fueraDeHorario) {
        this.cerrandoSesion = true;
        this.mostrarToast('Tu turno de trabajo ha finalizado. La sesión se cerrará.', 'error');
        this.cerrarSesion();
        return; // Detenemos la actualización porque se va a cerrar sesión
      }
    }

    // 2. Actualización de tiempos de las sesiones
    const ahora = new Date().getTime();
    let visibles = 0;

    this.sesiones.forEach(sesion => {
      const salida = sesion.horaSalidaEstimada.getTime();
      const diffMs = salida - ahora;
      const tieneTipologia = !!(sesion.tipologia && sesion.tipologia.trim() !== '' && sesion.tipologia !== '-');
      const tieneObservaciones = !!(sesion.observacionesTipologia && sesion.observacionesTipologia.trim() !== '');

      // Solo se oculta la tarjeta si pasaron 3 minutos (180,000 ms) Y YA SE REGISTRÓ LA TIPOLOGÍA Y LAS OBSERVACIONES
      if (diffMs <= -180000 && tieneTipologia && tieneObservaciones) {
        sesion.oculta = true;
      } else {
        sesion.oculta = false;
        visibles++;
      }

      if (diffMs <= 0) {
        if (sesion.estadoAlerta !== 'expirado') {
          // Si recién acaba de expirar visualmente, lo finalizamos en la BD
          this.marcarComoFinalizado(sesion.id);
        }
        sesion.minutosRestantes = 0;
        sesion.tiempoRestanteStr = '00:00';
        sesion.estadoAlerta = 'expirado';
        sesion.progresoColor = 'hsla(0, 70%, 50%, 0.15)'; // Rojo
      } else {
        const diffSecs = Math.floor(diffMs / 1000);
        const totalMins = Math.floor(diffSecs / 60);

        const horas = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        const secs = diffSecs % 60;

        sesion.minutosRestantes = totalMins;

        // Formato condicional: añade horas solo si es mayor a 59 minutos
        const hStr = horas > 0 ? `${horas.toString().padStart(2, '0')}:` : '';
        const mStr = mins.toString().padStart(2, '0');
        const sStr = secs.toString().padStart(2, '0');

        sesion.tiempoRestanteStr = `${hStr}${mStr}:${sStr}`;

        // La advertencia debe saltar a los 5 minutos exactos (300 segundos)
        if (diffSecs <= 300) {
          sesion.estadoAlerta = 'advertencia';
        } else {
          sesion.estadoAlerta = 'normal';
        }

        // Calcular el color de fondo basado en el porcentaje de tiempo restante (de verde a rojo)
        const totalMs = sesion.horaSalidaEstimada.getTime() - sesion.horaIngreso.getTime();
        let porcentaje = diffMs / totalMs;
        if (porcentaje < 0) porcentaje = 0;
        if (porcentaje > 1) porcentaje = 1;

        // Hue va de 120 (verde) a 0 (rojo)
        const hue = Math.floor(porcentaje * 120);
        sesion.progresoColor = `hsla(${hue}, 70%, 50%, 0.15)`;
      }
    });

    this.cantidadVisibles = visibles;
    this.cdr.detectChanges(); // Forzamos a la UI a refrescar el temporizador cada segundo
  }

  // 4. GENERADOR DE WHATSAPP
  async enviarWhatsApp(sesion: SesionJuego) {
    let telefono = (sesion.whatsapp || '').toString().replace(/\D/g, '');

    // Fallback: si por alguna razón no vino en el join de sesión, consultarlo directamente
    if (!telefono && sesion.ninoId) {
      try {
        const { data: ninoData } = await this.supabaseService.db('ninos')
          .select('tutores(whatsapp)')
          .eq('id', sesion.ninoId)
          .maybeSingle();

        const tutoresArr = (ninoData as any)?.tutores;
        const tut = Array.isArray(tutoresArr) ? tutoresArr[tutoresArr.length - 1] : tutoresArr;
        if (tut?.whatsapp) {
          telefono = (tut.whatsapp || '').toString().replace(/\D/g, '');
          sesion.whatsapp = tut.whatsapp;
        }
      } catch (e) {
        console.error('Error recuperando WhatsApp del tutor:', e);
      }
    }

    // Normalizar formato de teléfono (prefijo Ecuador 593 si inicia con 0 o 9 dígitos)
    if (telefono.startsWith('0')) {
      telefono = '593' + telefono.substring(1);
    } else if (telefono.length === 9 && !telefono.startsWith('593')) {
      telefono = '593' + telefono;
    }

    if (!telefono) {
      this.mostrarToast('No se encontró un número de WhatsApp registrado para este tutor.', 'error');
      return;
    }

    if (!this.msgTiempoCumplido && !this.msgAdvertencia5min) {
      await this.cargarConfiguracion();
    }

    const preferidoNino = (sesion.aliasNino && sesion.aliasNino.trim())
      ? sesion.aliasNino.trim()
      : (sesion.nombreNino || '').trim();

    const preferidoTutor = (sesion.aliasTutor && sesion.aliasTutor.trim())
      ? sesion.aliasTutor.trim()
      : (sesion.nombreTutor || '').trim();

    let mensaje = '';
    if (sesion.estadoAlerta === 'expirado') {
      if (this.msgTiempoCumplido && this.msgTiempoCumplido.trim() !== '') {
        mensaje = this.msgTiempoCumplido;
        // Nombre preferido / Diminutivo Niño
        mensaje = mensaje.replace(/\{nombre_preferido_nino\}|\{diminutivo_nino\}|\{alias_nino\}|\{preferido_nino\}|\[nombre_preferido_nino\]|\[diminutivo_nino\]|\[alias_nino\]|\[preferido_nino\]/gi, `*${preferidoNino}*`);
        // Nombre preferido / Diminutivo Tutor / Adulto
        mensaje = mensaje.replace(/\{nombre_preferido_tutor\}|\{diminutivo_tutor\}|\{alias_tutor\}|\{preferido_tutor\}|\{nombre_preferido_adulto\}|\{diminutivo_adulto\}|\[nombre_preferido_tutor\]|\[diminutivo_tutor\]|\[alias_tutor\]|\[preferido_tutor\]|\[nombre_preferido_adulto\]|\[diminutivo_adulto\]/gi, preferidoTutor);
        // Nombre Completo Niño
        mensaje = mensaje.replace(/\{nombre_nino\}|\{nino\}|\{niño\}|\{nombre_niño\}|\[nombre_nino\]|\[nino\]|\[niño\]|\[nombre_niño\]/gi, `*${sesion.nombreNino || preferidoNino}*`);
        // Nombre Completo Tutor / Adulto
        mensaje = mensaje.replace(/\{nombre_tutor\}|\{tutor\}|\{nombre_adulto\}|\{adulto\}|\[nombre_tutor\]|\[tutor\]|\[nombre_adulto\]|\[adulto\]/gi, sesion.nombreTutor || preferidoTutor);
        // Minutos
        mensaje = mensaje.replace(/\{minutos\}|\{tiempo\}|\[minutos\]|\[tiempo\]/gi, '0');
      } else {
        mensaje = `Hola, te informamos que el tiempo de juego de *${preferidoNino}* ha concluido. ¿Deseas extender el paquete? (Opciones de pago: transferencia o efectivo en caja).`;
      }
    } else {
      if (this.msgAdvertencia5min && this.msgAdvertencia5min.trim() !== '') {
        mensaje = this.msgAdvertencia5min;
        // Nombre preferido / Diminutivo Niño
        mensaje = mensaje.replace(/\{nombre_preferido_nino\}|\{diminutivo_nino\}|\{alias_nino\}|\{preferido_nino\}|\[nombre_preferido_nino\]|\[diminutivo_nino\]|\[alias_nino\]|\[preferido_nino\]/gi, `*${preferidoNino}*`);
        // Nombre preferido / Diminutivo Tutor / Adulto
        mensaje = mensaje.replace(/\{nombre_preferido_tutor\}|\{diminutivo_tutor\}|\{alias_tutor\}|\{preferido_tutor\}|\{nombre_preferido_adulto\}|\{diminutivo_adulto\}|\[nombre_preferido_tutor\]|\[diminutivo_tutor\]|\[alias_tutor\]|\[preferido_tutor\]|\[nombre_preferido_adulto\]|\[diminutivo_adulto\]/gi, preferidoTutor);
        // Nombre Completo Niño
        mensaje = mensaje.replace(/\{nombre_nino\}|\{nino\}|\{niño\}|\{nombre_niño\}|\[nombre_nino\]|\[nino\]|\[niño\]|\[nombre_niño\]/gi, `*${sesion.nombreNino || preferidoNino}*`);
        // Nombre Completo Tutor / Adulto
        mensaje = mensaje.replace(/\{nombre_tutor\}|\{tutor\}|\{nombre_adulto\}|\{adulto\}|\[nombre_tutor\]|\[tutor\]|\[nombre_adulto\]|\[adulto\]/gi, sesion.nombreTutor || preferidoTutor);
        // Minutos
        mensaje = mensaje.replace(/\{minutos\}|\{tiempo\}|\[minutos\]|\[tiempo\]/gi, (sesion.minutosRestantes || 5).toString());
      } else {
        mensaje = `Hola, te informamos que el tiempo de juego de *${preferidoNino}* terminará en aproximadamente ${sesion.minutosRestantes} minutos. ¿Deseas extender el paquete?`;
      }
    }

    const mensajeCodificado = encodeURIComponent(mensaje);
    const url = `https://api.whatsapp.com/send?phone=${telefono}&text=${mensajeCodificado}`;

    // Crear y disparar link dinámico para evitar bloqueos de popup en navegadores
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ACTUALIZACIÓN DE ESTADO A FINALIZADO AUTOMÁTICA
  async marcarComoFinalizado(id: string) {
    const { error } = await this.supabaseService.db('sesiones_juego')
      .update({ estado: 'FINALIZADO' })
      .eq('id', id)
      .eq('estado', 'ACTIVO'); // Solo actualizamos si sigue activo
      
    if (error) {
      console.error('Error al actualizar sesión a FINALIZADO:', error);
    } else {
      console.log('Sesión auto-finalizada en BD:', id);
    }
  }

  // FINALIZAR SESIÓN O RESTAR TIEMPO
  async retirarSesion(sesion: SesionJuego) {
    if (sesion.minutosRestantes >= 30) {
      // 1. Si hay 30 minutos o más, se restan 30 minutos
      let nuevosMinutosExtra = sesion.minutosExtra;
      let nuevoCostoExtra = sesion.costoExtra;
      let nuevoCostoBase = sesion.costoBase;
      
      // Revertimos también los costos extra si existen para mantener consistencia
      if (sesion.minutosExtra > 0) {
        nuevosMinutosExtra = Math.max(0, sesion.minutosExtra - 30);
        nuevoCostoExtra = Math.max(0, sesion.costoExtra - this.precioPaqueteExtra);
      } else if (sesion.costoBase === 10) {
        // Si no hay tiempo extra pero el costo base es de 60 minutos ($10), lo reducimos al de 30 minutos ($7)
        nuevoCostoBase = 7;
      }

      const nuevaSalidaEstimada = new Date(sesion.horaSalidaEstimada.getTime() - 30 * 60000);
      
      const { error } = await this.supabaseService.db('sesiones_juego')
        .update({
          salida_estimada_at: nuevaSalidaEstimada.toISOString(),
          minutos_extra: nuevosMinutosExtra,
          costo_extra: nuevoCostoExtra,
          costo_base: nuevoCostoBase
        })
        .eq('id', sesion.id);

      if (error) {
        console.error('Error al restar 30 minutos:', error);
        this.mostrarToast('Hubo un error al intentar restar el tiempo.', 'error');
      } else {
        sesion.horaSalidaEstimada = nuevaSalidaEstimada;
        sesion.minutosExtra = nuevosMinutosExtra;
        sesion.costoExtra = nuevoCostoExtra;
        sesion.costoBase = nuevoCostoBase;
        sesion.costoTotal = sesion.costoBase + sesion.costoExtra;
        this.actualizarTiempos();
        this.mostrarToast('Se han restado 30 minutos de la sesión.', 'success');
      }
    } else {
      // 2. Si hay menos de 30 minutos, se pregunta y se termina la sesión (tiempo a 0)
      const confirmarFinalizar = await this.abrirDialogo(
        'Finalizar Sesión',
        `¿Estás seguro de finalizar la sesión y retirar a ${sesion.nombreNino}?`,
        'Sí, Finalizar',
        'Cancelar'
      );
      if (!confirmarFinalizar) return;

      const nuevaSalidaEstimada = new Date(); // El tiempo se va a 0 (ahora)

      const { error } = await this.supabaseService.db('sesiones_juego')
        .update({
          salida_estimada_at: nuevaSalidaEstimada.toISOString()
        })
        .eq('id', sesion.id);

      if (error) {
        console.error('Error al finalizar sesión:', error);
        this.mostrarToast('Hubo un error al intentar finalizar la sesión.', 'error');
      } else {
        sesion.horaSalidaEstimada = nuevaSalidaEstimada;
        this.actualizarTiempos(); // Se encarga de marcar como expirado y finalizar en BD
        this.mostrarToast('Sesión finalizada exitosamente.', 'success');
      }
    }
  }

  // 5. AGREGAR 30 MINUTOS A LA SESIÓN
  async agregarMediaHora(sesion: SesionJuego) {
    if (sesion.estadoAlerta === 'expirado') {
      this.mostrarToast('La sesión ha expirado. Debe iniciar una nueva sesión.', 'error');
      return;
    }

    // Calculamos la nueva fecha de salida estimada sumando 30 minutos (30 * 60000 milisegundos)
    const nuevaSalidaEstimada = new Date(sesion.horaSalidaEstimada.getTime() + 30 * 60000);
    const nuevosMinutosExtra = sesion.minutosExtra + 30;
    const nuevoCostoExtra = sesion.costoExtra + this.precioPaqueteExtra;

    const { error } = await this.supabaseService.db('sesiones_juego')
      .update({
        salida_estimada_at: nuevaSalidaEstimada.toISOString(),
        minutos_extra: nuevosMinutosExtra,
        costo_extra: nuevoCostoExtra,
        estado: 'ACTIVO'
      })
      .eq('id', sesion.id);

    if (error) {
      console.error('Error al agregar 30 minutos:', error);
      this.mostrarToast('Hubo un error al intentar agregar 30 minutos.', 'error');
    } else {
      console.log('Se agregaron 30 minutos exitosamente a la sesión.');
      // Update local state temporarily so UI is instantly updated, real-time sync will overwrite it
      sesion.horaSalidaEstimada = nuevaSalidaEstimada;
      sesion.minutosExtra = nuevosMinutosExtra;
      sesion.costoExtra = nuevoCostoExtra;
      sesion.costoTotal = sesion.costoBase + sesion.costoExtra;
      sesion.extensionAplicada = true;
      this.actualizarTiempos();
      this.mostrarToast('Se agregaron 30 minutos a la sesión.', 'success');
    }
  }


  // GUARDAR TIPOLOGÍA
  async guardarTipologia(sesion: SesionJuego, event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    const tipologia = selectElement.value;
    if (!tipologia) return;

    // Actualizamos localmente para feedback inmediato
    sesion.tipologia = tipologia;

    const { error } = await this.supabaseService.db('sesiones_juego')
      .update({ tipologia: tipologia })
      .eq('id', sesion.id);

    if (error) {
      console.error('Error al guardar tipología:', error);
      this.mostrarToast('Hubo un error al guardar la tipología del cliente.', 'error');
    } else {
      console.log('Tipología guardada:', tipologia);
      this.mostrarToast('Tipología del cliente registrada exitosamente.', 'success');
      this.actualizarTiempos(); // Si ya habían pasado más de 10 min, al tener tipología ahora sí se archivará
    }
  }

  // GUARDAR OBSERVACIONES TIPOLOGÍA
  async guardarObservacionesTipologia(sesion: SesionJuego, event: Event) {
    const inputElement = event.target as HTMLInputElement | HTMLTextAreaElement;
    const observaciones = inputElement.value;

    sesion.observacionesTipologia = observaciones;

    const { error } = await this.supabaseService.db('sesiones_juego')
      .update({ observaciones_tipologia: observaciones })
      .eq('id', sesion.id);

    if (error) {
      console.error('Error al guardar observaciones de tipología:', error);
      this.mostrarToast('Hubo un error al guardar las observaciones.', 'error');
    } else {
      console.log('Observaciones de tipología guardadas:', observaciones);
      if (observaciones && observaciones.trim() !== '') {
        this.mostrarToast('Observaciones registradas exitosamente.', 'success');
      }
      this.actualizarTiempos(); // Si ya pasaron más de 3 min y tiene tipología, ahora sí se archivará
    }
  }

  // --- ACTUALIZACIÓN DE TUTOR ---
  abrirDialogoActualizarTutor(sesion: SesionJuego) {
    this.selectedSesionForUpdate = sesion;
    this.searchTutorMessage = '';
    this.tutorUpdateForm.patchValue({
      tutorCedula: sesion.tutorCedula || '',
      tutorNombre: (sesion.nombreTutor && sesion.nombreTutor !== 'Desconocido') ? sesion.nombreTutor : '',
      tutorAlias: sesion.aliasTutor || '',
      tutorParentesco: sesion.parentescoTutor || '',
      tutorWhatsapp: sesion.whatsapp || '',
      tutorCorreo: sesion.tutorCorreo || '',
      tutorContactoAdicional: sesion.tutorContactoAdicional || ''
    });
    this.showUpdateTutorDialog = true;
  }

  cerrarDialogoActualizarTutor() {
    this.showUpdateTutorDialog = false;
    this.selectedSesionForUpdate = null;
    this.tutorUpdateForm.reset();
  }

  async buscarPorCedulaUpdate() {
    const cedulaControl = this.tutorUpdateForm.get('tutorCedula');
    if (!cedulaControl || !cedulaControl.value || cedulaControl.value.trim() === '') {
      this.searchTutorMessage = 'Ingrese una cédula para buscar.';
      this.cdr.detectChanges();
      setTimeout(() => { this.searchTutorMessage = ''; this.cdr.detectChanges(); }, 3000);
      return;
    }

    this.isSearchingTutor = true;
    this.searchTutorMessage = '';
    this.cdr.detectChanges();

    const cedula = cedulaControl.value.trim();

    try {
      const { data: tutorData, error: tutorError } = await this.supabaseService.db('tutores')
        .select('*')
        .eq('cedula', cedula)
        .limit(1)
        .maybeSingle();

      if (tutorError) throw tutorError;

      if (tutorData) {
        this.tutorUpdateForm.patchValue({
          tutorNombre: tutorData.nombres_apellidos || '',
          tutorAlias: tutorData.alias || '',
          tutorParentesco: tutorData.parentesco || '',
          tutorCorreo: tutorData.correo || '',
          tutorContactoAdicional: tutorData.contacto_adicional_nombre || '',
          tutorWhatsapp: tutorData.whatsapp || ''
        });
        this.searchTutorMessage = 'Datos del responsable cargados exitosamente.';
      } else {
        this.searchTutorMessage = 'No se encontró un responsable con esa cédula.';
      }
    } catch (error) {
      console.error('Error buscando cédula:', error);
      this.searchTutorMessage = 'Error al buscar datos.';
    } finally {
      this.isSearchingTutor = false;
      this.cdr.detectChanges();
      setTimeout(() => { this.searchTutorMessage = ''; this.cdr.detectChanges(); }, 3000);
    }
  }

  onBlurTutorCorreo() {
    const ctrl = this.tutorUpdateForm.get('tutorCorreo');
    if (ctrl && ctrl.value) {
      ctrl.setValue(sanitizarCorreo(ctrl.value), { emitEvent: false });
    }
  }

  onBlurTutorTelefono() {
    const ctrl = this.tutorUpdateForm.get('tutorWhatsapp');
    if (ctrl && ctrl.value) {
      const normalizado = normalizarTelefono(ctrl.value);
      if (normalizado && !ctrl.errors) {
        ctrl.setValue(normalizado, { emitEvent: false });
      }
    }
  }

  onBlurTutorCedula() {
    const ctrl = this.tutorUpdateForm.get('tutorCedula');
    if (ctrl && ctrl.value) {
      ctrl.setValue(sanitizarTexto(ctrl.value), { emitEvent: false });
    }
  }

  onBlurTutorNombre() {
    const ctrl = this.tutorUpdateForm.get('tutorNombre');
    if (ctrl && ctrl.value) {
      ctrl.setValue(sanitizarTexto(ctrl.value), { emitEvent: false });
    }
  }

  obtenerVistaTelefonoTutor(): string {
    const val = this.tutorUpdateForm.get('tutorWhatsapp')?.value;
    return formatearTelefonoParaVista(val);
  }

  async guardarNuevoTutor() {
    if (this.tutorUpdateForm.invalid || !this.selectedSesionForUpdate) {
      this.tutorUpdateForm.markAllAsTouched();
      return;
    }

    this.isSavingTutor = true;
    const values = this.tutorUpdateForm.value;
    const ninoId = this.selectedSesionForUpdate.ninoId;
    const currentTutorId = this.selectedSesionForUpdate.tutorId;
    let tutorIdFinal: string | null = null;

    try {
      const cedulaSanitizada = sanitizarTexto(values.tutorCedula);
      const whatsappNormalizado = normalizarTelefono(values.tutorWhatsapp);
      const correoSanitizado = sanitizarCorreo(values.tutorCorreo);
      const nombreSanitizado = sanitizarTexto(values.tutorNombre);
      const aliasSanitizado = sanitizarTexto(values.tutorAlias);
      const parentescoSanitizado = sanitizarTexto(values.tutorParentesco);
      const contactoAdicionalSanitizado = sanitizarTexto(values.tutorContactoAdicional);

      const tutorPayload = {
        nombres_apellidos: nombreSanitizado,
        cedula: cedulaSanitizada,
        alias: aliasSanitizado,
        parentesco: parentescoSanitizado,
        correo: correoSanitizado,
        contacto_adicional_nombre: contactoAdicionalSanitizado,
        whatsapp: whatsappNormalizado
      };

      // 1. Buscar si el tutor ya existe por cédula o usar el tutorId actual
      let existingTutor: any = null;
      if (cedulaSanitizada) {
        const { data } = await this.supabaseService.db('tutores')
          .select('id')
          .eq('cedula', cedulaSanitizada)
          .maybeSingle();
        existingTutor = data;
      }

      if (!existingTutor && currentTutorId) {
        const { data } = await this.supabaseService.db('tutores')
          .select('id')
          .eq('id', currentTutorId)
          .maybeSingle();
        if (data) {
          existingTutor = data;
        }
      }

      if (existingTutor) {
        tutorIdFinal = existingTutor.id;
        const { error: updErr } = await this.supabaseService.db('tutores').update(tutorPayload).eq('id', tutorIdFinal);
        if (updErr) throw new Error(`Error al actualizar responsable: ${updErr.message}`);
      } else {
        const { data: tutorData, error: tutorError } = await this.supabaseService.db('tutores')
          .insert(tutorPayload)
          .select('id')
          .single();
        if (tutorError) throw new Error(`Error al registrar responsable: ${tutorError.message}`);
        tutorIdFinal = tutorData.id;
      }

      // 2. Vincular el tutor al niño y desvincular el anterior si se cambió de persona
      if (tutorIdFinal) {
        if (currentTutorId && currentTutorId !== tutorIdFinal) {
          try {
            await this.supabaseService.db('ninos_tutores')
              .delete()
              .eq('tutor_id', currentTutorId)
              .eq('nino_id', ninoId);
          } catch (delErr) {
            console.warn('Error al actualizar asociación de tutor previo:', delErr);
          }
        }

        const { data: linkExistente, error: linkError } = await this.supabaseService.db('ninos_tutores')
          .select('*')
          .eq('tutor_id', tutorIdFinal)
          .eq('nino_id', ninoId)
          .maybeSingle();
          
        if (!linkExistente && !linkError) {
          await this.supabaseService.db('ninos_tutores').insert({
            tutor_id: tutorIdFinal,
            nino_id: ninoId
          });
        }
      }

      // 3. Actualizar directamente el estado en memoria para actualización inmediata en la tarjeta
      this.sesiones.forEach(s => {
        if (s.ninoId === ninoId || s.id === this.selectedSesionForUpdate?.id) {
          s.tutorId = tutorIdFinal || s.tutorId;
          s.tutorCedula = cedulaSanitizada;
          s.nombreTutor = nombreSanitizado;
          s.aliasTutor = aliasSanitizado;
          s.parentescoTutor = parentescoSanitizado;
          s.whatsapp = whatsappNormalizado;
          s.tutorCorreo = correoSanitizado;
          s.tutorContactoAdicional = contactoAdicionalSanitizado;
        }
      });

      if (this.selectedSesionForUpdate) {
        this.selectedSesionForUpdate.tutorId = tutorIdFinal || this.selectedSesionForUpdate.tutorId;
        this.selectedSesionForUpdate.tutorCedula = cedulaSanitizada;
        this.selectedSesionForUpdate.nombreTutor = nombreSanitizado;
        this.selectedSesionForUpdate.aliasTutor = aliasSanitizado;
        this.selectedSesionForUpdate.parentescoTutor = parentescoSanitizado;
        this.selectedSesionForUpdate.whatsapp = whatsappNormalizado;
        this.selectedSesionForUpdate.tutorCorreo = correoSanitizado;
        this.selectedSesionForUpdate.tutorContactoAdicional = contactoAdicionalSanitizado;
      }

      this.mostrarToast('Responsable actualizado exitosamente.', 'success');
      this.cerrarDialogoActualizarTutor();
      
      // Recargar sesiones en segundo plano para sincronizar
      await this.cargarSesionesActivas();

    } catch (err: any) {
      console.error(err);
      this.mostrarToast(err.message || 'Error al actualizar responsable.', 'error');
    } finally {
      this.isSavingTutor = false;
      this.cdr.detectChanges();
    }
  }

  // --- ACTUALIZACIÓN DE NIÑO ---
  abrirDialogoActualizarNino(sesion: SesionJuego) {
    this.selectedSesionForUpdate = sesion;
    this.ninoUpdateForm.patchValue({
      ninoNombre: sesion.nombreNino || '',
      ninoAlias: sesion.aliasNino || '',
      ninoFechaNacimiento: sesion.ninoFechaNacimiento || '',
      ninoNotas: sesion.ninoNotas || ''
    });
    this.showUpdateNinoDialog = true;
  }

  cerrarDialogoActualizarNino() {
    this.showUpdateNinoDialog = false;
    this.selectedSesionForUpdate = null;
    this.ninoUpdateForm.reset();
  }

  async guardarActualizarNino() {
    if (this.ninoUpdateForm.invalid || !this.selectedSesionForUpdate) {
      this.ninoUpdateForm.markAllAsTouched();
      return;
    }

    this.isSavingNino = true;
    const values = this.ninoUpdateForm.value;
    const ninoId = this.selectedSesionForUpdate.ninoId;

    try {
      const ninoPayload = {
        nombres_apellidos: values.ninoNombre,
        alias: values.ninoAlias,
        fecha_nacimiento: values.ninoFechaNacimiento,
        notas: values.ninoNotas
      };

      const { error } = await this.supabaseService.db('ninos')
        .update(ninoPayload)
        .eq('id', ninoId);

      if (error) throw error;

      // Actualizar localmente de inmediato
      this.sesiones.forEach(s => {
        if (s.ninoId === ninoId || s.id === this.selectedSesionForUpdate?.id) {
          s.nombreNino = values.ninoNombre;
          s.aliasNino = values.ninoAlias;
          s.ninoFechaNacimiento = values.ninoFechaNacimiento;
          s.ninoNotas = values.ninoNotas;
        }
      });
      if (this.selectedSesionForUpdate) {
        this.selectedSesionForUpdate.nombreNino = values.ninoNombre;
        this.selectedSesionForUpdate.aliasNino = values.ninoAlias;
        this.selectedSesionForUpdate.ninoFechaNacimiento = values.ninoFechaNacimiento;
        this.selectedSesionForUpdate.ninoNotas = values.ninoNotas;
      }

      this.mostrarToast('Datos del niño actualizados exitosamente.', 'success');
      this.cerrarDialogoActualizarNino();
      await this.cargarSesionesActivas();

    } catch (err: any) {
      console.error(err);
      this.mostrarToast(err.message || 'Error al actualizar datos del niño.', 'error');
    } finally {
      this.isSavingNino = false;
      this.cdr.detectChanges();
    }
  }

  onEditOptionSelected(sesion: SesionJuego, event: Event) {
    const select = event.target as HTMLSelectElement;
    const value = select.value;
    if (value === 'tutor') {
      this.abrirDialogoActualizarTutor(sesion);
    } else if (value === 'nino') {
      this.abrirDialogoActualizarNino(sesion);
    }
    select.value = ''; // Reset
  }

  // 3. FUNCIÓN PARA VERIFICAR SI EL USUARIO ES ADMINISTRADOR
  async verificarPermisos() {
    const { data: { user } } = await this.supabaseService.auth.getUser();
    if (user) {
      const { data } = await this.supabaseService.db('perfiles')
        .select('rol')
        .eq('id', user.id)
        .single();

      if (data && data.rol === 'ADMINISTRADOR') {
        this.esAdmin = true;
      }
    }
  }
}
