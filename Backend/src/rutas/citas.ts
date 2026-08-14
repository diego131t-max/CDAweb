import { Router, type RequestHandler } from "express";

import { enviarConfirmacionDeCita } from "../correo/enviarConfirmacion.js";
import { ErrorHttp, errorDeValidacion } from "../http/errores.js";
import type { RepositorioCitas } from "../repositorios/repositorioCitas.js";
import type { RepositorioServicios } from "../repositorios/repositorioServicios.js";
import type { Cita, NuevaCita } from "../tipos/cita.js";
import { servicioAplicaAVehiculo } from "../tipos/servicio.js";
import { validarCambioDeEstado, validarFiltroCitas, validarNuevaCita } from "../validacion/citas.js";

/** Aviso por correo al cliente. Se inyecta para poder probar que su fallo no rompe nada. */
export type EnviarConfirmacion = (cita: Cita) => Promise<unknown>;

export interface DependenciasRutasCitas {
  repositorio: RepositorioCitas;
  repositorioServicios: RepositorioServicios;
  autenticacionAdmin: RequestHandler;
  /** Por omisión, el envío real por Resend. */
  enviarConfirmacion?: EnviarConfirmacion;
}

/** Lo que ve el cliente cuando la base no responde. No revela nada de adentro. */
const MENSAJE_SIN_ALMACENAMIENTO =
  "No pudimos registrar tu cita en este momento. Intenta de nuevo en unos minutos o escríbenos por WhatsApp.";

const MENSAJE_SIN_LECTURA =
  "No pudimos consultar las citas en este momento. Intenta de nuevo en unos minutos.";

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
}: DependenciasRutasCitas): Router {
  const router = Router();

  // POST /api/citas — PÚBLICO. Es una de las dos únicas operaciones públicas del
  // sistema, y la constitución lo autoriza explícitamente.
  router.post("/", async (req, res) => {
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

    const cita = await crearOFallarConMensaje(repositorio, datos);

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
async function crearOFallarConMensaje(repositorio: RepositorioCitas, datos: NuevaCita) {
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
