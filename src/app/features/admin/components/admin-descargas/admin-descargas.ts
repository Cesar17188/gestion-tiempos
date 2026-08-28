import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SupabaseService } from '../../../../core/services/supabase/supabase';
import { ExportService } from '../../../../core/services/export/export';

@Component({
  selector: 'app-admin-descargas',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-descargas.html',
  styleUrl: './admin-descargas.css',
})
export class AdminDescargas implements OnInit {

  private readonly supabase = inject(SupabaseService);
  private readonly exportService = inject(ExportService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly fb = inject(FormBuilder);

  isLoading = true;
  baseCompletaAplanada: any[] = [];
  clientesUnicosAplanados: any[] = [];
  
  tipoReporte: 'sesiones' | 'clientes' = 'sesiones';
  terminoBusqueda: string = '';
  fechaInicio: string = '';
  fechaFin: string = '';

  // Variables para Modal de Edición de Sesión
  showEditModal = false;
  sesionEditando: any = null;
  isSavingEdit = false;
  editForm!: FormGroup;

  // Variables para Modal de Confirmación de Eliminación
  showDeleteModal = false;
  sesionAEliminar: any = null;
  isDeleting = false;

  // Variables para Toast Feedback
  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  // Columnas que se mostrarán en la vista previa y en el Excel final para Sesiones
  columnasExcel = [
    'ID_Sesion', 'Fecha_Ingreso', 'Hora_Ingreso', 'Dia_Semana', 'Hora_Salida_Estimada', 'Estado_Sesion',
    'Nino', 'Edad_Nino', 'Tutor_Responsable', 'Parentesco', 'Observaciones', 
    'Costo_Base', 'Minutos_Extra', 'Costo_Extra', 'Total_Pagado',
    'Registrado_Por', 'Tipologia', 'Observaciones_Tipologia', 'Requiere_Factura', 'Identificacion', 'Razon_Social',
    'Email_Factura', 'Estado_Factura', 'Clave_Acceso_SRI'
  ];

  // Columnas para el directorio de Niños Únicos (Clientes)
  columnasClientesExcel = [
    'Nino', 'Nombre_Preferido', 'Edad', 'Fecha_Nacimiento', 'Observaciones',
    'Tutores_Responsables', 'Telefonos_WhatsApp', 'Correos_Electronicos', 'Cedulas_Tutores',
    'Total_Visitas', 'Total_Gastado', 'Ultima_Visita', 'Primera_Visita'
  ];

  ngOnInit() {
    this.inicializarFormularioEdicion();

    const hoy = new Date();
    const mesPasado = new Date();
    mesPasado.setMonth(hoy.getMonth() - 1);

    this.fechaFin = hoy.toISOString().split('T')[0];
    this.fechaInicio = mesPasado.toISOString().split('T')[0];

    this.descargarDatosConsolidados();
  }

  inicializarFormularioEdicion() {
    this.editForm = this.fb.group({
      estado: ['FINALIZADO', Validators.required],
      ingreso_at: ['', Validators.required],
      salida_estimada_at: ['', Validators.required],
      costo_base: [7, [Validators.required, Validators.min(0)]],
      minutos_extra: [0, [Validators.required, Validators.min(0)]],
      costo_extra: [0, [Validators.required, Validators.min(0)]],
      adultos_adicionales: [0, [Validators.required, Validators.min(0)]],
      tipologia: [''],
      observaciones_tipologia: [''],
      nino_nombre: ['', Validators.required],
      nino_notas: [''],
      tutor_nombre: ['', Validators.required],
      tutor_parentesco: [''],
      tutor_whatsapp: [''],
      tutor_correo: ['']
    });
  }

  mostrarToast(mensaje: string, tipo: 'success' | 'error' = 'success') {
    this.toastMessage = mensaje;
    this.toastType = tipo;
    this.showToast = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.showToast = false;
      this.cdr.detectChanges();
    }, 3500);
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
      (c.Nino && c.Nino.toLowerCase().includes(q)) ||
      (c.Nombre_Preferido && c.Nombre_Preferido.toLowerCase().includes(q)) ||
      (c.Tutores_Responsables && c.Tutores_Responsables.toLowerCase().includes(q)) ||
      (c.Telefonos_WhatsApp && c.Telefonos_WhatsApp.toLowerCase().includes(q)) ||
      (c.Correos_Electronicos && c.Correos_Electronicos.toLowerCase().includes(q)) ||
      (c.Observaciones && c.Observaciones.toLowerCase().includes(q)) ||
      (c.Cedulas_Tutores && c.Cedulas_Tutores.toLowerCase().includes(q))
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
          id, ingreso_at, salida_estimada_at, estado, costo_base, minutos_extra, costo_extra, adultos_adicionales, tipologia, observaciones_tipologia,
          nino_id,
          ninos ( id, nombres_apellidos, fecha_nacimiento, notas, tutores ( id, nombres_apellidos, parentesco, whatsapp, correo, cedula ) ),
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
          const horaIngreso = ingresoDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
            Nino_Id: item.nino_id || item.ninos?.id,
            Tutor_Id: ultimoTutor?.id,
            Ingreso_ISO: item.ingreso_at,
            Salida_ISO: item.salida_estimada_at,
            Adultos_Adicionales: item.adultos_adicionales || 0,
            Tutor_Whatsapp: ultimoTutor?.whatsapp || '',
            Tutor_Correo: ultimoTutor?.correo || '',
            Tutor_Cedula: ultimoTutor?.cedula || '',
            Fecha_Ingreso: fechaIngreso,
            Hora_Ingreso: horaIngreso,
            Dia_Semana: diaSemana,
            Hora_Salida_Estimada: new Date(item.salida_estimada_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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

  // --- MÉTODOS DE EDICIÓN DE SESIÓN ---
  abrirModalEditar(fila: any) {
    this.sesionEditando = fila;
    this.editForm.patchValue({
      estado: fila.Estado_Sesion || 'FINALIZADO',
      ingreso_at: this.toDatetimeLocal(fila.Ingreso_ISO),
      salida_estimada_at: this.toDatetimeLocal(fila.Salida_ISO),
      costo_base: fila.Costo_Base ?? 7,
      minutos_extra: fila.Minutos_Extra ?? 0,
      costo_extra: fila.Costo_Extra ?? 0,
      adultos_adicionales: fila.Adultos_Adicionales ?? 0,
      tipologia: fila.Tipologia === '-' ? '' : fila.Tipologia,
      observaciones_tipologia: fila.Observaciones_Tipologia === '-' ? '' : fila.Observaciones_Tipologia,
      nino_nombre: fila.Nino === 'N/A' ? '' : fila.Nino,
      nino_notas: fila.Observaciones || '',
      tutor_nombre: fila.Tutor_Responsable === 'Desconocido' ? '' : fila.Tutor_Responsable,
      tutor_parentesco: fila.Parentesco === 'N/A' ? '' : fila.Parentesco,
      tutor_whatsapp: fila.Tutor_Whatsapp || '',
      tutor_correo: fila.Tutor_Correo || ''
    });
    this.showEditModal = true;
    this.cdr.detectChanges();
  }

  cerrarModalEditar() {
    this.showEditModal = false;
    this.sesionEditando = null;
    this.isSavingEdit = false;
    this.cdr.detectChanges();
  }

  async guardarEdicionSesion() {
    if (this.editForm.invalid || !this.sesionEditando) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.isSavingEdit = true;
    this.cdr.detectChanges();

    const val = this.editForm.value;
    const sesionId = this.sesionEditando.ID_Sesion;
    const ninoId = this.sesionEditando.Nino_Id;
    const tutorId = this.sesionEditando.Tutor_Id;

    try {
      // 1. Actualizar sesion_juego en Supabase
      const sesionPayload: any = {
        estado: val.estado,
        ingreso_at: new Date(val.ingreso_at).toISOString(),
        salida_estimada_at: new Date(val.salida_estimada_at).toISOString(),
        costo_base: Number(val.costo_base),
        minutos_extra: Number(val.minutos_extra),
        costo_extra: Number(val.costo_extra),
        adultos_adicionales: Number(val.adultos_adicionales),
        tipologia: val.tipologia ? val.tipologia.trim() : null,
        observaciones_tipologia: val.observaciones_tipologia ? val.observaciones_tipologia.trim() : null
      };

      const { error: sesionError } = await this.supabase.from('sesiones_juego')
        .update(sesionPayload)
        .eq('id', sesionId);

      if (sesionError) throw sesionError;

      // 2. Actualizar niño si aplica
      if (ninoId && val.nino_nombre) {
        await this.supabase.from('ninos')
          .update({
            nombres_apellidos: val.nino_nombre.trim(),
            notas: val.nino_notas ? val.nino_notas.trim() : ''
          })
          .eq('id', ninoId);
      }

      // 3. Actualizar tutor si aplica
      if (tutorId && val.tutor_nombre) {
        await this.supabase.from('tutores')
          .update({
            nombres_apellidos: val.tutor_nombre.trim(),
            parentesco: val.tutor_parentesco ? val.tutor_parentesco.trim() : '',
            whatsapp: val.tutor_whatsapp ? val.tutor_whatsapp.trim() : '',
            correo: val.tutor_correo ? val.tutor_correo.trim() : ''
          })
          .eq('id', tutorId);
      }

      this.mostrarToast('Registro de sesión actualizado exitosamente en Supabase.', 'success');
      this.cerrarModalEditar();
      await this.descargarDatosConsolidados();

    } catch (err: any) {
      console.error('Error al actualizar sesión:', err);
      this.mostrarToast(err?.message || 'Error al actualizar el registro en Supabase.', 'error');
    } finally {
      this.isSavingEdit = false;
      this.cdr.detectChanges();
    }
  }

  // --- MÉTODOS DE ELIMINACIÓN DE SESIÓN ---
  confirmarEliminarSesion(fila: any) {
    this.sesionAEliminar = fila;
    this.showDeleteModal = true;
    this.cdr.detectChanges();
  }

  cerrarModalEliminar() {
    this.showDeleteModal = false;
    this.sesionAEliminar = null;
    this.isDeleting = false;
    this.cdr.detectChanges();
  }

  async ejecutarEliminacionSesion() {
    if (!this.sesionAEliminar) return;

    this.isDeleting = true;
    this.cdr.detectChanges();

    const sesionId = this.sesionAEliminar.ID_Sesion;

    try {
      const { data, error } = await this.supabase.from('sesiones_juego')
        .delete()
        .eq('id', sesionId)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error('No se pudo eliminar el registro. La política de seguridad (RLS) en Supabase para DELETE en la tabla "sesiones_juego" no está habilitada o denegó el permiso.');
      }

      this.mostrarToast('Sesión de juego eliminada permanentemente de la base de datos.', 'success');
      this.cerrarModalEliminar();
      await this.descargarDatosConsolidados();
    } catch (err: any) {
      console.error('Error al eliminar sesión:', err);
      this.mostrarToast(err?.message || 'Error al eliminar la sesión de la base de datos.', 'error');
    } finally {
      this.isDeleting = false;
      this.cdr.detectChanges();
    }
  }

