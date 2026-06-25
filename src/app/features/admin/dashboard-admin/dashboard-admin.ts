import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router'; // Para el botón de volver
import { SupabaseService } from '../../../core/services/supabase/supabase';

// Importamos los 3 hijos
import { AdminMetricas } from '../components/admin-metricas/admin-metricas';
import { AdminFiltros } from '../components/admin-filtros/admin-filtros';
import { AdminTabla } from '../components/admin-tabla/admin-tabla';
import { AdminNinos } from '../components/admin-ninos/admin-ninos';
import { AdminConfig } from '../components/admin-config/admin-config';
import { AdminDescargas } from '../components/admin-descargas/admin-descargas';

@Component({
  selector: 'app-dashboard-admin',
  imports: [CommonModule, RouterModule, AdminMetricas, AdminFiltros, AdminTabla, AdminNinos, AdminConfig, AdminDescargas],
  templateUrl: './dashboard-admin.html',
  styleUrl: './dashboard-admin.css',
})
export class DashboardAdmin implements OnInit {
  private supabase = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);

  isLoading = true;
  fechaInicio: string = '';
  fechaFin: string = '';
  encargadoFiltro: string = 'TODOS';
  pestanaActiva: 'general' | 'ninos' | 'config' | 'descargas' = 'general';

  listaEncargados: any[] = [];
  totalRecaudado: number = 0;
  totalNinos: number = 0;
  totalMinutosJugados: number = 0;
  diaMasConcurrido: { fecha: string, cantidad: number } = { fecha: '-', cantidad: 0 };
  metricasEncargados: any[] = [];

  async ngOnInit() {
    const hoy = new Date();
    const hace7Dias = new Date();
    hace7Dias.setDate(hoy.getDate() - 7);

    this.fechaFin = hoy.toISOString().split('T')[0];
    this.fechaInicio = hace7Dias.toISOString().split('T')[0];

    await this.cargarEncargados();
    await this.procesarDashboard();
  }

  // Se ejecuta cuando el hijo "app-admin-filtros" emite el evento
  async actualizarFiltros(filtros: { inicio: string, fin: string, encargado: string }) {
    this.fechaInicio = filtros.inicio;
    this.fechaFin = filtros.fin;
    this.encargadoFiltro = filtros.encargado;
    await this.procesarDashboard();
  }

  // --- El resto del código de cálculo se mantiene intacto ---
  async cargarEncargados() {
    const { data } = await this.supabase.db('perfiles').select('id, nombre, rol');
    if (data) this.listaEncargados = data;
  }

  async procesarDashboard() {
    this.isLoading = true;
    try {
      let query = this.supabase.db('sesiones_juego')
        .select(`id, costo_base, costo_extra, minutos_extra, ingreso_at, salida_estimada_at, encargado_id, perfiles(nombre)`);

      if (this.fechaInicio) {
        query = query.gte('ingreso_at', `${this.fechaInicio}T00:00:00.000Z`);
      }
      if (this.fechaFin) {
        query = query.lte('ingreso_at', `${this.fechaFin}T23:59:59.999Z`);
      }
      if (this.encargadoFiltro !== 'TODOS') {
        query = query.eq('encargado_id', this.encargadoFiltro);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error al obtener datos del dashboard:', error);
      } else if (data) {
        this.calcularMetricas(data);
      }
    } catch (err) {
      console.error('Error inesperado procesando dashboard:', err);
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges(); // Forzamos la actualización de la UI
    }
  }

  calcularMetricas(datos: any[]) {
    // La misma lógica de cálculo que hicimos en el paso anterior
    this.totalRecaudado = 0;
    this.totalNinos = datos.length;
    this.totalMinutosJugados = 0;
    const contadorDias: any = {};
    const statsEncargados: any = {};

    datos.forEach(sesion => {
      this.totalRecaudado += Number(sesion.costo_base) + Number(sesion.costo_extra);
      const ms = new Date(sesion.salida_estimada_at).getTime() - new Date(sesion.ingreso_at).getTime();
      this.totalMinutosJugados += Math.floor(ms / 60000);

      const dateObj = new Date(sesion.ingreso_at);
      const dateStr = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
      const dia = dateStr.charAt(0).toUpperCase() + dateStr.slice(1); // ej: "Lunes, 19/10/2026"
      contadorDias[dia] = (contadorDias[dia] || 0) + 1;

      const empId = sesion.encargado_id || 'SIN_ASIGNAR';

      if (!statsEncargados[empId]) {
        statsEncargados[empId] = {
          nombre: sesion.perfiles?.nombre || 'Desconocido',
          ninosIngresados: 0,
          recaudado: 0,
          primeraSesion: new Date(sesion.ingreso_at),
          ultimaSesion: new Date(sesion.salida_estimada_at)
        };
      }
      statsEncargados[empId].ninosIngresados += 1;
      statsEncargados[empId].recaudado += Number(sesion.costo_base) + Number(sesion.costo_extra);
      const f = new Date(sesion.ingreso_at);
      if (f < statsEncargados[empId].primeraSesion) statsEncargados[empId].primeraSesion = f;
      if (f > statsEncargados[empId].ultimaSesion) statsEncargados[empId].ultimaSesion = f;
    });

    let maxNinos = 0;
    let mejorDia = '-';
    for (const [dia, cantidad] of Object.entries(contadorDias)) {
      if ((cantidad as number) > maxNinos) {
        maxNinos = cantidad as number; mejorDia = dia;
      }
    }
    this.diaMasConcurrido = { fecha: mejorDia, cantidad: maxNinos };
    this.metricasEncargados = Object.values(statsEncargados);
  }

  obtenerFechaHace(dias: number): string {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    return d.toISOString().split('T')[0];
  }
}
