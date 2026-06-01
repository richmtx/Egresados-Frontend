import { Component, ViewEncapsulation, OnInit, OnDestroy, Inject, PLATFORM_ID,
  ViewChild, ElementRef, ChangeDetectorRef, } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Subject, of, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { EgresadosService } from '../../services/egresados.service';
import { CatalogosService } from '../../services/catalogos.service';
import { CreateEgresadoEtapa1 } from '../../models/egresado.interface';
import {
  Carrera, Genero, NivelIngles, SituacionLaboral,
  AntiguedadEmpleo, CertificacionVigente,
} from '../../models/catalogos.interface';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

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

  // Catálogos
  carreras: Carrera[] = [];
  generos: Genero[] = [];
  nivelesIngles: NivelIngles[] = [];
  situacionesLaborales: SituacionLaboral[] = [];
  antiguedades: AntiguedadEmpleo[] = [];
  certificacionesVigentes: CertificacionVigente[] = [];

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
      carrera: ['', Validators.required],
      anio: ['', [Validators.required, Validators.min(1990), Validators.max(2026)]],
      titulacion: ['', Validators.required],
      certificacion: ['', Validators.required],
      ingles: ['', Validators.required],
      situacion: ['', Validators.required],
      empresa: [''],
      antiguedad: ['', Validators.required],
      ciudadtrabajo: [''],
      satisfaccion: ['', Validators.required],
      autorizacion_estadisticos: [false],
      autorizacion_contacto: [false],
      autorizacion_actividades: [false],
    }, { validators: alMenosUnaAutorizacion() });
  }

  get f() { return this.form.controls; }

  get autorizacionInvalida(): boolean {
    return this.form.hasError('autorizacionRequerida') &&
      (this.form.get('autorizacion_estadisticos')!.touched ||
        this.form.get('autorizacion_contacto')!.touched ||
        this.form.get('autorizacion_actividades')!.touched ||
        this.form.touched);
  }

  get estaActivo(): boolean {
    const valor = (this.form.get('situacion')?.value ?? '').toLowerCase();
    return !this.SITUACIONES_INACTIVAS.some(s => s.toLowerCase() === valor);
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
  }

  ngOnDestroy(): void {
    this.ciudadSub?.unsubscribe();
    this.ciudadTrabajoSub?.unsubscribe();
    this.situacionSub?.unsubscribe();
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

    if (this.form.invalid) {
      this.errorMensaje = 'Por favor completa todos los campos obligatorios.';
      return;
    }

    const v = this.form.value;
    const inactivo = !this.estaActivo;

    const payload: CreateEgresadoEtapa1 = {
      nombre_completo: v.nombre,
      genero: v.genero,
      correo: v.correo,
      telefono: v.telefono,
      ciudad_residencia: v.ciudad,
      carrera: v.carrera,
      anio_egreso: Number(v.anio),
      estatus_titulacion: v.titulacion,
      certificacion_vigente: v.certificacion,
      nivel_ingles: v.ingles,
      situacion_laboral: v.situacion,
      empresa: inactivo ? '' : (v.empresa || ''),
      antiguedad_empleo: inactivo ? '' : (v.antiguedad || ''),
      ciudad_trabajo: inactivo ? '' : (v.ciudadtrabajo || ''),
      satisfaccion_formacion: Number(v.satisfaccion),
      autorizaciones: {
        estadisticas: v.autorizacion_estadisticos,
        contacto: v.autorizacion_contacto,
        eventos: v.autorizacion_actividades,
      },
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
}