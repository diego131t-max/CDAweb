// Mensaje de contacto enviado desde el formulario público del sitio.
//
// Los campos `name`, `email`, `message` y `date` son el contrato que ya usa el
// frontend (ver Frontend/pages/contact.js y la semilla de Frontend/utils.js):
// el panel admin los renderiza con esos nombres exactos, así que no se traducen.
// `id` y `creadoEn` los agrega el servidor y el frontend simplemente los ignora.
export interface Mensaje {
  /** Identificador generado por el servidor (nunca por el cliente). */
  id: string;
  /** Nombre de quien escribe. */
  name: string;
  /** Correo de contacto. */
  email: string;
  /** Cuerpo del mensaje. */
  message: string;
  /** Fecha del mensaje en formato 'YYYY-MM-DD' (zona horaria de Colombia). */
  date: string;
  /** Marca de tiempo ISO 8601 completa; da orden estable dentro de un mismo día. */
  creadoEn: string;
}

/**
 * Datos que aporta el cliente al crear un mensaje.
 * `id`, `date` y `creadoEn` los define el servidor: no se aceptan del cliente.
 */
export type NuevoMensaje = Pick<Mensaje, "name" | "email" | "message">;

/** Filtros opcionales para listar mensajes desde el panel admin. */
export interface FiltroMensajes {
  /** Fecha mínima inclusive, 'YYYY-MM-DD'. */
  desde?: string;
  /** Fecha máxima inclusive, 'YYYY-MM-DD'. */
  hasta?: string;
  /** Cantidad máxima de mensajes a devolver. */
  limite?: number;
}
