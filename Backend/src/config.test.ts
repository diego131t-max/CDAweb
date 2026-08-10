import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * PRUEBAS DE CONFIGURACIÓN — que falle cerrado, y que se pueda demostrar
 *
 * Lo que se prueba acá no es que la configuración se lea bien: es que una
 * configuración incompleta **corte el arranque** en vez de seguir con valores de
 * desarrollo. Esa es la diferencia entre un API que avisa y uno que atiende
 * clientes guardando sus datos donde nadie los mira.
 *
 * CÓMO SE PRUEBA UN MÓDULO QUE VALIDA AL IMPORTARSE. `config.ts` corre su
 * validación en el cuerpo del módulo, así que no alcanza con llamar a una
 * función: hay que importarlo de nuevo con otro entorno. Node cachea los módulos
 * por especificador, así que se le agrega una cadena de consulta distinta en cada
 * caso para forzar una carga limpia.
 *
 * `config.ts` hace `console.error` antes de lanzar, y `avisarValorDeDesarrollo`
 * escribe por `console.warn`. Las dos se silencian durante las pruebas para que
 * la salida no se llene de ruido esperado.
 */

/** Carga config.ts con el entorno indicado, aislada de cargas anteriores. */
async function cargarConfig(entorno: Record<string, string | undefined>, marca: string): Promise<unknown> {
  const original = { ...process.env };

  // Se limpian las variables que intervienen para que lo que haya en el .env del
  // desarrollador no cambie el resultado de la prueba.
  for (const clave of ["NODE_ENV", "PORT", "CORS_ORIGIN", "TRUST_PROXY", "DATABASE_URL", "ADMIN_TOKEN"]) {
    delete process.env[clave];
  }
  for (const [clave, valor] of Object.entries(entorno)) {
    if (valor !== undefined) process.env[clave] = valor;
  }

  const errorOriginal = console.error;
  const avisoOriginal = console.warn;
  console.error = () => {};
  console.warn = () => {};

  try {
    const modulo = await import(`./config.js?caso=${marca}`);
    return (modulo as { config: unknown }).config;
  } finally {
    console.error = errorOriginal;
    console.warn = avisoOriginal;
    process.env = original;
  }
}

/** Ejecuta la carga y devuelve el error, o falla si no hubo ninguno. */
async function esperarQueCorteElArranque(
  entorno: Record<string, string | undefined>,
  marca: string,
): Promise<Error> {
  try {
    await cargarConfig(entorno, marca);
  } catch (fallo) {
    assert.ok(fallo instanceof Error, "se esperaba un Error");
    return fallo;
  }
  assert.fail("la configuración arrancó cuando debía cortar");
}

const PRODUCCION = {
  NODE_ENV: "production",
  CORS_ORIGIN: "https://cdavalledupar.com",
  TRUST_PROXY: "1",
  DATABASE_URL: "postgres://usuario:clave@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
};

