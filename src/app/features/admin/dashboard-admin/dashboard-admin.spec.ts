import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { vi } from 'vitest';

import { DashboardAdmin } from './dashboard-admin';
import { SupabaseService } from '../../../core/services/supabase/supabase';
import { MockSupabaseService } from '../../../core/testing/mock-supabase.service';

describe('DashboardAdmin', () => {
  let component: DashboardAdmin;
  let fixture: ComponentFixture<DashboardAdmin>;
  let supabaseMock: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardAdmin],
      providers: [
        provideRouter([{ path: 'login', children: [] }]), 
        provideNoopAnimations(),
        { provide: SupabaseService, useClass: MockSupabaseService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardAdmin);
    component = fixture.componentInstance;
    supabaseMock = TestBed.inject(SupabaseService);

    // Mocks
    const dbQuery = supabaseMock.db('any');
    dbQuery.then = vi.fn()
      .mockImplementation((resolve: any) => resolve({ data: [], error: null }))
      .mockImplementationOnce((resolve: any) => resolve({
        data: [{ id: 'e1', nombre: 'Encargado 1', rol: 'ENCARGADO' }]
      }))
      .mockImplementationOnce((resolve: any) => resolve({
        data: [
          {
            id: 's1', costo_base: 30, costo_extra: 0, minutos_extra: 0,
            ingreso_at: '2026-06-30T10:00:00Z', salida_estimada_at: '2026-06-30T10:30:00Z',
            encargado_id: 'e1', perfiles: { nombre: 'Encargado 1' }
          },
          {
            id: 's2', costo_base: 30, costo_extra: 3, minutos_extra: 30,
            ingreso_at: '2026-06-30T11:00:00Z', salida_estimada_at: '2026-06-30T12:00:00Z',
            encargado_id: 'e1', perfiles: { nombre: 'Encargado 1' }
          }
        ],
        error: null
      }));

    fixture.detectChanges();
  });

  it('debería inicializarse y cargar datos agrupados', async () => {
    expect(component).toBeTruthy();
    
    await fixture.whenStable();

    // 2 sesiones = 2 niños, $60 costo base + $3 extra = $63
    // Minutos jugados: (30min de s1) + (60min de s2) = 90 minutos
    expect(component.totalNinos).toBe(2);
    expect(component.totalRecaudado).toBe(63);
    expect(component.totalMinutosJugados).toBe(90);

    // Métrica de encargados
    expect(component.metricasEncargados.length).toBe(1);
    expect(component.metricasEncargados[0].ninosIngresados).toBe(2);
    expect(component.metricasEncargados[0].recaudado).toBe(63);
  });

  it('debería actualizar filtros correctamente', async () => {
    const procesarSpy = vi.spyOn(component, 'procesarDashboard');
    
    await component.actualizarFiltros({ inicio: '2026-01-01', fin: '2026-01-31', encargado: 'e1' });

    expect(component.fechaInicio).toBe('2026-01-01');
    expect(component.fechaFin).toBe('2026-01-31');
    expect(component.encargadoFiltro).toBe('e1');
    expect(procesarSpy).toHaveBeenCalled();
  });
});
