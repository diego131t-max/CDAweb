/**
 * Franjas de atención y cupo por franja — FR-028.
 *
 * Ratificado con el propietario el 2026-08-22: el CDA recibe **cuatro vehículos
 * por franja**, y esos cuatro son para todos los tipos de vehículo juntos. No
 * hay cupos separados para motos y para livianos: son cuatro puestos, y el que
 * llega primero los toma.
 *
 * POR QUÉ ESTA LISTA VIVE EN EL SERVIDOR Y NO EN EL FORMULARIO
 *
 * Hasta ahora las franjas eran cinco horas escritas dentro de un `<select>` en
 * `Frontend/pages/schedule.js`, y el servidor aceptaba cualquier 'HH:MM' que le
 * llegara: solo comprobaba el formato. Mientras no hubo tope eso daba igual.
 *
 * Con tope deja de dar igual, y de una forma que no se ve: si el conteo es por
 * (fecha, hora) y el cliente puede mandar la hora que quiera, entonces mandar
 * '09:07' en vez de '09:00' inventa una franja nueva y vacía. El tope se
 * esquivaría sin siquiera proponérselo —basta un formulario viejo abierto en
 * una pestaña— y el CDA se encontraría con carros que el sistema dijo que
 * cabían.
 *
 * Una lista de horas en un desplegable es una comodidad. La regla es esto.
 */

/** Vehículos que caben en una misma franja, sumando todos los tipos. */
export const CUPOS_POR_FRANJA = 4;

/**
 * Las horas en que el CDA recibe vehículos.
 *
 * Cada hora en punto de 8 de la mañana a 5 de la tarde: diez franjas, que por
 * cuatro cupos dan un techo de cuarenta vehículos diarios.
 *
 * Antes eran cinco —08:00, 09:00, 10:30, 14:00 y 16:00— y no correspondían a
 * nada: el sitio publica atención de 7:30 AM a 6:00 PM, así que ese reparto
 * dejaba diez horas y media de trabajo para veinte carros. Ese '10:30' suelto
 * entre horas redondas venía del demo, igual que "PayU" en los medios de pago.
 *
 * LO QUE ESTA LISTA TODAVÍA NO DISTINGUE: el sitio publica horarios distintos
 * para sábados (hasta las 4) y festivos (hasta el mediodía). Acá las diez
 * franjas valen para todos los días, así que un sábado se puede agendar a las
 * 17:00. Se deja así a propósito y no por descuido: resolverlo bien exige el
 * calendario de festivos de Colombia, que se mueve cada año y no se puede
 * inventar. Está anotado como pendiente.
 */
export const FRANJAS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
] as const;

/** Una de las horas de `FRANJAS`. El tipo se deriva de la lista, no se repite. */
export type Franja = (typeof FRANJAS)[number];

/** ¿Es `hora` una de las franjas de atención? Estrecha el tipo si lo es. */
export function esFranja(hora: string): hora is Franja {
  return (FRANJAS as readonly string[]).includes(hora);
}

/**
 * Cuántos lugares quedan en una franja de un día concreto.
 *
 * `ocupados` cuenta las citas que NO están canceladas: una cita cancelada
 * libera su lugar, una atendida no —esa ya ocurrió—.
 */
export interface CupoDeFranja {
  hora: Franja;
  ocupados: number;
  disponibles: number;
}
