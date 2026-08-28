import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../../core/services/supabase/supabase';
import { ExportService } from '../../../../core/services/export/export';

@Component({
  selector: 'app-admin-descargas',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-descargas.html',
  styleUrl: './admin-descargas.css',
})
export class AdminDescargas implements OnInit {

  private readonly supabase = inject(SupabaseService);
  private readonly exportService = inject(ExportService);
  private readonly cdr = inject(ChangeDetectorRef);

  isLoading = true;
  baseCompletaAplanada: any[] = [];
  clientesUnicosAplanados: any[] = [];
  
  tipoReporte: 'sesiones' | 'clientes' = 'sesiones';
  terminoBusqueda: string = '';
  fechaInicio: string = '';
  fechaFin: string = '';

  // Columnas que se mostrarán en la vista previa y en el Excel final para Sesiones
  columnasExcel = [
    'ID_Sesion', 'Fecha_Ingreso', 'Hora_Ingreso', 'Dia_Semana', 'Hora_Salida_Estimada', 'Estado_Sesion',
    'Nino', 'Edad_Nino', 'Tutor_Responsable', 'Parentesco', 'Observaciones', 
    'Costo_Base', 'Minutos_Extra', 'Costo_Extra', 'Total_Pagado',
    'Registrado_Por', 'Tipologia', 'Observaciones_Tipologia', 'Requiere_Factura', 'Identificacion', 'Razon_Social',
    'Email_Factura', 'Estado_Factura', 'Clave_Acceso_SRI'
  ];

  // Columnas para el directorio de Clientes Únicos (Tutores)
  columnasClientesExcel = [
    'Cedula', 'Nombres_Apellidos', 'Nombre_Preferido', 'Parentesco', 'WhatsApp', 'Correo',
    'Ninos_Asociados', 'Total_Visitas', 'Total_Gastado', 'Ultima_Visita', 'Primera_Visita'
  ];

  ngOnInit() {
    const hoy = new Date();
    const mesPasado = new Date();
    mesPasado.setMonth(hoy.getMonth() - 1);

    this.fechaFin = hoy.toISOString().split('T')[0];
    this.fechaInicio = mesPasado.toISOString().split('T')[0];

    this.descargarDatosConsolidados();
  }

  cambiarTipoReporte(tipo: 'sesiones' | 'clientes') {
    this.tipoReporte = tipo;
    this.cdr.detectChanges();
  }

  get datosFiltradosSesiones(): any[] {
    if (!this.terminoBusqueda || !this.terminoBusqueda.trim()) {
      return this.baseCompletaAplanada;
    }
    const q = this.terminoBusqueda.toLowerCase().trim();
    return this.baseCompletaAplanada.filter(f =>
      (f.Nino && f.Nino.toLowerCase().includes(q)) ||
      (f.Tutor_Responsable && f.Tutor_Responsable.toLowerCase().includes(q)) ||
      (f.Identificacion && f.Identificacion.toLowerCase().includes(q)) ||
      (f.Razon_Social && f.Razon_Social.toLowerCase().includes(q)) ||
      (f.Tipologia && f.Tipologia.toLowerCase().includes(q)) ||
      (f.ID_Sesion && f.ID_Sesion.toLowerCase().includes(q))
    );
  }

  get datosFiltradosClientes(): any[] {
    if (!this.terminoBusqueda || !this.terminoBusqueda.trim()) {
      return this.clientesUnicosAplanados;
    }
    const q = this.terminoBusqueda.toLowerCase().trim();
    return this.clientesUnicosAplanados.filter(c =>
      (c.Cedula && c.Cedula.toLowerCase().includes(q)) ||
      (c.Nombres_Apellidos && c.Nombres_Apellidos.toLowerCase().includes(q)) ||
      (c.Nombre_Preferido && c.Nombre_Preferido.toLowerCase().includes(q)) ||
      (c.WhatsApp && c.WhatsApp.toLowerCase().includes(q)) ||
      (c.Correo && c.Correo.toLowerCase().includes(q)) ||
      (c.Ninos_Asociados && c.Ninos_Asociados.toLowerCase().includes(q))
    );
  }

  async descargarDatosConsolidados() {
    this.isLoading = true;
    this.cdr.detectChanges();

    await Promise.all([
      this.cargarSesiones(),
      this.cargarClientesUnicos()
    ]);

    this.isLoading = false;
    this.cdr.detectChanges();
  }

