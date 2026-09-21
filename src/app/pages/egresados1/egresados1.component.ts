import {
  Component, ViewEncapsulation, OnInit, OnDestroy, Inject, PLATFORM_ID,
  ViewChild, ElementRef, ChangeDetectorRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Subject, of, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { EgresadosService } from '../../services/egresados.service';
import { CatalogosService } from '../../services/catalogos.service';
import {
  CreateEgresadoEtapa1, DiscapacidadRespuesta, IdentidadCultural,
  EstudioPosterior, Emprendimiento, ProyectoSocial,
} from '../../models/egresado.interface';
import {
  Carrera, Genero, NivelIngles, SituacionLaboral,
  AntiguedadEmpleo, CertificacionVigente,
  DiscapacidadDominio, GradoDificultad, RespuestaAutoadscripcion,
  NivelEstudio, EstadoEstudio, TipoProyectoSocial, RangoEmpleados,
} from '../../models/catalogos.interface';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Requerido que no acepta solo espacios (Validators.required sí los acepta).
function textoRequerido(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null =>
    String(control.value ?? '').trim() ? null : { required: true };
}

function noCorreoInstitucional(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor: string = control.value ?? '';
    if (!valor) return null;

    const dominiosInstitucionales = [
      /\.edu\.mx$/i,
      /\.edu$/i,
      /\.gob\.mx$/i,
      /\.tecnm\.mx$/i,
      /itdurango/i,
      /tecnologico/i,
    ];

    const esInstitucional = dominiosInstitucionales.some(regex =>
      regex.test(valor.split('@')[1] ?? '')
    );
    return esInstitucional ? { correoInstitucional: true } : null;
  };
}

function alMenosUnaAutorizacion(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const estadisticos = group.get('autorizacion_estadisticos')?.value;
    const contacto = group.get('autorizacion_contacto')?.value;
    const actividades = group.get('autorizacion_actividades')?.value;
    const algunaMarcada = estadisticos || contacto || actividades;
    return algunaMarcada ? null : { autorizacionRequerida: true };
  };
}

function duracionCarreraValida(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const ingreso = Number(group.get('anio_ingreso')?.value);
    const egreso = Number(group.get('anio')?.value);
    if (!ingreso || !egreso) return null;

    if (ingreso > egreso) return { ingresoPosteriorAEgreso: true };

    const diff = egreso - ingreso;
    if (diff < 4) return { duracionMuyCorta: true };
    if (diff > 15) return { duracionMuyLarga: true };

    return null;
  };
}

