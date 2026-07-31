import "dotenv/config";

// Configuración del API, leída del entorno con valores por defecto de desarrollo.
export const config = {
  puerto: Number(process.env.PORT ?? 3000),
  origenPermitido: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  directorioDatos: process.env.DATA_DIR ?? "./data",
  // PROVISIONAL: token compartido que protege los endpoints de administración
  // hasta que exista la autenticación real (usuarios + sesión). Sin valor por
  // defecto a propósito: si no está configurado, esos endpoints fallan cerrado
  // en vez de quedar públicos. Ver src/middlewares/autenticarAdmin.ts.
  tokenAdmin: process.env.ADMIN_TOKEN ?? "",
} as const;
