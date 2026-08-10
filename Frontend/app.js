// Aplicación Principal - Router

// Las CUATRO rutas del panel y la sección que le toca a cada una.
//
// Antes esto era un `path.startsWith("/admin")`, así que `#/administracion`
// —o cualquier cosa que empezara igual— abría el panel. Con una lista explícita,
// solo coinciden las rutas reales.
const SECCIONES_ADMIN = {
  "/admin": "reservas",
  "/admin/vehiculos": "vehiculos",
  "/admin/mensajes": "mensajes",
  "/admin/reportes": "reportes",
};

// Object.hasOwn y no `SECCIONES_ADMIN[path]`: con la lectura directa, una ruta
// como `#/constructor` devuelve algo del prototipo y entra al panel.
function esRutaAdmin(path) {
  return Object.hasOwn(SECCIONES_ADMIN, path);
}

// La ruta actual, en el mismo formato que usan SECCIONES_ADMIN y esRutaAdmin.
function rutaActual() {
  return location.hash.replace("#", "") || "/";
}

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
  } else if (path === "/servicios") {
    app.innerHTML = shell(servicesPage());
  } else if (path === "/tarifas") {
    app.innerHTML = shell(tarifasPage());
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
    app.innerHTML = `${pageHero("Página no encontrada", "Vuelve al inicio o agenda una cita.")}${whatsappButton()}${chatbotWidget()}`;
  }

  bindChatbot();
  // Los flotantes se re-observan en cada render: el nodo que marca el límite
  // ("Respaldados por", o el pie en el panel) se destruye con el innerHTML.
  bindFlotantes();
  window.scrollTo(0, 0);
}

const app = document.querySelector("#app");
document.querySelector("#menuBtn").addEventListener("click", () => document.body.classList.toggle("menu-open"));
window.addEventListener("hashchange", render);

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
  // El chrome se decide ACÁ y no solo en render(): esta espera puede durar hasta el
  // corte de 6 s del catálogo, y sin esto entrar directo a #/admin muestra todo ese
  // rato el encabezado y el pie del sitio público antes de dibujar el panel.
  aplicarChromeDeRuta(rutaActual());

  // Mientras llega el catálogo, algo visible en pantalla: si el API demora, el
  // visitante no se queda mirando una página vacía sin saber qué pasa.
  app.innerHTML = `<section class="section"><div class="container"><p>Cargando la información del CDA…</p></div></section>`;
  await cargarCatalogoServicios();
  render();
}

iniciar();
