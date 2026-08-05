import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import { describe, it } from "node:test";
import type { Express, RequestHandler } from "express";

import { crearApp } from "./app.js";
import { crearAutenticacionAdmin } from "./middlewares/autenticarAdmin.js";
import { crearLimitadorDePeticiones, MENSAJE_DEMASIADOS_INTENTOS } from "./middlewares/limitarPeticiones.js";
import type { RepositorioMensajes } from "./repositorios/repositorioMensajes.js";
import type { FiltroMensajes, Mensaje, NuevoMensaje } from "./tipos/mensaje.js";
import { LIMITES } from "./validacion/mensajes.js";

/**
 * Pruebas de integración HTTP del API.
 *
 * Se levanta la app REAL en un puerto que asigna el sistema (`listen(0)`) y se
 * le pega con el fetch nativo de Node: sin supertest ni ninguna dependencia
 * nueva. Es a propósito que no se prueben los middlewares aislados —eso ya está
 * en middlewares/*.test.ts—: lo que acá se verifica es que los guards estén
 * efectivamente MONTADOS en las rutas. Una prueba del middleware suelto sigue en
 * verde aunque alguien lo saque de la ruta.
 */

const TOKEN_DE_PRUEBA = "token-de-prueba-suficientemente-largo";
const CREDENCIAL_INCORRECTA = "Bearer credencial-incorrecta-pero-larga";

/**
 * Repositorio de mensajes de mentira.
 *
 * Se usa en TODAS las pruebas para que la suite no escriba nunca en
 * `Backend/data/mensajes.json`, que es un archivo con datos personales de
 * clientes reales. Además deja ver con qué filtro lo llamó la ruta, que es lo
 * que necesita la prueba del tope por omisión.
 */
class RepositorioMensajesFalso implements RepositorioMensajes {
  readonly filtrosRecibidos: (FiltroMensajes | undefined)[] = [];
  private readonly mensajes: Mensaje[];

  constructor(cantidad = 0) {
    this.mensajes = Array.from({ length: cantidad }, (_valor, indice) => ({
      id: `mensaje-de-prueba-${indice}`,
      name: `Cliente de prueba ${indice}`,
      email: `cliente${indice}@ejemplo.test`,
      message: "Mensaje inventado para la prueba; no es de nadie.",
      date: "2026-08-04",
      creadoEn: `2026-08-04T10:00:00.${String(indice).padStart(3, "0")}Z`,
    }));
  }

  async crear(datos: NuevoMensaje): Promise<Mensaje> {
    return {
      id: "mensaje-creado-en-la-prueba",
      date: "2026-08-04",
      creadoEn: "2026-08-04T10:00:00.000Z",
      ...datos,
    };
  }

  async listar(filtro?: FiltroMensajes): Promise<Mensaje[]> {
    this.filtrosRecibidos.push(filtro);
    const limite = filtro?.limite;
    return limite === undefined ? [...this.mensajes] : this.mensajes.slice(0, limite);
  }
}

/** Limitador que en la práctica no limita: para las pruebas que no lo prueban. */
function limitadorPermisivo(): RequestHandler {
  return crearLimitadorDePeticiones({ ventanaMs: 60_000, maximo: 1_000_000 });
}

interface OpcionesApi {
  tokenAdmin?: string;
  limitadorCredencial?: RequestHandler;
  limitadorPublico?: RequestHandler;
  repositorioMensajes?: RepositorioMensajes;
}

interface ApiDePrueba {
  url: string;
  app: Express;
  cerrar: () => Promise<void>;
}

/**
 * Levanta la app y devuelve su URL base.
 *
 * Todo se inyecta por parámetro porque `dependencias.ts` compone los middlewares
 * con el entorno del proceso, y las pruebas no pueden depender de qué diga el
 * .env de quien las corra. Los limitadores además se crean NUEVOS en cada app:
 * los de `dependencias.ts` son de proceso y viven en memoria, así que
 * compartirlos haría que las peticiones de una prueba consumieran el cupo de la
 * siguiente (todas salen de 127.0.0.1) y la suite se volvería inestable.
 */
