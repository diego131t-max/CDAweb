import cors from "cors";
import express from "express";

import { config } from "./config.js";
import { autenticacionAdmin, repositorioMensajes } from "./dependencias.js";
import { manejadorDeErrores, manejadorNoEncontrado } from "./http/errores.js";
import { tokenAdminEsUtilizable } from "./middlewares/autenticarAdmin.js";
import { crearRutasMensajes } from "./rutas/mensajes.js";

const app = express();

app.use(cors({ origin: config.origenPermitido }));
// Límite chico: los cuerpos que recibe el API son formularios cortos.
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ estado: "ok" });
});

app.use("/api/mensajes", crearRutasMensajes({ repositorio: repositorioMensajes, autenticacionAdmin }));

// Las rutas de citas y autenticación se montan acá.

app.use(manejadorNoEncontrado);
app.use(manejadorDeErrores);

app.listen(config.puerto, () => {
  console.log(`API del CDA escuchando en http://localhost:${config.puerto}/api`);

  if (!tokenAdminEsUtilizable(config.tokenAdmin)) {
    console.warn(
      "[aviso] ADMIN_TOKEN no está configurado (o tiene menos de 16 caracteres): " +
        "los endpoints de administración responderán 503 hasta que lo definas en .env.",
    );
  }
});
