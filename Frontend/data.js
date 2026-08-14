// Dirección del API del CDA.
// El catálogo de servicios ya no vive en el frontend: se pide acá (ver
// cargarCatalogoServicios en utils.js). Por eso, para trabajar en el sitio hacen
// falta DOS procesos: `node Frontend/server.js` y el API en el puerto 3000.
//
// ⚠️ SI CAMBIA EL DOMINIO DEL API, ESTE NO ES EL ÚNICO LUGAR. La política de
// contenido declara a qué orígenes puede conectarse el navegador, y ese origen
// está escrito en DOS lugares más:
//
//   1. el <meta http-equiv="Content-Security-Policy"> de index.html
//   2. la constante POLITICA_DE_CONTENIDO de server.js (vía la variable
//      de entorno API_ORIGIN)
//
// Son TRES lugares y hay que tocar los tres. Si se cambia este y no los otros, el
// navegador bloquea todas las llamadas al API: el sitio se queda sin catálogo de
// servicios, el formulario de contacto no envía nada y el panel no abre, todo sin
// un solo error visible salvo en la consola.
//
// El sitio no tiene build, así que no puede leer variables de entorno: la
// dirección de producción va escrita acá, en una sola constante, y cuál se usa se
// decide en el navegador. Así el mismo archivo sirve para desarrollar y para
// publicar, sin editar nada al desplegar —que es justo el paso que se olvida.
const API_ORIGIN_PRODUCCION = "https://api.cdavalledupar.com";
const API_ORIGIN_DESARROLLO = "http://localhost:3000";

const ES_DESARROLLO = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const API_URL = `${ES_DESARROLLO ? API_ORIGIN_DESARROLLO : API_ORIGIN_PRODUCCION}/api`;

// Datos constantes del CDA
const CDA = {
  nombre: "CDA de Valledupar",
  ubicacion: "Cra. 18D #47 17, San Fernando, Valledupar, Cesar",
  horario: "Lunes a Viernes: 7:30 AM - 6:00 PM | Sábados: 7:30 AM - 1:30 PM",
  telefono: "316 6962144",
  email: "contacto@cdavalledupar.com",
  descripcion:
    "Somos el líder CDA en Valledupar. Realiza tu revisión con un equipo certificado, procesos confiables y atención ágil. Deja tu vehículo en manos expertas, agenda ya tu cita.",
  maps:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3923.7423356986833!2d-73.24193439999999!3d10.442009599999999!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e8ab9888e272a05%3A0xa9d98dcc823b9144!2sCentro%20de%20Diagnostico%20Automotriz%20Valledupar!5e0!3m2!1ses!2sco!4v1778993843497!5m2!1ses!2sco",
};

// Tipos de vehículos
const vehiculos = [
  {
    label: "Motos 2T",
    desc: "Revisión técnico-mecánica y de gases para motocicletas de 2 tiempos.",
    img: "./assets/img/moto2t.webp",
  },
  {
    label: "Motos 4T",
    desc: "Diagnóstico completo para motocicletas de 4 tiempos, estándar y deportivas.",
    img: "./assets/img/moto4t.webp",
  },
  {
    label: "Vehículos Livianos",
    desc: "Carros y camionetas particulares con inspección integral certificada.",
    img: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=600&q=80",
  },
  {
    label: "Vehículos Pesados",
    desc: "Buses, camiones y tracto-mulas con revisión según normativa de carga.",
    img: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=600&q=80",
  },
];

// Tarifas de referencia por tipo de vehículo.
// La clave debe coincidir con el "label" de `vehiculos`.
// IMPORTANTE: solo se publican las cifras confirmadas por el CDA (motos desde $65.000
// y vehículos livianos desde $95.000). Los tipos sin cifra confirmada quedan en null
// y se muestran como "Consultar": nunca se estiman ni se inventan valores.
const tarifas = {
  "Motos 2T": { precio: "$65.000" },
  "Motos 4T": { precio: "$65.000" },
  "Vehículos Livianos": { precio: "$95.000" },
  "Vehículos Pesados": { precio: null },
};

// Aviso que acompaña siempre a las tarifas publicadas.
const tarifasAviso =
  "Los valores publicados son referenciales y pueden variar según el cilindraje, el servicio solicitado y las tarifas oficiales vigentes. Confirma el valor exacto de tu revisión con nuestro equipo antes de tu visita.";

// Características principales
const features = [
  ["user-check", "Técnicos Certificados", "Personal con certificaciones oficiales y amplia experiencia en diagnóstico automotor.", "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=500&q=75"],
  ["gauge", "Resultados en Minutos", "Proceso ágil con diagnóstico inmediato para que no pierdas tiempo valioso.", "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=500&q=75"],
  ["clock", "Agilidad / Eficiencia", "Atención rápida y eficiente sin sacrificar la calidad, valoramos tu tiempo.", "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=500&q=75"],
  ["badge-dollar", "Confianza y Tecnología", "Equipos de última generación respaldados por años de experiencia.", "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=500&q=75"],
];

// Acá vivían dos citas de ejemplo (defaultAppointments). Se eliminaron por FR-011:
// eran datos de prueba, no citas reales, y además traían tipos de vehículo que no
// existen ("Vehículo Liviano", "Moto 4T", en singular). El sitio arranca sin citas;
// ver ensureSeed() en utils.js, que además descarta las que quedaron sembradas.

