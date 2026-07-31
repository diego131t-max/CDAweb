import type { FiltroMensajes, Mensaje, NuevoMensaje } from "../tipos/mensaje.js";

/**
 * Puerto de persistencia de los mensajes de contacto.
 *
 * Los handlers de Express hablan SOLO con esta interfaz: nunca leen ni escriben
 * el almacenamiento directamente. Migrar de archivo JSON a Postgres/Supabase
 * debe ser escribir otra clase que implemente esta interfaz y cambiar la línea
 * de src/dependencias.ts donde se instancia. Si para migrar hay que tocar un
 * handler, el diseño está mal.
 *
 * Todas las firmas son asíncronas desde el día uno, aunque la implementación en
 * archivo podría ser síncrona: así migrar a una base de datos no obliga a
 * propagar `async` por todo el código.
 */
export interface RepositorioMensajes {
  /**
   * Guarda un mensaje nuevo. El repositorio genera `id`, `date` y `creadoEn`:
   * esos valores nunca se toman del cliente.
   */
  crear(datos: NuevoMensaje): Promise<Mensaje>;

  /**
   * Lista los mensajes del más reciente al más antiguo.
   * Sin filtro devuelve todos los mensajes.
   */
  listar(filtro?: FiltroMensajes): Promise<Mensaje[]>;
}
