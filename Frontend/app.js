// Aplicación Principal - Router

function render() {
  ensureSeed();
  const path = location.hash.replace("#", "") || "/";
  setActiveNav(path);
  document.body.classList.remove("menu-open");

  const shell = (content) => `${content}${backedSection()}${whatsappButton()}${chatbotWidget()}`;

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
  } else if (path === "/admin/vehiculos") {
    app.innerHTML = `${adminPage("vehiculos")}${whatsappButton()}${chatbotWidget()}`;
  } else if (path === "/admin/mensajes") {
    app.innerHTML = `${adminPage("mensajes")}${whatsappButton()}${chatbotWidget()}`;
  } else if (path === "/admin/reportes") {
    app.innerHTML = `${adminPage("reportes")}${whatsappButton()}${chatbotWidget()}`;
  } else if (path.startsWith("/admin")) {
    app.innerHTML = `${adminPage("reservas")}${whatsappButton()}${chatbotWidget()}`;
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
  // Mientras llega el catálogo, algo visible en pantalla: si el API demora, el
  // visitante no se queda mirando una página vacía sin saber qué pasa.
  app.innerHTML = `<section class="section"><div class="container"><p>Cargando la información del CDA…</p></div></section>`;
  await cargarCatalogoServicios();
  render();
}

iniciar();
