import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import { describe, it } from "node:test";
import type { Express, RequestHandler } from "express";

import { crearApp } from "./app.js";
import { crearAutenticacionAdmin } from "./middlewares/autenticarAdmin.js";
import { crearLimitadorDePeticiones, MENSAJE_DEMASIADOS_INTENTOS } from "./middlewares/limitarPeticiones.js";
import type {
  EstadoDelComprobante,
  RepositorioCitas,
  ResultadoBorrado,
  ResultadoComprobante,
  ResultadoCreacion,
} from "./repositorios/repositorioCitas.js";
import type { CupoDeFranja } from "./tipos/franja.js";
import { TIPOS_VEHICULO } from "./tipos/servicio.js";
import { CUPOS_POR_FRANJA, FRANJAS } from "./tipos/franja.js";
import type { RepositorioMensajes } from "./repositorios/repositorioMensajes.js";
import type { RepositorioServicios } from "./repositorios/repositorioServicios.js";
import type { AvisarCitaNueva, AvisarComprobante, EnviarConfirmacion } from "./rutas/citas.js";
import type { AvisarMensaje } from "./rutas/mensajes.js";
import type { Cita, EstadoCita, NuevaCita, ResumenCitas, ResumenDeUnDia } from "./tipos/cita.js";
import type { EstadoPago } from "./tipos/pago.js";
import { estadoPagoInicial, MEDIOS_DE_PAGO } from "./tipos/pago.js";
import type { FiltroMensajes, Mensaje, NuevoMensaje } from "./tipos/mensaje.js";
import type { Servicio } from "./tipos/servicio.js";
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
  /** Ruta del comprobante por id de cita. Fuera de `Cita` igual que en la base. */
  private readonly rutas = new Map<string, string>();

  async crear(datos: NuevaCita): Promise<ResultadoCreacion> {
    if (this.fallar) throw new Error("base caída (simulado)");

    // El tope de cupos (FR-028) vive en el almacenamiento, así que el doble lo
    // replica. Mismo criterio que con "solo se borran las canceladas": si el
    // doble no aplicara la regla, las pruebas de la ruta pasarían en verde sin
    // comprobar nada.
    const ocupados = this.citas.filter(
      (candidata) =>
        candidata.date === datos.date && candidata.time === datos.time && candidata.status !== "cancelada",
    ).length;
    if (ocupados >= CUPOS_POR_FRANJA) return { resultado: "franja-llena", ocupados };

    this.creadas.push(datos);
    const cita: Cita = {
      // Un id distinto por cita: con uno fijo, dos citas de la misma prueba
      // serían indistinguibles para actualizarEstado() y borrar().
      id: `11111111-2222-3333-4444-${String(this.citas.length).padStart(12, "0")}`,
      status: "pendiente",
      creadoEn: "2026-08-10T10:00:00.000Z",
      ...datos,
      // Derivado del medio de pago, igual que en el repositorio de verdad. Si el
      // doble lo pusiera fijo, las pruebas de "pagar en línea deja la cita
      // pendiente de comprobante" pasarían sin comprobar nada.
      pagoEstado: estadoPagoInicial(datos.payment),
    };
    this.citas.push(cita);
    return { resultado: "creada", cita };
  }

  async disponibilidad(fecha: string): Promise<CupoDeFranja[]> {
    if (this.fallar) throw new Error("base caída (simulado)");
    return FRANJAS.map((hora) => {
      const ocupados = this.citas.filter(
        (cita) => cita.date === fecha && cita.time === hora && cita.status !== "cancelada",
      ).length;
      return { hora, ocupados, disponibles: Math.max(0, CUPOS_POR_FRANJA - ocupados) };
    });
  }

  async resumen(desde: string, hasta: string): Promise<ResumenCitas> {
    if (this.fallar) throw new Error("base caída (simulado)");

    const enRango = this.citas.filter((cita) => cita.date >= desde && cita.date <= hasta);
    const porEstado: Record<EstadoCita, number> = { pendiente: 0, atendida: 0, cancelada: 0 };
    const porVehiculo: Record<string, number> = {};
    for (const tipo of TIPOS_VEHICULO) porVehiculo[tipo] = 0;
    const porServicio: Record<string, number> = {};

    const dias = new Map<string, ResumenDeUnDia>();
    for (const cita of enRango) {
      porEstado[cita.status] += 1;
      porVehiculo[cita.vehicle] = (porVehiculo[cita.vehicle] ?? 0) + 1;
      porServicio[cita.serviceName] = (porServicio[cita.serviceName] ?? 0) + 1;

      const dia = dias.get(cita.date) ?? {
        fecha: cita.date,
        total: 0,
        pendientes: 0,
        atendidas: 0,
        canceladas: 0,
      };
      dia.total += 1;
      if (cita.status === "pendiente") dia.pendientes += 1;
      if (cita.status === "atendida") dia.atendidas += 1;
      if (cita.status === "cancelada") dia.canceladas += 1;
      dias.set(cita.date, dia);
    }

    return {
      desde,
      hasta,
      total: enRango.length,
      porEstado,
      porVehiculo,
      porServicio,
      porDia: [...dias.values()].sort((uno, otro) => uno.fecha.localeCompare(otro.fecha)),
      vehiculosUnicos: new Set(enRango.map((cita) => cita.plate)).size,
      cuposPorDia: FRANJAS.length * CUPOS_POR_FRANJA,
    };
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

  async adjuntarComprobante(id: string, ruta: string, tipo: string): Promise<ResultadoComprobante> {
    if (this.fallar) throw new Error("base caída (simulado)");
    const cita = this.citas.find((candidata) => candidata.id === id);
    if (cita === undefined) return { resultado: "no-existe" };
    // "Un solo disparo" es regla del almacenamiento; el doble la replica.
    if (this.rutas.has(id)) return { resultado: "ya-tiene" };

    this.rutas.set(id, ruta);
    cita.comprobante = { subidoEn: "2026-08-10T11:00:00.000Z", tipo };
    cita.pagoEstado = "por-verificar";
    return { resultado: "adjuntado", cita };
  }

  async cambiarEstadoDePago(id: string, estado: EstadoPago): Promise<Cita | null> {
    if (this.fallar) throw new Error("base caída (simulado)");
    const cita = this.citas.find((candidata) => candidata.id === id);
    if (cita === undefined) return null;
    cita.pagoEstado = estado;
    return cita;
  }

  async estadoDelComprobante(id: string): Promise<EstadoDelComprobante> {
    if (this.fallar) throw new Error("base caída (simulado)");
    if (!this.citas.some((candidata) => candidata.id === id)) return { existe: false };
    return { existe: true, ruta: this.rutas.get(id) ?? null };
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
  /**
   * Catálogo con el que se levanta el API. Por omisión, el real.
   *
   * Se puede reemplazar para probar la regla de exclusión de FR-010 sin atarla a
   * que el catálogo real tenga alguna: hoy no tiene ninguna, y sin este doble esa
   * prueba pasaría por la razón equivocada —el servicio simplemente no existe—.
   */
  repositorioServicios?: RepositorioServicios;
  enviarConfirmacion?: EnviarConfirmacion;
  avisarCitaNueva?: AvisarCitaNueva;
  avisarComprobante?: AvisarComprobante;
  avisarMensaje?: AvisarMensaje;
}

/**
 * Catálogo de prueba con UNA exclusión, para ejercitar FR-010.
 *
 * No usa ningún servicio real a propósito: si mañana el CDA vuelve a ofrecer
 * algo que no aplique a las motos, esta prueba no tiene que cambiar, y si no lo
 * hace nunca, la regla sigue cubierta igual.
 */
class RepositorioServiciosConExclusion implements RepositorioServicios {
  private readonly catalogo: Servicio[] = [
    { id: "servicio-sin-motos", nombre: "Servicio Que No Aplica A Motos", vehiculosExcluidos: ["Motos 4T"] },
  ];

  async listar(): Promise<Servicio[]> {
    return this.catalogo.map((servicio) => ({ ...servicio, vehiculosExcluidos: [...servicio.vehiculosExcluidos] }));
  }

  async obtenerPorId(id: string): Promise<Servicio | null> {
    const servicio = this.catalogo.find((candidato) => candidato.id === id);
    return servicio === undefined ? null : { ...servicio, vehiculosExcluidos: [...servicio.vehiculosExcluidos] };
  }
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
    repositorioServicios,
    // Sin doble, cada POST de cita llamaría al envío real. Hoy ese se corta solo
    // porque en las pruebas no hay clave de Resend configurada, pero depender de
    // eso sería depender del .env de quien corra la suite.
    enviarConfirmacion = async () => ({ enviado: false }),
    // Mismo motivo que el aviso al cliente: sin doble, cada POST llamaría al
    // envío real. Hoy ese se corta solo porque no hay clave de Resend en las
    // pruebas, pero depender de eso sería depender del .env de quien las corra.
    avisarCitaNueva = async () => ({ enviado: false }),
    avisarComprobante = async () => ({ enviado: false }),
    avisarMensaje = async () => ({ enviado: false }),
  } = opciones;

  const app = crearApp({
    autenticacionAdmin: crearAutenticacionAdmin(tokenAdmin),
    limitadorCredencial,
    limitadorPublico,
    repositorioMensajes,
    repositorioCitas,
    // Solo se inyecta si la prueba lo pidio: sin esto, crearApp usa el real.
    ...(repositorioServicios ? { repositorioServicios } : {}),
    enviarConfirmacion,
    avisarCitaNueva,
    avisarComprobante,
    avisarMensaje,
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
 * Por eso la lista tiene más de dos. Y por eso la prueba falla si aparece uno
 * más: la próxima vez que alguien monte un endpoint, tiene que pasar por acá y
 * decidir explícitamente si es público, en vez de que quede abierto por descuido.
 * Ya pasó una vez —la subida de comprobantes— y funcionó: obligó a escribir por
 * qué esa ruta puede ir sin credencial y qué la acota en su lugar.
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
    // Consultar cupos es la TERCERA operación pública, y se agregó con el tope
    // de FR-028: sin ella el formulario ofrecería franjas llenas y el cliente se
    // enteraría al enviar. Solo devuelve horas y conteos —ni un nombre, ni una
    // placa—, que es lo que la hace publicable.
    { endpoint: "GET /api/citas/disponibilidad", publico: true },
    // Listar y cambiar estado mueven datos personales de todos los clientes que
    // agendaron: credencial obligatoria y fallo cerrado.
    { endpoint: "GET /api/citas", publico: false },
    // El resumen de Reportes no devuelve ni un dato personal, y aun así lleva
    // credencial: cuánto trabajo tiene el CDA y qué días están flojos es
    // información del negocio.
    { endpoint: "GET /api/citas/resumen", publico: false },
    { endpoint: "PATCH /api/citas/:id/estado", publico: false },
    // Borrar es la única operación irreversible del API. Credencial obligatoria,
    // y además el almacenamiento solo la deja borrar si ya está cancelada.
    { endpoint: "DELETE /api/citas/:id", publico: false },
    /*
     * Subir el comprobante de pago es PÚBLICO, y es la decisión que más se pensó
     * de esta lista.
     *
     * Va sin credencial porque quien sube es el cliente que acaba de agendar: es
     * anónimo, no tiene cuenta, y adjunta el archivo en el mismo envío del
     * formulario. Exigirle credencial sería exigirle una cuenta.
     *
     * Sigue respetando FR-006 porque NO LEE ningún dato personal: recibe un
     * archivo y responde con el id y el estado del pago. Para leer el
     * comprobante hay que pasar por el GET de abajo, que sí lleva credencial.
     *
     * Lo que lo acota, ya que no hay credencial: hace falta el UUID v4 de la
     * cita (122 bits que solo tiene quien recibió el 201), es de un solo disparo
     * —la segunda subida da 409—, se comprueba que la cita exista antes de tocar
     * el almacenamiento, y comparte el limitador público con POST /api/citas.
     */
    { endpoint: "POST /api/citas/:id/comprobante", publico: true },
    // Ver el comprobante sí es privado: es un documento financiero con el nombre
    // y el banco de una persona. Devuelve una URL firmada que caduca en un
    // minuto, nunca un enlace permanente ni el bucket abierto.
    { endpoint: "GET /api/citas/:id/comprobante", publico: false },
    // Verificar o rechazar un pago es una decisión del CDA sobre el dinero de un
    // cliente. Credencial obligatoria.
    { endpoint: "PATCH /api/citas/:id/pago", publico: false },
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

  /*
   * La subida de comprobantes queda FUERA de este sondeo, y no por comodidad.
   *
   * El sondeo deduce "protegido" de un 401 o un 503. Esa ruta responde 503
   * cuando el almacenamiento no está configurado —que es su estado en las
   * pruebas— así que el sondeo la leería como protegida por un motivo que no
   * tiene nada que ver con la credencial. Sería un verde que no significa nada, y
   * peor: se pondría rojo el día que alguien configure el almacenamiento en un
   * entorno de pruebas, sin que nada haya cambiado de verdad.
   *
   * Que es pública está declarado en el CATALOGO y lo comprueba la prueba de
   * abajo. Que lo que la acota funciona (404 sin cita, 409 al segundo intento)
   * lo comprueban las pruebas del comprobante.
   */
  const FUERA_DEL_SONDEO: readonly string[] = ["POST /api/citas/:id/comprobante"];

  it("los únicos endpoints que responden sin credencial son los esperados", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    const publicos: string[] = [];

    for (const { endpoint } of CATALOGO) {
      if (FUERA_DEL_SONDEO.includes(endpoint)) continue;
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
      [
        "GET /api/citas/disponibilidad",
        "GET /api/health",
        "GET /api/servicios",
        "POST /api/citas",
        "POST /api/mensajes",
      ].sort(),
      "apareció (o desapareció) un endpoint que responde sin credencial",
    );
  });

  it("el catálogo declara públicos exactamente a los esperados", () => {
    assert.deepEqual(
      CATALOGO.filter(({ publico }) => publico)
        .map(({ endpoint }) => endpoint)
        .sort(),
      [
        "GET /api/citas/disponibilidad",
        "GET /api/health",
        "GET /api/servicios",
        "POST /api/citas",
        // Subir el comprobante: pública porque quien sube es el cliente anónimo
        // que acaba de agendar. No lee ningún dato personal; ver el CATALOGO.
        "POST /api/citas/:id/comprobante",
        "POST /api/mensajes",
      ].sort(),
    );
  });
});

