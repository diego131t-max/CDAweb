import cors from "cors";
import express, { type Express, type RequestHandler } from "express";
import helmet from "helmet";

import { config } from "./config.js";
import {
  autenticacionAdmin as autenticacionAdminPorOmision,
  limitadorCredencial as limitadorCredencialPorOmision,
  limitadorPublico as limitadorPublicoPorOmision,
  registroDeAcceso as registroDeAccesoPorOmision,
  repositorioMensajes as repositorioMensajesPorOmision,
  repositorioServicios as repositorioServiciosPorOmision,
} from "./dependencias.js";
import { manejadorDeErrores, manejadorNoEncontrado } from "./http/errores.js";
import { soloEnMetodo } from "./middlewares/limitarPeticiones.js";
import type { RepositorioMensajes } from "./repositorios/repositorioMensajes.js";
import type { RepositorioServicios } from "./repositorios/repositorioServicios.js";
import { crearRutasAdmin } from "./rutas/admin.js";
import { crearRutasMensajes } from "./rutas/mensajes.js";
import { crearRutasServicios } from "./rutas/servicios.js";

/**
 * Piezas que la app recibe de afuera.
 *
 * Todas tienen valor por omisión (el de `dependencias.ts`), así que arrancar el
 * servidor real no necesita pasar nada. Se pueden reemplazar una por una para
 * probar la app de punta a punta sin depender del entorno: por ejemplo, montar
 * `crearAutenticacionAdmin("")` para verificar que el panel falla cerrado
 * cuando no hay credencial configurada.
 */
export interface DependenciasApp {
  repositorioMensajes: RepositorioMensajes;
  repositorioServicios: RepositorioServicios;
  autenticacionAdmin: RequestHandler;
  /** Limitador de las operaciones públicas (20 peticiones / 15 min). */
  limitadorPublico: RequestHandler;
  /** Limitador de la verificación de credencial (10 fallos / 15 min). */
  limitadorCredencial: RequestHandler;
  /** Registro de accesos, una línea por petición. */
  registroDeAcceso: RequestHandler;
}

/**
 * Construye la app de Express con sus middlewares y rutas, SIN escuchar en
 * ningún puerto. El `listen` vive en server.ts.
 *
 * Están separados a propósito: así las pruebas de integración levantan esta
 * misma app en un puerto que asigna el sistema (`app.listen(0)`) y le pegan con
 * fetch, en vez de probar los middlewares aislados. Probar un middleware suelto
 * no dice nada sobre si está efectivamente montado en la ruta que debe proteger.
 */
export function crearApp({
  repositorioMensajes = repositorioMensajesPorOmision,
  repositorioServicios = repositorioServiciosPorOmision,
  autenticacionAdmin = autenticacionAdminPorOmision,
  limitadorPublico = limitadorPublicoPorOmision,
  limitadorCredencial = limitadorCredencialPorOmision,
  registroDeAcceso = registroDeAccesoPorOmision,
}: Partial<DependenciasApp> = {}): Express {
  const app = express();

  // Las cabeceras de seguridad van PRIMERO, antes que CORS: así también viajan
  // en las respuestas que cortan los middlewares posteriores.
  //
  // OJO, NO CAMBIAR `crossOriginResourcePolicy` a su valor por omisión:
  // helmet manda `Cross-Origin-Resource-Policy: same-origin` si no se le dice
  // otra cosa. El sitio corre en http://localhost:5173 y este API en
  // http://localhost:3000 — son orígenes distintos, así que con `same-origin`
  // el navegador DESCARTA todas las respuestas del API y se cae el agendamiento
  // entero (el catálogo de servicios deja de cargar). El CORS de acá abajo
  // seguiría diciendo que sí: la que bloquea es esta otra cabecera, y el
  // síntoma no menciona a helmet por ningún lado.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

  // helmet ya borra X-Powered-By; se deja explícito para documentar la
  // intención y para que la cabecera no vuelva si alguien saca helmet.
  app.disable("x-powered-by");

  // El registro de accesos va ANTES de las rutas y antes de leer el cuerpo, para
  // que mida la petición completa y para que también queden registradas las que
  // cortan CORS o el parseo de JSON. Nunca registra cuerpo, credencial, cadena
  // de consulta ni dirección de red (ver middlewares/registrarAcceso.ts).
  app.use(registroDeAcceso);

  app.use(cors({ origin: config.origenPermitido }));
  // Límite chico: los cuerpos que recibe el API son formularios cortos.
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ estado: "ok" });
  });

  // Verificación de credencial del panel: no toca almacenamiento ni datos
  // personales. El limitador va DELANTE de la autenticación y cuenta solo los
  // fallos: 10 credenciales equivocadas cada 15 minutos y esa dirección espera.
  // Probar credenciales de a una deja de ser viable, y el personal del CDA no se
  // autobloquea porque sus verificaciones correctas no suman.
  app.use("/api/admin", limitadorCredencial, crearRutasAdmin({ autenticacionAdmin }));

  // Cada método de esta ruta lleva el limitador que le corresponde, porque son
  // dos cosas distintas con la misma dirección:
  //
  // POST — operación pública, abierta a cualquiera de internet: limitador público.
  //
  // GET — devuelve datos personales detrás de credencial, así que es una segunda
  // puerta por donde probar credenciales de a una. Lleva el MISMO limitador de
  // credencial que /api/admin, y como es la misma instancia comparten contador:
  // 10 fallos entre las dos rutas y esa dirección espera. Sin esto, el tope de
  // /api/admin sería decorativo —bastaba con probar acá— y FR-020 pide que
  // adivinar la credencial no sea viable, no que una ruta puntual tenga tope.
  // Cuenta solo los fallos, así que el personal del CDA puede listar mensajes
  // todas las veces que necesite sin autobloquearse.
  app.use("/api/mensajes", soloEnMetodo("POST", limitadorPublico));
  app.use("/api/mensajes", soloEnMetodo("GET", limitadorCredencial));
  app.use("/api/mensajes", crearRutasMensajes({ repositorio: repositorioMensajes, autenticacionAdmin }));
  // Catálogo de servicios: público, no expone datos de clientes (ver rutas/servicios.ts).
  app.use("/api/servicios", crearRutasServicios({ repositorio: repositorioServicios }));

  // Las rutas de citas se montan acá.

  app.use(manejadorNoEncontrado);
  app.use(manejadorDeErrores);

  return app;
}
