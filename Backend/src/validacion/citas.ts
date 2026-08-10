import type { DetalleValidacion } from "../http/errores.js";
import type { CitaDelCliente, EstadoCita, FiltroCitas } from "../tipos/cita.js";
import { ESTADOS_CITA } from "../tipos/cita.js";
import { TIPOS_VEHICULO, type TipoVehiculo } from "../tipos/servicio.js";
import { esFechaValida, fechaHoyEnColombia } from "../utilidades/fecha.js";
import { LIMITES as LIMITES_MENSAJES, type Resultado } from "./mensajes.js";

/**
 * VALIDACIÓN DE CITAS
 *
 * Mismo criterio que `validacion/mensajes.ts`: lista blanca de campos (nada de
 * asignación masiva), todos los errores de una vez, y textos en español que
 * dicen qué campo falló y por qué (principio V).
 *
 * Lo que esta validación NO hace: comprobar que el servicio exista en el
 * catálogo. Eso necesita leer el repositorio, o sea es asíncrono, y meterlo acá
 * obligaría a que toda la validación lo fuera. La ruta resuelve el servicio
 * primero y le pasa el resultado a `validarNuevaCita`.
 */

export const LIMITES_CITA = {
  nombreMin: 2,
  nombreMax: 80,
  telefonoMin: 7,
  telefonoMax: 20,
  emailMax: LIMITES_MENSAJES.emailMax,
  placaMin: 5,
  placaMax: 10,
  pagoMax: 40,
  listadoMax: 500,
  /**
   * Tope por omisión del listado, por el mismo motivo que en mensajes: la
   * respuesta que devuelve datos personales nunca sale sin tope, y nadie se
   * acuerda de pedirlo.
   */
  listadoPorOmision: 200,
} as const;

/** Laxa a propósito: solo descarta lo que claramente no es un correo. */
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** 'HH:MM' en 24 horas. El formulario ofrece franjas fijas, pero acá caen los envíos a mano. */
const FORMATO_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Teléfono colombiano tal como lo escribe la gente: dígitos, espacios, guiones,
 * paréntesis y un `+` inicial. No se normaliza ni se exige un formato único —
 * quien atiende el mostrador va a llamar a ese número, no a compararlo.
 */
const FORMATO_TELEFONO = /^\+?[\d\s()-]+$/;

/**
 * Placa colombiana: letras y números, con o sin guion (ABC123, ABC-123, AB123C
 * para motos). Se guarda en mayúsculas para que el panel no muestre la misma
 * placa escrita de tres formas distintas.
 */
const FORMATO_PLACA = /^[A-Z0-9-]+$/;

function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

interface OpcionesTexto {
  campo: string;
  etiqueta: string;
  min: number;
  max: number;
  errores: DetalleValidacion[];
}

/** Valida un campo de texto obligatorio; acumula errores y devuelve el valor recortado. */
function validarTexto(valor: unknown, opciones: OpcionesTexto): string | null {
  const { campo, etiqueta, min, max, errores } = opciones;

  if (valor === undefined || valor === null || valor === "") {
    errores.push({ campo, mensaje: `${etiqueta} es obligatorio.` });
    return null;
  }

  if (typeof valor !== "string") {
    errores.push({ campo, mensaje: `${etiqueta} debe ser texto.` });
    return null;
  }

  const limpio = valor.trim();

  if (limpio.length === 0) {
    errores.push({ campo, mensaje: `${etiqueta} es obligatorio.` });
    return null;
  }

  if (limpio.length < min || limpio.length > max) {
    errores.push({ campo, mensaje: `${etiqueta} debe tener entre ${min} y ${max} caracteres.` });
    return null;
  }

  return limpio;
}

/** ¿Es uno de los cuatro tipos de vehículo del catálogo? */
export function esTipoVehiculo(valor: unknown): valor is TipoVehiculo {
  return typeof valor === "string" && (TIPOS_VEHICULO as readonly string[]).includes(valor);
}

/**
 * Valida el cuerpo de POST /api/citas.
 *
 * Devuelve SOLO los campos permitidos. `id`, `status`, `creadoEn` y
 * `serviceName` se ignoran aunque vengan: los define el servidor. Hoy el
 * navegador manda un `id` que se arma solo con `Date.now()` recortado; acá se
 * descarta sin decir nada, que es lo correcto — no es un error del cliente, es
 * un campo que no le corresponde.
 *
 * `service` se valida como texto no vacío. Que ESE id exista en el catálogo lo
 * comprueba la ruta, que es quien puede leer el repositorio.
 */
