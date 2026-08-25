/**
 * TARIFA DE LA REVISIÓN — LA FUENTE, no una copia.
 *
 * Acá vive la tabla que entregó el propietario, y el sitio la CONSUME desde el
 * API (`GET /api/tarifas`). Antes estaba en `Frontend/data.js` y el backend
 * tenía su propia copia para poder calcular el valor de la cita sin creerle al
 * cliente; esa duplicación se sostenía con una prueba que comparaba número por
 * número, y funcionaba, pero un precio duplicado es una bomba de tiempo: el día
 * que las dos copias se separen, el sitio cotiza una cifra y el panel muestra
 * otra, y nadie se entera hasta que un cliente reclame.
 *
 * Es el mismo camino que ya recorrió el catálogo de servicios, y por el mismo
 * motivo.
 *
 * POR QUÉ EL SERVIDOR CALCULA EL PRECIO Y NO LE CREE AL CLIENTE. El monto se
 * guarda con la cita para que el mostrador pueda comparar el comprobante contra
 * lo que había que pagar. Si ese número llegara en el JSON del formulario,
 * cualquiera podría mandar `valor: 1000`, transferir mil pesos, y el panel
 * mostraría "debía $1.000" al lado de un comprobante de $1.000: el fraude se
 * vería consistente. Del cliente solo se aceptan los INSUMOS —uso y año de
 * matrícula, los dos contra listas cerradas—.
 *
 * ⚠️ ESTOS NÚMEROS NO SE TOCAN SIN EL PROPIETARIO. Son tarifas reguladas y salen
 * de la tabla que él entregó (principio I). Ni se estiman, ni se redondean, ni
 * se actualizan por inflación.
 */

export interface ComponentesTarifa {
  rtmyec: number;
  iva: number;
  runt: number;
  sicov: number;
  ivaSicov: number;
  recaudo: number;
  ivaRecaudo: number;
}

export interface CategoriaTarifa {
  id: string;
  label: string;
  ayuda: string;
  /** A cuántos años de la matrícula toca la primera revisión (Ley 2294 de 2023). */
  primeraRevision: number;
  /** Los siete componentes que NO dependen del año. */
  componentes: ComponentesTarifa;
  /** El ANSV, único que cambia entre bandas. */
  ansv: Record<string, number>;
}

export interface BandaMatricula {
  id: string;
  /** `null` es "y anteriores". */
  desde: number | null;
  hasta: number;
}

/** Año de vigencia de la tabla. Se publica junto a los precios. */
export const VIGENCIA_TARIFAS = 2026;

export const CATEGORIAS_TARIFA: readonly CategoriaTarifa[] = [
  {
    id: "motos",
    label: "Motos y similares",
    ayuda: "Incluye cuatrimoto, mototriciclo, tricimoto, motociclo, ciclomotor y motocarro.",
    primeraRevision: 2,
    componentes: { rtmyec: 132726, iva: 25218, runt: 5600, sicov: 29825, ivaSicov: 5667, recaudo: 8693, ivaRecaudo: 1652 },
    ansv: { "0-2": 8500, "3-7": 8800, "8-17": 9100, "18+": 8800 },
  },
  {
    id: "liviano-particular",
    label: "Vehículo liviano particular",
    ayuda: "Carros y camionetas de uso particular u oficial.",
    primeraRevision: 5,
    componentes: { rtmyec: 216043, iva: 41048, runt: 5600, sicov: 29825, ivaSicov: 5667, recaudo: 8693, ivaRecaudo: 1652 },
    ansv: { "0-2": 9000, "3-7": 9300, "8-17": 9700, "18+": 9300 },
  },
  {
    id: "liviano-publico",
    label: "Vehículo liviano público",
    ayuda: "Taxis y demás vehículos livianos de servicio público.",
    primeraRevision: 2,
    componentes: { rtmyec: 216043, iva: 41048, runt: 5600, sicov: 29825, ivaSicov: 5667, recaudo: 8693, ivaRecaudo: 1652 },
    ansv: { "0-2": 8400, "3-7": 8700, "8-17": 9000, "18+": 8700 },
  },
  {
    id: "pesado-particular",
    label: "Vehículo pesado particular",
    ayuda: "Camiones, volquetas y similares de uso particular.",
    primeraRevision: 5,
    componentes: { rtmyec: 350222, iva: 66542, runt: 5600, sicov: 29825, ivaSicov: 5667, recaudo: 8693, ivaRecaudo: 1652 },
    ansv: { "0-2": 8500, "3-7": 8800, "8-17": 9100, "18+": 8800 },
  },
  {
    id: "pesado-publico",
    label: "Vehículo pesado público",
    ayuda: "Buses, camiones y tractomulas de servicio público.",
    primeraRevision: 2,
    componentes: { rtmyec: 350222, iva: 66542, runt: 5600, sicov: 29825, ivaSicov: 5667, recaudo: 8693, ivaRecaudo: 1652 },
    ansv: { "0-2": 8100, "3-7": 8300, "8-17": 8500, "18+": 8300 },
  },
];

export const BANDAS: readonly BandaMatricula[] = [
  { id: "0-2", desde: 2024, hasta: 2026 },
  { id: "3-7", desde: 2019, hasta: 2023 },
  { id: "8-17", desde: 2010, hasta: 2018 },
  { id: "18+", desde: null, hasta: 2009 },
];

/** Orden y rótulo de cada línea del desglose, tal como se muestra. */
export const COMPONENTES_TARIFA: readonly (readonly [string, string])[] = [
  ["rtmyec", "Servicio de revisión (RTMyEC)"],
  ["iva", "IVA del servicio"],
  ["runt", "RUNT"],
  ["sicov", "SICOV"],
  ["ivaSicov", "IVA del SICOV"],
  ["recaudo", "Recaudo"],
  ["ivaRecaudo", "IVA del recaudo"],
  ["ansv", "Agencia Nacional de Seguridad Vial"],
];

/** Uso del vehículo. Cambia la tarifa en livianos y pesados, no en motos. */
export const USOS = ["particular", "publico"] as const;
export type Uso = (typeof USOS)[number];

export function esUso(valor: unknown): valor is Uso {
  return typeof valor === "string" && (USOS as readonly string[]).includes(valor);
}

/** El año más viejo que se acepta. Más atrás, todo cae en la última banda. */
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
 * EL TOTAL SE SUMA, no se lee de ninguna parte.
 *
 * Si estuviera escrito en la tabla, el día que alguien corrija un componente y
 * se olvide del total, la cifra grande pasaría a contradecir a las ocho líneas
 * que tiene debajo —y la que la gente recuerda es la grande—. Sumando, esa
 * contradicción no puede existir. Mismo criterio que en el frontend.
 */
export function valorDeLaCita(vehiculo: string, uso: Uso | undefined, anio: number | undefined): number | null {
  if (anio === undefined) return null;

  const id = categoriaDeTarifa(vehiculo, uso);
  if (id === null) return null;

  const categoria = CATEGORIAS_TARIFA.find((c) => c.id === id);
  if (categoria === undefined) return null;

  const banda = bandaDeAnio(anio);
  if (banda === null) return null;

  const ansv = categoria.ansv[banda];
  if (ansv === undefined) return null;

  const fijos = Object.values(categoria.componentes).reduce((suma, n) => suma + n, 0);
  return fijos + ansv;
}
