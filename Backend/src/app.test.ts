import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import { describe, it } from "node:test";
import type { Express, RequestHandler } from "express";

import { crearApp } from "./app.js";
import { crearAutenticacionAdmin } from "./middlewares/autenticarAdmin.js";
import { crearLimitadorDePeticiones, MENSAJE_DEMASIADOS_INTENTOS } from "./middlewares/limitarPeticiones.js";
import type { RepositorioCitas, ResultadoBorrado } from "./repositorios/repositorioCitas.js";
import type { RepositorioMensajes } from "./repositorios/repositorioMensajes.js";
import type { EnviarConfirmacion } from "./rutas/citas.js";
import type { Cita, EstadoCita, NuevaCita } from "./tipos/cita.js";
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

/**
 * Repositorio de citas de mentira.
 *
 * Va por omisión en TODAS las pruebas, y eso no es opcional: sin él, `crearApp`
 * llamaría a `obtenerRepositorioCitas()`, que abre una conexión real a Postgres.
 * La suite dejaría de correr en cualquier máquina sin `DATABASE_URL` y, peor,
 * escribiría citas de prueba en la base de un negocio real.
 *
 * `fallar` simula la base caída, que es lo que necesitan las pruebas del 503.
 */
class RepositorioCitasFalso implements RepositorioCitas {
  readonly creadas: NuevaCita[] = [];
  fallar = false;

  private readonly citas: Cita[] = [];

  async crear(datos: NuevaCita): Promise<Cita> {
    if (this.fallar) throw new Error("base caída (simulado)");
    this.creadas.push(datos);
    const cita: Cita = {
      id: "11111111-2222-3333-4444-555555555555",
      status: "pendiente",
      creadoEn: "2026-08-10T10:00:00.000Z",
      ...datos,
    };
    this.citas.push(cita);
    return cita;
  }

  async listar(): Promise<Cita[]> {
    if (this.fallar) throw new Error("base caída (simulado)");
    return [...this.citas];
  }

  async actualizarEstado(id: string, estado: EstadoCita): Promise<Cita | null> {
    if (this.fallar) throw new Error("base caída (simulado)");
    const cita = this.citas.find((candidata) => candidata.id === id);
    if (cita === undefined) return null;
    cita.status = estado;
    return cita;
  }

  async borrar(id: string): Promise<ResultadoBorrado> {
    if (this.fallar) throw new Error("base caída (simulado)");
    const indice = this.citas.findIndex((candidata) => candidata.id === id);
    if (indice < 0) return { resultado: "no-existe" };

    const cita = this.citas[indice] as Cita;
    // La regla vive en el almacenamiento, no en la ruta: el doble la replica
    // porque si no, las pruebas dejarían de comprobar que se aplica.
    if (cita.status !== "cancelada") return { resultado: "no-cancelada", estado: cita.status };

    this.citas.splice(indice, 1);
    return { resultado: "borrada" };
  }
}

/** Cuerpo válido de una cita, para que cada prueba cambie solo lo que le importa. */
function cuerpoDeCita(cambios: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    clientName: "Cliente De Prueba",
    phone: "3166962144",
    email: "cliente@ejemplo.test",
    plate: "ABC123",
    vehicle: "Vehículos Livianos",
    service: "revision-tecnico-mecanica",
    // Lejana a propósito: una fecha fija cercana convertiría la suite en una
    // bomba de tiempo que empieza a fallar sola cuando ese día quede en el pasado.
    date: "2099-12-01",
    time: "09:00",
    payment: "Efectivo",
    ...cambios,
  };
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
  repositorioCitas?: RepositorioCitas;
  enviarConfirmacion?: EnviarConfirmacion;
}

/**
 * Espía del aviso por correo.
 *
 * Anota a quién se le habría escrito y, si se lo pide, revienta. Lo segundo es
 * lo que de verdad hay que probar: que un proveedor de correo caído no le
 * convierta al cliente una cita bien guardada en un error.
 */
