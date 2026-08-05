import { Router, type RequestHandler } from "express";

export interface DependenciasRutasAdmin {
  autenticacionAdmin: RequestHandler;
}

/**
 * Rutas de administración.
 *
 * Por qué existe `GET /sesion`: el panel necesita comprobar si la credencial
 * sirve ANTES de mostrar nada. Sondear con `GET /api/mensajes` funcionaría, pero
 * ensuciaría el registro de accesos a datos personales con entradas que no son
 * lecturas reales —y además transportaría datos personales de clientes solo para
 * responder sí o no—. Un endpoint que no devuelve ningún dato mantiene ese
 * registro honesto: cada entrada de lectura corresponde a una lectura de verdad.
 *
 * Usa el MISMO `autenticacionAdmin` que el resto de los endpoints privados. No
 * se escribe acá una segunda comparación de credenciales: dos caminos de
 * autenticación es como uno de los dos queda flojo.
 */
export function crearRutasAdmin({ autenticacionAdmin }: DependenciasRutasAdmin): Router {
  const router = Router();

  // GET /api/admin/sesion — PRIVADO. Solo responde si la credencial es válida.
  // Sin cuerpo ni parámetros: cualquier cadena de consulta se ignora.
  router.get("/sesion", autenticacionAdmin, (_req, res) => {
    // Que ni el navegador ni un proxy guarden el resultado de la verificación:
    // la credencial se revalida contra el servidor en cada carga del panel.
    res.setHeader("Cache-Control", "no-store");
    // La respuesta es idéntica para toda credencial válida: no revela nada.
    res.json({ estado: "ok" });
  });

  return router;
}
