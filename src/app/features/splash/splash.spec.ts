import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { Splash } from './splash';

describe('Splash', () => {
  let component: Splash;
  let fixture: ComponentFixture<Splash>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Splash],
      providers: [provideRouter([])] // Configuración del router falso
    }).compileComponents();

    fixture = TestBed.createComponent(Splash);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  it('debería inicializarse', () => {
    expect(component).toBeTruthy();
  });

  it('debería tener la url del gif cargada correctamente', () => {
    expect(component.gifUrl).toContain('general/Login.gif');
  });

  it('debería navegar a /login después de 6 segundos', () => {
    vi.useFakeTimers();
    const navigateSpy = vi.spyOn(router, 'navigate');
    
    // Llamar a ngOnInit manualmente y disparar el temporizador
    component.ngOnInit();
    
    // Al inicio no debe haberse llamado a navigate
    expect(navigateSpy).not.toHaveBeenCalled();

    // Avanzar el reloj virtual de Vitest 5999ms (antes del límite)
    vi.advanceTimersByTime(5999);
    expect(navigateSpy).not.toHaveBeenCalled();

    // Avanzar 1ms más para completar los 6000ms
    vi.advanceTimersByTime(1);
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);

    vi.useRealTimers();
  });
});
