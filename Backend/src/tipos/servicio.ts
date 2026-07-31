// Catálogo de servicios del CDA.
//
// Un servicio es un trabajo que el CDA presta y que el cliente elige al agendar.
// El catálogo es la única fuente de verdad sobre lo que el CDA ofrece: el
// formulario de agendamiento, el panel admin y el asistente del sitio se
// alimentan todos de acá (FR-001).

/**
 * Tipos de vehículo que atiende el CDA.
 *
 * Los valores son EXACTAMENTE los `label` de `vehiculos` en Frontend/data.js y
 * los que ya viajan en el campo `vehicle` de cada cita. No se traducen ni se
 * normalizan: cambiarlos rompería las citas ya registradas.
 */
export type TipoVehiculo = "Motos 2T" | "Motos 4T" | "Vehículos Livianos" | "Vehículos Pesados";

/** Los cuatro tipos de vehículo, para recorrerlos y validarlos en tiempo de ejecución. */
export const TIPOS_VEHICULO: readonly TipoVehiculo[] = [
  "Motos 2T",
  "Motos 4T",
  "Vehículos Livianos",
  "Vehículos Pesados",
];

/** Un servicio del catálogo. */
export interface Servicio {
  /**
   * Identificador estable, en minúsculas y sin acentos ('revision-de-gases').
   * Es lo que permite renombrar un servicio de cara al cliente sin romper las
   * citas ya registradas ni el conteo del panel: el nombre cambia, el id no.
   */
  id: string;
  /** Nombre visible para el cliente, en español. */
  nombre: string;
  /**
   * Tipos de vehículo a los que este servicio NO aplica. Vacío = aplica a todos.
   *
   * Se modela por EXCLUSIÓN y no por inclusión porque la regla real del negocio
   * es una sola excepción (certificado de blindaje no aplica a motos, FR-009).
   * Listar los tipos aplicables repetiría los cuatro valores en cinco de los seis
   * servicios y obligaría a tocar todas las filas al agregar un tipo de vehículo.
   */
  vehiculosExcluidos: TipoVehiculo[];
}

/**
 * Regla de exclusión de FR-009: ¿este servicio se le puede ofrecer a este vehículo?
 *
 * Vive acá, junto al tipo, y no dentro de una implementación de repositorio,
 * porque es una regla de negocio y no de almacenamiento: cuando el catálogo pase
 * a Postgres, la regla sigue siendo esta misma función.
 */
export function servicioAplicaAVehiculo(servicio: Servicio, vehiculo: TipoVehiculo): boolean {
  return !servicio.vehiculosExcluidos.includes(vehiculo);
}
