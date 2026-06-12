import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { interval, Subscription } from 'rxjs';
import { Router } from '@angular/router';
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
  sesiones: SesionJuego[] = [];
  private timerSubscription?: Subscription;

  constructor(
    private router: Router,
    private supabaseService: SupabaseService
  ) {}

  ngOnInit() {
    this.cargarDatosSimulados();
    this.iniciarTemporizador();
  }

  ngOnDestroy() {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
  }

  // Simulamos datos que vendrían de Supabase
  cargarDatosSimulados() {
    const ahora = new Date();

    const salida1 = new Date(ahora.getTime() + 25 * 60000); // Faltan 25 mins
    const salida2 = new Date(ahora.getTime() + 4 * 60000);  // Faltan 4 mins
    const salida3 = new Date(ahora.getTime() - 2 * 60000);  // Pasó hace 2 mins

    this.sesiones = [
      {
        id: '1',
        nombreNino: 'Mateo Rodríguez',
        nombreTutor: 'Laura Sánchez (Mamá)',
        whatsapp: '593991234567',
        horaIngreso: new Date(ahora.getTime() - 5 * 60000),
        horaSalidaEstimada: salida1,
        minutosRestantes: 0,
        estadoAlerta: 'normal'
      },
      {
        id: '2',
        nombreNino: 'Sofía Castro',
        nombreTutor: 'Carlos Castro (Papá)',
        whatsapp: '593987654321',
        horaIngreso: new Date(ahora.getTime() - 26 * 60000),
        horaSalidaEstimada: salida2,
        minutosRestantes: 0,
        estadoAlerta: 'normal'
      },
      {
        id: '3',
        nombreNino: 'Lucas Mendoza',
        nombreTutor: 'Elena Ruiz (Tía)',
        whatsapp: '593999888777',
        horaIngreso: new Date(ahora.getTime() - 32 * 60000),
        horaSalidaEstimada: salida3,
        minutosRestantes: 0,
        estadoAlerta: 'normal'
      }
    ];

    this.actualizarTiempos();
  }

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

  enviarWhatsApp(sesion: SesionJuego) {
    let mensaje = '';

    if (sesion.estadoAlerta === 'expirado') {
      mensaje = `Hola, te informamos que el tiempo de juego de *${sesion.nombreNino}* ha concluido. ¿Deseas extender el paquete? (Opciones de pago: transferencia o efectivo en caja).`;
    } else {
      mensaje = `Hola, te informamos que el tiempo de juego de *${sesion.nombreNino}* terminará en aproximadamente ${sesion.minutosRestantes} minutos. ¿Deseas extender el paquete?`;
    }

    const mensajeCodificado = encodeURIComponent(mensaje);
    const url = `https://wa.me/${sesion.whatsapp}?text=${mensajeCodificado}`;

    // Abre WhatsApp Web en una nueva pestaña
    window.open(url, '_blank');
  }

  async cerrarSesion() {
    try {
      await this.supabaseService.auth.signOut();
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }
}
