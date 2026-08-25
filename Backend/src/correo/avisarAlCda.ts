import { config } from "../config.js";
import type { Cita } from "../tipos/cita.js";
import type { Mensaje } from "../tipos/mensaje.js";

/**
 * AVISOS AL CDA
 *
 * Distinto de `enviarConfirmacion.ts`, que le escribe AL CLIENTE. Esto le
 * escribe al mostrador: cita nueva, comprobante subido, mensaje de contacto.
 *
 * Igual que aquel: se manda DESPUÉS de responder, NUNCA LANZA, y su fallo no
 * altera nada. Si no llega, el dato está en el panel igual — el panel es el
 * canal principal y el correo es el que avisa, no el que guarda.
 *
 * ⚠️ ESTOS CORREOS LLEVAN DATOS PERSONALES: nombre, teléfono, placa y, en el del
 * comprobante, un documento financiero adjunto. Van a UNA sola dirección, la del
 * CDA (`CORREO_ADMIN`), nunca a una lista.
 *
 * HOY NO MANDA NADA, a propósito. Sin `RESEND_API_KEY`, `CORREO_REMITENTE` y
 * `CORREO_ADMIN` la función corta antes de tocar la red. Falta el trámite: crear
 * la cuenta de Resend y verificar el dominio con sus registros DNS. El
 * destinatario puede ser un Gmail; el REMITENTE no, tiene que ser del dominio
 * verificado.
 */

const API_DE_RESEND = "https://api.resend.com/emails";

/** Mismo corte que el aviso al cliente: nadie está esperando esta llamada. */
const CORTE_MS = 10000;

/** Con adjunto se aflojan los tiempos: van megas, no kilobytes. */
const CORTE_CON_ADJUNTO_MS = 30000;

export interface ResultadoDeAviso {
  enviado: boolean;
  /** Por qué no se envió. Solo para registrar; nunca viaja al cliente. */
  motivo?: string;
}

interface Adjunto {
  filename: string;
  /** Contenido en base64, que es lo que acepta Resend. */
  content: string;
}

const APAGADO: ResultadoDeAviso = { enviado: false, motivo: "los avisos al CDA no están configurados" };

function estaConfigurado(): boolean {
  return config.claveDeResend !== "" && config.correoRemitente !== "" && config.correoAdmin !== "";
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Una tabla simple de etiqueta/valor. Todo valor pasa por `escaparHtml`. */
function tabla(filas: readonly (readonly [string, string])[]): string {
  const cuerpo = filas
    .map(
      ([etiqueta, valor]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#555">${escaparHtml(etiqueta)}</td>` +
        `<td style="padding:6px 0"><strong>${escaparHtml(valor)}</strong></td></tr>`,
    )
    .join("");
  return `<table style="border-collapse:collapse;font:15px system-ui,sans-serif">${cuerpo}</table>`;
}

function textoPlano(filas: readonly (readonly [string, string])[]): string {
  return filas.map(([etiqueta, valor]) => `${etiqueta}: ${valor}`).join("\n");
}

async function mandar(
  asunto: string,
  html: string,
  texto: string,
  adjuntos?: readonly Adjunto[],
): Promise<ResultadoDeAviso> {
  if (!estaConfigurado()) return APAGADO;

  try {
    const cuerpo: Record<string, unknown> = {
      from: config.correoRemitente,
      // UNA dirección: la del CDA. Nada de copias ni de acumular destinatarios.
      to: [config.correoAdmin],
      subject: asunto,
      html,
      text: texto,
    };
    if (adjuntos !== undefined && adjuntos.length > 0) cuerpo["attachments"] = adjuntos;

    const respuesta = await fetch(API_DE_RESEND, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.claveDeResend}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(adjuntos === undefined ? CORTE_MS : CORTE_CON_ADJUNTO_MS),
    });

    if (!respuesta.ok) {
      // El cuerpo del error puede repetir el destinatario. Solo el código.
      return { enviado: false, motivo: `Resend respondió ${respuesta.status}` };
    }

    return { enviado: true };
  } catch (fallo) {
    return { enviado: false, motivo: fallo instanceof Error ? fallo.message : "fallo desconocido" };
  }
}

