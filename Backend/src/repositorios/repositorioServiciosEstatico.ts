import type { Servicio } from "../tipos/servicio.js";
import type { RepositorioServicios } from "./repositorioServicios.js";

/**
 * El catálogo de servicios del CDA (FR-008).
 *
 * ⚠️ DATO DE NEGOCIO — NO SE INVENTA NI SE REFORMULA (principio I de la
 * constitución). Estos seis servicios son exactamente los que el sitio ya
 * publica hoy en la respuesta "¿Qué servicios ofrecen?" de su asistente
 * (Frontend/data.js, chatbotPrompts.servicios). Se adoptan por estar ya
 * comprometidos públicamente, pero QUEDAN PENDIENTES DE RATIFICAR con el
 * propietario del CDA antes de salir a producción. Si el propietario corrige la
 * lista, se corrige acá: este arreglo es la única fuente de verdad del sistema.
 *
 * Agregar, quitar o renombrar un servicio requiere confirmación del propietario.
 * Los `id` son estables: renombrar un servicio cambia `nombre`, nunca `id`.
 *
 * La única exclusión es la de FR-009: certificado de blindaje no aplica a motos
 * (2T ni 4T). Los vehículos livianos y pesados admiten los seis servicios.
 */
export const CATALOGO_SERVICIOS: readonly Servicio[] = [
  {
    id: "revision-tecnico-mecanica",
    nombre: "Revisión Técnico-Mecánica",
    vehiculosExcluidos: [],
  },
  {
    id: "revision-de-gases",
    nombre: "Revisión de Gases",
    vehiculosExcluidos: [],
  },
  {
    id: "inspeccion-de-luces-y-frenos",
    nombre: "Inspección de Luces y Frenos",
    vehiculosExcluidos: [],
  },
  {
    id: "peritaje-vehicular",
    nombre: "Peritaje Vehicular",
    vehiculosExcluidos: [],
  },
  {
    id: "certificado-de-blindaje",
    nombre: "Certificado de Blindaje",
    // Única exclusión del catálogo (FR-009): una moto no se blinda.
    vehiculosExcluidos: ["Motos 2T", "Motos 4T"],
  },
  {
    id: "diagnostico-electronico",
    nombre: "Diagnóstico Electrónico",
    vehiculosExcluidos: [],
  },
];

/**
 * Implementación de RepositorioServicios sobre la constante versionada de arriba.
 *
 * A diferencia de los mensajes, el catálogo no lo escribe ningún usuario: cambia
 * cuando cambia el negocio, del orden de una vez al año. Vivir en código lo deja
 * versionado y revisable por diff, que es lo correcto para configuración de
 * negocio, y evita un archivo JSON mutable que nadie muta.
 *
 * No es información personal: es lo que el CDA publica de cara al público, por
 * eso su lectura no exige autenticación (ver rutas/servicios.ts).
 */
export class RepositorioServiciosEstatico implements RepositorioServicios {
  private readonly catalogo: readonly Servicio[];

  /** El catálogo se puede inyectar para poder probar casos límite sin tocar el real. */
  constructor(catalogo: readonly Servicio[] = CATALOGO_SERVICIOS) {
    this.catalogo = catalogo;
  }

  async listar(): Promise<Servicio[]> {
    // Copia profunda: el catálogo es una constante compartida por todas las
    // peticiones y quien la reciba no debe poder mutarla sin querer.
    return this.catalogo.map(clonar);
  }

  async obtenerPorId(id: string): Promise<Servicio | null> {
    const servicio = this.catalogo.find((candidato) => candidato.id === id);
    return servicio === undefined ? null : clonar(servicio);
  }
}

function clonar(servicio: Servicio): Servicio {
  return { ...servicio, vehiculosExcluidos: [...servicio.vehiculosExcluidos] };
}
