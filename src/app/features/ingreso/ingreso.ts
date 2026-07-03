import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { SupabaseService } from '../../core/services/supabase/supabase';

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
export class Ingreso {
  private fb = inject(FormBuilder);
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  isLoading = false;
  isSearching = false;
  errorMessage = '';
  searchMessage = '';

  isSearchingNino = false;
  searchNinoMessage = '';
  searchingNinoIndex = -1;
  resultadosBusquedaNinos: { [index: number]: any[] } = {};

  // Estructura del formulario con validaciones requeridas
  ingresoForm: FormGroup = this.fb.group({
    // Datos del Tutor
    tutorNombre: ['', [Validators.required, Validators.minLength(4)]],
    tutorCedula: ['', [Validators.required]],
    tutorAlias: [''],
    tutorParentesco: ['', [Validators.required]],
    tutorCorreo: ['', [Validators.email]],
    tutorContactoAdicional: [''],
    tutorWhatsapp: ['', [Validators.required, Validators.pattern('^[0-9]{9,15}$')]], // Permite formatos internacionales

    // FormArray para los Niños
    ninos: this.fb.array([this.crearNinoFormGroup()]),

    // Configuración de la Sesión (Aplica a todos los niños del formulario)
    tiempoMinutos: ['30', [Validators.required]], // Por defecto 30 minutos
    adultosExtra: ['0', [Validators.min(0)]]
  });

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
      ninoNotas: [''] // Alergias, observaciones, quién lo retira, etc.
    });
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
      this.cdr.detectChanges();
      setTimeout(() => { this.searchMessage = ''; this.cdr.detectChanges(); }, 3000);
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
          console.log('Niños encontrados:', ninosData);
          this.ninosFormArray.clear();
          ninosData.forEach((nino) => {
            const ninoGroup = this.crearNinoFormGroup();
            
            // Formatear la fecha a YYYY-MM-DD para el input type="date"
            let fechaParsed = '';
            if (nino.fecha_nacimiento) {
              fechaParsed = nino.fecha_nacimiento.split('T')[0];
            }

            ninoGroup.patchValue({
              ninoId: nino.id,
              ninoNombre: nino.nombres_apellidos || '',
              ninoAlias: nino.alias || '',
              ninoFechaNacimiento: fechaParsed,
              ninoCodigo: nino.codigo_especifico || ninoGroup.get('ninoCodigo')?.value,
              ninoNotas: nino.notas || ''
            });
            this.ninosFormArray.push(ninoGroup);
          });
          this.cdr.detectChanges();
          this.searchMessage = `Datos cargados exitosamente. Se encontraron ${ninosData.length} niño(s).`;
        } else {
          console.log('No se encontraron niños o hubo un error:', ninosError);
          this.searchMessage = 'Tutor encontrado exitosamente, pero no tiene niños registrados aún.';
        }
      } else {
        this.searchMessage = 'No se encontró un tutor con esa cédula.';
      }
    } catch (error) {
      console.error('Error buscando cédula:', error);
      this.searchMessage = 'Error al buscar datos.';
    } finally {
      this.isSearching = false;
      this.cdr.detectChanges();
      setTimeout(() => { this.searchMessage = ''; this.cdr.detectChanges(); }, 3000);
    }
  }

  async buscarPorNombreNino(index: number) {
    const ninoControl = this.ninosFormArray.at(index).get('ninoNombre');
    if (!ninoControl || !ninoControl.value || ninoControl.value.trim() === '') {
      this.searchNinoMessage = 'Ingrese un nombre para buscar.';
      this.searchingNinoIndex = index;
      this.cdr.detectChanges();
      setTimeout(() => { this.searchNinoMessage = ''; this.cdr.detectChanges(); }, 3000);
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
        setTimeout(() => { this.searchNinoMessage = ''; this.searchingNinoIndex = -1; this.cdr.detectChanges(); }, 4000);
      }
    } catch (error) {
      console.error('Error buscando niño:', error);
      this.searchNinoMessage = 'Error al buscar datos.';
      setTimeout(() => { this.searchNinoMessage = ''; this.searchingNinoIndex = -1; this.cdr.detectChanges(); }, 4000);
    } finally {
      this.isSearchingNino = false;
      this.cdr.detectChanges();
    }
  }

  async seleccionarNino(index: number, ninoData: any) {
    this.resultadosBusquedaNinos[index] = []; // Ocultar el dropdown
    this.searchNinoMessage = '';
    
    if (ninoData.tutorSeleccionado) {
      // Usamos el tutor seleccionado específicamente desde la lista aplanada
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
          todosNinosData.forEach((nino: any) => {
            const ninoGroup = this.crearNinoFormGroup();
            let fechaParsed = '';
            if (nino.fecha_nacimiento) {
              fechaParsed = nino.fecha_nacimiento.split('T')[0];
            }
            ninoGroup.patchValue({
              ninoId: nino.id,
              ninoNombre: nino.nombres_apellidos || '',
              ninoAlias: nino.alias || '',
              ninoFechaNacimiento: fechaParsed,
              ninoCodigo: nino.codigo_especifico || ninoGroup.get('ninoCodigo')?.value,
              ninoNotas: nino.notas || ''
            });
            this.ninosFormArray.push(ninoGroup);
          });
          this.searchNinoMessage = `Datos del tutor y ${todosNinosData.length} niño(s) cargados exitosamente.`;
        }
      } catch (error) {
        console.error('Error buscando hermanos:', error);
      } finally {
        this.isSearchingNino = false;
        this.searchingNinoIndex = -1;
        this.cdr.detectChanges();
        setTimeout(() => { this.searchNinoMessage = ''; this.cdr.detectChanges(); }, 4000);
      }
      }
    }
  }

  async onSubmit() {
    if (this.ingresoForm.invalid) {
      this.ingresoForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const values = this.ingresoForm.value;
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
      const { data: existingTutor } = await this.supabaseService.db('tutores')
        .select('id')
        .eq('cedula', values.tutorCedula)
        .maybeSingle();

      const tutorPayload = {
        nombres_apellidos: values.tutorNombre,
        cedula: values.tutorCedula,
        alias: values.tutorAlias,
        parentesco: values.tutorParentesco,
        correo: values.tutorCorreo,
        contacto_adicional_nombre: values.tutorContactoAdicional,
        whatsapp: values.tutorWhatsapp
      };

      if (existingTutor) {
        tutorIdFinal = existingTutor.id;
        await this.supabaseService.db('tutores').update(tutorPayload).eq('id', tutorIdFinal);
      } else {
        const { data: tutorData, error: tutorError } = await this.supabaseService.db('tutores')
          .insert(tutorPayload)
          .select('id')
          .single();
        if (tutorError) throw new Error(`Error al registrar tutor: ${tutorError.message}`);
        tutorIdFinal = tutorData.id;
      }

      // 2. PASO DOS: Para cada niño, insertarlo o actualizarlo, y luego crear su sesión
      for (const nino of values.ninos) {
        let ninoIdFinal: string | null = nino.ninoId || null;

        if (!ninoIdFinal) {
          // Verificar si este niño ya existe por nombre
          const { data: existingNino } = await this.supabaseService.db('ninos')
            .select('id')
            .eq('nombres_apellidos', nino.ninoNombre)
            .maybeSingle();
            
          if (existingNino) {
            ninoIdFinal = existingNino.id;
          }
        }

        const ninoPayload = {
          nombres_apellidos: nino.ninoNombre,
          alias: nino.ninoAlias,
          fecha_nacimiento: nino.ninoFechaNacimiento,
          codigo_especifico: nino.ninoCodigo,
          notas: nino.ninoNotas
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
            ninosIdsCreados.push(ninoIdFinal); // Guardar para posible rollback
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
        const costoExtraInicial = adultosAdicionales * 2.00;
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
      if (values.tutorWhatsapp) {
        const mensajeBienvenida = "Bienvenida/o a Vida Pequeña, disfruta de los juegos junto a tus pequeños";
        const mensajeCodificado = encodeURIComponent(mensajeBienvenida);
        const url = `https://wa.me/${values.tutorWhatsapp}?text=${mensajeCodificado}`;
        window.open(url, '_blank');
      }

      // Éxito absoluto -> Volvemos al panel de control para ver las tarjetas
      this.router.navigate(['/dashboard']);

    } catch (err: any) {
      console.error(err);
      
      // Rollback manual de niños nuevos creados
      for (const id of ninosIdsCreados) {
        await this.supabaseService.db('ninos').delete().eq('id', id);
      }
      // No borramos el tutor si ya existía, sería peligroso. Solo borramos si lo acabamos de crear.
      // Pero por simplicidad de este prototipo, dejaremos el tutor si fallan las sesiones.

      this.errorMessage = err.message || 'Ocurrió un error inesperado en el servidor.';
    } finally {
      this.isLoading = false;
    }
  }

  cancelar() {
    this.router.navigate(['/dashboard']);
  }
}
