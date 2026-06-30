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
  
  fechaInicio: string = '';
  fechaFin: string = '';

  // Columnas que se mostrarán en la vista previa y en el Excel final
  columnasExcel = [
    'ID_Sesion', 'Fecha_Ingreso', 'Hora_Ingreso', 'Dia_Semana', 'Hora_Salida_Estimada', 'Estado_Sesion',
    'Nino', 'Edad_Nino', 'Tutor_Responsable', 'Parentesco', 'Observaciones', 
    'Costo_Base', 'Minutos_Extra', 'Costo_Extra', 'Total_Pagado',
    'Registrado_Por', 'Tipologia', 'Observaciones_Tipologia', 'Requiere_Factura', 'Identificacion', 'Razon_Social',
    'Email_Factura', 'Estado_Factura', 'Clave_Acceso_SRI'
  ];

  ngOnInit() {
    const hoy = new Date();
    const mesPasado = new Date();
    mesPasado.setMonth(hoy.getMonth() - 1);

    this.fechaFin = hoy.toISOString().split('T')[0];
    this.fechaInicio = mesPasado.toISOString().split('T')[0];

    this.descargarDatosConsolidados();
  }

  async descargarDatosConsolidados() {
    this.isLoading = true;

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
      console.error('Supabase Error:', error);
    }

    if (!error && data) {
      // Proceso de aplanamiento de objetos anidados de base de datos a columnas planas
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

        const nombreTutor = item.ninos?.tutores?.nombres_apellidos || 'Desconocido';
        const parentescoTutor = item.ninos?.tutores?.parentesco || 'N/A';
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

    this.isLoading = false;
    this.cdr.detectChanges();
  }

  ejecutarDescarga() {
    this.exportService.exportarACsv('Base_Maestra_Playroom', this.baseCompletaAplanada, this.columnasExcel);
  }

}
