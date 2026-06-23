import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../../src/environments/environment';

@Component({
  selector: 'app-splash',
  imports: [],
  templateUrl: './splash.html',
  styleUrl: './splash.css',
})
export class Splash implements OnInit {
  private router = inject(Router);

  // Construimos la URL pública dinámica usando tu variable de entorno
  // Formato de Supabase: [URL_PROYECTO]/storage/v1/object/public/[BUCKET]/[ARCHIVO]
  public gifUrl: string = `${environment.supabaseUrl}/storage/v1/object/public/general/ingresoLogin.gif`;

  ngOnInit() {
    // Temporizador: 3500 milisegundos = 3.5 segundos
    setTimeout(() => {
      this.router.navigate(['/login']);
    }, 6000);
  }
}
