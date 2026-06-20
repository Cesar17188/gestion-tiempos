import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-filtros',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-filtros.html',
  styleUrl: './admin-filtros.css',
})
export class AdminFiltros {
  @Input() listaPersonal: any[] = [];
  @Input() fechaInicio!: string;
  @Input() fechaFin!: string;
  @Input() encargadoSeleccionado: string = 'TODOS';

  @Output() onFiltrar = new EventEmitter<{ inicio: string, fin: string, encargado: string }>();

  aplicar() {
    this.onFiltrar.emit({
      inicio: this.fechaInicio,
      fin: this.fechaFin,
      encargado: this.encargadoSeleccionado
    });
  }
}
