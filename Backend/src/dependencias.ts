import type { RequestHandler } from "express";

import { config } from "./config.js";
import { crearAutenticacionAdmin } from "./middlewares/autenticarAdmin.js";
import { crearLimitadorDePeticiones } from "./middlewares/limitarPeticiones.js";
import { crearRegistroDeAcceso } from "./middlewares/registrarAcceso.js";
import type { RepositorioCitas } from "./repositorios/repositorioCitas.js";
import { RepositorioCitasPostgres } from "./repositorios/repositorioCitasPostgres.js";
import type { RepositorioMensajes } from "./repositorios/repositorioMensajes.js";
import { RepositorioMensajesPostgres } from "./repositorios/repositorioMensajesPostgres.js";
import type { RepositorioServicios } from "./repositorios/repositorioServicios.js";
import { RepositorioServiciosEstatico } from "./repositorios/repositorioServiciosEstatico.js";

/**
 * Punto único de composición.
 *
 * Acá —y solo acá— se elige la implementación concreta de cada repositorio.
 *
 * Los dos repositorios de datos personales se instancian PEREZOSAMENTE, y eso no
 * es un detalle de estilo: `new ...Postgres()` llama a `obtenerSql()`, que
 * revienta sin `DATABASE_URL`. Creados en el cuerpo del módulo, correrían al
 * IMPORTAR este archivo, y este archivo lo importa app.ts — o sea que las
 * pruebas, que construyen la app con repositorios falsos y no tocan Postgres, se
 * caerían antes de empezar. Con el `getter`, el que inyecta el suyo no paga la
 * conexión.
 *
 * Lo que esto NO evita: desde la 003 el API ya no arranca sin base. `crearApp`
 * resuelve los dos repositorios al montar sus rutas, así que correr el backend
 * en local exige un `DATABASE_URL` válido en `Backend/.env`. Es el precio de que
 * no exista ningún camino donde los datos de un cliente terminen en otro lado.
 */

/**
 * Mensajes de contacto. Estuvieron en un archivo JSON sobre un volumen de
 * Railway hasta la 003; migrar fue escribir otra implementación de la MISMA
 * interfaz y cambiar esta línea. Ni las rutas ni los handlers se tocaron, que es
 * exactamente lo que el principio III existe para conseguir.
 */
let mensajesEnPostgres: RepositorioMensajes | null = null;
export function obtenerRepositorioMensajes(): RepositorioMensajes {
  mensajesEnPostgres ??= new RepositorioMensajesPostgres();
  return mensajesEnPostgres;
}

/**
 * Citas. Nacen directo en Postgres: nunca existió una implementación en archivo
 * porque hasta ahora las citas no llegaban al servidor —se quedaban en el
 * navegador de quien agendaba y el CDA no se enteraba—.
 */
let citasEnPostgres: RepositorioCitas | null = null;
export function obtenerRepositorioCitas(): RepositorioCitas {
  citasEnPostgres ??= new RepositorioCitasPostgres();
  return citasEnPostgres;
}

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
