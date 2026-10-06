/**
 * Festivos de Colombia, calculados por ley y no copiados de una lista.
 *
 * POR QUÉ CALCULADOS. Una lista de fechas escrita a mano caduca: hay que acordarse
 * de agregar el año siguiente, y el día que alguien se olvida, ese año ningún
 * festivo existe para el sistema y se pueden agendar citas fuera de horario sin
 * que nada falle. Los festivos de Colombia, en cambio, salen de reglas fijas:
 *
 *   - Ley 51 de 1983 (Ley Emiliani): los festivos "civiles" y los santorales se
 *     TRASLADAN al lunes siguiente, salvo que ya caigan en lunes.
 *   - Los de Semana Santa y los que dependen de la Pascua salen del calendario
 *     litúrgico.
 *
 * Esto NO inventa nada (principio I): aplica una ley publicada. Lo que sí queda
 * fuera es un festivo decretado por una sola vez fuera de esas reglas, que no
 * existe en el calendario ordinario; si algún día pasara, se agrega a mano en
 * `EXTRAORDINARIOS`.
 *
 * Todo se calcula en UTC sobre fechas 'AAAA-MM-DD' sin hora, para que la zona
 * horaria del servidor no pueda correr un festivo de día.
 */

/**
 * Festivos que se decretan por fuera de las reglas ordinarias.
 *
 * - 2026-07-13: Virgen de Chiquinquirá. Una ley nueva; no sale de ninguna fórmula
 *   y por eso ni la Ley Emiliani ni la Pascua lo producen. Se confirmó el
 *   2026-10-06 en dos calendarios independientes (Wikipedia y officeholidays.com).
 *   **No se sabe si se repite cada año**: Wikipedia no trae 2027 y no se asume. Si
 *   se repite, hay que agregar la fecha de cada año acá cuando se publique su
 *   calendario; para los años que no están, este módulo NO lo cuenta.
 *
 * Es el único punto donde este archivo depende de que alguien lo mantenga, y es a
 * propósito: un festivo nuevo es un hecho que alguien tiene que confirmar, no algo
 * que se pueda deducir.
 */
const EXTRAORDINARIOS: readonly string[] = ["2026-07-13"];

/** Día de la Pascua (domingo de Resurrección) del año, por el algoritmo gregoriano de Meeus. */
export function pascua(anio: number): Date {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anio, mes - 1, dia));
}

function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * 86_400_000);
}

/** Ley Emiliani: si no es lunes, pasa al lunes siguiente. */
function alLunesSiguiente(fecha: Date): Date {
  const diaSemana = fecha.getUTCDay(); // 0 = domingo … 6 = sábado
  if (diaSemana === 1) return fecha;
  return sumarDias(fecha, (8 - diaSemana) % 7);
}

function aTexto(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/** Todos los festivos del año, como 'AAAA-MM-DD', ordenados. */
export function festivosDelAnio(anio: number): string[] {
  const fecha = (mes: number, dia: number): Date => new Date(Date.UTC(anio, mes - 1, dia));
  const semanaSanta = pascua(anio);

  const festivos: Date[] = [
    // Fijos: no se trasladan.
    fecha(1, 1), // Año Nuevo
    fecha(5, 1), // Día del Trabajo
    fecha(7, 20), // Independencia
    fecha(8, 7), // Batalla de Boyacá
    fecha(12, 8), // Inmaculada Concepción
    fecha(12, 25), // Navidad

    // Trasladados al lunes siguiente (Ley Emiliani).
    alLunesSiguiente(fecha(1, 6)), // Reyes Magos
    alLunesSiguiente(fecha(3, 19)), // San José
    alLunesSiguiente(fecha(6, 29)), // San Pedro y San Pablo
    alLunesSiguiente(fecha(8, 15)), // Asunción de la Virgen
    alLunesSiguiente(fecha(10, 12)), // Día de la Raza
    alLunesSiguiente(fecha(11, 1)), // Todos los Santos
    alLunesSiguiente(fecha(11, 11)), // Independencia de Cartagena

    // Semana Santa: Jueves y Viernes Santo no se trasladan.
    sumarDias(semanaSanta, -3),
    sumarDias(semanaSanta, -2),

    // Dependientes de la Pascua, trasladados al lunes: el día litúrgico cae a +39,
    // +60 y +68 de la Pascua (jueves), y el festivo es el lunes siguiente.
    alLunesSiguiente(sumarDias(semanaSanta, 39)), // Ascensión
    alLunesSiguiente(sumarDias(semanaSanta, 60)), // Corpus Christi
    alLunesSiguiente(sumarDias(semanaSanta, 68)), // Sagrado Corazón
  ];

  const extraordinarios = EXTRAORDINARIOS.filter((texto) => texto.startsWith(`${anio}-`));
  return [...new Set([...festivos.map(aTexto), ...extraordinarios])].sort();
}

const cacheDeAnios = new Map<number, ReadonlySet<string>>();

/** ¿Es 'AAAA-MM-DD' un festivo en Colombia? La fecha tiene que venir ya validada. */
export function esFestivoColombia(fecha: string): boolean {
  const anio = Number(fecha.slice(0, 4));
  let delAnio = cacheDeAnios.get(anio);
  if (delAnio === undefined) {
    delAnio = new Set(festivosDelAnio(anio));
    cacheDeAnios.set(anio, delAnio);
  }
  return delAnio.has(fecha);
}
