import type { Cita, EstadoCita, FiltroCitas, NuevaCita } from "../tipos/cita.js";

/**
 * Puerto de persistencia de las citas.
 *
 * Los handlers de Express hablan SOLO con esta interfaz: nunca leen ni escriben
 * el almacenamiento directamente. Si para cambiar de motor hay que tocar un
 * handler, el diseño está mal (principio III).
 *
 * Todas las firmas son asíncronas, igual que en `RepositorioMensajes`.
 *
 * NO HAY `borrar` A PROPÓSITO. Cancelar una cita la marca como cancelada, no la
 * elimina: el CDA necesita saber que existió y que no se atendió. Una cita
 * borrada es una conversación con un cliente que desaparece del registro.
 */
export interface RepositorioCitas {
  /**
   * Registra una cita nueva. El repositorio genera `id`, `status` y `creadoEn`:
   * esos valores nunca se toman del cliente.
   */
  crear(datos: NuevaCita): Promise<Cita>;

  /**
   * Lista las citas ordenadas por fecha y hora.
   * Sin filtro devuelve las que entren en el tope por omisión.
   */
  listar(filtro?: FiltroCitas): Promise<Cita[]>;

  /**
   * Cambia el estado de una cita y devuelve cómo quedó.
   *
   * Devuelve `null` si no existe una cita con ese id, para que la ruta pueda
   * responder 404 sin tener que consultar antes.
   */
  actualizarEstado(id: string, estado: EstadoCita): Promise<Cita | null>;
}
