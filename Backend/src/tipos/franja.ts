import { esFestivoColombia } from "./festivos.js";

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
 * ESTA ES LA LISTA BASE, la de un día hábil. No todos los días valen igual: las
 * franjas que de verdad se ofrecen un día concreto salen de `franjasDelDia`, más
 * abajo (sábado hasta la 1:30 PM, festivos hasta el mediodía, domingo cerrado).
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

/**
 * Cómo es un día para efectos de la atención.
 *
 * - `habil`    lunes a viernes que no son festivo.
 * - `sabado`   sábado que no es festivo.
 * - `festivo`  festivo de Colombia que cae de lunes a sábado.
 * - `domingo`  domingo, sea o no festivo: el CDA no abre.
 */
export type TipoDeDia = "habil" | "sabado" | "festivo" | "domingo";

/**
 * Última franja que se ofrece según el tipo de día. NO está acá `domingo`: no tiene.
 *
 * Salen del horario que publica el sitio (ratificado con el propietario el
 * 2026-10-06): lunes a viernes hasta las 6:00 PM, sábados hasta la 1:30 PM y
 * festivos de 8:00 AM a 12:00 M. Las franjas duran una hora, así que la última es
 * la que TERMINA a tiempo: la de las 17:00 acaba a las 18:00, la de las 12:00
 * acaba a la 13:00 (la de las 13:00 acabaría a las 14:00, pasada la 1:30), y la de
 * las 11:00 acaba al mediodía.
 *
 * Si el horario publicado cambia, esto cambia con él y se corrige también
 * CDA.horario (Frontend/data.js) y los datos estructurados de index.html.
 */
const ULTIMA_FRANJA: Record<Exclude<TipoDeDia, "domingo">, Franja> = {
  habil: "17:00",
  sabado: "12:00",
  festivo: "11:00",
};

/**
 * El tipo de día de una fecha 'AAAA-MM-DD' ya validada.
 *
 * El día de la semana se saca en UTC sobre la fecha sin hora: un `new Date()`
 * local en un servidor al oeste de Greenwich la correría al día anterior.
 */
export function tipoDeDia(fecha: string): TipoDeDia {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const diaSemana = new Date(Date.UTC(anio ?? 0, (mes ?? 1) - 1, dia ?? 1)).getUTCDay();

  // El domingo gana sobre el festivo: un festivo en domingo sigue cerrado.
  if (diaSemana === 0) return "domingo";
  if (esFestivoColombia(fecha)) return "festivo";
  return diaSemana === 6 ? "sabado" : "habil";
}

/** Las franjas que se ofrecen en una fecha concreta. Vacía los domingos. */
export function franjasDelDia(fecha: string): readonly Franja[] {
  const tipo = tipoDeDia(fecha);
  if (tipo === "domingo") return [];

  const ultima = ULTIMA_FRANJA[tipo];
  return FRANJAS.filter((hora) => hora <= ultima);
}

/** ¿Se ofrece `hora` en esa fecha? Es la regla que el servidor aplica al agendar. */
export function esFranjaDelDia(fecha: string, hora: string): boolean {
  return (franjasDelDia(fecha) as readonly string[]).includes(hora);
}
