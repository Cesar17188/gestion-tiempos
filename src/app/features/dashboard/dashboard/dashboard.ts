import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { SupabaseService } from '../../../core/services/supabase/supabase';

// Interfaz para tipar los datos de la sesión
export interface SesionJuego {
  id: string;
  nombreNino: string;
  nombreTutor: string;
  whatsapp: string;
  horaIngreso: Date;
  horaSalidaEstimada: Date;
  minutosRestantes: number;
  estadoAlerta: 'normal' | 'advertencia' | 'expirado';
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, OnDestroy {

  // Inyectamos nuestro servicio real y el enrutador
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  sesiones: SesionJuego[] = [];
  userGreeting: string = 'Cargando...';
  private timerSubscription?: Subscription;
  private realtimeChannel: any;

  async ngOnInit() {
    await this.establecerSaludoPorRol();
    await this.cargarSesionesActivas();
    this.cdr.detectChanges(); // Forzamos actualización inicial al terminar la carga
    this.iniciarTemporizador();
    this.suscribirseCambiosEnVivo();
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

  // OBTENER ROL DEL USUARIO Y ESTABLECER SALUDO
  async establecerSaludoPorRol() {
    try {
      const { data: { user }, error: authError } = await this.supabaseService.supabase.auth.getUser();
      if (authError) throw authError;

      if (user) {
        const { data: perfil, error: profileError } = await this.supabaseService.supabase
          .from('perfiles')
          .select('rol')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;

        if (perfil) {
          const rolUsuario = perfil.rol?.toUpperCase();
          if (rolUsuario === 'ADMINISTRADOR') {
            this.userGreeting = 'Hola, Administrador';
          } else if (rolUsuario === 'ENCARGADO') {
            this.userGreeting = 'Hola, Encargado';
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
    // Usamos la potencia de PostgREST para hacer el JOIN de las 3 tablas
    const { data, error } = await this.supabaseService.db('sesiones_juego')
      .select(`
        id,
        ingreso_at,
        salida_estimada_at,
        ninos (
          nombres_apellidos,
          tutores (
            nombres_apellidos,
            whatsapp
          )
        )
      `)
      .eq('estado', 'ACTIVO'); // Solo traemos los que están jugando

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
        whatsapp: item.ninos?.tutores?.whatsapp || '',
        horaIngreso: new Date(item.ingreso_at),
        horaSalidaEstimada: new Date(item.salida_estimada_at),
        minutosRestantes: 0,
        estadoAlerta: 'normal'
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
    const ahora = new Date().getTime();

    this.sesiones.forEach(sesion => {
      const salida = sesion.horaSalidaEstimada.getTime();
      const diffMs = salida - ahora;

      const diffMins = Math.ceil(diffMs / 60000);
      sesion.minutosRestantes = diffMins;

      if (diffMins <= 0) {
        sesion.estadoAlerta = 'expirado';
      } else if (diffMins <= 5) {
        sesion.estadoAlerta = 'advertencia';
      } else {
        sesion.estadoAlerta = 'normal';
      }
    });
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
}
