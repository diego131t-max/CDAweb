import { esFestivoColombia } from "./festivos.js";

/**
 * Horas de atención y cupo — FR-028.
 *
 * LA REGLA VIGENTE (2026-10-15, decidida por el propietario y confirmada por
 * Diego): en el CDA caben **dos vehículos A LA VEZ**, sumando todos los tipos.
 * Cada revisión dura **una hora** y puede **empezar cada media hora**: 7:30, 8:00,
 * 8:30… Una cita de las 9:30 ocupa el tramo [9:30, 10:30).
 *
 * POR QUÉ EL CONTEO DEJÓ DE SER EXACTO Y PASÓ A SER POR SOLAPAMIENTO
 *
 * Hasta acá (ratificado el 2026-08-22) había diez franjas fijas en punto, de 8:00
 * a 17:00, con cuatro cupos cada una, y una franja estaba llena cuando había
 * cuatro citas con ESA hora exacta. Con franjas que no se pisan entre sí, contar
 * por (fecha, hora) era la regla completa.
 *
 * Con inicios cada media hora y citas de una hora, las franjas se pisan: la de las
 * 9:00 y la de las 9:30 comparten la media hora de 9:30 a 10:00. Contar por hora
 * exacta dejaría entrar dos a las 9:00 y otros dos a las 9:30, y de 9:30 a 10:00
 * habría cuatro carros en un lugar donde caben dos. Lo que se limita ahora no es
 * "cuántas citas tienen esta hora" sino "cuántos carros hay adentro en el peor
 * instante del tramo que pide la cita nueva". Eso es `cupoParaHora`, más abajo.
 *
 * Ejemplo, con las 9:00 y las 9:30 ya tomadas (una cita cada una):
 *   - 9:00 → llena: entre 9:30 y 10:00 habría tres.
 *   - 8:30 → libre: solo se cruza con la de las 9:00.
 *   - 10:00 → libre: la de las 9:00 ya terminó a las 10:00 (los tramos son
 *     semiabiertos: el instante en que una sale es el instante en que otra entra).
 *
 * POR QUÉ ESTO VIVE EN EL SERVIDOR Y NO EN EL FORMULARIO
 *
 * Antes las horas eran cinco escritas dentro de un `<select>` en
 * `Frontend/pages/schedule.js`, y el servidor aceptaba cualquier 'HH:MM'. Con tope
 * eso es un agujero: mandar '09:07' inventaría una hora que el resto del sistema
 * no conoce. El frontend no tiene copia de nada de esto —ni de la grilla, ni de la
 * duración, ni del cupo—: dibuja lo que devuelve `GET /api/citas/disponibilidad`,
 * que trae hasta la hora de fin de cada tramo para que ni eso tenga que calcular.
 *
 * LAS CITAS QUE YA ESTABAN NO SE TOCAN. Las de antes de este cambio están en punto,
 * y puede haber tres o cuatro en la misma hora. No se mueven ni se reescriben: se
 * cuentan como lo que son —carros que van a estar adentro— y bloquean lo que
 * entra. Por eso `cupoParaHora` trabaja en minutos y no asume que las citas
 * existentes caigan en la grilla. La regla se aplica a lo que entra.
 */

/** Vehículos que pueden estar en revisión al mismo tiempo, sumando todos los tipos. */
export const CUPOS_SIMULTANEOS = 2;

/** Lo que dura una revisión: el tramo que ocupa una cita a partir de su hora. */
export const DURACION_MINUTOS = 60;

/** Cada cuánto puede empezar una cita. Define la grilla de horas que se ofrecen. */
export const PASO_MINUTOS = 30;

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
 * Horario de atención publicado, por tipo de día. NO está acá `domingo`: no abre.
 *
 * Es el que muestra el sitio y ratificó el propietario: lunes a viernes de 7:30 AM
 * a 6:00 PM, sábados de 7:30 AM a 1:30 PM y festivos de 8:00 AM a 12:00 M.
 *
 * Se guarda la APERTURA y el CIERRE —que es como lo dice el horario publicado— y
 * no la última hora de inicio, que se deriva: es la última de la grilla cuya cita
 * TERMINA a tiempo. Hábil 17:00 (acaba a las 18:00), sábado 12:30 (acaba a la
 * 1:30) y festivo 11:00 (acaba al mediodía). Escribirla a mano sería una segunda
 * copia del mismo dato, y el día que alguien cambie el cierre se olvidaría de ella.
 *
 * Si el horario publicado cambia, esto cambia con él y se corrigen también
 * CDA.horario (Frontend/data.js) y los datos estructurados de index.html.
 */
