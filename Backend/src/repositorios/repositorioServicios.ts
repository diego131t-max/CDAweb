import type { Servicio } from "../tipos/servicio.js";

/**
 * Puerto de lectura del catálogo de servicios.
 *
 * Los handlers de Express hablan SOLO con esta interfaz: nunca leen el catálogo
 * directamente. Hoy detrás hay una constante versionada en código; mañana puede
 * haber una tabla de Postgres/Supabase. Migrar debe ser escribir otra clase que
 * implemente esta interfaz y cambiar la línea de src/dependencias.ts donde se
 * instancia. Si para migrar hay que tocar un handler, el diseño está mal.
 *
 * Todas las firmas son asíncronas desde el día uno, aunque la implementación
 * estática podría ser síncrona: así migrar a una base de datos no obliga a
 * propagar `async` por todo el código.
 *
 * El catálogo es de SOLO LECTURA para el sistema: administrarlo desde el panel
 * está fuera del alcance de esta funcionalidad, por eso no hay `crear` ni
 * `actualizar`. Cambiar un servicio hoy es un cambio de código revisable por diff.
 */
export interface RepositorioServicios {
  /**
   * Devuelve el catálogo completo, en el orden en que se le muestra al cliente.
   * Incluye los servicios que no aplican a todos los vehículos: quien consulta
   * decide qué ofrecer según `vehiculosExcluidos` (ver servicioAplicaAVehiculo).
   */
  listar(): Promise<Servicio[]>;

  /**
   * Busca un servicio por su id estable. Devuelve `null` si no está en el
   * catálogo, que es como se responde FR-004 ("rechazar una cita cuyo servicio
   * no pertenezca al catálogo") sin hacer que el llamador recorra la lista.
   */
  obtenerPorId(id: string): Promise<Servicio | null>;
}
