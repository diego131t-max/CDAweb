import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { RepositorioMensajesArchivo } from "./repositorioMensajesArchivo.js";

const MENSAJE = {
  name: "Belsa Faira",
  email: "belsa@email.com",
  message: "Quiero confirmar el horario para una revisión de gases.",
};

describe("RepositorioMensajesArchivo", () => {
  let directorio: string;
  let repositorio: RepositorioMensajesArchivo;

  beforeEach(async () => {
    directorio = await mkdtemp(join(tmpdir(), "webcda-mensajes-"));
    repositorio = new RepositorioMensajesArchivo(directorio);
  });

  afterEach(async () => {
    await rm(directorio, { recursive: true, force: true });
  });

  it("devuelve una lista vacía si todavía no hay archivo", async () => {
    assert.deepEqual(await repositorio.listar(), []);
  });

  it("genera el id y la fecha en el servidor", async () => {
    const creado = await repositorio.crear(MENSAJE);

    assert.ok(creado.id.length > 0);
    assert.match(creado.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!Number.isNaN(Date.parse(creado.creadoEn)));
    assert.equal(creado.name, MENSAJE.name);
  });

  it("asigna ids únicos", async () => {
    const ids = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      ids.add((await repositorio.crear(MENSAJE)).id);
    }
    assert.equal(ids.size, 20);
  });

  it("persiste el mensaje con el shape que espera el panel admin", async () => {
    await repositorio.crear(MENSAJE);

    const contenido = JSON.parse(await readFile(join(directorio, "mensajes.json"), "utf8")) as unknown[];
    assert.equal(contenido.length, 1);
    assert.deepEqual(Object.keys(contenido[0] as object).sort(), [
      "creadoEn",
      "date",
      "email",
      "id",
      "message",
      "name",
    ]);
  });

  it("lista del más reciente al más antiguo", async () => {
    const primero = await repositorio.crear({ ...MENSAJE, name: "Primero" });
    const segundo = await repositorio.crear({ ...MENSAJE, name: "Segundo" });

    const listados = await repositorio.listar();
    assert.deepEqual(
      listados.map((mensaje) => mensaje.id),
      [segundo.id, primero.id],
    );
  });

  // Dos peticiones simultáneas no deben pisarse al leer-modificar-escribir.
  it("no pierde mensajes creados en paralelo", async () => {
    await Promise.all(
      Array.from({ length: 25 }, (_, indice) => repositorio.crear({ ...MENSAJE, name: `Cliente ${indice}` })),
    );

    const listados = await repositorio.listar();
    assert.equal(listados.length, 25);
    assert.equal(new Set(listados.map((mensaje) => mensaje.id)).size, 25);
  });

  it("sobrevive a reiniciar el proceso (relee el archivo)", async () => {
    const creado = await repositorio.crear(MENSAJE);

    const otraInstancia = new RepositorioMensajesArchivo(directorio);
    const listados = await otraInstancia.listar();

    assert.equal(listados.length, 1);
    assert.equal(listados[0]?.id, creado.id);
  });

  it("filtra por rango de fechas", async () => {
    const hoy = (await repositorio.crear(MENSAJE)).date;

    assert.equal((await repositorio.listar({ desde: hoy, hasta: hoy })).length, 1);
    assert.equal((await repositorio.listar({ desde: "2100-01-01" })).length, 0);
    assert.equal((await repositorio.listar({ hasta: "2000-01-01" })).length, 0);
  });

  it("respeta el límite", async () => {
    await repositorio.crear(MENSAJE);
    await repositorio.crear(MENSAJE);
    await repositorio.crear(MENSAJE);

    assert.equal((await repositorio.listar({ limite: 2 })).length, 2);
  });

  // Ante un archivo corrupto se prefiere fallar antes que borrar datos reales.
  it("falla en vez de sobrescribir un archivo corrupto", async () => {
    await writeFile(join(directorio, "mensajes.json"), "{esto no es json}", "utf8");

    await assert.rejects(() => repositorio.listar());
    await assert.rejects(() => repositorio.crear(MENSAJE));
    assert.equal(await readFile(join(directorio, "mensajes.json"), "utf8"), "{esto no es json}");
  });

  // Un error puntual no debe dejar la cola de escrituras trabada.
  it("sigue funcionando después de un error", async () => {
    const rutaArchivo = join(directorio, "mensajes.json");
    await writeFile(rutaArchivo, "{corrupto}", "utf8");
    await assert.rejects(() => repositorio.crear(MENSAJE));

    await rm(rutaArchivo);
    const creado = await repositorio.crear(MENSAJE);
    assert.ok(creado.id.length > 0);
  });
});
