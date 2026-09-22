/** Una respuesta del instrumento de dificultad funcional */
export interface DiscapacidadRespuesta {
  dominio: string;   // clave del dominio
  grado: string;     // clave del grado
}

/** Bloque de identidad cultural */
export interface IdentidadCultural {
  indigena: string;          // clave de autoadscripción
  habla_lengua: string;      // clave de autoadscripción
  lengua_indigena?: string;  // texto libre, solo si habla_lengua = 'si'
  afromexicano: string;      // clave de autoadscripción
}

/** Estudios posteriores a la carrera (el formulario captura máximo uno) */
export interface EstudioPosterior {
  nivel: string;             // clave de niveles-estudio
  nombre_programa: string;   // máx 150
  institucion: string;       // máx 150
  estado: string;            // clave de estados-estudio
  anio?: number;             // 1950 a año actual
}

/** Negocio o proyecto propio (el formulario captura máximo uno) */
export interface Emprendimiento {
  nombre: string;            // máx 150
  giro: string;              // máx 150
  anio_inicio?: number;      // 1950 a año actual
  sigue_operando?: boolean;
  rango_empleados?: string;  // clave de rangos-empleados
}

/** Proyecto social, comunitario o de desarrollo regional (máximo uno) */
export interface ProyectoSocial {
  nombre: string;            // máx 150
  tipo: string;              // clave de tipos-proyecto-social
  anio?: number;             // 1950 a año actual
  organizacion?: string;     // máx 150
}

export interface CreateEgresadoEtapa1 {
  // Sección 1 · Datos Personales
  nombre_completo: string;
  genero: string;
  correo: string;
  telefono: string;
  ciudad_residencia: string;
  pais_nacimiento: string;
  facebook: string;
  instagram: string;

  // Sección 2 · Trayectoria Académica
  carrera: string;
  anio_ingreso: number;
  periodo_ingreso: string;
  anio_egreso: number;
  estatus_titulacion: string;
  estudios?: EstudioPosterior[];
  nivel_ingles: string;

  // Sección 3 · Situación Laboral
  situacion_laboral: string;
  empresa: string;
  puesto_trabajo?: string;          // máx 150
  antiguedad_empleo: string;
  ciudad_trabajo: string;
  tiempo_primer_empleo: string;
  medio_primer_empleo: string;
  medio_primer_empleo_otro: string;
  primer_empleo_empresa?: string;   // máx 150
  primer_empleo_puesto?: string;    // máx 150
  emprendimientos?: Emprendimiento[];

  // Sección 4 · Retroalimentación
  proyectos_sociales?: ProyectoSocial[];
  satisfaccion_formacion: number;
  autorizaciones: {
    estadisticas: boolean;
    contacto: boolean;
    eventos: boolean;
  };

  // Sección 5 · Información complementaria (datos sensibles, opcionales)
  consintio_datos_sensibles?: boolean;
  discapacidad?: DiscapacidadRespuesta[];
  identidad?: IdentidadCultural;
}

/** Payload que se envía al backend en la Etapa 2 */
export interface CreateEgresadoEtapa2 {
  // Sección 1 · Validación de identidad
  correo: string;
  nombre_completo: string;
  numero_control: string;

  // Sección 2 · Detalle Profesional
  linkedin: string;
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