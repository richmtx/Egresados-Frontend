import { Component, ViewEncapsulation, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { EgresadosService } from '../../services/egresados.service';
import { CatalogosService } from '../../services/catalogos.service';
import { CreateEgresadoEtapa2 } from '../../models/egresado.interface';
import { CoincidenciaLaboral } from '../../models/catalogos.interface';

function noCorreoInstitucional(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor: string = control.value ?? '';
    if (!valor) return null;

    const dominio = valor.split('@')[1] ?? '';

    const dominiosInstitucionales = [
      /\.edu\.mx$/i,
      /\.edu$/i,
      /\.gob\.mx$/i,
      /\.tecnm\.mx$/i,
      /itdurango/i,
      /tecnologico/i,
    ];

    const esInstitucional = dominiosInstitucionales.some(regex => regex.test(dominio));
    return esInstitucional ? { correoInstitucional: true } : null;
  };
}

@Component({
  selector: 'app-egresados2',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './egresados2.component.html',
  styleUrls: ['./egresados2.component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class Egresados2Component implements OnInit {

  form: FormGroup;
  mostrarExito = false;
  enviando = false;
  cargando = true;
  errorMensaje = '';

  coincidenciasLaborales: CoincidenciaLaboral[] = [];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private svc: EgresadosService,
    private catalogos: CatalogosService,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {
    this.form = this.fb.group({
      // Sección 1 · Validación de identidad
      correo: ['', [Validators.required, Validators.email, noCorreoInstitucional()]],
      nombre: ['', Validators.required],
      ncontrol: ['', Validators.required],

      // Sección 2 · Detalle Profesional
      linkedin: [''],
      puesto: [''],
      coincidencia: ['', Validators.required],
      certificaciones: [''],

      // Sección 3 · Habilidades
      hab_ingles: [false],
      hab_blandas: [false],
      hab_software: [false],
      hab_proyectos: [false],
      hab_emprendimiento: [false],
      hab_vinculacion: [false],
      hab_normatividad: [false],
      hab_datos: [false],
      hab_otro_check: [false],
      hab_otro_texto: [{ value: '', disabled: true }],  // deshabilitado por defecto

      // Sección 3 · Colaboraciones
      col_planes: [false],
      col_platicas: [false],
      col_asesor: [false],
      col_patronato: [false],
      col_empresa: [false],
      col_encuestas: [false],
      col_nopuedo: [false],
      col_otro_check: [false],
      col_otro_texto: [{ value: '', disabled: true }],  // deshabilitado por defecto
    });
  }

  get f() { return this.form.controls; }

  // ── Habilitar / deshabilitar campo "Otro" de Habilidades ──────
  toggleOtroHab(): void {
    if (this.f['hab_otro_check'].value) {
      this.f['hab_otro_texto'].enable();
    } else {
      this.f['hab_otro_texto'].disable();
      this.f['hab_otro_texto'].setValue('');
    }
  }

  // ── Habilitar / deshabilitar campo "Otro" de Colaboraciones ───
  toggleOtroCol(): void {
    if (this.f['col_otro_check'].value) {
      this.f['col_otro_texto'].enable();
    } else {
      this.f['col_otro_texto'].disable();
      this.f['col_otro_texto'].setValue('');
    }
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });

      const correoGuardado = localStorage.getItem('correo_egresado');
      if (correoGuardado) {
        this.form.patchValue({ correo: correoGuardado });
      }
    }

    this.catalogos.getCoincidenciasLaborales().subscribe({
      next: (data) => {
        this.coincidenciasLaborales = data;
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        this.errorMensaje = 'Error al cargar el formulario. Recarga la página.';
        console.error('Error cargando catálogos:', err);
      },
    });
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    this.errorMensaje = '';

    if (this.form.invalid) {
      this.errorMensaje = 'Por favor completa todos los campos obligatorios.';
      return;
    }

    let idEgresado: number | null = null;
    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem('id_egresado');
      idEgresado = stored ? Number(stored) : null;
    }

    if (!idEgresado) {
      this.errorMensaje =
        'No se encontró tu registro de la Etapa 1. ' +
        'Por favor completa la Primera Etapa primero.';
      return;
    }

    // getRawValue() obtiene también los campos deshabilitados
    const v = this.form.getRawValue();

    const habilidades: string[] = [];
    if (v.hab_ingles) habilidades.push('Dominio del idioma inglés');
    if (v.hab_blandas) habilidades.push('Habilidades blandas (Liderazgo, Comunicación efectiva, Trabajo en equipo, Inteligencia emocional)');
    if (v.hab_software) habilidades.push('Uso de Software especializado y herramientas digitales actuales');
    if (v.hab_proyectos) habilidades.push('Gestión de Proyectos y metodologías ágiles');
    if (v.hab_emprendimiento) habilidades.push('Emprendimiento, Innovación y plan de negocios');
    if (v.hab_vinculacion) habilidades.push('Vinculación práctica (Visitas industriales y casos reales)');
    if (v.hab_normatividad) habilidades.push('Normatividad y Legislación aplicable a la carrera');
    if (v.hab_datos) habilidades.push('Ciencia de Datos y Análisis de información');

    const colaboraciones: string[] = [];
    if (v.col_planes) colaboraciones.push('Participar en la revisión y actualización de los planes de estudio (Mesas de trabajo)');
    if (v.col_platicas) colaboraciones.push('Impartir pláticas, conferencias o talleres a estudiantes');
    if (v.col_asesor) colaboraciones.push('Apoyar como asesor externo en Residencias Profesionales o proyectos');
    if (v.col_patronato) colaboraciones.push('Colaborar con el Patronato o Fundación ITD en iniciativas de apoyo (Becas, equipamiento o infraestructura).');
    if (v.col_empresa) colaboraciones.push('Vincular a mi empresa con el ITD (Bolsa de trabajo, visitas, convenios)');
    if (v.col_encuestas) colaboraciones.push('Responder encuestas de opinión específicas sobre mi área');
    if (v.col_nopuedo) colaboraciones.push('Por el momento no me es posible participar');

    const payload: CreateEgresadoEtapa2 = {
      correo: v.correo,
      nombre_completo: v.nombre,
      numero_control: v.ncontrol,
      linkedin: v.linkedin || '',
      puesto_trabajo: v.puesto || '',
      coincidencia_laboral: v.coincidencia,
      certificaciones: v.certificaciones || '',
      habilidades,
      habilidad_otro: v.hab_otro_check ? (v.hab_otro_texto?.trim() || '') : '',
      colaboraciones,
      colaboracion_otro: v.col_otro_check ? (v.col_otro_texto?.trim() || '') : '',
    };

    this.enviando = true;

    this.svc.enviarEtapa2(idEgresado, payload).subscribe({
      next: () => {
        this.enviando = false;
        if (isPlatformBrowser(this.platformId)) {
          localStorage.removeItem('id_egresado');
          localStorage.removeItem('correo_egresado');
        }
        this.mostrarExito = true;
        setTimeout(() => {
          this.mostrarExito = false;
          this.router.navigate(['/index']);
        }, 3500);
      },
      error: (err) => {
        this.enviando = false;
        this.errorMensaje = err?.error?.message || 'Ocurrió un error al guardar. Intenta de nuevo.';
        console.error('Error Etapa 2:', err);
      },
    });
  }
}