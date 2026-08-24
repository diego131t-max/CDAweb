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
const zlib = require("zlib");

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
  // Sin esta línea, sitemap.xml se entrega como application/octet-stream y
  // Search Console lo rechaza sin leerlo. Falla en silencio: el archivo está,
  // se descarga bien, y aun así "no se pudo obtener el sitemap".
  ".xml": "application/xml; charset=utf-8",
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

/* ===========================================================================
 * COMPRESIÓN Y CACHÉ
 *
 * Hasta acá el sitio mandaba 588 KB de texto crudo y sin una sola cabecera de
 * caché: cada visita descargaba todo otra vez. El sistema de `?v=` ya existía
 * para poder cachear para siempre y no lo usaba nadie.
 * =========================================================================== */

/*
 * Qué se comprime. SOLO texto: las imágenes, las fuentes y los WebP ya vienen
 * comprimidos, y pasarlos por gzip gasta CPU para devolver los mismos bytes (a
 * veces alguno más).
 */
const SE_COMPRIME = new Set([".html", ".css", ".js", ".mjs", ".json", ".svg", ".txt", ".xml"]);

/*
 * Los comprimidos se guardan en memoria, y se puede porque los archivos no
 * cambian mientras el proceso vive: un despliegue de Railway levanta un
 * contenedor nuevo con archivos nuevos. Sin esto, cada visitante haría que el
 * servidor vuelva a comprimir los mismos 400 KB de Tailwind.
 *
 * OJO EN DESARROLLO: si editás un archivo con el servidor levantado, se sigue
 * sirviendo la versión comprimida vieja. Reiniciá el proceso, que es lo que ya
 * hacías igual.
 */
const cacheGzip = new Map();

function comprimir(rutaArchivo, datos) {
  if (cacheGzip.has(rutaArchivo)) return Promise.resolve(cacheGzip.get(rutaArchivo));

  return new Promise((resolver) => {
    zlib.gzip(datos, { level: 6 }, (error, comprimido) => {
      // Si falla, o si comprimir no achica nada (archivos diminutos), se sirve
      // crudo. `null` queda cacheado también para no reintentarlo en cada visita.
      const resultado = error || comprimido.length >= datos.length ? null : comprimido;
      cacheGzip.set(rutaArchivo, resultado);
      resolver(resultado);
    });
  });
}

/** ¿El navegador aceptó gzip? Se mira la cabecera, no se asume. */
function aceptaGzip(req) {
  return /\bgzip\b/i.test(String(req.headers["accept-encoding"] || ""));
}

/*
 * Cuánto puede cachear el navegador cada cosa.
 *
 * LA PRIMERA REGLA ES LA QUE IMPORTA. Si `index.html` se cachea, el `?v=` nuevo
 * no le llega nunca a nadie: el sitio queda congelado en la versión actual y
 * arreglarlo requiere que cada visitante limpie su caché a mano. Es el único
 * error de todo esto que no se puede deshacer desde el servidor.
 *
 * `no-cache` no significa "no guardar": significa "guardalo pero preguntá antes
 * de usarlo". Con el ETag de abajo, esa pregunta se contesta con un 304 de nada.
 */
function politicaDeCache(req, extension) {
  if (extension === ".html") return "no-cache";

  // Un pedido con `?v=` apunta a un contenido que no va a cambiar: cuando el
  // archivo cambia, cambia el número y con él la URL. Para eso existe el `?v=`.
  if (String(req.url || "").includes("?v=")) return "public, max-age=31536000, immutable";

  /*
   * EL RESTO REVALIDA, y esto cambió después de que costara una tarde.
   *
   * Acá había `max-age=86400`. O sea: cualquier archivo sin `?v=` —las imágenes
   * que el CSS pide con url(), el logo— se le quedaba al visitante hasta 24
   * horas. Al reemplazar una foto, el servidor servía la nueva de inmediato y
   * quien hubiera entrado ese día seguía viendo la vieja, sin forma de saberlo.
   * Para quien hace el cambio parece que no se aplicó.
   *
   * `no-cache` no es "no guardar": es "guardalo pero preguntá antes de usarlo".
   * Con el ETag que ya se manda, esa pregunta se contesta con un 304 vacío
   * —unos cientos de bytes— y el navegador reusa lo que tiene. El costo es un
   * viaje de ida y vuelta por archivo; la ganancia es que una foto nueva se ve
   * cuando se sube y no al día siguiente.
   *
   * Las imágenes de las tarjetas NO pasan por acá: desde conVersion() en
   * utils.js viajan con `?v=`, así que caen en la regla de arriba y ni siquiera
   * revalidan. Esta rama es para lo que no puede llevar versión.
   */
  return "no-cache";
}

/* ===========================================================================
 * www → dominio raíz
 *
 * `www.cdavalledupar.com` REDIRIGE, no sirve el sitio, y la diferencia no es de
 * gusto: `CORS_ORIGIN` del API admite UN SOLO origen. Si el sitio respondiera en
 * las dos direcciones, para el navegador serían orígenes distintos y el API
 * rechazaría todo lo que viniera de `www` —sin catálogo, sin agendamiento, sin
 * panel—, pero solo para quienes escribieron `www`. Una falla que le pasa a la
 * mitad de las visitas y a la otra mitad no es la más difícil de diagnosticar.
 *
 * Se resuelve mirando el `Host` en vez de con una variable de entorno: así vale
 * para cualquier dominio, no hay nada que configurar en Railway y no hay forma
 * de que la configuración quede a medias.
 * =========================================================================== */

