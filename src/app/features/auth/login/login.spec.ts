import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { Login } from './login';
import { SupabaseService } from '../../../core/services/supabase/supabase';
import { MockSupabaseService } from '../../../core/testing/mock-supabase.service';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let supabaseMock: any;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([{ path: 'dashboard', children: [] }]),
        { provide: SupabaseService, useClass: MockSupabaseService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    supabaseMock = TestBed.inject(SupabaseService);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('debería inicializarse con el formulario vacío e inválido', () => {
    expect(component).toBeTruthy();
    expect(component.loginForm.valid).toBeFalsy();
    expect(component.loginForm.get('email')?.value).toBe('');
    expect(component.loginForm.get('password')?.value).toBe('');
  });

  it('debería validar requerimientos del formulario (email y password > 6)', () => {
    const emailCtrl = component.loginForm.get('email');
    const passCtrl = component.loginForm.get('password');

    emailCtrl?.setValue('correo_invalido');
    passCtrl?.setValue('12345');
    expect(component.loginForm.invalid).toBeTruthy();

    emailCtrl?.setValue('test@test.com');
    passCtrl?.setValue('123456');
    expect(component.loginForm.valid).toBeTruthy();
  });

  it('NO debería llamar a auth si el formulario es inválido en onSubmit', async () => {
    const authSpy = vi.spyOn(supabaseMock.auth, 'signInWithPassword');
    await component.onSubmit();
    expect(authSpy).not.toHaveBeenCalled();
  });

  it('debería llamar a signInWithPassword y redirigir si el login es exitoso', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    
    // Configurar el formulario válido
    component.loginForm.setValue({ email: 'test@test.com', password: 'password123' });
    
    // Simulamos que el perfil devuelto no es ENCARGADO (ej. ADMINISTRADOR), para pasar directo al dashboard
    supabaseMock.db().single.mockResolvedValueOnce({ data: { rol: 'ADMINISTRADOR' }, error: null });

    await component.onSubmit();

    expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'test@test.com', password: 'password123' });
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
  });

  it('debería mostrar error si falla la recuperación de contraseña', async () => {
    component.loginForm.get('email')?.setValue('test@test.com');
    
    // Simulamos que el correo no existe en la DB
    supabaseMock.db().maybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'No existe' } });

    await component.recoverPassword();

    expect(component.errorMessage).toBe('El correo ingresado no está registrado en el sistema.');
  });
});
