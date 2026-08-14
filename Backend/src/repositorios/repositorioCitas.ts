import type { Cita, EstadoCita, FiltroCitas, NuevaCita } from "../tipos/cita.js";

/**
 * Puerto de persistencia de las citas.
 *
 * Los handlers de Express hablan SOLO con esta interfaz: nunca leen ni escriben
 * el almacenamiento directamente. Si para cambiar de motor hay que tocar un
 * handler, el diseño está mal (principio III).
 *
 * Todas las firmas son asíncronas, igual que en `RepositorioMensajes`.
 */

/**
 * Cómo terminó un intento de borrado.
 *
 * Son tres desenlaces y no dos porque "no se borró" tiene dos causas que el
 * mostrador necesita distinguir: la cita no existe (alguien la borró antes, o el
 * id está mal) o existe pero todavía no está cancelada. Devolver `false` para
 * las dos obligaría a la ruta a adivinar entre un 404 y un 409.
 */
export type ResultadoBorrado =
  | { resultado: "borrada" }
  | { resultado: "no-existe" }
  | { resultado: "no-cancelada"; estado: EstadoCita };
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

  /**
   * Borra una cita DEFINITIVAMENTE, y solo si está cancelada.
   *
   * POR QUÉ EXISTE, SI FR-020 DECÍA QUE NO. FR-020 sigue en pie y no se toca:
   * cancelar nunca borra. El razonamiento de esa regla es que el CDA necesita
   * saber que una cita existió y no se atendió, y eso vale para las citas de
   * clientes reales.
   *
   * Lo que ese razonamiento no cubre —y por eso se agregó esto después— son tres
   * cosas que igual terminan en la tabla: registros de prueba, spam de robots y
   * duplicados. Ninguno es historia del negocio; conservarlos falsea los conteos
   * en la dirección contraria.
   *
   * Y hay un cuarto caso que pesa más que los tres: la Ley 1581 le da a una
   * persona el **derecho de supresión** de sus datos personales. Un sistema que
   * estructuralmente no puede borrar los datos de un cliente que los reclama no
   * es prolijo, es incumplidor.
   *
   * POR QUÉ SOLO LAS CANCELADAS. Para que borrar sean dos actos deliberados y no
   * uno. Un clic mal dado en la fila equivocada no puede evaporar la cita que
   * alguien reservó para mañana: primero hay que cancelarla, que es reversible y
   * se ve, y recién después borrarla. La regla se aplica ACÁ, en el almacenamiento,
   * y no solo en el panel: una comprobación de interfaz protege a la interfaz.
   */
  borrar(id: string): Promise<ResultadoBorrado>;
}
