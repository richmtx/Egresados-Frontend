export interface Carrera {
  id_carrera:     number;
  nombre_carrera: string;
}

export interface Genero {
  id_genero: number;
  genero:    string;
}

export interface NivelIngles {
  id_nivel: number;
  nivel:    string;
}

export interface SituacionLaboral {
  id_situacion: number;
  situacion:    string;
}

export interface AntiguedadEmpleo {
  id_antiguedad: number;
  rango:         string;
}

export interface CertificacionVigente {
  id_certificacion_vigente: number;
  respuesta:                string;
}

export interface CoincidenciaLaboral {
  id_coincidencia: number;
  nivel:           string;
}