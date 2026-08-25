import { raw, Router, type RequestHandler } from "express";

import {
  almacenamientoDisponible,
  subirComprobante,
  TAMANO_MAXIMO,
  TIPOS_ACEPTADOS,
  urlFirmadaDeComprobante,
} from "../almacenamiento/comprobantes.js";
import { avisarCitaNueva as avisarCitaNuevaAlCda, avisarComprobante as avisarComprobanteAlCda } from "../correo/avisarAlCda.js";
import { enviarConfirmacionDeCita } from "../correo/enviarConfirmacion.js";
import { ErrorHttp, errorDeValidacion } from "../http/errores.js";
import type { RepositorioCitas, ResultadoCreacion } from "../repositorios/repositorioCitas.js";
import type { RepositorioServicios } from "../repositorios/repositorioServicios.js";
import type { Cita, NuevaCita } from "../tipos/cita.js";
import { CUPOS_POR_FRANJA } from "../tipos/franja.js";
import { servicioAplicaAVehiculo } from "../tipos/servicio.js";
import { esFechaValida } from "../utilidades/fecha.js";
import {
  validarCambioDeEstado,
  validarCambioDeEstadoDePago,
  validarFiltroCitas,
  validarNuevaCita,
} from "../validacion/citas.js";
import { cayoEnLaTrampa, MENSAJE_TRAMPA, registrarTrampa } from "../validacion/trampa.js";

/** Aviso por correo al cliente. Se inyecta para poder probar que su fallo no rompe nada. */
export type EnviarConfirmacion = (cita: Cita) => Promise<unknown>;

/** Avisos por correo al CDA. Se inyectan por el mismo motivo que el del cliente. */
export type AvisarCitaNueva = (cita: Cita) => Promise<unknown>;
export type AvisarComprobante = (cita: Cita, archivo: Buffer, tipo: string) => Promise<unknown>;

export interface DependenciasRutasCitas {
  repositorio: RepositorioCitas;
  repositorioServicios: RepositorioServicios;
  autenticacionAdmin: RequestHandler;
  /** Por omisión, el envío real por Resend. */
  enviarConfirmacion?: EnviarConfirmacion;
  avisarCitaNueva?: AvisarCitaNueva;
  avisarComprobante?: AvisarComprobante;
}

/** Lo que ve el cliente cuando la base no responde. No revela nada de adentro. */
const MENSAJE_SIN_ALMACENAMIENTO =
  "No pudimos registrar tu cita en este momento. Intenta de nuevo en unos minutos o escríbenos por WhatsApp.";

const MENSAJE_SIN_LECTURA =
  "No pudimos consultar las citas en este momento. Intenta de nuevo en unos minutos.";

const MENSAJE_SIN_DISPONIBILIDAD =
  "No pudimos consultar los cupos en este momento. Intenta de nuevo en unos minutos.";

const MENSAJE_SIN_BORRADO =
  "No pudimos borrar la cita en este momento. Intenta de nuevo en unos minutos.";

/**
 * Lo que ve el cliente cuando el almacenamiento de comprobantes no está
 * configurado o falló. Le dice las tres cosas que necesita: que su CITA SÍ
 * quedó, que el comprobante no, y por dónde mandarlo.
 */
/** Cuánto vive la URL firmada del comprobante. Corta a propósito: ver la ruta. */
const SEGUNDOS_DE_URL_FIRMADA = 60;

const MENSAJE_YA_TIENE_COMPROBANTE =
  "Esa cita ya tiene un comprobante. Si necesitas cambiarlo, escríbenos por WhatsApp.";

const MENSAJE_SIN_COMPROBANTE =
  "Tu cita quedó agendada, pero no pudimos recibir el comprobante en este momento. " +
  "Escríbenos por WhatsApp al 316 6962144 con tu número de cita y te lo confirmamos.";

/**
 * Rutas de citas.
 *
 * Los handlers no saben si detrás hay Postgres o cualquier otra cosa: solo usan
 * la interfaz `RepositorioCitas`. Express 5 propaga el rechazo de los handlers
 * async al manejador de errores, así que no hace falta try/catch salvo donde se
 * quiere traducir el fallo a un mensaje propio — que es justo lo que se hace acá.
 */
