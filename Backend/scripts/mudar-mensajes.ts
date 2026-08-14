import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import postgres from "postgres";

import { esFechaValida } from "../src/utilidades/fecha.js";

/**
 * MUDA LOS MENSAJES DEL ARCHIVO JSON A POSTGRES
 *
 *   cd Backend && DATABASE_URL=... DATA_DIR=/data npx tsx scripts/mudar-mensajes.ts
 *
 * De un solo uso, pero SE PUEDE CORRER LAS VECES QUE HAGA FALTA. Cada mensaje se
 * inserta con su `id` original y `on conflict (id) do nothing`, así que una
 * segunda corrida no duplica nada y una primera corrida que se cortó a la mitad
 * se termina repitiéndola. Eso no es un lujo: es lo que permite ejecutar una
 * migración de datos de clientes sin miedo.
 *
 * SE CONSERVAN `id`, `date` y `creadoEn` DEL REGISTRO ORIGINAL. Un mensaje del 8
 * de agosto sigue siendo del 8 de agosto: la fecha de la mudanza no es un dato
 * del negocio y sobrescribirla borraría el único registro de cuándo escribió esa
 * persona.
 *
 * DÓNDE VIVE EL ARCHIVO. En producción está en el volumen de Railway, montado en
 * `/data` dentro del contenedor del API — no es accesible desde una máquina de
 * trabajo. Para correrlo allá hay que ejecutarlo DENTRO del servicio (cambiando
 * temporalmente el comando de arranque a este script y volviéndolo a dejar como
 * estaba). Si el volumen está vacío, este script lo dice y no hace nada, que es
 * exactamente lo que tiene que pasar.
 *
 * NO IMPRIME DATOS PERSONALES. Ni nombres, ni correos, ni el texto de los
 * mensajes: solo cantidades, fechas e identificadores. Un registro de consola
 * queda guardado en la plataforma y lo lee cualquiera con acceso al panel
 * (principio II de la constitución).
 */

const ARCHIVO = "mensajes.json";
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un mensaje tal como lo guardó la implementación en archivo. */
interface MensajeEnArchivo {
  id: string;
  name: string;
  email: string;
  message: string;
  date: string;
  creadoEn: string;
}

function esTextoConContenido(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim() !== "";
}

/**
 * Revisa que un registro tenga todo lo que la tabla exige.
 *
 * Devuelve el motivo del rechazo, o `null` si está bien. El motivo NO incluye el
 * valor del campo: decir "el correo 'juan@...' es inválido" sería escribir un
 * dato personal en la consola.
 */
function motivoDeRechazo(dato: unknown, posicion: number): string | null {
  if (typeof dato !== "object" || dato === null || Array.isArray(dato)) {
    return `El elemento ${posicion} no es un objeto.`;
  }

  const registro = dato as Record<string, unknown>;

  if (!esTextoConContenido(registro["id"]) || !ES_UUID.test(registro["id"])) {
    return `El elemento ${posicion} no tiene un 'id' con forma de UUID.`;
  }
  for (const campo of ["name", "email", "message", "date", "creadoEn"] as const) {
    if (!esTextoConContenido(registro[campo])) {
      return `Al mensaje ${registro["id"]} le falta '${campo}' o está vacío.`;
    }
  }
  if (!esFechaValida(registro["date"] as string)) {
    return `El mensaje ${registro["id"]} tiene 'date' fuera del formato AAAA-MM-DD.`;
  }
  if (Number.isNaN(Date.parse(registro["creadoEn"] as string))) {
    return `El mensaje ${registro["id"]} tiene 'creadoEn' que no es una fecha ISO.`;
  }

  return null;
}

async function main(): Promise<void> {
  const cadena = process.env["DATABASE_URL"]?.trim() ?? "";
  if (cadena === "") {
    console.error(
      "Falta DATABASE_URL. Usá la cadena del POOLER DE SESIÓN de Supabase " +
        "(aws-[región].pooler.supabase.com:5432), no la conexión directa.",
    );
    process.exit(1);
  }

  const directorio = process.env["DATA_DIR"]?.trim() ?? "data";
  const ruta = resolve(directorio, ARCHIVO);

  let contenido: string;
  try {
    contenido = await readFile(ruta, "utf8");
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      // No es un fallo: es el estado normal de un volumen donde nadie escribió
      // todavía, y también el de uno recién creado.
      console.log(`No existe ${ruta}. No hay nada que mudar.`);
      return;
    }
    throw error;
  }

  const datos: unknown = contenido.trim() === "" ? [] : JSON.parse(contenido);
  if (!Array.isArray(datos)) {
    console.error(`${ruta} debería contener un arreglo.`);
    process.exit(1);
  }

  if (datos.length === 0) {
    console.log(`${ruta} está vacío. No hay nada que mudar.`);
    return;
  }

  /*
   * Se valida TODO ANTES de escribir una sola fila. Si un registro está roto, la
   * corrida se detiene sin haber tocado la base: se arregla el archivo y se
   * vuelve a correr. La alternativa —insertar hasta encontrar el malo— deja una
   * mudanza a medias y obliga a averiguar cuánto alcanzó a entrar.
   */
  const rechazos = datos.map((dato, i) => motivoDeRechazo(dato, i)).filter((m): m is string => m !== null);

  if (rechazos.length > 0) {
    console.error(`${rechazos.length} de ${datos.length} registros no se pueden mudar. No se insertó nada:\n`);
    for (const motivo of rechazos) console.error(`  · ${motivo}`);
    process.exit(1);
  }

  const mensajes = datos as MensajeEnArchivo[];
  console.log(`${mensajes.length} mensajes en ${ruta}.`);

  const sql = postgres(cadena, { ssl: "require", connect_timeout: 15, max: 1 });

  try {
    const antes = await contar(sql);

    /*
     * Todo dentro de una transacción: o entran los que faltaban, o no entra
     * ninguno. Combinado con `on conflict do nothing`, correrlo dos veces es
     * seguro y correrlo después de un corte también.
     */
    let insertados = 0;
    await sql.begin(async (tx) => {
      for (const mensaje of mensajes) {
        const filas = await tx`
          insert into cda.mensajes (id, nombre, correo, mensaje, fecha, creado_en)
          values (
            ${mensaje.id}::uuid, ${mensaje.name}, ${mensaje.email}, ${mensaje.message},
            ${mensaje.date}::date, ${mensaje.creadoEn}::timestamptz
          )
          on conflict (id) do nothing
          returning id
        `;
        // `returning` no devuelve nada cuando el `on conflict` descartó la fila:
        // así se distingue "insertado ahora" de "ya estaba".
        if (filas.length > 0) insertados += 1;
      }
    });

    const despues = await contar(sql);

    console.log(`\nInsertados ahora ....... ${insertados}`);
    console.log(`Ya estaban ............. ${mensajes.length - insertados}`);
    console.log(`Total en la base ....... ${antes} → ${despues}`);

    if (despues < mensajes.length) {
      console.error(
        `\n⚠ La base tiene ${despues} mensajes y el archivo ${mensajes.length}. Falta revisar por qué.`,
      );
      process.exit(1);
    }
  } finally {
    await sql.end({ timeout: 10 });
  }
}

async function contar(sql: postgres.Sql): Promise<number> {
  const filas = await sql<{ total: string }[]>`select count(*)::text as total from cda.mensajes`;
  return Number(filas[0]?.total ?? 0);
}

await main();
