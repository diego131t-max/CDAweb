import { config } from "../config.js";
import type { Cita } from "../tipos/cita.js";

/**
 * AVISO POR CORREO DE UNA CITA REGISTRADA
 *
 * Se manda DESPUÉS de que la cita quedó guardada y su resultado no altera nada:
 * ni la respuesta al cliente, ni el registro, ni el estado de la cita. Si falla,
 * el cliente tiene su cita igual y el CDA la ve en el panel igual. Por eso esta
 * función NUNCA LANZA: devuelve si pudo o no y sigue de largo.
 *
 * Se usa `fetch` contra el API de Resend en vez de su cliente oficial. Es una
 * llamada HTTP de quince líneas; agregar una dependencia —con sus transitivas y
 * su superficie de actualización— para eso no se paga solo.
 */

/**
 * Datos de contacto del CDA que van en el correo.
 *
 * OJO, ESTÁN DUPLICADOS: los mismos valores viven en la constante `CDA` de
 * `Frontend/data.js`, que es lo que el sitio publica hoy. No se inventaron acá
 * (principio I): se copiaron de ahí. La duplicación es deuda conocida —el día
 * que el CDA cambie de dirección o de teléfono hay que tocar los dos lados— y se
 * paga a propósito para no darle al backend una dependencia del frontend, que no
 * tiene build ni módulos y no se puede importar.
 *
 * Si algún día el catálogo de servicios se mueve a una tabla, esto se mueve con
 * él y la duplicación desaparece.
 */
const CONTACTO_CDA = {
  nombre: "CDA de Valledupar",
  ubicacion: "Cra. 18D #47 17, San Fernando, Valledupar, Cesar",
  horario: "Lunes a Viernes: 7:30 AM - 6:00 PM | Sábados: 7:30 AM - 1:30 PM",
  telefono: "316 6962144",
  correo: "contacto@cdavalledupar.com",
  sitio: "https://cdavalledupar.com",
} as const;

const API_DE_RESEND = "https://api.resend.com/emails";

/**
 * Corte del envío. Nadie lo está esperando —la respuesta al cliente ya salió—,
 * pero sin tope una llamada colgada se queda con un socket hasta que el sistema
 * operativo se aburra.
 */
const CORTE_MS = 10000;

export interface ResultadoDeEnvio {
  enviado: boolean;
  /** Por qué no se envió. Solo para registrar; nunca viaja al cliente. */
  motivo?: string;
}

