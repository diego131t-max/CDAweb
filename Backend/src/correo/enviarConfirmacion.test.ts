import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Cita } from "../tipos/cita.js";
import { armarContenido, enviarConfirmacionDeCita } from "./enviarConfirmacion.js";

/**
 * Se prueba lo que se puede probar sin salir a la red: el contenido del correo.
 * Que efectivamente LLEGUE se verifica mandando uno de verdad y mirando la
 * bandeja (pasos 11 a 13 de quickstart.md); ninguna prueba automática dice eso.
 */

function citaDeEjemplo(cambios: Partial<Cita> = {}): Cita {
  return {
    id: "3f2c9a10-0000-4000-8000-000000000001",
    clientName: "Ana Pérez",
    phone: "3001234567",
    email: "ana@ejemplo.com",
    plate: "ABC123",
    vehicle: "Vehículos Livianos",
    service: "revision-tecnico-mecanica",
    serviceName: "Revisión Técnico-Mecánica",
    date: "2026-12-01",
    time: "09:00",
    payment: "Efectivo",
    pagoEstado: "no-aplica",
    status: "pendiente",
    creadoEn: "2026-08-14T15:00:00.000Z",
    ...cambios,
  };
}

describe("armarContenido", () => {
  it("incluye servicio, vehículo, fecha, hora y cómo contactar al CDA (FR-023)", () => {
    const { html, texto } = armarContenido(citaDeEjemplo());

    for (const esperado of ["Revisión Técnico-Mecánica", "Vehículos Livianos", "ABC123", "316 6962144"]) {
      assert.ok(texto.includes(esperado), `falta '${esperado}' en la versión de texto`);
      assert.ok(html.includes(esperado), `falta '${esperado}' en la versión HTML`);
    }
    assert.ok(texto.includes("Cra. 18D #47 17"), "el cliente tiene que saber a dónde ir");
  });

  it("escribe la fecha en español y sin correrse de día", () => {
    const { texto, asunto } = armarContenido(citaDeEjemplo({ date: "2026-12-01" }));

    // El riesgo real: construir la fecha en la zona del servidor devuelve el 30
    // de noviembre en cualquier máquina al oeste de Greenwich.
    assert.ok(texto.includes("1 de diciembre de 2026"), `la fecha salió como: ${texto}`);
    assert.ok(asunto.includes("1 de diciembre de 2026"));
  });

  it("pasa la hora a reloj de doce, que es como se habla en Colombia", () => {
    const casos: [string, string][] = [
      ["09:00", "9:00 a. m."],
      ["00:30", "12:30 a. m."],
      ["12:00", "12:00 p. m."],
      ["14:30", "2:30 p. m."],
      ["18:00", "6:00 p. m."],
    ];

    for (const [entrada, salida] of casos) {
      const { texto } = armarContenido(citaDeEjemplo({ time: entrada }));
      assert.ok(texto.includes(salida), `${entrada} tendría que verse como '${salida}'`);
    }
  });

  it("escapa lo que escribió el cliente antes de meterlo en el HTML", () => {
    const { html } = armarContenido(citaDeEjemplo({ clientName: 'Ana <img src=x onerror="alert(1)">' }));

    assert.ok(!html.includes("<img"), "el nombre no puede inyectar etiquetas en el correo");
    assert.ok(html.includes("&lt;img"));
  });

  it("no promete nada que dependa de otra persona", () => {
    const { texto } = armarContenido(citaDeEjemplo());
    assert.ok(texto.includes("quedó registrada"), "se afirma lo único que el sistema sabe con certeza");
  });
});

describe("enviarConfirmacionDeCita", () => {
  it("no intenta nada si el cliente no dejó correo (FR-024)", async () => {
    const sinCorreo = citaDeEjemplo();
    delete sinCorreo.email;

    const resultado = await enviarConfirmacionDeCita(sinCorreo);

    assert.equal(resultado.enviado, false);
    assert.match(resultado.motivo ?? "", /no dejó correo/);
  });

  it("no intenta nada si el envío no está configurado, y no lanza", async () => {
    // La suite corre sin RESEND_API_KEY: este es exactamente el estado de un
    // entorno donde el correo todavía no se contrató.
    const resultado = await enviarConfirmacionDeCita(citaDeEjemplo());

    assert.equal(resultado.enviado, false);
    assert.match(resultado.motivo ?? "", /no está configurado/);
  });
});
