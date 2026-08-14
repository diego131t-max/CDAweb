import net from "node:net";
import tls from "node:tls";

import {
  CERTIFICADO_RAIZ_SUPABASE,
  HUELLA_RAIZ_SUPABASE,
  VENCE_RAIZ_SUPABASE,
} from "../src/basedatos/certificadoSupabase.js";

/**
 * ¿EL CERTIFICADO DEL REPOSITORIO TODAVÍA VALIDA A LA BASE DE VERDAD?
 *
 *   cd Backend && npx tsx scripts/verificar-tls.ts
 *
 * Se le puede pasar otro host:
 *   npx tsx scripts/verificar-tls.ts aws-1-sa-east-1.pooler.supabase.com
 *
 * POR QUÉ EXISTE. El API verifica la conexión a Postgres contra una raíz fijada
 * en el código (ver src/basedatos/certificadoSupabase.ts). Eso es lo correcto
 * —falla cerrado— y tiene un precio: **el día que Supabase rote su CA, o cuando
 * llegue el vencimiento, el API deja de conectar y el CDA se queda sin
 * agendamiento**. El síntoma es un error de TLS que no menciona nada de esto y
 * manda a revisar contraseñas y cortafuegos durante horas.
 *
 * Este script contesta esa pregunta en un renglón, y sirve para dos momentos:
 *
 *   1. ANTES DE DESPLEGAR un cambio de TLS. Si acá no valida, no se despliega.
 *   2. CUANDO EL API NO CONECTA y nadie tocó nada. Es la primera parada.
 *
 * NO PIDE CREDENCIALES. Postgres no habla TLS desde el primer byte: primero hay
 * que mandarle el paquete `SSLRequest` y esperar una 'S'. Recién ahí se levanta
 * el TLS sobre el mismo socket, y ahí ya se puede juzgar el certificado — la
 * autenticación de usuario viene después y no hace falta para esto. Por eso no
 * necesita `DATABASE_URL` ni la contraseña de la base.
 *
 * A propósito NO es una prueba de `npm test`: haría que la suite dependa de
 * internet y de que Supabase esté arriba.
 */

const HOST_POR_OMISION = "aws-0-us-east-1.pooler.supabase.com";
const PUERTO = 5432;
const CODIGO_SSL_REQUEST = 80877103;
const CORTE_MS = 15000;

/** Abre el socket y negocia el permiso para hablar TLS. Devuelve el socket listo. */
function pedirTls(host: string): Promise<net.Socket> {
  return new Promise((resolver, rechazar) => {
    const socket = net.connect(PUERTO, host);
    socket.setTimeout(CORTE_MS, () => {
      socket.destroy();
      rechazar(new Error(`el servidor no respondió en ${CORTE_MS / 1000} s`));
    });
    socket.on("error", rechazar);
    socket.on("connect", () => {
      const paquete = Buffer.alloc(8);
      paquete.writeInt32BE(8, 0);
      paquete.writeInt32BE(CODIGO_SSL_REQUEST, 4);
      socket.write(paquete);
    });
    socket.once("data", (datos) => {
      socket.setTimeout(0);
      const respuesta = String.fromCharCode(datos[0] ?? 0);
      if (respuesta !== "S") {
        socket.destroy();
        rechazar(new Error(`el servidor respondió '${respuesta}': no acepta TLS en este puerto`));
        return;
      }
      resolver(socket);
    });
  });
}

/** Levanta TLS exigiendo la raíz del repositorio, igual que hace el API. */
function levantarTlsEstricto(socket: net.Socket, host: string): Promise<tls.TLSSocket> {
  return new Promise((resolver, rechazar) => {
    const seguro = tls.connect({
      socket,
      servername: host,
      ca: CERTIFICADO_RAIZ_SUPABASE,
      rejectUnauthorized: true,
    });
    seguro.on("secureConnect", () => resolver(seguro));
    seguro.on("error", rechazar);
  });
}

/** Días que faltan para una fecha 'YYYY-MM-DD'. Negativo si ya pasó. */
function diasHasta(fecha: string): number {
  const objetivo = new Date(`${fecha}T00:00:00Z`).getTime();
  return Math.round((objetivo - Date.now()) / 86400000);
}

const host = process.argv[2]?.trim() || HOST_POR_OMISION;

console.log(`Host ....... ${host}:${PUERTO}`);
console.log(`Raíz fijada  Supabase Root 2021 CA, vence ${VENCE_RAIZ_SUPABASE}\n`);

let seguro: tls.TLSSocket;
try {
  seguro = await levantarTlsEstricto(await pedirTls(host), host);
} catch (fallo) {
  const detalle = fallo instanceof Error ? fallo.message : String(fallo);
  console.error(`✗ NO VALIDA: ${detalle}\n`);
  console.error(
    "El API NO va a poder conectarse a la base con esta configuración.\n" +
      "Si esto empezó a fallar de un día para el otro sin que nadie tocara el código,\n" +
      "lo más probable es que Supabase haya rotado su raíz. La nueva se baja de:\n" +
      "  https://supabase-downloads.s3.ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt\n" +
      "y reemplaza la constante de src/basedatos/certificadoSupabase.ts.",
  );
  process.exit(1);
}

const hoja = seguro.getPeerCertificate(true);
// La raíz es el último eslabón: la que se firma a sí misma.
let raiz = hoja;
const vistos = new Set<string>();
while (raiz.issuerCertificate && !vistos.has(raiz.fingerprint256)) {
  vistos.add(raiz.fingerprint256);
  if (raiz.issuerCertificate.fingerprint256 === raiz.fingerprint256) break;
  raiz = raiz.issuerCertificate;
}

console.log(`✔ VALIDA · authorized=${seguro.authorized} · ${seguro.getProtocol()}`);
console.log(`  servidor ... ${hoja.subject?.CN ?? "?"}   (vence ${hoja.valid_to})`);
console.log(`  raíz ....... ${raiz.subject?.CN ?? "?"}`);

const coincide = raiz.fingerprint256 === HUELLA_RAIZ_SUPABASE;
console.log(`  huella ..... ${coincide ? "coincide con la del repositorio" : "NO COINCIDE"}`);

seguro.destroy();

if (!coincide) {
  console.error(
    "\n⚠ La cadena valida pero la raíz que presenta el servidor no es la que dice\n" +
      "  certificadoSupabase.ts. Alguien cambió una de las dos. Revisalo antes de seguir.",
  );
  process.exit(1);
}

const dias = diasHasta(VENCE_RAIZ_SUPABASE);
if (dias < 0) {
  console.error(`\n⚠ La raíz fijada venció hace ${-dias} días.`);
  process.exit(1);
}
if (dias < 180) {
  console.warn(`\n⚠ A la raíz fijada le quedan ${dias} días. Conseguí la nueva antes de que muerda.`);
} else {
  console.log(`\nLe quedan ${dias} días a la raíz. Todo en orden.`);
}
