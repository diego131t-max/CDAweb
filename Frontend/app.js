// Aplicación Principal - Router

// Las CUATRO rutas del panel y la sección que le toca a cada una.
//
// Antes esto era un `path.startsWith("/admin")`, así que `/administracion`
// —o cualquier cosa que empezara igual— abría el panel. Con una lista explícita,
// solo coinciden las rutas reales.
const SECCIONES_ADMIN = {
  "/admin": "reservas",
  "/admin/vehiculos": "vehiculos",
  "/admin/mensajes": "mensajes",
  "/admin/reportes": "reportes",
};

// Object.hasOwn y no `SECCIONES_ADMIN[path]`: con la lectura directa, una ruta
// como `/constructor` devuelve algo del prototipo y entra al panel.
function esRutaAdmin(path) {
  return Object.hasOwn(SECCIONES_ADMIN, path);
}

/* ===========================================================================
 * RUTAS REALES (y por qué se dejó el enrutado por fragmento)
 *
 * El sitio enrutaba por hash: `#/tarifas`, `#/faq`, `#/servicios`. Funciona
 * perfecto para una persona y es invisible para un buscador, porque TODO lo que
 * va después del `#` es un fragmento y NUNCA viaja al servidor. Google pedía
 * `cdavalledupar.com/`, descartaba el fragmento y concluía —con razón— que el
 * sitio entero era UNA página. Seis páginas de contenido compitiendo por una
 * sola posición.
 *
 * Ahora cada página es una URL de verdad, y eso arrastra tres cosas que no son
 * opcionales:
 *
 *   1. EL SERVIDOR TIENE QUE COLABORAR. Entrar directo a /tarifas es un pedido
 *      real a un archivo que no existe. server.js responde index.html para
 *      cualquier ruta sin extensión; sin eso, cada enlace compartido da 404.
 *
 *   2. LAS RUTAS RELATIVAS SE ROMPEN. `./styles.css` se resuelve contra el
 *      DIRECTORIO de la URL actual: en /admin/vehiculos apunta a
 *      /admin/styles.css. Por eso todas las rutas de assets pasaron a absolutas
 *      (`/styles.css`). Es el error que deja el panel sin estilos y sin scripts,
 *      y solo en las rutas anidadas.
 *
 *   3. CADA RUTA NECESITA SU PROPIO TÍTULO. Seis URLs con el mismo <title> y la
 *      misma descripción se ven como contenido duplicado; Google elige una y
 *      descarta el resto. De eso se ocupa METADATOS, acá abajo.
 * =========================================================================== */

// El dominio en el que el sitio vive de verdad. Va fijo y NO se toma de
// location.origin a propósito: la canónica de la página que se está viendo en
// localhost tiene que seguir apuntando a producción, que es la que se indexa.
const SITIO = "https://cdavalledupar.com";

// Título y descripción de cada ruta pública.
//
// Son el titular azul y el párrafo gris del resultado de Google, así que se
// escriben con las palabras que la gente busca. Los largos útiles son ~60 y ~155
// caracteres; lo que pase de ahí Google lo corta.
//
// NINGUNA descripción publica precios ni horarios. No es descuido: un fragmento
// de Google se queda cacheado semanas, y una cifra vieja ahí es una promesa
// comercial equivocada que el CDA no puede corregir a tiempo. Las cifras viven
// en la página, que se lee al día.
const METADATOS = {
  "/": {
    titulo: "CDA de Valledupar | Revisión Técnico-Mecánica y de Gases",
    descripcion:
      "Centro de diagnóstico automotor en Valledupar, Cesar. Revisión técnico-mecánica y de gases para motos y vehículos. Agenda tu cita en línea.",
  },
  "/recomendaciones": {
    titulo: "Requisitos y recomendaciones | CDA de Valledupar",
    descripcion:
      "Qué documentos llevar, cómo debe llegar tu vehículo, cuándo te toca la revisión y qué pasa si no apruebas. Todo antes de venir al CDA.",
  },
  "/tarifas": {
    titulo: "Tarifas de revisión técnico-mecánica | CDA Valledupar",
    descripcion:
      "Consulta el valor de referencia de tu revisión técnico-mecánica y de gases en Valledupar según el tipo de vehículo: motos, livianos y pesados.",
  },
  "/faq": {
    titulo: "Preguntas frecuentes | CDA de Valledupar",
    descripcion:
      "Qué revisa un CDA, qué documentos llevar, cómo agendar y dónde quedamos. Respuestas a las dudas más comunes sobre la revisión en Valledupar.",
  },
  "/agendar": {
    titulo: "Agendar cita | CDA de Valledupar",
    descripcion:
      "Agenda en línea tu revisión técnico-mecánica y de gases en el CDA de Valledupar. Elige el día y la hora que mejor te sirvan.",
  },
  "/contacto": {
    titulo: "Contacto y ubicación | CDA de Valledupar",
    descripcion:
      "Estamos en Cra. 18D #47 17, San Fernando, Valledupar. Escríbenos, llámanos al 316 6962144 o encuéntranos en el mapa.",
  },
};

