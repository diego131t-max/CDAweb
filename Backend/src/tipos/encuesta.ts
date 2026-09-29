// Encuesta de satisfacción enviada desde la página pública /encuesta.
//
// Es ANÓNIMA: no lleva nombre, cédula, correo ni placa. Ver la migración 006 para
// el razonamiento completo.

/** Las notas van de 1 (malo) a 5 (excelente). */
export const NOTA_MINIMA = 1;
export const NOTA_MAXIMA = 5;

export interface Encuesta {
  /** Identificador generado por el servidor (nunca por el cliente). */
  id: string;
  /** Nota del servicio, entero de 1 a 5. */
  calificacionServicio: number;
  /** Nota de las instalaciones, entero de 1 a 5. */
  calificacionInstalaciones: number;
  /** Texto libre. Ausente cuando la persona no escribió nada. */
  sugerencias?: string;
  /** Fecha en 'YYYY-MM-DD' (zona horaria de Colombia). */
  date: string;
  /** Marca de tiempo ISO 8601 completa; da orden estable dentro de un mismo día. */
  creadoEn: string;
}

/**
 * Datos que aporta el cliente. `id`, `date` y `creadoEn` los define el servidor.
 */
export type NuevaEncuesta = Pick<Encuesta, "calificacionServicio" | "calificacionInstalaciones" | "sugerencias">;

/**
 * Filtros opcionales del listado. Son los mismos que los de los mensajes
 * (`desde`, `hasta`, `limite`) y por eso se reutiliza su tipo y su validación.
 */
export type { FiltroMensajes as FiltroEncuestas } from "./mensaje.js";

/**
 * Los números de arriba, calculados sobre TODAS las encuestas del rango y no
 * sobre la página que devuelve el listado. Un promedio sacado de las últimas cien
 * respuestas mientras el panel dice "300 encuestas" sería un dato falso.
 *
 * Los promedios son `null` cuando no hay ninguna encuesta: cero no es un
 * promedio, es la ausencia de uno.
 */
export interface ResumenEncuestas {
  total: number;
  promedioServicio: number | null;
  promedioInstalaciones: number | null;
}