describe("FR-028 — cupo de cuatro vehículos por franja", () => {
  /** Agenda una cita y devuelve la respuesta cruda, para poder contar estados. */
  async function agendar(api: { url: string }, cambios: Record<string, unknown> = {}) {
    return await fetch(`${api.url}/api/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoDeCita(cambios)),
    });
  }

  it("acepta cuatro vehículos en una franja y rechaza el quinto con 409", async (t) => {
    const citas = new RepositorioCitasFalso();
    const api = await levantarApi({ repositorioCitas: citas });
    t.after(() => api.cerrar());

    for (let numero = 1; numero <= CUPOS_POR_FRANJA; numero += 1) {
      const respuesta = await agendar(api, { plate: `ABC12${numero}` });
      assert.equal(respuesta.status, 201, `el vehículo ${numero} tenía que caber`);
      await respuesta.text();
    }

    const quinta = await agendar(api, { plate: "XYZ999" });
    assert.equal(quinta.status, 409, "el quinto vehículo no cabe en la franja");

    const cuerpo = (await quinta.json()) as Record<string, unknown>;
    assert.match(
      JSON.stringify(cuerpo),
      /se llenó|otra hora/i,
      "el mensaje tiene que decir qué pasó y qué hacer, no 'error al agendar'",
    );
  });

  it("el tope es POR FRANJA: llenar las 9:00 no impide agendar a las 10:00", async (t) => {
    const citas = new RepositorioCitasFalso();
    const api = await levantarApi({ repositorioCitas: citas });
    t.after(() => api.cerrar());

    for (let numero = 1; numero <= CUPOS_POR_FRANJA; numero += 1) {
      await (await agendar(api, { time: "09:00", plate: `ABC12${numero}` })).text();
    }

    const otraFranja = await agendar(api, { time: "10:00", plate: "OTR123" });
    assert.equal(otraFranja.status, 201);
    await otraFranja.text();
  });

  it("el tope es POR DÍA: llenar el lunes no impide agendar el martes a la misma hora", async (t) => {
    const citas = new RepositorioCitasFalso();
    const api = await levantarApi({ repositorioCitas: citas });
    t.after(() => api.cerrar());

    for (let numero = 1; numero <= CUPOS_POR_FRANJA; numero += 1) {
      await (await agendar(api, { date: "2099-12-01", plate: `ABC12${numero}` })).text();
    }

    const otroDia = await agendar(api, { date: "2099-12-02", plate: "OTR123" });
    assert.equal(otroDia.status, 201);
    await otroDia.text();
  });

  it("los cuatro cupos son para TODOS los vehículos juntos, no cuatro por tipo", async (t) => {
    const citas = new RepositorioCitasFalso();
    const api = await levantarApi({ repositorioCitas: citas });
    t.after(() => api.cerrar());

    // Cuatro motos llenan la franja, y un liviano después ya no entra. El
    // propietario confirmó que los cupos NO se separan por tipo de vehículo, y
    // esta es la prueba que lo fija: sin ella, alguien podría "arreglar" el
    // conteo agrupando por vehículo sin que nada se ponga rojo.
    for (let numero = 1; numero <= CUPOS_POR_FRANJA; numero += 1) {
      await (await agendar(api, { vehicle: "Motos 2T", plate: `MOT12${numero}` })).text();
    }

    const liviano = await agendar(api, { vehicle: "Vehículos Livianos", plate: "LIV123" });
    assert.equal(liviano.status, 409);
    await liviano.text();
  });

  it("cancelar una cita libera su cupo", async (t) => {
    const citas = new RepositorioCitasFalso();
    const api = await levantarApi({ repositorioCitas: citas });
    t.after(() => api.cerrar());

    const ids: string[] = [];
    for (let numero = 1; numero <= CUPOS_POR_FRANJA; numero += 1) {
      const respuesta = await agendar(api, { plate: `ABC12${numero}` });
      const cuerpo = (await respuesta.json()) as Record<string, unknown>;
      ids.push(String(cuerpo["id"]));
    }

    assert.equal((await agendar(api, { plate: "LLE123" })).status, 409);

    await citas.actualizarEstado(ids[0] as string, "cancelada");

    const despues = await agendar(api, { plate: "NUE123" });
    assert.equal(despues.status, 201, "una cita cancelada devuelve su lugar a la franja");
    await despues.text();
  });

  it("una cita ATENDIDA no libera cupo: esa ya ocurrió", async (t) => {
    const citas = new RepositorioCitasFalso();
    const api = await levantarApi({ repositorioCitas: citas });
    t.after(() => api.cerrar());

    const ids: string[] = [];
    for (let numero = 1; numero <= CUPOS_POR_FRANJA; numero += 1) {
      const respuesta = await agendar(api, { plate: `ABC12${numero}` });
      const cuerpo = (await respuesta.json()) as Record<string, unknown>;
      ids.push(String(cuerpo["id"]));
    }

    await citas.actualizarEstado(ids[0] as string, "atendida");

    const despues = await agendar(api, { plate: "NUE123" });
    assert.equal(despues.status, 409);
    await despues.text();
  });

  it("rechaza una hora bien formada que no es franja de atención", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    // Este es EL envío que esquivaría el tope si solo se validara el formato:
    // '09:07' es un 'HH:MM' perfecto, y contando por (fecha, hora) abriría una
    // franja nueva y vacía.
    const respuesta = await agendar(api, { time: "09:07" });
    assert.equal(respuesta.status, 400);

    const cuerpo = (await respuesta.json()) as Record<string, unknown>;
    assert.match(JSON.stringify(cuerpo), /franjas de atención/i);
  });

  it("rechaza una hora fuera del horario de atención", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    const respuesta = await agendar(api, { time: "23:00" });
    assert.equal(respuesta.status, 400);
    await respuesta.text();
  });
});

describe("GET /api/citas/resumen", () => {
  /** Agenda `cuantas` citas en una fecha, con el estado y vehículo pedidos. */
  async function sembrar(api: { url: string }, citas: Record<string, unknown>[]) {
    const ids: string[] = [];
    for (const cambios of citas) {
      const respuesta = await fetch(`${api.url}/api/citas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpoDeCita(cambios)),
      });
      const cuerpo = (await respuesta.json()) as Record<string, unknown>;
      ids.push(String(cuerpo["id"]));
    }
    return ids;
  }

  it("exige credencial: es información del negocio", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/citas/resumen?desde=2099-12-01&hasta=2099-12-31`);
    await respuesta.text();
    assert.ok(respuesta.status === 401 || respuesta.status === 503);
  });

  it("cuenta por estado, por vehículo y por día", async (t) => {
    const citas = new RepositorioCitasFalso();
    const api = await levantarApi({ repositorioCitas: citas });
    t.after(() => api.cerrar());

    const ids = await sembrar(api, [
      { date: "2099-12-01", time: "08:00", vehicle: "Motos 2T", plate: "AAA111" },
      { date: "2099-12-01", time: "09:00", vehicle: "Motos 2T", plate: "BBB222" },
      { date: "2099-12-02", time: "08:00", vehicle: "Vehículos Livianos", plate: "CCC333" },
    ]);
    await citas.actualizarEstado(ids[0] as string, "atendida");
    await citas.actualizarEstado(ids[2] as string, "cancelada");

    const respuesta = await fetch(`${api.url}/api/citas/resumen?desde=2099-12-01&hasta=2099-12-31`, {
      headers: { Authorization: `Bearer ${TOKEN_DE_PRUEBA}` },
    });
    assert.equal(respuesta.status, 200);
    const cuerpo = (await respuesta.json()) as Record<string, unknown>;

    assert.equal(cuerpo["total"], 3);
    assert.deepEqual(cuerpo["porEstado"], { pendiente: 1, atendida: 1, cancelada: 1 });
    assert.equal((cuerpo["porVehiculo"] as Record<string, number>)["Motos 2T"], 2);
    assert.equal(cuerpo["vehiculosUnicos"], 3);

    const porDia = cuerpo["porDia"] as { fecha: string; total: number; atendidas: number }[];
    assert.equal(porDia.length, 2);
    assert.equal(porDia[0]?.fecha, "2099-12-01");
    assert.equal(porDia[0]?.total, 2);
    assert.equal(porDia[0]?.atendidas, 1);
  });

  it("los tipos de vehículo sin citas salen en CERO, no desaparecen", async (t) => {
    const citas = new RepositorioCitasFalso();
    const api = await levantarApi({ repositorioCitas: citas });
    t.after(() => api.cerrar());

    await sembrar(api, [{ date: "2099-12-01", vehicle: "Motos 2T", plate: "AAA111" }]);

    const respuesta = await fetch(`${api.url}/api/citas/resumen?desde=2099-12-01&hasta=2099-12-31`, {
      headers: { Authorization: `Bearer ${TOKEN_DE_PRUEBA}` },
    });
    const cuerpo = (await respuesta.json()) as Record<string, unknown>;
    const porVehiculo = cuerpo["porVehiculo"] as Record<string, number>;

    // Que no haya venido ninguna moto 4T es justamente lo que hay que poder ver.
    assert.equal(porVehiculo["Vehículos Livianos"], 0);
    assert.ok("Motos 4T" in porVehiculo, "un tipo sin citas no puede faltar del reporte");
  });

  it("respeta el rango: no cuenta lo que quedó afuera", async (t) => {
    const citas = new RepositorioCitasFalso();
    const api = await levantarApi({ repositorioCitas: citas });
    t.after(() => api.cerrar());

    await sembrar(api, [
      { date: "2099-12-01", plate: "AAA111" },
      { date: "2099-12-20", plate: "BBB222" },
    ]);

    const respuesta = await fetch(`${api.url}/api/citas/resumen?desde=2099-12-01&hasta=2099-12-10`, {
      headers: { Authorization: `Bearer ${TOKEN_DE_PRUEBA}` },
    });
    const cuerpo = (await respuesta.json()) as Record<string, unknown>;
    assert.equal(cuerpo["total"], 1);
  });

  it("los dos extremos del rango van INCLUIDOS", async (t) => {
    const citas = new RepositorioCitasFalso();
    const api = await levantarApi({ repositorioCitas: citas });
    t.after(() => api.cerrar());

    await sembrar(api, [
      { date: "2099-12-01", plate: "AAA111" },
      { date: "2099-12-05", plate: "BBB222" },
    ]);

    const respuesta = await fetch(`${api.url}/api/citas/resumen?desde=2099-12-01&hasta=2099-12-05`, {
      headers: { Authorization: `Bearer ${TOKEN_DE_PRUEBA}` },
    });
    const cuerpo = (await respuesta.json()) as Record<string, unknown>;
    assert.equal(cuerpo["total"], 2, "un reporte 'del 1 al 5' incluye el 1 y el 5");
  });

  it("NO devuelve ningún dato personal: solo fechas y números", async (t) => {
    const citas = new RepositorioCitasFalso();
    const api = await levantarApi({ repositorioCitas: citas });
    t.after(() => api.cerrar());

    await sembrar(api, [
      { date: "2099-12-01", clientName: "Cliente De Prueba", phone: "3166962144", plate: "AAA111" },
    ]);

    const respuesta = await fetch(`${api.url}/api/citas/resumen?desde=2099-12-01&hasta=2099-12-31`, {
      headers: { Authorization: `Bearer ${TOKEN_DE_PRUEBA}` },
    });
    const texto = await respuesta.text();

    // La razón de ser de este endpoint es contar sin repartir. Si alguien le
    // agrega "quién vino" al resumen, esta aserción lo frena.
    assert.ok(!texto.includes("Cliente De Prueba"));
    assert.ok(!texto.includes("3166962144"));
    assert.ok(!texto.includes("AAA111"));
    assert.ok(!texto.includes("cliente@ejemplo.test"));
  });

  it("rechaza un rango invertido en vez de devolver un reporte vacío", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    // Un reporte en cero se lee como "no vino nadie", que es una respuesta y no
    // un error: por eso esto tiene que fallar y no devolver ceros.
    const respuesta = await fetch(`${api.url}/api/citas/resumen?desde=2099-12-31&hasta=2099-12-01`, {
      headers: { Authorization: `Bearer ${TOKEN_DE_PRUEBA}` },
    });
    assert.equal(respuesta.status, 400);
    await respuesta.text();
  });

  it("rechaza fechas ausentes o mal formadas", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    for (const consulta of ["", "?desde=2099-12-01", "?hasta=2099-12-01", "?desde=x&hasta=y"]) {
      const respuesta = await fetch(`${api.url}/api/citas/resumen${consulta}`, {
        headers: { Authorization: `Bearer ${TOKEN_DE_PRUEBA}` },
      });
      assert.equal(respuesta.status, 400, `"${consulta}" tenía que ser rechazada`);
      await respuesta.text();
    }
  });
});

describe("GET /api/citas/disponibilidad", () => {
  it("devuelve las diez franjas aunque el día esté vacío", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/citas/disponibilidad?fecha=2099-12-01`);
    assert.equal(respuesta.status, 200);

    const cuerpo = (await respuesta.json()) as Record<string, unknown>;
    const franjas = cuerpo["franjas"] as { hora: string; ocupados: number; disponibles: number }[];

    assert.equal(franjas.length, FRANJAS.length);
    assert.deepEqual(
      franjas.map((franja) => franja.hora),
      [...FRANJAS],
      "el formulario dibuja su desplegable con esto: las franjas vacías tienen que venir igual",
    );
    assert.ok(franjas.every((franja) => franja.disponibles === CUPOS_POR_FRANJA));
  });

  it("descuenta las citas ya agendadas de su franja", async (t) => {
    const citas = new RepositorioCitasFalso();
    const api = await levantarApi({ repositorioCitas: citas });
    t.after(() => api.cerrar());

    for (let numero = 1; numero <= 3; numero += 1) {
      await (
        await fetch(`${api.url}/api/citas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cuerpoDeCita({ time: "09:00", plate: `ABC12${numero}` })),
        })
      ).text();
    }

    const respuesta = await fetch(`${api.url}/api/citas/disponibilidad?fecha=2099-12-01`);
    const cuerpo = (await respuesta.json()) as Record<string, unknown>;
    const franjas = cuerpo["franjas"] as { hora: string; ocupados: number; disponibles: number }[];

    const nueve = franjas.find((franja) => franja.hora === "09:00");
    assert.equal(nueve?.ocupados, 3);
    assert.equal(nueve?.disponibles, 1);

    const diez = franjas.find((franja) => franja.hora === "10:00");
    assert.equal(diez?.disponibles, CUPOS_POR_FRANJA, "las otras franjas no se tocan");
  });

  it("NO filtra ningún dato del cliente: solo horas y conteos", async (t) => {
    const citas = new RepositorioCitasFalso();
    const api = await levantarApi({ repositorioCitas: citas });
    t.after(() => api.cerrar());

    await (
      await fetch(`${api.url}/api/citas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpoDeCita({ clientName: "Cliente De Prueba", phone: "3166962144" })),
      })
    ).text();

    const respuesta = await fetch(`${api.url}/api/citas/disponibilidad?fecha=2099-12-01`);
    const texto = await respuesta.text();

    // Este endpoint es PÚBLICO. Si alguna vez alguien le agrega un campo de más
    // —"quién agendó", para el panel— esta aserción es la que lo frena.
    assert.ok(!texto.includes("Cliente De Prueba"), "un endpoint público no devuelve nombres");
    assert.ok(!texto.includes("3166962144"), "un endpoint público no devuelve teléfonos");
    assert.ok(!texto.includes("ABC123"), "un endpoint público no devuelve placas");
  });

  it("rechaza una fecha ausente o mal formada", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    for (const consulta of ["", "?fecha=", "?fecha=01-12-2099", "?fecha=2099-13-45"]) {
      const respuesta = await fetch(`${api.url}/api/citas/disponibilidad${consulta}`);
      assert.equal(respuesta.status, 400, `"${consulta}" tenía que ser rechazada`);
      await respuesta.text();
    }
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
    assert.equal(cuerpo["serviceName"], "Revisión Técnico-Mecánica y de Gases");
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
      "Revisión Técnico-Mecánica y de Gases",
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

  /*
   * FR-010 — La combinación servicio + vehículo se comprueba en el SERVIDOR.
   *
   * Esta prueba decía "rechaza blindaje para una moto" y usaba el catálogo real.
   * Cuando el catálogo pasó a tener un solo servicio (2026-08-21), el blindaje
   * dejó de existir y la prueba SIGUIÓ EN VERDE... por la razón equivocada: el
   * 400 ya no lo daba la regla de exclusión sino FR-005, o sea que era un
   * duplicado exacto de la prueba de acá arriba y la regla quedaba sin cubrir.
   *
   * Por eso ahora inyecta su propio catálogo con una exclusión. Así la regla se
   * prueba de verdad, y se sigue probando aunque el catálogo real no tenga
   * ninguna.
   */
  it("rechaza un servicio para un vehículo excluido: la regla también se aplica en el servidor", async (t) => {
    const api = await levantarApi({ repositorioServicios: new RepositorioServiciosConExclusion() });
    t.after(() => api.cerrar());

    const enviar = (cambios: Record<string, unknown>) =>
      fetch(`${api.url}/api/citas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpoDeCita({ service: "servicio-sin-motos", ...cambios })),
      });

    const excluido = await enviar({ vehicle: "Motos 4T" });
    assert.equal(excluido.status, 400, "una Moto 4T está excluida de ese servicio");
    const cuerpo = (await excluido.json()) as { detalles?: { campo: string }[] };
    assert.ok(
      cuerpo.detalles?.some((detalle) => detalle.campo === "service"),
      "el rechazo tiene que señalar el campo service",
    );

    // La contraparte, que es la que demuestra que el 400 lo dio la EXCLUSIÓN y no
    // que el servicio no existiera: el mismo servicio, con un vehículo permitido.
    const permitido = await enviar({ vehicle: "Vehículos Livianos" });
    assert.equal(permitido.status, 201, "el mismo servicio sí aplica a un liviano");
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

/**
 * MEDIO DE PAGO — la lista cerrada que antes no existía.
 *
 * Hasta esta funcionalidad `payment` aceptaba cualquier texto de hasta 40
 * caracteres, y eso no fue teórico: el sitio guardó citas con "PayU", una
 * pasarela que el CDA nunca tuvo, porque era el valor por omisión del
 * desplegable y el servidor no tenía con qué desmentirlo.
 */
describe("Medio de pago (lista cerrada)", () => {
  it("acepta los medios ratificados", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    for (const medio of MEDIOS_DE_PAGO) {
      const respuesta = await fetch(`${api.url}/api/citas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Un día distinto por medio: si no, la franja se llena a los cuatro.
        body: JSON.stringify(
          cuerpoDeCita({ payment: medio, date: `2099-12-0${MEDIOS_DE_PAGO.indexOf(medio) + 1}` }),
        ),
      });
      await respuesta.text();
      assert.equal(respuesta.status, 201, `'${medio}' debía aceptarse`);
    }
  });

  it("rechaza una pasarela que el CDA no tiene, y dice cuáles sí", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoDeCita({ payment: "PayU" })),
    });

    assert.equal(respuesta.status, 400);
    const cuerpo = (await respuesta.json()) as { detalles?: { campo: string; mensaje: string }[] };
    const detalle = cuerpo.detalles?.find((candidato) => candidato.campo === "payment");
    assert.ok(detalle, "debía señalar el campo payment");
    assert.match(detalle.mensaje, /Efectivo/, "el mensaje debe decir qué medios sí valen (principio V)");
  });

  it("pagar en el CDA deja el pago en 'no-aplica'", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoDeCita({ payment: "Efectivo" })),
    });

    const cita = (await respuesta.json()) as { pagoEstado: string };
    assert.equal(cita.pagoEstado, "no-aplica");
  });

  it("pagar en línea deja el pago 'pendiente' de comprobante, y la cita SÍ queda", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    for (const medio of ["QR Bancolombia", "Transferencia"]) {
      const respuesta = await fetch(`${api.url}/api/citas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpoDeCita({ payment: medio, date: medio === "Transferencia" ? "2099-12-02" : "2099-12-01" })),
      });

      assert.equal(respuesta.status, 201, "la cita se registra aunque no haya comprobante");
      const cita = (await respuesta.json()) as { pagoEstado: string };
      assert.equal(cita.pagoEstado, "pendiente", `'${medio}' debía quedar pendiente de comprobante`);
    }
  });

  it("el cliente NO puede fijar el estado del pago", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    const respuesta = await fetch(`${api.url}/api/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Si esto se colara, cualquiera agendaría un pago en línea ya verificado.
      body: JSON.stringify(cuerpoDeCita({ payment: "QR Bancolombia", pagoEstado: "verificado" })),
    });

    const cita = (await respuesta.json()) as { pagoEstado: string };
    assert.equal(cita.pagoEstado, "pendiente", "el servidor lo deriva; el cliente no lo elige");
  });
});

