import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SupabaseService } from '../../../../core/services/supabase/supabase';
import {
  validarCorreo,
  validarTelefono,
  validarCedulaOPasaporte,
  normalizarTelefono,
  sanitizarTexto,
  sanitizarCorreo
} from '../../../../core/validators/custom-validators';

export interface NinoResumen {
  id: string;
  nombres_apellidos: string;
  alias?: string;
  fecha_nacimiento?: string;
  edad: string;
  codigo_especifico?: string;
  notas?: string;
}

export interface TutorConNinos {
  id: string;
  nombres_apellidos: string;
  cedula: string;
  alias?: string;
  parentesco?: string;
  sector?: string;
  whatsapp?: string;
  correo?: string;
  contacto_adicional_nombre?: string;
  tipo_pase?: string;
  observaciones_tipo_pase?: string;
  ninosRegistrados: NinoResumen[];
}

export interface SesionConTutor {
  sesionId: string;
  fechaIngreso: string;
  horaIngreso: string;
  ingresoIso: string;
  estado: string;
  tutorId?: string;
  tutorNombre: string;
  tutorParentesco: string;
  tutorCedula?: string;
}

export interface NinoConSesionesYTutores {
  id: string;
  nombres_apellidos: string;
  alias?: string;
  fecha_nacimiento?: string;
  edad: string;
  codigo_especifico?: string;
  notas?: string;
  tutoresRegistrados: TutorConNinos[];
  sesionesHistorial: SesionConTutor[];
  mostrarTodasSesiones?: boolean;
}

