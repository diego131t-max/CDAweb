import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { esFranjaDelDia, FRANJAS, franjasDelDia, tipoDeDia } from "./franja.js";

describe("tipoDeDia", () => {
  it("distingue hábil, sábado, festivo y domingo", () => {
    assert.equal(tipoDeDia("2026-10-07"), "habil"); // miércoles
    assert.equal(tipoDeDia("2026-10-10"), "sabado");
    assert.equal(tipoDeDia("2026-10-11"), "domingo");
    assert.equal(tipoDeDia("2026-05-18"), "festivo"); // lunes de la Ascensión
  });

  it("el domingo gana sobre el festivo: un festivo en domingo sigue cerrado", () => {
    // 20 de julio de 2025 fue domingo y es festivo fijo.
    assert.equal(tipoDeDia("2025-07-20"), "domingo");
  });

  it("el festivo gana sobre el sábado", () => {
    // 1 de mayo de 2027 cae sábado y es festivo fijo.
    assert.equal(tipoDeDia("2027-05-01"), "festivo");
  });
});

describe("franjasDelDia", () => {
  it("un día hábil ofrece las diez, de 08:00 a 17:00", () => {
    assert.deepEqual(franjasDelDia("2026-10-07"), FRANJAS);
    assert.equal(franjasDelDia("2026-10-07").length, 10);
  });

  it("el sábado se atiende hasta la 1:30 PM: la última franja es la de las 12:00", () => {
    assert.deepEqual(franjasDelDia("2026-10-10"), ["08:00", "09:00", "10:00", "11:00", "12:00"]);
    // La de las 13:00 terminaría a las 14:00, pasada la hora de cierre.
    assert.equal(esFranjaDelDia("2026-10-10", "13:00"), false);
    assert.equal(esFranjaDelDia("2026-10-10", "17:00"), false);
  });

  it("un festivo se atiende de 8:00 AM a 12:00 M: la última franja es la de las 11:00", () => {
    assert.deepEqual(franjasDelDia("2026-05-18"), ["08:00", "09:00", "10:00", "11:00"]);
    assert.equal(esFranjaDelDia("2026-05-18", "12:00"), false);
  });

  it("el domingo no ofrece ninguna", () => {
    assert.deepEqual(franjasDelDia("2026-10-11"), []);
    assert.equal(esFranjaDelDia("2026-10-11", "09:00"), false);
  });

  it("nunca ofrece una hora que no esté en la lista base", () => {
    for (const dia of ["2026-10-07", "2026-10-10", "2026-05-18", "2026-10-11"]) {
      for (const hora of franjasDelDia(dia)) assert.ok((FRANJAS as readonly string[]).includes(hora), `${dia} ${hora}`);
    }
  });
});
