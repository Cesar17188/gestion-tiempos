import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';
import { SupabaseService } from '../../../core/services/supabase/supabase';

// Interfaz para tipar los datos de la sesión
export interface SesionJuego {
  id: string;
  nombreNino: string;
  nombreTutor: string;
  parentescoTutor: string;
  whatsapp: string;
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
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  host: {
    '[@slideLeftRight]': '',
    style: 'display: block; width: 100%;'
  },
  animations: [
    trigger('slideLeftRight', [
      transition(':enter', [
        style({ transform: 'translateX(-100%)', opacity: 0 }),
        animate('400ms cubic-bezier(0.25, 1, 0.5, 1)', style({ transform: 'translateX(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        style({ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: -1 }),
        animate('400ms cubic-bezier(0.25, 1, 0.5, 1)', style({ transform: 'translateX(-100%)', opacity: 0 }))
      ])
    ])
  ]
})
export class Dashboard implements OnInit, OnDestroy {
  // VARIABLE PARA SABER SI EL USUARIO ES ADMINISTRADOR
  esAdmin: boolean = false;

  // Inyectamos nuestro servicio real y el enrutador
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  sesiones: SesionJuego[] = [];
  cantidadVisibles: number = 0;
  userGreeting: string = 'Cargando...';
  userName: string = '';
  avatarUrl: string | null = null;
  horarioTurno: string = '';
  horaEntrada?: string;
  horaSalida?: string;
  cerrandoSesion: boolean = false;
  precioPaqueteExtra: number = 3; // Valor por defecto
  private timerSubscription?: Subscription;
  private realtimeChannel: any;

  // Variables para Toast
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
      const { data } = await this.supabaseService.db('configuracion_sistema').select('precio_minuto_extra').eq('id', 1).single();
      if (data && data.precio_minuto_extra !== undefined) {
        this.precioPaqueteExtra = data.precio_minuto_extra;
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
            this.userGreeting = 'Hola, Encargado';
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
    const hace10Minutos = new Date(Date.now() - 600000).toISOString();
    // Usamos la potencia de PostgREST para hacer el JOIN de las 3 tablas
    const { data, error } = await this.supabaseService.db('sesiones_juego')
      .select(`
        id,
        ingreso_at,
        salida_estimada_at,
        costo_base,
        minutos_extra,
        costo_extra,
        adultos_adicionales,
        tipologia,
        observaciones_tipologia,
        ninos (
          nombres_apellidos,
          tutores (
            nombres_apellidos,
            whatsapp,
            parentesco
          )
        )
      `)
      .or(`estado.eq.ACTIVO,and(estado.eq.FINALIZADO,salida_estimada_at.gte.${hace10Minutos})`);

    if (error) {
      console.error('Error al cargar las sesiones:', error);
      return;
    }

    // Mapeamos los datos de Supabase a nuestra interfaz visual de Angular
    if (data) {
      this.sesiones = data.map((item: any) => ({
        id: item.id,
        nombreNino: item.ninos?.nombres_apellidos || 'Desconocido',
        nombreTutor: item.ninos?.tutores?.nombres_apellidos || 'Desconocido',
        parentescoTutor: item.ninos?.tutores?.parentesco || '',
        whatsapp: item.ninos?.tutores?.whatsapp || '',
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
      }));

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
        (payload) => {
          console.log('¡Cambio detectado en la base de datos!', payload);
          // Si hay cualquier cambio (INSERT, UPDATE), recargamos la lista
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

      if (diffMs <= -600000) { // 10 minutos
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
  enviarWhatsApp(sesion: SesionJuego) {
    let mensaje = '';
    if (sesion.estadoAlerta === 'expirado') {
      mensaje = `Hola, te informamos que el tiempo de juego de *${sesion.nombreNino}* ha concluido. ¿Deseas extender el paquete? (Opciones de pago: transferencia o efectivo en caja).`;
    } else {
      mensaje = `Hola, te informamos que el tiempo de juego de *${sesion.nombreNino}* terminará en aproximadamente ${sesion.minutosRestantes} minutos. ¿Deseas extender el paquete?`;
    }

    const mensajeCodificado = encodeURIComponent(mensaje);
    const url = `https://wa.me/${sesion.whatsapp}?text=${mensajeCodificado}`;
    window.open(url, '_blank');
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

  // FINALIZAR SESIÓN Y OPCIONALMENTE REVERTIR TIEMPO EXTRA
  async retirarSesion(sesion: SesionJuego) {
    const confirmarFinalizar = await this.abrirDialogo(
      'Finalizar Sesión',
      `¿Estás seguro de finalizar la sesión y retirar a ${sesion.nombreNino}?`,
      'Sí, Finalizar',
      'Cancelar'
    );
    if (!confirmarFinalizar) return;

    let nuevosMinutosExtra = sesion.minutosExtra;
    let nuevoCostoExtra = sesion.costoExtra;
    let nuevaSalidaEstimada = sesion.horaSalidaEstimada;

    if (sesion.minutosExtra > 0) {
      const revertir = await this.abrirDialogo(
        'Tiempo Extra Agregado',
        `¿Se agregaron los últimos 30 minutos por equivocación?\n\nSi haces clic en "Revertir y Finalizar", se restarán 30 min y $${this.precioPaqueteExtra} del cobro antes de finalizar.\n\nSi haces clic en "Cobrar Total", se finalizará cobrando el total actual.`,
        'Revertir y Finalizar',
        'Cobrar Total'
      );
      if (revertir) {
        nuevosMinutosExtra = Math.max(0, sesion.minutosExtra - 30);
        nuevoCostoExtra = Math.max(0, sesion.costoExtra - this.precioPaqueteExtra);
        nuevaSalidaEstimada = new Date(sesion.horaSalidaEstimada.getTime() - 30 * 60000);
      }
    }

    const { error } = await this.supabaseService.db('sesiones_juego')
      .update({
        estado: 'FINALIZADO',
        minutos_extra: nuevosMinutosExtra,
        costo_extra: nuevoCostoExtra,
        salida_estimada_at: nuevaSalidaEstimada.toISOString()
      })
      .eq('id', sesion.id);

    if (error) {
      console.error('Error al finalizar sesión:', error);
      this.mostrarToast('Hubo un error al intentar finalizar la sesión.', 'error');
    } else {
      console.log('Sesión finalizada exitosamente.');
      this.mostrarToast('Sesión finalizada exitosamente.', 'success');
      this.cargarSesionesActivas();
    }
  }

  // 5. AGREGAR 30 MINUTOS A LA SESIÓN
  async agregarMediaHora(sesion: SesionJuego) {
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
    } else {
      console.log('Observaciones de tipología guardadas:', observaciones);
    }
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
