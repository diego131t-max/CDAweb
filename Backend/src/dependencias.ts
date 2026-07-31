import type { RequestHandler } from "express";

import { config } from "./config.js";
import { crearAutenticacionAdmin } from "./middlewares/autenticarAdmin.js";
import type { RepositorioMensajes } from "./repositorios/repositorioMensajes.js";
import { RepositorioMensajesArchivo } from "./repositorios/repositorioMensajesArchivo.js";

/**
 * Punto único de composición.
 *
 * Acá —y solo acá— se elige la implementación concreta de cada repositorio.
 * Para migrar a Postgres/Supabase: escribir RepositorioMensajesPostgres
 * (implementando RepositorioMensajes) y cambiar la línea de abajo. Ni las rutas
 * ni los handlers se tocan.
 */
export const repositorioMensajes: RepositorioMensajes = new RepositorioMensajesArchivo(config.directorioDatos);

/** Middleware que protege todo lo que expone datos de clientes. */
export const autenticacionAdmin: RequestHandler = crearAutenticacionAdmin(config.tokenAdmin);
