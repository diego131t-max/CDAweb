import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { esFestivoColombia, festivosDelAnio, pascua } from "./festivos.js";

/**
 * Guardianes del calendario de festivos.
 *
 * De dónde sale cada lista, para que se sepa cuánto confiar en ella:
 *
 * - **2026**: contrastada el 2026-10-06 con dos calendarios independientes
 *   (Wikipedia y officeholidays.com), que coinciden entre sí y con lo calculado.
 *   Incluye el 13 de julio, que es una ley nueva y no sale de ninguna fórmula.
 * - **2027**: derivada a mano de la ley (Emiliani + Pascua del 28 de marzo). NO se
 *   contrastó con una fuente externa: ninguna de las consultadas traía ese año.
 *   Sirve para probar el cálculo, no como prueba de que el calendario oficial sea
 *   ese. Cuando se publique el oficial, hay que compararla.
 */
const FESTIVOS_2026 = [
  "2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03", "2026-05-01",
  "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29", "2026-07-13", "2026-07-20",
  "2026-08-07", "2026-08-17", "2026-10-12", "2026-11-02", "2026-11-16", "2026-12-08",
  "2026-12-25",
];

const FESTIVOS_2027 = [
  "2027-01-01", "2027-01-11", "2027-03-22", "2027-03-25", "2027-03-26", "2027-05-01",
  "2027-05-10", "2027-05-31", "2027-06-07", "2027-07-05", "2027-07-20", "2027-08-07",
  "2027-08-16", "2027-10-18", "2027-11-01", "2027-11-15", "2027-12-08", "2027-12-25",
];

describe("pascua", () => {
  it("coincide con las fechas conocidas del domingo de Resurrección", () => {
    const conocidas: [number, string][] = [
      [2024, "2024-03-31"],
      [2025, "2025-04-20"],
      [2026, "2026-04-05"],
      [2027, "2027-03-28"],
      [2028, "2028-04-16"],
    ];
    for (const [anio, esperada] of conocidas) {
      assert.equal(pascua(anio).toISOString().slice(0, 10), esperada, String(anio));
    }
  });
});

describe("festivosDelAnio", () => {
  it("2026 trae los 19 festivos del calendario contrastado", () => {
    assert.deepEqual(festivosDelAnio(2026), FESTIVOS_2026);
  });

  it("2027 trae los 18 que salen de la ley", () => {
    assert.deepEqual(festivosDelAnio(2027), FESTIVOS_2027);
  });

  it("traslada al lunes los de la Ley Emiliani y no los que no se trasladan", () => {
    // Reyes Magos: el 6 de enero de 2026 cae martes y pasa al lunes 12.
    assert.equal(esFestivoColombia("2026-01-12"), true);
    assert.equal(esFestivoColombia("2026-01-06"), false);
    // La Independencia (20 de julio) NO se traslada, caiga donde caiga.
    assert.equal(esFestivoColombia("2026-07-20"), true);
    assert.equal(esFestivoColombia("2027-07-20"), true);
    // Un festivo que ya cae en lunes se queda donde está: 1 de noviembre de 2027.
    assert.equal(esFestivoColombia("2027-11-01"), true);
    assert.equal(esFestivoColombia("2027-11-08"), false);
  });

  it("Jueves y Viernes Santo no se trasladan", () => {
    assert.equal(esFestivoColombia("2026-04-02"), true);
    assert.equal(esFestivoColombia("2026-04-03"), true);
  });

  it("el festivo extraordinario del 13 de julio vale solo para 2026", () => {
    assert.equal(esFestivoColombia("2026-07-13"), true);
    // No se asume que se repita: ver EXTRAORDINARIOS en festivos.ts.
    assert.equal(esFestivoColombia("2027-07-13"), false);
  });

  it("un día cualquiera no es festivo", () => {
    for (const dia of ["2026-02-10", "2026-09-30", "2027-06-15", "2099-12-07"]) {
      assert.equal(esFestivoColombia(dia), false, dia);
    }
  });
});
