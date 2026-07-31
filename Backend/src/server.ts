import cors from "cors";
import express from "express";

import { config } from "./config.js";

const app = express();

app.use(cors({ origin: config.origenPermitido }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ estado: "ok" });
});

// Las rutas de citas, mensajes y autenticación se montan acá.

app.listen(config.puerto, () => {
  console.log(`API del CDA escuchando en http://localhost:${config.puerto}/api`);
});
