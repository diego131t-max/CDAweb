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
/** Sin proxy delante: es lo que hay en desarrollo, corriendo el API a mano. */
const SALTOS_DE_PROXY_EN_DESARROLLO = 0;

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
          "(https://cdavalledupar.com) en el entorno: sin eso el API autorizaría a un origen equivocado.",
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
        `CORS_ORIGIN='${valor}' no tiene forma de origen. Se espera algo como https://cdavalledupar.com ` +
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

/**
 * TRUST_PROXY: cuántos proxys inversos hay entre internet y este proceso.
 *
 * QUÉ ROMPE SI ESTÁ MAL. Detrás de un proxy (Railway, nginx, Cloudflare) la
 * conexión TCP que ve Express es la DEL PROXY, no la del visitante. El limitador
 * de peticiones agrupa por dirección de red, así que con el valor equivocado
 * TODAS las visitas caen en la misma clave: el tope de 20 peticiones cada 15
 * minutos deja de ser por persona y pasa a ser para todo internet junto. Un solo
 * robot consume el cupo y el formulario de contacto queda cerrado para los
 * clientes del CDA. Falla abierto hacia el lado equivocado: no frena a quien
 * abusa, frena a quien viene a agendar.
 *
 * POR QUÉ UN NÚMERO Y NO `true`. Con `trust proxy: true` Express confía en toda
 * la cadena `X-Forwarded-For` y toma la entrada de más a la izquierda, que es
 * justamente la que puede escribir el cliente: cualquiera saltaría el limitador
 * mandando una cabecera falsa distinta en cada intento. Con la cantidad de
 * saltos, Express cuenta desde el proxy hacia adentro y esa parte de la cadena
 * no se puede falsificar.
 *
 * POR QUÉ ES OBLIGATORIO EN PRODUCCIÓN. Es la misma regla de CORS_ORIGIN
 * (FR-025), y acá pesa más: un valor equivocado no rompe nada visible. El API
 * arranca, responde y pasa las pruebas; el daño aparece semanas después, cuando
 * un cliente no puede escribir y nadie sabe por qué. Se decide al desplegar o no
 * se despliega.
 *
 * Cuánto vale: 0 corriéndolo a mano, 1 en Railway (pone un proxy y solo uno).
 */
function leerSaltosDeProxy(bruto: string | undefined): number {
  const valor = bruto?.trim() ?? "";

  if (valor === "") {
    if (enProduccion) {
      abortarPorConfiguracion(
        "TRUST_PROXY no está definido y NODE_ENV=production. Decí cuántos proxys hay delante del API: " +
          "1 en Railway o detrás de un nginx, 0 si el proceso recibe las conexiones directo de internet. " +
          "Sin esto el limitador de peticiones cuenta a todos los visitantes en el mismo cupo y termina " +
          "bloqueando a los clientes del CDA en vez de a quien abusa.",
      );
    }
    avisarValorDeDesarrollo(
      `TRUST_PROXY no está definido: se asume que no hay proxy delante (${SALTOS_DE_PROXY_EN_DESARROLLO}). ` +
        "Definilo en 1 antes de publicar detrás de Railway o de un proxy inverso.",
    );
    return SALTOS_DE_PROXY_EN_DESARROLLO;
  }

  // Un valor inválido corta el arranque siempre, igual que PORT: no es una
  // omisión, es un error tipeado a mano.
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 0 || numero > 10) {
    abortarPorConfiguracion(
      `TRUST_PROXY='${valor}' no es una cantidad de saltos válida: tiene que ser un entero entre 0 y 10. ` +
        "Casi siempre es 0 (sin proxy) o 1 (Railway, nginx, un balanceador).",
    );
  }

  return numero;
}

/**
 * DATABASE_URL: dónde vive Postgres.
 *
 * Es donde quedan las citas y los mensajes, o sea los datos personales de los
 * clientes del CDA. Por eso **falta o inválida corta el arranque en producción**
 * (FR-014): la alternativa sería degradar en silencio al almacenamiento en
 * archivo, y eso significa un API que recibe citas y las guarda donde nadie las
 * mira. El principio II pide fallar cerrado, no seguir andando a medias.
 *
 * Sin `NODE_ENV=production` se permite arrancar sin ella, avisando: es lo que
 * necesita quien trabaja en el frontend y no quiere levantar una base para ver
 * una página.
 *
 * ⚠️ TIENE QUE SER LA CADENA DEL POOLER DE SESIÓN, no la conexión directa.
 * La directa (`db.[REF].supabase.co:5432`) es **solo IPv6** salvo que se pague
 * el complemento de IPv4, así que desde un contenedor sin salida IPv6 falla con
 * `ENETUNREACH` o `connection refused` — un error que no menciona IPv6 por
 * ningún lado y manda a revisar contraseñas y cortafuegos durante horas. El
 * pooler de sesión (`aws-[REGION].pooler.supabase.com:5432`) es IPv4 en todos
 * los planes. Ver D2 de specs/003-persistencia-supabase/research.md.
 */
