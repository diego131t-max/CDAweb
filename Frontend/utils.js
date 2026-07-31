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

// Marca de que las citas de ejemplo ya se descartaron en este navegador (FR-011).
const CLAVE_CITAS_SEMILLA_DESCARTADAS = "seedCitasDescartadas";

// Inicializa datos por defecto
function ensureSeed() {
  // FR-011: las citas sembradas como ejemplo se descartan y el catálogo entra en
  // vigencia sin arrastrarlas. Ya no se siembran, pero las que quedaron guardadas
  // en el navegador de quien ya visitó el sitio hay que borrarlas una única vez:
  // si no, seguirían apareciendo en el panel con servicios y tipos de vehículo
  // que no existen en el catálogo. Las citas que se agenden de acá en adelante
  // se conservan, porque la marca queda puesta.
  if (!localStorage.getItem(CLAVE_CITAS_SEMILLA_DESCARTADAS)) {
    localStorage.removeItem("appointments");
    localStorage.setItem(CLAVE_CITAS_SEMILLA_DESCARTADAS, "1");
  }
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

// ── Catálogo de servicios ─────────────────────────────────────────────────────
//
// El catálogo vive en el API (GET /api/servicios) y es la única fuente de verdad
// sobre lo que el CDA ofrece (FR-001). Se carga UNA sola vez al arrancar, antes
// del primer render (ver app.js), y desde acá lo leen el agendamiento, el panel
// de administración y el asistente del sitio.
//
// A propósito NO hay una copia de respaldo del catálogo en el frontend: dos listas
// del mismo dato es justo la contradicción que esta funcionalidad viene a eliminar.
// Si el API no responde, el sitio lo dice y no deja agendar sin servicio, pero no
// se inventa una lista.

let catalogoServicios = [];
let catalogoServiciosCargado = false;

// Pide el catálogo al API. Nunca lanza: deja el catálogo vacío y devuelve false
// para que quien lo use decida qué mostrar.
async function cargarCatalogoServicios() {
  const controlador = new AbortController();
  // Corte de seguridad: si el API acepta la conexión pero no contesta, el sitio no
  // puede quedarse esperando para siempre antes de dibujar la primera pantalla.
  const corte = setTimeout(() => controlador.abort(), 6000);

  try {
    const respuesta = await fetch(`${API_URL}/servicios`, { signal: controlador.signal });
    if (!respuesta.ok) throw new Error(`El API respondió ${respuesta.status}`);

    const cuerpo = await respuesta.json();
    const recibidos = Array.isArray(cuerpo && cuerpo.servicios) ? cuerpo.servicios : [];
    catalogoServicios = recibidos
      .filter((servicio) => servicio && typeof servicio.nombre === "string")
      .map((servicio) => ({
        id: servicio.id,
        nombre: servicio.nombre,
        // Vacío = el servicio aplica a todos los tipos de vehículo.
        vehiculosExcluidos: Array.isArray(servicio.vehiculosExcluidos) ? servicio.vehiculosExcluidos : [],
      }));
    // Un catálogo vacío se trata como no disponible: el agendamiento no debe
    // ofrecer una lista vacía sin explicación.
    catalogoServiciosCargado = catalogoServicios.length > 0;
  } catch (error) {
    catalogoServicios = [];
    catalogoServiciosCargado = false;
    console.error("No se pudo cargar el catálogo de servicios del API.", error);
  } finally {
    clearTimeout(corte);
  }

  return catalogoServiciosCargado;
}

// ¿Este servicio se le puede ofrecer a este tipo de vehículo? (FR-009)
function servicioAplicaAVehiculo(servicio, vehiculo) {
  return Boolean(servicio) && !servicio.vehiculosExcluidos.includes(vehiculo);
}

// Busca un servicio del catálogo por su nombre visible. Devuelve null si no está,
// que es lo que permite rechazar un servicio fuera del catálogo (FR-004).
function buscarServicio(nombre) {
  return catalogoServicios.find((servicio) => servicio.nombre === nombre) || null;
}

// Servicios del catálogo aplicables a un tipo de vehículo.
function serviciosParaVehiculo(vehiculo) {
  return catalogoServicios.filter((servicio) => servicioAplicaAVehiculo(servicio, vehiculo));
}

// Genera opciones de servicios para selects, filtradas por el tipo de vehículo:
// a una moto nunca se le ofrece certificado de blindaje (FR-009).
function serviceOptions(vehicle = "", selected = "") {
  return serviciosParaVehiculo(vehicle)
    .map(
      (servicio) =>
        `<option value="${servicio.nombre}" ${selected === servicio.nombre ? "selected" : ""}>${servicio.nombre}</option>`,
    )
    .join("");
}

// Arma la respuesta "¿Qué servicios ofrecen?" del asistente desde el catálogo,
// para que el sitio no se contradiga entre el chatbot y el agendamiento (FR-001).
function textoServiciosChatbot() {
  if (!catalogoServiciosCargado) {
    return `En este momento no puedo consultar el listado de servicios. 🔧 Llámanos al <strong>${CDA.telefono}</strong> y con gusto te contamos todo.`;
  }

  const nombres = catalogoServicios.map((servicio) => servicio.nombre);
  const listado =
    nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}` : nombres[0];
  return `Ofrecemos ${listado}. 🔧 ¡Todo en un solo lugar!`;
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
