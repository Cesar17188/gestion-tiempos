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
    expect(component.mensajeFeedback).toBe('Ajustes del negocio guardados correctamente');
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

  it('debería actualizar el personal con el nuevo rol correctamente', async () => {
    const updateSpy = vi.spyOn(supabaseMock.db(), 'update');
    const perfil = { id: 'user-1', nombre: 'Carla', rol: 'ENCARGADO', activo: true, hora_entrada: '09:00', hora_salida: '18:00' };
    
    perfil.rol = 'ADMINISTRADOR';
    await component.actualizarPersonal(perfil);

    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      rol: 'ADMINISTRADOR',
      activo: true
    }));
    expect(component.mensajeFeedback).toContain('Carla');
  });

  it('debería cambiar el rol del usuario directamente al confirmar el diálogo', async () => {
    const updateSpy = vi.spyOn(supabaseMock.db(), 'update');
    vi.spyOn(component, 'abrirDialogo').mockResolvedValue(true);
    
    const perfil = { id: 'user-2', nombre: 'Sofía', rol: 'ENCARGADO', activo: true };
    const mockSelect = { value: 'ADMINISTRADOR' } as HTMLSelectElement;
    const mockEvent = { target: mockSelect } as unknown as Event;

    await component.cambiarRolUsuario(perfil, mockEvent);

    expect(component.abrirDialogo).toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      rol: 'ADMINISTRADOR'
    }));
    expect(perfil.rol).toBe('ADMINISTRADOR');
  });
});