const HORARIO: Record<Exclude<TipoDeDia, "domingo">, { apertura: string; cierre: string }> = {
  habil: { apertura: "07:30", cierre: "18:00" },
  sabado: { apertura: "07:30", cierre: "13:30" },
  festivo: { apertura: "08:00", cierre: "12:00" },
};

/** 'HH:MM' (o 'HH:MM:SS') a minutos desde la medianoche. */
export function aMinutos(hora: string): number {
  const [horas, minutos] = hora.split(":").map(Number);
  return (horas ?? 0) * 60 + (minutos ?? 0);
}

/** Minutos desde la medianoche a 'HH:MM', con ceros a la izquierda. */
export function aHora(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return `${String(horas).padStart(2, "0")}:${String(resto).padStart(2, "0")}`;
}

/** 'HH:MM' como lo lee una persona en un mensaje: '07:30' → '7:30'. */
function horaLegible(hora: string): string {
  return hora.startsWith("0") ? hora.slice(1) : hora;
}

/** Las horas de inicio de un horario, de la apertura a la última que termina a tiempo. */
function grilla(apertura: string, cierre: string): string[] {
  const horas: string[] = [];
  const ultimoInicio = aMinutos(cierre) - DURACION_MINUTOS;
  for (let inicio = aMinutos(apertura); inicio <= ultimoInicio; inicio += PASO_MINUTOS) {
    horas.push(aHora(inicio));
  }
  return horas;
}

/**
 * Las horas de inicio de un día HÁBIL, de 07:30 a 17:00 cada media hora.
 *
 * Es la grilla más amplia: la del sábado y la del festivo son tramos de esta. Sirve
 * para el primer filtro de la validación —¿es una hora que el CDA ofrece algún
 * día?— antes de mirar qué día es. La que de verdad se ofrece una fecha concreta
 * sale de `franjasDelDia`.
 */
export const FRANJAS: readonly string[] = grilla(HORARIO.habil.apertura, HORARIO.habil.cierre);

/** ¿Es `hora` una hora de inicio que el CDA ofrece algún día? */
export function esFranja(hora: string): boolean {
  return FRANJAS.includes(hora);
}

/**
 * Lo que se sabe de una hora de inicio en un día concreto.
 *
 * `fin` es `hora` + la duración de la cita. Viaja en la respuesta para que el
 * formulario pueda mostrar "9:30 – 10:30" sin saber cuánto dura una revisión: esa
 * es una regla del negocio, y el frontend no guarda copia de ninguna.
 *
 * `ocupados` es cuántos carros hay adentro en el PEOR instante del tramo
 * [hora, fin), contando las citas que NO están canceladas: una cancelada libera su
 * lugar, una atendida no —esa ya ocurrió—. `disponibles` es lo que queda de los
 * `CUPOS_SIMULTANEOS`, nunca negativo (las citas viejas pueden pasarse del tope).
 */
export interface CupoDeFranja {
  hora: string;
  fin: string;
  ocupados: number;
  disponibles: number;
}

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

/** Las horas de inicio que se ofrecen en una fecha concreta. Vacía los domingos. */
export function franjasDelDia(fecha: string): readonly string[] {
  const tipo = tipoDeDia(fecha);
  if (tipo === "domingo") return [];
  const { apertura, cierre } = HORARIO[tipo];
  return grilla(apertura, cierre);
}

/** ¿Se ofrece `hora` en esa fecha? Es la regla que el servidor aplica al agendar. */
export function esFranjaDelDia(fecha: string, hora: string): boolean {
  return franjasDelDia(fecha).includes(hora);
}

/**
 * Las horas ofrecidas resumidas para un mensaje: "entre 7:30 y 17:00, cada media
 * hora". Con veinte horas, listarlas todas haría un mensaje que nadie lee.
 * Devuelve `null` si ese día no se ofrece ninguna (domingo).
 */
