import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-tabla',
  imports: [CommonModule],
  templateUrl: './admin-tabla.html',
  styleUrl: './admin-tabla.css',
})
export class AdminTabla {
  @Input() metricas: any[] = [];
}
