import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { vi } from 'vitest';

import { Dashboard } from './dashboard';
import { SupabaseService } from '../../../core/services/supabase/supabase';
import { MockSupabaseService } from '../../../core/testing/mock-supabase.service';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;
  let supabaseMock: any;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([{ path: 'login', children: [] }]), 
        provideNoopAnimations(),
        { provide: SupabaseService, useClass: MockSupabaseService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    supabaseMock = TestBed.inject(SupabaseService);
    router = TestBed.inject(Router);

    // Mock initial data load
    const now = new Date();
    const tenMinutesFromNow = new Date(now.getTime() + 10 * 60000);

    supabaseMock.db().single.mockResolvedValue({ 
      data: { rol: 'ADMINISTRADOR', nombre: 'Admin', avatar_url: null }, 
      error: null 
    });

    supabaseMock.db().or = vi.fn().mockResolvedValue({
      data: [{
        id: 'sesion-1',
        ingreso_at: now.toISOString(),
        salida_estimada_at: tenMinutesFromNow.toISOString(),
        costo_base: 30,
        ninos: {
          nombres_apellidos: 'Niño 1',
          tutores: { nombres_apellidos: 'Tutor 1' }
        }
      }],
      error: null
    });
    
    // Mock the channel method
    supabaseMock.supabase.channel = vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn()
    });

    supabaseMock.supabase.removeChannel = vi.fn();

    vi.useFakeTimers();

    // Re-assign the mock data now that timers are fake, so 'now' is exact.
    const fakeNow = new Date();
    const fakeTenMinutesFromNow = new Date(fakeNow.getTime() + 10 * 60000);
    supabaseMock.db().or.mockResolvedValue({
      data: [{
        id: 'sesion-1',
        ingreso_at: fakeNow.toISOString(),
        salida_estimada_at: fakeTenMinutesFromNow.toISOString(),
        costo_base: 30,
        ninos: {
          nombres_apellidos: 'Niño 1',
          tutores: { nombres_apellidos: 'Tutor 1' }
        }
      }],
      error: null
    });

    // Angular needs to render after fake timers are set
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debería inicializarse y cargar datos', async () => {
    expect(component).toBeTruthy();
    
    // Wait for promises to resolve
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(component.sesiones.length).toBe(1);
    expect(component.sesiones[0].nombreNino).toBe('Niño 1');
    expect(component.sesiones[0].estadoAlerta).toBe('normal');
  });

  it('debería actualizar el estado a advertencia cuando faltan <= 5 min', async () => {
    await Promise.resolve();
    
    // Avanzamos 5 minutos (300,000 ms)
    // De 10 min, pasaría a 5 min restantes.
    vi.advanceTimersByTime(5 * 60000);
    
    expect(component.sesiones[0].estadoAlerta).toBe('advertencia');
    expect(component.sesiones[0].minutosRestantes).toBe(5);
  });

  it('debería actualizar el estado a expirado cuando se agota el tiempo', async () => {
    await Promise.resolve();
    
    // Avanzamos 10 minutos (600,000 ms)
    vi.advanceTimersByTime(10 * 60000);
    
    expect(component.sesiones[0].estadoAlerta).toBe('expirado');
    expect(component.sesiones[0].minutosRestantes).toBe(0);
  });

  it('debería agregar media hora y actualizar el costo', async () => {
    await Promise.resolve();
    
    const sesion = component.sesiones[0];
    const updateSpy = vi.spyOn(supabaseMock.db(), 'update');
    component.precioPaqueteExtra = 3;

    await component.agregarMediaHora(sesion);

    expect(updateSpy).toHaveBeenCalled();
    expect(sesion.minutosExtra).toBe(30);
    expect(sesion.costoExtra).toBe(3);
    expect(sesion.extensionAplicada).toBe(true);
  });
});
