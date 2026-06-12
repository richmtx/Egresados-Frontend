import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreateEgresadoEtapa1, CreateEgresadoEtapa2, RespuestaEtapa1, } from '../models/egresado.interface';

@Injectable({
  providedIn: 'root',
})
export class EgresadosService {

  private readonly API = environment.apiUrl;

  constructor(private http: HttpClient) { }

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

  buscarPorCorreo(
    correo: string,
  ): Observable<{ id_egresado: number; registro_completo: boolean } | null> {
    return this.http.get<{ id_egresado: number; registro_completo: boolean } | null>(
      `${this.API}/egresados/buscar`,
      { params: { correo } },
    );
  }
}