const formateadorDeFecha = new Intl.DateTimeFormat("es-CO", {
  // La fecha es un día calendario acordado, no un instante: se formatea en UTC
  // porque así se construyó. Usar la zona del servidor devolvería el día
  // anterior en cualquier máquina al oeste de Greenwich.
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** '2026-12-01' → 'martes, 1 de diciembre de 2026'. Si no se puede, devuelve lo que entró. */
function formatearFecha(fecha: string): string {
  const dia = new Date(`${fecha}T00:00:00Z`);
  if (Number.isNaN(dia.getTime())) return fecha;
  return formateadorDeFecha.format(dia);
}

/** '14:30' → '2:30 p. m.'. En Colombia el reloj de 24 horas no se usa para hablar. */
function formatearHora(hora: string): string {
  const [h, m] = hora.split(":");
  const horas = Number(h);
  if (!Number.isInteger(horas) || m === undefined) return hora;
  const sufijo = horas < 12 ? "a. m." : "p. m.";
  const enDoce = horas % 12 === 0 ? 12 : horas % 12;
  return `${enDoce}:${m} ${sufijo}`;
}

/** Escapa lo que va dentro del HTML. El nombre y la placa los escribió el cliente. */
function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Cuerpo del correo, en español y tuteando, como todo lo que ve el cliente.
 *
 * Dice lo que el sistema SABE: que la cita quedó registrada. No promete que
 * alguien vaya a llamar ni confirma nada que dependa de otra persona.
 *
 * Se exporta para poder probarla: es la parte con lógica de verdad —fechas,
 * horas de doce, escapado— y la única que se puede verificar sin salir a la red.
 * El envío en sí se comprueba mandando un correo real (pasos 11 a 13 de
 * quickstart.md), que es la única prueba que dice algo sobre si llega.
 */
export function armarContenido(cita: Cita): { asunto: string; html: string; texto: string } {
  const fecha = formatearFecha(cita.date);
  const hora = formatearHora(cita.time);

  const filas: [string, string][] = [
    ["Servicio", cita.serviceName],
    ["Vehículo", cita.vehicle],
    ["Placa", cita.plate],
    ["Fecha", fecha],
    ["Hora", hora],
    ["Número de cita", cita.id],
  ];

  const texto = [
    `Hola ${cita.clientName},`,
    "",
    `Tu cita en el ${CONTACTO_CDA.nombre} quedó registrada. Estos son los datos:`,
    "",
    ...filas.map(([etiqueta, valor]) => `  ${etiqueta}: ${valor}`),
    "",
    "Llevá la tarjeta de propiedad y el SOAT vigente.",
    "",
    `Dónde: ${CONTACTO_CDA.ubicacion}`,
    `Horario: ${CONTACTO_CDA.horario}`,
    `Teléfono / WhatsApp: ${CONTACTO_CDA.telefono}`,
    `Correo: ${CONTACTO_CDA.correo}`,
    "",
    "Si necesitás cambiar o cancelar la cita, escribinos por WhatsApp con tu número de cita.",
    "",
    CONTACTO_CDA.sitio,
  ].join("\n");

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2933">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:28px">
    <h1 style="margin:0 0 4px;font-size:20px;color:#0b5cab">Tu cita quedó registrada</h1>
    <p style="margin:0 0 20px;font-size:15px">Hola ${escaparHtml(cita.clientName)}, estos son los datos de tu cita en el ${CONTACTO_CDA.nombre}.</p>
    <table style="width:100%;border-collapse:collapse;font-size:15px">
      ${filas
        .map(
          ([etiqueta, valor]) =>
            `<tr><td style="padding:8px 0;color:#616e7c;width:42%">${etiqueta}</td>` +
            `<td style="padding:8px 0;font-weight:bold">${escaparHtml(valor)}</td></tr>`,
        )
        .join("\n      ")}
    </table>
    <p style="margin:20px 0 0;font-size:15px">Llevá la <strong>tarjeta de propiedad</strong> y el <strong>SOAT vigente</strong>.</p>
    <hr style="border:0;border-top:1px solid #e4e7eb;margin:24px 0">
    <p style="margin:0;font-size:14px;line-height:1.6;color:#3e4c59">
      <strong>${CONTACTO_CDA.nombre}</strong><br>
      ${CONTACTO_CDA.ubicacion}<br>
      ${CONTACTO_CDA.horario}<br>
      Teléfono / WhatsApp: ${CONTACTO_CDA.telefono}<br>
      ${CONTACTO_CDA.correo}
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#616e7c">
      ¿Necesitás cambiar o cancelar? Escribinos por WhatsApp con tu número de cita.
    </p>
  </div>
</body></html>`;

  return { asunto: `Tu cita en el CDA de Valledupar — ${fecha}, ${hora}`, html, texto };
}

/**
 * Manda el aviso de una cita. No lanza nunca.
 *
 * Sin correo del cliente no se intenta nada (FR-024), y sin configuración
 * tampoco: las dos son situaciones normales, no errores.
 */
export async function enviarConfirmacionDeCita(cita: Cita): Promise<ResultadoDeEnvio> {
  if (cita.email === undefined || cita.email.trim() === "") {
    return { enviado: false, motivo: "el cliente no dejó correo" };
  }
  if (config.claveDeResend === "" || config.correoRemitente === "") {
    return { enviado: false, motivo: "el envío de correo no está configurado" };
  }

  try {
    const { asunto, html, texto } = armarContenido(cita);

    const respuesta = await fetch(API_DE_RESEND, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.claveDeResend}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.correoRemitente,
        // ÚNICAMENTE la dirección que escribió este cliente (FR-027). Nada de
        // copias ni de acumular destinatarios: un correo, un destinatario.
        to: [cita.email],
        subject: asunto,
        html,
        text: texto,
      }),
      signal: AbortSignal.timeout(CORTE_MS),
    });

    if (!respuesta.ok) {
      /*
       * Se registra el código y el tipo de error de Resend, NO el cuerpo entero
       * de la respuesta: ese repite la dirección del cliente, y el registro de la
       * plataforma lo lee cualquiera con acceso al panel (principio II).
       */
      const tipo = await tipoDeErrorDeResend(respuesta);
      console.error(`[correo] Resend rechazó el envío de la cita ${cita.id}: HTTP ${respuesta.status} ${tipo}`);
      return { enviado: false, motivo: `Resend respondió ${respuesta.status}` };
    }

    return { enviado: true };
  } catch (fallo) {
    // Se identifica la cita por su id —que no es un dato personal— y nunca por
    // el correo o el nombre de quien agendó.
    const detalle = fallo instanceof Error ? fallo.message : String(fallo);
    console.error(`[correo] no se pudo enviar la confirmación de la cita ${cita.id}: ${detalle}`);
    return { enviado: false, motivo: detalle };
  }
}

/** Saca solo el nombre del error que devuelve Resend ('validation_error', etc.). */
async function tipoDeErrorDeResend(respuesta: Response): Promise<string> {
  try {
    const cuerpo: unknown = await respuesta.json();
    if (typeof cuerpo === "object" && cuerpo !== null && "name" in cuerpo && typeof cuerpo.name === "string") {
      return cuerpo.name;
    }
  } catch {
    // Sin cuerpo legible: con el código de estado alcanza para diagnosticar.
  }
  return "(sin detalle)";
}
