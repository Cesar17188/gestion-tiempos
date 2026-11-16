import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AdminNinos } from './admin-ninos';
import { SupabaseService } from '../../../../core/services/supabase/supabase';
import { MockSupabaseService } from '../../../../core/testing/mock-supabase.service';

describe('AdminNinos', () => {
  let component: AdminNinos;
  let fixture: ComponentFixture<AdminNinos>;
  let supabaseMock: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminNinos],
      providers: [
        { provide: SupabaseService, useClass: MockSupabaseService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminNinos);
    component = fixture.componentInstance;
    supabaseMock = TestBed.inject(SupabaseService);
  });

  it('should create and load children history automatically on init', async () => {
    supabaseMock.db().then.mockImplementationOnce((resolve: any) =>
      resolve({
        data: [
          {
            nino_id: 'n1',
            ingreso_at: '2026-11-15T14:00:00.000Z',
            salida_estimada_at: '2026-11-15T15:00:00.000Z',
            ninos: { nombres_apellidos: 'Mateo Rodríguez' }
          }
        ],
        error: null
      })
    );

    fixture.detectChanges();
    await vi.waitFor(() => {
      expect(component.isLoading).toBe(false);
    });

    expect(component).toBeTruthy();
    expect(component.isLoading).toBe(false);
    expect(component.reporteNinos.length).toBe(1);
    expect(component.reporteNinos[0].nombreNino).toBe('Mateo Rodríguez');
    expect(component.totalNinosFiltro).toBe(1);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Mateo Rodríguez');
  });
});