/** Busca un <meta> por atributo, y lo crea si todavía no está. */
function metaEtiqueta(atributo, valor) {
  const selector = `meta[${atributo}="${valor}"]`;
  let etiqueta = document.head.querySelector(selector);
  if (!etiqueta) {
    etiqueta = document.createElement("meta");
    etiqueta.setAttribute(atributo, valor);
    document.head.appendChild(etiqueta);
  }
  return etiqueta;
}

// Título, descripción, canónica y Open Graph de la ruta que se está dibujando.
//
// El panel y la página de "no encontrada" salen con `noindex`: son URLs reales y
// alcanzables, así que sin esto Google las rastrea y puede llegar a mostrar
// "CDA de Valledupar — Iniciar sesión" como resultado del negocio. El panel
// además está desautorizado en robots.txt; las dos capas hacen falta, porque
// robots.txt impide RASTREAR pero no impide INDEXAR una URL que alguien enlace.
function aplicarMetadatosDeRuta(path) {
  const publica = Object.hasOwn(METADATOS, path);
  const meta = publica ? METADATOS[path] : null;

  document.title = meta ? meta.titulo : "Página no encontrada | CDA de Valledupar";

  if (meta) metaEtiqueta("name", "description").setAttribute("content", meta.descripcion);

  metaEtiqueta("name", "robots").setAttribute("content", publica ? "index, follow" : "noindex, follow");

  // La canónica solo tiene sentido en las páginas que sí queremos en el índice.
  // En las demás se apunta a sí misma para no declarar que el panel "es" la home.
  const canonica = document.head.querySelector('link[rel="canonical"]');
  if (canonica) canonica.setAttribute("href", `${SITIO}${path === "/" ? "/" : path}`);

  metaEtiqueta("property", "og:url").setAttribute("content", `${SITIO}${path === "/" ? "/" : path}`);
  if (meta) {
    metaEtiqueta("property", "og:title").setAttribute("content", meta.titulo);
    metaEtiqueta("property", "og:description").setAttribute("content", meta.descripcion);
  }
}

// Los enlaces viejos, con fragmento, siguen llegando a donde iban.
//
// Durante meses el sitio repartió direcciones como cdavalledupar.com/#/agendar:
// están pegadas en conversaciones de WhatsApp, en el botón de Reservas del Perfil
// de Empresa y en el marcador de quien ya agendó una vez. Sin esto, todas caen en
// la home después del despliegue —el servidor entrega index.html para "/" y el
// router mira location.pathname, que es "/", así que el fragmento se ignora en
// silencio—. No es una página rota: es peor, es la página equivocada sin ningún
// aviso.
//
// `replaceState` y no `pushState` a propósito: la URL vieja no tiene por qué
// quedar en el historial, o el botón de atrás rebota entre las dos formas de la
// misma página.
//
// Corre UNA vez, al arrancar. Después de eso el hash no vuelve a cambiar nunca.
function migrarRutaPorFragmento() {
  const fragmento = location.hash;
  if (!fragmento.startsWith("#/")) return;

  const ruta = fragmento.slice(1);
  // "#//otro.com" se convertiría en "//otro.com", que es otro ORIGEN: el
  // navegador lanza SecurityError y el sitio no arranca. Nadie escribe eso a
  // mano, pero un enlace armado a propósito sí.
  if (ruta.startsWith("//")) return;

  history.replaceState(null, "", ruta);
}

// La ruta actual, en el mismo formato que usan SECCIONES_ADMIN y esRutaAdmin.
//
// Se normaliza la barra final: /tarifas y /tarifas/ son la MISMA página, y sin
// esto la segunda cae en "no encontrada".
function rutaActual() {
  const ruta = location.pathname.replace(/\/+$/, "");
  return ruta === "" ? "/" : ruta;
}