describe("Comprobante de pago", () => {
  /** JPEG mínimo: lo que importa son los tres bytes mágicos del principio. */
  const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 0x20)]);

  async function citaEnLinea(url: string): Promise<string> {
    const respuesta = await fetch(`${url}/api/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpoDeCita({ payment: "QR Bancolombia" })),
    });
    const cuerpo = (await respuesta.json()) as { id: string };
    return cuerpo.id;
  }

  /*
   * FALLA CERRADO. En las pruebas no hay credenciales de almacenamiento, que es
   * exactamente el estado que hay que comprobar: sin dónde guardar el archivo la
   * respuesta es 503 y la cita NO queda diciendo que tiene comprobante.
   */
  it("sin almacenamiento configurado responde 503 y no toca la cita", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());
    const id = await citaEnLinea(api.url);

    const respuesta = await fetch(`${api.url}/api/citas/${id}/comprobante`, {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: new Uint8Array(JPEG),
    });

    assert.equal(respuesta.status, 503);
    const cuerpo = (await respuesta.json()) as { error?: string };
    assert.match(
      String(cuerpo.error),
      /cita quedó agendada/i,
      "el mensaje tiene que decirle que su CITA sí quedó, que es lo que le importa",
    );

    // Y la cita sigue pendiente, no 'por-verificar'.
    const listado = await fetch(`${api.url}/api/citas`, {
      headers: { Authorization: `Bearer ${TOKEN_DE_PRUEBA}` },
    });
    const { citas } = (await listado.json()) as { citas: { id: string; pagoEstado: string }[] };
    assert.equal(citas.find((cita) => cita.id === id)?.pagoEstado, "pendiente");
  });

  it("ver el comprobante exige credencial", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());
    const id = await citaEnLinea(api.url);

    const respuesta = await fetch(`${api.url}/api/citas/${id}/comprobante`);
    await respuesta.text();

    assert.equal(respuesta.status, 401, "es un documento financiero de una persona");
  });

  it("verificar el pago exige credencial", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());
    const id = await citaEnLinea(api.url);

    const respuesta = await fetch(`${api.url}/api/citas/${id}/pago`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pagoEstado: "verificado" }),
    });
    await respuesta.text();

    assert.equal(respuesta.status, 401);
  });

  it("el panel puede verificar y rechazar, y devuelve la cita como QUEDÓ", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());
    const id = await citaEnLinea(api.url);

    for (const estado of ["verificado", "rechazado", "por-verificar"]) {
      const respuesta = await fetch(`${api.url}/api/citas/${id}/pago`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN_DE_PRUEBA}` },
        body: JSON.stringify({ pagoEstado: estado }),
      });

      assert.equal(respuesta.status, 200);
      const cita = (await respuesta.json()) as { pagoEstado: string };
      assert.equal(cita.pagoEstado, estado);
    }
  });

  /*
   * 'no-aplica' y 'pendiente' los DERIVA el servidor. Si el panel pudiera
   * escribirlos, un clic dejaría una cita diciendo "sin comprobante" con el
   * comprobante guardado en el bucket.
   */
  it("el panel NO puede escribir los estados que deriva el servidor", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());
    const id = await citaEnLinea(api.url);

    for (const estado of ["no-aplica", "pendiente", "cualquier-cosa"]) {
      const respuesta = await fetch(`${api.url}/api/citas/${id}/pago`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN_DE_PRUEBA}` },
        body: JSON.stringify({ pagoEstado: estado }),
      });
      await respuesta.text();

      assert.equal(respuesta.status, 400, `'${estado}' no se escribe a mano`);
    }
  });

  it("un id que no existe da 404, no 500", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());

    const inventado = "11111111-2222-3333-4444-999999999999";
    const respuesta = await fetch(`${api.url}/api/citas/${inventado}/comprobante`, {
      headers: { Authorization: `Bearer ${TOKEN_DE_PRUEBA}` },
    });
    await respuesta.text();

    assert.equal(respuesta.status, 404);
  });

  it("una cita sin comprobante da 404 al pedirlo, no un enlace vacío", async (t) => {
    const api = await levantarApi();
    t.after(() => api.cerrar());
    const id = await citaEnLinea(api.url);

    const respuesta = await fetch(`${api.url}/api/citas/${id}/comprobante`, {
      headers: { Authorization: `Bearer ${TOKEN_DE_PRUEBA}` },
    });

    assert.equal(respuesta.status, 404);
    const cuerpo = (await respuesta.json()) as { error?: string };
    assert.match(String(cuerpo.error), /no tiene comprobante/i);
  });
});
