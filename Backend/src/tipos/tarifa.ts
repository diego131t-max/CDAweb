/**
 * TARIFA DE LA REVISIÓN — la copia del servidor.
 *
 * POR QUÉ EL SERVIDOR CALCULA EL PRECIO EN VEZ DE CREERLE AL CLIENTE
 *
 * El monto se guarda con la cita para que el mostrador pueda comparar el
 * comprobante contra lo que había que pagar. Si ese número llegara en el JSON
 * del formulario, cualquiera podría mandar `valor: 1000`, transferir mil pesos,
 * y el panel mostraría "debía $1.000" al lado de un comprobante de $1.000: el
 * fraude se vería consistente. Por eso el cliente manda los INSUMOS —uso y año
 * de matrícula, los dos contra listas cerradas— y el total lo suma el servidor.
 *
 * ⚠️ ESTA TABLA ESTÁ DUPLICADA. La fuente es `TARIFAS_RTMYEC` en
 * `Frontend/data.js`, que es la que el propietario entregó y la que el sitio
 * publica en /tarifas. Acá está otra vez porque el frontend no tiene build ni
 * módulos y no se puede importar.
 *
 * La duplicación de un precio es más peligrosa que la de un teléfono: si las dos
 * copias se separan, el sitio cotiza una cifra y el panel muestra otra, y nadie
 * se entera hasta que un cliente reclame. Por eso existe `tarifa.test.ts`, que
 * lee `Frontend/data.js` y falla si algún número dejó de coincidir. Si tocás una
 * de las dos tablas, la prueba te obliga a tocar la otra.
 *
 * Lo correcto a futuro es servir las tarifas desde el API, como ya se hizo con el
 * catálogo de servicios, y que el sitio las consuma. Eso es un trabajo aparte:
 * toca /tarifas, el asistente y el FAQ.
 */

/** Cada categoría: la suma de los siete componentes fijos, y el ANSV por banda. */
export const TARIFAS: Record<string, { base: number; ansv: Record<string, number> }> = {
  motos: { base: 209381, ansv: { "0-2": 8500, "3-7": 8800, "8-17": 9100, "18+": 8800 } },
  "liviano-particular": { base: 308528, ansv: { "0-2": 9000, "3-7": 9300, "8-17": 9700, "18+": 9300 } },
  "liviano-publico": { base: 308528, ansv: { "0-2": 8400, "3-7": 8700, "8-17": 9000, "18+": 8700 } },
  "pesado-particular": { base: 468201, ansv: { "0-2": 8500, "3-7": 8800, "8-17": 9100, "18+": 8800 } },
  "pesado-publico": { base: 468201, ansv: { "0-2": 8100, "3-7": 8300, "8-17": 8500, "18+": 8300 } },
};

/** Las bandas de año de matrícula. `desde: null` es "y anteriores". */
export const BANDAS: readonly { id: string; desde: number | null; hasta: number }[] = [
  { id: "0-2", desde: 2024, hasta: 2026 },
  { id: "3-7", desde: 2019, hasta: 2023 },
  { id: "8-17", desde: 2010, hasta: 2018 },
  { id: "18+", desde: null, hasta: 2009 },
];

/** Uso del vehículo. Cambia la tarifa en livianos y pesados, no en motos. */
export const USOS = ["particular", "publico"] as const;
export type Uso = (typeof USOS)[number];

export function esUso(valor: unknown): valor is Uso {
  return typeof valor === "string" && (USOS as readonly string[]).includes(valor);
}

/** El año más viejo que la tabla distingue. Más atrás, todo cae en '18+'. */
export const ANIO_MINIMO = 1950;

/**
 * El uso solo hace falta en livianos y pesados: las motos tienen una sola
 * categoría, sea un motocarro de servicio público o una moto particular.
 */
export function usoAplica(vehiculo: string): boolean {
  return !vehiculo.toLowerCase().startsWith("moto");
}

/** El id de categoría de tarifa, o null si falta el uso donde hace falta. */
export function categoriaDeTarifa(vehiculo: string, uso: Uso | undefined): string | null {
  if (!usoAplica(vehiculo)) return "motos";
  if (uso === undefined) return null;
  const familia = vehiculo.toLowerCase().includes("pesado") ? "pesado" : "liviano";
  return `${familia}-${uso}`;
}

export function bandaDeAnio(anio: number): string | null {
  const banda = BANDAS.find((b) => anio <= b.hasta && (b.desde === null || anio >= b.desde));
  return banda === undefined ? null : banda.id;
}

/**
 * El total de la revisión, o null si no se puede calcular.
 *
 * Devuelve null y NUNCA un aproximado ni un cero: un precio inventado es peor
 * que no tener precio (principio I). La cita se registra igual con el valor en
 * null, y el panel muestra "por confirmar".
 */
export function valorDeLaCita(vehiculo: string, uso: Uso | undefined, anio: number | undefined): number | null {
  if (anio === undefined) return null;

  const id = categoriaDeTarifa(vehiculo, uso);
  if (id === null) return null;

  const tarifa = TARIFAS[id];
  if (tarifa === undefined) return null;

  const banda = bandaDeAnio(anio);
  if (banda === null) return null;

  const ansv = tarifa.ansv[banda];
  if (ansv === undefined) return null;

  return tarifa.base + ansv;
}
