import type { Cita, EstadoCita, FiltroCitas, NuevaCita, ResumenCitas } from "../tipos/cita.js";
import type { CupoDeFranja } from "../tipos/franja.js";

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

/**
 * Cómo terminó un intento de registrar una cita — FR-028.
 *
 * POR QUÉ `crear` DEVUELVE ESTO Y NO UNA CITA A SECAS
 *
 * El tope de cupos parece un chequeo previo: contar cuántas citas hay en la
 * franja y, si caben, insertar. Escrito así tiene una carrera que en el
 * mostrador se ve como un carro de más.
 *
 * Dos personas envían el formulario para las 9:00 en el mismo segundo. Las dos
 * consultas cuentan tres citas, las dos concluyen que cabe una más, las dos
 * insertan. La franja queda con cinco y nadie se entera hasta que llega el
 * quinto carro.
 *
 * Por eso contar e insertar son UNA sola operación indivisible, y por eso vive
 * en el almacenamiento y no en la ruta: es el único lugar donde se puede tomar
 * un candado. Si la ruta preguntara "¿cabe?" y después dijera "insertá", la
 * carrera volvería aunque las dos consultas fueran perfectas.
 *
 * `ocupados` viaja en la respuesta porque el mensaje al cliente lo necesita: no
 * es lo mismo "esa franja se acaba de llenar" que "no pudimos guardar tu cita".
 */
export type ResultadoCreacion =
  | { resultado: "creada"; cita: Cita }
  | { resultado: "franja-llena"; ocupados: number };
export interface RepositorioCitas {
  /**
   * Registra una cita nueva, si queda cupo en su franja (FR-028).
   *
   * El repositorio genera `id`, `status` y `creadoEn`: esos valores nunca se
   * toman del cliente. El conteo de cupos y la inserción ocurren juntos y sin
   * que nadie más pueda meterse en el medio; ver `ResultadoCreacion`.
   */
  crear(datos: NuevaCita): Promise<ResultadoCreacion>;

  /**
   * Cuántos lugares quedan en cada franja de un día — FR-028.
   *
   * Devuelve SIEMPRE las diez franjas, llenas o vacías: el formulario dibuja su
   * desplegable con esto, así que la lista de horas que ve el cliente sale del
   * servidor y no puede quedar desfasada de la que el servidor acepta.
   *
   * Solo cuenta. No devuelve ni un dato de ningún cliente, que es lo que
   * permite que el endpoint que la expone sea público.
   */
  disponibilidad(fecha: string): Promise<CupoDeFranja[]>;

  /**
   * Conteos agregados de un periodo, para Reportes.
   *
   * Los dos extremos van incluidos. Devuelve NÚMEROS, no citas: ver el
   * comentario de `ResumenCitas` para por qué eso importa.
   */
  resumen(desde: string, hasta: string): Promise<ResumenCitas>;

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