function espiaDeCorreo(opciones: { falla?: boolean } = {}) {
  const destinatarios: (string | undefined)[] = [];
  const enviar: EnviarConfirmacion = async (cita) => {
    destinatarios.push(cita.email);
    if (opciones.falla === true) throw new Error("Resend no responde");
    return { enviado: true };
  };
  return { enviar, destinatarios };
}

/**
 * Espera a que el aviso por correo haya corrido.
 *
 * Sale DESPUÉS de la respuesta y sin `await`, así que cuando `fetch` resuelve
 * todavía puede no haber pasado. Se cede el turno unas cuantas veces en vez de
 * dormir un rato fijo: no hay temporizadores de por medio, solo microtareas.
 */
async function esperarAlCorreo(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise((seguir) => setImmediate(seguir));
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
    repositorioCitas = new RepositorioCitasFalso(),
    // Sin doble, cada POST de cita llamaría al envío real. Hoy ese se corta solo
    // porque en las pruebas no hay clave de Resend configurada, pero depender de
    // eso sería depender del .env de quien corra la suite.
    enviarConfirmacion = async () => ({ enviado: false }),
  } = opciones;

  const app = crearApp({
    autenticacionAdmin: crearAutenticacionAdmin(tokenAdmin),
    limitadorCredencial,
    limitadorPublico,
    repositorioMensajes,
    repositorioCitas,
    enviarConfirmacion,
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
    // Agendar es la SEGUNDA de las dos operaciones públicas que la constitución
    // autoriza. Sin esto, ningún cliente podría pedir turno.
    { endpoint: "POST /api/citas", publico: true },
    // Listar y cambiar estado mueven datos personales de todos los clientes que
    // agendaron: credencial obligatoria y fallo cerrado.
    { endpoint: "GET /api/citas", publico: false },
    { endpoint: "PATCH /api/citas/:id/estado", publico: false },
    // Borrar es la única operación irreversible del API. Credencial obligatoria,
    // y además el almacenamiento solo la deja borrar si ya está cancelada.
    { endpoint: "DELETE /api/citas/:id", publico: false },
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
      ["GET /api/health", "GET /api/servicios", "POST /api/citas", "POST /api/mensajes"].sort(),
      "apareció (o desapareció) un endpoint que responde sin credencial",
    );
  });

  it("el catálogo declara públicos exactamente a esos tres", () => {
    assert.deepEqual(
      CATALOGO.filter(({ publico }) => publico)
        .map(({ endpoint }) => endpoint)
        .sort(),
      ["GET /api/health", "GET /api/servicios", "POST /api/citas", "POST /api/mensajes"].sort(),
    );
  });
});

