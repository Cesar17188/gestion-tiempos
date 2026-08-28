import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validador estricto para correos electrónicos.
 * Si el campo está vacío, no genera error (para campos opcionales).
 * Si tiene contenido, exige formato válido de correo con dominio y TLD (ej. usuario@dominio.com).
 */
export function validarCorreo(): ValidatorFn {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return null; // Válido si está vacío (opcional)
    }

    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!emailRegex.test(trimmed)) {
      return { correoInvalido: 'Ingrese un formato de correo electrónico válido (ej. usuario@ejemplo.com)' };
    }

    return null;
  };
}

/**
 * Validador para teléfonos móviles locales (Ecuador) e internacionales.
 * Permite caracteres de formato como espacios, guiones, paréntesis y '+'.
 */
export function validarTelefono(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return null;
    }

    const rawStr = String(value).trim();
    // Extraer solo dígitos
    const cleanDigits = rawStr.replace(/\D/g, '');

    // Longitud mínima y máxima de dígitos
    if (cleanDigits.length < 9 || cleanDigits.length > 15) {
      return { telefonoInvalido: 'El número de teléfono debe tener entre 9 y 15 dígitos.' };
    }

    // Rechazar repeticiones triviales (ej. 0000000000, 1111111111)
    if (/^(\d)\1+$/.test(cleanDigits)) {
      return { telefonoInvalido: 'El número de teléfono ingresado no parece válido.' };
    }

    // Si parece número ecuatoriano (empieza con 09, 9, o código de país 593)
    if (cleanDigits.startsWith('09')) {
      if (cleanDigits.length !== 10) {
        return { telefonoInvalido: 'Los números celulares de Ecuador deben tener 10 dígitos (ej. 0991234567).' };
      }
    } else if (cleanDigits.length === 9 && cleanDigits.startsWith('9')) {
      // Celular sin el cero inicial (9 dígitos)
      return null;
    } else if (cleanDigits.startsWith('593')) {
      // Formato con prefijo ecuatoriano 593 + 9 dígitos celular (total 12 dígitos)
      if (cleanDigits.length !== 12) {
        return { telefonoInvalido: 'El número con prefijo 593 debe tener 12 dígitos en total (ej. 593991234567).' };
      }
    }

    return null;
  };
}

/**
 * Validador de Identificación (Cédula ecuatoriana con algoritmo módulo 10 o Pasaporte alfanumérico).
 */
export function validarCedulaOPasaporte(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return null;
    }

    const str = String(value).trim();

    // 1. Si son exactamente 10 dígitos numéricos -> Aplicamos validación de cédula ecuatoriana
    if (/^\d{10}$/.test(str)) {
      const provincia = parseInt(str.substring(0, 2), 10);
      const tercerDigito = parseInt(str.substring(2, 3), 10);

      if ((provincia < 1 || provincia > 24) && provincia !== 30) {
        return { cedulaInvalida: 'Código de provincia de cédula ecuatoriana no válido.' };
      }

      if (tercerDigito >= 6) {
        return { cedulaInvalida: 'Tercer dígito de cédula ecuatoriana no válido.' };
      }

      // Algoritmo de Módulo 10
      const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
      let suma = 0;

      for (let i = 0; i < 9; i++) {
        let valor = parseInt(str.charAt(i), 10) * coeficientes[i];
        if (valor >= 10) {
          valor -= 9;
        }
        suma += valor;
      }

      const digitoVerificador = parseInt(str.charAt(9), 10);
      const residuo = suma % 10;
      const digitoEsperado = residuo === 0 ? 0 : 10 - residuo;

      if (digitoVerificador !== digitoEsperado) {
        return { cedulaInvalida: 'El número de cédula ingresado no es válido.' };
      }

      return null;
    }

    // 2. Si son 13 dígitos numéricos -> Posible RUC ecuatoriano
    if (/^\d{13}$/.test(str)) {
      if (str.endsWith('001')) {
        return null;
      }
      return { cedulaInvalida: 'El RUC ecuatoriano debe terminar en 001.' };
    }

    // 3. Si es alfanumérico (Pasaporte o documento extranjero de 6 a 20 caracteres)
    if (/^[a-zA-Z0-9-]{6,20}$/.test(str)) {
      return null; // Pasaporte válido
    }

    return { cedulaInvalida: 'Ingrese una cédula ecuatoriana válida (10 dígitos) o pasaporte (6-20 caracteres).' };
  };
}

/**
 * Normaliza cualquier formato de teléfono a formato estándar E.164 para WhatsApp y Base de Datos (ej. 593991234567).
 */
export function normalizarTelefono(raw: string | null | undefined): string {
  if (!raw) return '';
  let clean = String(raw).replace(/\D/g, '');

  if (clean.startsWith('0') && clean.length === 10) {
    // 0991234567 -> 593991234567
    clean = '593' + clean.substring(1);
  } else if (clean.length === 9 && clean.startsWith('9')) {
    // 991234567 -> 593991234567
    clean = '593' + clean;
  }

  return clean;
}

/**
 * Formatea un número normalizado o raw para visualización amigable en la interfaz.
 */
export function formatearTelefonoParaVista(raw: string | null | undefined): string {
  const norm = normalizarTelefono(raw);
  if (!norm) return '';

  if (norm.startsWith('593') && norm.length === 12) {
    // +593 99 123 4567
    return `+593 ${norm.substring(3, 5)} ${norm.substring(5, 8)} ${norm.substring(8)}`;
  }

  return norm;
}

/**
 * Limpia y recorta espacios repetidos de un texto.
 */
export function sanitizarTexto(raw: string | null | undefined): string {
  if (!raw) return '';
  return String(raw).trim().replace(/\s+/g, ' ');
}

/**
 * Sanitiza y pasa a minúsculas un correo electrónico.
 */
export function sanitizarCorreo(raw: string | null | undefined): string {
  if (!raw) return '';
  return String(raw).trim().toLowerCase();
}
