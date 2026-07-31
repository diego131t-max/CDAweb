import "dotenv/config";

// Configuración del API, leída del entorno con valores por defecto de desarrollo.
export const config = {
  puerto: Number(process.env.PORT ?? 3000),
  origenPermitido: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  directorioDatos: process.env.DATA_DIR ?? "./data",
} as const;