  private toDatetimeLocal(isoOrDate: string | Date | null | undefined): string {
    if (!isoOrDate) return '';
    const d = new Date(isoOrDate);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  private async cargarClientesUnicos() {
    try {
      // 1. Obtener todos los niños registrados en Supabase
      const { data: ninosData, error: ninosError } = await this.supabase.from('ninos')
        .select('*');

      if (ninosError) {
        console.error('Error al cargar niños de Supabase:', ninosError);
      }

      // 2. Obtener todos los tutores registrados
      const { data: tutoresData, error: tutoresError } = await this.supabase.from('tutores')
        .select('*');

      if (tutoresError) {
        console.error('Error al cargar tutores de Supabase:', tutoresError);
      }

      const mapaTutores = new Map<string, any>();
      if (tutoresData) {
        tutoresData.forEach((t: any) => {
          if (t.id) mapaTutores.set(t.id, t);
        });
      }

      // 3. Obtener tabla intermedia ninos_tutores
      const { data: relacionesData, error: relError } = await this.supabase.from('ninos_tutores')
        .select('*');

      if (relError) {
        console.error('Error al cargar relaciones ninos_tutores:', relError);
      }

      const tutoresPorNino = new Map<string, any[]>();
      if (relacionesData) {
        relacionesData.forEach((r: any) => {
          if (!r.tutor_id || !r.nino_id) return;
          const tutor = mapaTutores.get(r.tutor_id);
          if (tutor) {
            if (!tutoresPorNino.has(r.nino_id)) {
              tutoresPorNino.set(r.nino_id, []);
            }
            const lista = tutoresPorNino.get(r.nino_id)!;
            if (!lista.some((t: any) => t.id === tutor.id)) {
              lista.push(tutor);
            }
          }
        });
      }

      // 4. Obtener sesiones de juego para calcular visitas y consumo total por niño
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

      if (ninosData && ninosData.length > 0) {
        ninosData.forEach((n: any) => {
          const tutoresArray = tutoresPorNino.get(n.id) || [];

          // Nombres de tutores con parentesco
          const nombresTutores = tutoresArray
            .map((t: any) => t.nombres_apellidos + (t.parentesco && t.parentesco !== '-' ? ` (${t.parentesco})` : ''))
            .filter(Boolean)
            .join(', ');

          // Teléfonos únicos de los adultos
          const telefonosTutores = [...new Set(
            tutoresArray.map((t: any) => (t.whatsapp || '').trim()).filter(Boolean)
          )].join(', ');

          // Correos únicos de los adultos
          const correosTutores = [...new Set(
            tutoresArray.map((t: any) => (t.correo || '').trim()).filter(Boolean)
          )].join(', ');

          // Cédulas únicas de los adultos
          const cedulasTutores = [...new Set(
            tutoresArray.map((t: any) => (t.cedula || '').trim()).filter(Boolean)
          )].join(', ');

          // Cálculo de edad del niño
          let edad = 'N/A';
          if (n.fecha_nacimiento) {
            const birthDate = new Date(n.fecha_nacimiento);
            const ageDifMs = Date.now() - birthDate.getTime();
            const ageDate = new Date(ageDifMs);
            edad = Math.abs(ageDate.getUTCFullYear() - 1970).toString();
          }

          const m = metricasPorNino.get(n.id);
          const totalVisitas = m ? m.visitas : 0;
          const totalGastado = m ? m.total : 0;
          const primeraFechaStr = m ? new Date(m.primera).toLocaleDateString() : (n.created_at ? new Date(n.created_at).toLocaleDateString() : '-');
          const ultimaFechaStr = m ? new Date(m.ultima).toLocaleDateString() : 'Sin visitas en período';

          clientesLista.push({
            ID_Nino: n.id,
            Nino: n.nombres_apellidos || 'Desconocido',
            Nombre_Preferido: n.alias || '-',
            Edad: edad,
            Fecha_Nacimiento: n.fecha_nacimiento ? new Date(n.fecha_nacimiento).toLocaleDateString() : 'N/A',
            Observaciones: n.notas || '-',
            Tutores_Responsables: nombresTutores || 'Sin tutor asignado',
            Telefonos_WhatsApp: telefonosTutores || 'Sin teléfono',
            Correos_Electronicos: correosTutores || 'Sin correo',
            Cedulas_Tutores: cedulasTutores || 'S/N',
            Total_Visitas: totalVisitas,
            Total_Gastado: totalGastado,
            Ultima_Visita: ultimaFechaStr,
            Primera_Visita: primeraFechaStr
          });
        });
      }

      this.clientesUnicosAplanados = clientesLista;
      console.log('Directorio único por niño cargado con éxito:', this.clientesUnicosAplanados.length);
    } catch (err) {
      console.error('Error general al procesar clientes únicos por niño:', err);
    }
  }

  ejecutarDescarga() {
    if (this.tipoReporte === 'sesiones') {
      this.exportService.exportarACsv('Base_Sesiones_Playroom', this.datosFiltradosSesiones, this.columnasExcel);
    } else {
      this.exportService.exportarACsv('Directorio_Ninos_Clientes_Unicos', this.datosFiltradosClientes, this.columnasClientesExcel);
    }
  }

}
