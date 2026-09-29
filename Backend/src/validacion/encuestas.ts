import type { DetalleValidacion } from "../http/errores.js";
import { NOTA_MAXIMA, NOTA_MINIMA, type NuevaEncuesta } from "../tipos/encuesta.js";
import type { Resultado } from "./mensajes.js";

export { validarFiltroMensajes as validarFiltroEncuestas } from "./mensajes.js";

export const LIMITES_ENCUESTA = {
  sugerenciasMax: 1000,
} as const;

function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/**
 * Valida una nota. Solo se acepta un NÚMERO entero del rango: "5" como texto se
 * rechaza a propósito. El formulario manda `Number(...)`, y aceptar más formas
 * es aceptar entradas que ningún formulario real produce.
 */
function validarNota(valor: unknown, campo: string, etiqueta: string, errores: DetalleValidacion[]): number | null {
  if (valor === undefined || valor === null) {
    errores.push({ campo, mensaje: `${etiqueta} es obligatoria.` });
    return null;
  }

  if (typeof valor !== "number" || !Number.isInteger(valor) || valor < NOTA_MINIMA || valor > NOTA_MAXIMA) {
    errores.push({ campo, mensaje: `${etiqueta} debe ser un número entero entre ${NOTA_MINIMA} y ${NOTA_MAXIMA}.` });
    return null;
  }

  return valor;
}

/**
 * Valida el cuerpo de POST /api/encuestas y devuelve solo los campos permitidos.
 * Ignora cualquier campo extra (incluidos `id` y `date`, que son del servidor).
 */
export function validarNuevaEncuesta(cuerpo: unknown): Resultado<NuevaEncuesta> {
  if (!esObjetoPlano(cuerpo)) {
    return {
      ok: false,
      errores: [{ campo: "cuerpo", mensaje: "Se esperaba un objeto JSON con los datos de la encuesta." }],
    };
  }

  const errores: DetalleValidacion[] = [];

  const calificacionServicio = validarNota(
    cuerpo["calificacionServicio"],
    "calificacionServicio",
    "La calificación del servicio",
    errores,
  );
  const calificacionInstalaciones = validarNota(
    cuerpo["calificacionInstalaciones"],
    "calificacionInstalaciones",
    "La calificación de las instalaciones",
    errores,
  );

  // Las sugerencias son opcionales: ausente, nula o solo espacios significa "no
  // escribió nada", y se guarda como ausente, no como cadena vacía.
  let sugerencias: string | undefined;
  const bruta = cuerpo["sugerencias"];
  if (bruta !== undefined && bruta !== null) {
    if (typeof bruta !== "string") {
      errores.push({ campo: "sugerencias", mensaje: "Las sugerencias deben ser texto." });
    } else {
      const limpia = bruta.trim();
      if (limpia.length > LIMITES_ENCUESTA.sugerenciasMax) {
        errores.push({
          campo: "sugerencias",
          mensaje: `Las sugerencias no pueden pasar de ${LIMITES_ENCUESTA.sugerenciasMax} caracteres.`,
        });
      } else if (limpia.length > 0) {
        sugerencias = limpia;
      }
    }
  }

  if (errores.length > 0 || calificacionServicio === null || calificacionInstalaciones === null) {
    return { ok: false, errores };
  }

  const valor: NuevaEncuesta = { calificacionServicio, calificacionInstalaciones };
  if (sugerencias !== undefined) valor.sugerencias = sugerencias;
  return { ok: true, valor };
}
