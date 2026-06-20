import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-metricas',
  imports: [CommonModule],
  templateUrl: './admin-metricas.html',
  styleUrl: './admin-metricas.css',
})
export class AdminMetricas {
  @Input() totalRecaudado: number = 0;
  @Input() totalNinos: number = 0;
  @Input() totalMinutosJugados: number = 0;
  @Input() diaPico: { fecha: string, cantidad: number } = { fecha: '-', cantidad: 0 };
}
