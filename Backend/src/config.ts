import "dotenv/config";

/**
 * Configuración del API, leída del entorno y VALIDADA al arrancar.
 *
 * Por qué se valida (FR-025): antes, `CORS_ORIGIN ?? "http://localhost:5173"`
 * caía en silencio al valor de desarrollo si la variable faltaba. Eso es fallar
 * ABIERTO hacia un origen equivocado: en un servidor de verdad el API terminaría
 * autorizando a un origen que no existe —o peor, a uno que sí existe y no es el
 * del CDA— sin que nadie se entere. Una configuración incompleta tiene que
 * notarse al arrancar, no seis meses después.
 *
 * Regla: los valores de desarrollo se mantienen SOLO si no hay
 * `NODE_ENV=production`, y cuando se usan se dice por consola. En producción,
 * una configuración incompleta o inválida corta el arranque.
 */

const PUERTO_POR_OMISION = 3000;
const ORIGEN_DE_DESARROLLO = "http://localhost:5173";

const enProduccion = process.env.NODE_ENV === "production";

/** Corta el arranque dejando el motivo a la vista. */
function abortarPorConfiguracion(detalle: string): never {
  const mensaje = `[configuración] ${detalle}`;
  console.error(mensaje);
  throw new Error(mensaje);
}

/** Avisa que se está usando un valor de desarrollo. */
function avisarValorDeDesarrollo(detalle: string): void {
  console.warn(`[configuración] ${detalle}`);
}

/**
 * PORT tiene que ser un puerto TCP válido.
 *
 * Un valor inválido corta el arranque SIEMPRE, también en desarrollo: no es una
 * omisión, es un error tipeado a mano. Con `Number("tres mil")` el viejo código
 * llamaba a `listen(NaN)`, que escucha en un puerto al azar — el API "arranca"
 * y el sitio no lo encuentra.
 */
function leerPuerto(bruto: string | undefined): number {
  const valor = bruto?.trim() ?? "";
  if (valor === "") return PUERTO_POR_OMISION;

  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1 || numero > 65535) {
    abortarPorConfiguracion(
      `PORT='${valor}' no es un puerto válido: tiene que ser un número entero entre 1 y 65535. Revisá Backend/.env.`,
    );
  }

  return numero;
}

/**
 * Verifica que el valor tenga forma de origen: `esquema://host[:puerto]`, sin
 * ruta ni barra final. Se rechaza `*` a propósito: abrir el API a cualquier
 * origen contradice el principio II.
 */
function tieneFormaDeOrigen(valor: string): boolean {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  // `origin` descarta ruta, consulta y fragmento: si no coincide con lo escrito,
  // es que había algo más que el origen.
  return url.origin === valor.replace(/\/+$/, "");
}

/** CORS_ORIGIN tiene que estar presente y con forma de URL. */
function leerOrigenPermitido(bruto: string | undefined): string {
  const valor = bruto?.trim() ?? "";

  if (valor === "") {
    if (enProduccion) {
      abortarPorConfiguracion(
        "CORS_ORIGIN no está definido y NODE_ENV=production. Definí el origen del sitio " +
          "(por ejemplo https://cda-valledupar.com) en el entorno: sin eso el API autorizaría a un origen equivocado.",
      );
    }
    avisarValorDeDesarrollo(
      `CORS_ORIGIN no está definido: se usa el origen de desarrollo ${ORIGEN_DE_DESARROLLO}. ` +
        "Definilo en Backend/.env antes de publicar.",
    );
    return ORIGEN_DE_DESARROLLO;
  }

  if (!tieneFormaDeOrigen(valor)) {
    if (enProduccion) {
      abortarPorConfiguracion(
        `CORS_ORIGIN='${valor}' no tiene forma de origen. Se espera algo como https://cda-valledupar.com ` +
          "—esquema y host, sin ruta ni barra final— y no se acepta '*'.",
      );
    }
    avisarValorDeDesarrollo(
      `CORS_ORIGIN='${valor}' no tiene forma de origen (se espera algo como http://localhost:5173, ` +
        `sin ruta ni barra final). Se usa el origen de desarrollo ${ORIGEN_DE_DESARROLLO}.`,
    );
    return ORIGEN_DE_DESARROLLO;
  }

  return valor.replace(/\/+$/, "");
}

export const config = {
  puerto: leerPuerto(process.env.PORT),
  origenPermitido: leerOrigenPermitido(process.env.CORS_ORIGIN),
  directorioDatos: process.env.DATA_DIR ?? "./data",
  // PROVISIONAL: token compartido que protege los endpoints de administración
  // hasta que exista la autenticación real (usuarios + sesión). Sin valor por
  // defecto a propósito: si no está configurado, esos endpoints fallan cerrado
  // en vez de quedar públicos. Ver src/middlewares/autenticarAdmin.ts.
  tokenAdmin: process.env.ADMIN_TOKEN ?? "",
} as const;
