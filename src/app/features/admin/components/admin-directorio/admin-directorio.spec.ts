import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AdminDirectorio } from './admin-directorio';
import { SupabaseService } from '../../../../core/services/supabase/supabase';
import { MockSupabaseService } from '../../../../core/testing/mock-supabase.service';

describe('AdminDirectorio', () => {
  let component: AdminDirectorio;
  let fixture: ComponentFixture<AdminDirectorio>;
  let supabaseMock: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDirectorio],
      providers: [
        { provide: SupabaseService, useClass: MockSupabaseService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDirectorio);
    component = fixture.componentInstance;
    supabaseMock = TestBed.inject(SupabaseService);
  });

  it('debería cargar las dos tablas (adultos con sus niños y niños con el adulto de cada sesión)', async () => {
    const tutoresMock = [
      { id: 't1', nombres_apellidos: 'Laura Sánchez', cedula: '1713394748', parentesco: 'Mamá', whatsapp: '593991234567' },
      { id: 't2', nombres_apellidos: 'Elena Gómez', cedula: '0922488499', parentesco: 'Abuelo(a)', whatsapp: '593987654321' }
    ];
    const ninosMock = [
      { id: 'n1', nombres_apellidos: 'Mateo Rodríguez', alias: 'Mate', fecha_nacimiento: '2020-05-10', codigo_especifico: 'COD1' }
    ];
    const relacionesMock = [
      { tutor_id: 't1', nino_id: 'n1' },
      { tutor_id: 't2', nino_id: 'n1' }
    ];
    const sesionesMock = [
      { id: 's1', nino_id: 'n1', tutor_id: 't1', ingreso_at: '2026-11-10T10:00:00.000Z', salida_estimada_at: '2026-11-10T10:30:00.000Z', estado: 'FINALIZADO' },
      { id: 's2', nino_id: 'n1', tutor_id: 't2', ingreso_at: '2026-11-15T16:00:00.000Z', salida_estimada_at: '2026-11-15T16:30:00.000Z', estado: 'FINALIZADO' }
    ];

    supabaseMock.db().then
      .mockImplementationOnce((resolve: any) => resolve({ data: tutoresMock, error: null }))
      .mockImplementationOnce((resolve: any) => resolve({ data: ninosMock, error: null }))
      .mockImplementationOnce((resolve: any) => resolve({ data: relacionesMock, error: null }))
      .mockImplementationOnce((resolve: any) => resolve({ data: sesionesMock, error: null }));

    fixture.detectChanges();
    await vi.waitFor(() => {
      expect(component.isLoading).toBe(false);
    });

    // Tabla 1: Adultos responsables y sus niños registrados
    expect(component.listaTutoresConNinos.length).toBe(2);
    expect(component.listaTutoresConNinos[0].nombres_apellidos).toBe('Laura Sánchez');
    expect(component.listaTutoresConNinos[0].ninosRegistrados.length).toBe(1);
    expect(component.listaTutoresConNinos[0].ninosRegistrados[0].nombres_apellidos).toBe('Mateo Rodríguez');

    // Tabla 2: Niños, adultos registrados y adulto por cada sesión
    expect(component.listaNinosConSesiones.length).toBe(1);
    expect(component.listaNinosConSesiones[0].tutoresRegistrados.length).toBe(2);
    expect(component.listaNinosConSesiones[0].sesionesHistorial.length).toBe(2);
    expect(component.listaNinosConSesiones[0].sesionesHistorial[0].tutorNombre).toBe('Laura Sánchez');
    expect(component.listaNinosConSesiones[0].sesionesHistorial[1].tutorNombre).toBe('Elena Gómez');
  });

  it('debería permitir editar y eliminar niños y adultos responsables', async () => {
    const updateSpy = vi.spyOn(supabaseMock.db(), 'update');
    const deleteSpy = vi.spyOn(supabaseMock.db(), 'delete');

    const tutor = {
      id: 't1',
      nombres_apellidos: 'Laura Sánchez',
      cedula: '1713394748',
      parentesco: 'Mamá',
      whatsapp: '0991234567',
      ninosRegistrados: []
    };

    component.abrirEditarTutor(tutor);
    component.tutorForm.patchValue({ nombres_apellidos: 'Laura Sánchez Editada' });
    await component.guardarEdicionTutor();
    expect(updateSpy).toHaveBeenCalled();

    component.confirmarEliminarTutor(tutor);
    await component.ejecutarEliminarTutor();
    expect(deleteSpy).toHaveBeenCalled();

    const nino = {
      id: 'n1',
      nombres_apellidos: 'Mateo Rodríguez',
      fecha_nacimiento: '2020-05-10',
      edad: '6 años'
    };

    component.abrirEditarNino(nino);
    component.ninoForm.patchValue({ nombres_apellidos: 'Mateo Rodríguez Editado' });
    await component.guardarEdicionNino();
    expect(updateSpy).toHaveBeenCalled();

    component.confirmarEliminarNino(nino);
    await component.ejecutarEliminarNino();
    expect(deleteSpy).toHaveBeenCalled();
  });

  it('debería permitir añadir un nuevo niño a un adulto responsable y un nuevo adulto responsable a un niño', async () => {
    const insertSpy = vi.spyOn(supabaseMock.db(), 'insert');
    supabaseMock.db().single.mockResolvedValue({ data: { id: 'nuevo-id' }, error: null });
    supabaseMock.db().maybeSingle.mockResolvedValue({ data: null, error: null });

    const tutor = {
      id: 't1',
      nombres_apellidos: 'Laura Sánchez',
      cedula: '1713394748',
      ninosRegistrados: []
    };

    component.abrirAgregarNinoATutor(tutor);
    component.nuevoNinoForm.patchValue({
      nombres_apellidos: 'Sofía Sánchez',
      fecha_nacimiento: '2021-04-12'
    });
    await component.guardarNuevoNinoParaTutor();
    expect(insertSpy).toHaveBeenCalled();

    const nino = {
      id: 'n1',
      nombres_apellidos: 'Mateo Rodríguez',
      edad: '6 años',
      tutoresRegistrados: [],
      sesionesHistorial: []
    };

    component.abrirAgregarTutorANino(nino);
    component.nuevoTutorForm.patchValue({
      cedula: '1713394748',
      nombres_apellidos: 'Carlos Rodríguez',
      parentesco: 'Papá',
      whatsapp: '0991234567'
    });
    await component.guardarNuevoTutorParaNino();
    expect(insertSpy).toHaveBeenCalled();
  });
});
