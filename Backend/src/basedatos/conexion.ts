import postgres, { type Sql } from "postgres";

import { config } from "../config.js";
import { CERTIFICADO_RAIZ_SUPABASE } from "./certificadoSupabase.js";

/**
 * CONEXIÓN A POSTGRES — una sola instancia para todo el proceso
 *
 * `postgres.js` mantiene su propio pool de conexiones por instancia, así que
 * crear una por consulta abriría y cerraría conexiones todo el tiempo. Acá vive
 * la única, creada la primera vez que alguien la pide.
 *
 * Los repositorios la consumen; los manejadores de Express **no la ven nunca**.
 * Esa separación es el principio III y es lo que hizo que migrar de archivo JSON
 * a Postgres fuera escribir otra implementación en vez de reescribir el API.
 */

/** Segundos que se espera para ESTABLECER la conexión antes de darla por fallida. */
const CORTE_DE_CONEXION_S = 5;

/** Milisegundos que puede durar una consulta antes de que Postgres la aborte. */
const CORTE_DE_CONSULTA_MS = 4000;

/** Segundos que una conexión ociosa se mantiene abierta antes de soltarse. */
const OCIOSA_S = 30;

/**
 * Conexiones simultáneas del pool.
 *
 * El plan gratuito de Supabase da 60 en total y ahí adentro también viven los
 * servicios del propio Supabase. Cinco alcanzan de sobra para un CDA con un
 * local, y dejan lugar para las migraciones y para mirar la base a mano sin
 * quedarse sin cupo.
 */
const CONEXIONES_MAXIMAS = 5;

/**
 * Por qué estos números y no otros.
 *
 * El navegador corta a los 6 s (es el criterio que ya usan el catálogo y la
 * verificación de credencial). Los cortes del servidor van POR DEBAJO de eso a
 * propósito: si la base no responde, el API tiene que alcanzar a devolver un
 * error entendible —y en español— antes de que el navegador se rinda solo y le
 * muestre al cliente una falla genérica que no explica nada.
 *
 * 5 s de conexión + 4 s de consulta no suman 6, y no tienen por qué: son dos
 * etapas distintas y ninguna sola debe agotar el presupuesto del cliente.
 */

let instancia: Sql | null = null;

/** Mensaje único cuando falta configuración. No revela la cadena: lleva la contraseña. */
const SIN_CONFIGURAR =
  "DATABASE_URL no está configurada, así que no hay dónde guardar ni de dónde leer. " +
  "Definila en Backend/.env (con la cadena del pooler de sesión de Supabase, no la conexión directa).";

/**
 * Devuelve el cliente de Postgres, creándolo la primera vez.
 *
 * Lanza si no hay configuración. En producción esto no pasa nunca: `config.ts`
 * corta el arranque antes (FR-014). En desarrollo sí puede pasar, y entonces
 * falla acá con un mensaje que dice qué hacer, en vez de dejar que el driver
 * tire un error de red que no explica nada.
 */
export function obtenerSql(): Sql {
  if (instancia !== null) return instancia;

  if (config.cadenaDeBaseDeDatos === "") {
    throw new Error(SIN_CONFIGURAR);
  }

  instancia = postgres(config.cadenaDeBaseDeDatos, {
    max: CONEXIONES_MAXIMAS,
    connect_timeout: CORTE_DE_CONEXION_S,
    idle_timeout: OCIOSA_S,

    /*
     * TLS CON VERIFICACIÓN COMPLETA. La conexión cruza internet abierta llevando
     * nombres, teléfonos, correos, placas y cédulas de clientes.
     *
     * OJO CON "SIMPLIFICAR" ESTO A `ssl: "require"` O A `ssl: "verify-full"`.
     * Las dos son trampas, y en direcciones opuestas:
     *
     *   "require"     postgres.js lo traduce a `rejectUnauthorized: false`. Cifra
     *                 el tránsito y acepta CUALQUIER certificado: alguien que se
     *                 interponga presenta el suyo y la conexión sigue como si
     *                 nada. Es lo que había hasta la T055.
     *
     *   "verify-full" verifica contra las CA públicas que trae Node, y ninguna
     *                 firmó esto: Supabase usa su propia raíz. El servidor
     *                 LEGÍTIMO sería rechazado y el API se quedaría sin base.
     *
     * Pasando un objeto, postgres.js lo mezcla con las opciones de `tls.connect`,
     * que ya incluyen `servername` con el host de la cadena. Por eso esto verifica
     * las dos mitades: que la cadena de firmas llegue a la raíz de Supabase Y que
     * el nombre del servidor coincida.
     *
     * El certificado, de dónde salió y qué hacer si algún día deja de validar
     * están en certificadoSupabase.ts.
     */
    ssl: { ca: CERTIFICADO_RAIZ_SUPABASE, rejectUnauthorized: true },

    connection: {
      // Corte del lado de Postgres. Es el que vale aunque el proceso de Node
      // esté ocupado: lo aplica el servidor, no el cliente.
      statement_timeout: CORTE_DE_CONSULTA_MS,
    },

    // NO se configura `transform`. Sin él, postgres.js no toca los nombres de
    // columna, que es lo que se quiere: el mapeo columna↔campo se escribe a mano
    // en cada repositorio. Un mapeo implícito no falla cuando se equivoca —solo
    // guarda el dato en el lugar equivocado y sigue— y esa clase de error se
    // descubre semanas después, mirando datos que no cuadran.

    /*
     * Las sentencias preparadas quedan ACTIVADAS (es lo que hace postgres.js por
     * omisión) y eso depende de una decisión que se tomó en otro lado: la
     * conexión va por el pooler en modo SESIÓN, puerto 5432.
     *
     * Si alguien cambia la cadena al modo transacción (puerto 6543), esto se
     * rompe: ese modo no soporta sentencias preparadas. El síntoma son errores
     * intermitentes de "prepared statement already exists" que aparecen solo bajo
     * concurrencia, o sea justo cuando hay clientes usando el sitio.
     */
  });

  return instancia;
}

/**
 * Cierra el pool y espera a que terminen las consultas en vuelo.
 *
 * La llama `server.ts` al apagar. Sin esto, un reinicio deja conexiones colgadas
 * del lado de Supabase hasta que expiran solas, y en un plan con 60 conexiones
 * eso se nota después de unos cuantos despliegues seguidos.
 */
export async function cerrarConexion(): Promise<void> {
  if (instancia === null) return;
  const aCerrar = instancia;
  instancia = null;
  await aCerrar.end({ timeout: 5 });
}

/** Solo para las pruebas: olvida la instancia sin cerrarla. */
export function reiniciarConexionParaPruebas(): void {
  instancia = null;
}