export function rangoLegible(horas: readonly string[]): string | null {
  const primera = horas[0];
  const ultima = horas[horas.length - 1];
  if (primera === undefined || ultima === undefined) return null;
  return `entre ${horaLegible(primera)} y ${horaLegible(ultima)}, cada media hora`;
}

/**
 * Cupos que tiene un día entero: CUPOS × las horas completas que está abierto.
 *
 * Hábil (7:30 a 18:00, diez horas y media) da 20; sábado (7:30 a 13:30) da 12;
 * festivo (8:00 a 12:00) da 8; domingo, 0. Es un TECHO de referencia para
 * Reportes: dos carros a la vez durante las horas completas de atención.
 */
export function cuposDelDia(fecha: string): number {
  const tipo = tipoDeDia(fecha);
  if (tipo === "domingo") return 0;
  return cuposDeUnHorario(HORARIO[tipo]);
}

function cuposDeUnHorario({ apertura, cierre }: { apertura: string; cierre: string }): number {
  return CUPOS_SIMULTANEOS * Math.floor((aMinutos(cierre) - aMinutos(apertura)) / DURACION_MINUTOS);
}

/** Cupos de un día hábil completo, el máximo de la semana. */
export const CUPOS_POR_DIA_HABIL = cuposDeUnHorario(HORARIO.habil);

/**
 * Cuántos carros hay a la vez, en el peor instante, dentro de [desde, hasta).
 *
 * `inicios` son minutos desde la medianoche; cada cita ocupa
 * [inicio, inicio + DURACION_MINUTOS). Todos los tramos son SEMIABIERTOS: una cita
 * que termina a las 10:00 y otra que empieza a las 10:00 no se cruzan.
 *
 * Por qué alcanza con mirar unos pocos instantes: el número de carros adentro solo
 * SUBE cuando empieza una cita. Así que el máximo dentro de la ventana está en su
 * primer instante o en el inicio de alguna cita que caiga dentro de ella. No hace
 * falta recorrer minuto por minuto, y no se asume ninguna grilla: una cita vieja a
 * las 9:07 se cuenta igual de bien que una de las 9:30.
 */
export function ocupacionMaxima(inicios: readonly number[], desde: number, hasta: number): number {
  const instantes = [desde, ...inicios.filter((inicio) => inicio > desde && inicio < hasta)];
  let maximo = 0;
  for (const instante of instantes) {
    const adentro = inicios.filter(
      (inicio) => inicio <= instante && instante < inicio + DURACION_MINUTOS,
    ).length;
    if (adentro > maximo) maximo = adentro;
  }
  return maximo;
}

/**
 * LA REGLA DEL CUPO. Función pura: cuánto queda para una cita nueva a la `hora`
 * pedida, dadas las horas de inicio de las citas VIVAS (no canceladas) de ese día.
 *
 * Una cita nueva cabe si en todo su tramo [hora, hora + 60) hay como mucho
 * CUPOS − 1 carros: ella suma uno durante todo el tramo. Por eso `disponibles` es
 * CUPOS menos la ocupación máxima de la ventana, y no menos la ocupación de su
 * primer instante.
 *
 * La usan las tres puertas que tienen que estar de acuerdo —crear una cita (dentro
 * de la transacción con candado), la disponibilidad que dibuja el formulario y el
 * doble en memoria de las pruebas—, para que no haya tres versiones de la regla.
 */
export function cupoParaHora(
  horasExistentes: readonly string[],
  hora: string,
): { ocupados: number; disponibles: number } {
  const desde = aMinutos(hora);
  const ocupados = ocupacionMaxima(horasExistentes.map(aMinutos), desde, desde + DURACION_MINUTOS);
  return { ocupados, disponibles: Math.max(0, CUPOS_SIMULTANEOS - ocupados) };
}

/** La fila de disponibilidad de una hora: `cupoParaHora` más su hora de fin. */
export function cupoDeFranja(horasExistentes: readonly string[], hora: string): CupoDeFranja {
  return {
    hora,
    fin: aHora(aMinutos(hora) + DURACION_MINUTOS),
    ...cupoParaHora(horasExistentes, hora),
  };
}
