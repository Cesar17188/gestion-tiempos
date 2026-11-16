import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { AdminDescargas } from './admin-descargas';
import { SupabaseService } from '../../../../core/services/supabase/supabase';
import { MockSupabaseService } from '../../../../core/testing/mock-supabase.service';

describe('AdminDescargas', () => {
  let component: AdminDescargas;
  let fixture: ComponentFixture<AdminDescargas>;
  let supabaseMock: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDescargas],
      providers: [
        { provide: SupabaseService, useClass: MockSupabaseService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDescargas);
    component = fixture.componentInstance;
    supabaseMock = TestBed.inject(SupabaseService);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('debería mostrar en el historial de sesiones al adulto responsable que llevó al niño en esa sesión y no siempre al último registrado', async () => {
    const tutoresDelNino = [
      { id: 'tutor-1', nombres_apellidos: 'Mamá Laura', parentesco: 'Mamá', created_at: '2026-11-01T10:00:00.000Z' },
      { id: 'tutor-2', nombres_apellidos: 'Abuela Elena', parentesco: 'Abuelo(a)', created_at: '2026-11-10T16:00:00.000Z' }
    ];

    const sesionesMock = [
      {
        id: 'sesion-reciente',
        nino_id: 'nino-1',
        tutor_id: 'tutor-2',
        ingreso_at: '2026-11-10T16:05:00.000Z',
        salida_estimada_at: '2026-11-10T16:35:00.000Z',
        estado: 'FINALIZADO',
        costo_base: 7,
        costo_extra: 0,
        minutos_extra: 0,
        ninos: {
          id: 'nino-1',
          nombres_apellidos: 'Mateo Rodríguez',
          fecha_nacimiento: '2020-05-10',
          tutores: tutoresDelNino
        }
      },
      {
        id: 'sesion-antigua',
        nino_id: 'nino-1',
        tutor_id: 'tutor-1',
        ingreso_at: '2026-11-01T10:05:00.000Z',
        salida_estimada_at: '2026-11-01T10:35:00.000Z',
        estado: 'FINALIZADO',
        costo_base: 7,
        costo_extra: 0,
        minutos_extra: 0,
        ninos: {
          id: 'nino-1',
          nombres_apellidos: 'Mateo Rodríguez',
          fecha_nacimiento: '2020-05-10',
          tutores: tutoresDelNino
        }
      }
    ];

    supabaseMock.from().then
      .mockImplementationOnce((resolve: any) => resolve({ data: sesionesMock, error: null }))
      .mockImplementationOnce((resolve: any) => resolve({ data: tutoresDelNino, error: null }));

    await (component as any).cargarSesiones();

    expect(component.baseCompletaAplanada.length).toBe(2);
    const sesionReciente = component.baseCompletaAplanada.find(s => s.ID_Sesion === 'sesion-reciente');
    const sesionAntigua = component.baseCompletaAplanada.find(s => s.ID_Sesion === 'sesion-antigua');

    expect(sesionReciente.Tutor_Responsable).toBe('Abuela Elena');
    expect(sesionAntigua.Tutor_Responsable).toBe('Mamá Laura');
  });
});