// Un `Host` sano: letras, dígitos, puntos, guiones y a lo sumo un puerto. Sirve
// para no reenviar a ningún lado raro si alguien manda una cabecera armada a mano
// (un navegador nunca lo hace: el Host sale de la dirección que se escribió).
/* ===========================================================================
 * RUTAS RETIRADAS
 *
 * Una página que se saca del sitio no puede simplemente desaparecer si Google ya
 * la conocía: pasaría a dar 404, y con ella se pierde todo lo que esa dirección
 * hubiera ganado, además de dejar rotos los enlaces que alguien haya compartido.
 *
 * "/servicios" estaba en el mapa del sitio y en el índice de Google cuatro días
 * después de haberla conseguido. Su contenido no se borró: se mudó a
 * "/recomendaciones", ampliado. El 301 le dice a Google exactamente eso y le
 * traslada a la nueva lo que la vieja hubiera ganado.
 *
 * Es una tabla y no un "if" porque esto vuelve a pasar: cada página que se retire
 * agrega una línea acá y no toca nada más.
 * =========================================================================== */
const RUTAS_RETIRADAS = {
  "/servicios": "/recomendaciones",
};

/* ---------------------------------------------------------------------------
 * ALIAS: direcciones que nunca existieron, pero que la gente escribe igual.
 *
 * "/agenda" llegó por WhatsApp como si fuera la página de agendamiento. No sale
 * de ningún enlace del sitio —los catorce dicen "/agendar"—: alguien la escribió
 * de memoria, que es exactamente lo que pasa con una palabra que tiene dos
 * formas casi iguales y una de ellas es más corta.
 *
 * Y lo que veía era el peor caso posible: 200 con la pantalla de "página no
 * encontrada". Ni el visitante entendía que le faltaba una letra —para él el
 * sitio estaba caído— ni ningún monitor se iba a enterar nunca, porque para
 * cualquier revisión automática esa respuesta es un éxito.
 *
 * Va en una tabla aparte de RUTAS_RETIRADAS aunque el 301 sea el mismo, porque
 * no son la misma cosa: aquella muda una página que existió y que tenía
 * posicionamiento ganado; esta perdona un error de tipeo y nunca va a ser una
 * página. Mezclarlas haría que en seis meses nadie sepa cuál es cuál.
 * =========================================================================== */
const ALIAS_DE_RUTAS = {
  "/agenda": "/agendar",
};

/**
 * A dónde tiene que ir esta ruta, o null si se sirve tal cual.
 *
 * Object.hasOwn y no la lectura directa: con TABLA[ruta], un pedido a
 * "/constructor" devuelve una función del prototipo y el servidor intentaría
 * redirigir hacia ella.
 */
function destinoDeRedireccion(ruta) {
  if (Object.hasOwn(RUTAS_RETIRADAS, ruta)) return RUTAS_RETIRADAS[ruta];
  if (Object.hasOwn(ALIAS_DE_RUTAS, ruta)) return ALIAS_DE_RUTAS[ruta];
  return null;
}

const HOST_VALIDO = /^[a-z0-9.-]+(:\d+)?$/i;

function destinoSinWww(req) {
  const host = String(req.headers.host || "");
  if (!host.toLowerCase().startsWith("www.")) return null;

  const sinWww = host.slice(4);
  if (!HOST_VALIDO.test(sinWww)) return null;

  // Se conservan la ruta y la cadena de consulta: quien llegó a
  // www.cdavalledupar.com/#/agendar tiene que terminar en la página de agendar,
  // no en el inicio.
  return `https://${sinWww}${req.url || "/"}`;
}

