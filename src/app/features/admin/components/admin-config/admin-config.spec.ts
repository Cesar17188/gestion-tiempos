import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { AdminConfig } from './admin-config';
import { SupabaseService } from '../../../../core/services/supabase/supabase';
import { MockSupabaseService } from '../../../../core/testing/mock-supabase.service';

describe('AdminConfig', () => {
  let component: AdminConfig;
  let fixture: ComponentFixture<AdminConfig>;
  let supabaseMock: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminConfig],
      providers: [
        { provide: SupabaseService, useClass: MockSupabaseService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminConfig);
    component = fixture.componentInstance;
    supabaseMock = TestBed.inject(SupabaseService);

    // Mock initial data load
    supabaseMock.db().single.mockResolvedValue({ 
      data: { precio_base: 10, minutos_base: 60, precio_minuto_extra: 5 }, 
      error: null 
    });
    supabaseMock.db().order.mockResolvedValue({ 
      data: [{ id: 1, nombre: 'Admin', rol: 'ADMINISTRADOR' }], 
      error: null 
    });

    fixture.detectChanges();
  });

  it('debería inicializarse y cargar datos', async () => {
    expect(component).toBeTruthy();
    expect(component.configForm).toBeDefined();
    expect(component.personalForm).toBeDefined();
    
    // Debería haberse parcheado con los datos del mock
    await fixture.whenStable();
    expect(component.configForm.get('precio_base')?.value).toBe(10);
    expect(component.listaPersonal.length).toBe(1);
  });

  it('debería actualizar configuración y mostrar feedback', async () => {
    const updateSpy = vi.spyOn(supabaseMock.db(), 'update');
    component.configForm.patchValue({ msg_bienvenida: 'Hola', msg_advertencia_5min: 'Aviso', msg_tiempo_cumplido: 'Fin' });
    
    await component.guardarConfiguracion();

    expect(updateSpy).toHaveBeenCalled();
    expect(component.mensajeFeedback).toBe('Cambios guardados exitosamente');
  });

  it('debería registrar colaborador y recargar datos', async () => {
    const cargarDatosSpy = vi.spyOn(component, 'cargarDatos');
    
    // Mock dialogo para que no se detenga la ejecución
    vi.spyOn(component, 'abrirDialogo').mockResolvedValue(true);

    component.personalForm.setValue({
      email: 'nuevo@test.com',
      nombre: 'Nuevo',
      rol: 'ENCARGADO'
    });

    await component.registrarColaborador();

    expect(component.abrirDialogo).toHaveBeenCalled();
    expect(component.personalForm.get('nombre')?.value).toBeNull(); // El form se reseteó
    expect(cargarDatosSpy).toHaveBeenCalled();
  });
});