@Component({
  selector: 'app-egresados1',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './egresados1.component.html',
  styleUrls: ['./egresados1.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class Egresados1Component implements OnInit, OnDestroy {

  // ViewChild para cámara desktop — deben estar DENTRO de la clase
  @ViewChild('videoRef') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasRef') canvasRef!: ElementRef<HTMLCanvasElement>;

  form: FormGroup;
  mostrarExito = false;
  enviando = false;
  cargando = true;
  errorMensaje = '';

  correoYaRegistrado = false;
  verificandoCorreo = false;

  // Catálogos
  carreras: Carrera[] = [];
  generos: Genero[] = [];
  nivelesIngles: NivelIngles[] = [];
  situacionesLaborales: SituacionLaboral[] = [];
  antiguedades: AntiguedadEmpleo[] = [];
  certificacionesVigentes: CertificacionVigente[] = [];

  // Catálogos de la sección 5 (información complementaria)
  discapacidadDominios: DiscapacidadDominio[] = [];
  gradosDificultad: GradoDificultad[] = [];
  respuestasAutoadscripcion: RespuestaAutoadscripcion[] = [];

  // Catálogos de trayectoria profesional (fase 4)
  nivelesEstudio: NivelEstudio[] = [];
  estadosEstudio: EstadoEstudio[] = [];
  tiposProyectoSocial: TipoProyectoSocial[] = [];
  rangosEmpleados: RangoEmpleados[] = [];

  // Catálogos fijos del primer empleo (no vienen de BD, igual que Titulación).
  // El texto debe coincidir EXACTAMENTE con las tablas tiempo_primer_empleo
  // y medio_primer_empleo, porque el backend resuelve por texto.
  tiemposPrimerEmpleo: string[] = [
    'Menos de 3 meses',
    'De 3 a 6 meses',
    'De 6 meses a 1 año',
    'De 1 a 2 años',
    'Más de 2 años',
    'Aún no he conseguido empleo',
  ];
  mediosPrimerEmpleo: string[] = [
    'LinkedIn',
    'Otra plataforma de empleo',
    'Bolsa de trabajo ITD',
    'Por recomendación',
    'Otra',
  ];

  // Autocomplete ciudad residencia
  sugerenciasCiudad: string[] = [];
  buscandoCiudad: boolean = false;
  mostrarSugerencias: boolean = false;
  ciudadSinResultados: boolean = false;

  // Autocomplete ciudad trabajo
  sugerenciasCiudadTrabajo: string[] = [];
  buscandoCiudadTrabajo: boolean = false;
  mostrarSugerenciasTrabajo: boolean = false;
  ciudadTrabajoSinResultados: boolean = false;

  // Foto de perfil
  fotoArchivo: File | null = null;
  fotoPreview: string | null = null;
  modalFotoVisible: boolean = false;
  fotoError: string = '';

  // Cámara desktop
  camaraActiva: boolean = false;
  camaraError: string = '';
  private stream: MediaStream | null = null;

  // Foto capturada pendiente de confirmar (solo cámara desktop)
  fotoCapturadaPreview: string | null = null;
  fotoCapturadaBlob: Blob | null = null;

  private ciudadInput$ = new Subject<string>();
  private ciudadTrabajoInput$ = new Subject<string>();
  private ciudadSub!: Subscription;
  private ciudadTrabajoSub!: Subscription;
  private situacionSub!: Subscription;
  private tiempoSub!: Subscription;
  private medioSub!: Subscription;
  private consentSub!: Subscription;
  private lenguaSub!: Subscription;
  private estudioSub!: Subscription;
  private emprendeSub!: Subscription;
  private proyectoSub!: Subscription;

  private readonly SITUACIONES_INACTIVAS = [
    'Desempleado',
    'Estudiando Posgrado',
    'Dedicado al hogar u otras actividades',
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private svc: EgresadosService,
    private catalogos: CatalogosService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {
    this.form = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      genero: ['', Validators.required],
      correo: ['', [Validators.required, Validators.email, noCorreoInstitucional()]],
      telefono: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      ciudad: ['', Validators.required],
      pais_nacimiento: ['México', Validators.required],
      facebook: [''],
      instagram: [''],
      carrera: ['', Validators.required],
      anio_ingreso: ['', [Validators.required, Validators.min(this.minAnioIngreso), Validators.max(this.currentYear)]],
      periodo_ingreso: ['', Validators.required],
      anio: ['', [Validators.required, Validators.min(1948), Validators.max(this.currentYear)]],
      titulacion: ['', Validators.required],
      certificacion: ['', Validators.required],

      // ── Estudios posteriores ──
      // Solo estudio_nivel es obligatorio de entrada; el resto arranca sin
      // validadores y se activa si el nivel es distinto de 'no'.
      estudio_nivel: ['', Validators.required],
      estudio_programa: [''],
      estudio_institucion: [''],
      estudio_estado: [''],
      estudio_anio: [''],

      ingles: ['', Validators.required],
      situacion: ['', Validators.required],
      empresa: [''],
      antiguedad: ['', Validators.required],
      ciudadtrabajo: [''],
      tiempo_primer_empleo: ['', Validators.required],
      medio_primer_empleo: [''],
      medio_primer_empleo_otro: [''],
      // Primer empleo: obligatorios salvo que el egresado nunca se haya
      // empleado (se activan desde tiempoSub, igual que medio_primer_empleo).
      primer_empleo_empresa: [''],
      primer_empleo_puesto: [''],

      // ── Emprendimiento ──
      emp_tiene: ['', Validators.required],
      emp_nombre: [''],
      emp_giro: [''],
      emp_anio: [''],
      emp_sigue: [''],
      emp_rango: [''],

      // ── Proyectos sociales (sección 4) ──
      proy_participa: ['', Validators.required],
      proy_nombre: [''],
      proy_tipo: [''],
      proy_anio: [''],
      proy_organizacion: [''],

      satisfaccion: ['', Validators.required],
      autorizacion_estadisticos: [false],
      autorizacion_contacto: [false],
      autorizacion_actividades: [false],

      // ── Sección 5 · Información complementaria (datos sensibles) ──
      // Todos arrancan vacíos y sin validadores. Los validadores se
      // activan solo si el egresado marca el consentimiento.
      consintio_sensibles: [false],
      disc_ver: [''],
      disc_oir: [''],
      disc_caminar: [''],
      disc_recordar: [''],
      disc_autocuidado: [''],
      disc_comunicar: [''],
      ident_indigena: [''],
      ident_habla_lengua: [''],
      ident_lengua: [''],
      ident_afromexicano: [''],
    }, { validators: [alMenosUnaAutorizacion(), duracionCarreraValida()] });
  }

  // Año máximo dinámico — se actualiza solo cada vez que se carga la app
  currentYear: number = new Date().getFullYear();

  // Año mínimo de ingreso. Pendiente de confirmar con Vinculación.
  minAnioIngreso: number = 1948;

  periodosIngreso: string[] = ['Enero - Junio', 'Agosto - Diciembre', 'No lo recuerdo'];

  // País de nacimiento. México primero por ser el caso mayoritario;
  // el resto en orden alfabético.
  paisesNacimiento: string[] = [
    'México',
    'Alemania', 'Argentina', 'Belice', 'Bolivia', 'Brasil', 'Canadá',
    'Chile', 'China', 'Colombia', 'Corea del Sur', 'Costa Rica', 'Cuba',
    'Ecuador', 'El Salvador', 'España', 'Estados Unidos', 'Francia',
    'Guatemala', 'Haití', 'Honduras', 'India', 'Italia', 'Japón',
    'Nicaragua', 'Panamá', 'Paraguay', 'Perú', 'Reino Unido',
    'República Dominicana', 'Uruguay', 'Venezuela',
    'Otro',
  ];

  // Mapea cada clave de dominio con su control en el formulario.
  // El orden define cómo se numeran las preguntas en pantalla.
  readonly clavesDominio: string[] = [
    'ver', 'oir', 'caminar', 'recordar', 'autocuidado', 'comunicar',
  ];

  get f() { return this.form.controls; }

  get autorizacionInvalida(): boolean {
    return this.form.hasError('autorizacionRequerida') &&
      (this.form.get('autorizacion_estadisticos')!.touched &&
        this.form.get('autorizacion_contacto')!.touched &&
        this.form.get('autorizacion_actividades')!.touched);
  }

  private get aniosTocados(): boolean {
    return this.form.get('anio_ingreso')!.touched && this.form.get('anio')!.touched;
  }

  get ingresoPosteriorAEgreso(): boolean {
    return this.form.hasError('ingresoPosteriorAEgreso') && this.aniosTocados;
  }

  get duracionInvalida(): boolean {
    return (this.form.hasError('duracionMuyCorta') || this.form.hasError('duracionMuyLarga'))
      && this.aniosTocados;
  }

  get consintioSensibles(): boolean {
    return this.form.get('consintio_sensibles')?.value === true;
  }

  get hablaLenguaIndigena(): boolean {
    return this.form.get('ident_habla_lengua')?.value === 'si';
  }

  nombreControlDominio(clave: string): string {
    return 'disc_' + clave;
  }

  get mensajeDuracion(): string {
    if (this.form.hasError('duracionMuyCorta')) {
      return 'La diferencia entre ingreso y egreso debe ser de al menos 4 años.';
    }
    if (this.form.hasError('duracionMuyLarga')) {
      return 'La diferencia entre ingreso y egreso no puede ser mayor a 15 años.';
    }
    return '';
  }

  get estaActivo(): boolean {
    const valor = (this.form.get('situacion')?.value ?? '').toLowerCase();
    return !this.SITUACIONES_INACTIVAS.some(s => s.toLowerCase() === valor);
  }

  // Solo se muestra/exige la pregunta de medio si SÍ consiguió empleo
  // La pregunta de medio se "apaga" cuando el egresado nunca consiguió empleo
  get sinEmpleo(): boolean {
    return this.form.get('tiempo_primer_empleo')?.value === 'Aún no he conseguido empleo';
  }
  get medioEsOtra(): boolean {
    return this.form.get('medio_primer_empleo')?.value === 'Otra';
  }

  get tieneEstudios(): boolean {
    const nivel = this.form.get('estudio_nivel')?.value;
    return !!nivel && nivel !== 'no';
  }

  get emprendio(): boolean {
    return this.form.get('emp_tiene')?.value === 'si';
  }

  get participoProyecto(): boolean {
    return this.form.get('proy_participa')?.value === 'si';
  }

  // Ciclo de vida

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    forkJoin({
      carreras: this.catalogos.getCarreras(),
      generos: this.catalogos.getGeneros(),
      nivelesIngles: this.catalogos.getNivelesIngles(),
      situacionesLaborales: this.catalogos.getSituacionesLaborales(),
      antiguedades: this.catalogos.getAntiguedades(),
      certificacionesVigentes: this.catalogos.getCertificacionesVigentes(),
      discapacidadDominios: this.catalogos.getDiscapacidadDominios(),
      gradosDificultad: this.catalogos.getGradosDificultad(),
      respuestasAutoadscripcion: this.catalogos.getRespuestasAutoadscripcion(),
      nivelesEstudio: this.catalogos.getNivelesEstudio(),
      estadosEstudio: this.catalogos.getEstadosEstudio(),
      tiposProyectoSocial: this.catalogos.getTiposProyectoSocial(),
      rangosEmpleados: this.catalogos.getRangosEmpleados(),
    }).subscribe({
      next: (data) => {
        this.carreras = data.carreras;
        this.generos = data.generos.filter(g =>
          ['femenino', 'masculino'].includes(g.genero.toLowerCase())
        );
        this.nivelesIngles = data.nivelesIngles;
        this.situacionesLaborales = data.situacionesLaborales;
        this.antiguedades = data.antiguedades;
        this.certificacionesVigentes = data.certificacionesVigentes;
        this.discapacidadDominios = data.discapacidadDominios;
        this.gradosDificultad = data.gradosDificultad;
        this.respuestasAutoadscripcion = data.respuestasAutoadscripcion;
        this.nivelesEstudio = data.nivelesEstudio;
        this.estadosEstudio = data.estadosEstudio;
        this.tiposProyectoSocial = data.tiposProyectoSocial;
        this.rangosEmpleados = data.rangosEmpleados;
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        this.errorMensaje = 'Error al cargar el formulario. Recarga la página.';
        console.error('Error cargando catálogos:', err);
      },
    });

    // Pipeline autocomplete ciudad residencia
    this.ciudadSub = this.ciudadInput$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query || query.length < 2) {
          this.sugerenciasCiudad = [];
          this.ciudadSinResultados = false;
          this.buscandoCiudad = false;
          return of([]);
        }
        this.buscandoCiudad = true;
        this.ciudadSinResultados = false;

        const url =
          `https://nominatim.openstreetmap.org/search` +
          `?q=${encodeURIComponent(query)}` +
          `&format=json&addressdetails=1&limit=6&featuretype=city`;

        return this.http.get<any[]>(url, {
          headers: { 'Accept-Language': 'es' },
        }).pipe(catchError(() => of([])));
      }),
    ).subscribe((resultados: any[]) => {
      this.buscandoCiudad = false;

      if (!resultados || resultados.length === 0) {
        this.sugerenciasCiudad = [];
        this.ciudadSinResultados = true;
        return;
      }

      const etiquetas = resultados.map((r: any) => {
        const a = r.address || {};
        const ciudad = a.city || a.town || a.village || a.municipality
          || a.county || r.display_name.split(',')[0].trim();
        const estado = a.state || a.region || '';
        const pais = a.country || '';
        return [ciudad, estado, pais].filter(Boolean).join(', ');
      });

      this.sugerenciasCiudad = [...new Set(etiquetas)];
      this.ciudadSinResultados = this.sugerenciasCiudad.length === 0;
      this.mostrarSugerencias = true;
    });

    // Pipeline autocomplete ciudad trabajo
    this.ciudadTrabajoSub = this.ciudadTrabajoInput$.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query || query.length < 2) {
          this.sugerenciasCiudadTrabajo = [];
          this.ciudadTrabajoSinResultados = false;
          this.buscandoCiudadTrabajo = false;
          return of([]);
        }
        this.buscandoCiudadTrabajo = true;
        this.ciudadTrabajoSinResultados = false;

        const url =
          `https://nominatim.openstreetmap.org/search` +
          `?q=${encodeURIComponent(query)}` +
          `&format=json&addressdetails=1&limit=6&featuretype=city`;

        return this.http.get<any[]>(url, {
          headers: { 'Accept-Language': 'es' },
        }).pipe(catchError(() => of([])));
      }),
    ).subscribe((resultados: any[]) => {
      this.buscandoCiudadTrabajo = false;

      if (!resultados || resultados.length === 0) {
        this.sugerenciasCiudadTrabajo = [];
        this.ciudadTrabajoSinResultados = true;
        return;
      }

      const etiquetas = resultados.map((r: any) => {
        const a = r.address || {};
        const ciudad = a.city || a.town || a.village || a.municipality
          || a.county || r.display_name.split(',')[0].trim();
        const estado = a.state || a.region || '';
        const pais = a.country || '';
        return [ciudad, estado, pais].filter(Boolean).join(', ');
      });

      this.sugerenciasCiudadTrabajo = [...new Set(etiquetas)];
      this.ciudadTrabajoSinResultados = this.sugerenciasCiudadTrabajo.length === 0;
      this.mostrarSugerenciasTrabajo = true;
    });

    // Escucha cambios en situación laboral
    this.situacionSub = this.form.get('situacion')!.valueChanges
      .subscribe((valor: string) => {
        const inactivo = this.SITUACIONES_INACTIVAS
          .some(s => s.toLowerCase() === valor?.toLowerCase());

        if (inactivo) {
          this.form.get('empresa')!.setValue('');
          this.form.get('antiguedad')!.setValue('');
          this.form.get('ciudadtrabajo')!.setValue('');
          this.form.get('antiguedad')!.clearValidators();

          this.sugerenciasCiudad = [];
          this.mostrarSugerencias = false;
          this.sugerenciasCiudadTrabajo = [];
          this.mostrarSugerenciasTrabajo = false;
        } else {
          this.form.get('antiguedad')!.setValidators(Validators.required);
        }

        this.form.get('antiguedad')!.updateValueAndValidity();
      });

    // Primer empleo: el "medio" depende del "tiempo".
    // Si el egresado nunca se empleó, no se exige (ni se muestra) el medio.
    this.tiempoSub = this.form.get('tiempo_primer_empleo')!.valueChanges
      .subscribe((valor: string) => {
        const requiereMedio = !!valor && valor !== 'Aún no he conseguido empleo';
        const medioCtrl = this.form.get('medio_primer_empleo')!;
        const medioOtroCtrl = this.form.get('medio_primer_empleo_otro')!;

        if (requiereMedio) {
          medioCtrl.setValidators(Validators.required);
        } else {
          medioCtrl.setValue('');
          medioCtrl.clearValidators();
          medioOtroCtrl.setValue('');
          medioOtroCtrl.clearValidators();
          medioOtroCtrl.updateValueAndValidity();
        }
        medioCtrl.updateValueAndValidity();

        // Empresa y puesto del primer empleo: mismo criterio que el medio.
        this.alternarBloque({
          primer_empleo_empresa: [textoRequerido(), Validators.maxLength(150)],
          primer_empleo_puesto: [textoRequerido(), Validators.maxLength(150)],
        }, requiereMedio);
      });

    // "Otra" en medio: habilita el texto libre obligatorio
    this.medioSub = this.form.get('medio_primer_empleo')!.valueChanges
      .subscribe((valor: string) => {
        const otroCtrl = this.form.get('medio_primer_empleo_otro')!;
        if (valor === 'Otra') {
          otroCtrl.setValidators(Validators.required);
        } else {
          otroCtrl.setValue('');
          otroCtrl.clearValidators();
        }
        otroCtrl.updateValueAndValidity();
      });

    // Consentimiento de datos sensibles.
    // Al marcarlo, las diez preguntas se vuelven obligatorias.
    // Al desmarcarlo, se limpian por completo: no basta con ocultarlas,
    // los valores tienen que desaparecer del formulario para que el
    // payload no los arrastre.
    const controlesSensibles = [
      ...this.clavesDominio.map(c => 'disc_' + c),
      'ident_indigena', 'ident_habla_lengua', 'ident_afromexicano',
    ];

    this.consentSub = this.form.get('consintio_sensibles')!.valueChanges
      .subscribe((consintio: boolean) => {
        controlesSensibles.forEach(nombre => {
          const ctrl = this.form.get(nombre)!;
          if (consintio) {
            ctrl.setValidators(Validators.required);
          } else {
            ctrl.setValue('');
            ctrl.clearValidators();
          }
          ctrl.updateValueAndValidity();
        });

        if (!consintio) {
          const lengua = this.form.get('ident_lengua')!;
          lengua.setValue('');
          lengua.clearValidators();
          lengua.updateValueAndValidity();
        }
      });

    // La lengua indígena solo se pide (y se guarda) si habla alguna.
    this.lenguaSub = this.form.get('ident_habla_lengua')!.valueChanges
      .subscribe((valor: string) => {
        const lengua = this.form.get('ident_lengua')!;
        if (valor === 'si') {
          lengua.setValidators(Validators.required);
        } else {
          lengua.setValue('');
          lengua.clearValidators();
        }
        lengua.updateValueAndValidity();
      });

    // Estudios posteriores: cualquier nivel distinto de 'no' despliega el
    // bloque. Cambiar de un nivel a otro conserva lo capturado.
    this.estudioSub = this.form.get('estudio_nivel')!.valueChanges
      .subscribe((nivel: string) => {
        this.alternarBloque({
          estudio_programa: [textoRequerido(), Validators.maxLength(150)],
          estudio_institucion: [textoRequerido(), Validators.maxLength(150)],
          estudio_estado: [Validators.required],
          estudio_anio: this.validadoresAnio(),
        }, !!nivel && nivel !== 'no');
      });

    // Emprendimiento: "Sí" despliega el bloque; "No" lo limpia por completo.
    this.emprendeSub = this.form.get('emp_tiene')!.valueChanges
      .subscribe((valor: string) => {
        this.alternarBloque({
          emp_nombre: [textoRequerido(), Validators.maxLength(150)],
          emp_giro: [textoRequerido(), Validators.maxLength(150)],
          emp_anio: this.validadoresAnio(),
          emp_sigue: [Validators.required],
          emp_rango: [],
        }, valor === 'si');
      });

    // Proyectos sociales: igual que emprendimiento.
    this.proyectoSub = this.form.get('proy_participa')!.valueChanges
      .subscribe((valor: string) => {
        this.alternarBloque({
          proy_nombre: [textoRequerido(), Validators.maxLength(150)],
          proy_tipo: [Validators.required],
          proy_anio: this.validadoresAnio(),
          proy_organizacion: [Validators.maxLength(150)],
        }, valor === 'si');
      });
  }

  // Rango de un año opcional: solo valida si trae valor (min/max/pattern
  // ignoran los vacíos).
  private validadoresAnio(): ValidatorFn[] {
    return [
      Validators.min(1950),
      Validators.max(this.currentYear),
      Validators.pattern(/^\d{4}$/),
    ];
  }

  // Activa (pone validadores) o desactiva (limpia valor y validadores) un
  // bloque condicional. Mismo patrón que consentSub y lenguaSub.
  private alternarBloque(controles: Record<string, ValidatorFn[]>, activo: boolean): void {
    Object.entries(controles).forEach(([nombre, validadores]) => {
      const ctrl = this.form.get(nombre)!;
      if (activo) {
        ctrl.setValidators(validadores);
      } else {
        ctrl.setValue('');
        ctrl.clearValidators();
      }
      ctrl.updateValueAndValidity();
    });
  }

  ngOnDestroy(): void {
    this.ciudadSub?.unsubscribe();
    this.ciudadTrabajoSub?.unsubscribe();
    this.situacionSub?.unsubscribe();
    this.tiempoSub?.unsubscribe();
    this.medioSub?.unsubscribe();
    this.consentSub?.unsubscribe();
    this.lenguaSub?.unsubscribe();
    this.estudioSub?.unsubscribe();
    this.emprendeSub?.unsubscribe();
    this.proyectoSub?.unsubscribe();
    this.cerrarCamaraDesktop();
  }

  // Autocomplete ciudad residencia

  onCiudadInput(event: Event): void {
    const valor = (event.target as HTMLInputElement).value;
    this.mostrarSugerencias = true;
    this.ciudadInput$.next(valor);
  }

  onCiudadBlur(): void {
    setTimeout(() => { this.mostrarSugerencias = false; }, 200);
  }

  seleccionarCiudad(ciudad: string): void {
    this.form.get('ciudad')!.setValue(ciudad);
    this.sugerenciasCiudad = [];
    this.mostrarSugerencias = false;
  }

  // Autocomplete ciudad trabajo

  onCiudadTrabajoInput(event: Event): void {
    const valor = (event.target as HTMLInputElement).value;
    this.mostrarSugerenciasTrabajo = true;
    this.ciudadTrabajoInput$.next(valor);
  }

  onCiudadTrabajoBlur(): void {
    setTimeout(() => { this.mostrarSugerenciasTrabajo = false; }, 200);
  }

  seleccionarCiudadTrabajo(ciudad: string): void {
    this.form.get('ciudadtrabajo')!.setValue(ciudad);
    this.sugerenciasCiudadTrabajo = [];
    this.mostrarSugerenciasTrabajo = false;
  }

  // Foto de perfil
  abrirModalFoto(): void {
    this.fotoError = '';
    this.modalFotoVisible = true;
  }

  cerrarModalFoto(): void {
    this.cerrarCamaraDesktop();
    this.fotoCapturadaPreview = null;
    this.fotoCapturadaBlob = null;
    this.modalFotoVisible = false;
    this.fotoError = '';
  }

  onFotoSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    this.fotoError = '';

    if (!archivo) return;

    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (!tiposPermitidos.includes(archivo.type)) {
      this.fotoError = 'Solo se permiten imágenes JPG, PNG o WEBP.';
      input.value = '';
      return;
    }

    const maxBytes = 2 * 1024 * 1024;
    if (archivo.size > maxBytes) {
      this.fotoError = 'La imagen no debe superar los 2 MB.';
      input.value = '';
      return;
    }

    this.fotoArchivo = archivo;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.fotoPreview = e.target?.result as string;
      this.cerrarModalFoto();
    };
    reader.readAsDataURL(archivo);

    input.value = '';
  }

  quitarFoto(): void {
    this.fotoArchivo = null;
    this.fotoPreview = null;
    this.fotoError = '';
  }

  // Cámara desktop (getUserMedia)
  esMobile(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }

  async abrirCamaraDesktop(): Promise<void> {
    this.camaraError = '';
    this.camaraActiva = true;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      // Espera a que Angular renderice el <video> antes de asignar el stream
      setTimeout(() => {
        if (this.videoRef?.nativeElement && this.stream) {
          const video = this.videoRef.nativeElement;
          video.srcObject = this.stream;
          // Asegura que el video esté reproduciéndose
          video.play().catch(() => { });
        }
      }, 150);

    } catch (err: any) {
      this.camaraActiva = false;
      this.camaraError =
        err?.name === 'NotAllowedError'
          ? 'Permiso de cámara denegado. Habilítalo en la configuración del navegador.'
          : 'No se pudo acceder a la cámara.';
    }
  }

  capturarFoto(): void {
    const video = this.videoRef?.nativeElement;
    const canvas = this.canvasRef?.nativeElement;

    if (!video || !canvas || video.videoWidth === 0 || video.readyState < 2) {
      this.camaraError = 'La cámara aún no está lista. Espera un momento.';
      return;
    }

    this.camaraError = '';
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Detener stream ANTES de leer el blob
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.camaraActiva = false;

    canvas.toBlob((blob: Blob | null) => {
      if (!blob) {
        this.camaraError = 'No se pudo capturar la imagen. Intenta de nuevo.';
        this.cdr.detectChanges();
        return;
      }

      this.fotoCapturadaBlob = blob;

      const reader = new FileReader();
      reader.onload = (e) => {
        this.fotoCapturadaPreview = e.target?.result as string;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(blob);

    }, 'image/jpeg', 0.92);
  }

  confirmarFotoCapturada(): void {
    if (!this.fotoCapturadaBlob || !this.fotoCapturadaPreview) return;

    const archivo = new File(
      [this.fotoCapturadaBlob],
      `foto-${Date.now()}.jpg`,
      { type: 'image/jpeg' }
    );

    this.fotoArchivo = archivo;
    this.fotoPreview = this.fotoCapturadaPreview;

    // Limpiar temporales y cerrar todo
    this.fotoCapturadaPreview = null;
    this.fotoCapturadaBlob = null;
    this.cerrarCamaraDesktop();
    this.modalFotoVisible = false;
    this.fotoError = '';
  }

  descartarFotoCapturada(): void {
    this.cerrarCamaraDesktop();
    this.fotoCapturadaPreview = null;
    this.fotoCapturadaBlob = null;
  }

  cerrarCamaraDesktop(): void {
    this.camaraActiva = false;
    this.camaraError = '';
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }

  // Submit

  onSubmit(): void {
    this.form.markAllAsTouched();
    this.errorMensaje = '';

    if (this.correoYaRegistrado) {
      this.errorMensaje = 'Ya tenemos registradas tus respuestas. Si necesitas corregir algún dato, comunícate con vinculación.';
      return;
    }

    if (this.form.invalid) {
      this.errorMensaje = 'Por favor completa todos los campos obligatorios.';
      return;
    }

    const v = this.form.value;
    const inactivo = !this.estaActivo;
    const sinEmpleo = v.tiempo_primer_empleo === 'Aún no he conseguido empleo';

    const payload: CreateEgresadoEtapa1 = {
      nombre_completo: v.nombre,
      genero: v.genero,
      correo: v.correo,
      telefono: v.telefono,
      ciudad_residencia: v.ciudad,
      pais_nacimiento: v.pais_nacimiento,
      facebook: v.facebook || '',
      instagram: v.instagram || '',
      carrera: v.carrera,
      anio_ingreso: Number(v.anio_ingreso),
      periodo_ingreso: v.periodo_ingreso,
      anio_egreso: Number(v.anio),
      estatus_titulacion: v.titulacion,
      certificacion_vigente: v.certificacion,
      ...this.construirEstudios(v),
      nivel_ingles: v.ingles,
      situacion_laboral: v.situacion,
      empresa: inactivo ? '' : (v.empresa || ''),
      antiguedad_empleo: inactivo ? '' : (v.antiguedad || ''),
      ciudad_trabajo: inactivo ? '' : (v.ciudadtrabajo || ''),
      tiempo_primer_empleo: v.tiempo_primer_empleo,
      medio_primer_empleo: sinEmpleo ? '' : (v.medio_primer_empleo || ''),
      medio_primer_empleo_otro:
        (!sinEmpleo && v.medio_primer_empleo === 'Otra')
          ? (v.medio_primer_empleo_otro || '')
          : '',
      ...this.construirPrimerEmpleo(v, sinEmpleo),
      ...this.construirEmprendimiento(v),
      ...this.construirProyectoSocial(v),
      satisfaccion_formacion: Number(v.satisfaccion),
      autorizaciones: {
        estadisticas: v.autorizacion_estadisticos,
        contacto: v.autorizacion_contacto,
        eventos: v.autorizacion_actividades,
      },
      ...this.construirDatosSensibles(v),
    };

    this.enviando = true;

    if (this.fotoArchivo) {
      const formData = new FormData();
      formData.append('data', JSON.stringify(payload));
      formData.append('foto', this.fotoArchivo, this.fotoArchivo.name);

      this.svc.enviarEtapa1ConFoto(formData).subscribe({
        next: (resp: any) => this.handleSuccess(resp, v.correo),
        error: (err: any) => this.handleError(err),
      });
    } else {
      this.svc.enviarEtapa1(payload).subscribe({
        next: (resp: any) => this.handleSuccess(resp, v.correo),
        error: (err: any) => this.handleError(err),
      });
    }
  }

  verificarCorreo(): void {
    const control = this.f['correo'];

    // Solo verificamos si el correo tiene formato válido
    if (control.invalid || !control.value) {
      this.correoYaRegistrado = false;
      return;
    }

    this.verificandoCorreo = true;
    this.svc.buscarPorCorreo(control.value).subscribe({
      next: (resp) => {
        this.verificandoCorreo = false;
        // Solo bloqueamos si el registro ya está COMPLETO.
        // Si está a medias o no existe, lo dejamos continuar.
        this.correoYaRegistrado = !!resp && resp.registro_completo === true;
      },
      error: () => {
        // Si la verificación falla, no bloqueamos; el candado del backend es la red de seguridad.
        this.verificandoCorreo = false;
        this.correoYaRegistrado = false;
      },
    });
  }

  private handleSuccess(resp: any, correo: string): void {
    this.enviando = false;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('id_egresado', String(resp.id_egresado));
      localStorage.setItem('correo_egresado', correo);
      localStorage.setItem('nombre_egresado', this.form.value.nombre);
    }
    this.mostrarExito = true;
    setTimeout(() => {
      this.mostrarExito = false;
      this.router.navigate(['/egresados2']);
    }, 1500);
  }

  private handleError(err: any): void {
    this.enviando = false;

    const errBody = err?.error;
    if (typeof errBody === 'string') {
      this.errorMensaje = errBody;
    } else if (typeof errBody === 'object' && errBody !== null) {
      this.errorMensaje =
        errBody.message ??
        (Array.isArray(errBody.errors) ? errBody.errors.join(', ') : null) ??
        JSON.stringify(errBody);
    } else {
      this.errorMensaje = 'Ocurrió un error al guardar. Intenta de nuevo.';
    }

    console.error('Error Etapa 1:', err);
  }

  // Los opcionales vacíos no se envían: ni strings vacíos ni null.
  private tieneValor(valor: unknown): boolean {
    return valor !== null && valor !== undefined && String(valor).trim() !== '';
  }

  private construirPrimerEmpleo(v: any, sinEmpleo: boolean): Partial<CreateEgresadoEtapa1> {
    if (sinEmpleo) {
      return {};
    }
    return {
      primer_empleo_empresa: String(v.primer_empleo_empresa).trim(),
      primer_empleo_puesto: String(v.primer_empleo_puesto).trim(),
    };
  }

  private construirEstudios(v: any): Partial<CreateEgresadoEtapa1> {
    if (!v.estudio_nivel || v.estudio_nivel === 'no') {
      return {};
    }

    const estudio: EstudioPosterior = {
      nivel: v.estudio_nivel,
      nombre_programa: String(v.estudio_programa).trim(),
      institucion: String(v.estudio_institucion).trim(),
      estado: v.estudio_estado,
    };
    if (this.tieneValor(v.estudio_anio)) {
      estudio.anio = Number(v.estudio_anio);
    }

    return { estudios: [estudio] };
  }

  private construirEmprendimiento(v: any): Partial<CreateEgresadoEtapa1> {
    if (v.emp_tiene !== 'si') {
      return {};
    }

    const emprendimiento: Emprendimiento = {
      nombre: String(v.emp_nombre).trim(),
      giro: String(v.emp_giro).trim(),
      sigue_operando: v.emp_sigue === 'si',
    };
    if (this.tieneValor(v.emp_anio)) {
      emprendimiento.anio_inicio = Number(v.emp_anio);
    }
    if (this.tieneValor(v.emp_rango)) {
      emprendimiento.rango_empleados = v.emp_rango;
    }

    return { emprendimientos: [emprendimiento] };
  }

  private construirProyectoSocial(v: any): Partial<CreateEgresadoEtapa1> {
    if (v.proy_participa !== 'si') {
      return {};
    }

    const proyecto: ProyectoSocial = {
      nombre: String(v.proy_nombre).trim(),
      tipo: v.proy_tipo,
    };
    if (this.tieneValor(v.proy_anio)) {
      proyecto.anio = Number(v.proy_anio);
    }
    if (this.tieneValor(v.proy_organizacion)) {
      proyecto.organizacion = String(v.proy_organizacion).trim();
    }

    return { proyectos_sociales: [proyecto] };
  }

  /**
 * Arma el bloque de datos sensibles solo si hubo consentimiento expreso.
 * Sin consentimiento devuelve un objeto vacío: el payload no lleva
 * consintio_datos_sensibles, ni discapacidad, ni identidad. El backend
 * descarta lo que llegue sin consentimiento, pero aquí ni siquiera se
 * envía.
 */
  private construirDatosSensibles(v: any): Partial<CreateEgresadoEtapa1> {
    if (v.consintio_sensibles !== true) {
      return {};
    }

    const discapacidad: DiscapacidadRespuesta[] = this.clavesDominio
      .map(clave => ({ dominio: clave, grado: v['disc_' + clave] }))
      .filter(r => !!r.grado);

    const identidad: IdentidadCultural = {
      indigena: v.ident_indigena,
      habla_lengua: v.ident_habla_lengua,
      afromexicano: v.ident_afromexicano,
    };

    if (v.ident_habla_lengua === 'si' && v.ident_lengua) {
      identidad.lengua_indigena = v.ident_lengua;
    }

    return {
      consintio_datos_sensibles: true,
      discapacidad,
      identidad,
    };
  }
}