import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it } from "node:test";
import type { Request, Response } from "express";

import { crearRegistroDeAcceso, formatearLineaDeAcceso } from "./registrarAcceso.js";

/**
 * Pruebas del registro de accesos.
 *
 * La regla que verifican no es de formato sino de protección de datos: FR-028
 * prohíbe registrar cuerpo, credencial, cadena de consulta y dirección de red. El
 * error típico es escribir `req.originalUrl` en vez de `req.path` —se ve igual en
 * la mayoría de las peticiones y filtra la cadena de consulta en el resto—, así
 * que acá la petición de prueba trae las dos cosas distintas a propósito.
 */

// Valores señuelo: si alguno aparece en la línea, la prueba falla.
const CREDENCIAL = "Bearer credencial-secreta-de-prueba";
const DIRECCION = "203.0.113.9";
const CORREO_EN_LA_CONSULTA = "cliente@ejemplo.test";
const NOMBRE_EN_EL_CUERPO = "Cliente De Prueba";

// Se usa `as unknown as Request` porque implementar la interfaz completa de
// Express no aporta nada: el middleware solo lee `req.method` y `req.path`.
function crearPeticion(): Request {
  const consulta = `?desde=2026-01-01&email=${CORREO_EN_LA_CONSULTA}`;
  return {
    method: "GET",
    path: "/api/mensajes",
    originalUrl: `/api/mensajes${consulta}`,
    url: `/api/mensajes${consulta}`,
    ip: DIRECCION,
    headers: { authorization: CREDENCIAL },
    body: { name: NOMBRE_EN_EL_CUERPO, email: CORREO_EN_LA_CONSULTA },
    header: (): string => CREDENCIAL,
  } as unknown as Request;
}

class RespuestaFalsa extends EventEmitter {
  statusCode = 200;

  terminar(codigo: number): void {
    this.statusCode = codigo;
    this.emit("finish");
  }
}

interface Corrida {
  lineas: string[];
  res: RespuestaFalsa;
}

/** Corre el middleware sobre una petición de prueba y junta lo que escribe. */
function correr(reloj: () => number = Date.now): Corrida {
  const lineas: string[] = [];
  const registrar = crearRegistroDeAcceso({
    escribir: (linea) => lineas.push(linea),
    reloj,
  });
  const res = new RespuestaFalsa();

  registrar(crearPeticion(), res as unknown as Response, () => undefined);

  return { lineas, res };
}

describe("formatearLineaDeAcceso", () => {
  it("arma la línea con fecha, método, ruta, estado y duración", () => {
    const linea = formatearLineaDeAcceso({
      fecha: "2026-08-04T15:32:11.204Z",
      metodo: "GET",
      ruta: "/api/mensajes",
      estado: 200,
      duracionMs: 12,
    });

    assert.equal(linea, "[acceso] 2026-08-04T15:32:11.204Z GET /api/mensajes 200 12ms");
  });
});

describe("crearRegistroDeAcceso", () => {
  it("no escribe nada hasta que la respuesta termina", () => {
    const { lineas, res } = correr();
    assert.deepEqual(lineas, []);

    res.terminar(200);
    assert.equal(lineas.length, 1);
  });

  it("registra fecha ISO, método, ruta, estado y duración", () => {
    let ahora = 1_000;
    const { lineas, res } = correr(() => ahora);

    ahora = 1_042;
    res.terminar(200);

    const linea = lineas[0] ?? "";
    assert.match(linea, /^\[acceso\] \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z GET \/api\/mensajes 200 42ms$/);
  });

  it("registra el estado real, también cuando la petición falla", () => {
    const { lineas, res } = correr();
    res.terminar(401);
    assert.match(lineas[0] ?? "", / 401 /);
  });

  // El corazón de FR-028.
  it("NO registra cadena de consulta, credencial, cuerpo ni dirección de red", () => {
    const { lineas, res } = correr();
    res.terminar(200);
    const linea = lineas[0] ?? "";

    assert.ok(!linea.includes("?"), "no debe traer la cadena de consulta");
    assert.ok(!linea.includes("desde="), "no debe traer parámetros de la consulta");
    assert.ok(!linea.includes(CORREO_EN_LA_CONSULTA), "no debe traer un correo");
    assert.ok(!linea.includes(NOMBRE_EN_EL_CUERPO), "no debe traer el cuerpo de la petición");
    assert.ok(!linea.includes(DIRECCION), "la dirección de red es dato personal (Ley 1581)");
    assert.ok(!linea.toLowerCase().includes("bearer"), "no debe traer la credencial");
    assert.ok(!linea.includes(CREDENCIAL), "no debe traer la credencial");
  });
});
