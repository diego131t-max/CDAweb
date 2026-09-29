import type { Encuesta, FiltroEncuestas, NuevaEncuesta, ResumenEncuestas } from "../tipos/encuesta.js";

/**
 * Puerto de persistencia de las encuestas de satisfacción.
 *
 * Igual que los demás: los handlers hablan SOLO con esta interfaz y nunca leen ni
 * escriben el almacenamiento directamente.
 */
export interface RepositorioEncuestas {
  /**
   * Guarda una encuesta nueva. El repositorio genera `id`, `date` y `creadoEn`:
   * esos valores nunca se toman del cliente.
   */
  crear(datos: NuevaEncuesta): Promise<Encuesta>;

  /** Lista las encuestas de la más reciente a la más antigua, con tope. */
  listar(filtro?: FiltroEncuestas): Promise<Encuesta[]>;

  /**
   * Total y promedios del rango, calculados en la base sobre TODAS las encuestas
   * y no sobre las que devuelve `listar`. Ver `ResumenEncuestas`.
   */
  resumen(filtro?: FiltroEncuestas): Promise<ResumenEncuestas>;
}