function leerCadenaDeBaseDeDatos(bruto: string | undefined): string {
  const valor = bruto?.trim() ?? "";

  if (valor === "") {
    if (enProduccion) {
      abortarPorConfiguracion(
        "DATABASE_URL no está definida y NODE_ENV=production. Sin base de datos el API no puede " +
          "guardar citas ni mensajes, y arrancar igual significaría recibir datos de clientes para " +
          "no guardarlos en ningún lado. Usá la cadena del POOLER DE SESIÓN de Supabase " +
          "(aws-[región].pooler.supabase.com:5432), no la conexión directa: esa es solo IPv6.",
      );
    }
    avisarValorDeDesarrollo(
      "DATABASE_URL no está definida: el API arranca sin base de datos y los endpoints que la " +
        "necesitan van a fallar. Definila en Backend/.env antes de trabajar con citas o mensajes.",
    );
    return "";
  }

  // Un valor tipeado a mano y mal escrito corta el arranque SIEMPRE, igual que
  // PORT: no es una omisión, es un error.
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    return abortarPorConfiguracion(
      `DATABASE_URL no es una URL válida. Se espera algo como ` +
        `postgres://usuario:clave@host:5432/postgres`,
    );
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    abortarPorConfiguracion(
      `DATABASE_URL tiene el esquema '${url.protocol}' y se esperaba 'postgres:' o 'postgresql:'.`,
    );
  }

  // El mensaje NO incluye el valor: la cadena lleva la contraseña de la base
  // adentro y este texto termina en la consola de despliegue (FR-015, FR-017).
  if (url.hostname === "") {
    abortarPorConfiguracion("DATABASE_URL no tiene host. Copiá la cadena completa desde el panel de Supabase.");
  }

  return valor;
}

/**
 * RESEND_API_KEY y CORREO_REMITENTE: el aviso por correo al cliente.
 *
 * ESTAS DOS NO CORTAN EL ARRANQUE, y es la única excepción a la regla de arriba.
 * El correo es un extra: el valor lo entrega la cita registrada, no el aviso. Un
 * API que se niega a arrancar porque falta una clave de correo deja al CDA sin
 * agendamiento para no mandar un mensaje — el remedio peor que la enfermedad.
 * Sin configurar, el sistema no intenta ningún envío y sigue funcionando entero.
 *
 * Un valor MAL ESCRITO tampoco corta el arranque, a diferencia de PORT o
 * TRUST_PROXY. Se avisa fuerte y se deja el correo apagado: cerrado para la
 * función que está mal configurada, abierto para todo lo demás. Es la misma
 * lógica de fallar cerrado, aplicada al alcance que corresponde.
 *
 * Las dos van juntas: con una sola, no hay envío posible.
 */
function leerConfiguracionDeCorreo(
  claveBruta: string | undefined,
  remitenteBruto: string | undefined,
): { claveDeResend: string; correoRemitente: string } {
  const clave = claveBruta?.trim() ?? "";
  const remitente = remitenteBruto?.trim() ?? "";
  const APAGADO = { claveDeResend: "", correoRemitente: "" };

  if (clave === "" && remitente === "") {
    // Silencio a propósito: no tenerlo configurado es un estado legítimo, no un
    // descuido. Avisar en cada arranque entrenaría a ignorar los avisos.
    return APAGADO;
  }

  if (clave === "" || remitente === "") {
    avisarValorDeDesarrollo(
      "El correo de confirmación queda APAGADO: hacen falta RESEND_API_KEY y CORREO_REMITENTE, y solo " +
        `está ${clave === "" ? "CORREO_REMITENTE" : "RESEND_API_KEY"}. Las citas se registran igual.`,
    );
    return APAGADO;
  }

  // Se acepta 'algo@dominio' y también 'Nombre <algo@dominio>', que es lo que
  // Resend admite como remitente. La comprobación es laxa a propósito: acá
  // interesa descartar lo que claramente no es una dirección, no arbitrar
  // formatos de correo.
  const direccion = remitente.includes("<") ? (remitente.split("<")[1]?.split(">")[0] ?? "") : remitente;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(direccion.trim())) {
    avisarValorDeDesarrollo(
      `CORREO_REMITENTE='${remitente}' no tiene forma de dirección de correo. Se espera ` +
        "'citas@cdavalledupar.com' o 'CDA de Valledupar <citas@cdavalledupar.com>', con un dominio " +
        "verificado en Resend. El correo de confirmación queda APAGADO; las citas se registran igual.",
    );
    return APAGADO;
  }

  return { claveDeResend: clave, correoRemitente: remitente };
}

export const config = {
  puerto: leerPuerto(process.env.PORT),
  origenPermitido: leerOrigenPermitido(process.env.CORS_ORIGIN),
  // Cantidad de proxys inversos delante del API. Lo consume `app.set("trust
  // proxy", …)` en app.ts, y de eso depende que el limitador distinga a un
  // visitante de otro.
  saltosDeProxy: leerSaltosDeProxy(process.env.TRUST_PROXY),
  // Cadena de conexión a Postgres. Cadena vacía significa "no configurada", y
  // eso solo es posible fuera de producción: ver leerCadenaDeBaseDeDatos.
  cadenaDeBaseDeDatos: leerCadenaDeBaseDeDatos(process.env.DATABASE_URL),
  // PROVISIONAL: se retira cuando termine la mudanza de mensajes a Postgres y el
  // volumen de Railway deje de ser el respaldo (T049 y T050 de la 003).
  directorioDatos: process.env.DATA_DIR ?? "./data",
  // PROVISIONAL: token compartido que protege los endpoints de administración
  // hasta que exista la autenticación real (usuarios + sesión). Sin valor por
  // defecto a propósito: si no está configurado, esos endpoints fallan cerrado
  // en vez de quedar públicos. Ver src/middlewares/autenticarAdmin.ts.
  tokenAdmin: process.env.ADMIN_TOKEN ?? "",
  // Correo de confirmación al cliente. Cadenas vacías significan "apagado", y es
  // un estado válido en cualquier entorno: ver leerConfiguracionDeCorreo.
  ...leerConfiguracionDeCorreo(process.env.RESEND_API_KEY, process.env.CORREO_REMITENTE),
} as const;
