/*
 * Servidor estático de desarrollo del sitio.
 *
 * Sirve Frontend/ en http://127.0.0.1:5173 y manda las cabeceras de seguridad. No es un
 * servidor de producción, pero un servidor de desarrollo que se cae con un solo request
 * o que entrega archivos que no debería tampoco sirve para desarrollar tranquilo.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const raiz = path.resolve(__dirname);
const port = Number(process.env.PORT || 5173);

const tipos = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

/*
 * La misma política que declara el <meta> de index.html, más `frame-ancestors 'none'`,
 * que solo funciona como cabecera y por eso no está en el meta.
 *
 * ⚠️ AL PUBLICAR: `connect-src` lleva el origen del API. Se cambia junto con `API_URL` de
 * data.js y con el <meta> de index.html. Son tres lugares y hay que tocar los tres.
 */
const POLITICA_DE_CONTENIDO = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://images.unsplash.com https://media.base44.com",
  "frame-src https://www.google.com",
  "connect-src 'self' http://localhost:3000",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

// Van en TODAS las respuestas, incluidas las de error: un 404 también se puede enmarcar.
const CABECERAS_DE_SEGURIDAD = {
  "Content-Security-Policy": POLITICA_DE_CONTENIDO,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

/*
 * Archivos que están bajo la raíz pero no son del sitio, así que no se entregan:
 * este mismo servidor, los registros que deja al correr, y la configuración del editor.
 */
function estaDenegado(rutaRelativa) {
  const segmentos = rutaRelativa.split(path.sep);
  const nombre = segmentos[segmentos.length - 1].toLowerCase();

  if (segmentos.some((segmento) => segmento.toLowerCase() === ".vscode")) return true;
  if (nombre === "server.js") return true;
  if (nombre.endsWith(".log")) return true;

  return false;
}

function responder(res, estado, cuerpo, tipoContenido) {
  res.writeHead(estado, {
    ...CABECERAS_DE_SEGURIDAD,
    "Content-Type": tipoContenido || "text/plain; charset=utf-8",
  });
  res.end(cuerpo);
}

http
  .createServer((req, res) => {
    try {
      // Solo lectura: un servidor de archivos no tiene por qué aceptar nada más.
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { ...CABECERAS_DE_SEGURIDAD, Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
        res.end("Método no permitido");
        return;
      }

      const rutaPedida = String(req.url || "/").split("?")[0].split("#")[0];

      /*
       * `decodeURIComponent` lanza URIError con una secuencia inválida como "/%": antes no
       * había captura en ningún lado y el proceso se moría con un solo request.
       */
      let rutaDecodificada;
      try {
        rutaDecodificada = decodeURIComponent(rutaPedida);
      } catch (error) {
        responder(res, 400, "Petición inválida");
        return;
      }

      // Un byte nulo en la ruta hace que fs.readFile lance de forma síncrona, o sea: otra
      // caída de un solo request.
      if (rutaDecodificada.includes("\0")) {
        responder(res, 400, "Petición inválida");
        return;
      }

      const rutaArchivo = path.resolve(raiz, "." + (rutaDecodificada === "/" ? "/index.html" : rutaDecodificada));

      /*
       * Comparar con `raiz + path.sep` y no con `raiz` a secas: `startsWith(raiz)` compara
       * texto sin separador, así que un directorio hermano llamado "Frontend-backup"
       * pasaba el filtro.
       */
      if (rutaArchivo !== raiz && !rutaArchivo.startsWith(raiz + path.sep)) {
        responder(res, 403, "Prohibido");
        return;
      }

      if (estaDenegado(path.relative(raiz, rutaArchivo))) {
        responder(res, 403, "Prohibido");
        return;
      }

      fs.readFile(rutaArchivo, (error, datos) => {
        if (error) {
          responder(res, 404, "No encontrado");
          return;
        }

        responder(res, 200, datos, tipos[path.extname(rutaArchivo).toLowerCase()] || "application/octet-stream");
      });
    } catch (error) {
      // Red de última instancia: cualquier fallo inesperado responde 500 en vez de tumbar
      // el proceso y dejar el sitio caído.
      console.error("Error atendiendo la petición:", error);
      if (!res.headersSent) {
        responder(res, 500, "Error interno");
      } else {
        res.end();
      }
    }
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`CDA de Valledupar local: http://127.0.0.1:${port}`);
  });