describe("DATABASE_URL", () => {
  it("corta el arranque si falta y NODE_ENV=production", async () => {
    const fallo = await esperarQueCorteElArranque({ ...PRODUCCION, DATABASE_URL: undefined }, "sin-url");

    assert.match(fallo.message, /DATABASE_URL/);
    // El mensaje tiene que decir QUÉ hacer, no solo que algo falta: quien lo lee
    // está mirando los registros de un despliegue caído.
    assert.match(fallo.message, /pooler/i, "el mensaje debe advertir sobre el pooler de sesión");
  });

  it("corta el arranque si no es una URL, también fuera de producción", async () => {
    // Un valor mal escrito no es una omisión, es un error tipeado a mano: corta
    // siempre, igual que PORT.
    const fallo = await esperarQueCorteElArranque({ DATABASE_URL: "no-es-una-url" }, "url-rota");

    assert.match(fallo.message, /DATABASE_URL/);
  });

  it("corta el arranque si el esquema no es de Postgres", async () => {
    const fallo = await esperarQueCorteElArranque(
      { DATABASE_URL: "mysql://usuario:clave@host:3306/base" },
      "esquema-ajeno",
    );

    assert.match(fallo.message, /postgres/i);
  });

  it("NO filtra la cadena en el mensaje de error, porque lleva la contraseña", async () => {
    const fallo = await esperarQueCorteElArranque(
      { DATABASE_URL: "postgres://usuario:CLAVE_SECRETA@:5432/postgres" },
      "sin-host",
    );

    assert.ok(
      !fallo.message.includes("CLAVE_SECRETA"),
      "el mensaje de error no puede incluir la cadena: termina en los registros del despliegue",
    );
  });

  it("acepta una cadena válida y la deja disponible", async () => {
    const cfg = (await cargarConfig(PRODUCCION, "valida")) as { cadenaDeBaseDeDatos: string };

    assert.equal(cfg.cadenaDeBaseDeDatos, PRODUCCION.DATABASE_URL);
  });

  it("permite arrancar sin base de datos fuera de producción", async () => {
    // Quien trabaja en el frontend no debería tener que levantar una base para
    // ver una página.
    const cfg = (await cargarConfig({ CORS_ORIGIN: "http://localhost:5173" }, "dev-sin-base")) as {
      cadenaDeBaseDeDatos: string;
    };

    assert.equal(cfg.cadenaDeBaseDeDatos, "");
  });
});

describe("TRUST_PROXY", () => {
  it("corta el arranque si falta y NODE_ENV=production", async () => {
    // Sin esto el limitador agrupa a todos los visitantes en el mismo cupo y
    // termina bloqueando a los clientes del CDA en vez de a quien abusa. Es el
    // error más silencioso del despliegue: el API arranca, responde y pasa las
    // pruebas igual.
    const fallo = await esperarQueCorteElArranque({ ...PRODUCCION, TRUST_PROXY: undefined }, "sin-proxy");

    assert.match(fallo.message, /TRUST_PROXY/);
  });

  it("corta el arranque con un valor que no es una cantidad de saltos", async () => {
    const fallo = await esperarQueCorteElArranque({ TRUST_PROXY: "si" }, "proxy-invalido");

    assert.match(fallo.message, /TRUST_PROXY/);
  });

  it("asume 0 fuera de producción", async () => {
    const cfg = (await cargarConfig({ CORS_ORIGIN: "http://localhost:5173" }, "proxy-dev")) as {
      saltosDeProxy: number;
    };

    assert.equal(cfg.saltosDeProxy, 0);
  });
});

describe("CORS_ORIGIN", () => {
  it("corta el arranque si falta y NODE_ENV=production", async () => {
    const fallo = await esperarQueCorteElArranque({ ...PRODUCCION, CORS_ORIGIN: undefined }, "sin-cors");

    assert.match(fallo.message, /CORS_ORIGIN/);
  });

  it("tolera la barra final y la normaliza", async () => {
    // Es deliberado: una barra de más es un error de tipeo, no una configuración
    // ambigua, y cortar el arranque por eso sería hostil. Lo que sí importa es
    // que el valor GUARDADO no la lleve, porque el navegador compara el origen
    // carácter por carácter y `https://sitio.com/` nunca coincide con nada.
    const cfg = (await cargarConfig(
      { ...PRODUCCION, CORS_ORIGIN: "https://cdavalledupar.com/" },
      "cors-con-barra",
    )) as { origenPermitido: string };

    assert.equal(cfg.origenPermitido, "https://cdavalledupar.com");
  });

  it("corta el arranque si trae una ruta y NODE_ENV=production", async () => {
    // Un origen es esquema://host[:puerto] y nada más. Con ruta se rechaza en
    // producción en vez de caer al valor de desarrollo, que sería autorizar a un
    // origen equivocado sin que nadie se entere.
    const fallo = await esperarQueCorteElArranque(
      { ...PRODUCCION, CORS_ORIGIN: "https://cdavalledupar.com/api" },
      "cors-con-ruta",
    );

    assert.match(fallo.message, /CORS_ORIGIN/);
  });
});