export function crearRutasCitas({
  repositorio,
  repositorioServicios,
  autenticacionAdmin,
  enviarConfirmacion = enviarConfirmacionDeCita,
  avisarCitaNueva = avisarCitaNuevaAlCda,
  avisarComprobante = avisarComprobanteAlCda,
}: DependenciasRutasCitas): Router {
  const router = Router();

  // POST /api/citas — PÚBLICO. Es una de las dos únicas operaciones públicas del
  // sistema, y la constitución lo autoriza explícitamente.
  router.post("/", async (req, res) => {
    // Misma puerta que en /api/mensajes, y por el mismo motivo: acá es donde un
    // guion podría llenarle la agenda al CDA de citas que nadie va a atender.
    if (cayoEnLaTrampa(req.body)) {
      registrarTrampa("POST /api/citas");
      throw new ErrorHttp(400, MENSAJE_TRAMPA);
    }

    const validacion = validarNuevaCita(req.body);
    if (!validacion.ok) throw errorDeValidacion(validacion.errores);

    /*
     * FR-005 — El servicio se comprueba ACÁ, del lado del servidor.
     *
     * Hoy esta validación existe solo en el navegador, y una validación de
     * cliente es una comodidad, no un control: se saltea con una petición hecha
     * a mano. Por acá caen los envíos manipulados y los formularios viejos que
     * quedaron abiertos en una pestaña desde antes de que cambiara el catálogo.
     */
    const servicio = await repositorioServicios.obtenerPorId(validacion.valor.service);
    if (servicio === null) {
      throw errorDeValidacion([
        { campo: "service", mensaje: "El servicio elegido no está disponible. Elige uno de la lista." },
      ]);
    }

    /*
     * FR-010 de la 001 — La combinación servicio + vehículo también tiene que ser
     * válida, aunque el servicio exista: el certificado de blindaje no aplica a
     * motos. La regla vive en `servicioAplicaAVehiculo`, junto al tipo, porque es
     * de negocio y no de almacenamiento.
     */
    if (!servicioAplicaAVehiculo(servicio, validacion.valor.vehicle)) {
      throw errorDeValidacion([
        {
          campo: "service",
          mensaje: `${servicio.nombre} no aplica a ${validacion.valor.vehicle}. Elige otro servicio o cambia el tipo de vehículo.`,
        },
      ]);
    }

    // El NOMBRE lo pone el servidor desde el catálogo, no el cliente: si viniera
    // del cuerpo, alguien podría registrar una cita que dice "Revisión
    // Técnico-Mecánica" apuntando al id de otro servicio.
    const datos: NuevaCita = { ...validacion.valor, serviceName: servicio.nombre };

    const resultado = await crearOFallarConMensaje(repositorio, datos);

    /*
     * FR-028 — La franja se llenó. 409 y no 400: el envío del cliente es
     * válido, lo que cambió es el mundo mientras lo llenaba.
     *
     * Este caso NO es raro ni teórico: alguien abre el formulario, elige las
     * 9:00 cuando quedaba un lugar, se toma dos minutos escribiendo la placa, y
     * en el medio otra persona lo toma. El mensaje tiene que decir qué pasó y
     * qué hacer, no "error al agendar".
     */
    if (resultado.resultado === "franja-llena") {
      throw new ErrorHttp(
        409,
        `Esa hora se llenó: solo atendemos ${CUPOS_POR_FRANJA} vehículos por franja y ya están tomados. ` +
          "Elige otra hora u otro día; el resto de tus datos no se pierde.",
      );
    }

    const cita = resultado.cita;

    // Se devuelve la cita completa: el frontend la necesita para confirmar, y el
    // `id` que la base generó es la única forma de que el cliente pueda
    // referirse a su cita después.
    res.status(201).json(cita);

    /*
     * EL AVISO POR CORREO VA ACÁ, DESPUÉS DE RESPONDER, Y NO SE ESPERA (FR-025).
     *
     * El orden es la garantía: cuando esta línea corre, el cliente ya recibió su
     * 201 y la cita ya está guardada. Nada de lo que pase acá abajo puede
     * convertir una cita bien registrada en un error —que es exactamente lo que
     * pasaría si el envío estuviera antes del `res` y Resend se cayera—.
     *
     * Sin `await` a propósito: el cliente no tiene por qué esperar a un tercero
     * para ver su confirmación. Y con `.catch` obligatorio, porque una promesa
     * rechazada sin manejar TUMBA EL PROCESO en Node: el API entero caído porque
     * no salió un correo sería la peor versión posible de esto.
     */
    void Promise.resolve(enviarConfirmacion(cita)).catch((fallo: unknown) => {
      console.error(
        `[correo] fallo no controlado al avisar la cita ${cita.id}:`,
        fallo instanceof Error ? fallo.message : String(fallo),
      );
    });

    // Y el aviso AL CDA, que es otro correo a otro destinatario: el de arriba le
    // escribe al cliente. Van separados y no como copia porque el contenido es
    // distinto —este trae teléfono y cédula— y porque un solo envío con dos
    // destinatarios le mostraría a cada uno la dirección del otro.
    void Promise.resolve(avisarCitaNueva(cita)).catch((fallo: unknown) => {
      console.error(
        `[correo] fallo no controlado al avisar al CDA la cita ${cita.id}:`,
        fallo instanceof Error ? fallo.message : String(fallo),
      );
    });
  });

  /*
   * GET /api/citas/disponibilidad?fecha=YYYY-MM-DD — PÚBLICO (FR-028).
   *
   * Es la TERCERA operación pública del sistema, y se justifica sola: sin ella
   * el formulario tendría que ofrecer las diez franjas siempre y dejar que el
   * cliente descubra que la suya está llena recién al enviar, después de haber
   * escrito todo.
   *
   * QUÉ DEVUELVE, Y POR QUÉ PUEDE SER PÚBLICO: horas y números. Cuántos lugares
   * quedan a las 9:00, nada más. Ni un nombre, ni una placa, ni un teléfono —el
   * repositorio hace el conteo en la base y nunca trae las filas—. Lo único que
   * se filtra es qué tan lleno está el CDA, que es justamente lo que se le está
   * contando al cliente a propósito.
   *
   * Va ANTES de GET / en el archivo por claridad, no por necesidad: son rutas
   * distintas y Express no las confunde. Pero la de abajo lleva
   * `autenticacionAdmin` y esta no, y esas dos líneas conviene leerlas juntas.
   */
  router.get("/disponibilidad", async (req, res) => {
    const fecha = req.query["fecha"];
    if (typeof fecha !== "string" || !esFechaValida(fecha)) {
      throw errorDeValidacion([
        { campo: "fecha", mensaje: "Indica la fecha en formato YYYY-MM-DD." },
      ]);
    }

    let franjas;
    try {
      franjas = await repositorio.disponibilidad(fecha);
    } catch (fallo) {
      throw errorDeAlmacenamiento(fallo, MENSAJE_SIN_DISPONIBILIDAD);
    }

    // Sin caché: un cupo que se muestra libre cuando ya se tomó manda a alguien
    // a llenar un formulario que va a terminar en 409.
    res.setHeader("Cache-Control", "no-store");
    res.json({ fecha, cuposPorFranja: CUPOS_POR_FRANJA, franjas });
  });

  /*
   * GET /api/citas/resumen?desde=&hasta=  — PRIVADO.
   *
   * Los conteos agregados de Reportes. Lleva credencial aunque no devuelva
   * ningún dato personal: cuánto trabajo tiene el CDA, cuántos clientes no
   * vinieron y qué días están flojos es información del negocio, y no tiene por
   * qué estar abierta a la competencia.
   *
   * Es la diferencia con /disponibilidad, que sí es pública: aquella dice qué
   * cupos quedan HOY —que es lo que se le está contando al cliente a propósito—
   * y esta dice cómo le va al centro.
   */
  router.get("/resumen", autenticacionAdmin, async (req, res) => {
    const desde = req.query["desde"];
    const hasta = req.query["hasta"];

    const errores = [];
    if (typeof desde !== "string" || !esFechaValida(desde)) {
      errores.push({ campo: "desde", mensaje: "Indica la fecha inicial en formato YYYY-MM-DD." });
    }
    if (typeof hasta !== "string" || !esFechaValida(hasta)) {
      errores.push({ campo: "hasta", mensaje: "Indica la fecha final en formato YYYY-MM-DD." });
    }
    // El rango invertido se rechaza en vez de devolver un resumen vacío: un
    // reporte en cero se lee como "no vino nadie", que es una respuesta y no un
    // error. Mismo criterio que validarFiltroCitas.
    if (errores.length === 0 && (desde as string) > (hasta as string)) {
      errores.push({ campo: "desde", mensaje: "La fecha inicial no puede ser posterior a la fecha final." });
    }
    if (errores.length > 0) throw errorDeValidacion(errores);

    let resumen;
    try {
      resumen = await repositorio.resumen(desde as string, hasta as string);
    } catch (fallo) {
      throw errorDeAlmacenamiento(fallo, MENSAJE_SIN_LECTURA);
    }

    res.setHeader("Cache-Control", "no-store");
    res.json(resumen);
  });

  // GET /api/citas — PRIVADO: devuelve datos personales de todos los clientes
  // que agendaron. La autenticación va antes del handler.
  router.get("/", autenticacionAdmin, async (req, res) => {
    const validacion = validarFiltroCitas(req.query as Record<string, unknown>);
    if (!validacion.ok) throw errorDeValidacion(validacion.errores);

    let citas;
    try {
      citas = await repositorio.listar(validacion.valor);
    } catch (fallo) {
      throw errorDeAlmacenamiento(fallo, MENSAJE_SIN_LECTURA);
    }

    // Datos personales: que ningún proxy ni el navegador los cachee.
    res.setHeader("Cache-Control", "no-store");
    // Objeto con la clave `citas` y no un arreglo pelado, igual que /api/servicios:
    // deja lugar a agregar metadatos (total, paginación) sin romper el contrato.
    res.json({ citas });
  });

  // PATCH /api/citas/:id/estado — PRIVADO. La única escritura del panel.
  router.patch("/:id/estado", autenticacionAdmin, async (req, res) => {
    const validacion = validarCambioDeEstado(req.body);
    if (!validacion.ok) throw errorDeValidacion(validacion.errores);

    // Express 5 tipa los parámetros como `string | string[]`. Un arreglo acá no
    // es un id: se normaliza a texto y el repositorio devolverá null → 404.
    const bruto = req.params["id"];
    const id = typeof bruto === "string" ? bruto : "";

    let cita;
    try {
      cita = await repositorio.actualizarEstado(id, validacion.valor);
    } catch (fallo) {
      throw errorDeAlmacenamiento(fallo, MENSAJE_SIN_LECTURA);
    }

    if (cita === null) throw new ErrorHttp(404, "No encontramos esa cita.");

    res.setHeader("Cache-Control", "no-store");
    // Se devuelve la cita como QUEDÓ, no como se pidió que quedara: el panel
    // muestra lo guardado y nunca un estado optimista (FR-022).
    res.json(cita);
  });

  /*
   * DELETE /api/citas/:id — PRIVADO, y la única operación irreversible del API.
   *
   * Solo borra citas CANCELADAS. La regla vive en el repositorio (ver el
   * comentario de `borrar` en repositorioCitas.ts) y no acá: una comprobación en
   * la ruta protege a esta ruta, una en el almacenamiento protege a la tabla.
   *
   * Los tres desenlaces se traducen a tres códigos distintos a propósito. Un 404
   * y un 409 le dicen al mostrador dos cosas muy diferentes —"esa cita ya no
   * está" contra "cancelala primero"— y colapsarlos en un error genérico deja a
   * alguien apretando un botón que no explica por qué no funciona.
   */
  router.delete("/:id", autenticacionAdmin, async (req, res) => {
    const bruto = req.params["id"];
    const id = typeof bruto === "string" ? bruto : "";

    let resultado;
    try {
      resultado = await repositorio.borrar(id);
    } catch (fallo) {
      throw errorDeAlmacenamiento(fallo, MENSAJE_SIN_BORRADO);
    }

    if (resultado.resultado === "no-existe") {
      throw new ErrorHttp(404, "No encontramos esa cita.");
    }

    if (resultado.resultado === "no-cancelada") {
      throw new ErrorHttp(
        409,
        `Solo se pueden borrar las citas canceladas, y esta está ${resultado.estado}. ` +
          "Cancelala primero: así borrar es una decisión y no un clic mal dado.",
      );
    }

    res.setHeader("Cache-Control", "no-store");
    // Se devuelve el id y nada más. La cita ya no existe: mandar de vuelta sus
    // datos personales sería repartir lo que se acaba de pedir eliminar.
    res.json({ id, borrada: true, mensaje: "La cita se borró definitivamente." });
  });

  /*
   * POST /api/citas/:id/comprobante — PÚBLICO.
   *
   * POR QUÉ ES PÚBLICO. El cliente que acaba de agendar es anónimo: no tiene
   * cuenta ni credencial, y sube el comprobante en el mismo envío del
   * formulario. Es una operación pública más, y se agrega con el
   * mismo criterio que las demás: hace falta para que el negocio funcione y
   * no LEE ningún dato personal — solo escribe uno.
   *
   * QUÉ LO PROTEGE, ya que no hay credencial:
   *
   *  - El `id` es un UUID v4 que solo conoce quien recibió el 201. Son 122 bits
   *    de entropía, más de lo que tendría cualquier token inventado para esto.
   *  - Un solo disparo: si la cita ya tiene comprobante, 409. Ni un error ni
   *    alguien con el id puede reemplazar lo que el CDA ya recibió.
   *  - Se comprueba que la cita EXISTA antes de tocar el almacenamiento, para
   *    que disparar ids al azar no llene el bucket.
   *  - El limitador público que ya cubre POST /api/citas (mismo `app.use`).
   *  - El tipo se decide por los BYTES del archivo, no por la cabecera.
   *
   * El cuerpo NO es JSON: el archivo viaja crudo, con su tipo en `Content-Type`.
   * `express.json({ limit: "32kb" })` lo ignora por tipo y este `raw` lo toma.
   * Es lo que evita meter multipart —y una dependencia— para un solo archivo.
   */
  router.post(
    "/:id/comprobante",
    raw({ type: [...TIPOS_ACEPTADOS], limit: TAMANO_MAXIMO }),
    async (req, res) => {
      const bruto = req.params["id"];
      const id = typeof bruto === "string" ? bruto : "";

      /*
       * FALLA CERRADO. Sin credenciales de almacenamiento no hay dónde guardar
       * el archivo, y la única respuesta correcta es decirlo. Lo que NO puede
       * pasar es guardarlo en otro lado, ni responder que sí sin haberlo hecho:
       * la cita quedaría diciendo que tiene comprobante sin tenerlo.
       */
      if (!almacenamientoDisponible()) {
        throw new ErrorHttp(503, MENSAJE_SIN_COMPROBANTE);
      }

      // `raw` deja `req.body` sin tocar si el Content-Type no es de los
      // aceptados. Que acá no haya un Buffer significa que mandaron otra cosa.
      if (!Buffer.isBuffer(req.body)) {
        throw errorDeValidacion([
          {
            campo: "comprobante",
            mensaje: "El comprobante debe ser una imagen JPG, PNG o WEBP, o un PDF.",
          },
        ]);
      }

      const archivo: Buffer = req.body;

      // Antes de subir nada: la cita tiene que existir y no tener comprobante.
      let estado;
      try {
        estado = await repositorio.estadoDelComprobante(id);
      } catch (fallo) {
        throw errorDeAlmacenamiento(fallo, MENSAJE_SIN_COMPROBANTE);
      }

      if (!estado.existe) throw new ErrorHttp(404, "No encontramos esa cita.");
      if (estado.ruta !== null) throw new ErrorHttp(409, MENSAJE_YA_TIENE_COMPROBANTE);

      const subida = await subirComprobante(archivo);

      if (subida.resultado === "tipo-no-permitido" || subida.resultado === "vacio") {
        throw errorDeValidacion([
          {
            campo: "comprobante",
            mensaje:
              subida.resultado === "vacio"
                ? "El archivo llegó vacío. Vuelve a elegirlo e intenta de nuevo."
                : "Ese archivo no es una imagen JPG, PNG o WEBP ni un PDF. Revisa qué estás subiendo.",
          },
        ]);
      }

      if (subida.resultado !== "subido") {
        // El motivo se registra, no viaja: puede traer detalles del proyecto.
        const detalle = subida.resultado === "fallo" ? subida.motivo : subida.resultado;
        console.error(`[comprobante] no se pudo subir el de la cita ${id}: ${detalle}`);
        throw new ErrorHttp(503, MENSAJE_SIN_COMPROBANTE);
      }

      let resultado;
      try {
        resultado = await repositorio.adjuntarComprobante(id, subida.ruta, subida.tipo);
      } catch (fallo) {
        throw errorDeAlmacenamiento(fallo, MENSAJE_SIN_COMPROBANTE);
      }

      // La carrera que el `for update` del repositorio resuelve: dos envíos
      // simultáneos suben los dos y el segundo sale por acá. Lo que queda es un
      // objeto huérfano en el bucket, que no le hace daño a nadie.
      if (resultado.resultado === "no-existe") throw new ErrorHttp(404, "No encontramos esa cita.");
      if (resultado.resultado === "ya-tiene") throw new ErrorHttp(409, MENSAJE_YA_TIENE_COMPROBANTE);

      const cita = resultado.cita;

      res.setHeader("Cache-Control", "no-store");
      res.json({
        id: cita.id,
        pagoEstado: cita.pagoEstado,
        mensaje: "Recibimos tu comprobante. El CDA lo verifica y te confirma.",
      });

      // Igual que el aviso al cliente: después de responder, sin await y con
      // .catch obligatorio. Que el correo falle no puede tumbar la subida.
      void Promise.resolve(avisarComprobante(cita, archivo, subida.tipo)).catch((fallo: unknown) => {
        console.error(
          `[correo] fallo no controlado al avisar el comprobante de la cita ${cita.id}:`,
          fallo instanceof Error ? fallo.message : String(fallo),
        );
      });
    },
  );

  /*
   * GET /api/citas/:id/comprobante — PRIVADO.
   *
   * No devuelve el archivo: devuelve una URL FIRMADA que caduca en un minuto. El
   * bucket es privado y no se abre nunca. Si el enlace se filtra —queda en un
   * historial, en una captura, en un chat— deja de servir enseguida.
   */
  router.get("/:id/comprobante", autenticacionAdmin, async (req, res) => {
    const bruto = req.params["id"];
    const id = typeof bruto === "string" ? bruto : "";

    let estado;
    try {
      estado = await repositorio.estadoDelComprobante(id);
    } catch (fallo) {
      throw errorDeAlmacenamiento(fallo, MENSAJE_SIN_LECTURA);
    }

    if (!estado.existe) throw new ErrorHttp(404, "No encontramos esa cita.");
    if (estado.ruta === null) throw new ErrorHttp(404, "Esa cita no tiene comprobante.");

    const url = await urlFirmadaDeComprobante(estado.ruta);
    if (url === null) {
      throw new ErrorHttp(
        503,
        "No pudimos abrir el comprobante en este momento. Intenta de nuevo en unos minutos.",
      );
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({ url, expiraEnSegundos: SEGUNDOS_DE_URL_FIRMADA });
  });

  /*
   * PATCH /api/citas/:id/pago — PRIVADO. La verificación del comprobante.
   *
   * Solo acepta los tres estados que decide una PERSONA mirando el archivo.
   * 'no-aplica' y 'pendiente' los deriva el servidor y no se escriben a mano:
   * ver `validarCambioDeEstadoDePago`.
   *
   * OJO con lo que significa 'verificado': que alguien miró una imagen y dijo
   * que sí. El sistema no le pregunta nada al banco.
   */
  router.patch("/:id/pago", autenticacionAdmin, async (req, res) => {
    const validacion = validarCambioDeEstadoDePago(req.body);
    if (!validacion.ok) throw errorDeValidacion(validacion.errores);

    const bruto = req.params["id"];
    const id = typeof bruto === "string" ? bruto : "";

    let cita;
    try {
      cita = await repositorio.cambiarEstadoDePago(id, validacion.valor);
    } catch (fallo) {
      throw errorDeAlmacenamiento(fallo, MENSAJE_SIN_LECTURA);
    }

    if (cita === null) throw new ErrorHttp(404, "No encontramos esa cita.");

    res.setHeader("Cache-Control", "no-store");
    // La cita como QUEDÓ, no como se pidió que quedara (FR-022).
    res.json(cita);
  });

  return router;
}

/**
 * Registra la cita traduciendo cualquier fallo del almacenamiento a un 503 con
 * mensaje propio.
 *
 * Por qué no se deja caer al manejador genérico: ese devuelve un 500 con "Ocurrió
 * un error inesperado", y acá el cliente necesita saber tres cosas distintas —que
 * la cita NO quedó, que no es culpa suya, y que puede escribir por WhatsApp—. La
 * diferencia entre 500 y 503 también importa del lado del navegador, que decide
 * con eso si conserva lo escrito.
 */
async function crearOFallarConMensaje(
  repositorio: RepositorioCitas,
  datos: NuevaCita,
): Promise<ResultadoCreacion> {
  try {
    return await repositorio.crear(datos);
  } catch (fallo) {
    throw errorDeAlmacenamiento(fallo, MENSAJE_SIN_ALMACENAMIENTO);
  }
}

/**
 * Convierte un fallo del almacenamiento en un 503 que no filtra nada.
 *
 * El detalle técnico se registra por consola —hace falta para diagnosticar— pero
 * NO viaja al cliente: el error de un driver de base de datos puede traer el
 * host, el usuario y a veces fragmentos de la consulta con datos personales
 * adentro (FR-017).
 */
function errorDeAlmacenamiento(fallo: unknown, mensajeUsuario: string): ErrorHttp {
  console.error("[error] fallo de almacenamiento:", fallo instanceof Error ? fallo.stack : String(fallo));
  return new ErrorHttp(503, mensajeUsuario);
}
