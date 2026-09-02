import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { SupabaseService } from '../../core/services/supabase/supabase';
import { 
  validarCorreo, 
  validarTelefono, 
  validarCedulaOPasaporte, 
  normalizarTelefono, 
  formatearTelefonoParaVista, 
  sanitizarTexto, 
  sanitizarCorreo 
} from '../../core/validators/custom-validators';

@Component({
  selector: 'app-ingreso',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ingreso.html',
  styleUrl: './ingreso.css',
  host: {
    '[@slideRightLeft]': '',
    style: 'display: block; width: 100%;'
  },
  animations: [
    trigger('slideRightLeft', [
      transition(':enter', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('400ms cubic-bezier(0.25, 1, 0.5, 1)', style({ transform: 'translateX(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        style({ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: -1 }),
        animate('400ms cubic-bezier(0.25, 1, 0.5, 1)', style({ transform: 'translateX(100%)', opacity: 0 }))
      ])
    ])
  ]
})
export class Ingreso implements OnInit {
  private fb = inject(FormBuilder);
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  precioAdultoExtra = 2.00;
  isLoading = false;
  isSearching = false;
  errorMessage = '';
  searchMessage = '';

  isSearchingNino = false;
  searchNinoMessage = '';
  searchingNinoIndex = -1;
  resultadosBusquedaNinos: { [index: number]: any[] } = {};

  // Variables para Dialog Modal de Alertas
  showDialog = false;
  dialogTitle = '';
  dialogMessage = '';
  dialogErrors: string[] = [];
  dialogType: 'error' | 'warning' | 'info' | 'success' = 'warning';
  dialogPrimaryBtn = 'Entendido';
  dialogSecondaryBtn = '';
  private dialogResolver?: (value: boolean) => void;

  // Estructura del formulario con validaciones requeridas
  ingresoForm: FormGroup = this.fb.group({
    // Datos del Tutor
    tutorNombre: ['', [Validators.required, Validators.minLength(4)]],
    tutorCedula: ['', [Validators.required, validarCedulaOPasaporte()]],
    tutorAlias: [''],
    tutorParentesco: ['', [Validators.required]],
    tutorCorreo: ['', [validarCorreo()]],
    tutorContactoAdicional: [''],
    tutorWhatsapp: ['', [Validators.required, validarTelefono()]],

    // FormArray para los Niños
    ninos: this.fb.array([this.crearNinoFormGroup()]),

    // Configuración de la Sesión (Aplica a todos los niños del formulario)
    tiempoMinutos: ['30', [Validators.required]], // Por defecto 30 minutos
    adultosExtra: ['0', [Validators.min(0)]]
  });

  async ngOnInit() {
    await this.cargarTarifaAdultoExtra();
  }

  async cargarTarifaAdultoExtra() {
    try {
      const { data: config } = await this.supabaseService.db('configuracion_sistema')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (config) {
        const precio = config.precio_adulto_extra ?? config.precio_adulto;
        if (precio !== undefined && precio !== null && !isNaN(Number(precio))) {
          this.precioAdultoExtra = Number(precio);
        }
      } else if (typeof window !== 'undefined' && window.localStorage) {
        const localAdulto = localStorage.getItem('precio_adulto_extra');
        if (localAdulto && !isNaN(parseFloat(localAdulto))) {
          this.precioAdultoExtra = parseFloat(localAdulto);
        }
      }
      this.cdr.detectChanges();
    } catch (e) {
      console.error('Error al cargar tarifa de adulto extra:', e);
    }
  }

  abrirDialogo(
    titulo: string,
    mensaje: string,
    errores: string[] = [],
    tipo: 'error' | 'warning' | 'info' | 'success' = 'warning',
    btnPrimario = 'Entendido',
    btnSecundario = ''
  ): Promise<boolean> {
    this.dialogTitle = titulo;
    this.dialogMessage = mensaje;
    this.dialogErrors = errores;
    this.dialogType = tipo;
    this.dialogPrimaryBtn = btnPrimario;
    this.dialogSecondaryBtn = btnSecundario;
    this.showDialog = true;
    this.cdr.detectChanges();

    return new Promise((resolve) => {
      this.dialogResolver = resolve;
    });
  }

  cerrarDialogo(resultado: boolean = true) {
    this.showDialog = false;
    if (this.dialogResolver) {
      this.dialogResolver(resultado);
      this.dialogResolver = undefined;
    }
    this.cdr.detectChanges();
  }

  validarYObtenerErrores(): string[] {
    const errores: string[] = [];

    // 1. Validar campos del Tutor / Adulto Responsable
    const tutorCedula = this.ingresoForm.get('tutorCedula');
    if (tutorCedula?.invalid) {
      if (tutorCedula.errors?.['required']) {
        errores.push('Cédula o identificación del adulto responsable requerida.');
      } else if (tutorCedula.errors?.['cedulaInvalida']) {
        errores.push(tutorCedula.errors['cedulaInvalida']);
      } else {
        errores.push('Cédula o pasaporte con formato inválido.');
      }
    }

    const tutorNombre = this.ingresoForm.get('tutorNombre');
    if (tutorNombre?.invalid) {
      if (tutorNombre.errors?.['required']) {
        errores.push('Nombre del adulto responsable requerido.');
      } else if (tutorNombre.errors?.['minlength']) {
        errores.push('El nombre del adulto debe tener al menos 4 caracteres.');
      }
    }

    const tutorParentesco = this.ingresoForm.get('tutorParentesco');
    if (tutorParentesco?.invalid) {
      errores.push('Parentesco con el niño(a) requerido (ej. Madre, Padre, Tía).');
    }

    const tutorWhatsapp = this.ingresoForm.get('tutorWhatsapp');
    if (tutorWhatsapp?.invalid) {
      if (tutorWhatsapp.errors?.['required']) {
        errores.push('WhatsApp / Teléfono de contacto requerido.');
      } else if (tutorWhatsapp.errors?.['telefonoInvalido']) {
        errores.push(tutorWhatsapp.errors['telefonoInvalido']);
      } else {
        errores.push('WhatsApp inválido: use de 9 a 15 dígitos numéricos.');
      }
    }

    const tutorCorreo = this.ingresoForm.get('tutorCorreo');
    if (tutorCorreo?.invalid && tutorCorreo.value) {
      if (tutorCorreo.errors?.['correoInvalido']) {
        errores.push(tutorCorreo.errors['correoInvalido']);
      } else {
        errores.push('El correo electrónico tiene un formato incorrecto (ej. usuario@ejemplo.com).');
      }
    }

    // 2. Validar campos de cada Niño
    this.ninosFormArray.controls.forEach((ninoCtrl, index) => {
      const numNino = index + 1;
      const ninoNombre = ninoCtrl.get('ninoNombre');
      if (ninoNombre?.invalid) {
        if (ninoNombre.errors?.['required']) {
          errores.push(`Nombre del Niño(a) #${numNino} requerido.`);
        } else if (ninoNombre.errors?.['minlength']) {
          errores.push(`Nombre del Niño(a) #${numNino} debe tener al menos 3 caracteres.`);
        }
      }

      const ninoFecha = ninoCtrl.get('ninoFechaNacimiento');
      if (ninoFecha?.invalid) {
        errores.push(`Fecha de nacimiento requerida para Niño(a) #${numNino}.`);
      }
    });

    // 3. Validar configuración de tarifa
    const adultosExtra = this.ingresoForm.get('adultosExtra');
    if (adultosExtra?.invalid) {
      errores.push('El número de acompañantes adultos extras no puede ser negativo.');
    }

    return errores;
  }

  obtenerVistaTelefono(): string {
    const val = this.ingresoForm.get('tutorWhatsapp')?.value;
    return formatearTelefonoParaVista(val);
  }

  onBlurCorreo() {
    const ctrl = this.ingresoForm.get('tutorCorreo');
    if (ctrl && ctrl.value) {
      ctrl.setValue(sanitizarCorreo(ctrl.value), { emitEvent: false });
    }
  }

  onBlurTelefono() {
    const ctrl = this.ingresoForm.get('tutorWhatsapp');
    if (ctrl && ctrl.value) {
      const normalizado = normalizarTelefono(ctrl.value);
      if (normalizado && !ctrl.errors) {
        ctrl.setValue(normalizado, { emitEvent: false });
      }
    }
  }

  onBlurCedula() {
    const ctrl = this.ingresoForm.get('tutorCedula');
    if (ctrl && ctrl.value) {
      ctrl.setValue(sanitizarTexto(ctrl.value), { emitEvent: false });
    }
  }

  onBlurNombreTutor() {
    const ctrl = this.ingresoForm.get('tutorNombre');
    if (ctrl && ctrl.value) {
      ctrl.setValue(sanitizarTexto(ctrl.value), { emitEvent: false });
    }
  }

  get ninosFormArray(): FormArray {
    return this.ingresoForm.get('ninos') as FormArray;
  }

  crearNinoFormGroup(): FormGroup {
    return this.fb.group({
      ninoId: [null],
      ninoNombre: ['', [Validators.required, Validators.minLength(3)]],
      ninoAlias: [''],
      ninoFechaNacimiento: ['', [Validators.required]],
      ninoCodigo: [this.generarCodigoNino(), [Validators.required]],
      ninoNotas: [''], // Alergias, observaciones, quién lo retira, etc.
      sesionActivaInfo: [null]
    });
  }

  async verificarSesionesActivasNino(ninoId: string): Promise<{ activa: boolean; salidaEstimada?: string } | null> {
    if (!ninoId) return null;
    try {
      const { data, error } = await this.supabaseService.db('sesiones_juego')
        .select('id, salida_estimada_at, estado')
        .eq('nino_id', ninoId)
        .eq('estado', 'ACTIVO')
        .order('salida_estimada_at', { ascending: false });

      if (error || !data || data.length === 0) return null;

      const ahora = new Date();
      for (const sesion of data) {
        const salida = new Date(sesion.salida_estimada_at);
        if (salida > ahora) {
          const horas = salida.getHours().toString().padStart(2, '0');
          const minutos = salida.getMinutes().toString().padStart(2, '0');
          return {
            activa: true,
            salidaEstimada: `${horas}:${minutos}`
          };
        } else {
          // Sesión con tiempo transcurrido en el pasado que no se había cerrado
          await this.supabaseService.db('sesiones_juego')
            .update({ estado: 'FINALIZADO' })
            .eq('id', sesion.id);
        }
      }
      return null;
    } catch (e) {
      console.error('Error al verificar sesión activa:', e);
      return null;
    }
  }

  agregarNino() {
    this.ninosFormArray.push(this.crearNinoFormGroup());
  }

  removerNino(index: number) {
    if (this.ninosFormArray.length > 1) {
      this.ninosFormArray.removeAt(index);
    }
  }

  generarCodigoNino(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  async buscarPorCedula() {
    const cedulaControl = this.ingresoForm.get('tutorCedula');
    if (!cedulaControl || !cedulaControl.value || cedulaControl.value.trim() === '') {
      this.searchMessage = 'Ingrese una cédula para buscar.';
      await this.abrirDialogo(
        'Cédula no ingresada',
        'Por favor ingrese un número de cédula para buscar en el historial de clientes.',
        [],
        'warning',
        'Entendido'
      );
      return;
    }

    this.isSearching = true;
    this.searchMessage = '';
    this.cdr.detectChanges();

    const cedula = cedulaControl.value.trim();

    try {
      // 1. Buscar Tutor
      const { data: tutorData, error: tutorError } = await this.supabaseService.db('tutores')
        .select('*')
        .eq('cedula', cedula)
        .limit(1)
        .maybeSingle();

      if (tutorError) throw tutorError;

      if (tutorData) {
        // Autocompletar datos del tutor
        this.ingresoForm.patchValue({
          tutorNombre: tutorData.nombres_apellidos || '',
          tutorAlias: tutorData.alias || '',
          tutorParentesco: tutorData.parentesco || '',
          tutorCorreo: tutorData.correo || '',
          tutorContactoAdicional: tutorData.contacto_adicional_nombre || '',
          tutorWhatsapp: tutorData.whatsapp || ''
        });

        // 2. Buscar todos los niños asociados al tutor
        const { data: ninosData, error: ninosError } = await this.supabaseService.db('ninos')
          .select('*, ninos_tutores!inner(tutor_id)')
          .eq('ninos_tutores.tutor_id', tutorData.id)
          .order('id', { ascending: true });

        if (ninosData && ninosData.length > 0 && !ninosError) {
          this.ninosFormArray.clear();
          for (const nino of ninosData) {
            const ninoGroup = this.crearNinoFormGroup();
            
            // Formatear la fecha a YYYY-MM-DD para el input type="date"
            let fechaParsed = '';
            if (nino.fecha_nacimiento) {
              fechaParsed = nino.fecha_nacimiento.split('T')[0];
            }

            const sesionActiva = await this.verificarSesionesActivasNino(nino.id);

            ninoGroup.patchValue({
              ninoId: nino.id,
              ninoNombre: nino.nombres_apellidos || '',
              ninoAlias: nino.alias || '',
              ninoFechaNacimiento: fechaParsed,
              ninoCodigo: nino.codigo_especifico || ninoGroup.get('ninoCodigo')?.value,
              ninoNotas: nino.notas || '',
              sesionActivaInfo: sesionActiva
            });
            this.ninosFormArray.push(ninoGroup);
          }
          this.searchMessage = `Datos cargados exitosamente. Se encontraron ${ninosData.length} niño(s).`;
        } else {
          this.searchMessage = 'Tutor encontrado exitosamente, pero no tiene niños registrados aún.';
        }
      } else {
        this.searchMessage = 'No se encontró un tutor con esa cédula.';
        await this.abrirDialogo(
          'Adulto no encontrado',
          `No se encontró ningún adulto responsable con la cédula "${cedula}". Puede completar el formulario para registrarlo como nuevo cliente.`,
          [],
          'info',
          'Continuar'
        );
      }
    } catch (error) {
      console.error('Error buscando cédula:', error);
      this.searchMessage = 'Error al buscar datos.';
      await this.abrirDialogo(
        'Error de Búsqueda',
        'Ocurrió un problema al consultar la cédula. Por favor verifique su conexión a internet.',
        [],
        'error',
        'Entendido'
      );
    } finally {
      this.isSearching = false;
      this.cdr.detectChanges();
    }
  }

  async buscarPorNombreNino(index: number) {
    const ninoControl = this.ninosFormArray.at(index).get('ninoNombre');
    if (!ninoControl || !ninoControl.value || ninoControl.value.trim() === '') {
      this.searchNinoMessage = 'Ingrese un nombre para buscar.';
      this.searchingNinoIndex = index;
      await this.abrirDialogo(
        'Nombre no ingresado',
        'Por favor ingrese el nombre del niño(a) antes de presionar Buscar.',
        [],
        'warning',
        'Entendido'
      );
      return;
    }

    this.isSearchingNino = true;
    this.searchingNinoIndex = index;
    this.searchNinoMessage = '';
    this.resultadosBusquedaNinos[index] = [];
    this.cdr.detectChanges();

    const nombre = ninoControl.value.trim();

    try {
      // 1. Buscar Niños con ese nombre (limitamos a 10 resultados para evitar sobrecarga)
      const { data: ninosData, error: ninosError } = await this.supabaseService.db('ninos')
        .select('*, tutores(*)')
        .ilike('nombres_apellidos', `%${nombre}%`)
        .limit(10);

      if (ninosError) throw ninosError;

      if (ninosData && ninosData.length > 0) {
        let resultadosAplanados: any[] = [];
        
        ninosData.forEach((nino: any) => {
          if (nino.tutores && Array.isArray(nino.tutores) && nino.tutores.length > 0) {
            nino.tutores.forEach((tutor: any) => {
              resultadosAplanados.push({
                ...nino,
                tutorSeleccionado: tutor
              });
            });
          } else {
            resultadosAplanados.push({
              ...nino,
              tutorSeleccionado: null
            });
          }
        });
        
        // Limitar nuevamente a 10 resultados después de aplanar
        resultadosAplanados = resultadosAplanados.slice(0, 10);
        
        this.resultadosBusquedaNinos[index] = resultadosAplanados;
        this.searchNinoMessage = `Se encontraron ${resultadosAplanados.length} coincidencia(s). Seleccione uno de la lista.`;
      } else {
        this.searchNinoMessage = 'No se encontró ningún niño con ese nombre.';
        await this.abrirDialogo(
          'Sin coincidencias',
          `No se encontró ningún niño(a) registrado con el nombre "${nombre}". Puede continuar con el registro como nuevo.`,
          [],
          'info',
          'Continuar'
        );
      }
    } catch (error) {
      console.error('Error buscando niño:', error);
      this.searchNinoMessage = 'Error al buscar datos.';
      await this.abrirDialogo(
        'Error de Búsqueda',
        'No se pudo buscar al niño. Intente nuevamente.',
        [],
        'error',
        'Entendido'
      );
    } finally {
      this.isSearchingNino = false;
      this.cdr.detectChanges();
    }
  }

  async seleccionarNino(index: number, ninoData: any) {
    this.resultadosBusquedaNinos[index] = []; // Ocultar el dropdown
    this.searchNinoMessage = '';
    
    if (ninoData.tutorSeleccionado) {
      let tutorData = ninoData.tutorSeleccionado;
      
      if (tutorData) {
        // Autocompletar datos del tutor
        this.ingresoForm.patchValue({
          tutorNombre: tutorData.nombres_apellidos || '',
          tutorCedula: tutorData.cedula || '',
          tutorAlias: tutorData.alias || '',
          tutorParentesco: tutorData.parentesco || '',
          tutorCorreo: tutorData.correo || '',
          tutorContactoAdicional: tutorData.contacto_adicional_nombre || '',
          tutorWhatsapp: tutorData.whatsapp || ''
        });

        // Buscar todos los niños asociados al tutor
        try {
          this.isSearchingNino = true;
          this.cdr.detectChanges();
          
          const { data: todosNinosData, error: todosNinosError } = await this.supabaseService.db('ninos')
            .select('*, ninos_tutores!inner(tutor_id)')
            .eq('ninos_tutores.tutor_id', tutorData.id)
            .order('id', { ascending: true });

          if (todosNinosData && todosNinosData.length > 0 && !todosNinosError) {
            this.ninosFormArray.clear();
            for (const nino of todosNinosData) {
              const ninoGroup = this.crearNinoFormGroup();
              let fechaParsed = '';
              if (nino.fecha_nacimiento) {
                fechaParsed = nino.fecha_nacimiento.split('T')[0];
              }

              const sesionActiva = await this.verificarSesionesActivasNino(nino.id);

              ninoGroup.patchValue({
                ninoId: nino.id,
                ninoNombre: nino.nombres_apellidos || '',
                ninoAlias: nino.alias || '',
                ninoFechaNacimiento: fechaParsed,
                ninoCodigo: nino.codigo_especifico || ninoGroup.get('ninoCodigo')?.value,
                ninoNotas: nino.notas || '',
                sesionActivaInfo: sesionActiva
              });
              this.ninosFormArray.push(ninoGroup);
            }
            this.searchNinoMessage = `Datos del tutor y ${todosNinosData.length} niño(s) cargados exitosamente.`;
          }
        } catch (error) {
          console.error('Error buscando hermanos:', error);
        } finally {
          this.isSearchingNino = false;
          this.searchingNinoIndex = -1;
          this.cdr.detectChanges();
        }
      }
    }
  }

  async onSubmit() {
    if (this.ingresoForm.invalid) {
      this.ingresoForm.markAllAsTouched();
      const errores = this.validarYObtenerErrores();
      await this.abrirDialogo(
        'Información Incompleta o Inválida',
        'Por favor completa o corrige los siguientes campos antes de registrar el ingreso:',
        errores,
        'warning',
        'Revisar Formulario'
      );
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    const values = this.ingresoForm.value;

    // 0. VERIFICAR DUPLICADOS EN EL FORMULARIO Y SESIONES ACTIVAS PREVIAS
    const nombresEnFormulario = values.ninos.map((n: any) => (n.ninoNombre || '').trim().toLowerCase());
    const nombresDuplicados = nombresEnFormulario.filter((item: string, index: number) => item && nombresEnFormulario.indexOf(item) !== index);
    if (nombresDuplicados.length > 0) {
      this.isLoading = false;
      await this.abrirDialogo(
        'Niño Repetido en el Registro',
        'Has incluido al mismo niño más de una vez en este formulario. Por favor remueve los campos duplicados.',
        [],
        'warning',
        'Revisar'
      );
      return;
    }

    try {
      const ninosConSesionActiva: string[] = [];

      for (const nino of values.ninos) {
        let ninoIdAValidar = nino.ninoId;
        if (!ninoIdAValidar && nino.ninoNombre) {
          const { data: existingNino } = await this.supabaseService.db('ninos')
            .select('id')
            .ilike('nombres_apellidos', nino.ninoNombre.trim())
            .maybeSingle();
          if (existingNino) {
            ninoIdAValidar = existingNino.id;
          }
        }

        if (ninoIdAValidar) {
          const sesionActiva = await this.verificarSesionesActivasNino(ninoIdAValidar);
          if (sesionActiva && sesionActiva.activa) {
            ninosConSesionActiva.push(
              `"${nino.ninoNombre}" (Sesión activa hasta las ${sesionActiva.salidaEstimada})`
            );
          }
        }
      }

      if (ninosConSesionActiva.length > 0) {
        this.isLoading = false;
        await this.abrirDialogo(
          'Sesión en Curso Detectada',
          'No se puede registrar el ingreso porque el niño(a) ya se encuentra jugando en una sesión activa. Debes esperar a que acabe o finalizarla desde el panel de control antes de un nuevo ingreso:',
          ninosConSesionActiva,
          'warning',
          'Entendido'
        );
        return;
      }
    } catch (verifError) {
      console.error('Error validando sesiones activas:', verifError);
    }

    let tutorIdFinal: string | null = null;
    let ninosIdsCreados: string[] = [];

    try {
      // Obtener el ID del usuario (encargado) actual desde la tabla perfiles
      const { data: { user } } = await this.supabaseService.supabase.auth.getUser();
      let encargadoId = null;
      if (user && user.email) {
        const { data: perfil } = await this.supabaseService.db('perfiles')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
        if (perfil) {
          encargadoId = perfil.id;
        }
      }

      // 1. PASO UNO: Buscar si el tutor ya existe para no duplicarlo, o crearlo.
      const cedulaSanitizada = sanitizarTexto(values.tutorCedula);
      const whatsappNormalizado = normalizarTelefono(values.tutorWhatsapp);
      const correoSanitizado = sanitizarCorreo(values.tutorCorreo);

      const { data: existingTutor } = await this.supabaseService.db('tutores')
        .select('id')
        .eq('cedula', cedulaSanitizada)
        .maybeSingle();

      const tutorPayload = {
        nombres_apellidos: sanitizarTexto(values.tutorNombre),
        cedula: cedulaSanitizada,
        alias: sanitizarTexto(values.tutorAlias),
        parentesco: sanitizarTexto(values.tutorParentesco),
        correo: correoSanitizado,
        contacto_adicional_nombre: sanitizarTexto(values.tutorContactoAdicional),
        whatsapp: whatsappNormalizado
      };

      if (existingTutor) {
        tutorIdFinal = existingTutor.id;
        await this.supabaseService.db('tutores').update(tutorPayload).eq('id', tutorIdFinal);
      } else {
        const { data: tutorData, error: tutorError } = await this.supabaseService.db('tutores')
          .insert(tutorPayload)
          .select('id')
          .single();
        if (tutorError) throw new Error(`Error al registrar adulto responsable: ${tutorError.message}`);
        tutorIdFinal = tutorData.id;
      }

      // 2. PASO DOS: Para cada niño, insertarlo o actualizarlo, y luego crear su sesión
      for (const nino of values.ninos) {
        let ninoIdFinal: string | null = nino.ninoId || null;

        if (!ninoIdFinal) {
          // Verificar si este niño ya existe por nombre
          const { data: existingNino } = await this.supabaseService.db('ninos')
            .select('id')
            .eq('nombres_apellidos', sanitizarTexto(nino.ninoNombre))
            .maybeSingle();
            
          if (existingNino) {
            ninoIdFinal = existingNino.id;
          }
        }

        const ninoPayload = {
          nombres_apellidos: sanitizarTexto(nino.ninoNombre),
          alias: sanitizarTexto(nino.ninoAlias),
          fecha_nacimiento: nino.ninoFechaNacimiento,
          codigo_especifico: sanitizarTexto(nino.ninoCodigo),
          notas: sanitizarTexto(nino.ninoNotas)
        };

        if (ninoIdFinal) {
          await this.supabaseService.db('ninos').update(ninoPayload).eq('id', ninoIdFinal);
        } else {
          const { data: ninoData, error: ninoError } = await this.supabaseService.db('ninos')
            .insert(ninoPayload)
            .select('id')
            .single();
          if (ninoError) throw new Error(`Error al registrar niño: ${ninoError.message}`);
          ninoIdFinal = ninoData.id;
          if (ninoIdFinal) {
            ninosIdsCreados.push(ninoIdFinal);
          }
        }
        
        // --- MANAGE MANY-TO-MANY LINK ---
        const { data: linkExistente, error: linkError } = await this.supabaseService.db('ninos_tutores')
          .select('*')
          .eq('tutor_id', tutorIdFinal)
          .eq('nino_id', ninoIdFinal)
          .maybeSingle();
          
        if (!linkExistente && !linkError) {
           await this.supabaseService.db('ninos_tutores').insert({
             tutor_id: tutorIdFinal,
             nino_id: ninoIdFinal
           });
        }

        // 3. PASO TRES: Calcular tiempos y abrir la sesión de juego para ESTE niño
        const horaIngreso = new Date();
        const minutosAAgregar = parseInt(values.tiempoMinutos || '30');
        const totalMinutos = minutosAAgregar;
        const horaSalidaEstimada = new Date(horaIngreso.getTime() + totalMinutos * 60000);
        
        const adultosAdicionales = parseInt(values.adultosExtra || '0');
        const costoExtraInicial = adultosAdicionales * this.precioAdultoExtra;
        const costoBase = minutosAAgregar === 60 ? 10 : 7;

        const { error: sesionError } = await this.supabaseService.db('sesiones_juego')
          .insert({
            nino_id: ninoIdFinal,
            ingreso_at: horaIngreso.toISOString(),
            salida_estimada_at: horaSalidaEstimada.toISOString(),
            estado: 'ACTIVO',
            minutos_contratados: minutosAAgregar,
            adultos_adicionales: adultosAdicionales,
            costo_base: costoBase,
            costo_extra: costoExtraInicial,
            minutos_extra: 0,
            encargado_id: encargadoId
          });

        if (sesionError) throw new Error(`Error al iniciar sesión para ${nino.ninoNombre}: ${sesionError.message}`);
      }

      // Enviar mensaje de bienvenida por WhatsApp al tutor
      if (whatsappNormalizado) {
        let telefono = whatsappNormalizado;

        let mensajeBienvenida = "Bienvenida/o a Vida Pequeña, disfruta de los juegos junto a tus pequeños";
        try {
          const { data: config } = await this.supabaseService.db('configuracion_sistema')
            .select('msg_bienvenida')
            .limit(1)
            .maybeSingle();

          if (config?.msg_bienvenida && config.msg_bienvenida.trim() !== '') {
            mensajeBienvenida = config.msg_bienvenida;

            const preferidoTutor = (values.tutorAlias && values.tutorAlias.trim()) 
              ? values.tutorAlias.trim() 
              : (values.tutorNombre || '').trim();

            const nombresPreferidosNinos = values.ninos
              .map((n: any) => (n.ninoAlias && n.ninoAlias.trim()) ? n.ninoAlias.trim() : n.ninoNombre)
              .filter(Boolean)
              .join(', ');

            const nombresCompletosNinos = values.ninos
              .map((n: any) => n.ninoNombre)
              .filter(Boolean)
              .join(', ');

            // Nombre preferido / Diminutivo Tutor
            mensajeBienvenida = mensajeBienvenida.replace(/\{nombre_preferido_tutor\}|\{diminutivo_tutor\}|\{alias_tutor\}|\{preferido_tutor\}|\{nombre_preferido_adulto\}|\{diminutivo_adulto\}|\[nombre_preferido_tutor\]|\[diminutivo_tutor\]|\[alias_tutor\]|\[preferido_tutor\]|\[nombre_preferido_adulto\]|\[diminutivo_adulto\]/gi, preferidoTutor);
            
            // Nombre preferido / Diminutivo Niño(s)
            mensajeBienvenida = mensajeBienvenida.replace(/\{nombre_preferido_nino\}|\{diminutivo_nino\}|\{alias_nino\}|\{preferido_nino\}|\[nombre_preferido_nino\]|\[diminutivo_nino\]|\[alias_nino\]|\[preferido_nino\]/gi, nombresPreferidosNinos ? `*${nombresPreferidosNinos}*` : '');

            // Nombre Completo Tutor
            mensajeBienvenida = mensajeBienvenida.replace(/\{nombre_tutor\}|\{tutor\}|\{nombre_adulto\}|\{adulto\}|\[nombre_tutor\]|\[tutor\]|\[nombre_adulto\]|\[adulto\]/gi, values.tutorNombre || preferidoTutor);

            // Nombre Completo Niño(s)
            mensajeBienvenida = mensajeBienvenida.replace(/\{nombre_nino\}|\{nino\}|\{niño\}|\{nombre_niño\}|\[nombre_nino\]|\[nino\]|\[niño\]|\[nombre_niño\]/gi, nombresCompletosNinos ? `*${nombresCompletosNinos}*` : '');
            
            // Minutos de la sesión
            const minutosAsignados = values.tiempoMinutos || '30';
            mensajeBienvenida = mensajeBienvenida.replace(/\{minutos\}|\{tiempo\}|\[minutos\]|\[tiempo\]/gi, minutosAsignados);
          }
        } catch (configErr) {
          console.error('Error cargando mensaje de bienvenida configurado:', configErr);
        }

        const mensajeCodificado = encodeURIComponent(mensajeBienvenida);
        const url = `https://api.whatsapp.com/send?phone=${telefono}&text=${mensajeCodificado}`;
        
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      // Éxito absoluto -> Volvemos al panel de control para ver las tarjetas
      this.router.navigate(['/dashboard']);

    } catch (err: any) {
      console.error(err);
      
      // Rollback manual de niños nuevos creados
      for (const id of ninosIdsCreados) {
        await this.supabaseService.db('ninos').delete().eq('id', id);
      }

      this.errorMessage = err.message || 'Ocurrió un error inesperado en el servidor.';
      await this.abrirDialogo('Error al Registrar Entrada', this.errorMessage, [], 'error', 'Entendido');
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  cancelar() {
    this.router.navigate(['/dashboard']);
  }
}
