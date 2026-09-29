import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LIMITES_ENCUESTA, validarNuevaEncuesta } from "./encuestas.js";

/** Devuelve los campos que fallaron, para no acoplar los tests al texto exacto. */
function camposConError(resultado: ReturnType<typeof validarNuevaEncuesta>): string[] {
  return resultado.ok ? [] : resultado.errores.map((detalle) => detalle.campo);
}

describe("validarNuevaEncuesta", () => {
  it("acepta las dos notas sin sugerencias", () => {
    const resultado = validarNuevaEncuesta({ calificacionServicio: 4, calificacionInstalaciones: 2 });
    assert.equal(resultado.ok, true);
    assert.deepEqual(resultado.ok && resultado.valor, { calificacionServicio: 4, calificacionInstalaciones: 2 });
  });

  it("acepta los extremos 1 y 5", () => {
    assert.equal(validarNuevaEncuesta({ calificacionServicio: 1, calificacionInstalaciones: 5 }).ok, true);
  });

  it("recorta las sugerencias y descarta las que son solo espacios", () => {
    const conTexto = validarNuevaEncuesta({ calificacionServicio: 3, calificacionInstalaciones: 3, sugerencias: "  hola  " });
    assert.deepEqual(conTexto.ok && conTexto.valor.sugerencias, "hola");

    const vacia = validarNuevaEncuesta({ calificacionServicio: 3, calificacionInstalaciones: 3, sugerencias: "   " });
    assert.equal(vacia.ok && "sugerencias" in vacia.valor, false);
  });

  it("ignora campos que no son suyos, como id o date", () => {
    const resultado = validarNuevaEncuesta({
      calificacionServicio: 3,
      calificacionInstalaciones: 3,
      id: "inventado",
      date: "1999-01-01",
    });
    assert.deepEqual(resultado.ok && resultado.valor, { calificacionServicio: 3, calificacionInstalaciones: 3 });
  });

  it("rechaza notas ausentes, fuera de rango, decimales o como texto", () => {
    assert.deepEqual(camposConError(validarNuevaEncuesta({})), ["calificacionServicio", "calificacionInstalaciones"]);
    for (const nota of [0, 6, -1, 2.5, "5", null, NaN, true]) {
      assert.ok(
        camposConError(validarNuevaEncuesta({ calificacionServicio: nota, calificacionInstalaciones: 3 })).includes(
          "calificacionServicio",
        ),
        `debe rechazar ${String(nota)}`,
      );
    }
  });

  it("rechaza sugerencias que no son texto o que pasan del tope", () => {
    assert.deepEqual(
      camposConError(validarNuevaEncuesta({ calificacionServicio: 3, calificacionInstalaciones: 3, sugerencias: 5 })),
      ["sugerencias"],
    );
    assert.deepEqual(
      camposConError(
        validarNuevaEncuesta({
          calificacionServicio: 3,
          calificacionInstalaciones: 3,
          sugerencias: "x".repeat(LIMITES_ENCUESTA.sugerenciasMax + 1),
        }),
      ),
      ["sugerencias"],
    );
  });

  it("rechaza un cuerpo que no es un objeto", () => {
    for (const cuerpo of [null, undefined, "hola", 5, []]) {
      assert.deepEqual(camposConError(validarNuevaEncuesta(cuerpo)), ["cuerpo"]);
    }
  });
});
