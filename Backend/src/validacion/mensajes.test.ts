import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LIMITES, validarFiltroMensajes, validarNuevoMensaje } from "./mensajes.js";

const MENSAJE_VALIDO = {
  name: "Belsa Faira",
  email: "belsa@email.com",
  message: "Quiero confirmar el horario para una revisión de gases.",
};

/** Devuelve los campos que fallaron, para no acoplar los tests al texto exacto. */
function camposConError(resultado: ReturnType<typeof validarNuevoMensaje>): string[] {
  return resultado.ok ? [] : resultado.errores.map((detalle) => detalle.campo);
}

describe("validarNuevoMensaje", () => {
  it("acepta un mensaje válido", () => {
    const resultado = validarNuevoMensaje(MENSAJE_VALIDO);
    assert.equal(resultado.ok, true);
    assert.deepEqual(resultado.ok && resultado.valor, MENSAJE_VALIDO);
  });

  it("recorta los espacios sobrantes", () => {
    const resultado = validarNuevoMensaje({
      name: "  Belsa Faira  ",
      email: "  belsa@email.com ",
      message: "  Consulta sobre la revisión.  ",
    });
    assert.equal(resultado.ok, true);
    assert.deepEqual(resultado.ok && resultado.valor, {
      name: "Belsa Faira",
      email: "belsa@email.com",
      message: "Consulta sobre la revisión.",
    });
  });

  it("descarta campos que no son del contrato (el id y la fecha los pone el servidor)", () => {
    const resultado = validarNuevoMensaje({
      ...MENSAJE_VALIDO,
      id: "inyectado-por-el-cliente",
      date: "1999-01-01",
      creadoEn: "1999-01-01T00:00:00.000Z",
      rol: "admin",
    });
    assert.equal(resultado.ok, true);
    assert.deepEqual(resultado.ok && Object.keys(resultado.valor).sort(), ["email", "message", "name"]);
  });

  it("exige los tres campos obligatorios", () => {
    assert.deepEqual(camposConError(validarNuevoMensaje({})).sort(), ["email", "message", "name"]);
  });

  it("rechaza cuerpos que no son un objeto JSON", () => {
    for (const cuerpo of [null, undefined, "texto", 42, [], true]) {
      const resultado = validarNuevoMensaje(cuerpo);
      assert.equal(resultado.ok, false, `debería rechazar ${JSON.stringify(cuerpo)}`);
    }
  });

  it("rechaza valores en blanco o de otro tipo", () => {
    assert.deepEqual(camposConError(validarNuevoMensaje({ ...MENSAJE_VALIDO, name: "   " })), ["name"]);
    assert.deepEqual(camposConError(validarNuevoMensaje({ ...MENSAJE_VALIDO, name: 123 })), ["name"]);
    assert.deepEqual(camposConError(validarNuevoMensaje({ ...MENSAJE_VALIDO, message: null })), ["message"]);
  });

  it("rechaza correos con formato inválido", () => {
    for (const email of ["sin-arroba", "sin@punto", "@dominio.com", "espacio @email.com"]) {
      assert.deepEqual(camposConError(validarNuevoMensaje({ ...MENSAJE_VALIDO, email })), ["email"], email);
    }
  });

  it("aplica los límites de longitud", () => {
    assert.deepEqual(camposConError(validarNuevoMensaje({ ...MENSAJE_VALIDO, name: "A" })), ["name"]);
    assert.deepEqual(
      camposConError(validarNuevoMensaje({ ...MENSAJE_VALIDO, name: "A".repeat(LIMITES.nombreMax + 1) })),
      ["name"],
    );
    assert.deepEqual(camposConError(validarNuevoMensaje({ ...MENSAJE_VALIDO, message: "hola" })), ["message"]);
    assert.deepEqual(
      camposConError(validarNuevoMensaje({ ...MENSAJE_VALIDO, message: "A".repeat(LIMITES.mensajeMax + 1) })),
      ["message"],
    );
  });

  it("reporta todos los campos inválidos de una vez", () => {
    const resultado = validarNuevoMensaje({ name: "", email: "malo", message: "" });
    assert.equal(resultado.ok, false);
    assert.deepEqual(camposConError(resultado).sort(), ["email", "message", "name"]);
  });

  it("devuelve mensajes de error en español", () => {
    const resultado = validarNuevoMensaje({});
    assert.equal(resultado.ok, false);
    if (resultado.ok) return;
    assert.ok(resultado.errores.every((detalle) => /^El (nombre|correo|mensaje)/.test(detalle.mensaje)));
  });
});

describe("validarFiltroMensajes", () => {
  // FR-024: la lista de datos personales NUNCA sale sin tope. Antes, sin
  // `limite`, el filtro salía vacío y el endpoint devolvía todos los mensajes.
  it("sin parámetros aplica el tope por omisión", () => {
    const resultado = validarFiltroMensajes({});
    assert.equal(resultado.ok, true);
    assert.deepEqual(resultado.ok && resultado.valor, { limite: LIMITES.listadoPorOmision });
    assert.equal(LIMITES.listadoPorOmision, 100);
  });

  it("el tope por omisión no pisa las fechas ni el límite pedido", () => {
    const soloFechas = validarFiltroMensajes({ desde: "2026-05-01" });
    assert.deepEqual(soloFechas.ok && soloFechas.valor, {
      desde: "2026-05-01",
      limite: LIMITES.listadoPorOmision,
    });

    const conLimite = validarFiltroMensajes({ limite: "7" });
    assert.deepEqual(conLimite.ok && conLimite.valor, { limite: 7 });
  });

  it("acepta fechas y límite válidos", () => {
    const resultado = validarFiltroMensajes({ desde: "2026-05-01", hasta: "2026-05-31", limite: "10" });
    assert.equal(resultado.ok, true);
    assert.deepEqual(resultado.ok && resultado.valor, { desde: "2026-05-01", hasta: "2026-05-31", limite: 10 });
  });

  it("rechaza fechas mal formadas o inexistentes", () => {
    for (const desde of ["01/05/2026", "2026-5-1", "2026-02-31", "ayer"]) {
      assert.equal(validarFiltroMensajes({ desde }).ok, false, desde);
    }
  });

  it("rechaza un rango invertido", () => {
    assert.equal(validarFiltroMensajes({ desde: "2026-06-01", hasta: "2026-05-01" }).ok, false);
  });

  it("rechaza límites fuera de rango o no numéricos", () => {
    for (const limite of ["0", "-5", "2.5", "abc", String(LIMITES.listadoMax + 1)]) {
      assert.equal(validarFiltroMensajes({ limite }).ok, false, limite);
    }
  });
});
