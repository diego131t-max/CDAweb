import { createHash, randomBytes } from "node:crypto";
import type { Request, RequestHandler, Response } from "express";

/**
 * LIMITADOR DE PETICIONES — ventana deslizante en memoria
 *
 * Fábrica de middlewares que frenan a quien pide demasiado en poco tiempo. Se
 * escribió a mano en vez de usar `express-rate-limit` porque el almacén en
 * memoria de esa librería tiene exactamente la misma limitación de un solo
 * proceso: no compra nada a cambio de una dependencia más.
 *
 * Dos usos previstos (ver dependencias.ts):
 *
 * | Uso                     | Ventana | Tope | Qué cuenta            |
 * |-------------------------|---------|------|-----------------------|
 * | Operaciones públicas    | 15 min  | 20   | Todas las peticiones  |
 * | Verificación de credencial | 15 min | 10 | **Solo los fallos**   |
 *
 * LIMITACIÓN ACEPTADA Y ESCRITA: el conteo vive en la memoria de UN proceso. Con
 * varias instancias del API el tope se cuenta por instancia. Se revisa cuando
 * haya más de un proceso; hoy no lo hay.
 */

/** Único mensaje que ve quien supera el límite. No revela topes ni ventanas. */
export const MENSAJE_DEMASIADOS_INTENTOS = "Demasiados intentos. Espera unos minutos antes de volver a intentar.";

export interface OpcionesLimitador {
  /** Duración de la ventana deslizante, en milisegundos. */
  ventanaMs: number;
  /** Cantidad máxima de peticiones (o de fallos) permitidas dentro de la ventana. */
  maximo: number;
  /**
   * Si es `true`, solo se cuentan las respuestas 4xx y 5xx.
   *
   * Es lo que necesita el limitador de credencial: si contara también los
   * aciertos, el personal del CDA se autobloquearía en un día de trabajo normal
   * usando el panel. Se resuelve enganchándose al evento `finish` de la
   * respuesta, que es el único momento en que se conoce el código de estado.
   */
  soloFallos?: boolean;
  /**
   * Cada cuánto se hace el barrido de entradas vencidas. Por omisión, la ventana.
   * Se expone para las pruebas.
   */
  intervaloBarridoMs?: number;
  /** Fuente de tiempo. Se inyecta en las pruebas para simular el paso del tiempo. */
  reloj?: () => number;
}

/**
 * Crea un middleware limitador con su propio contador.
 *
 * Cada llamada devuelve un limitador INDEPENDIENTE: dos usos distintos no
 * comparten cupo. Por eso `dependencias.ts` instancia uno por caso y las pruebas
 * pueden inyectar uno propio con topes chicos.
 */
