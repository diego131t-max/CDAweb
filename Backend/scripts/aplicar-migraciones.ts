import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

/**
 * APLICA LAS MIGRACIONES DE Backend/migraciones/ EN ORDEN
 *
 *   cd Backend && npx tsx scripts/aplicar-migraciones.ts
 *
 * Lee `DATABASE_URL` del entorno (o del .env, vía config).
 *
 * Por qué existe en vez de pegar el SQL en el panel de Supabase: pegar a mano no
 * es reproducible ni auditable. Nadie sabe después si lo que corrió es
 * exactamente lo que dice el repositorio, ni en qué orden, ni si alguien se
 * saltó un archivo. Acá el archivo versionado ES lo que se ejecuta.
 *
 * Las migraciones son idempotentes (`create ... if not exists`), así que volver a
 * correr esto no rompe nada. NO hay tabla de migraciones aplicadas y no hace
 * falta: con dos archivos idempotentes, el estado deseado se alcanza corriendo
 * todo. El día que haya migraciones destructivas —un `drop column`— eso deja de
 * ser cierto y hay que agregar el registro antes de escribir la primera.
 */

const aqui = dirname(fileURLToPath(import.meta.url));
const CARPETA = join(aqui, "..", "migraciones");

async function main(): Promise<void> {
  const cadena = process.env["DATABASE_URL"]?.trim() ?? "";
  if (cadena === "") {
    console.error(
      "Falta DATABASE_URL. Usá la cadena del POOLER DE SESIÓN de Supabase " +
        "(aws-[región].pooler.supabase.com:5432), no la conexión directa.",
    );
    process.exit(1);
  }

  const archivos = (await readdir(CARPETA)).filter((nombre) => nombre.endsWith(".sql")).sort();

  if (archivos.length === 0) {
    console.error(`No hay archivos .sql en ${CARPETA}`);
    process.exit(1);
  }

  const sql = postgres(cadena, { ssl: "require", connect_timeout: 15, max: 1 });

  try {
    for (const archivo of archivos) {
      const contenido = await readFile(join(CARPETA, archivo), "utf8");
      // `.simple()` usa el protocolo simple, que es el único que admite varias
      // sentencias en una sola llamada. Con el extendido, un archivo con más de
      // un `create table` falla.
      await sql.unsafe(contenido).simple();
      console.log(`✔ ${archivo}`);
    }
    console.log(`\n${archivos.length} migraciones aplicadas.`);
  } finally {
    await sql.end({ timeout: 10 });
  }
}

await main();