/** Marca del contenido, para que revalidar cueste un 304 y no el archivo entero. */
function calcularEtag(datos) {
  let hash = 5381;
  for (let i = 0; i < datos.length; i += 1) hash = ((hash * 33) ^ datos[i]) >>> 0;
  return `W/"${datos.length.toString(16)}-${hash.toString(16)}"`;
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

      /*
       * www va a la raíz, y va ANTES que todo lo demás: no tiene sentido leer un
       * archivo del disco para una petición que se va a redirigir igual.
       *
       * 301 y no 302: es permanente, y así el navegador se lo guarda y las
       * visitas siguientes ni pasan por acá.
       */
      const destino = destinoSinWww(req);
      if (destino !== null) {
        res.writeHead(301, {
          ...CABECERAS_DE_SEGURIDAD,
          Location: destino,
          // Que ninguna caché se quede con la redirección de una ruta puntual y
          // se la aplique a otra.
          "Cache-Control": "no-store",
        });
        res.end();
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

      /*
       * Una página retirada, o una dirección mal escrita que sabemos leer,
       * responde 301 a su destino, y va ANTES de tocar el disco: no tiene
       * sentido buscar un archivo que ya se sabe que no está.
       */
      const destinoRedirigido = destinoDeRedireccion(rutaDecodificada);
      if (destinoRedirigido) {
        res.writeHead(301, {
          ...CABECERAS_DE_SEGURIDAD,
          Location: destinoRedirigido,
          "Cache-Control": "no-store",
        });
        res.end();
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

      servirArchivo(req, res, rutaArchivo, rutaDecodificada, false);
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

/* ===========================================================================
 * ENTREGA DE UN ARCHIVO
 *
 * Estaba en línea dentro del manejador y se separó al agregar el respaldo de la
 * SPA: el respaldo necesita volver a entrar acá con OTRO archivo (index.html) y
 * las mismas reglas de compresión, caché y ETag. Una función que se llama a sí
 * misma una vez, en vez de duplicar los sesenta renglones de abajo.
 * =========================================================================== */
function servirArchivo(req, res, rutaArchivo, rutaDecodificada, esRespaldo) {
  fs.readFile(rutaArchivo, async (error, datos) => {
    try {
      if (error) {
        /*
         * RESPALDO DE LA SPA. Esto es lo que hace que /tarifas exista.
         *
         * El sitio ya no enruta por fragmento: /tarifas y /admin/mensajes son
         * URLs de verdad, y una URL de verdad la pide el navegador ANTES de que
         * corra una sola línea de JavaScript. Acá no hay ningún archivo llamado
         * "tarifas", así que sin este respaldo cada enlace compartido por
         * WhatsApp, cada resultado de Google y cada F5 darían 404. El router del
         * navegador nunca llegaría a ejecutarse.
         *
         * La condición es tener extensión o no, y ahí está lo importante: un
         * pedido a /assets/img/moto2t.webp que no existe TIENE que seguir dando
         * 404. Devolverle index.html a un <img> roto le responde 200 y una
         * página HTML donde esperaba una imagen: el navegador no muestra nada,
         * no reporta ningún error, y el problema se vuelve invisible. Peor
         * todavía con un .js que no existe, porque el navegador intenta ejecutar
         * el HTML como si fuera código.
         *
         * `esRespaldo` corta la recursión: si el que falta es index.html, se
         * responde 404 y no se vuelve a entrar acá para siempre.
         */
        if (!esRespaldo && path.extname(rutaDecodificada) === "") {
          servirArchivo(req, res, path.join(raiz, "index.html"), rutaDecodificada, true);
          return;
        }
        responder(res, 404, "No encontrado");
        return;
      }

      const extension = path.extname(rutaArchivo).toLowerCase();
      const etag = calcularEtag(datos);

      const cabeceras = {
        ...CABECERAS_DE_SEGURIDAD,
        "Content-Type": tipos[extension] || "application/octet-stream",
        "Cache-Control": politicaDeCache(req, extension),
        ETag: etag,
        /*
         * `Vary` NO ES OPCIONAL cuando la respuesta cambia según una cabecera
         * del pedido. Sin esto, cualquier caché intermedia puede guardar la
         * versión comprimida y servírsela después a un cliente que no la
         * acepta —o al revés—, y el resultado es una página de basura binaria
         * imposible de diagnosticar desde acá.
         */
        Vary: "Accept-Encoding",
      };

      // Ya lo tiene y no cambió: se ahorra el archivo entero.
      if (req.headers["if-none-match"] === etag) {
        res.writeHead(304, cabeceras);
        res.end();
        return;
      }

      let cuerpo = datos;
      if (SE_COMPRIME.has(extension) && aceptaGzip(req)) {
        const comprimido = await comprimir(rutaArchivo, datos);
        if (comprimido) {
          cuerpo = comprimido;
          cabeceras["Content-Encoding"] = "gzip";
        }
      }

      /*
       * `Content-Length` explícito. Sin él, Node manda la respuesta en trozos
       * (`chunked`) y el navegador no sabe cuánto falta: no puede mostrar
       * progreso ni reservar el buffer de una vez. Va DESPUÉS de comprimir,
       * porque lo que cuenta es lo que efectivamente viaja por el cable.
       *
       * Va solo acá y no en las cabeceras compartidas: una respuesta 304 no
       * lleva cuerpo y anunciarle un largo sería mentirle al cliente.
       */
      cabeceras["Content-Length"] = cuerpo.length;

      res.writeHead(200, cabeceras);
      // HEAD lleva las mismas cabeceras y ningún cuerpo.
      res.end(req.method === "HEAD" ? undefined : cuerpo);
    } catch (error) {
      /*
       * Esta captura es SEPARADA de la que envuelve al manejador, y no es
       * redundante: acá adentro estamos en un callback asíncrono, o sea que el
       * manejador ya retornó y su `try` ya no cubre nada. Lo que se lance en
       * este punto se volvería una excepción sin atrapar, y eso en Node no es
       * un error en la consola: es el proceso entero abajo y el sitio caído.
       */
      console.error("Error entregando el archivo:", error);
      if (!res.headersSent) {
        responder(res, 500, "Error interno");
      } else {
        res.end();
      }
    }
  });
}
