// Utilidades de fecha.

/** Zona horaria del negocio: el CDA está en Valledupar, Colombia (UTC-5). */
export const ZONA_HORARIA_CDA = "America/Bogota";

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// 'en-CA' formatea como 'YYYY-MM-DD', que es justo el formato del contrato.
const formateador = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA_CDA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Fecha de hoy en 'YYYY-MM-DD' según la hora de Colombia.
 *
 * Ojo: no se usa `toISOString().slice(0, 10)` (como hace hoy el frontend) porque
 * eso da la fecha en UTC y después de las 7 p.m. de Colombia ya es el día siguiente.
 */
export function fechaHoyEnColombia(referencia: Date = new Date()): string {
  return formateador.format(referencia);
}

/** Valida que una cadena tenga el formato 'YYYY-MM-DD' y sea una fecha real. */
export function esFechaValida(valor: string): boolean {
  if (!FORMATO_FECHA.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime())) return false;
  // Descarta fechas inexistentes que Date "corrige" sola (ej. 2026-02-31).
  return fecha.toISOString().slice(0, 10) === valor;
}
