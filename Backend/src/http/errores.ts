import type { NextFunction, Request, Response } from "express";

/** Detalle de un campo que no pasó la validación. */
export interface DetalleValidacion {
  campo: string;
  mensaje: string;
}

/**
 * Error con código HTTP y mensaje pensado para mostrarle al usuario (en español).
 * Nunca debe incluir datos personales del cliente en `mensajeUsuario`.
 */
export class ErrorHttp extends Error {
  readonly estado: number;
  readonly mensajeUsuario: string;
  readonly detalles: DetalleValidacion[];

  constructor(estado: number, mensajeUsuario: string, detalles: DetalleValidacion[] = []) {
    super(mensajeUsuario);
    this.name = "ErrorHttp";
    this.estado = estado;
    this.mensajeUsuario = mensajeUsuario;
    this.detalles = detalles;
  }
}

/** 400 con el detalle de los campos inválidos. */
export function errorDeValidacion(detalles: DetalleValidacion[]): ErrorHttp {
  return new ErrorHttp(400, "Los datos enviados no son válidos.", detalles);
}

/** Respuesta 404 uniforme para rutas que no existen. */
export function manejadorNoEncontrado(_req: Request, res: Response): void {
  res.status(404).json({ error: "El recurso solicitado no existe." });
}

/**
 * Manejador de errores final. Traduce cualquier excepción a una respuesta JSON
 * en español y evita filtrar detalles internos o datos personales al cliente.
 */
export function manejadorDeErrores(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Si ya se empezó a enviar la respuesta, delegamos en Express para que corte la conexión.
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ErrorHttp) {
    const cuerpo: { error: string; detalles?: DetalleValidacion[] } = { error: error.mensajeUsuario };
    if (error.detalles.length > 0) cuerpo.detalles = error.detalles;
    res.status(error.estado).json(cuerpo);
    return;
  }

  // JSON mal formado: body-parser adjunta el cuerpo crudo al error, que acá puede
  // contener datos personales. Por eso se responde y se corta SIN loguear el error.
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ error: "El cuerpo de la petición no es JSON válido." });
    return;
  }

  // Cuerpo demasiado grande (límite de express.json).
  if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.too.large") {
    res.status(413).json({ error: "El contenido enviado es demasiado grande." });
    return;
  }

  // Solo se loguea el stack, nunca el cuerpo de la petición.
  console.error("[error] fallo no controlado:", error instanceof Error ? error.stack : String(error));
  res.status(500).json({ error: "Ocurrió un error inesperado. Intenta de nuevo más tarde." });
}
