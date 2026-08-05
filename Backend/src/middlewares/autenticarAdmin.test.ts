import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request, Response } from "express";

import {
  CREDENCIALES_RECHAZADAS,
  crearAutenticacionAdmin,
  esCredencialDeEjemplo,
  extraerTokenBearer,
  LONGITUD_MINIMA_TOKEN,
  tokenAdminEsUtilizable,
  tokensCoinciden,
} from "./autenticarAdmin.js";

const TOKEN_VALIDO = "token-de-prueba-suficientemente-largo";

/** El placeholder de .env.example: 38 caracteres, publicado en el repositorio. */
const TOKEN_DE_LA_PLANTILLA = "cambiar-por-un-token-largo-y-aleatorio";

// Dobles de prueba mínimos. Se usa `as unknown as Request/Response` porque
// implementar las interfaces completas de Express no aporta nada al test.
function crearPeticion(cabecera?: string): Request {
  return {
    header: (nombre: string): string | undefined =>
      nombre.toLowerCase() === "authorization" ? cabecera : undefined,
  } as unknown as Request;
}

function crearRespuesta(): { res: Response; captura: Captura } {
  const captura: Captura = { estado: null, cuerpo: null, cabeceras: {} };
  const doble = {
    status(codigo: number) {
      captura.estado = codigo;
      return this;
    },
    json(cuerpo: unknown) {
      captura.cuerpo = cuerpo;
      return this;
    },
    setHeader(nombre: string, valor: string) {
      captura.cabeceras[nombre] = valor;
      return this;
    },
  };
  return { res: doble as unknown as Response, captura };
}

interface Captura {
  estado: number | null;
  cuerpo: unknown;
  cabeceras: Record<string, string>;
}

describe("extraerTokenBearer", () => {
  it("extrae el token de una cabecera Bearer bien formada", () => {
    assert.equal(extraerTokenBearer("Bearer abc123"), "abc123");
  });

  it("acepta el esquema sin importar mayúsculas o minúsculas", () => {
    assert.equal(extraerTokenBearer("bearer abc123"), "abc123");
    assert.equal(extraerTokenBearer("BEARER abc123"), "abc123");
  });

  it("rechaza cabeceras ausentes, vacías o con otro esquema", () => {
    assert.equal(extraerTokenBearer(undefined), null);
    assert.equal(extraerTokenBearer(""), null);
    assert.equal(extraerTokenBearer("Bearer"), null);
    assert.equal(extraerTokenBearer("Bearer    "), null);
    assert.equal(extraerTokenBearer("Basic abc123"), null);
    assert.equal(extraerTokenBearer("abc123"), null);
  });
});

describe("tokensCoinciden", () => {
  it("acepta tokens idénticos", () => {
    assert.equal(tokensCoinciden(TOKEN_VALIDO, TOKEN_VALIDO), true);
  });

  it("rechaza tokens distintos, incluso de distinta longitud", () => {
    assert.equal(tokensCoinciden("otro", TOKEN_VALIDO), false);
    assert.equal(tokensCoinciden(`${TOKEN_VALIDO}x`, TOKEN_VALIDO), false);
    assert.equal(tokensCoinciden("", TOKEN_VALIDO), false);
  });
});

