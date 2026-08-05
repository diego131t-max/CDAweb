import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it } from "node:test";
import type { Request, RequestHandler, Response } from "express";

import { crearLimitadorDePeticiones, MENSAJE_DEMASIADOS_INTENTOS, soloEnMetodo } from "./limitarPeticiones.js";

/**
 * Pruebas del limitador. Las reglas que verifican son reglas de negocio de
 * verdad —cuántos intentos, qué cuenta como intento, cuándo se libera el cupo—,
 * y un error acá se paga en los dos sentidos: de menos, deja pasar la fuerza
 * bruta contra la credencial; de más, bloquea al personal del CDA trabajando.
 */

// Direcciones de documentación (RFC 5737): no son de nadie.
const DIRECCION = "198.51.100.7";
const OTRA_DIRECCION = "203.0.113.42";

/**
 * Doble de Response. Es un EventEmitter de verdad porque el limitador se engancha
 * al evento `finish`, que es lo único que le dice cómo terminó la petición.
 */
class RespuestaFalsa extends EventEmitter {
  statusCode = 200;
  cuerpo: unknown = null;
  readonly cabeceras: Record<string, string> = {};

  status(codigo: number): this {
    this.statusCode = codigo;
    return this;
  }

  json(cuerpo: unknown): this {
    this.cuerpo = cuerpo;
    this.emit("finish");
    return this;
  }

  setHeader(nombre: string, valor: string): this {
    this.cabeceras[nombre] = valor;
    return this;
  }

  /** Simula que el handler de más abajo terminó con ese código de estado. */
  terminar(codigo: number): void {
    this.statusCode = codigo;
    this.emit("finish");
  }
}

interface Intento {
  res: RespuestaFalsa;
  /** `true` si el limitador dejó seguir la petición. */
  paso: boolean;
}

// Se usa `as unknown as Request/Response` porque implementar las interfaces
// completas de Express no aporta nada: el limitador solo lee `req.ip`,
// `req.method` y los tres métodos de respuesta que el doble implementa.
function pedir(limitador: RequestHandler, direccion: string = DIRECCION, metodo = "POST"): Intento {
  const req = { ip: direccion, method: metodo } as unknown as Request;
  const res = new RespuestaFalsa();
  let paso = false;

  limitador(req, res as unknown as Response, () => {
    paso = true;
  });

  return { res, paso };
}

describe("crearLimitadorDePeticiones", () => {
  it("deja pasar hasta el máximo y después responde 429 en español", () => {
    const limitador = crearLimitadorDePeticiones({ ventanaMs: 60_000, maximo: 3 });

    for (let numero = 1; numero <= 3; numero += 1) {
      assert.equal(pedir(limitador).paso, true, `la petición ${numero} debía pasar`);
    }

    const bloqueada = pedir(limitador);

    assert.equal(bloqueada.paso, false);
    assert.equal(bloqueada.res.statusCode, 429);
    assert.deepEqual(bloqueada.res.cuerpo, { error: MENSAJE_DEMASIADOS_INTENTOS });
    assert.ok(Number(bloqueada.res.cabeceras["Retry-After"]) > 0, "debe decir cuántos segundos esperar");
  });

  it("cuenta por dirección: bloquear a una no bloquea a las demás", () => {
    const limitador = crearLimitadorDePeticiones({ ventanaMs: 60_000, maximo: 1 });

    assert.equal(pedir(limitador, DIRECCION).paso, true);
    assert.equal(pedir(limitador, DIRECCION).paso, false);
    assert.equal(pedir(limitador, OTRA_DIRECCION).paso, true);
  });

  it("libera el cupo cuando la ventana pasa", () => {
    let ahora = 0;
    const limitador = crearLimitadorDePeticiones({ ventanaMs: 1_000, maximo: 2, reloj: () => ahora });

    assert.equal(pedir(limitador).paso, true);
    assert.equal(pedir(limitador).paso, true);
    assert.equal(pedir(limitador).paso, false);

    ahora = 1_001;
    assert.equal(pedir(limitador).paso, true, "vencida la ventana, se vuelve a atender");
  });

  // Lo que necesita el limitador de credencial: si contara los aciertos, el
  // personal del CDA se autobloquearía usando el panel, que revalida la
  // credencial en cada carga de página.
  it("con soloFallos, las respuestas correctas no consumen cupo", () => {
    const limitador = crearLimitadorDePeticiones({ ventanaMs: 60_000, maximo: 2, soloFallos: true });

    for (let numero = 1; numero <= 10; numero += 1) {
      const intento = pedir(limitador);
      assert.equal(intento.paso, true, `la verificación correcta ${numero} debía pasar`);
      intento.res.terminar(200);
    }
  });

  it("con soloFallos, los fallos sí consumen cupo", () => {
    const limitador = crearLimitadorDePeticiones({ ventanaMs: 60_000, maximo: 2, soloFallos: true });

    for (let numero = 1; numero <= 2; numero += 1) {
      const intento = pedir(limitador);
      assert.equal(intento.paso, true);
      intento.res.terminar(401);
    }

    const bloqueada = pedir(limitador);
    assert.equal(bloqueada.paso, false);
    assert.equal(bloqueada.res.statusCode, 429);
  });

  // Si el propio 429 se contara como fallo, quien ya está bloqueado extendería su
  // bloqueo para siempre con solo seguir intentando.
  it("el 429 no se cuenta a sí mismo: el bloqueo no se extiende solo", () => {
    let ahora = 0;
    const limitador = crearLimitadorDePeticiones({
      ventanaMs: 60_000,
      maximo: 2,
      soloFallos: true,
      reloj: () => ahora,
    });

    for (let numero = 1; numero <= 2; numero += 1) {
      pedir(limitador).res.terminar(401);
    }

    ahora = 1_000;
    for (let numero = 1; numero <= 5; numero += 1) {
      assert.equal(pedir(limitador).res.statusCode, 429);
    }

    // La ventana se cuenta desde los DOS fallos originales (t=0), no desde los
    // 429 de t=1000.
    ahora = 60_001;
    assert.equal(pedir(limitador).paso, true);
  });

  it("no se cae si la petición no trae dirección", () => {
    const limitador = crearLimitadorDePeticiones({ ventanaMs: 60_000, maximo: 1 });
    const req = { method: "GET" } as unknown as Request;
    const res = new RespuestaFalsa();
    let paso = false;

    limitador(req, res as unknown as Response, () => {
      paso = true;
    });

    assert.equal(paso, true);
  });

  it("rechaza configuraciones sin sentido al construirse", () => {
    assert.throws(() => crearLimitadorDePeticiones({ ventanaMs: 0, maximo: 5 }));
    assert.throws(() => crearLimitadorDePeticiones({ ventanaMs: 1_000, maximo: 0 }));
    assert.throws(() => crearLimitadorDePeticiones({ ventanaMs: 1_000, maximo: 1.5 }));
  });
});

describe("soloEnMetodo", () => {
  it("aplica el middleware solo al método indicado", () => {
    const limitador = crearLimitadorDePeticiones({ ventanaMs: 60_000, maximo: 1 });
    const soloPost = soloEnMetodo("POST", limitador);

    assert.equal(pedir(soloPost, DIRECCION, "POST").paso, true);
    // El cupo del POST ya se agotó, pero el GET ni siquiera pasa por el limitador.
    assert.equal(pedir(soloPost, DIRECCION, "GET").paso, true);
    assert.equal(pedir(soloPost, DIRECCION, "POST").paso, false);
  });
});