describe("POST /api/citas", () => {
  it("registra la cita y devuelve 201 con id, estado y nombre del servicio puestos por el servidor", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoDeCita()),
    });

    assert.equal(respuesta.status, 201);
    const cuerpo = (await respuesta.json()) as Record<string, unknown>;

    assert.equal(cuerpo["status"], "pendiente", "toda cita nace pendiente");
    assert.ok(typeof cuerpo["id"] === "string" && cuerpo["id"].length > 0);
    assert.equal(cuerpo["service"], "revision-tecnico-mecanica");
    assert.equal(cuerpo["serviceName"], "Revisión Técnico-Mecánica");
  });

  it("descarta id, status y serviceName si el cliente los manda", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        cuerpoDeCita({ id: "INVENTADO", status: "atendida", serviceName: "Cambio de aceite gratis" }),
      ),
    });

    assert.equal(respuesta.status, 201);
    const cuerpo = (await respuesta.json()) as Record<string, unknown>;

    assert.notEqual(cuerpo["id"], "INVENTADO");
    assert.equal(cuerpo["status"], "pendiente", "el cliente no elige el estado de su propia cita");
    assert.equal(
      cuerpo["serviceName"],
      "Revisión Técnico-Mecánica",
      "el nombre del servicio sale del catálogo: es el registro de lo que se le prometió al cliente",
    );
  });

  it("avisa por correo únicamente a la dirección que escribió ese cliente", async (t) => {
    const correo = espiaDeCorreo();
    const api = await levantarApi({ enviarConfirmacion: correo.enviar });
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoDeCita({ email: "cliente@ejemplo.com" })),
    });
    assert.equal(respuesta.status, 201);
    await esperarAlCorreo();

    assert.deepEqual(
      correo.destinatarios,
      ["cliente@ejemplo.com"],
      "un correo, un destinatario: el que agendó y nadie más (FR-027)",
    );
  });

  it("no intenta ningún envío si el cliente no dejó correo", async (t) => {
    const correo = espiaDeCorreo();
    const api = await levantarApi({ enviarConfirmacion: correo.enviar });
    t.after(() => api.cerrar());

    const cuerpo = cuerpoDeCita();
    delete (cuerpo as Record<string, unknown>)["email"];

    const respuesta = await fetch(`${api.url}/api/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    assert.equal(respuesta.status, 201, "el correo es opcional: sin él la cita se registra igual (FR-024)");
    await esperarAlCorreo();

    assert.equal(correo.destinatarios[0], undefined, "sin dirección no hay a quién escribirle");
  });

  it("registra la cita aunque el envío del correo reviente (FR-025)", async (t) => {
    const correo = espiaDeCorreo({ falla: true });
    const api = await levantarApi({ enviarConfirmacion: correo.enviar });
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoDeCita({ email: "cliente@ejemplo.com" })),
    });

    // Es LA prueba de esta historia. El envío va después del `res` y sin await
    // justo para esto: un proveedor de correo caído no puede convertir una cita
    // perfectamente guardada en un error para el cliente.
    assert.equal(respuesta.status, 201);
    const cuerpo = (await respuesta.json()) as Record<string, unknown>;
    assert.equal(cuerpo["status"], "pendiente");
    assert.ok(typeof cuerpo["id"] === "string" && cuerpo["id"].length > 0);

    // Y el rechazo tiene que quedar atrapado: sin el .catch del handler, una
    // promesa rechazada sin manejar tumba el proceso de Node.
    await esperarAlCorreo();
    assert.deepEqual(correo.destinatarios, ["cliente@ejemplo.com"], "se intentó, y falló sin llevarse nada puesto");
  });

  it("rechaza un servicio que no está en el catálogo, aunque el navegador lo haya dejado pasar", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoDeCita({ service: "cambio-de-aceite" })),
    });

    assert.equal(respuesta.status, 400);
    const cuerpo = (await respuesta.json()) as { detalles?: { campo: string }[] };
    assert.ok(cuerpo.detalles?.some((detalle) => detalle.campo === "service"));
  });

  it("rechaza blindaje para una moto: la regla de exclusión también se aplica en el servidor", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoDeCita({ service: "certificado-de-blindaje", vehicle: "Motos 4T" })),
    });

    assert.equal(respuesta.status, 400);
  });

  it("rechaza una fecha anterior a hoy", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoDeCita({ date: "2020-01-01" })),
    });

    assert.equal(respuesta.status, 400);
  });

  it("acepta una cita sin correo: es el único campo opcional", async (t) => {
    const citas = new RepositorioCitasFalso();
    const api = await levantarApi({ repositorioCitas: citas });
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoDeCita({ email: "" })),
    });

    assert.equal(respuesta.status, 201);
    assert.equal(citas.creadas[0]?.email, undefined, "sin correo no se guarda una cadena vacía");
  });

  it("responde 503 y NO filtra nada del almacenamiento cuando la base no responde", async (t) => {
    const citas = new RepositorioCitasFalso();
    citas.fallar = true;
    const api = await levantarApi({ repositorioCitas: citas });
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoDeCita()),
    });

    assert.equal(respuesta.status, 503, "la cita NO quedó registrada: el cliente tiene que enterarse");
    const cuerpo = (await respuesta.json()) as { error: string };

    assert.match(cuerpo.error, /WhatsApp/);
    // El texto es para el cliente, no para quien depura (FR-017).
    for (const filtracion of ["postgres", "base caída", "Error:", "at "]) {
      assert.ok(!cuerpo.error.includes(filtracion), `el mensaje no debe incluir '${filtracion}'`);
    }
  });
});

describe("GET /api/citas", () => {
  it("exige credencial y no filtra ningún dato sin ella", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/citas`);

    assert.equal(respuesta.status, 401);
    const cuerpo = await respuesta.text();
    assert.ok(!cuerpo.includes("clientName"), "un 401 no puede insinuar la forma de la respuesta");
  });

  it("rechaza una credencial incorrecta", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/citas`, {
      headers: { Authorization: CREDENCIAL_INCORRECTA },
    });

    assert.equal(respuesta.status, 401);
  });

  it("con credencial devuelve las citas y prohíbe el caché", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/citas`, {
      headers: { Authorization: `Bearer ${TOKEN_DE_PRUEBA}` },
    });

    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.headers.get("cache-control"), "no-store");
    const cuerpo = (await respuesta.json()) as { citas: unknown[] };
    assert.ok(Array.isArray(cuerpo.citas));
  });

  it("responde 503 con la base caída, para que el panel no lo lea como 'no hay citas'", async (t) => {
    const citas = new RepositorioCitasFalso();
    citas.fallar = true;
    const api = await levantarApi({ repositorioCitas: citas });
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/citas`, {
      headers: { Authorization: `Bearer ${TOKEN_DE_PRUEBA}` },
    });

    // La distinción es todo el punto de FR-010: una lista vacía diría "nadie
    // agendó" cuando la verdad es "no pudimos preguntar".
    assert.equal(respuesta.status, 503);
  });
});

describe("PATCH /api/citas/:id/estado", () => {
  /** Registra una cita y devuelve su id, para las pruebas que necesitan una. */
  async function citaRegistrada(url: string): Promise<string> {
    const respuesta = await fetch(`${url}/api/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoDeCita()),
    });
    const cuerpo = (await respuesta.json()) as { id: string };
    return cuerpo.id;
  }

  it("exige credencial", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());
    const id = await citaRegistrada(api.url);

    const respuesta = await fetch(`${api.url}/api/citas/${id}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "atendida" }),
    });

    assert.equal(respuesta.status, 401);
  });

  it("cambia el estado y devuelve la cita como QUEDÓ", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());
    const id = await citaRegistrada(api.url);

    const respuesta = await fetch(`${api.url}/api/citas/${id}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN_DE_PRUEBA}` },
      body: JSON.stringify({ status: "atendida" }),
    });

    assert.equal(respuesta.status, 200);
    const cuerpo = (await respuesta.json()) as { status: string };
    assert.equal(cuerpo.status, "atendida");
  });

  it("rechaza un estado que no existe", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());
    const id = await citaRegistrada(api.url);

    const respuesta = await fetch(`${api.url}/api/citas/${id}/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN_DE_PRUEBA}` },
      body: JSON.stringify({ status: "lista" }),
    });

    assert.equal(respuesta.status, 400);
  });

  it("responde 404 si la cita no existe", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/citas/99999999-8888-7777-6666-555555555555/estado`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN_DE_PRUEBA}` },
      body: JSON.stringify({ status: "atendida" }),
    });

    assert.equal(respuesta.status, 404);
  });
});

/**
 * EL CAMPO TRAMPA de los dos formularios públicos.
 *
 * La prueba que más importa acá NO es la que comprueba que atrapa un bot: es la
 * del campo VACÍO. Un formulario HTML manda `sitio_web=""` en todos los envíos
 * legítimos, así que si la comprobación tratara la cadena vacía como sospechosa,
 * el CDA se quedaría sin agendamiento y sin contacto de un solo golpe — y el
 * síntoma sería "no funciona nada", sin ninguna pista de por qué.
 */
describe("Campo trampa", () => {
  const RUTAS = [
    {
      nombre: "POST /api/citas",
      ruta: "/api/citas",
      cuerpo: (extra: Record<string, unknown>) => ({ ...cuerpoDeCita(), ...extra }),
    },
    {
      nombre: "POST /api/mensajes",
      ruta: "/api/mensajes",
      cuerpo: (extra: Record<string, unknown>) => ({
        name: "Ana Pérez",
        email: "ana@ejemplo.com",
        message: "Quiero saber los horarios de atención.",
        ...extra,
      }),
    },
  ] as const;

  async function enviar(url: string, ruta: string, cuerpo: unknown): Promise<Response> {
    return fetch(`${url}${ruta}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
  }

  for (const caso of RUTAS) {
    it(`${caso.nombre}: descarta el envío si el campo trampa viene lleno`, async (t) => {
      const api = await levantarApi();
      t.after(() => api.cerrar());

      const respuesta = await enviar(api.url, caso.ruta, caso.cuerpo({ sitio_web: "http://spam.example" }));

      assert.equal(respuesta.status, 400);
      const cuerpo = (await respuesta.json()) as Record<string, unknown>;
      // Nunca un éxito fingido: quien caiga por error tiene que enterarse, no
      // llevarse una confirmación de algo que no se guardó.
      assert.equal(cuerpo["id"], undefined, "no se devuelve id: no se creó nada");
      assert.match(String(cuerpo["error"] ?? ""), /Recarga la página/);
    });

    it(`${caso.nombre}: deja pasar el campo trampa VACÍO, que es lo que manda un navegador`, async (t) => {
      const api = await levantarApi();
      t.after(() => api.cerrar());

      const respuesta = await enviar(api.url, caso.ruta, caso.cuerpo({ sitio_web: "" }));

      assert.equal(respuesta.status, 201, "un formulario real siempre manda el campo vacío");
    });

    it(`${caso.nombre}: deja pasar el campo trampa con solo espacios`, async (t) => {
      const api = await levantarApi();
      t.after(() => api.cerrar());

      // En la duda se deja pasar: un falso negativo cuesta un mensaje de spam, un
      // falso positivo cuesta un cliente.
      const respuesta = await enviar(api.url, caso.ruta, caso.cuerpo({ sitio_web: "   " }));

      assert.equal(respuesta.status, 201);
    });

    it(`${caso.nombre}: deja pasar si el campo trampa no viene`, async (t) => {
      const api = await levantarApi();
      t.after(() => api.cerrar());

      const respuesta = await enviar(api.url, caso.ruta, caso.cuerpo({}));

      assert.equal(respuesta.status, 201);
    });
  }

  it("no confunde la trampa con un error de validación normal", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    // Los dos responden 400, y tienen que responder cosas distintas: si la trampa
    // se comiera todo, este caso también traería su mensaje en vez de los detalles
    // campo por campo.
    const porTrampa = await enviar(api.url, "/api/citas", { ...cuerpoDeCita(), sitio_web: "x" });
    const porServicio = await enviar(api.url, "/api/citas", cuerpoDeCita({ service: "cambio-de-aceite" }));

    assert.equal(porTrampa.status, 400);
    assert.equal(porServicio.status, 400);

    const trampa = (await porTrampa.json()) as { detalles?: unknown };
    const servicio = (await porServicio.json()) as { detalles?: { campo: string }[] };

    assert.equal(trampa.detalles, undefined);
    assert.ok(servicio.detalles?.some((detalle) => detalle.campo === "service"));
  });
});

