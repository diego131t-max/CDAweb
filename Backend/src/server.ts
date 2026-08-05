import { crearApp } from "./app.js";
import { config } from "./config.js";
import { tokenAdminEsUtilizable } from "./middlewares/autenticarAdmin.js";

// Este archivo hace UNA sola cosa: arrancar. La construcción de la app vive en
// app.ts para que las pruebas de integración puedan levantarla en un puerto de
// prueba sin arrancar el servidor real.
const app = crearApp();

app.listen(config.puerto, () => {
  console.log(`API del CDA escuchando en http://localhost:${config.puerto}/api`);

  if (!tokenAdminEsUtilizable(config.tokenAdmin)) {
    console.warn(
      "[aviso] ADMIN_TOKEN no está configurado (o tiene menos de 16 caracteres): " +
        "los endpoints de administración responderán 503 hasta que lo definas en .env.",
    );
  }
});