export function validarNuevaCita(cuerpo: unknown): Resultado<CitaDelCliente> {
  if (!esObjetoPlano(cuerpo)) {
    return {
      ok: false,
      errores: [{ campo: "cuerpo", mensaje: "Se esperaba un objeto JSON con los datos de la cita." }],
    };
  }

  const errores: DetalleValidacion[] = [];

  const clientName = validarTexto(cuerpo["clientName"], {
    campo: "clientName",
    etiqueta: "El nombre",
    min: LIMITES_CITA.nombreMin,
    max: LIMITES_CITA.nombreMax,
    errores,
  });

  const phone = validarTexto(cuerpo["phone"], {
    campo: "phone",
    etiqueta: "El teléfono",
    min: LIMITES_CITA.telefonoMin,
    max: LIMITES_CITA.telefonoMax,
    errores,
  });

  if (phone !== null && !FORMATO_TELEFONO.test(phone)) {
    errores.push({ campo: "phone", mensaje: "El teléfono solo puede tener números, espacios y guiones." });
  }

  /*
   * El correo es el ÚNICO campo opcional (FR-024). Ausente, nulo o vacío es
   * válido y significa "este cliente no dejó correo": la cita se registra igual y
   * no se intenta ningún envío. Si viene, tiene que ser un correo de verdad —
   * mandar la confirmación a una dirección mal escrita no le sirve a nadie.
   */
  let email: string | undefined;
  const emailBruto = cuerpo["email"];
  if (emailBruto !== undefined && emailBruto !== null && emailBruto !== "") {
    if (typeof emailBruto !== "string") {
      errores.push({ campo: "email", mensaje: "El correo electrónico debe ser texto." });
    } else {
      const limpio = emailBruto.trim();
      if (limpio.length === 0) {
        // Solo espacios: se trata como "no dejó correo", no como error.
        email = undefined;
      } else if (limpio.length > LIMITES_CITA.emailMax) {
        errores.push({
          campo: "email",
          mensaje: `El correo electrónico debe tener como máximo ${LIMITES_CITA.emailMax} caracteres.`,
        });
      } else if (!FORMATO_EMAIL.test(limpio)) {
        errores.push({ campo: "email", mensaje: "El correo electrónico no tiene un formato válido." });
      } else {
        email = limpio;
      }
    }
  }

  /*
   * Cédula: opcional, y solo la manda el formulario rápido. Se acepta ausente,
   * nula o vacía sin protestar. Si viene, se valida el formato mínimo: solo
   * dígitos, que es como se escribe una cédula colombiana.
   */
  let cedula: string | undefined;
  const cedulaBruta = cuerpo["cedula"];
  if (cedulaBruta !== undefined && cedulaBruta !== null && cedulaBruta !== "") {
    if (typeof cedulaBruta !== "string") {
      errores.push({ campo: "cedula", mensaje: "La cédula debe ser texto." });
    } else {
      const limpia = cedulaBruta.replace(/[\s.]/g, "");
      if (limpia.length === 0) {
        cedula = undefined;
      } else if (!/^\d{5,15}$/.test(limpia)) {
        errores.push({ campo: "cedula", mensaje: "La cédula debe tener entre 5 y 15 dígitos." });
      } else {
        cedula = limpia;
      }
    }
  }

  const placaBruta = validarTexto(cuerpo["plate"], {
    campo: "plate",
    etiqueta: "La placa",
    min: LIMITES_CITA.placaMin,
    max: LIMITES_CITA.placaMax,
    errores,
  });

  // Se normaliza a mayúsculas ANTES de validar el formato: quien escribe 'abc123'
  // no cometió un error, solo no usó mayúsculas.
  const plate = placaBruta === null ? null : placaBruta.toUpperCase();
  if (plate !== null && !FORMATO_PLACA.test(plate)) {
    errores.push({ campo: "plate", mensaje: "La placa solo puede tener letras, números y guion." });
  }

  const vehicleBruto = cuerpo["vehicle"];
  let vehicle: TipoVehiculo | null = null;
  if (!esTipoVehiculo(vehicleBruto)) {
    errores.push({
      campo: "vehicle",
      mensaje: `El tipo de vehículo debe ser uno de: ${TIPOS_VEHICULO.join(", ")}.`,
    });
  } else {
    vehicle = vehicleBruto;
  }

  const service = validarTexto(cuerpo["service"], {
    campo: "service",
    etiqueta: "El servicio",
    min: 1,
    max: 80,
    errores,
  });

  const date = validarFechaDeCita(cuerpo["date"], errores);

  const timeBruto = cuerpo["time"];
  let time: string | null = null;
  if (typeof timeBruto !== "string" || !FORMATO_HORA.test(timeBruto.trim())) {
    errores.push({ campo: "time", mensaje: "La hora debe tener el formato HH:MM." });
  } else {
    time = timeBruto.trim();
  }

  const payment = validarTexto(cuerpo["payment"], {
    campo: "payment",
    etiqueta: "El medio de pago",
    min: 1,
    max: LIMITES_CITA.pagoMax,
    errores,
  });

  if (
    errores.length > 0 ||
    clientName === null ||
    phone === null ||
    plate === null ||
    vehicle === null ||
    service === null ||
    date === null ||
    time === null ||
    payment === null
  ) {
    return { ok: false, errores };
  }

  const valor: CitaDelCliente = {
    clientName,
    phone,
    plate,
    vehicle,
    service,
    date,
    time,
    payment,
  };

  // `exactOptionalPropertyTypes` está activo: la propiedad se agrega solo si hay
  // valor, en vez de quedar presente con `undefined`.
  if (email !== undefined) valor.email = email;
  if (cedula !== undefined) valor.cedula = cedula;

  return { ok: true, valor };
}

