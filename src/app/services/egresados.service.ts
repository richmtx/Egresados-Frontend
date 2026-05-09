import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateEgresadoEtapa1, CreateEgresadoEtapa2, RespuestaEtapa1, } from '../models/egresado.interface';

@Injectable({
  providedIn: 'root',
})
export class EgresadosService {

  private readonly API = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  enviarEtapa1(datos: CreateEgresadoEtapa1): Observable<RespuestaEtapa1> {
    return this.http.post<RespuestaEtapa1>(
      `${this.API}/egresados/etapa1`,
      datos,
    );
  }

  enviarEtapa1ConFoto(formData: FormData): Observable<RespuestaEtapa1> {
    return this.http.post<RespuestaEtapa1>(
      `${this.API}/egresados/etapa1`,
      formData,
    );
  }

  enviarEtapa2(
    idEgresado: number,
    datos: CreateEgresadoEtapa2,
  ): Observable<{ mensaje: string }> {
    return this.http.patch<{ mensaje: string }>(
      `${this.API}/egresados/etapa2/${idEgresado}`,
      datos,
    );
  }

  buscarPorCorreo(correo: string): Observable<{ id_egresado: number } | null> {
    return this.http.get<{ id_egresado: number } | null>(
      `${this.API}/egresados/buscar`,
      { params: { correo } },
    );
  }
}