async function levantarApi(opciones: OpcionesApi = {}): Promise<ApiDePrueba> {
  const {
    tokenAdmin = TOKEN_DE_PRUEBA,
    limitadorCredencial = limitadorPermisivo(),
    limitadorPublico = limitadorPermisivo(),
    repositorioMensajes = new RepositorioMensajesFalso(),
  } = opciones;

  const app = crearApp({
    autenticacionAdmin: crearAutenticacionAdmin(tokenAdmin),
    limitadorCredencial,
    limitadorPublico,
    repositorioMensajes,
    // El registro de accesos tiene sus propias pruebas; acá solo ensuciaría la
    // salida de la suite con una línea por petición.
    registroDeAcceso: (_req, _res, siguiente) => siguiente(),
  });

  const servidor: Server = app.listen(0, "127.0.0.1");
  await once(servidor, "listening");

  const direccion = servidor.address();
  if (direccion === null || typeof direccion === "string") {
    throw new Error("El servidor de prueba no expuso un puerto TCP.");
  }

  return {
    url: `http://127.0.0.1:${direccion.port}`,
    app,
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
    const api = await levantarApi();
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/admin/sesion`, {
      headers: { Authorization: `Bearer ${TOKEN_DE_PRUEBA}` },
    });

    assert.equal(respuesta.status, 200);
    assert.deepEqual(await respuesta.json(), { estado: "ok" });
    assert.equal(respuesta.headers.get("cache-control"), "no-store");
  });

  it("responde 401 cuando no viene la cabecera Authorization", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/admin/sesion`);

    assert.equal(respuesta.status, 401);
    assert.equal(respuesta.headers.get("www-authenticate"), 'Bearer realm="webCDA"');
    assert.deepEqual(await respuesta.json(), { error: "Se requiere autenticación de administrador." });
  });

  it("responde 401 cuando la credencial es incorrecta, sin revelar la esperada", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/admin/sesion`, {
      headers: { Authorization: CREDENCIAL_INCORRECTA },
    });
    const cuerpo: unknown = await respuesta.json();

    assert.equal(respuesta.status, 401);
    assert.equal(respuesta.headers.get("www-authenticate"), 'Bearer realm="webCDA"');
    assert.equal(JSON.stringify(cuerpo).includes(TOKEN_DE_PRUEBA), false);
  });

  it("responde 401 cuando el esquema no es Bearer, aunque el valor sea el correcto", async (t) => {
    const api = await levantarApi();
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
    const api = await levantarApi({ tokenAdmin: "" });
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
    const api = await levantarApi();
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

describe("GET /api/mensajes", () => {
  /**
   * ESTA ES LA PRUEBA DE FR-030.
   *
   * Si alguien saca `autenticacionAdmin` del `router.get("/")` de
   * rutas/mensajes.ts, esta prueba se pone roja. Es el único freno automático que
   * hay contra volver al estado que originó toda esta funcionalidad: el panel
   * abierto, con nombre, teléfono, correo y placa de clientes reales a la vista
   * de cualquiera que escribiera la URL.
   *
   * Se verificó a mano que falla: ver T030 de tasks.md. Una prueba de regresión
   * que nunca se vio fallar es una suposición, no una prueba.
   */
  it("responde 401 sin credencial y NO devuelve ningún dato personal", async (t) => {
    const api = await levantarApi({ repositorioMensajes: new RepositorioMensajesFalso(3) });
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/mensajes`);
    const cuerpo: unknown = await respuesta.json();

    assert.equal(respuesta.status, 401, "el listado de mensajes NO puede responder sin credencial");
    assert.equal(respuesta.headers.get("www-authenticate"), 'Bearer realm="webCDA"');
    // Y que no se cuele nada del contenido por el cuerpo del error.
    assert.equal(Array.isArray(cuerpo), false);
    assert.equal(JSON.stringify(cuerpo).includes("cliente0@ejemplo.test"), false);
  });

  it("responde 401 con credencial incorrecta", async (t) => {
    const api = await levantarApi({ repositorioMensajes: new RepositorioMensajesFalso(3) });
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/mensajes`, {
      headers: { Authorization: CREDENCIAL_INCORRECTA },
    });
    await respuesta.text();

    assert.equal(respuesta.status, 401);
  });

  // FR-024: la lista de datos personales nunca sale sin tope. Antes, una sola
  // petición sin parámetros se llevaba la base entera.
  it("aplica el tope por omisión de 100 cuando no se pide un límite", async (t) => {
    const repositorio = new RepositorioMensajesFalso(150);
    const api = await levantarApi({ repositorioMensajes: repositorio });
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/mensajes`, {
      headers: { Authorization: `Bearer ${TOKEN_DE_PRUEBA}` },
    });
    const cuerpo: unknown = await respuesta.json();

    assert.equal(respuesta.status, 200);
    assert.ok(Array.isArray(cuerpo));
    assert.equal(cuerpo.length, 100);
    assert.equal(cuerpo.length, LIMITES.listadoPorOmision);
    // El tope llega hasta el repositorio: no se recortó después de traer todo.
    assert.deepEqual(repositorio.filtrosRecibidos, [{ limite: 100 }]);
  });

  it("respeta el límite pedido cuando el cliente sí manda uno", async (t) => {
    const repositorio = new RepositorioMensajesFalso(150);
    const api = await levantarApi({ repositorioMensajes: repositorio });
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/mensajes?limite=5`, {
      headers: { Authorization: `Bearer ${TOKEN_DE_PRUEBA}` },
    });
    const cuerpo: unknown = await respuesta.json();

    assert.ok(Array.isArray(cuerpo));
    assert.equal(cuerpo.length, 5);
  });
});

describe("Limitador de intentos de credencial", () => {
  it("responde 429 en español después de los fallos permitidos", async (t) => {
    const api = await levantarApi({
      // Tope chico inyectado: esperar los 10 fallos reales haría la prueba lenta
      // y frágil. Lo que se verifica es que el limitador ESTÉ montado en
      // /api/admin, no cuál es el número.
      limitadorCredencial: crearLimitadorDePeticiones({ ventanaMs: 60_000, maximo: 2, soloFallos: true }),
    });
    t.after(() => api.cerrar());

    for (let intento = 1; intento <= 2; intento += 1) {
      const respuesta = await fetch(`${api.url}/api/admin/sesion`, {
        headers: { Authorization: CREDENCIAL_INCORRECTA },
      });
      await respuesta.text();
      assert.equal(respuesta.status, 401, `el intento ${intento} debía contestar 401`);
    }

    const bloqueada = await fetch(`${api.url}/api/admin/sesion`, {
      headers: { Authorization: CREDENCIAL_INCORRECTA },
    });

    assert.equal(bloqueada.status, 429);
    assert.deepEqual(await bloqueada.json(), { error: MENSAJE_DEMASIADOS_INTENTOS });
    assert.ok(Number(bloqueada.headers.get("retry-after")) > 0);
  });

  it("también topa los intentos contra GET /api/mensajes, y comparte contador con /api/admin", async (t) => {
    // Sin esto el tope de /api/admin sería decorativo: `GET /api/mensajes` pide
    // la misma credencial y responde 401 igual, así que sería la puerta de al
    // lado para probarlas de a una. FR-020 pide que adivinar la credencial no
    // sea viable, no que una ruta puntual tenga tope.
    const api = await levantarApi({
      limitadorCredencial: crearLimitadorDePeticiones({ ventanaMs: 60_000, maximo: 2, soloFallos: true }),
    });
    t.after(() => api.cerrar());

    // Un fallo por cada ruta: si cada una llevara su propio contador, ninguna
    // habría llegado al tope y la tercera petición pasaría.
    const contraAdmin = await fetch(`${api.url}/api/admin/sesion`, {
      headers: { Authorization: CREDENCIAL_INCORRECTA },
    });
    await contraAdmin.text();
    assert.equal(contraAdmin.status, 401);

    const contraMensajes = await fetch(`${api.url}/api/mensajes`, {
      headers: { Authorization: CREDENCIAL_INCORRECTA },
    });
    await contraMensajes.text();
    assert.equal(contraMensajes.status, 401);

    const bloqueada = await fetch(`${api.url}/api/mensajes`, {
      headers: { Authorization: CREDENCIAL_INCORRECTA },
    });
    assert.equal(bloqueada.status, 429, "los dos fallos anteriores tenían que sumar en el mismo contador");
    assert.deepEqual(await bloqueada.json(), { error: MENSAJE_DEMASIADOS_INTENTOS });
  });

  it("no cuenta los aciertos: el personal del CDA no se autobloquea trabajando", async (t) => {
    const api = await levantarApi({
      limitadorCredencial: crearLimitadorDePeticiones({ ventanaMs: 60_000, maximo: 2, soloFallos: true }),
    });
    t.after(() => api.cerrar());

    // El panel revalida la credencial en cada carga de página: con un limitador
    // que contara los aciertos, la tercera recarga dejaría al personal afuera.
    for (let carga = 1; carga <= 6; carga += 1) {
      const respuesta = await fetch(`${api.url}/api/admin/sesion`, {
        headers: { Authorization: `Bearer ${TOKEN_DE_PRUEBA}` },
      });
      await respuesta.text();
      assert.equal(respuesta.status, 200, `la verificación correcta ${carga} debía pasar`);
    }
  });
});

/**
 * EL CANDADO DE FR-006 — qué endpoints responden sin credencial.
 *
 * Sobre la aparente contradicción con "solo dos operaciones son públicas": esa
 * frase de la constitución y de FR-006 habla de operaciones sobre DATOS
 * PERSONALES —crear una cita y enviar un mensaje de contacto—. El catálogo de
 * servicios y el chequeo de salud también responden sin credencial, y está bien
 * que así sea: no exponen ni un dato de cliente. El catálogo es información
 * comercial que el sitio ya publica, y el agendamiento lo necesita antes de que
 * exista cualquier sesión; el chequeo de salud solo dice si el proceso está vivo.
 * Quedó justificado así en el plan de la funcionalidad 001.
 *
 * Por eso la lista tiene TRES y no dos. Y por eso la prueba falla si aparece un
 * cuarto: la próxima vez que alguien monte un endpoint, tiene que pasar por acá y
 * decidir explícitamente si es público, en vez de que quede abierto por descuido.
 */
describe("Superficie pública del API", () => {
  interface EndpointDelCatalogo {
    endpoint: string;
    publico: boolean;
  }

  const CATALOGO: readonly EndpointDelCatalogo[] = [
    { endpoint: "GET /api/health", publico: true },
    { endpoint: "GET /api/servicios", publico: true },
    { endpoint: "POST /api/mensajes", publico: true },
    { endpoint: "GET /api/mensajes", publico: false },
    { endpoint: "GET /api/admin/sesion", publico: false },
  ];

  /**
   * Forma mínima de la pila de capas de Express que necesita este recorrido.
   *
   * Express no tipa sus internos, así que se declara acá lo poco que se usa y se
   * llega a ello con un cast a través de `unknown` (no se usa `any`). Si Express
   * cambiara esa forma, este recorrido devolvería una lista vacía y la prueba se
   * pondría roja — que es exactamente lo que queremos que pase antes de que un
   * endpoint quede público sin que nadie se entere.
   */
  interface CapaExpress {
    route?: { path: string; methods: Record<string, boolean> };
    handle?: { stack?: CapaExpress[] };
    matchers?: ((entrada: string) => { path: string } | false)[];
  }

  function partirEndpoint(endpoint: string): { metodo: string; ruta: string } {
    const separador = endpoint.indexOf(" ");
    return { metodo: endpoint.slice(0, separador), ruta: endpoint.slice(separador + 1) };
  }

  function metodosDe(methods: Record<string, boolean>): string[] {
    return Object.keys(methods)
      .filter((metodo) => methods[metodo] === true)
      .map((metodo) => metodo.toUpperCase());
  }

  /**
   * Averigua en qué prefijo está montado un router preguntándole a su propio
   * comparador de rutas. No se lee ninguna expresión regular interna: se le pasan
   * las rutas del catálogo y él contesta qué prefijo hizo coincidir.
   */
  function resolverPrefijo(capa: CapaExpress): string {
    const emparejar = capa.matchers?.[0];
    if (emparejar !== undefined) {
      for (const { endpoint } of CATALOGO) {
        const coincidencia = emparejar(partirEndpoint(endpoint).ruta);
        if (coincidencia !== false) return coincidencia.path;
      }
    }
    return "<router montado en un prefijo que este catálogo no conoce>";
  }

  /** Recorre lo que la app tiene realmente montado y devuelve "MÉTODO /ruta". */
  function descubrirEndpoints(app: Express): string[] {
    const pila = (app as unknown as { router: { stack: CapaExpress[] } }).router.stack;
    const encontrados: string[] = [];

    for (const capa of pila) {
      // Ruta declarada directamente sobre la app (por ejemplo /api/health).
      if (capa.route !== undefined) {
        for (const metodo of metodosDe(capa.route.methods)) {
          encontrados.push(`${metodo} ${capa.route.path}`);
        }
        continue;
      }

      // Router montado. Los middlewares sueltos (helmet, cors, json, limitador)
      // no tienen pila propia y se saltan acá.
      const subpila = capa.handle?.stack;
      if (subpila === undefined) continue;

      const prefijo = resolverPrefijo(capa);
      for (const subcapa of subpila) {
        if (subcapa.route === undefined) continue;
        const ruta = subcapa.route.path === "/" ? prefijo : `${prefijo}${subcapa.route.path}`;
        for (const metodo of metodosDe(subcapa.route.methods)) {
          encontrados.push(`${metodo} ${ruta}`);
        }
      }
    }

    return encontrados;
  }

  it("el catálogo de esta prueba coincide con lo que la app monta de verdad", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    assert.deepEqual(
      descubrirEndpoints(api.app).sort(),
      CATALOGO.map(({ endpoint }) => endpoint).sort(),
      "cambió la lista de endpoints montados: agregá el nuevo al catálogo de esta prueba y decidí " +
        "explícitamente si responde sin credencial",
    );
  });

  it("los únicos endpoints que responden sin credencial son los tres esperados", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    const publicos: string[] = [];

    for (const { endpoint } of CATALOGO) {
      const { metodo, ruta } = partirEndpoint(endpoint);
      const respuesta = await fetch(`${api.url}${ruta}`, { method: metodo });
      await respuesta.text();

      // 401 (falta credencial) y 503 (credencial no configurada en el servidor)
      // son las dos formas de "acá no se entra". Cualquier otra cosa —incluido un
      // 400 por datos inválidos— significa que el endpoint atendió sin credencial.
      const protegido = respuesta.status === 401 || respuesta.status === 503;
      if (!protegido) publicos.push(endpoint);
    }

    assert.deepEqual(
      publicos.sort(),
      ["GET /api/health", "GET /api/servicios", "POST /api/mensajes"],
      "apareció (o desapareció) un endpoint que responde sin credencial",
    );
  });

  it("el catálogo declara públicos exactamente a esos tres", () => {
    assert.deepEqual(
      CATALOGO.filter(({ publico }) => publico)
        .map(({ endpoint }) => endpoint)
        .sort(),
      ["GET /api/health", "GET /api/servicios", "POST /api/mensajes"],
    );
  });
});
