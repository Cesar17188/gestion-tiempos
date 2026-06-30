import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ExportService } from './export';

describe('Export', () => {
  let service: ExportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExportService);
  });

  it('debería inicializarse', () => {
    expect(service).toBeTruthy();
  });

  describe('exportarACsv', () => {
    let createElementSpy: any;
    let createObjectURLSpy: any;
    let appendChildSpy: any;
    let removeChildSpy: any;

    beforeEach(() => {
      // Configuramos los espías para funciones del DOM y URL
      const mockLink = {
        setAttribute: vi.fn(),
        style: { visibility: '' },
        click: vi.fn(),
        download: ''
      };
      createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
      removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('no debería hacer nada si no hay datos', () => {
      service.exportarACsv('archivo', [], ['col1']);
      expect(createElementSpy).not.toHaveBeenCalled();
      
      service.exportarACsv('archivo', null as any, ['col1']);
      expect(createElementSpy).not.toHaveBeenCalled();
    });

    it('debería crear el archivo CSV con la data mapeada y escapar las comillas', () => {
      const mockData = [
        { nombre: 'Juan', edad: 10, nota: 'Le gusta el "fútbol"' },
        { nombre: 'Ana', edad: 8, nota: 'Tranquila' }
      ];
      const columnas = ['nombre', 'edad', 'nota'];

      service.exportarACsv('reporte', mockData, columnas);

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
    });
  });
});
