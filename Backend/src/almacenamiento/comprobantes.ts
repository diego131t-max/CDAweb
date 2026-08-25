import { randomUUID } from "node:crypto";

import { config } from "../config.js";

/**
 * ALMACENAMIENTO DE COMPROBANTES DE PAGO
 *
 * Un comprobante es una foto o un PDF que sube un visitante ANÓNIMO —el cliente
 * que acaba de agendar— y que trae su nombre, su banco y a veces su número de
 * cuenta. O sea: es dato personal subido por alguien en quien no se confía. Todo
 * lo de este archivo sale de esas dos cosas.
 *
 * DÓNDE VIVE. En un bucket PRIVADO de Supabase Storage, no en Postgres y no en
 * disco. En Postgres no porque 40 vehículos por día contra un plan de 500 MB
 * llena la base en semanas; en disco no porque el volumen de Railway está en
 * camino de retirarse y un contenedor que se reinicia se lleva los archivos.
 *
 * CÓMO SE HABLA CON SUPABASE. Con `fetch` contra su API REST, igual que
 * `correo/enviarConfirmacion.ts` con Resend, y por el mismo motivo: son tres
 * llamadas HTTP: agregar `@supabase/supabase-js` —con sus transitivas y su
 * superficie de actualización— no se paga solo.
 *
 * FALLA CERRADO. Si faltan las credenciales, `subir` devuelve
 * 'sin-configurar' y la ruta responde 503. Nunca guarda el archivo en otro
 * lado ni sigue de largo dejando la cita como si tuviera comprobante.
 */

/** Lo más grande que se acepta. Una foto de teléfono ronda los 4 MB sin reducir. */
export const TAMANO_MAXIMO = 5 * 1024 * 1024;

/**
 * Corte de las llamadas al almacenamiento.
 *
 * Más largo que el del correo (10 s) porque acá sí hay alguien esperando: el
 * cliente está mirando la pantalla de "subiendo tu comprobante", y sube megas
 * desde un teléfono con datos móviles.
 */
const CORTE_MS = 20000;

/**
 * Tipos aceptados, con sus bytes mágicos.
 *
 * LA CABECERA `Content-Type` NO SE CREE. La manda el navegador y la puede
 * escribir cualquiera: un `.exe` renombrado a `.jpg` llega diciendo
 * `image/jpeg`. Lo que decide es el contenido del archivo.
 */
const FIRMAS: readonly { tipo: string; extension: string; coincide: (b: Buffer) => boolean }[] = [
  { tipo: "image/jpeg", extension: "jpg", coincide: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    tipo: "image/png",
    extension: "png",
    coincide: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    tipo: "image/webp",
    extension: "webp",
    coincide: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
  },
  { tipo: "application/pdf", extension: "pdf", coincide: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
];

/** Los tipos que la ruta le declara a `express.raw` para ni siquiera leer el resto. */
export const TIPOS_ACEPTADOS: readonly string[] = FIRMAS.map((firma) => firma.tipo);

export type ResultadoSubida =
  | { resultado: "subido"; ruta: string; tipo: string }
  | { resultado: "sin-configurar" }
  | { resultado: "tipo-no-permitido" }
  | { resultado: "vacio" }
  | { resultado: "fallo"; motivo: string };

/** Está configurado el almacenamiento? Lo consulta la ruta para responder 503. */
export function almacenamientoDisponible(): boolean {
  return config.urlDeStorage !== "" && config.claveDeStorage !== "";
}

/**
 * Identifica el archivo POR SU CONTENIDO. `null` si no es ninguno de los cuatro.
 *
 * Exportada para poder probarla sin salir a la red, igual que `armarContenido`
 * en el módulo de correo. Es la pieza que decide qué entra al bucket, así que es
 * justo la que conviene tener bajo prueba.
 */
export function reconocerComprobante(datos: Buffer): { tipo: string; extension: string } | null {
  if (datos.length < 12) return null;
  const firma = FIRMAS.find((candidata) => candidata.coincide(datos));
  return firma === undefined ? null : { tipo: firma.tipo, extension: firma.extension };
}

function cabeceras(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${config.claveDeStorage}`,
    // Supabase acepta la clave por las dos vías; mandar las dos evita depender
    // de cuál pide la versión del API que esté desplegada.
    apikey: config.claveDeStorage,
    ...extra,
  };
}

/**
 * Sube el comprobante y devuelve su ruta dentro del bucket.
 *
 * El nombre del archivo lo pone el SERVIDOR (`citas/<uuid>.<ext>`), nunca el que
 * mandó el cliente: un nombre de archivo ajeno es una vía de recorrido de rutas
 * y además puede traer datos personales de quien lo subió.
 */
export async function subirComprobante(datos: Buffer): Promise<ResultadoSubida> {
  if (!almacenamientoDisponible()) return { resultado: "sin-configurar" };
  if (datos.length === 0) return { resultado: "vacio" };

  const reconocido = reconocerComprobante(datos);
  if (reconocido === null) return { resultado: "tipo-no-permitido" };

  const ruta = `citas/${randomUUID()}.${reconocido.extension}`;

  try {
    const respuesta = await fetch(
      `${config.urlDeStorage}/storage/v1/object/${config.bucketDeComprobantes}/${ruta}`,
      {
        method: "POST",
        headers: cabeceras({
          "Content-Type": reconocido.tipo,
          // Sin sobrescritura: la ruta lleva un uuid nuevo, así que un choque
          // significaría que algo anda muy mal y conviene que se note.
          "x-upsert": "false",
          "cache-control": "no-store",
        }),
        body: new Uint8Array(datos),
        signal: AbortSignal.timeout(CORTE_MS),
      },
    );

    if (!respuesta.ok) {
      // El cuerpo del error de Supabase puede traer el nombre del bucket y
      // detalles del proyecto. Se registra el código, no el cuerpo.
      return { resultado: "fallo", motivo: `el almacenamiento respondió ${respuesta.status}` };
    }

    return { resultado: "subido", ruta, tipo: reconocido.tipo };
  } catch (fallo) {
    return {
      resultado: "fallo",
      motivo: fallo instanceof Error ? fallo.message : "fallo desconocido al subir",
    };
  }
}

/**
 * URL firmada para mirar un comprobante, válida por poco tiempo.
 *
 * El bucket es privado y NUNCA se abre: el panel no recibe un enlace permanente
 * sino uno que caduca. Si el enlace se filtra —queda en el historial, en una
 * captura, en un chat— deja de servir en un minuto.
 */
export async function urlFirmadaDeComprobante(ruta: string, segundos = 60): Promise<string | null> {
  if (!almacenamientoDisponible()) return null;

  try {
    const respuesta = await fetch(
      `${config.urlDeStorage}/storage/v1/object/sign/${config.bucketDeComprobantes}/${ruta}`,
      {
        method: "POST",
        headers: cabeceras({ "Content-Type": "application/json" }),
        body: JSON.stringify({ expiresIn: segundos }),
        signal: AbortSignal.timeout(CORTE_MS),
      },
    );

    if (!respuesta.ok) return null;

    const cuerpo: unknown = await respuesta.json();
    if (typeof cuerpo !== "object" || cuerpo === null) return null;
    const firmada = (cuerpo as { signedURL?: unknown }).signedURL;
    if (typeof firmada !== "string" || firmada === "") return null;

    return `${config.urlDeStorage}/storage/v1${firmada}`;
  } catch {
    return null;
  }
}
