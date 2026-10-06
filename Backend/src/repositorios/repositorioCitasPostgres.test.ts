import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Sql } from "postgres";

import { RepositorioCitasPostgres } from "./repositorioCitasPostgres.js";

/**
 * Guardián del ORDEN del listado de citas.
 *
 * Se prueba con un cliente de base falso que solo captura el texto de la consulta:
 * el orden vive en el SQL, y las otras pruebas usan un repositorio en memoria que
 * ni siquiera pasa por él. Sin esto, volver a `order by fecha asc` pasaría la suite
 * entera y el panel volvería a esconder las citas próximas apenas hubiera más de
 * 200, sin que nada se pusiera rojo.
 */
function clienteQueCaptura(consultas: string[]): Sql {
  const cliente = (plantilla: TemplateStringsArray): Promise<unknown[]> => {
    consultas.push(plantilla.join("?"));
    return Promise.resolve([]);
  };
  return cliente as unknown as Sql;
}

describe("RepositorioCitasPostgres.listar", () => {
  it("ordena de la cita más nueva a la más antigua", async () => {
    const consultas: string[] = [];
    const repositorio = new RepositorioCitasPostgres(clienteQueCaptura(consultas));

    await repositorio.listar({ limite: 5 });

    assert.equal(consultas.length, 1);
    const consulta = String(consultas[0]).replace(/\s+/g, " ");
    assert.match(consulta, /order by fecha desc, hora desc/);
    assert.doesNotMatch(consulta, /order by fecha asc/);
    // El tope se aplica DESPUÉS de ordenar: es lo que hace que se caiga lo viejo.
    assert.ok(consulta.indexOf("order by") < consulta.indexOf("limit"), "primero se ordena y luego se corta");
  });
});

describe("RepositorioCitasPostgres.disponibilidad", () => {
  // La regla por día vive en `franjasDelDia`, pero es el repositorio el que la
  // aplica al armar la respuesta. Se prueba con un cliente falso que no devuelve
  // ninguna cita: lo único que importa acá es QUÉ franjas dibuja, no cuántas están
  // ocupadas.
  const sinCitas = (): Sql => clienteQueCaptura([]);

  it("un día hábil devuelve las diez franjas, todas con cupo", async () => {
    const franjas = await new RepositorioCitasPostgres(sinCitas()).disponibilidad("2026-10-07");
    assert.equal(franjas.length, 10);
    assert.ok(franjas.every((franja) => franja.disponibles === 4));
  });

  it("un sábado devuelve cinco, de 08:00 a 12:00", async () => {
    const franjas = await new RepositorioCitasPostgres(sinCitas()).disponibilidad("2026-10-10");
    assert.deepEqual(
      franjas.map((franja) => franja.hora),
      ["08:00", "09:00", "10:00", "11:00", "12:00"],
    );
  });

  it("un festivo devuelve cuatro y un domingo ninguna", async () => {
    const repositorio = new RepositorioCitasPostgres(sinCitas());
    assert.equal((await repositorio.disponibilidad("2026-05-18")).length, 4);
    assert.equal((await repositorio.disponibilidad("2026-10-11")).length, 0);
  });
});