// Preguntas frecuentes
const faqItems = [
  {
    q: "¿Qué hace un CDA y qué revisan en la inspección?",
    a: "Un CDA realiza la revisión técnico-mecánica y de gases para verificar frenos, luces, suspensión, dirección, emisiones, llantas y elementos de seguridad. El objetivo es certificar que el vehículo cumple las condiciones mínimas para circular.",
    keywords: "revisión técnico-mecánica, revisión de gases, inspección vehicular",
  },
  {
    q: "¿Cómo agendo una cita en CDA de Valledupar?",
    a: "Puedes agendar desde la página de inicio o desde la ruta de agendamiento. Solo debes dejar tus datos, seleccionar el vehículo, elegir la fecha y confirmar el registro.",
    keywords: "agendar cita CDA, cita revisión técnico-mecánica Valledupar",
  },
  {
    q: "¿Qué tipos de vehículos atienden?",
    a: "Atendemos motos 2T y 4T, vehículos livianos y vehículos pesados. 🚗🏍️ Si tienes dudas sobre tu tipo de vehículo, nuestro equipo te orienta con gusto.",
    keywords: "motos, carros, camionetas, vehículos pesados",
  },
  {
    q: "¿Qué documentos necesito para la revisión técnico-mecánica?",
    a: "Normalmente debes llevar tu vehículo en buen estado, con la documentación básica al día. Para una atención más ágil, revisa previamente luces, llantas, frenos y niveles del vehículo.",
    keywords: "documentos revisión técnico-mecánica, requisitos CDA",
  },
  {
    q: "¿Por qué es importante la revisión de gases?",
    a: "La revisión de gases ayuda a controlar emisiones contaminantes y a verificar que el vehículo cumpla la normativa ambiental vigente. También mejora la detección temprana de fallas mecánicas.",
    keywords: "revisión de gases, emisiones contaminantes, normativa ambiental",
  },
  {
    q: "¿Dónde está ubicado CDA de Valledupar?",
    a: "Estamos en Cra. 18D #47 17, San Fernando, Valledupar, Cesar. En la sección de contacto puedes ver el mapa y nuestros canales de atención.",
    keywords: "CDA Valledupar ubicación, mapa CDA Valledupar",
  },
];

// Prompts del chatbot
const chatbotPrompts = {
  "agendar cita": {
    user: "Quiero agendar una cita.",
    bot: "¡Perfecto! 🗓️ Ve a <strong>Agendar Cita</strong>, completa tus datos, selecciona el vehículo, la fecha disponible y realiza el pago. Tu turno queda reservado al instante.",
    cta: "#/agendar",
    ctaLabel: "Ir a agendar",
  },
  horario: {
    user: "¿Cuál es el horario?",
    bot: `Estamos abiertos <strong>${CDA.horario}</strong>. 🕐 Los domingos y festivos permanecemos cerrados.`,
    cta: "#/contacto",
    ctaLabel: "Ver contacto",
  },
  servicios: {
    user: "¿Qué servicios ofrecen?",
    // La lista de servicios NO se escribe acá (FR-001): se arma desde el catálogo
    // del API, que es la única fuente de verdad sobre lo que el CDA ofrece. Así el
    // asistente y el formulario de agendamiento nunca dicen cosas distintas.
    // Es un getter, y no un texto fijo, porque este archivo se carga antes de que
    // el catálogo llegue; al momento del clic el catálogo ya está disponible.
    get bot() {
      return textoServiciosChatbot();
    },
    cta: "#/servicios",
    ctaLabel: "Ver servicios",
  },
  vehiculos: {
    user: "¿Qué vehículos atienden?",
    bot: "Atendemos <strong>motos 2T y 4T, vehículos livianos y vehículos pesados</strong>. 🚗🏍️ Si tienes dudas sobre tu tipo de vehículo, nuestro equipo te orienta con gusto.",
    // Apuntaba a "#/" (la home), donde no hay nada específico sobre tipos de
    // vehículo: la página de tarifas sí tiene una fila por cada uno.
    cta: "#/tarifas",
    ctaLabel: "Ver tipos y tarifas",
  },
  ubicacion: {
    user: "¿Dónde están ubicados?",
    bot: `Nos encontramos en <strong>${CDA.ubicacion}</strong>. 📍 Hay parqueadero disponible y es fácil llegar tanto en carro como en moto.`,
    cta: "#/contacto",
    ctaLabel: "Ver en mapa",
  },
  documentos: {
    user: "¿Qué debo llevar?",
    bot: "Necesitas la <strong>tarjeta de propiedad</strong> y el <strong>SOAT vigente</strong>. Antes de venir, revisa que las luces, frenos, llantas y niveles estén en buen estado. ✅",
    cta: "#/faq",
    ctaLabel: "Ver preguntas frecuentes",
  },
  precios: {
    user: "¿Cuánto vale la revisión?",
    bot: "Las tarifas varían según el tipo de vehículo. 💰 Motos desde <strong>$65.000</strong> y vehículos livianos desde <strong>$95.000</strong>. Incluye certificado oficial al aprobar.",
    cta: "#/tarifas",
    ctaLabel: "Ver tarifas completas",
  },
};
