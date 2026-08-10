import { cerrarConexion } from "./basedatos/conexion.js";
import { crearApp } from "./app.js";
import { config } from "./config.js";
import { tokenAdminEsUtilizable } from "./middlewares/autenticarAdmin.js";

// Este archivo hace UNA sola cosa: arrancar. La construcción de la app vive en
// app.ts para que las pruebas de integración puedan levantarla en un puerto de
// prueba sin arrancar el servidor real.

/**
 * Describe un fallo para el registro SIN arrastrar datos personales.
 *
 * Un `Error` deja ver su stack, que es información del código. Cualquier otra
 * cosa lanzada (un objeto, el cuerpo de una petición, una respuesta de la base
 * de datos) puede traer nombre, correo, teléfono o placa de un cliente, así que
 * NO se imprime su contenido: solo se dice de qué tipo era.
 */
function describirFallo(fallo: unknown): string {
  if (fallo instanceof Error) return fallo.stack ?? `${fallo.name}: ${fallo.message}`;
  return `se lanzó un valor de tipo '${typeof fallo}' que no es un Error (se omite su contenido: podría traer datos de un cliente)`;
}

// FR-029 — Un fallo FUERA del ciclo de atención de una petición no puede tumbar
// el proceso sin dejar constancia. El manejador de errores de Express solo ve lo
// que pasa dentro de una petición: una promesa rechazada en un temporizador, un
// error al escribir el archivo de datos o un fallo del propio `listen` no pasan
// por ahí. Hasta hoy, el proceso se moría en silencio y quien atiende el
// mostrador solo veía que "la página dejó de andar".
//
// Se registran ANTES de construir la app para cubrir también los fallos del
// arranque.

process.on("unhandledRejection", (razon: unknown) => {
  // No se sale del proceso: una promesa rechazada suelta no deja al servidor en
  // un estado inconsistente, y tumbar el API por eso sería peor que seguir
  // atendiendo. Pero queda la constancia, que es lo que faltaba.
  console.error("[error] promesa rechazada sin manejar:", describirFallo(razon));
});

process.on("uncaughtException", (error: unknown) => {
  console.error("[error] excepción no capturada:", describirFallo(error));
  // Acá SÍ se sale, y con código distinto de cero. Después de una excepción no
  // capturada el proceso queda en un estado incierto —a medio camino de una
  // operación que nadie sabe si terminó—, y un API que maneja datos personales
  // en estado incierto es peor que un API caído: el supervisor de procesos lo
  // reinicia limpio, y el código distinto de cero es lo que se lo dice.
  process.exit(1);
});

/*
 * Apagado ordenado.
 *
 * Railway manda SIGTERM antes de reemplazar un contenedor. Sin esto, el proceso
 * muere dejando sus conexiones a Postgres colgadas del lado de Supabase hasta que
 * expiran solas — y en un plan con 60 conexiones en total eso se acumula después
 * de unos cuantos despliegues seguidos, hasta que uno falla por falta de cupo sin
 * que nada haya cambiado en el código.
 *
 * No se espera a que terminen las peticiones en vuelo: `cerrarConexion` ya espera
 * a las consultas activas, y el balanceador dejó de mandar tráfico antes del
 * SIGTERM.
 */
async function apagar(senal: string): Promise<void> {
  console.log(`[apagado] ${senal} recibido, cerrando la conexión a la base…`);
  try {
    await cerrarConexion();
  } catch (fallo) {
    console.error("[apagado] fallo al cerrar la conexión:", describirFallo(fallo));
  }
  process.exit(0);
}

process.on("SIGTERM", () => void apagar("SIGTERM"));
process.on("SIGINT", () => void apagar("SIGINT"));

const app = crearApp();

app.listen(config.puerto, () => {
  console.log(`API del CDA escuchando en http://localhost:${config.puerto}/api`);

  if (!tokenAdminEsUtilizable(config.tokenAdmin)) {
    console.warn(
      "[aviso] ADMIN_TOKEN no es utilizable (falta, tiene menos de 16 caracteres o es el " +
        "valor de ejemplo de .env.example): los endpoints de administración responderán 503 " +
        "hasta que definas uno propio en .env.",
    );
  }
});
