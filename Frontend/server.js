/*
 * Servidor estático del sitio.
 *
 * Sirve Frontend/ y manda las cabeceras de seguridad. Nació como servidor de desarrollo
 * y hoy es también el que atiende en producción sobre Railway, así que lo que antes era
 * comodidad ahora es obligación: un servidor que se cae con un solo request o que entrega
 * archivos que no debería ya no arruina una tarde de trabajo, deja al CDA sin sitio.
 *
 * OJO CON package.json: usa `require`, o sea CommonJS. Agregarle `"type": "module"` al
 * package.json de al lado lo rompe entero, y el error habla de `require is not defined`
 * sin mencionar el package.json por ningún lado.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const raiz = path.resolve(__dirname);
const port = Number(process.env.PORT || 5173);

/*
 * En qué interfaz escucha.
 *
 * El valor por omisión es 0.0.0.0 A PROPÓSITO, aunque para desarrollar alcanzaría con
 * 127.0.0.1. Un contenedor recibe el tráfico desde afuera de sí mismo: atado a loopback,
 * el proceso arranca bien, no registra ningún error y el sitio igual queda inalcanzable
 * —Railway lo marca caído sin decir por qué—. Entre olvidarse de una variable y que se
 * caiga producción, o que quede expuesto a la red local mientras uno programa, la segunda
 * se paga más barata. Se acota con HOST=127.0.0.1 si molesta.
 */
const host = process.env.HOST || "0.0.0.0";

/*
 * Origen del API, para la política de contenido de abajo.
 *
 * Es la misma dirección que resuelve API_URL en data.js, y hay que sostenerlas iguales:
 * si la política no incluye el origen al que data.js le pide, el navegador bloquea todas
 * las llamadas y el sitio se queda sin catálogo, sin formulario y sin panel.
 */
const origenApi = process.env.API_ORIGIN || "http://localhost:3000";

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
 * CÓMO CONVIVEN LAS DOS. El navegador no elige una: aplica AMBAS y exige que la petición
 * pase por las dos, o sea la INTERSECCIÓN. Por eso el <meta> lista los dos orígenes de API
 * posibles (el de producción y el local) y esta cabecera lista solo el que corresponde al
 * entorno donde está corriendo. Cada uno funciona donde va, y ninguno de los dos deja
 * abierto el del otro. Si en cambio el meta listara solo uno y la cabecera solo el otro,
 * la intersección se quedaría sin ninguno y quedarían bloqueados los dos.
 */
const POLITICA_DE_CONTENIDO = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://images.unsplash.com https://media.base44.com",
  "frame-src https://www.google.com",
  `connect-src 'self' ${origenApi}`,
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

  /*
   * HSTS — que el navegador NUNCA vuelva a intentar http:// en este dominio.
   *
   * Railway ya responde 301 de http a https, y eso no alcanza: la petición que
   * provoca ese redirect viaja en claro. Sobre una red hostil —un wifi de
   * cafetería, un router comprometido— se intercepta antes de que el redirect
   * ocurra. Con esta cabecera, a partir de la segunda visita el navegador ni lo
   * intenta: reescribe la dirección a https él mismo, sin pedir permiso a nadie.
   *
   * El valor es EL MISMO que ya manda el API (helmet lo pone solo allá), para que
   * los dos hosts del CDA digan lo mismo.
   *
   * `includeSubDomains` es seguro acá: los únicos nombres que existen son
   * cdavalledupar.com y api.cdavalledupar.com, los dos solo por HTTPS.
   * `www.cdavalledupar.com` no existe en el DNS. OJO si algún día se agrega un
   * subdominio: con esto puesto, tiene que servir HTTPS válido o queda
   * inalcanzable para todo el que ya visitó el sitio.
   *
   * NO lleva `preload`. Entrar en la lista precargada de los navegadores es una
   * puerta de una sola dirección: salir lleva meses. Esto se revierte bajando el
   * max-age.
   *
   * En desarrollo no molesta: la especificación obliga a los navegadores a
   * IGNORAR esta cabecera cuando llega por HTTP, así que en localhost:5173 no
   * hace nada y no hay ninguna rama que escribir.
   */
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

/*
 * Archivos que están bajo la raíz pero no son del sitio, así que no se entregan:
 * este mismo servidor, los registros que deja al correr, la configuración del editor y
 * los archivos de despliegue. Ninguno guarda secretos —el sitio no tiene—, pero un
 * servidor de archivos entrega lo que le pidan y lo que no es del sitio no se publica.
 */
function estaDenegado(rutaRelativa) {
  const segmentos = rutaRelativa.split(path.sep);
  const nombre = segmentos[segmentos.length - 1].toLowerCase();

  if (segmentos.some((segmento) => segmento.toLowerCase() === ".vscode")) return true;
  if (nombre === "server.js") return true;
  if (nombre === "package.json" || nombre === "package-lock.json") return true;
  if (nombre === "railway.toml") return true;
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
  .listen(port, host, () => {
    console.log(`CDA de Valledupar: escuchando en ${host}:${port}`);
    console.log(`Origen del API autorizado en la política de contenido: ${origenApi}`);
  });
