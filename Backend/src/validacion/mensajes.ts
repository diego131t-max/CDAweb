import type { DetalleValidacion } from "../http/errores.js";
import type { FiltroMensajes, NuevoMensaje } from "../tipos/mensaje.js";
import { esFechaValida } from "../utilidades/fecha.js";

/** Resultado de una validación: o hay valor limpio, o hay errores por campo. */
export type Resultado<T> = { ok: true; valor: T } | { ok: false; errores: DetalleValidacion[] };

export const LIMITES = {
  nombreMin: 2,
  nombreMax: 80,
  emailMax: 120,
  mensajeMin: 5,
  mensajeMax: 1000,
  listadoMax: 500,
} as const;

// Validación deliberadamente laxa: solo descarta lo que claramente no es un correo.
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/**
 * Valida el cuerpo de POST /api/mensajes y devuelve solo los campos permitidos,
 * ya recortados. Ignora cualquier campo extra que mande el cliente (incluidos
 * `id` y `date`, que son responsabilidad del servidor).
 */
export function validarNuevoMensaje(cuerpo: unknown): Resultado<NuevoMensaje> {
  if (!esObjetoPlano(cuerpo)) {
    return {
      ok: false,
      errores: [{ campo: "cuerpo", mensaje: "Se esperaba un objeto JSON con los datos del mensaje." }],
    };
  }

  const errores: DetalleValidacion[] = [];

  const name = validarTexto(cuerpo["name"], {
    campo: "name",
    etiqueta: "El nombre",
    min: LIMITES.nombreMin,
    max: LIMITES.nombreMax,
    errores,
  });

  const email = validarTexto(cuerpo["email"], {
    campo: "email",
    etiqueta: "El correo electrónico",
    min: 1,
    max: LIMITES.emailMax,
    errores,
  });

  if (email !== null && !FORMATO_EMAIL.test(email)) {
    errores.push({ campo: "email", mensaje: "El correo electrónico no tiene un formato válido." });
  }

  const message = validarTexto(cuerpo["message"], {
    campo: "message",
    etiqueta: "El mensaje",
    min: LIMITES.mensajeMin,
    max: LIMITES.mensajeMax,
    errores,
  });

  if (errores.length > 0 || name === null || email === null || message === null) {
    return { ok: false, errores };
  }

  return { ok: true, valor: { name, email, message } };
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

/**
 * Valida los filtros opcionales de GET /api/mensajes (?desde=&hasta=&limite=).
 * Sin parámetros devuelve un filtro vacío.
 */
export function validarFiltroMensajes(consulta: Record<string, unknown>): Resultado<FiltroMensajes> {
  const errores: DetalleValidacion[] = [];
  const filtro: FiltroMensajes = {};

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

  const limite = consulta["limite"];
  if (limite !== undefined) {
    const numero = typeof limite === "string" ? Number(limite) : NaN;
    if (!Number.isInteger(numero) || numero < 1 || numero > LIMITES.listadoMax) {
      errores.push({
        campo: "limite",
        mensaje: `El parámetro 'limite' debe ser un número entero entre 1 y ${LIMITES.listadoMax}.`,
      });
    } else {
      filtro.limite = numero;
    }
  }

  return errores.length > 0 ? { ok: false, errores } : { ok: true, valor: filtro };
}