// Cambia de página sin recargar.
//
// El caso del `if`: si el destino es la ruta en la que ya estás, pushState no
// dispara nada y el enlace parece roto. Se hace lo que la persona esperaba —subir
// al inicio y cerrar el menú— y se sale.
function navegar(ruta) {
  if (ruta === rutaActual()) {
    document.body.classList.remove("menu-open");
    window.scrollTo({ top: 0 });
    return;
  }
  history.pushState(null, "", ruta);
  render();
}

// Un solo listener para todos los enlaces del sitio.
//
// Va sobre el documento y no sobre cada <a> porque render() destruye el DOM en
// cada cambio de ruta: un listener por enlace habría que volver a colgarlo cada
// vez, y el del render anterior queda apuntando a nodos que ya no existen.
//
// Todo lo que NO es navegación interna se deja pasar sin tocar: `tel:` y
// `mailto:` los abre el sistema, los enlaces externos salen del sitio, y
// ctrl/cmd/clic del medio tienen que seguir abriendo en otra pestaña. Un router
// que se come esos casos rompe cosas que la gente usa todos los días.
document.addEventListener("click", (evento) => {
  if (evento.defaultPrevented || evento.button !== 0) return;
  if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;

  const enlace = evento.target.closest("a");
  if (!enlace || enlace.hasAttribute("download")) return;
  if (enlace.target && enlace.target !== "_self") return;

  const href = enlace.getAttribute("href") || "";
  // Solo rutas del propio sitio. `//otro.com` empieza con "/" y es EXTERNO:
  // sin descartarlo, el router se lo comería y el enlace no iría a ningún lado.
  if (!href.startsWith("/") || href.startsWith("//")) return;

  evento.preventDefault();
  navegar(enlace.pathname);
});

// El encabezado y el pie del sitio viven en index.html, FUERA de #app, así que el
// router no se los lleva con el innerHTML. En el panel no pintan nada —nav público,
// botón "Agendar", datos de contacto de la empresa— así que se ocultan por CSS con
// esta clase (ver `body.vista-admin` en styles.css). Mismo patrón que `menu-open`.
function aplicarChromeDeRuta(path) {
  document.body.classList.toggle("vista-admin", esRutaAdmin(path));
}

// Puerta del panel de administración.
//
// Las cuatro rutas pasan por acá y solo el estado `verificada` dibuja datos. Los
// otros dos estados no muestran ni una fila: ni la credencial guardada ni un
// fallo del servidor alcanzan para abrir (principio II, FR-002).
//
// render() es síncrono —arma el HTML con plantillas y lo asigna de una— y no
// puede volverse asíncrono sin reescribir el router. Por eso acá se dibuja el
// estado ACTUAL y la verificación asíncrona vuelve a llamar a render() cuando
// termina. Mismo patrón que [data-reintentar-catalogo] en pages/schedule.js y
// que el arranque de iniciar().
//
// NINGUNA de las tres pantallas lleva los flotantes de WhatsApp y del asistente:
// son para el visitante que llega a contratar un servicio, no para quien atiende
// el mostrador mirando una tabla de citas. El resto del sitio sí los lleva, en
// shell() de render().
function renderizarAdmin(path) {
  // Con credencial guardada pero sin revalidar en esta carga: se revalida SIEMPRE
  // contra el servidor. Recargar la página nunca abre el panel por confiar en lo
  // que quedó guardado en la pestaña.
  if (debeRevalidarSesionAdmin()) {
    marcarSesionAdminVerificando();
    verificarCredencialAdmin().then(() => render());
  }

  if (sesionAdmin.estado === "verificada") {
    // La sección va también al bind: Mensajes se alimenta del API y necesita
    // saber que le toca pedir los datos (ver cargarMensajesAdmin en pages/admin.js).
    app.innerHTML = adminPage(SECCIONES_ADMIN[path]);
    bindAdmin(SECCIONES_ADMIN[path]);
    return;
  }

  if (sesionAdmin.estado === "verificando") {
    app.innerHTML = adminVerificandoPage();
    return;
  }

  app.innerHTML = adminLoginPage(sesionAdmin);
  bindAdminLogin();
}

