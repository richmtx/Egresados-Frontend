import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Carrera, Genero, NivelIngles, SituacionLaboral, AntiguedadEmpleo, CertificacionVigente,
  CoincidenciaLaboral, DiscapacidadDominio, GradoDificultad, RespuestaAutoadscripcion,
} from '../models/catalogos.interface';

@Injectable({ providedIn: 'root' })
export class CatalogosService {

  private readonly API = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getCarreras(): Observable<Carrera[]> {
    return this.http.get<Carrera[]>(`${this.API}/carreras`);
  }

  getGeneros(): Observable<Genero[]> {
    return this.http.get<Genero[]>(`${this.API}/generos`);
  }

  getNivelesIngles(): Observable<NivelIngles[]> {
    return this.http.get<NivelIngles[]>(`${this.API}/niveles-ingles`);
  }

  getSituacionesLaborales(): Observable<SituacionLaboral[]> {
    return this.http.get<SituacionLaboral[]>(`${this.API}/situacion-laboral`);
  }

  getAntiguedades(): Observable<AntiguedadEmpleo[]> {
    return this.http.get<AntiguedadEmpleo[]>(`${this.API}/antiguedad`);
  }

  getCertificacionesVigentes(): Observable<CertificacionVigente[]> {
    return this.http.get<CertificacionVigente[]>(`${this.API}/certificaciones-vigentes`);
  }

  getCoincidenciasLaborales(): Observable<CoincidenciaLaboral[]> {
    return this.http.get<CoincidenciaLaboral[]>(`${this.API}/coincidencia`);
  }

  getDiscapacidadDominios(): Observable<DiscapacidadDominio[]> {
    return this.http.get<DiscapacidadDominio[]>(`${this.API}/discapacidad-dominios`);
  }

  getGradosDificultad(): Observable<GradoDificultad[]> {
    return this.http.get<GradoDificultad[]>(`${this.API}/grados-dificultad`);
  }

  getRespuestasAutoadscripcion(): Observable<RespuestaAutoadscripcion[]> {
    return this.http.get<RespuestaAutoadscripcion[]>(`${this.API}/respuestas-autoadscripcion`);
  }
}