describe("tokenAdminEsUtilizable", () => {
  it("rechaza tokens vacíos o demasiado cortos", () => {
    assert.equal(tokenAdminEsUtilizable(""), false);
    assert.equal(tokenAdminEsUtilizable("   "), false);
    assert.equal(tokenAdminEsUtilizable("corto"), false);
    assert.equal(tokenAdminEsUtilizable("123456789012345"), false); // 15 caracteres
  });

  it("acepta tokens de 16 caracteres o más", () => {
    assert.equal(tokenAdminEsUtilizable("1234567890123456"), true);
  });

  // FR-026. El placeholder de .env.example mide 38 caracteres: pasaba el mínimo
  // de 16 y dejaba el panel "protegido" por un secreto que está en el repo.
  it("rechaza la credencial de ejemplo de la plantilla aunque sea larga", () => {
    assert.ok(TOKEN_DE_LA_PLANTILLA.length > LONGITUD_MINIMA_TOKEN, "el placeholder supera el mínimo de longitud");
    assert.equal(tokenAdminEsUtilizable(TOKEN_DE_LA_PLANTILLA), false);
  });

  it("rechaza cualquier credencial de la lista, sin importar espacios ni mayúsculas", () => {
    for (const rechazada of CREDENCIALES_RECHAZADAS) {
      assert.equal(tokenAdminEsUtilizable(rechazada), false, rechazada);
      assert.equal(tokenAdminEsUtilizable(`  ${rechazada.toUpperCase()}  `), false, rechazada);
    }
  });

  it("la lista incluye el valor exacto que trae .env.example", () => {
    assert.ok(CREDENCIALES_RECHAZADAS.includes(TOKEN_DE_LA_PLANTILLA));
    assert.equal(esCredencialDeEjemplo(TOKEN_DE_LA_PLANTILLA), true);
    assert.equal(esCredencialDeEjemplo(TOKEN_VALIDO), false);
  });
});

describe("crearAutenticacionAdmin", () => {
  it("deja pasar la petición cuando el token es correcto", () => {
    const autenticar = crearAutenticacionAdmin(TOKEN_VALIDO);
    const { res, captura } = crearRespuesta();
    let continuo = false;

    autenticar(crearPeticion(`Bearer ${TOKEN_VALIDO}`), res, () => {
      continuo = true;
    });

    assert.equal(continuo, true);
    assert.equal(captura.estado, null);
  });

  it("responde 401 si no viene la cabecera Authorization", () => {
    const autenticar = crearAutenticacionAdmin(TOKEN_VALIDO);
    const { res, captura } = crearRespuesta();
    let continuo = false;

    autenticar(crearPeticion(undefined), res, () => {
      continuo = true;
    });

    assert.equal(continuo, false);
    assert.equal(captura.estado, 401);
    assert.equal(captura.cabeceras["WWW-Authenticate"], 'Bearer realm="webCDA"');
  });

  it("responde 401 si el token es incorrecto", () => {
    const autenticar = crearAutenticacionAdmin(TOKEN_VALIDO);
    const { res, captura } = crearRespuesta();
    let continuo = false;

    autenticar(crearPeticion("Bearer token-incorrecto-pero-largo"), res, () => {
      continuo = true;
    });

    assert.equal(continuo, false);
    assert.equal(captura.estado, 401);
  });

  // El caso importante: sin token configurado el endpoint NO puede quedar público.
  // La credencial de la plantilla cuenta como "sin configurar" y da el MISMO 503:
  // si diera 401 se vería como un panel bien montado con la clave equivocada, y
  // quien la copió del repo entraría igual.
  it("falla cerrado con 503 si el token del entorno no está configurado", () => {
    for (const tokenDelEntorno of ["", "   ", "corto", TOKEN_DE_LA_PLANTILLA]) {
      const autenticar = crearAutenticacionAdmin(tokenDelEntorno);
      const { res, captura } = crearRespuesta();
      let continuo = false;

      // Ni siquiera mandando el mismo valor que el del entorno se pasa.
      autenticar(crearPeticion(`Bearer ${tokenDelEntorno}`), res, () => {
        continuo = true;
      });

      assert.equal(continuo, false, `no debe dejar pasar con ADMIN_TOKEN='${tokenDelEntorno}'`);
      assert.equal(captura.estado, 503);
    }
  });

  it("no revela el token esperado en el cuerpo del error", () => {
    const autenticar = crearAutenticacionAdmin(TOKEN_VALIDO);
    const { res, captura } = crearRespuesta();

    autenticar(crearPeticion("Bearer incorrecto"), res, () => undefined);

    assert.equal(JSON.stringify(captura.cuerpo).includes(TOKEN_VALIDO), false);
  });
});
