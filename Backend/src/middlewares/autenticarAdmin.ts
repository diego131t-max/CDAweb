import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

/**
 * AUTENTICACIÓN PROVISIONAL DE ADMINISTRADOR
 *
 * Mecanismo temporal: un único token compartido que viaja en la cabecera
 * `Authorization: Bearer <token>` y se compara con ADMIN_TOKEN del entorno.
 *
 * No es la solución final —no hay usuarios, ni sesiones, ni rotación, ni
 * expiración— pero sí cierra el agujero real de hoy: /admin y los datos
 * personales de los clientes (nombre, correo, teléfono, placa) están abiertos a
 * cualquiera que escriba la URL.
 *
 * Se reemplaza cuando exista la autenticación real (usuarios + sesión/JWT).
 * Mientras tanto, ningún endpoint que lea o modifique citas o mensajes puede
 * quedar sin este middleware.
 */

/**
 * Longitud mínima del token. Un token corto es adivinable, y como acá protege
 * datos personales, se trata como "sin configurar": el endpoint falla cerrado.
 */
export const LONGITUD_MINIMA_TOKEN = 16;

/** Indica si el token del entorno sirve para proteger el panel. */
export function tokenAdminEsUtilizable(token: string): boolean {
  return token.trim().length >= LONGITUD_MINIMA_TOKEN;
}

/** Extrae el token de una cabecera `Authorization: Bearer <token>`. */
export function extraerTokenBearer(cabecera: string | undefined): string | null {
  if (typeof cabecera !== "string") return null;

  const separador = cabecera.indexOf(" ");
  if (separador === -1) return null;

  const esquema = cabecera.slice(0, separador);
  if (esquema.toLowerCase() !== "bearer") return null;

  const token = cabecera.slice(separador + 1).trim();
  return token.length > 0 ? token : null;
}

/**
 * Compara dos tokens en tiempo constante.
 * Se comparan los hashes SHA-256 para que la duración tampoco revele la
 * longitud del token esperado.
 */
export function tokensCoinciden(recibido: string, esperado: string): boolean {
  const resumen = (valor: string): Buffer => createHash("sha256").update(valor, "utf8").digest();
  return timingSafeEqual(resumen(recibido), resumen(esperado));
}

/**
 * Crea el middleware que protege los endpoints de administración.
 *
 * Recibe el token esperado por parámetro (en vez de leer `config` adentro) para
 * que las rutas se puedan probar sin depender del entorno.
 */
export function crearAutenticacionAdmin(tokenEsperado: string): RequestHandler {
  const habilitado = tokenAdminEsUtilizable(tokenEsperado);
  const token = tokenEsperado.trim();

  return (req, res, next) => {
    // Falla cerrado: sin token configurado, el endpoint NO queda público.
    if (!habilitado) {
      res.status(503).json({
        error: "El panel de administración no está disponible: falta configurar la autenticación en el servidor.",
      });
      return;
    }

    const recibido = extraerTokenBearer(req.header("authorization"));

    if (recibido === null) {
      res.setHeader("WWW-Authenticate", 'Bearer realm="webCDA"');
      res.status(401).json({ error: "Se requiere autenticación de administrador." });
      return;
    }

    if (!tokensCoinciden(recibido, token)) {
      // No se loguea el token recibido ni la IP: no aporta y sí genera rastro.
      res.setHeader("WWW-Authenticate", 'Bearer realm="webCDA"');
      res.status(401).json({ error: "Credenciales de administrador inválidas." });
      return;
    }

    next();
  };
}
