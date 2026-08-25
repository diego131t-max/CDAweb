import cors from "cors";
import express, { type Express, type RequestHandler } from "express";
import helmet from "helmet";

import { config } from "./config.js";
import {
  avisarCitaNueva as avisarCitaNuevaAlCda,
  avisarComprobante as avisarComprobanteAlCda,
  avisarMensaje as avisarMensajeAlCda,
} from "./correo/avisarAlCda.js";
import { enviarConfirmacionDeCita } from "./correo/enviarConfirmacion.js";
import {
  autenticacionAdmin as autenticacionAdminPorOmision,
  limitadorCredencial as limitadorCredencialPorOmision,
  limitadorPublico as limitadorPublicoPorOmision,
  obtenerRepositorioCitas,
  obtenerRepositorioMensajes,
  registroDeAcceso as registroDeAccesoPorOmision,
  repositorioServicios as repositorioServiciosPorOmision,
} from "./dependencias.js";
import { manejadorDeErrores, manejadorNoEncontrado } from "./http/errores.js";
import { soloEnMetodo } from "./middlewares/limitarPeticiones.js";
import type { RepositorioCitas } from "./repositorios/repositorioCitas.js";
import type { RepositorioMensajes } from "./repositorios/repositorioMensajes.js";
import type { RepositorioServicios } from "./repositorios/repositorioServicios.js";
import { crearRutasAdmin } from "./rutas/admin.js";
import {
  crearRutasCitas,
  type AvisarCitaNueva,
  type AvisarComprobante,
  type EnviarConfirmacion,
} from "./rutas/citas.js";
import { crearRutasMensajes, type AvisarMensaje } from "./rutas/mensajes.js";
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
  repositorioCitas: RepositorioCitas;
  autenticacionAdmin: RequestHandler;
  /** Limitador de las operaciones públicas (20 peticiones / 15 min). */
  limitadorPublico: RequestHandler;
  /** Limitador de la verificación de credencial (10 fallos / 15 min). */
  limitadorCredencial: RequestHandler;
  /** Registro de accesos, una línea por petición. */
  registroDeAcceso: RequestHandler;
  /**
   * Aviso por correo de una cita recién registrada.
   *
   * Se puede reemplazar para probar lo que importa de esta pieza: que su fallo
   * NO cambia la respuesta al cliente. Un doble que siempre revienta tiene que
   * dejar el 201 intacto.
   */
  enviarConfirmacion: EnviarConfirmacion;
  /**
   * Avisos por correo AL CDA: cita nueva, comprobante subido, mensaje nuevo.
   *
   * Se inyectan por el mismo motivo que el aviso al cliente: lo que hay que
   * poder probar es que su fallo no cambia ninguna respuesta.
   */
  avisarCitaNueva: AvisarCitaNueva;
  avisarComprobante: AvisarComprobante;
  avisarMensaje: AvisarMensaje;
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
  // Los dos repositorios de Postgres van SIN valor por omisión acá y se resuelven
  // abajo, en el montaje de su ruta. Escribirlos como
  // `= obtenerRepositorioMensajes()` abriría la conexión a la base al construir
  // la app, aunque quien la construya inyecte un repositorio falso y no la use
  // nunca: los parámetros por omisión se evalúan siempre que el argumento venga
  // vacío, y en las pruebas casi siempre viene vacío alguno de los dos.
  repositorioMensajes,
  repositorioCitas,
  repositorioServicios = repositorioServiciosPorOmision,
  autenticacionAdmin = autenticacionAdminPorOmision,
  limitadorPublico = limitadorPublicoPorOmision,
  limitadorCredencial = limitadorCredencialPorOmision,
  registroDeAcceso = registroDeAccesoPorOmision,
  enviarConfirmacion = enviarConfirmacionDeCita,
  avisarCitaNueva = avisarCitaNuevaAlCda,
  avisarComprobante = avisarComprobanteAlCda,
  avisarMensaje = avisarMensajeAlCda,
}: Partial<DependenciasApp> = {}): Express {
  const app = express();

  // De cuántos saltos de proxy fiarse para deducir la dirección del visitante.
  // Va ANTES que todo lo demás porque `req.ip` se calcula con este ajuste, y de
  // `req.ip` depende que el limitador de peticiones distinga a una persona de
  // otra: mal puesto, cuenta a todos los visitantes en el mismo cupo y termina
  // cerrándole el formulario a los clientes del CDA.
  //
  // Es un NÚMERO y nunca `true`: `true` confía en toda la cadena
  // `X-Forwarded-For` y toma la entrada que el propio cliente puede escribir,
  // así que el limitador se saltaría con una cabecera falsa. El porqué completo
  // y cuánto vale en cada entorno están en config.ts (leerSaltosDeProxy).
  app.set("trust proxy", config.saltosDeProxy);

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
  app.use(
    "/api/mensajes",
    crearRutasMensajes({
      repositorio: repositorioMensajes ?? obtenerRepositorioMensajes(),
      autenticacionAdmin,
      avisarMensaje,
    }),
  );
  // Catálogo de servicios: público, no expone datos de clientes (ver rutas/servicios.ts).
  app.use("/api/servicios", crearRutasServicios({ repositorio: repositorioServicios }));

  /*
   * Citas. Mismo reparto de limitadores que /api/mensajes, y por el mismo motivo:
   * es una dirección con dos naturalezas.
   *
   * POST — pública por diseño (cualquiera del mundo puede agendar), así que es la
   * que se puede inundar desde internet. Lleva el limitador público. Comparte
   * cupo con POST /api/mensajes a propósito: son las dos operaciones abiertas del
   * sistema y darle a cada una su propio limitador multiplicaría el total que se
   * le concede a una misma dirección.
   *
   * GET y PATCH — mueven datos personales detrás de credencial, así que son otra
   * puerta por donde probar credenciales de a una. Llevan el MISMO limitador de
   * credencial que /api/admin y que GET /api/mensajes, y como es la misma
   * instancia comparten contador: adivinar la credencial no se vuelve viable
   * abriendo una ruta nueva.
   */
  app.use("/api/citas", soloEnMetodo("POST", limitadorPublico));
  app.use("/api/citas", soloEnMetodo("GET", limitadorCredencial));
  app.use("/api/citas", soloEnMetodo("PATCH", limitadorCredencial));
  app.use("/api/citas", soloEnMetodo("DELETE", limitadorCredencial));
  app.use(
    "/api/citas",
    crearRutasCitas({
      repositorio: repositorioCitas ?? obtenerRepositorioCitas(),
      repositorioServicios,
      autenticacionAdmin,
      enviarConfirmacion,
      avisarCitaNueva,
      avisarComprobante,
    }),
  );

  app.use(manejadorNoEncontrado);
  app.use(manejadorDeErrores);

  return app;
}
