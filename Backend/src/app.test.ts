import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import { describe, it } from "node:test";

import { crearApp } from "./app.js";
import { crearAutenticacionAdmin } from "./middlewares/autenticarAdmin.js";

/**
 * Pruebas de integración HTTP de GET /api/admin/sesion.
 *
 * Se levanta la app REAL en un puerto que asigna el sistema (`listen(0)`) y se
 * le pega con el fetch nativo de Node: sin supertest ni ninguna dependencia
 * nueva. Es a propósito que no se pruebe el middleware aislado —eso ya está en
 * middlewares/autenticarAdmin.test.ts—: lo que acá se verifica es que el guard
 * esté efectivamente MONTADO en la ruta. Una prueba del middleware suelto sigue
 * en verde aunque alguien lo saque de la ruta.
 */

const TOKEN_DE_PRUEBA = "token-de-prueba-suficientemente-largo";

interface ApiDePrueba {
  url: string;
  cerrar: () => Promise<void>;
}

/**
 * Levanta la app con la credencial indicada y devuelve su URL base.
 *
 * El token se inyecta por parámetro porque `dependencias.ts` compone el
 * middleware con el token del entorno, y las pruebas no pueden depender de qué
 * diga el .env de quien las corra.
 */
async function levantarApi(tokenAdmin: string): Promise<ApiDePrueba> {
  const app = crearApp({ autenticacionAdmin: crearAutenticacionAdmin(tokenAdmin) });

  const servidor: Server = app.listen(0, "127.0.0.1");
  await once(servidor, "listening");

  const direccion = servidor.address();
  if (direccion === null || typeof direccion === "string") {
    throw new Error("El servidor de prueba no expuso un puerto TCP.");
  }

  return {
    url: `http://127.0.0.1:${direccion.port}`,
    cerrar: () =>
      new Promise<void>((resolver, rechazar) => {
        servidor.close((error) => (error ? rechazar(error) : resolver()));
        // fetch mantiene la conexión viva: sin esto, close() nunca termina y la
        // suite queda colgada.
        servidor.closeAllConnections();
      }),
  };
}

describe("GET /api/admin/sesion", () => {
  it("responde 200 con {estado:'ok'} y Cache-Control: no-store cuando la credencial es válida", async (t) => {
    const api = await levantarApi(TOKEN_DE_PRUEBA);
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/admin/sesion`, {
      headers: { Authorization: `Bearer ${TOKEN_DE_PRUEBA}` },
    });

    assert.equal(respuesta.status, 200);
    assert.deepEqual(await respuesta.json(), { estado: "ok" });
    assert.equal(respuesta.headers.get("cache-control"), "no-store");
  });

  it("responde 401 cuando no viene la cabecera Authorization", async (t) => {
    const api = await levantarApi(TOKEN_DE_PRUEBA);
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/admin/sesion`);

    assert.equal(respuesta.status, 401);
    assert.equal(respuesta.headers.get("www-authenticate"), 'Bearer realm="webCDA"');
    assert.deepEqual(await respuesta.json(), { error: "Se requiere autenticación de administrador." });
  });

  it("responde 401 cuando la credencial es incorrecta, sin revelar la esperada", async (t) => {
    const api = await levantarApi(TOKEN_DE_PRUEBA);
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/admin/sesion`, {
      headers: { Authorization: "Bearer credencial-incorrecta-pero-larga" },
    });
    const cuerpo: unknown = await respuesta.json();

    assert.equal(respuesta.status, 401);
    assert.equal(respuesta.headers.get("www-authenticate"), 'Bearer realm="webCDA"');
    assert.equal(JSON.stringify(cuerpo).includes(TOKEN_DE_PRUEBA), false);
  });

  it("responde 401 cuando el esquema no es Bearer, aunque el valor sea el correcto", async (t) => {
    const api = await levantarApi(TOKEN_DE_PRUEBA);
    t.after(() => api.cerrar());

    for (const cabecera of [`Basic ${TOKEN_DE_PRUEBA}`, TOKEN_DE_PRUEBA]) {
      const respuesta = await fetch(`${api.url}/api/admin/sesion`, {
        headers: { Authorization: cabecera },
      });

      assert.equal(respuesta.status, 401, `debe rechazar la cabecera '${cabecera.slice(0, 5)}…'`);
      // Se consume el cuerpo para no dejar la conexión a medio leer.
      await respuesta.text();
    }
  });

  // El caso que importa: mal configurado, el panel NO queda abierto.
  it("responde 503 cuando el servidor no tiene credencial configurada", async (t) => {
    const api = await levantarApi("");
    t.after(() => api.cerrar());

    // Ni siquiera mandando el mismo valor vacío que tiene el servidor se pasa.
    for (const cabecera of ["Bearer ", `Bearer ${TOKEN_DE_PRUEBA}`]) {
      const respuesta = await fetch(`${api.url}/api/admin/sesion`, {
        headers: { Authorization: cabecera },
      });

      assert.equal(respuesta.status, 503);
      assert.deepEqual(await respuesta.json(), {
        error: "El panel de administración no está disponible: falta configurar la autenticación en el servidor.",
      });
    }

    // Y sin cabecera tampoco: el 503 gana sobre el 401.
    const sinCabecera = await fetch(`${api.url}/api/admin/sesion`);
    assert.equal(sinCabecera.status, 503);
    await sinCabecera.text();
  });

  // Guarda la trampa de D5: si alguien deja crossOriginResourcePolicy en su valor
  // por omisión (same-origin), el navegador descarta las respuestas del API y se
  // cae el agendamiento entero. Acá se ve como una prueba roja, no como un sitio
  // roto en producción.
  it("manda las cabeceras de seguridad: CORP cross-origin y sin X-Powered-By", async (t) => {
    const api = await levantarApi(TOKEN_DE_PRUEBA);
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/admin/sesion`, {
      headers: { Authorization: `Bearer ${TOKEN_DE_PRUEBA}` },
    });
    await respuesta.text();

    assert.equal(respuesta.headers.get("cross-origin-resource-policy"), "cross-origin");
    assert.equal(respuesta.headers.get("x-powered-by"), null);
    assert.equal(respuesta.headers.get("x-content-type-options"), "nosniff");
  });
});
