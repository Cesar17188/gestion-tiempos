import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { Ingreso } from './ingreso';
import { SupabaseService } from '../../core/services/supabase/supabase';
import { MockSupabaseService } from '../../core/testing/mock-supabase.service';

describe('Ingreso', () => {
  let component: Ingreso;
  let fixture: ComponentFixture<Ingreso>;
  let supabaseMock: any;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Ingreso],
      providers: [
        provideNoopAnimations(), 
        provideRouter([{ path: 'dashboard', children: [] }]),
        { provide: SupabaseService, useClass: MockSupabaseService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Ingreso);
    component = fixture.componentInstance;
    supabaseMock = TestBed.inject(SupabaseService);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('debería inicializarse con el formulario de tutor vacío y al menos un niño', () => {
    expect(component).toBeTruthy();
    expect(component.ingresoForm.valid).toBeFalsy();
    expect(component.ninosFormArray.length).toBe(1); // Debe haber 1 niño por defecto
  });

  it('debería permitir agregar y remover niños dinámicamente', () => {
    component.agregarNino();
    expect(component.ninosFormArray.length).toBe(2);

    component.removerNino(1);
    expect(component.ninosFormArray.length).toBe(1);

    // No debe permitir remover si solo queda 1
    component.removerNino(0);
    expect(component.ninosFormArray.length).toBe(1);
  });

  it('debería autocompletar el formulario al buscar una cédula existente', async () => {
    // Simulamos la respuesta de tutor y niños
    supabaseMock.db().maybeSingle.mockResolvedValueOnce({ 
      data: { id: 't1', nombres_apellidos: 'Tutor de prueba', parentesco: 'Padre' }, 
      error: null 
    });
    supabaseMock.db().order.mockResolvedValueOnce({
      data: [{ nombres_apellidos: 'Niño 1', fecha_nacimiento: '2020-01-01T00:00:00Z' }],
      error: null
    });

    component.ingresoForm.get('tutorCedula')?.setValue('1234567890');
    await component.buscarPorCedula();

    expect(component.ingresoForm.get('tutorNombre')?.value).toBe('Tutor de prueba');
    expect(component.ninosFormArray.length).toBe(1);
    expect(component.ninosFormArray.at(0).get('ninoNombre')?.value).toBe('Niño 1');
  });

  it('NO debería llamar al servidor al enviar si el formulario es inválido', async () => {
    const insertSpy = vi.spyOn(supabaseMock.db(), 'insert');
    await component.onSubmit();
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it('debería guardar el registro y redirigir cuando el formulario es válido', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    vi.spyOn(window, 'open').mockImplementation(() => null);

    // Llenar formulario con datos válidos
    component.ingresoForm.patchValue({
      tutorNombre: 'Carlos',
      tutorCedula: '0987654321',
      tutorParentesco: 'Tío',
      tutorWhatsapp: '0999999999',
      tiempoMinutos: '30'
    });
    
    component.ninosFormArray.at(0).patchValue({
      ninoNombre: 'Pedrito',
      ninoFechaNacimiento: '2015-05-05',
      ninoCodigo: 'ABCDE'
    });

    // Simulamos que el tutor y el niño no existen (retorna null en maybeSingle)
    supabaseMock.db().maybeSingle
      .mockResolvedValueOnce({ data: null }) // tutor
      .mockResolvedValueOnce({ data: null }) // nino

    // Mockeamos la inserción para retornar un ID dummy
    supabaseMock.db().single.mockResolvedValue({ data: { id: 'nuevo-id' } });

    await component.onSubmit();

    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
    expect(window.open).toHaveBeenCalled(); // Whatsapp
  });
});
