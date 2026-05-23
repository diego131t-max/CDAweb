// Sistema de almacenamiento local
const storage = {
  get(key, fallback) {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

// Inicializa datos por defecto
function ensureSeed() {
  if (!localStorage.getItem("appointments")) storage.set("appointments", defaultAppointments);
  if (!localStorage.getItem("messages")) {
    storage.set("messages", [
      {
        name: "Belsa Faira",
        email: "belsa@email.com",
        message: "Quiero confirmar el horario para una revisión de gases.",
        date: "2026-05-16",
      },
    ]);
  }
}

// Genera opciones de servicios para selects
function serviceOptions(selected = "") {
  return servicios
    .map((item) => `<option ${selected === item.titulo ? "selected" : ""}>${item.titulo}</option>`)
    .join("");
}

// Genera opciones de vehículos para selects
function vehicleOptions(selected = "") {
  return vehiculos
    .map((item) => `<option ${selected === item.label ? "selected" : ""}>${item.label}</option>`)
    .join("");
}

// Componente: Hero header de página
function pageHero(title, subtitle, eyebrow = "CDA de Valledupar") {
  return `
    <section class="page-hero">
      <p class="eyebrow">${eyebrow}</p>
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </section>
  `;
}

// Componente: Botón de WhatsApp flotante
function whatsappButton() {
  return `
    <a 
      href="https://wa.me/573166962144?text=Hola,%20quiero%20agendar%20una%20revisión%20técnico-mecánica"
      class="whatsapp-float"
      target="_blank"
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="#fff" 
        stroke-width="2" 
        stroke-linecap="round" 
        stroke-linejoin="round" 
        class="icon icon-tabler icons-tabler-outline icon-tabler-brand-whatsapp"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9" />
        <path d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1" />
      </svg>
    </a>
  `;
}

// Componente: Sección de respaldos
function backedSection() {
  return `
    <section class="backed-section">
      <div class="container">
        <p class="eyebrow">Respaldados por</p>
        <div class="backed-logos">
          <img src="./assets/img/concesion-runtdos.png" alt="RUNT">
          <img src="./assets/img/images.png" alt="Logo">
          <img src="./assets/img/Logo-Vigilados_Color_PNG.png" alt="SuperTransporte">
        </div>
      </div>
    </section>
  `;
}

// Activa navegación según ruta actual
function setActiveNav(path) {
  document.querySelectorAll(".main-nav a").forEach((link) => {
    const href = link.getAttribute("href").replace("#", "");
    link.classList.toggle("active", href === path || (href === "/admin" && path.startsWith("/admin")));
  });
}