  private async cargarSesiones() {
    try {
      // Consultamos absolutamente todo el histórico cruzando relaciones
      let query = this.supabase.from('sesiones_juego')
        .select(`
          id, ingreso_at, salida_estimada_at, estado, costo_base, minutos_extra, costo_extra, tipologia, observaciones_tipologia,
          ninos ( nombres_apellidos, fecha_nacimiento, notas, tutores ( nombres_apellidos, parentesco ) ),
          perfiles ( nombre )
        `)
        .order('ingreso_at', { ascending: false });

      if (this.fechaInicio) {
        query = query.gte('ingreso_at', `${this.fechaInicio}T00:00:00.000Z`);
      }
      
      if (this.fechaFin) {
        query = query.lte('ingreso_at', `${this.fechaFin}T23:59:59.999Z`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Supabase Error al cargar sesiones:', error);
        return;
      }

      if (data) {
        const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        
        this.baseCompletaAplanada = data.map((item: any) => {
          const ingresoDate = new Date(item.ingreso_at);
          const fechaIngreso = ingresoDate.toLocaleDateString();
          const horaIngreso = ingresoDate.toLocaleTimeString();
          const diaSemana = diasSemana[ingresoDate.getDay()];
          
          let edad = 'N/A';
          if (item.ninos?.fecha_nacimiento) {
            const birthDate = new Date(item.ninos.fecha_nacimiento);
            const ageDifMs = Date.now() - birthDate.getTime();
            const ageDate = new Date(ageDifMs);
            edad = Math.abs(ageDate.getUTCFullYear() - 1970).toString();
          }

          const tutoresArray = item.ninos?.tutores;
          const ultimoTutor = (Array.isArray(tutoresArray) && tutoresArray.length > 0) ? tutoresArray[tutoresArray.length - 1] : tutoresArray;

          const nombreTutor = ultimoTutor?.nombres_apellidos || 'Desconocido';
          const parentescoTutor = ultimoTutor?.parentesco || 'N/A';
          const observaciones = item.ninos?.notas || '';

          return {
            ID_Sesion: item.id,
            Fecha_Ingreso: fechaIngreso,
            Hora_Ingreso: horaIngreso,
            Dia_Semana: diaSemana,
            Hora_Salida_Estimada: new Date(item.salida_estimada_at).toLocaleTimeString(),
            Estado_Sesion: item.estado,
            Nino: item.ninos?.nombres_apellidos || 'N/A',
            Edad_Nino: edad,
            Tutor_Responsable: nombreTutor,
            Parentesco: parentescoTutor,
            Observaciones: observaciones,
            Costo_Base: item.costo_base,
            Minutos_Extra: item.minutos_extra,
            Costo_Extra: item.costo_extra,
            Total_Pagado: Number(item.costo_base) + Number(item.costo_extra),
            Registrado_Por: item.perfiles?.nombre || 'Desconocido',
            Tipologia: item.tipologia || '-',
            Observaciones_Tipologia: item.observaciones_tipologia || '-',
            Requiere_Factura: item.requiere_factura ? 'SI' : 'NO',
            Identificacion: item.identificacion || '',
            Razon_Social: item.razon_social || '',
            Email_Factura: item.email_facturacion || '',
            Estado_Factura: item.estado_factura,
            Clave_Acceso_SRI: item.clave_acceso_sri || ''
          };
        });
      }
    } catch (e) {
      console.error('Error al procesar sesiones:', e);
    }
  }

  private async cargarClientesUnicos() {
    try {
      // 1. Obtener todos los tutores registrados en Supabase usando select('*') para máxima compatibilidad
      const { data: tutoresData, error: tutoresError } = await this.supabase.from('tutores')
        .select('*');

      if (tutoresError) {
        console.error('Error al cargar tutores de Supabase:', tutoresError);
      }

      // 2. Obtener lista de niños registrados
      const { data: ninosData, error: ninosError } = await this.supabase.from('ninos')
        .select('*');

      if (ninosError) {
        console.error('Error al cargar niños de Supabase:', ninosError);
      }

      const mapaNinos = new Map<string, any>();
      if (ninosData) {
        ninosData.forEach((n: any) => {
          if (n.id) mapaNinos.set(n.id, n);
        });
      }

      // 3. Obtener tabla intermedia ninos_tutores
      const { data: relacionesData, error: relError } = await this.supabase.from('ninos_tutores')
        .select('*');

      if (relError) {
        console.error('Error al cargar relaciones ninos_tutores:', relError);
      }

      const ninosPorTutor = new Map<string, any[]>();
      if (relacionesData) {
        relacionesData.forEach((r: any) => {
          if (!r.tutor_id || !r.nino_id) return;
          const nino = mapaNinos.get(r.nino_id);
          if (nino) {
            if (!ninosPorTutor.has(r.tutor_id)) {
              ninosPorTutor.set(r.tutor_id, []);
            }
            ninosPorTutor.get(r.tutor_id)!.push(nino);
          }
        });
      }

      // 4. Obtener sesiones de juego para calcular visitas y consumo total
      let sesionQuery = this.supabase.from('sesiones_juego')
        .select('id, ingreso_at, nino_id, costo_base, costo_extra');

      if (this.fechaInicio) {
        sesionQuery = sesionQuery.gte('ingreso_at', `${this.fechaInicio}T00:00:00.000Z`);
      }
      if (this.fechaFin) {
        sesionQuery = sesionQuery.lte('ingreso_at', `${this.fechaFin}T23:59:59.999Z`);
      }

      const { data: sesionesData } = await sesionQuery;

      const metricasPorNino = new Map<string, { visitas: number; total: number; primera: string; ultima: string }>();

      if (sesionesData) {
        sesionesData.forEach((s: any) => {
          if (!s.nino_id) return;
          const nId = s.nino_id;
          const costo = (Number(s.costo_base) || 0) + (Number(s.costo_extra) || 0);
          const fechaIngreso = s.ingreso_at;

          if (!metricasPorNino.has(nId)) {
            metricasPorNino.set(nId, {
              visitas: 1,
              total: costo,
              primera: fechaIngreso,
              ultima: fechaIngreso
            });
          } else {
            const m = metricasPorNino.get(nId)!;
            m.visitas += 1;
            m.total += costo;
            if (new Date(fechaIngreso) < new Date(m.primera)) m.primera = fechaIngreso;
            if (new Date(fechaIngreso) > new Date(m.ultima)) m.ultima = fechaIngreso;
          }
        });
      }

      const clientesLista: any[] = [];

      if (tutoresData && tutoresData.length > 0) {
        tutoresData.forEach((t: any) => {
          const ninosArray = ninosPorTutor.get(t.id) || [];
          const nombresNinos = ninosArray
            .map((n: any) => n.nombres_apellidos + (n.alias ? ` (${n.alias})` : ''))
            .filter(Boolean)
            .join(', ');

          let totalVisitas = 0;
          let totalGastado = 0;
          let minDate: Date | null = t.created_at ? new Date(t.created_at) : null;
          let maxDate: Date | null = null;

          for (const n of ninosArray) {
            const m = metricasPorNino.get(n.id);
            if (m) {
              totalVisitas += m.visitas;
              totalGastado += m.total;
              const pDate = new Date(m.primera);
              const uDate = new Date(m.ultima);
              if (!minDate || pDate < minDate) minDate = pDate;
              if (!maxDate || uDate > maxDate) maxDate = uDate;
            }
          }

          const primeraFechaStr = minDate ? minDate.toLocaleDateString() : '-';
          const ultimaFechaStr = maxDate ? maxDate.toLocaleDateString() : 'Sin visitas en período';

          clientesLista.push({
            ID_Tutor: t.id,
            Cedula: t.cedula || 'S/N',
            Nombres_Apellidos: t.nombres_apellidos || 'Desconocido',
            Nombre_Preferido: t.alias || '-',
            Parentesco: t.parentesco || '-',
            WhatsApp: t.whatsapp || '-',
            Correo: t.correo || '-',
            Ninos_Asociados: nombresNinos || 'Sin niños registrados',
            Total_Visitas: totalVisitas,
            Total_Gastado: totalGastado,
            Ultima_Visita: ultimaFechaStr,
            Primera_Visita: primeraFechaStr
          });
        });
      }

      this.clientesUnicosAplanados = clientesLista;
      console.log('Clientes únicos cargados con éxito:', this.clientesUnicosAplanados.length);
    } catch (err) {
      console.error('Error general al procesar clientes únicos:', err);
    }
  }

  ejecutarDescarga() {
    if (this.tipoReporte === 'sesiones') {
      this.exportService.exportarACsv('Base_Sesiones_Playroom', this.datosFiltradosSesiones, this.columnasExcel);
    } else {
      this.exportService.exportarACsv('Directorio_Clientes_Unicos', this.datosFiltradosClientes, this.columnasClientesExcel);
    }
  }

}
