import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../../core/services/supabase/supabase';

interface VisitaDetalle {
  fecha: string;
  duracionMinutos: number;
}

interface MetricaNino {
  ninoId: string;
  nombreNino: string;
  totalVisitas: number;
  totalHorasAcumuladas: number;
  historialVisitas: VisitaDetalle[];
  diaFrecuente?: string;
  mostrarDetalle?: boolean; // Para expandir la fila en el HTML
}

@Component({
  selector: 'app-admin-ninos',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-ninos.html',
  styleUrl: './admin-ninos.css',
})
export class AdminNinos implements OnInit {
  private supabase = inject(SupabaseService);

  isLoading = true;
  fechaInicio: string = this.obtenerFechaHace(1);
  fechaFin: string = this.obtenerFechaHace(0);

  reporteNinos: MetricaNino[] = [];
  limiteMostrar = 10;
  
  totalNinosFiltro: number = 0;
  diaGeneralMasVisitado: string = '-';

  ngOnInit() {
    this.cargarHistorialNinos();
  }

  async cargarHistorialNinos() {
    this.isLoading = true;

    // Reiniciamos el límite al hacer una nueva búsqueda
    this.limiteMostrar = 10;

    // Consultamos las sesiones incluyendo el nombre del niño
    let query = this.supabase.from('sesiones_juego')
      .select(`
        ingreso_at,
        salida_estimada_at,
        nino_id,
        ninos (
          nombres_apellidos
        )
      `);

    if (this.fechaInicio) {
      query = query.gte('ingreso_at', `${this.fechaInicio}T00:00:00.000Z`);
    }
    if (this.fechaFin) {
      query = query.lte('ingreso_at', `${this.fechaFin}T23:59:59.999Z`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error al obtener historial:', error);
      this.isLoading = false;
      return;
    }

    if (data) {
      this.reporteNinos = this.procesarDatos(data);
    }

    this.isLoading = false;
  }

  cargarMas() {
    this.limiteMostrar += 10;
  }

  private procesarDatos(sesiones: any[]): MetricaNino[] {
    const mapaNinos: { [key: string]: MetricaNino } = {};
    const contadorDiasG: {[key: string]: number} = {};

    sesiones.forEach(sesion => {
      const ninoId = sesion.nino_id;
      if (!ninoId || !sesion.ninos) return;

      const nombreNino = sesion.ninos.nombres_apellidos;

      // Calcular duración de esta visita específica
      const ms = new Date(sesion.salida_estimada_at).getTime() - new Date(sesion.ingreso_at).getTime();
      const duracionMinutos = Math.max(0, Math.floor(ms / 60000));
      const dateObj = new Date(sesion.ingreso_at);
      const dateStr = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
      const fechaVisita = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

      const diaSemanaG = fechaVisita.split(',')[0];
      contadorDiasG[diaSemanaG] = (contadorDiasG[diaSemanaG] || 0) + 1;

      const detalle: VisitaDetalle = {
        fecha: fechaVisita,
        duracionMinutos
      };

      if (!mapaNinos[ninoId]) {
        mapaNinos[ninoId] = {
          ninoId,
          nombreNino,
          totalVisitas: 0,
          totalHorasAcumuladas: 0,
          historialVisitas: [],
          mostrarDetalle: false
        };
      }

      mapaNinos[ninoId].totalVisitas += 1;
      mapaNinos[ninoId].totalHorasAcumuladas += duracionMinutos / 60; // Convertir a horas
      mapaNinos[ninoId].historialVisitas.push(detalle);
    });

    // Convertir el mapa a un arreglo ordenado por los niños que más visitan el local
    const resultado = Object.values(mapaNinos).sort((a, b) => b.totalVisitas - a.totalVisitas);

    // Calcular el día más frecuente para cada niño
    resultado.forEach(nino => {
      const diasCount: {[key: string]: number} = {};
      let maxDias = 0;
      let diaFrecuente = '-';
      
      nino.historialVisitas.forEach(v => {
        const diaSemana = v.fecha.split(',')[0];
        diasCount[diaSemana] = (diasCount[diaSemana] || 0) + 1;
        if (diasCount[diaSemana] > maxDias) {
          maxDias = diasCount[diaSemana];
          diaFrecuente = diaSemana;
        }
      });
      nino.diaFrecuente = diaFrecuente;
    });

    // Calcular métricas generales
    let maxDiasG = 0;
    let diaGeneral = '-';
    for (const [dia, cantidad] of Object.entries(contadorDiasG)) {
      if (cantidad > maxDiasG) {
        maxDiasG = cantidad;
        diaGeneral = dia;
      }
    }
    
    this.totalNinosFiltro = Object.keys(mapaNinos).length;
    this.diaGeneralMasVisitado = diaGeneral;

    return resultado;
  }

  toggleDetalle(nino: MetricaNino) {
    nino.mostrarDetalle = !nino.mostrarDetalle;
  }

  obtenerFechaHace(dias: number): string {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    return d.toISOString().split('T')[0];
  }
}
