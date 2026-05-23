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
  window.scrollTo(0, 0);
}

const app = document.querySelector("#app");
document.querySelector("#menuBtn").addEventListener("click", () => document.body.classList.toggle("menu-open"));
window.addEventListener("hashchange", render);
render();