function filasDeCita(cita: Cita): readonly (readonly [string, string])[] {
  const filas: (readonly [string, string])[] = [
    ["Cliente", cita.clientName],
    ["Teléfono", cita.phone],
  ];
  if (cita.cedula !== undefined) filas.push(["Cédula", cita.cedula]);
  if (cita.email !== undefined) filas.push(["Correo", cita.email]);
  filas.push(
    ["Vehículo", `${cita.vehicle} — ${cita.plate}`],
    ["Servicio", cita.serviceName],
    ["Fecha y hora", `${cita.date} a las ${cita.time}`],
    ["Medio de pago", cita.payment],
    ["Número de cita", cita.id],
  );
  return filas;
}

/** Aviso de cita nueva, pague como pague. */
export async function avisarCitaNueva(cita: Cita): Promise<ResultadoDeAviso> {
  const filas = filasDeCita(cita);
  const enLinea = cita.pagoEstado === "pendiente";

  const nota = enLinea
    ? "<p>Eligió pagar en línea y <strong>todavía no subió el comprobante</strong>. " +
      "Revisa el panel más tarde o llámalo.</p>"
    : "";
  const notaTexto = enLinea ? "\n\nEligió pagar en línea y TODAVÍA NO subió el comprobante." : "";

  return await mandar(
    `Cita nueva — ${cita.date} ${cita.time} — ${cita.plate}`,
    `<h2 style="font:600 18px system-ui,sans-serif">Cita nueva</h2>${tabla(filas)}${nota}`,
    `CITA NUEVA\n\n${textoPlano(filas)}${notaTexto}`,
  );
}

/**
 * Aviso de comprobante subido, con el archivo adjunto.
 *
 * El archivo va adjunto y no como enlace: un enlace al bucket privado caduca en
 * un minuto y no serviría de nada en una bandeja de entrada, y uno permanente
 * sería abrir el bucket. Igual hay que verificarlo en el panel — este correo
 * avisa, no reemplaza la verificación.
 */
export async function avisarComprobante(cita: Cita, archivo: Buffer, tipo: string): Promise<ResultadoDeAviso> {
  const filas = filasDeCita(cita);
  const extension = tipo.split("/")[1] ?? "bin";

  return await mandar(
    `Comprobante de pago — ${cita.clientName} — ${cita.plate}`,
    `<h2 style="font:600 18px system-ui,sans-serif">Comprobante de pago recibido</h2>` +
      `${tabla(filas)}<p>El comprobante va adjunto. <strong>Verifícalo en el panel</strong> ` +
      `para que la cita deje de figurar como pendiente de revisión.</p>`,
    `COMPROBANTE DE PAGO RECIBIDO\n\n${textoPlano(filas)}\n\n` +
      "El comprobante va adjunto. Verifícalo en el panel.",
    [{ filename: `comprobante-${cita.plate}.${extension}`, content: archivo.toString("base64") }],
  );
}

/** Aviso de mensaje del formulario de contacto. */
export async function avisarMensaje(mensaje: Mensaje): Promise<ResultadoDeAviso> {
  const filas: readonly (readonly [string, string])[] = [
    ["Nombre", mensaje.name],
    ["Correo", mensaje.email],
    ["Fecha", mensaje.date],
  ];

  return await mandar(
    `Mensaje de contacto — ${mensaje.name}`,
    `<h2 style="font:600 18px system-ui,sans-serif">Mensaje de contacto</h2>${tabla(filas)}` +
      `<p style="font:15px system-ui,sans-serif;white-space:pre-wrap;border-left:3px solid #ddd;padding-left:12px">` +
      `${escaparHtml(mensaje.message)}</p>`,
    `MENSAJE DE CONTACTO\n\n${textoPlano(filas)}\n\n${mensaje.message}`,
  );
}