@Component({
  selector: 'app-admin-directorio',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './admin-directorio.html',
  styleUrl: './admin-directorio.css'
})
export class AdminDirectorio implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly fb = inject(FormBuilder);

  isLoading = true;
  vistaActiva: 'ambas' | 'tutores' | 'ninos' = 'ambas';
  terminoBusquedaTutor = '';
  terminoBusquedaNino = '';

  listaTutoresConNinos: TutorConNinos[] = [];
  listaNinosConSesiones: NinoConSesionesYTutores[] = [];

  // Modal Editar Adulto Responsable
  showEditTutorModal = false;
  tutorEditando: TutorConNinos | null = null;
  isSavingTutor = false;
  tutorForm: FormGroup = this.fb.group({
    nombres_apellidos: ['', [Validators.required, Validators.minLength(4)]],
    cedula: ['', [Validators.required, Validators.maxLength(25), validarCedulaOPasaporte()]],
    alias: [''],
    parentesco: ['', [Validators.required]],
    sector: [''],
    whatsapp: ['', [Validators.required, validarTelefono()]],
    correo: ['', [validarCorreo()]],
    contacto_adicional_nombre: [''],
    tipo_pase: [''],
    observaciones_tipo_pase: ['']
  });

  // Modal Eliminar Adulto Responsable
  showDeleteTutorModal = false;
  tutorAEliminar: TutorConNinos | null = null;
  eliminarTambienNinosDeTutor = false;
  isDeletingTutor = false;

  // Modal Editar Niño
  showEditNinoModal = false;
  ninoEditando: NinoResumen | NinoConSesionesYTutores | null = null;
  isSavingNino = false;
  ninoForm: FormGroup = this.fb.group({
    nombres_apellidos: ['', [Validators.required, Validators.minLength(3)]],
    alias: [''],
    fecha_nacimiento: ['', [Validators.required]],
    codigo_especifico: [''],
    notas: ['']
  });

  // Modal Eliminar Niño
  showDeleteNinoModal = false;
  ninoAEliminar: NinoResumen | NinoConSesionesYTutores | null = null;
  eliminarTambienTutorDeNino = false;
  isDeletingNino = false;

  // Modal Añadir Niño a un Adulto Responsable
  showAddNinoATutorModal = false;
  tutorParaNuevoNino: TutorConNinos | null = null;
  isSavingNuevoNino = false;
  isSearchingNinoExistente = false;
  resultadosBusquedaNinoModal: any[] = [];
  ninoExistenteSeleccionadoId: string | null = null;
  nuevoNinoForm: FormGroup = this.fb.group({
    nombres_apellidos: ['', [Validators.required, Validators.minLength(3)]],
    alias: [''],
    fecha_nacimiento: ['', [Validators.required]],
    codigo_especifico: [this.generarCodigoNino()],
    notas: ['']
  });

  // Modal Añadir Adulto Responsable a un Niño
  showAddTutorANinoModal = false;
  ninoParaNuevoTutor: NinoConSesionesYTutores | null = null;
  isSavingNuevoTutor = false;
  isSearchingTutorExistente = false;
  mensajeBusquedaTutorModal = '';
  tutorExistenteSeleccionadoId: string | null = null;
  nuevoTutorForm: FormGroup = this.fb.group({
    cedula: ['', [Validators.required, Validators.maxLength(25), validarCedulaOPasaporte()]],
    nombres_apellidos: ['', [Validators.required, Validators.minLength(4)]],
    alias: [''],
    parentesco: ['', [Validators.required]],
    sector: [''],
    whatsapp: ['', [Validators.required, validarTelefono()]],
    correo: ['', [validarCorreo()]],
    contacto_adicional_nombre: [''],
    tipo_pase: [''],
    observaciones_tipo_pase: ['']
  });

  // Toast de notificaciones
  showToast = false;
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  async ngOnInit() {
    await this.cargarDirectorioCompleto();
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

  cambiarVista(vista: 'ambas' | 'tutores' | 'ninos') {
    this.vistaActiva = vista;
    this.cdr.detectChanges();
  }

  get tutoresFiltrados(): TutorConNinos[] {
    if (!this.terminoBusquedaTutor || !this.terminoBusquedaTutor.trim()) {
      return this.listaTutoresConNinos;
    }
    const q = this.terminoBusquedaTutor.toLowerCase().trim();
    return this.listaTutoresConNinos.filter(t =>
      (t.nombres_apellidos && t.nombres_apellidos.toLowerCase().includes(q)) ||
      (t.cedula && t.cedula.toLowerCase().includes(q)) ||
      (t.whatsapp && t.whatsapp.toLowerCase().includes(q)) ||
      (t.correo && t.correo.toLowerCase().includes(q)) ||
      (t.sector && t.sector.toLowerCase().includes(q)) ||
      t.ninosRegistrados.some(n => n.nombres_apellidos.toLowerCase().includes(q))
    );
  }

  get ninosFiltrados(): NinoConSesionesYTutores[] {
    if (!this.terminoBusquedaNino || !this.terminoBusquedaNino.trim()) {
      return this.listaNinosConSesiones;
    }
    const q = this.terminoBusquedaNino.toLowerCase().trim();
    return this.listaNinosConSesiones.filter(n =>
      (n.nombres_apellidos && n.nombres_apellidos.toLowerCase().includes(q)) ||
      (n.alias && n.alias.toLowerCase().includes(q)) ||
      (n.codigo_especifico && n.codigo_especifico.toLowerCase().includes(q)) ||
      n.tutoresRegistrados.some(t => t.nombres_apellidos.toLowerCase().includes(q) || (t.cedula && t.cedula.toLowerCase().includes(q))) ||
      n.sesionesHistorial.some(s => s.tutorNombre.toLowerCase().includes(q))
    );
  }

  private calcularEdad(fechaNacimiento?: string): string {
    if (!fechaNacimiento) return 'N/A';
    const birthDate = new Date(fechaNacimiento);
    if (isNaN(birthDate.getTime())) return 'N/A';
    const ageDifMs = Date.now() - birthDate.getTime();
    const ageDate = new Date(ageDifMs);
    return `${Math.abs(ageDate.getUTCFullYear() - 1970)} años`;
  }

  async cargarDirectorioCompleto() {
    this.isLoading = true;

    try {
      const [
        { data: tutoresData, error: tutoresErr },
        { data: ninosData, error: ninosErr },
        { data: relacionesData, error: relErr },
        { data: sesionesData, error: sesionesErr }
      ] = await Promise.all([
        this.supabase.db('tutores').select('*').order('nombres_apellidos', { ascending: true }),
        this.supabase.db('ninos').select('*').order('nombres_apellidos', { ascending: true }),
        this.supabase.db('ninos_tutores').select('*'),
        this.supabase.db('sesiones_juego').select('*').order('ingreso_at', { ascending: false })
      ]);

      if (tutoresErr) console.error('Error al cargar tutores:', tutoresErr);
      if (ninosErr) console.error('Error al cargar niños:', ninosErr);
      if (relErr) console.error('Error al cargar relaciones ninos_tutores:', relErr);
      if (sesionesErr) console.error('Error al cargar sesiones:', sesionesErr);

      const tutoresArr = Array.isArray(tutoresData) ? tutoresData : [];
      const ninosArr = Array.isArray(ninosData) ? ninosData : [];
      const relacionesArr = Array.isArray(relacionesData) ? relacionesData : [];
      const sesionesArr = Array.isArray(sesionesData) ? sesionesData : [];

      let tutorSesionMap: Record<string, string> = {};
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const rawMap = localStorage.getItem('vp_sesion_tutor_map');
          if (rawMap) tutorSesionMap = JSON.parse(rawMap);
        } catch (e) {
          // Ignorar
        }
      }

      const mapaTutores = new Map<string, any>();
      tutoresArr.forEach(t => {
        if (t?.id) mapaTutores.set(t.id, t);
      });

      const mapaNinos = new Map<string, NinoResumen>();
      ninosArr.forEach(n => {
        if (n?.id) {
          mapaNinos.set(n.id, {
            id: n.id,
            nombres_apellidos: n.nombres_apellidos || 'Sin nombre',
            alias: n.alias || '',
            fecha_nacimiento: n.fecha_nacimiento ? String(n.fecha_nacimiento).split('T')[0] : '',
            edad: this.calcularEdad(n.fecha_nacimiento),
            codigo_especifico: n.codigo_especifico || '',
            notas: n.notas || ''
          });
        }
      });

      // Mapas de relaciones muchos-a-muchos
      const ninosPorTutor = new Map<string, NinoResumen[]>();
      const tutoresPorNino = new Map<string, any[]>();

      relacionesArr.forEach((rel: any) => {
        if (!rel?.tutor_id || !rel?.nino_id) return;
        const ninoObj = mapaNinos.get(rel.nino_id);
        const tutorObj = mapaTutores.get(rel.tutor_id);

        if (ninoObj) {
          if (!ninosPorTutor.has(rel.tutor_id)) {
            ninosPorTutor.set(rel.tutor_id, []);
          }
          const listaN = ninosPorTutor.get(rel.tutor_id)!;
          if (!listaN.some(x => x.id === ninoObj.id)) {
            listaN.push(ninoObj);
          }
        }

        if (tutorObj) {
          if (!tutoresPorNino.has(rel.nino_id)) {
            tutoresPorNino.set(rel.nino_id, []);
          }
          const listaT = tutoresPorNino.get(rel.nino_id)!;
          if (!listaT.some(x => x.id === tutorObj.id)) {
            listaT.push(tutorObj);
          }
        }
      });

      // También asegurar relaciones a partir de sesiones con tutor_id explícito
      sesionesArr.forEach((s: any) => {
        const tId = s.tutor_id || tutorSesionMap[s.id];
        const nId = s.nino_id;
        if (!tId || !nId) return;
        const ninoObj = mapaNinos.get(nId);
        const tutorObj = mapaTutores.get(tId);

        if (ninoObj) {
          if (!ninosPorTutor.has(tId)) ninosPorTutor.set(tId, []);
          const listaN = ninosPorTutor.get(tId)!;
          if (!listaN.some(x => x.id === ninoObj.id)) listaN.push(ninoObj);
        }
        if (tutorObj) {
          if (!tutoresPorNino.has(nId)) tutoresPorNino.set(nId, []);
          const listaT = tutoresPorNino.get(nId)!;
          if (!listaT.some(x => x.id === tutorObj.id)) listaT.push(tutorObj);
        }
      });

      // 1. Construir Tabla 1: Adultos Responsables y sus Niños
      this.listaTutoresConNinos = tutoresArr.map((t: any) => ({
        id: t.id,
        nombres_apellidos: t.nombres_apellidos || 'Sin nombre',
        cedula: t.cedula || '',
        alias: t.alias || '',
        parentesco: t.parentesco || '',
        sector: t.sector || '',
        whatsapp: t.whatsapp || '',
        correo: t.correo || '',
        contacto_adicional_nombre: t.contacto_adicional_nombre || '',
        tipo_pase: t.tipo_pase || '',
        observaciones_tipo_pase: t.observaciones_tipo_pase || '',
        ninosRegistrados: ninosPorTutor.get(t.id) || []
      }));

      // Ordenar sesiones cronológicamente por niño para resolver sesiones antiguas sin tutor_id
      const sesionesCronologicasPorNino = new Map<string, string[]>();
      [...sesionesArr]
        .sort((a: any, b: any) => new Date(a.ingreso_at).getTime() - new Date(b.ingreso_at).getTime())
        .forEach((s: any) => {
          if (!s?.nino_id) return;
          if (!sesionesCronologicasPorNino.has(s.nino_id)) {
            sesionesCronologicasPorNino.set(s.nino_id, []);
          }
          sesionesCronologicasPorNino.get(s.nino_id)!.push(s.id);
        });

      // Agrupar sesiones por niño con el adulto que lo trajo en cada sesión
      const sesionesPorNino = new Map<string, SesionConTutor[]>();
      sesionesArr.forEach((s: any) => {
        const nId = s.nino_id;
        if (!nId) return;

        const tutoresDelNino = tutoresPorNino.get(nId) || [];
        const tutorIdSesion = s.tutor_id || tutorSesionMap[s.id];
        let tutorDeLaSesion: any = null;

        if (tutorIdSesion) {
          tutorDeLaSesion = mapaTutores.get(tutorIdSesion) || tutoresDelNino.find((t: any) => t.id === tutorIdSesion);
        }

        if (!tutorDeLaSesion && tutoresDelNino.length > 0) {
          if (tutoresDelNino.length === 1) {
            tutorDeLaSesion = tutoresDelNino[0];
          } else {
            const limiteSesionMs = new Date(s.salida_estimada_at || s.ingreso_at).getTime() + 10 * 60000;
            const tutoresConFecha = tutoresDelNino.filter((t: any) => t.created_at && !isNaN(new Date(t.created_at).getTime()));

            if (tutoresConFecha.length > 0) {
              const candidatos = tutoresConFecha
                .filter((t: any) => new Date(t.created_at).getTime() <= limiteSesionMs)
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              if (candidatos.length > 0) {
                tutorDeLaSesion = candidatos[0];
              }
            }

            if (!tutorDeLaSesion) {
              const sesionesOrdenadas = sesionesCronologicasPorNino.get(nId) || [];
              const idx = sesionesOrdenadas.indexOf(s.id);
              tutorDeLaSesion = idx >= 0
                ? tutoresDelNino[Math.min(idx, tutoresDelNino.length - 1)]
                : tutoresDelNino[0];
            }
          }
        }

        const ingresoDate = new Date(s.ingreso_at);
        const fechaIngreso = !isNaN(ingresoDate.getTime()) ? ingresoDate.toLocaleDateString() : '-';
        const horaIngreso = !isNaN(ingresoDate.getTime())
          ? ingresoDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '-';

        if (!sesionesPorNino.has(nId)) {
          sesionesPorNino.set(nId, []);
        }

        sesionesPorNino.get(nId)!.push({
          sesionId: s.id,
          fechaIngreso,
          horaIngreso,
          ingresoIso: s.ingreso_at,
          estado: s.estado || 'FINALIZADO',
          tutorId: tutorDeLaSesion?.id,
          tutorNombre: tutorDeLaSesion?.nombres_apellidos || 'Sin responsable registrado',
          tutorParentesco: tutorDeLaSesion?.parentesco || '-',
          tutorCedula: tutorDeLaSesion?.cedula || ''
        });
      });

      // 2. Construir Tabla 2: Niños, Adultos Responsables y Adulto por cada Sesión
      this.listaNinosConSesiones = ninosArr.map((n: any) => {
        const tutoresRaw = tutoresPorNino.get(n.id) || [];
        const tutoresMapeados: TutorConNinos[] = tutoresRaw.map((t: any) => ({
          id: t.id,
          nombres_apellidos: t.nombres_apellidos || 'Sin nombre',
          cedula: t.cedula || '',
          alias: t.alias || '',
          parentesco: t.parentesco || '',
          sector: t.sector || '',
          whatsapp: t.whatsapp || '',
          correo: t.correo || '',
          contacto_adicional_nombre: t.contacto_adicional_nombre || '',
          tipo_pase: t.tipo_pase || '',
          observaciones_tipo_pase: t.observaciones_tipo_pase || '',
          ninosRegistrados: []
        }));

        return {
          id: n.id,
          nombres_apellidos: n.nombres_apellidos || 'Sin nombre',
          alias: n.alias || '',
          fecha_nacimiento: n.fecha_nacimiento ? String(n.fecha_nacimiento).split('T')[0] : '',
          edad: this.calcularEdad(n.fecha_nacimiento),
          codigo_especifico: n.codigo_especifico || '',
          notas: n.notas || '',
          tutoresRegistrados: tutoresMapeados,
          sesionesHistorial: sesionesPorNino.get(n.id) || [],
          mostrarTodasSesiones: false
        };
      });
    } catch (err) {
      console.error('Error inesperado al cargar el directorio de adultos y niños:', err);
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  toggleSesionesNino(nino: NinoConSesionesYTutores) {
    nino.mostrarTodasSesiones = !nino.mostrarTodasSesiones;
    this.cdr.detectChanges();
  }

  // --- EDICIÓN Y ELIMINACIÓN DE ADULTO RESPONSABLE ---
  abrirEditarTutor(tutor: TutorConNinos) {
    this.tutorEditando = tutor;
    this.tutorForm.patchValue({
      nombres_apellidos: tutor.nombres_apellidos || '',
      cedula: tutor.cedula || '',
      alias: tutor.alias || '',
      parentesco: tutor.parentesco || '',
      sector: tutor.sector || '',
      whatsapp: tutor.whatsapp || '',
      correo: tutor.correo || '',
      contacto_adicional_nombre: tutor.contacto_adicional_nombre || '',
      tipo_pase: tutor.tipo_pase || '',
      observaciones_tipo_pase: tutor.observaciones_tipo_pase || ''
    });
    this.showEditTutorModal = true;
    this.cdr.detectChanges();
  }

  abrirEditarTutorPorId(tutorId?: string) {
    if (!tutorId) return;
    const encontrado = this.listaTutoresConNinos.find(t => t.id === tutorId);
    if (encontrado) {
      this.abrirEditarTutor(encontrado);
    }
  }

  cerrarEditarTutor() {
    this.showEditTutorModal = false;
    this.tutorEditando = null;
    this.isSavingTutor = false;
    this.cdr.detectChanges();
  }

  async guardarEdicionTutor() {
    if (this.tutorForm.invalid || !this.tutorEditando) {
      this.tutorForm.markAllAsTouched();
      return;
    }

    this.isSavingTutor = true;
    this.cdr.detectChanges();

    const val = this.tutorForm.value;
    const payload = {
      nombres_apellidos: sanitizarTexto(val.nombres_apellidos),
      cedula: sanitizarTexto(val.cedula),
      alias: sanitizarTexto(val.alias),
      parentesco: sanitizarTexto(val.parentesco),
      sector: sanitizarTexto(val.sector),
      whatsapp: normalizarTelefono(val.whatsapp),
      correo: sanitizarCorreo(val.correo),
      contacto_adicional_nombre: sanitizarTexto(val.contacto_adicional_nombre),
      tipo_pase: sanitizarTexto(val.tipo_pase) || null,
      observaciones_tipo_pase: sanitizarTexto(val.observaciones_tipo_pase) || null
    };

    try {
      const { error } = await this.supabase.db('tutores')
        .update(payload)
        .eq('id', this.tutorEditando.id);

      if (error) throw error;

      this.mostrarToast('Datos del adulto responsable actualizados correctamente.', 'success');
      this.cerrarEditarTutor();
      await this.cargarDirectorioCompleto();
    } catch (err: any) {
      console.error('Error al actualizar adulto responsable:', err);
      this.mostrarToast(err?.message || 'No se pudo actualizar el adulto responsable.', 'error');
    } finally {
      this.isSavingTutor = false;
      this.cdr.detectChanges();
    }
  }

  confirmarEliminarTutor(tutor: TutorConNinos) {
    const tutorCompleto = this.listaTutoresConNinos.find(t => t.id === tutor.id) || tutor;
    this.tutorAEliminar = tutorCompleto;
    this.eliminarTambienNinosDeTutor = false;
    this.showDeleteTutorModal = true;
    this.cdr.detectChanges();
  }

  cerrarEliminarTutor() {
    this.showDeleteTutorModal = false;
    this.tutorAEliminar = null;
    this.eliminarTambienNinosDeTutor = false;
    this.isDeletingTutor = false;
    this.cdr.detectChanges();
  }

  async ejecutarEliminarTutor() {
    if (!this.tutorAEliminar) return;

    this.isDeletingTutor = true;
    this.cdr.detectChanges();

    const tutorId = this.tutorAEliminar.id;
    const ninosAsociados = this.tutorAEliminar.ninosRegistrados || [];

    try {
      // 1. Eliminar relaciones en ninos_tutores
      await this.supabase.db('ninos_tutores')
        .delete()
        .eq('tutor_id', tutorId);

      // 2. Si el usuario marcó eliminar también a los niños vinculados a este adulto
      if (this.eliminarTambienNinosDeTutor && ninosAsociados.length > 0) {
        for (const nino of ninosAsociados) {
          await this.supabase.db('ninos_tutores').delete().eq('nino_id', nino.id);
          await this.supabase.db('sesiones_juego').delete().eq('nino_id', nino.id);
          await this.supabase.db('ninos').delete().eq('id', nino.id);
        }
      }

      // 3. Desvincular tutor_id en sesiones_juego si existe la columna
      await this.supabase.db('sesiones_juego')
        .update({ tutor_id: null })
        .eq('tutor_id', tutorId);

      // 4. Eliminar el registro en tutores
      const { error } = await this.supabase.db('tutores')
        .delete()
        .eq('id', tutorId);

      if (error) throw error;

      this.mostrarToast(
        this.eliminarTambienNinosDeTutor
          ? 'Adulto responsable y niño(s) vinculado(s) eliminados correctamente.'
          : 'Adulto responsable eliminado correctamente.',
        'success'
      );
      this.cerrarEliminarTutor();
      await this.cargarDirectorioCompleto();
    } catch (err: any) {
      console.error('Error al eliminar adulto responsable:', err);
      this.mostrarToast(err?.message || 'Error al eliminar el adulto responsable.', 'error');
    } finally {
      this.isDeletingTutor = false;
      this.cdr.detectChanges();
    }
  }

  // --- EDICIÓN Y ELIMINACIÓN DE NIÑO(A) ---
  abrirEditarNino(nino: NinoResumen | NinoConSesionesYTutores) {
    this.ninoEditando = nino;
    this.ninoForm.patchValue({
      nombres_apellidos: nino.nombres_apellidos || '',
      alias: nino.alias || '',
      fecha_nacimiento: nino.fecha_nacimiento ? String(nino.fecha_nacimiento).split('T')[0] : '',
      codigo_especifico: nino.codigo_especifico || '',
      notas: nino.notas || ''
    });
    this.showEditNinoModal = true;
    this.cdr.detectChanges();
  }

  cerrarEditarNino() {
    this.showEditNinoModal = false;
    this.ninoEditando = null;
    this.isSavingNino = false;
    this.cdr.detectChanges();
  }

  async guardarEdicionNino() {
    if (this.ninoForm.invalid || !this.ninoEditando) {
      this.ninoForm.markAllAsTouched();
      return;
    }

    this.isSavingNino = true;
    this.cdr.detectChanges();

    const val = this.ninoForm.value;
    const payload: any = {
      nombres_apellidos: sanitizarTexto(val.nombres_apellidos),
      alias: sanitizarTexto(val.alias),
      fecha_nacimiento: val.fecha_nacimiento,
      notas: sanitizarTexto(val.notas)
    };
    if (val.codigo_especifico) {
      payload.codigo_especifico = sanitizarTexto(val.codigo_especifico);
    }

    try {
      const { error } = await this.supabase.db('ninos')
        .update(payload)
        .eq('id', this.ninoEditando.id);

      if (error) throw error;

      this.mostrarToast('Datos del niño(a) actualizados correctamente.', 'success');
      this.cerrarEditarNino();
      await this.cargarDirectorioCompleto();
    } catch (err: any) {
      console.error('Error al actualizar niño(a):', err);
      this.mostrarToast(err?.message || 'No se pudo actualizar los datos del niño(a).', 'error');
    } finally {
      this.isSavingNino = false;
      this.cdr.detectChanges();
    }
  }

  confirmarEliminarNino(nino: NinoResumen | NinoConSesionesYTutores) {
    const ninoCompleto = this.listaNinosConSesiones.find(n => n.id === nino.id) || nino;
    this.ninoAEliminar = ninoCompleto;
    this.eliminarTambienTutorDeNino = false;
    this.showDeleteNinoModal = true;
    this.cdr.detectChanges();
  }

  cerrarEliminarNino() {
    this.showDeleteNinoModal = false;
    this.ninoAEliminar = null;
    this.eliminarTambienTutorDeNino = false;
    this.isDeletingNino = false;
    this.cdr.detectChanges();
  }

  async ejecutarEliminarNino() {
    if (!this.ninoAEliminar) return;

    this.isDeletingNino = true;
    this.cdr.detectChanges();

    const ninoId = this.ninoAEliminar.id;
    const tutoresAsociados: TutorConNinos[] = (this.ninoAEliminar as NinoConSesionesYTutores).tutoresRegistrados || [];

    try {
      // 1. Eliminar relaciones en ninos_tutores
      await this.supabase.db('ninos_tutores')
        .delete()
        .eq('nino_id', ninoId);

      // 2. Eliminar sesiones asociadas para evitar restricción de llave foránea
      await this.supabase.db('sesiones_juego')
        .delete()
        .eq('nino_id', ninoId);

      // 3. Eliminar el registro en ninos
      const { error } = await this.supabase.db('ninos')
        .delete()
        .eq('id', ninoId);

      if (error) throw error;

      // 4. Si se marcó eliminar también al adulto responsable vinculado
      if (this.eliminarTambienTutorDeNino && tutoresAsociados.length > 0) {
        for (const tut of tutoresAsociados) {
          await this.supabase.db('ninos_tutores').delete().eq('tutor_id', tut.id);
          await this.supabase.db('sesiones_juego').update({ tutor_id: null }).eq('tutor_id', tut.id);
          await this.supabase.db('tutores').delete().eq('id', tut.id);
        }
      }

      this.mostrarToast(
        this.eliminarTambienTutorDeNino
          ? 'Niño(a) y adulto(s) responsable(s) eliminados permanentemente.'
          : 'Niño(a) eliminado permanentemente del sistema.',
        'success'
      );
      this.cerrarEliminarNino();
      await this.cargarDirectorioCompleto();
    } catch (err: any) {
      console.error('Error al eliminar niño(a):', err);
      this.mostrarToast(err?.message || 'Error al eliminar el niño(a).', 'error');
    } finally {
      this.isDeletingNino = false;
      this.cdr.detectChanges();
    }
  }

  private generarCodigoNino(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // --- AÑADIR NIÑO A UN ADULTO RESPONSABLE ---
  abrirAgregarNinoATutor(tutor: TutorConNinos) {
    this.tutorParaNuevoNino = tutor;
    this.ninoExistenteSeleccionadoId = null;
    this.resultadosBusquedaNinoModal = [];
    this.nuevoNinoForm.reset({
      nombres_apellidos: '',
      alias: '',
      fecha_nacimiento: '',
      codigo_especifico: this.generarCodigoNino(),
      notas: ''
    });
    this.showAddNinoATutorModal = true;
    this.cdr.detectChanges();
  }

  cerrarAgregarNinoATutor() {
    this.showAddNinoATutorModal = false;
    this.tutorParaNuevoNino = null;
    this.ninoExistenteSeleccionadoId = null;
    this.resultadosBusquedaNinoModal = [];
    this.isSavingNuevoNino = false;
    this.cdr.detectChanges();
  }

  onInputNombreNuevoNino() {
    this.ninoExistenteSeleccionadoId = null;
  }

  async buscarNinoExistenteParaTutor() {
    const nombre = (this.nuevoNinoForm.get('nombres_apellidos')?.value || '').trim();
    if (!nombre) return;

    this.isSearchingNinoExistente = true;
    this.resultadosBusquedaNinoModal = [];
    this.cdr.detectChanges();

    try {
      const { data, error } = await this.supabase.db('ninos')
        .select('*')
        .ilike('nombres_apellidos', `%${nombre}%`)
        .limit(10);

      if (!error && Array.isArray(data)) {
        this.resultadosBusquedaNinoModal = data;
      }
    } catch (err) {
      console.error('Error al buscar niño existente:', err);
    } finally {
      this.isSearchingNinoExistente = false;
      this.cdr.detectChanges();
    }
  }

  seleccionarNinoExistenteModal(nino: any) {
    this.ninoExistenteSeleccionadoId = nino.id;
    this.resultadosBusquedaNinoModal = [];
    this.nuevoNinoForm.patchValue({
      nombres_apellidos: nino.nombres_apellidos || '',
      alias: nino.alias || '',
      fecha_nacimiento: nino.fecha_nacimiento ? String(nino.fecha_nacimiento).split('T')[0] : '',
      codigo_especifico: nino.codigo_especifico || this.generarCodigoNino(),
      notas: nino.notas || ''
    });
    this.cdr.detectChanges();
  }

  async guardarNuevoNinoParaTutor() {
    if (this.nuevoNinoForm.invalid || !this.tutorParaNuevoNino) {
      this.nuevoNinoForm.markAllAsTouched();
      return;
    }

    this.isSavingNuevoNino = true;
    this.cdr.detectChanges();

    const val = this.nuevoNinoForm.value;
    const tutorId = this.tutorParaNuevoNino.id;
    let ninoIdFinal: string | null = this.ninoExistenteSeleccionadoId;

    const payload = {
      nombres_apellidos: sanitizarTexto(val.nombres_apellidos),
      alias: sanitizarTexto(val.alias),
      fecha_nacimiento: val.fecha_nacimiento,
      codigo_especifico: sanitizarTexto(val.codigo_especifico) || this.generarCodigoNino(),
      notas: sanitizarTexto(val.notas)
    };

    try {
      if (ninoIdFinal) {
        const { error: updErr } = await this.supabase.db('ninos')
          .update(payload)
          .eq('id', ninoIdFinal);
        if (updErr) throw updErr;
      } else {
        const { data: ninoData, error: insErr } = await this.supabase.db('ninos')
          .insert(payload)
          .select('id')
          .single();
        if (insErr) throw insErr;
        ninoIdFinal = ninoData?.id;
      }

      if (ninoIdFinal) {
        const { data: linkExistente } = await this.supabase.db('ninos_tutores')
          .select('*')
          .eq('tutor_id', tutorId)
          .eq('nino_id', ninoIdFinal)
          .maybeSingle();

        if (!linkExistente) {
          const { error: linkErr } = await this.supabase.db('ninos_tutores')
            .insert({
              tutor_id: tutorId,
              nino_id: ninoIdFinal
            });
          if (linkErr) throw linkErr;
        }
      }

      this.mostrarToast('Niño(a) añadido y vinculado al adulto responsable.', 'success');
      this.cerrarAgregarNinoATutor();
      await this.cargarDirectorioCompleto();
    } catch (err: any) {
      console.error('Error al añadir niño al adulto responsable:', err);
      this.mostrarToast(err?.message || 'No se pudo añadir el niño(a).', 'error');
    } finally {
      this.isSavingNuevoNino = false;
      this.cdr.detectChanges();
    }
  }

  // --- AÑADIR ADULTO RESPONSABLE A UN NIÑO ---
  abrirAgregarTutorANino(nino: NinoConSesionesYTutores) {
    this.ninoParaNuevoTutor = nino;
    this.tutorExistenteSeleccionadoId = null;
    this.mensajeBusquedaTutorModal = '';
    this.nuevoTutorForm.reset({
      cedula: '',
      nombres_apellidos: '',
      alias: '',
      parentesco: '',
      sector: '',
      whatsapp: '',
      correo: '',
      contacto_adicional_nombre: '',
      tipo_pase: '',
      observaciones_tipo_pase: ''
    });
    this.showAddTutorANinoModal = true;
    this.cdr.detectChanges();
  }

  cerrarAgregarTutorANino() {
    this.showAddTutorANinoModal = false;
    this.ninoParaNuevoTutor = null;
    this.tutorExistenteSeleccionadoId = null;
    this.mensajeBusquedaTutorModal = '';
    this.isSavingNuevoTutor = false;
    this.cdr.detectChanges();
  }

  async buscarTutorExistentePorCedulaModal() {
    const cedula = sanitizarTexto(this.nuevoTutorForm.get('cedula')?.value);
    if (!cedula) return;

    this.isSearchingTutorExistente = true;
    this.mensajeBusquedaTutorModal = '';
    this.cdr.detectChanges();

    try {
      const { data: tutorData, error } = await this.supabase.db('tutores')
        .select('*')
        .eq('cedula', cedula)
        .maybeSingle();

      if (!error && tutorData) {
        this.tutorExistenteSeleccionadoId = tutorData.id;
        this.nuevoTutorForm.patchValue({
          nombres_apellidos: tutorData.nombres_apellidos || '',
          alias: tutorData.alias || '',
          parentesco: tutorData.parentesco || '',
          sector: tutorData.sector || '',
          whatsapp: tutorData.whatsapp || '',
          correo: tutorData.correo || '',
          contacto_adicional_nombre: tutorData.contacto_adicional_nombre || '',
          tipo_pase: tutorData.tipo_pase || '',
          observaciones_tipo_pase: tutorData.observaciones_tipo_pase || ''
        });
        this.mensajeBusquedaTutorModal = 'Adulto encontrado en el sistema. Se vinculará al niño(a).';
      } else {
        this.tutorExistenteSeleccionadoId = null;
        this.mensajeBusquedaTutorModal = 'No registrado aún. Completa los campos para crearlo y vincularlo.';
      }
    } catch (err) {
      console.error('Error al buscar adulto por cédula:', err);
    } finally {
      this.isSearchingTutorExistente = false;
      this.cdr.detectChanges();
    }
  }

  async guardarNuevoTutorParaNino() {
    if (this.nuevoTutorForm.invalid || !this.ninoParaNuevoTutor) {
      this.nuevoTutorForm.markAllAsTouched();
      return;
    }

    this.isSavingNuevoTutor = true;
    this.cdr.detectChanges();

    const val = this.nuevoTutorForm.value;
    const ninoId = this.ninoParaNuevoTutor.id;
    const cedulaSanitizada = sanitizarTexto(val.cedula);
    let tutorIdFinal: string | null = this.tutorExistenteSeleccionadoId;

    const payload = {
      nombres_apellidos: sanitizarTexto(val.nombres_apellidos),
      cedula: cedulaSanitizada,
      alias: sanitizarTexto(val.alias),
      parentesco: sanitizarTexto(val.parentesco),
      sector: sanitizarTexto(val.sector),
      whatsapp: normalizarTelefono(val.whatsapp),
      correo: sanitizarCorreo(val.correo),
      contacto_adicional_nombre: sanitizarTexto(val.contacto_adicional_nombre),
      tipo_pase: sanitizarTexto(val.tipo_pase) || null,
      observaciones_tipo_pase: sanitizarTexto(val.observaciones_tipo_pase) || null
    };

    try {
      if (!tutorIdFinal && cedulaSanitizada) {
        const { data: existingTutor } = await this.supabase.db('tutores')
          .select('id')
          .eq('cedula', cedulaSanitizada)
          .maybeSingle();
        if (existingTutor) {
          tutorIdFinal = existingTutor.id;
        }
      }

      if (tutorIdFinal) {
        const { error: updErr } = await this.supabase.db('tutores')
          .update(payload)
          .eq('id', tutorIdFinal);
        if (updErr) throw updErr;
      } else {
        const { data: tutorData, error: insErr } = await this.supabase.db('tutores')
          .insert(payload)
          .select('id')
          .single();
        if (insErr) throw insErr;
        tutorIdFinal = tutorData?.id;
      }

      if (tutorIdFinal) {
        const { data: linkExistente } = await this.supabase.db('ninos_tutores')
          .select('*')
          .eq('tutor_id', tutorIdFinal)
          .eq('nino_id', ninoId)
          .maybeSingle();

        if (!linkExistente) {
          const { error: linkErr } = await this.supabase.db('ninos_tutores')
            .insert({
              tutor_id: tutorIdFinal,
              nino_id: ninoId
            });
          if (linkErr) throw linkErr;
        }
      }

      this.mostrarToast('Adulto responsable añadido y vinculado al niño(a).', 'success');
      this.cerrarAgregarTutorANino();
      await this.cargarDirectorioCompleto();
    } catch (err: any) {
      console.error('Error al añadir adulto responsable al niño:', err);
      this.mostrarToast(err?.message || 'No se pudo añadir el adulto responsable.', 'error');
    } finally {
      this.isSavingNuevoTutor = false;
      this.cdr.detectChanges();
    }
  }
}
