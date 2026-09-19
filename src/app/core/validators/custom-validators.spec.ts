import '@angular/compiler';
import { FormControl } from '@angular/forms';
import { describe, it, expect } from 'vitest';
import { 
  validarCorreo, 
  validarTelefono, 
  validarCedulaOPasaporte, 
  normalizarTelefono, 
  formatearTelefonoParaVista, 
  sanitizarTexto, 
  sanitizarCorreo,
  convertirHoraAMinutos,
  normalizarHoraStr,
  estaFueraDeHorario
} from './custom-validators';

describe('Custom Validators', () => {

  describe('validarCorreo', () => {
    const validator = validarCorreo();

    it('debería ser válido si el valor es vacío o nulo (opcional)', () => {
      expect(validator(new FormControl(''))).toBeNull();
      expect(validator(new FormControl(null))).toBeNull();
      expect(validator(new FormControl('   '))).toBeNull();
    });

    it('debería ser válido con correos estándar', () => {
      expect(validator(new FormControl('usuario@dominio.com'))).toBeNull();
      expect(validator(new FormControl('laura.sanchez@empresa.com.ec'))).toBeNull();
      expect(validator(new FormControl('cliente_123+tag@gmail.com'))).toBeNull();
    });

    it('debería ser inválido con correos mal formateados o incompletos', () => {
      expect(validator(new FormControl('usuario@'))).not.toBeNull();
      expect(validator(new FormControl('usuario@dominio'))).not.toBeNull(); // sin TLD
      expect(validator(new FormControl('@dominio.com'))).not.toBeNull();
      expect(validator(new FormControl('usuario@@dominio.com'))).not.toBeNull();
      expect(validator(new FormControl('usuario espacio@dominio.com'))).not.toBeNull();
    });
  });

  describe('validarTelefono', () => {
    const validator = validarTelefono();

    it('debería ser válido si está vacío (el Validators.required se encarga de obligatoriedad)', () => {
      expect(validator(new FormControl(''))).toBeNull();
      expect(validator(new FormControl(null))).toBeNull();
    });

    it('debería aceptar formatos móviles de Ecuador válidos', () => {
      expect(validator(new FormControl('0991234567'))).toBeNull();
      expect(validator(new FormControl('099 123 4567'))).toBeNull();
      expect(validator(new FormControl('593991234567'))).toBeNull();
      expect(validator(new FormControl('+593 99 123 4567'))).toBeNull();
      expect(validator(new FormControl('991234567'))).toBeNull();
    });

    it('debería aceptar números internacionales válidos', () => {
      expect(validator(new FormControl('+13055551234'))).toBeNull();
      expect(validator(new FormControl('+34612345678'))).toBeNull();
    });

    it('debería rechazar números con longitud inválida o dígitos repetidos', () => {
      expect(validator(new FormControl('12345'))).not.toBeNull();
      expect(validator(new FormControl('0000000000'))).not.toBeNull();
      expect(validator(new FormControl('9999999999'))).not.toBeNull();
      expect(validator(new FormControl('0991234'))).not.toBeNull(); // incompleto
    });
  });

  describe('validarCedulaOPasaporte', () => {
    const validator = validarCedulaOPasaporte();

    it('debería ser válido si está vacío', () => {
      expect(validator(new FormControl(''))).toBeNull();
    });

    it('debería validar cédulas ecuatorianas válidas', () => {
      // 1713394748 es una cédula de Pichincha válida por módulo 10
      expect(validator(new FormControl('1713394748'))).toBeNull();
      // 0922488499 es una cédula de Guayas válida por módulo 10
      expect(validator(new FormControl('0922488499'))).toBeNull();
    });

    it('debería rechazar cédulas ecuatorianas con dígito verificador inválido', () => {
      expect(validator(new FormControl('1713394740'))).not.toBeNull();
      expect(validator(new FormControl('9999999999'))).not.toBeNull(); // provincia inexistente
    });

    it('debería aceptar pasaportes alfanuméricos', () => {
      expect(validator(new FormControl('A12345678'))).toBeNull();
      expect(validator(new FormControl('PASSPORT-99'))).toBeNull();
    });
  });

  describe('normalizarTelefono', () => {
    it('debería convertir celular local ecuatoriano a formato E.164 con 593', () => {
      expect(normalizarTelefono('0991234567')).toBe('593991234567');
      expect(normalizarTelefono('099 123 4567')).toBe('593991234567');
      expect(normalizarTelefono('+593 99 123 4567')).toBe('593991234567');
      expect(normalizarTelefono('991234567')).toBe('593991234567');
    });

    it('debería dejar intactos números internacionales', () => {
      expect(normalizarTelefono('+1 305 555 1234')).toBe('13055551234');
    });
  });

  describe('sanitizarTexto y sanitizarCorreo', () => {
    it('debería limpiar espacios repetidos y bordes', () => {
      expect(sanitizarTexto('   Laura    Sánchez   ')).toBe('Laura Sánchez');
    });

    it('debería limpiar y pasar correos a minúsculas', () => {
      expect(sanitizarCorreo('  LAURA.SANCHEZ@GMAIL.COM  ')).toBe('laura.sanchez@gmail.com');
    });
  });

  describe('convertirHoraAMinutos, normalizarHoraStr y estaFueraDeHorario', () => {
    it('debería convertir horas a minutos correctamente', () => {
      expect(convertirHoraAMinutos('09:00')).toBe(540);
      expect(convertirHoraAMinutos('9:00')).toBe(540);
      expect(convertirHoraAMinutos('09:00:00')).toBe(540);
      expect(convertirHoraAMinutos('14:30:45')).toBe(870);
      expect(convertirHoraAMinutos('invalid')).toBeNull();
      expect(convertirHoraAMinutos(null)).toBeNull();
    });

    it('debería normalizar string de hora a HH:mm', () => {
      expect(normalizarHoraStr('9:00')).toBe('09:00');
      expect(normalizarHoraStr('09:00:00')).toBe('09:00');
      expect(normalizarHoraStr('14:30')).toBe('14:30');
      expect(normalizarHoraStr('')).toBe('');
    });

    it('debería evaluar correctamente si está dentro o fuera de horario diurno', () => {
      // Turno: 09:00 a 18:00
      // 09:00 = 540 min. Con margen 30 min antes: inicio permitido 08:30 (510 min)
      // 18:00 = 1080 min. Con margen 30 min despues: fin permitido 18:30 (1110 min)
      const fecha820 = new Date(2026, 0, 1, 8, 20); // 08:20 (fuera)
      const fecha835 = new Date(2026, 0, 1, 8, 35); // 08:35 (dentro por margen)
      const fecha1200 = new Date(2026, 0, 1, 12, 0); // 12:00 (dentro)
      const fecha1825 = new Date(2026, 0, 1, 18, 25); // 18:25 (dentro por margen)
      const fecha1845 = new Date(2026, 0, 1, 18, 45); // 18:45 (fuera)

      expect(estaFueraDeHorario('09:00:00', '18:00:00', fecha820, 30, 30)).toBe(true);
      expect(estaFueraDeHorario('9:00', '18:00', fecha835, 30, 30)).toBe(false);
      expect(estaFueraDeHorario('09:00', '18:00', fecha1200, 30, 30)).toBe(false);
      expect(estaFueraDeHorario('09:00', '18:00', fecha1825, 30, 30)).toBe(false);
      expect(estaFueraDeHorario('09:00', '18:00', fecha1845, 30, 30)).toBe(true);
    });

    it('debería permitir acceso si no hay horarios configurados', () => {
      expect(estaFueraDeHorario(null, null)).toBe(false);
      expect(estaFueraDeHorario('', '')).toBe(false);
    });
  });

});

