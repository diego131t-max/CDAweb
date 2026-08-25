import { Router } from "express";

import {
  BANDAS,
  CATEGORIAS_TARIFA,
  COMPONENTES_TARIFA,
  VIGENCIA_TARIFAS,
} from "../tipos/tarifa.js";

/**
 * GET /api/tarifas — PÚBLICO.
 *
 * Es información comercial que el sitio ya publica en /tarifas, y que además es
 * REGULADA por el Estado: la misma en todos los CDA del país. No hay nada acá que
 * proteger — ni un dato de cliente, ni una cifra del negocio que la competencia
 * no pueda leer en la página.
 *
 * Existe para que la tabla viva en UN SOLO LUGAR. Antes estaba en
 * `Frontend/data.js` y el backend tenía una copia para poder calcular el valor de
 * la cita sin creerle al cliente. Esa duplicación se sostenía con una prueba que
 * comparaba número por número, pero un precio duplicado es una bomba de tiempo:
 * el día que las dos copias se separen, el sitio cotiza una cifra y el panel
 * muestra otra. Mismo camino que ya recorrió el catálogo de servicios.
 *
 * NO devuelve totales calculados, a propósito: devuelve los componentes y el
 * sitio los suma, igual que hace el servidor al registrar una cita. Un total
 * escrito puede contradecir a las líneas que tiene debajo; uno sumado, no.
 */
export function crearRutasTarifas(): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    // Cacheable: son precios que cambian una vez al año y no dependen de quién
    // pregunta. Una hora en el navegador y en cualquier proxy del camino.
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json({
      vigencia: VIGENCIA_TARIFAS,
      categorias: CATEGORIAS_TARIFA,
      bandas: BANDAS,
      // Como pares [clave, rótulo] para que el orden del desglose lo mande el
      // servidor y no dependa de cómo el navegador recorra un objeto.
      componentes: COMPONENTES_TARIFA,
    });
  });

  return router;
}
