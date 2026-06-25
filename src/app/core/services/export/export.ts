import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ExportService {
  exportarACsv(nombreArchivo: string, datos: any[], columnas: string[]) {
    if (!datos || !datos.length) return;

    const separador = ';'; // El punto y coma garantiza que Excel en español separe las columnas correctamente

    // 1. Crear la cabecera del archivo
    const cabecera = columnas.join(separador);

    // 2. Mapear cada fila y limpiar los textos de comillas extrañas
    const filas = datos.map(fila =>
      columnas.map(columna => {
        const valor = fila[columna] ?? '';
        // Escapamos comillas dobles internas para no romper el formato CSV
        return `"${String(valor).replace(/"/g, '""')}"`;
      }).join(separador)
    );

    // 3. Unir todo con saltos de línea estructurados
    const contenidoCsv = [cabecera, ...filas].join('\r\n');

    // 4. Agregar el prefijo BOM (\uFEFF) para que Excel detecte UTF-8 (tildes y eñes)
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), contenidoCsv], {
      type: 'text/csv;charset=utf-8;'
    });

    // 5. Truco del DOM para disparar la descarga automática en el navegador
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${nombreArchivo}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}
