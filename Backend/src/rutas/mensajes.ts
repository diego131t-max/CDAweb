import { Router, type RequestHandler } from "express";

import { avisarMensaje as avisarMensajeAlCda } from "../correo/avisarAlCda.js";
import { ErrorHttp, errorDeValidacion } from "../http/errores.js";
import type { RepositorioMensajes } from "../repositorios/repositorioMensajes.js";
import type { Mensaje } from "../tipos/mensaje.js";
import { validarFiltroMensajes, validarNuevoMensaje } from "../validacion/mensajes.js";
import { cayoEnLaTrampa, MENSAJE_TRAMPA, registrarTrampa } from "../validacion/trampa.js";

/** Aviso por correo al CDA. Se inyecta para poder probar que su fallo no rompe nada. */
export type AvisarMensaje = (mensaje: Mensaje) => Promise<unknown>;

export interface DependenciasRutasMensajes {
  repositorio: RepositorioMensajes;
  autenticacionAdmin: RequestHandler;
  /** Por omisión, el envío real por Resend. */
  avisarMensaje?: AvisarMensaje;
}

/** Lo que ve el cliente cuando la base no responde. No revela nada de adentro. */
const MENSAJE_SIN_ALMACENAMIENTO =
  "No pudimos enviar tu mensaje en este momento. Intenta de nuevo en unos minutos o escríbenos por WhatsApp.";

/**
 * Rutas de mensajes de contacto.
 *
 * Los handlers no saben si detrás hay un archivo JSON o Postgres: solo usan la
 * interfaz RepositorioMensajes. Express 5 propaga solo el rechazo de los
 * handlers async al manejador de errores, así que no hace falta try/catch.
 */
export function crearRutasMensajes({
  repositorio,
  autenticacionAdmin,
  avisarMensaje = avisarMensajeAlCda,
}: DependenciasRutasMensajes): Router {
  const router = Router();

  // POST /api/mensajes — PÚBLICO: lo usa el formulario de contacto del sitio.
  router.post("/", async (req, res) => {
    // La trampa va PRIMERO, antes de validar. No habla de qué significan los
    // datos sino de quién los manda, así que es una puerta y no un campo: si del
    // otro lado hay un guion, no tiene sentido revisarle el nombre y el correo.
    if (cayoEnLaTrampa(req.body)) {
      registrarTrampa("POST /api/mensajes");
      throw new ErrorHttp(400, MENSAJE_TRAMPA);
    }

    const validacion = validarNuevoMensaje(req.body);
    if (!validacion.ok) throw errorDeValidacion(validacion.errores);

    /*
     * El fallo de la base se traduce a 503 con mensaje propio, igual que en
     * POST /api/citas. Antes caía al 500 genérico ("Ocurrió un error
     * inesperado"), que no le dice a quien escribió lo único que necesita
     * saber: que su mensaje NO llegó y por dónde insistir.
     */
    let mensaje;
    try {
      mensaje = await repositorio.crear(validacion.valor);
    } catch (fallo) {
      console.error("[error] fallo de almacenamiento:", fallo instanceof Error ? fallo.stack : String(fallo));
      throw new ErrorHttp(503, MENSAJE_SIN_ALMACENAMIENTO);
    }

    // Se confirma con el mínimo de datos: no se devuelven nombre, correo ni texto.
    res.status(201).json({
      id: mensaje.id,
      date: mensaje.date,
      mensaje: "Tu mensaje fue recibido. Te responderemos lo antes posible.",
    });

    // Aviso al CDA después de responder, sin await y con .catch obligatorio:
    // mismo criterio que en citas. Que no salga el correo no puede convertir un
    // mensaje bien guardado en un error, y una promesa rechazada sin manejar
    // tumbaría el proceso.
    const guardado = mensaje;
    void Promise.resolve(avisarMensaje(guardado)).catch((fallo: unknown) => {
      console.error(
        `[correo] fallo no controlado al avisar el mensaje ${guardado.id}:`,
        fallo instanceof Error ? fallo.message : String(fallo),
      );
    });
  });

  // GET /api/mensajes — PRIVADO: devuelve datos personales de clientes.
  // La autenticación va antes del handler; sin ella este endpoint no se monta.
  router.get("/", autenticacionAdmin, async (req, res) => {
    const validacion = validarFiltroMensajes(req.query as Record<string, unknown>);
    if (!validacion.ok) throw errorDeValidacion(validacion.errores);

    const mensajes = await repositorio.listar(validacion.valor);

    // Datos personales: que ningún proxy ni el navegador los cachee.
    res.setHeader("Cache-Control", "no-store");
    // Arreglo plano, igual que lo que hoy guarda localStorage bajo "messages",
    // para que migrar el frontend sea cambiar storage.get por un fetch.
    res.json(mensajes);
  });

  return router;
}
