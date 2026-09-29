import { Router, type RequestHandler } from "express";

import { ErrorHttp, errorDeValidacion } from "../http/errores.js";
import type { RepositorioEncuestas } from "../repositorios/repositorioEncuestas.js";
import { validarFiltroEncuestas, validarNuevaEncuesta } from "../validacion/encuestas.js";
import { cayoEnLaTrampa, MENSAJE_TRAMPA, registrarTrampa } from "../validacion/trampa.js";

export interface DependenciasRutasEncuestas {
  repositorio: RepositorioEncuestas;
  autenticacionAdmin: RequestHandler;
}

/** Lo que ve el cliente cuando la base no responde. No revela nada de adentro. */
const MENSAJE_SIN_ALMACENAMIENTO =
  "No pudimos guardar tu encuesta en este momento. Intenta de nuevo en unos minutos.";

/**
 * Rutas de la encuesta de satisfacción.
 *
 * Los handlers solo usan la interfaz RepositorioEncuestas. Express 5 propaga el
 * rechazo de los handlers async al manejador de errores.
 */
export function crearRutasEncuestas({ repositorio, autenticacionAdmin }: DependenciasRutasEncuestas): Router {
  const router = Router();

  // POST /api/encuestas — PÚBLICO: lo usa la página /encuesta a la que se llega
  // con el código QR. Anónimo: no recibe ni devuelve datos de nadie.
  router.post("/", async (req, res) => {
    // La trampa va primero, igual que en mensajes y citas: habla de quién manda
    // los datos, no de qué significan.
    if (cayoEnLaTrampa(req.body)) {
      registrarTrampa("POST /api/encuestas");
      throw new ErrorHttp(400, MENSAJE_TRAMPA);
    }

    const validacion = validarNuevaEncuesta(req.body);
    if (!validacion.ok) throw errorDeValidacion(validacion.errores);

    // El fallo de la base se traduce a 503 con mensaje propio: quien contestó
    // tiene que saber que su encuesta NO quedó, no ver un "error inesperado".
    let encuesta;
    try {
      encuesta = await repositorio.crear(validacion.valor);
    } catch (fallo) {
      console.error("[error] fallo de almacenamiento:", fallo instanceof Error ? fallo.stack : String(fallo));
      throw new ErrorHttp(503, MENSAJE_SIN_ALMACENAMIENTO);
    }

    // Confirmación mínima: ni siquiera se devuelven las notas ni el texto.
    res.status(201).json({ id: encuesta.id, mensaje: "¡Gracias por tu opinión!" });
  });

  // GET /api/encuestas — PRIVADO: el texto libre puede traer cualquier cosa que
  // escriba la persona. Autenticación antes del handler.
  router.get("/", autenticacionAdmin, async (req, res) => {
    const validacion = validarFiltroEncuestas(req.query as Record<string, unknown>);
    if (!validacion.ok) throw errorDeValidacion(validacion.errores);

    const [encuestas, resumen] = await Promise.all([
      repositorio.listar(validacion.valor),
      repositorio.resumen(validacion.valor),
    ]);

    res.setHeader("Cache-Control", "no-store");
    // Objeto y no arreglo pelado: el resumen y la lista viajan juntos.
    res.json({ resumen, encuestas });
  });

  return router;
}
