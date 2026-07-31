import { Router, type RequestHandler } from "express";

import { errorDeValidacion } from "../http/errores.js";
import type { RepositorioMensajes } from "../repositorios/repositorioMensajes.js";
import { validarFiltroMensajes, validarNuevoMensaje } from "../validacion/mensajes.js";

export interface DependenciasRutasMensajes {
  repositorio: RepositorioMensajes;
  autenticacionAdmin: RequestHandler;
}

/**
 * Rutas de mensajes de contacto.
 *
 * Los handlers no saben si detrás hay un archivo JSON o Postgres: solo usan la
 * interfaz RepositorioMensajes. Express 5 propaga solo el rechazo de los
 * handlers async al manejador de errores, así que no hace falta try/catch.
 */
export function crearRutasMensajes({ repositorio, autenticacionAdmin }: DependenciasRutasMensajes): Router {
  const router = Router();

  // POST /api/mensajes — PÚBLICO: lo usa el formulario de contacto del sitio.
  router.post("/", async (req, res) => {
    const validacion = validarNuevoMensaje(req.body);
    if (!validacion.ok) throw errorDeValidacion(validacion.errores);

    const mensaje = await repositorio.crear(validacion.valor);

    // Se confirma con el mínimo de datos: no se devuelven nombre, correo ni texto.
    res.status(201).json({
      id: mensaje.id,
      date: mensaje.date,
      mensaje: "Tu mensaje fue recibido. Te responderemos lo antes posible.",
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