function render() {
  ensureSeed();
  const path = rutaActual();
  setActiveNav(path);
  document.body.classList.remove("menu-open");
  aplicarChromeDeRuta(path);
  aplicarMetadatosDeRuta(path);

  const shell = (content) => `${content}${backedSection()}${whatsappButton()}${chatbotWidget()}`;

  // Salir del panel suelta los mensajes traídos del API.
  //
  // bindAdmin() ya los suelta al pasar de Mensajes a otra sección DEL PANEL, pero
  // no se entera de que alguien se fue a la home: sus listeners viven en un HTML
  // que este render está por reemplazar. Sin esto, volver a Mensajes desde afuera
  // encontraba el estado en "listo" y dibujaba la lista de la visita anterior sin
  // volver a preguntarle al servidor. Con el API caído eso es lo peor posible:
  // mostrar los mensajes de hace media hora como si fueran los de ahora, en vez de
  // decir que no se pudieron consultar.
  //
  // Y de paso, los datos personales no se quedan en memoria mientras la persona
  // anda por el resto del sitio.
  if (!esRutaAdmin(path)) reiniciarMensajesAdmin();

  if (path === "/") {
    app.innerHTML = shell(homePage());
    bindQuickAppointment();
    bindCounters();
  } else if (path === "/recomendaciones") {
    app.innerHTML = shell(recomendacionesPage());
  } else if (path === "/tarifas") {
    app.innerHTML = shell(tarifasPage());
    bindTarifas();
  } else if (path === "/faq") {
    app.innerHTML = shell(faqPage());
  } else if (path === "/agendar") {
    app.innerHTML = shell(schedulePage());
    bindSchedule();
  } else if (path === "/contacto") {
    app.innerHTML = shell(contactPage());
    bindContact();
  } else if (esRutaAdmin(path)) {
    renderizarAdmin(path);
  } else {
    // Esta pantalla prometía enlaces que no existían: decía "vuelve al inicio o
    // agenda una cita" y era texto plano, sin una sola cosa clicable y sin menú
    // de vuelta. Quien caía acá por escribir mal una letra —"/agenda" en vez de
    // "/agendar", que es de donde salió este arreglo— no tenía cómo salir más
    // que con el botón de atrás, y se iba convencido de que el sitio se cayó.
    //
    // El servidor ya redirige "/agenda" con un 301 (ver ALIAS_DE_RUTAS en
    // server.js), así que ese caso concreto no vuelve a llegar hasta acá. Pero
    // el próximo error de tipeo va a ser otro, y esta pantalla es la que lo
    // recibe: que tenga salida es lo que la vuelve una página y no un callejón.
    app.innerHTML = `
      ${pageHero("Página no encontrada", "Puede que la dirección esté mal escrita o que la página ya no exista.")}
      <section class="section">
        <div class="container">
          <div class="button-row" style="justify-content:center">
            <a class="button" href="/agendar">Agendar cita</a>
            <a class="button ghost" href="/">Volver al inicio</a>
          </div>
        </div>
      </section>
      ${whatsappButton()}${chatbotWidget()}`;
  }

  bindChatbot();
  // Los flotantes se re-observan en cada render: el nodo que marca el límite
  // ("Respaldados por", o el pie en el panel) se destruye con el innerHTML.
  bindFlotantes();
  window.scrollTo(0, 0);
}

const app = document.querySelector("#app");
document.querySelector("#menuBtn").addEventListener("click", () => document.body.classList.toggle("menu-open"));

// Atrás y adelante del navegador. Reemplaza al viejo `hashchange`: con rutas
// reales el hash ya no cambia nunca, así que ese evento no volvería a dispararse
// y los botones del navegador quedarían muertos.
window.addEventListener("popstate", render);

// Arranque de la aplicación.
//
// El catálogo de servicios se pide al API UNA sola vez y ANTES del primer render.
// render() es síncrono —arma el HTML con plantillas y lo asigna de una— y no puede
// volverse asíncrono sin reescribir el router entero, así que la única espera vive
// acá afuera: cuando iniciar() termina, todo el resto del sitio lee el catálogo ya
// cargado sin necesidad de await. Los cambios de ruta posteriores no vuelven a
// pedirlo.
//
// cargarCatalogoServicios() nunca lanza: si el API no responde deja el catálogo
// vacío y el sitio se dibuja igual. Nada queda en blanco; el agendamiento explica
// el problema y no deja agendar sin servicio (ver pages/schedule.js).
async function iniciar() {
  migrarRutaPorFragmento();

  // El chrome se decide ACÁ y no solo en render(): esta espera puede durar hasta el
  // corte de 6 s del catálogo, y sin esto entrar directo a /admin muestra todo ese
  // rato el encabezado y el pie del sitio público antes de dibujar el panel.
  aplicarChromeDeRuta(rutaActual());

  // Mientras llega el catálogo, algo visible en pantalla: si el API demora, el
  // visitante no se queda mirando una página vacía sin saber qué pasa.
  app.innerHTML = `<section class="section"><div class="container"><p>Cargando la información del CDA…</p></div></section>`;
  await cargarCatalogoServicios();
  render();
}

iniciar();
