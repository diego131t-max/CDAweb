import type { RequestHandler } from "express";

import { config } from "./config.js";
import { crearAutenticacionAdmin } from "./middlewares/autenticarAdmin.js";
import { crearLimitadorDePeticiones } from "./middlewares/limitarPeticiones.js";
import { crearRegistroDeAcceso } from "./middlewares/registrarAcceso.js";
import type { RepositorioMensajes } from "./repositorios/repositorioMensajes.js";
import { RepositorioMensajesArchivo } from "./repositorios/repositorioMensajesArchivo.js";
import type { RepositorioServicios } from "./repositorios/repositorioServicios.js";
import { RepositorioServiciosEstatico } from "./repositorios/repositorioServiciosEstatico.js";

/**
 * Punto único de composición.
 *
 * Acá —y solo acá— se elige la implementación concreta de cada repositorio.
 * Para migrar a Postgres/Supabase: escribir RepositorioMensajesPostgres
 * (implementando RepositorioMensajes) y cambiar la línea de abajo. Ni las rutas
 * ni los handlers se tocan.
 */
export const repositorioMensajes: RepositorioMensajes = new RepositorioMensajesArchivo(config.directorioDatos);

/**
 * Catálogo de servicios. La implementación estática lee la constante versionada
 * en código; migrarlo a una tabla es escribir RepositorioServiciosPostgres y
 * cambiar esta línea.
 */
export const repositorioServicios: RepositorioServicios = new RepositorioServiciosEstatico();

/** Middleware que protege todo lo que expone datos de clientes. */
export const autenticacionAdmin: RequestHandler = crearAutenticacionAdmin(config.tokenAdmin);

const QUINCE_MINUTOS_MS = 15 * 60 * 1000;

/**
 * Limitador de las operaciones públicas: 20 peticiones cada 15 minutos.
 *
 * Se aplica a `POST /api/mensajes`, que es público por diseño (cualquiera del
 * mundo puede escribirle al CDA) y por lo tanto es el que se puede inundar. El
 * tope es holgado para una persona real —nadie manda 20 mensajes en un cuarto de
 * hora— y estrecho para un guion automático.
 *
 * Se instancia ACÁ, en el punto único de composición (principio III), y no
 * dentro de app.ts: así las pruebas inyectan uno propio con topes chicos en vez
 * de tener que mandar 20 peticiones de verdad.
 */
export const limitadorPublico: RequestHandler = crearLimitadorDePeticiones({
  ventanaMs: QUINCE_MINUTOS_MS,
  maximo: 20,
});

/**
 * Limitador de la verificación de credencial: 10 FALLOS cada 15 minutos.
 *
 * Cuenta solo las respuestas de error. Si contara también los aciertos, el
 * personal del CDA se autobloquearía trabajando: el panel revalida la credencial
 * en cada carga de página.
 */
export const limitadorCredencial: RequestHandler = crearLimitadorDePeticiones({
  ventanaMs: QUINCE_MINUTOS_MS,
  maximo: 10,
  soloFallos: true,
});

/** Registro de accesos: una línea por petición, sin datos personales. */
export const registroDeAcceso: RequestHandler = crearRegistroDeAcceso();
