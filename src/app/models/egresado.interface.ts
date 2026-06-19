
export interface CreateEgresadoEtapa1 {
  // Sección 1 · Datos Personales
  nombre_completo: string;
  genero: string;
  correo: string;
  telefono: string;
  ciudad_residencia: string;
  facebook: string;
  instagram: string;

  // Sección 2 · Trayectoria Académica
  carrera: string;
  anio_egreso: number;
  estatus_titulacion: string;
  certificacion_vigente: string;
  nivel_ingles: string;

  // Sección 3 · Situación Laboral
  situacion_laboral: string;
  empresa: string;
  antiguedad_empleo: string;
  ciudad_trabajo: string;
  tiempo_primer_empleo: string;
  medio_primer_empleo: string;
  medio_primer_empleo_otro: string;

  // Sección 4 · Retroalimentación
  satisfaccion_formacion: number;
  autorizaciones: {
    estadisticas: boolean;
    contacto: boolean;
    eventos: boolean;
  };
}

/** Payload que se envía al backend en la Etapa 2 */
export interface CreateEgresadoEtapa2 {
  // Sección 1 · Validación de identidad
  correo: string;
  nombre_completo: string;
  numero_control: string;

  // Sección 2 · Detalle Profesional
  linkedin: string;
  puesto_trabajo: string;
  coincidencia_laboral: string;
  certificaciones: string;

  // Sección 3 · Opinión Experta
  habilidades: string[];
  habilidad_otro: string;
  colaboraciones: string[];
  colaboracion_otro: string;
}

/** Respuesta que devuelve el backend tras guardar la Etapa 1 */
export interface RespuestaEtapa1 {
  id_egresado: number;
  mensaje: string;
}