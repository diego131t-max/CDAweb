import { Router } from "express";

import type { RepositorioServicios } from "../repositorios/repositorioServicios.js";

export interface DependenciasRutasServicios {
  repositorio: RepositorioServicios;
}

/**
 * Rutas del catálogo de servicios.
 *
 * El handler no sabe si detrás hay una constante en código o una tabla de
 * Postgres: solo usa la interfaz RepositorioServicios. Express 5 propaga solo el
 * rechazo de los handlers async al manejador de errores, así que no hace falta
 * try/catch.
 */
export function crearRutasServicios({ repositorio }: DependenciasRutasServicios): Router {
  const router = Router();

  // GET /api/servicios — PÚBLICO Y SIN AUTENTICACIÓN, a propósito.
  //
  // El principio II de la constitución (datos personales fallan cerrado) NO
  // aplica acá: el catálogo no contiene ningún dato de clientes, es información
  // comercial que el sitio ya publica de cara al público. Y el formulario de
  // agendamiento lo necesita antes de que exista cualquier sesión: si exigiera
  // autenticación, ningún cliente podría agendar.
  router.get("/", async (_req, res) => {
    const servicios = await repositorio.listar();

    // Objeto con la clave `servicios` y no un arreglo pelado: deja lugar a
    // agregar metadatos (por ejemplo, la versión del catálogo) sin romper al
    // frontend que ya lo consume.
    res.json({ servicios });
  });

  return router;
}