export function crearLimitadorDePeticiones(opciones: OpcionesLimitador): RequestHandler {
  const { ventanaMs, maximo, soloFallos = false, reloj = Date.now } = opciones;
  const intervaloBarridoMs = opciones.intervaloBarridoMs ?? ventanaMs;

  if (!Number.isFinite(ventanaMs) || ventanaMs <= 0) {
    throw new Error("La ventana del limitador debe ser una cantidad de milisegundos mayor que cero.");
  }
  if (!Number.isInteger(maximo) || maximo < 1) {
    throw new Error("El máximo del limitador debe ser un entero mayor o igual que uno.");
  }

  /** Marcas de tiempo de las peticiones contadas, por clave. */
  const marcasPorClave = new Map<string, number[]>();

  /**
   * Sal aleatoria, distinta en cada proceso y en cada limitador.
   *
   * Un SHA-256 pelado de una dirección IPv4 se revierte por fuerza bruta en
   * segundos: el espacio son 2^32 valores. Con sal, el resumen no dice nada
   * fuera de este proceso y sigue sirviendo igual como clave de agrupación.
   */
  const sal = randomBytes(16);

  /**
   * Calcula la clave del contador a partir de la dirección de red.
   *
   * NUNCA se guarda la dirección en claro, ni siquiera en memoria: FR-028 prohíbe
   * que las direcciones de red aparezcan en el registro de accesos —son dato
   * personal bajo la Ley 1581 de 2012— y tenerlas en claro en un mapa mientras se
   * las omite del registro sería incoherente. Un volcado de memoria de este
   * proceso no entrega la lista de quién pidió qué.
   *
   * OJO CON `req.ip`: sin `app.set("trust proxy", ...)` configurado, `req.ip` es
   * la dirección de la conexión TCP. Detrás de un proxy inverso (nginx, un
   * balanceador, Cloudflare) esa dirección es la DEL PROXY, así que todas las
   * peticiones caen en la misma clave y el limitador termina bloqueando a todo el
   * mundo junto. ANTES DE PUBLICAR detrás de un proxy hay que configurar
   * `trust proxy` en app.ts, o este limitador hace más daño que bien.
   */
  function calcularClave(req: Request): string {
    const direccion = req.ip ?? "sin-direccion";
    // 32 caracteres hexadecimales (128 bits) alcanzan de sobra para no tener
    // colisiones entre las direcciones que ve un solo proceso.
    return createHash("sha256").update(sal).update(direccion, "utf8").digest("hex").slice(0, 32);
  }

  /**
   * Devuelve las marcas todavía dentro de la ventana y descarta las vencidas.
   *
   * Esta es la purga perezosa: se ejecuta en cada acceso a la clave. La entrada
   * se borra del mapa cuando queda vacía, porque un mapa que solo crece es, él
   * mismo, una forma de tumbar el servicio: bastarían unos miles de direcciones
   * distintas para llenar la memoria del proceso.
   */
  function marcasVigentes(clave: string, ahora: number): number[] {
    const marcas = marcasPorClave.get(clave);
    if (marcas === undefined) return [];

    const limite = ahora - ventanaMs;
    const vigentes = marcas.filter((marca) => marca > limite);

    if (vigentes.length === 0) marcasPorClave.delete(clave);
    else marcasPorClave.set(clave, vigentes);

    return vigentes;
  }

  /** Anota una petición contada para la clave. */
  function anotar(clave: string, ahora: number): void {
    const vigentes = marcasVigentes(clave, ahora);
    vigentes.push(ahora);
    marcasPorClave.set(clave, vigentes);
  }

  // Barrido periódico: la purga perezosa solo limpia las claves que se vuelven a
  // ver, así que quien pidió una vez y no volvió nunca dejaría su entrada para
  // siempre. `.unref()` para que este temporizador NO impida que el proceso
  // termine (si no, `npm test` y cualquier apagado limpio quedan colgados).
  const barrido = setInterval(() => {
    const ahora = reloj();
    // Se copian las claves porque `marcasVigentes` borra entradas del mapa.
    for (const clave of [...marcasPorClave.keys()]) marcasVigentes(clave, ahora);
  }, intervaloBarridoMs);
  barrido.unref();

  /** Responde 429 indicando en segundos cuándo se libera un cupo. */
  function responderDemasiadosIntentos(res: Response, marcaMasAntigua: number | undefined, ahora: number): void {
    const esperaMs = marcaMasAntigua === undefined ? ventanaMs : marcaMasAntigua + ventanaMs - ahora;
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil(esperaMs / 1000))));
    res.status(429).json({ error: MENSAJE_DEMASIADOS_INTENTOS });
  }

  return (req, res, next) => {
    const ahora = reloj();
    const clave = calcularClave(req);
    const vigentes = marcasVigentes(clave, ahora);

    if (vigentes.length >= maximo) {
      // Se corta ANTES de enganchar el `finish`: si el propio 429 se contara
      // como fallo, quien ya está bloqueado extendería su bloqueo para siempre
      // con solo seguir intentando.
      responderDemasiadosIntentos(res, vigentes[0], ahora);
      return;
    }

    if (soloFallos) {
      // La marca se anota recién cuando se conoce el resultado de la respuesta.
      res.on("finish", () => {
        if (res.statusCode >= 400) anotar(clave, reloj());
      });
    } else {
      anotar(clave, ahora);
    }

    next();
  };
}

/**
 * Envuelve un middleware para que actúe solo en el método HTTP indicado.
 *
 * Sirve para aplicar un limitador a `POST /api/mensajes` sin tocar el `GET` de la
 * misma ruta, que va detrás de credencial y tiene su propio límite. Se hace con
 * `app.use` y no con `app.post` a propósito: `app.post` registra una RUTA, y la
 * prueba que recorre los endpoints montados (app.test.ts) vería un endpoint
 * fantasma que no existe.
 */
export function soloEnMetodo(metodo: string, middleware: RequestHandler): RequestHandler {
  const esperado = metodo.toUpperCase();
  return (req, res, next) => {
    if (req.method.toUpperCase() !== esperado) {
      next();
      return;
    }
    middleware(req, res, next);
  };
}