/**
 * La fecha tiene que existir y no ser anterior a hoy EN COLOMBIA (FR-007).
 *
 * Se compara contra `fechaHoyEnColombia()` y no contra UTC: después de las 7 de
 * la tarde hora local, UTC ya está en el día siguiente y rechazaría como
 * "pasada" una cita para hoy — justo cuando alguien agenda desde el celular al
 * salir del trabajo. Es el mismo error que ya se corrigió en el frontend.
 */
function validarFechaDeCita(valor: unknown, errores: DetalleValidacion[]): string | null {
  if (typeof valor !== "string" || !esFechaValida(valor)) {
    errores.push({ campo: "date", mensaje: "La fecha debe tener el formato AAAA-MM-DD y ser una fecha real." });
    return null;
  }

  if (valor < fechaHoyEnColombia()) {
    errores.push({ campo: "date", mensaje: "La fecha no puede ser anterior a hoy." });
    return null;
  }

  return valor;
}

/** ¿Es uno de los tres estados válidos? */
export function esEstadoCita(valor: unknown): valor is EstadoCita {
  return typeof valor === "string" && (ESTADOS_CITA as readonly string[]).includes(valor);
}

/** Valida el cuerpo de PATCH /api/citas/:id/estado. */
export function validarCambioDeEstado(cuerpo: unknown): Resultado<EstadoCita> {
  if (!esObjetoPlano(cuerpo) || !esEstadoCita(cuerpo["status"])) {
    return {
      ok: false,
      errores: [
        { campo: "status", mensaje: "El estado debe ser 'pendiente', 'atendida' o 'cancelada'." },
      ],
    };
  }

  return { ok: true, valor: cuerpo["status"] };
}

/**
 * Valida los filtros opcionales de GET /api/citas.
 *
 * Sin parámetros devuelve el tope por omisión, no un filtro vacío: mismo criterio
 * que en mensajes.
 */
export function validarFiltroCitas(consulta: Record<string, unknown>): Resultado<FiltroCitas> {
  const errores: DetalleValidacion[] = [];
  const filtro: FiltroCitas = {};

  for (const campo of ["desde", "hasta"] as const) {
    const valor = consulta[campo];
    if (valor === undefined) continue;
    if (typeof valor !== "string" || !esFechaValida(valor)) {
      errores.push({ campo, mensaje: `El parámetro '${campo}' debe ser una fecha con formato AAAA-MM-DD.` });
      continue;
    }
    filtro[campo] = valor;
  }

  if (filtro.desde !== undefined && filtro.hasta !== undefined && filtro.desde > filtro.hasta) {
    errores.push({ campo: "desde", mensaje: "La fecha inicial no puede ser posterior a la fecha final." });
  }

  const estado = consulta["estado"];
  if (estado !== undefined) {
    if (!esEstadoCita(estado)) {
      errores.push({
        campo: "estado",
        mensaje: "El parámetro 'estado' debe ser 'pendiente', 'atendida' o 'cancelada'.",
      });
    } else {
      filtro.estado = estado;
    }
  }

  const limite = consulta["limite"];
  if (limite === undefined) {
    filtro.limite = LIMITES_CITA.listadoPorOmision;
  } else {
    const numero = typeof limite === "string" ? Number(limite) : NaN;
    if (!Number.isInteger(numero) || numero < 1 || numero > LIMITES_CITA.listadoMax) {
      errores.push({
        campo: "limite",
        mensaje: `El parámetro 'limite' debe ser un número entero entre 1 y ${LIMITES_CITA.listadoMax}.`,
      });
    } else {
      filtro.limite = numero;
    }
  }

  return errores.length > 0 ? { ok: false, errores } : { ok: true, valor: filtro };
}
