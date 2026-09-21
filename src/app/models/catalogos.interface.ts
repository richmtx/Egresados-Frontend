export interface Carrera {
  id_carrera: number;
  nombre_carrera: string;
}

export interface Genero {
  id_genero: number;
  genero: string;
}

export interface NivelIngles {
  id_nivel: number;
  nivel: string;
}

export interface SituacionLaboral {
  id_situacion: number;
  situacion: string;
}

export interface AntiguedadEmpleo {
  id_antiguedad: number;
  rango: string;
}

export interface CertificacionVigente {
  id_certificacion_vigente: number;
  respuesta: string;
}

export interface CoincidenciaLaboral {
  id_coincidencia: number;
  nivel: string;
}

/** Dominios del instrumento de dificultad funcional (INEGI / Grupo de Washington) */
export interface DiscapacidadDominio {
  id_dominio: number;
  clave: string;
  pregunta: string;
  orden: number;
}

/** Grados de dificultad para cada dominio */
export interface GradoDificultad {
  id_grado: number;
  clave: string;
  descripcion: string;
  orden: number;
}

/** Respuestas de autoadscripción: Sí / No / Prefiero no declarar */
export interface RespuestaAutoadscripcion {
  id_respuesta: number;
  clave: string;
  descripcion: string;
  orden: number;
}
/** Niveles de estudios posteriores a la carrera (especialidad, maestría, etc.) */
export interface NivelEstudio {
  id_nivel_estudio: number;
  clave: string;
  descripcion: string;
  orden: number;
}

/** Estado de los estudios posteriores: en curso, concluido, trunco */
export interface EstadoEstudio {
  id_estado_estudio: number;
  clave: string;
  descripcion: string;
  orden: number;
}

/** Tipos de proyecto social, comunitario o de desarrollo regional */
export interface TipoProyectoSocial {
  id_tipo_proyecto: number;
  clave: string;
  descripcion: string;
  orden: number;
}

/** Rangos de personas empleadas por un emprendimiento */
export interface RangoEmpleados {
  id_rango_empleados: number;
  clave: string;
  descripcion: string;
  orden: number;
}