describe("DELETE /api/citas/:id", () => {
  const CREDENCIAL = { Authorization: `Bearer ${TOKEN_DE_PRUEBA}` };

  /** Registra una cita y opcionalmente la deja en el estado que se pida. */
  async function citaRegistrada(url: string, estado?: EstadoCita): Promise<string> {
    const creada = await fetch(`${url}/api/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoDeCita()),
    });
    const { id } = (await creada.json()) as { id: string };

    if (estado !== undefined) {
      await fetch(`${url}/api/citas/${id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...CREDENCIAL },
        body: JSON.stringify({ status: estado }),
      });
    }
    return id;
  }

  async function listar(url: string): Promise<{ id: string }[]> {
    const respuesta = await fetch(`${url}/api/citas`, { headers: CREDENCIAL });
    const cuerpo = (await respuesta.json()) as { citas: { id: string }[] };
    return cuerpo.citas;
  }

  it("exige credencial", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());
    const id = await citaRegistrada(api.url, "cancelada");

    const respuesta = await fetch(`${api.url}/api/citas/${id}`, { method: "DELETE" });

    assert.equal(respuesta.status, 401);
    assert.equal((await listar(api.url)).length, 1, "un intento sin credencial no borra nada");
  });

  it("borra una cita cancelada y deja de listarla", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());
    const id = await citaRegistrada(api.url, "cancelada");

    const respuesta = await fetch(`${api.url}/api/citas/${id}`, { method: "DELETE", headers: CREDENCIAL });

    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.headers.get("cache-control"), "no-store");
    assert.deepEqual(await listar(api.url), [], "borrar es definitivo: la fila ya no está");
  });

  it("no devuelve los datos personales de la cita que acaba de borrar", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());
    const id = await citaRegistrada(api.url, "cancelada");

    const respuesta = await fetch(`${api.url}/api/citas/${id}`, { method: "DELETE", headers: CREDENCIAL });
    const cuerpo = (await respuesta.json()) as Record<string, unknown>;

    // Repartir los datos de alguien justo cuando se acaba de pedir eliminarlos
    // sería exactamente lo contrario de lo que la operación significa.
    for (const campo of ["clientName", "phone", "email", "plate", "cedula"]) {
      assert.equal(cuerpo[campo], undefined, `la respuesta no puede traer '${campo}'`);
    }
    assert.equal(cuerpo["id"], id);
  });

  it("responde 409 y NO borra si la cita todavía está pendiente", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());
    const id = await citaRegistrada(api.url);

    const respuesta = await fetch(`${api.url}/api/citas/${id}`, { method: "DELETE", headers: CREDENCIAL });

    // Es la garantía de los dos pasos: un clic mal dado en la fila equivocada no
    // puede evaporar la cita que alguien reservó para mañana.
    assert.equal(respuesta.status, 409);
    const cuerpo = (await respuesta.json()) as { error?: string };
    assert.match(cuerpo.error ?? "", /cancelad/i, "el mensaje tiene que decir qué hacer");
    assert.equal((await listar(api.url)).length, 1, "sigue ahí");
  });

  it("responde 409 y NO borra si la cita ya fue atendida", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());
    const id = await citaRegistrada(api.url, "atendida");

    const respuesta = await fetch(`${api.url}/api/citas/${id}`, { method: "DELETE", headers: CREDENCIAL });

    assert.equal(respuesta.status, 409);
    assert.equal((await listar(api.url)).length, 1, "una cita atendida es historia del negocio");
  });

  it("responde 404 si la cita no existe", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/citas/99999999-8888-7777-6666-555555555555`, {
      method: "DELETE",
      headers: CREDENCIAL,
    });

    assert.equal(respuesta.status, 404);
  });

  it("responde 503 con la base caída, y no dice que borró nada", async (t) => {
    const citas = new RepositorioCitasFalso();
    const api = await levantarApi({ repositorioCitas: citas });
    t.after(() => api.cerrar());
    const id = await citaRegistrada(api.url, "cancelada");

    citas.fallar = true;
    const respuesta = await fetch(`${api.url}/api/citas/${id}`, { method: "DELETE", headers: CREDENCIAL });

    assert.equal(respuesta.status, 503);
  });
});
