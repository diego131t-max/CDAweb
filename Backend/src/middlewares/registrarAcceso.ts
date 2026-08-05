import type { RequestHandler } from "express";

/**
 * REGISTRO DE ACCESOS — una línea por petición, sin datos personales
 *
 * Deja constancia de QUÉ se accedió y CUÁNDO (FR-027). Formato:
 *
 *     [acceso] 2026-08-04T15:32:11.204Z GET /api/mensajes 200 12ms
 *
 * ESTÁ PROHIBIDO REGISTRAR (FR-028, principio II de la constitución):
 *
 * - El cuerpo de la petición: es donde viajan nombre, correo y mensaje.
 * - La cabecera `Authorization`: es la credencial en claro.
 * - La cadena de consulta.
 * - La dirección de red: es dato personal bajo la Ley 1581 de 2012.
 *
 * POR QUÉ SE CORTA LA CADENA DE CONSULTA, que es lo que más fácil se hace mal:
 * hoy `GET /api/mensajes` solo admite `desde`, `hasta` y `limite`, que no son
 * datos personales. Pero registrar la ruta completa sienta el precedente de
 * registrar cadenas de consulta, y el día que alguien agregue un filtro por
 * correo o por placa —`?email=…`, `?placa=…`— ese dato se filtra al registro
 * solo, sin que nadie toque este archivo ni se entere. Se corta y listo.
 *
 * LO QUE ESTE REGISTRO NO PUEDE RESPONDER: quién accedió. Con una credencial
 * compartida y sin usuarios, esa pregunta no tiene respuesta en este sistema, ni
 * siquiera guardando la dirección de red. La trazabilidad por persona llega
 * cuando existan usuarios reales.
 */

/** Máximo de caracteres de la ruta que se registran, para acotar la línea. */
const LARGO_MAXIMO_RUTA = 200;

export interface OpcionesRegistroDeAcceso {
  /** Dónde se escribe cada línea. Por omisión, la salida estándar. */
  escribir?: (linea: string) => void;
  /** Fuente de tiempo para medir la duración. Se inyecta en las pruebas. */
  reloj?: () => number;
}

/** Datos de una línea del registro. Ninguno es dato personal. */
export interface LineaDeAcceso {
  fecha: string;
  metodo: string;
  ruta: string;
  estado: number;
  duracionMs: number;
}

/** Arma la línea. Separado para poder probar el formato sin levantar el API. */
export function formatearLineaDeAcceso(linea: LineaDeAcceso): string {
  return `[acceso] ${linea.fecha} ${linea.metodo} ${linea.ruta} ${linea.estado} ${linea.duracionMs}ms`;
}

export function crearRegistroDeAcceso(opciones: OpcionesRegistroDeAcceso = {}): RequestHandler {
  const escribir = opciones.escribir ?? ((linea: string) => console.log(linea));
  const reloj = opciones.reloj ?? Date.now;

  return (req, res, next) => {
    const comienzo = reloj();
    const metodo = req.method;

    // `req.path` y NUNCA `req.originalUrl`: originalUrl incluye la cadena de
    // consulta. Además se lee ACÁ y no dentro del `finish`, porque Express
    // recorta `req.url` mientras la petición está dentro de un router montado y
    // la respuesta puede terminar ahí adentro: leerlo después daría "/".
    const ruta = req.path.slice(0, LARGO_MAXIMO_RUTA);

    // `finish` es el único momento en que se conoce el código de estado. No se
    // usa `close`: se dispararía también en conexiones cortadas, con estado 200
    // falso.
    res.on("finish", () => {
      escribir(
        formatearLineaDeAcceso({
          fecha: new Date().toISOString(),
          metodo,
          ruta,
          estado: res.statusCode,
          duracionMs: Math.round(reloj() - comienzo),
        }),
      );
    });

    next();
  };
}
