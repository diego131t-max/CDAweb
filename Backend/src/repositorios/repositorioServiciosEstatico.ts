import type { Servicio } from "../tipos/servicio.js";
import type { RepositorioServicios } from "./repositorioServicios.js";

/**
 * El catálogo de servicios del CDA (FR-008).
 *
 * ⚠️ DATO DE NEGOCIO — NO SE INVENTA NI SE REFORMULA (principio I de la
 * constitución). Este arreglo es la única fuente de verdad del sistema sobre lo
 * que el CDA ofrece: de acá salen el formulario de agendamiento, la validación
 * del POST de la cita, el conteo por servicio del panel y la respuesta "¿Qué
 * servicios ofrecen?" del asistente.
 *
 * EL CDA PRESTA UN SOLO SERVICIO, y eso es un dato del propietario, no una
 * simplificación nuestra. Hasta el 2026-08-21 este catálogo tenía SEIS entradas:
 * técnico-mecánica, gases, luces y frenos, peritaje, certificado de blindaje y
 * diagnóstico electrónico. Nunca estuvieron ratificadas —se habían adoptado de
 * lo que el propio sitio ya decía, con la advertencia escrita de que faltaba
 * confirmarlas—, y al confirmarlas resultó que cinco no existen. El sitio estuvo
 * ofreciendo servicios que el CDA no presta; por eso la advertencia estaba.
 *
 * EL `id` NO CAMBIA aunque el nombre sí. Se llamaba "Revisión Técnico-Mecánica"
 * y ahora nombra también los gases, que es como se llama el sitio entero y como
 * funciona la RTM-EC: una sola revisión que incluye emisiones. Renombrar es
 * cambiar `nombre`; tocar el `id` dejaría huérfana cada cita ya registrada.
 *
 * Las citas viejas que apuntan a los cinco retirados NO se pierden ni rompen el
 * panel: se cuentan aparte como "fuera del catálogo" y su detalle sigue visible
 * en Reservas (ver appointmentsByServiceMarkup en Frontend/pages/admin.js).
 *
 * YA NO HAY EXCLUSIONES POR VEHÍCULO. La única que existía era la de FR-009
 * —certificado de blindaje no aplica a motos— y se fue con el servicio. La
 * maquinaria que la aplica (`vehiculosExcluidos`, `servicioAplicaAVehiculo`) se
 * conserva a propósito: es la que hace cumplir la regla si algún día vuelve a
 * haber un servicio que no aplique a todo, y hoy no cuesta nada porque el
 * arreglo está vacío.
 */
export const CATALOGO_SERVICIOS: readonly Servicio[] = [
  {
    id: "revision-tecnico-mecanica",
    nombre: "Revisión Técnico-Mecánica y de Gases",
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
