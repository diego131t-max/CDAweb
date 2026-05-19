const CDA = {
  nombre: "CDA de Valledupar",
  ubicacion: "Cra. 18D #47 17, San Fernando, Valledupar, Cesar",
  horario: "Lunes a Viernes: 7:30 AM - 6:00 PM | Sábados: 7:30 AM - 1:30 PM",
  telefono: "316 6962144",
  email: "contacto@cdavalledupar.com",
  descripcion:
    "Somos el líder CDA en Valledupar. Realiza tu revisión con un equipo certificado, procesos confiables y atención ágil. Deja tu vehículo en manos expertas, agenda ya tu cita.",
  maps:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3923.7423356986833!2d-73.24193439999999!3d10.442009599999999!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e8ab9888e272a05%3A0xa9d98dcc823b9144!2sCentro%20de%20Diagnostico%20Automotriz%20Valledupar!5e0!3m2!1ses!2sco!4v1778993843497!5m2!1ses!2sco",};
const servicios = [
  {
    titulo: "Revisión Técnico-Mecánica",
    descripcion:
      "Inspección completa del estado mecánico y de seguridad de tu vehículo según la normativa vigente.",
    icon: "🔧",
    img: "https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?w=600&q=80",
  },
  {
    titulo: "Revisión de Gases",
    descripcion:
      "Análisis de emisiones contaminantes para verificar que tu vehículo cumple con los estándares ambientales.",
    icon: "💨",
    img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80",
  },
  {
    titulo: "Inspección de Luces y Frenos",
    descripcion:
      "Evaluación detallada del sistema de iluminación y frenado para garantizar tu seguridad en la vía.",
    icon: "⚡",
    img: "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=600&q=80",
  },
  {
    titulo: "Peritaje Vehicular",
    descripcion:
      "Evaluación integral del estado de un vehículo usado para compra-venta o trámites legales.",
    icon: "📋",
    img: "https://images.unsplash.com/photo-1507136566006-cfc505b114fc?w=600&q=80",
  },
  {
    titulo: "Certificado de Blindaje",
    descripcion: "Verificación y certificación del nivel de blindaje de vehículos especiales.",
    icon: "🛡️",
    img: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=600&q=80",
  },
  {
    titulo: "Diagnóstico Electrónico",
    descripcion:
      "Lectura y análisis del sistema electrónico del vehículo mediante escáner automotriz profesional.",
    icon: "▣",
    img: "https://images.unsplash.com/photo-1617469767053-d3b523a0b982?w=600&q=80",
  },
];

const vehiculos = [
  {
    label: "Motos 2T",
    desc: "Revisión técnico-mecánica y de gases para motocicletas de 2 tiempos.",
    img: "https://images.unsplash.com/photo-1449426468159-d96dbf08f19f?w=600&q=80",
  },
  {
    label: "Motos 4T",
    desc: "Diagnóstico completo para motocicletas de 4 tiempos, estándar y deportivas.",
    img: "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=600&q=80",
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

const features = [
  ["user-check", "Técnicos Certificados", "Personal con certificaciones oficiales y amplia experiencia en diagnóstico automotor.", "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=500&q=75"],
  ["gauge", "Resultados en Minutos", "Proceso ágil con diagnóstico inmediato para que no pierdas tiempo valioso.", "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=500&q=75"],
  ["clock", "Agilidad / Eficiencia", "Atención rápida y eficiente sin sacrificar la calidad, valoramos tu tiempo.", "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=500&q=75"],
  ["badge-dollar", "Confianza y Tecnología", "Equipos de última generación respaldados por años de experiencia.", "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=500&q=75"],
];

const defaultAppointments = [
  {
    id: "CDA-1001",
    clientName: "María Granados",
    phone: "300 123 4567",
    plate: "ABC123",
    vehicle: "Vehículo Liviano",
    service: "Revisión Técnico-Mecánica",
    date: "2026-05-21",
    time: "09:00",
    payment: "PayU",
    status: "pendiente",
  },
  {
    id: "CDA-1002",
    clientName: "Carlos Pérez",
    phone: "301 444 2211",
    plate: "RIO789",
    vehicle: "Moto 4T",
    service: "Revisión de Gases",
    date: "2026-05-22",
    time: "10:30",
    payment: "Efectivo",
    status: "completada",
  },
];

const storage = {
  get(key, fallback) {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

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

function serviceOptions(selected = "") {
  return servicios
    .map((item) => `<option ${selected === item.titulo ? "selected" : ""}>${item.titulo}</option>`)
    .join("");
}

function vehicleOptions(selected = "") {
  return vehiculos
    .map((item) => `<option ${selected === item.label ? "selected" : ""}>${item.label}</option>`)
    .join("");
}

function pageHero(title, subtitle, eyebrow = "CDA de Valledupar") {
  return `
    <section class="page-hero">
      <p class="eyebrow">${eyebrow}</p>
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </section>
  `;
}

function homePage() {
  return `
    <section class="hero">
      <div class="container hero-grid">
        <div class="hero-copy">
          <p class="eyebrow">Centro de Diagnóstico Automotriz</p>
          <h1>${CDA.nombre}</h1>
          <p>${CDA.descripcion}</p>
          <div class="hero-actions">
            <a class="button secondary" href="#/agendar">Agendar Cita Ahora</a>
            <a class="button outline" href="#/servicios">¿Qué inspeccionamos?</a>
          </div>
          <ul class="trust-list">
            <li>Técnicos Certificados</li>
            <li>Resultados en Minutos</li>
            <li>Precios Asequibles</li>
          </ul>
        </div>
        ${quickAppointmentCard()}
      </div>
    </section>
    ${vehiclesSection()}
    ${featuresSection()}
    ${processSection()}
    ${testimonialsSection()}
    ${finalCta()}
  `;
}

function quickAppointmentCard() {
  return `
    <aside class="quick-card" aria-label="Agendar cita rápida">
      <div class="quick-card-head">Agendar Cita Rápida</div>
      <form id="quickAppointmentForm" class="quick-form">
        <div class="field full">
          <label for="quickName">Nombre</label>
          <input id="quickName" name="clientName" placeholder="Tu nombre completo" required>
        </div>
         <div class="field full">
          <label for="quickCedula">Cédula</label>
          <input id="quickCedula" name="cedula" placeholder="Tu número de cédula" required>
        </div>
        <div class="field full">
          <label for="quickPhone">Teléfono</label>
          <input id="quickPhone" name="phone" placeholder="Tu número de contacto" required>
        </div>
        <div class="quick-split">
          <div class="field">
            <label for="quickPlate">Placa</label>
            <input id="quickPlate" name="plate" placeholder="ABC-123" required>
          </div>
          <div class="field">
            <label for="quickVehicle">Tipo</label>
            <select id="quickVehicle" name="vehicle">${vehicleOptions("Vehículos Livianos")}</select>
          </div>
        </div>
        <div class="field full">
          <label for="quickDate">Fecha</label>
          <input id="quickDate" name="date" type="date" required>
        </div>
        <button class="button secondary quick-submit" type="submit">Solicitar Cita</button>
      </form>
    </aside>
  `;
}

function vehiclesSection() {
  return `
    <section class="section">
      <div class="container">
        <div class="title-block">
          <p class="eyebrow">Revisión Técnico-Mecánica y de Gases</p>
          <h2>Tipos de Vehículos que <span style="color:var(--primary)">Atendemos</span></h2>
          <div class="title-mark"><span></span><span></span></div>
        </div>
        <div class="grid four">
          ${vehiculos
            .map(
              (item, index) => `
                <article class="card">
                  <div class="image-top">
                    <img src="${item.img}" alt="${item.label}">
                    <span class="badge-number">${String(index + 1).padStart(2, "0")}</span>
                    <span class="image-title">${item.label}</span>
                  </div>
                  <div class="card-body">
                    <p>${item.desc}</p>
                    <div class="button-row"><a class="button" href="#/agendar">Agendar Cita</a></div>
                  </div>
                </article>
              `,
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function featuresSection() {
  return `
    <section class="section soft">
      <div class="container">
        <div class="title-block">
          <h2>Por Qué Elegir <span style="color:var(--primary)">${CDA.nombre}</span></h2>
        </div>
        <div class="grid four">
          ${features
            .map(
              ([icon, title, desc, img]) => `
                <article class="card center feature-card">
                  <div class="image-top">
                    <img src="${img}" alt="${title}">
                    <div class="feature-icon">${featureIconSvg(icon)}</div>
                  </div>
                  <div class="card-body">
                    <h3>${title}</h3>
                    <p>${desc}</p>
                  </div>
                </article>
              `,
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function featureIconSvg(icon) {
  const icons = {
    "user-check": `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"></path>
        <circle cx="9.5" cy="7" r="4"></circle>
        <path d="m16 11 2 2 4-4"></path>
      </svg>
    `,
    gauge: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.3 19a10 10 0 1 1 17.4 0"></path>
        <path d="m12 14 4-4"></path>
        <path d="M8 13h.01"></path>
        <path d="M16 13h.01"></path>
      </svg>
    `,
    clock: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M12 7v5l3 2"></path>
      </svg>
    `,
    "badge-dollar": `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"></path>
        <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path>
        <path d="M12 18V6"></path>
      </svg>
    `,
  };
  return icons[icon] || icons.clock;
}

function processSection() {
  const steps = [
    ["1", "Agenda Online", "Reserva tu cita desde la comodidad de tu hogar en pocos minutos.", "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=75"],
    ["2", "Visita el Centro", "Preséntate en nuestra sede con tu vehículo a la hora acordada.", "https://images.unsplash.com/photo-1486006920555-c77dcf18193c?w=600&q=75"],
    ["3", "Recibe tu Certificado", "Obtén tu certificado oficial al instante y circula con tranquilidad.", "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600&q=75"],
  ];
  return `
    <section class="section primary-band">
      <div class="container">
        <div class="title-block"><h2>Proceso Fácil en <span style="color:var(--secondary)">3 Pasos</span></h2></div>
        <div class="grid three">
          ${steps
            .map(
              ([num, title, desc, img]) => `
                <article class="card process-card">
                  <div class="image-top">
                    <img src="${img}" alt="${title}">
                    <span class="badge-number">${num}</span>
                  </div>
                  <div class="card-body">
                    <h3>${title}</h3>
                    <p>${desc}</p>
                  </div>
                </article>
              `,
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function testimonialsSection() {
  const items = [
    ["María Granados", "Valledupar", "Excelente servicio, el equipo es muy profesional. Me atendieron rápido y el proceso fue muy sencillo. 100% recomendado.", "MG"],
    ["Belsa Faira", "Valledupar", "Un servicio de primera calidad. Los técnicos son muy amables y explican todo con claridad. Precios justos y atención rápida.", "BF"],
    ["Carlos Pérez", "Riohacha", "Muy satisfecho con la revisión técnico-mecánica. El personal es competente y los equipos son de última tecnología.", "CP"],
  ];
  return `
    <section class="section">
      <div class="container">
        <div class="title-block"><h2>Opiniones de <span style="color:var(--primary)">Clientes Satisfechos</span></h2></div>
        <div class="grid three">
          ${items
            .map(
              ([name, city, text, avatar]) => `
                <article class="card">
                  <div class="card-body">
                    <div style="color:var(--secondary);font-size:20px;margin-bottom:12px">★★★★★</div>
                    <p><em>"${text}"</em></p>
                    <div style="display:flex;align-items:center;gap:12px;margin-top:18px">
                      <span style="display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:var(--primary);color:white;font-weight:900">${avatar}</span>
                      <div><strong>${name}</strong><p style="font-size:12px">${city}</p></div>
                    </div>
                  </div>
                </article>
              `,
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function finalCta() {
  return `
    <section class="page-hero">
      <h2>¡No esperes más!</h2>
      <p>Garantiza el rendimiento de tu vehículo y optimiza la seguridad de tu automóvil.</p>
      <div class="button-row" style="justify-content:center">
        <a class="button secondary" href="#/agendar">Solicitar Revisión Hoy</a>
      </div>
    </section>
  `;
}

function servicesPage() {
  const cards = [
    {
      title: "Sistema de Frenos",
      desc: "Verificamos el estado y funcionamiento del sistema de frenado para garantizar una conducción segura.",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>`,
      img: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600&q=80",
      color: "from-red-600 to-red-800",
    },
    {
      title: "Luces y Señalización",
      desc: "Inspeccionamos farolas, direccionales, luces de freno y sistemas de iluminación completos.",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"/></svg>`,
      img: "https://images.unsplash.com/photo-1617531653332-bd46c16f4d68?w=600&q=80",
      color: "from-yellow-500 to-yellow-700",
    },
    {
      title: "Emisión de Gases",
      desc: "Analizamos las emisiones contaminantes para validar el cumplimiento ambiental vigente.",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"/></svg>`,
      img: "https://images.unsplash.com/photo-1611337765-44e066cf7a67?w=600&q=80",
      color: "from-green-600 to-green-800",
    },
    {
      title: "Llantas y Suspensión",
      desc: "Revisamos desgaste, estabilidad y condiciones generales del sistema de suspensión.",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 9.563C9 9.252 9.252 9 9.563 9h4.874c.311 0 .563.252.563.563v4.874c0 .311-.252.563-.563.563H9.564A.562.562 0 019 14.437V9.564z"/></svg>`,
      img: "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=600&q=80",
      color: "from-blue-600 to-blue-800",
    },
    {
      title: "Dirección y Ejes",
      desc: "Evaluamos la estabilidad y respuesta del sistema de dirección del vehículo.",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59"/></svg>`,
      img: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=600&q=80",
      color: "from-slate-600 to-slate-800",
    },
    {
      title: "Elementos de Seguridad",
      desc: "Comprobamos el correcto funcionamiento de elementos esenciales de seguridad del vehículo.",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>`,
      img: "https://images.unsplash.com/photo-1563720223185-11003d516935?w=600&q=80",
      color: "from-indigo-600 to-indigo-800",
    },
  ];

  const steps = [
    { n: "01", icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-7 h-7"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>`, label: "Agenda tu cita", sub: "Reserva en línea en minutos" },
    { n: "02", icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-7 h-7"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/></svg>`, label: "Lleva tu vehículo", sub: "En tu fecha y hora elegida" },
    { n: "03", icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-7 h-7"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"/></svg>`, label: "Realizamos la inspección", sub: "Proceso certificado y técnico" },
    { n: "04", icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-7 h-7"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z"/></svg>`, label: "Obtén tu certificación", sub: "Documento oficial al instante" },
  ];

  return `
    <style>
      .svc-card { transition: transform 0.28s cubic-bezier(.22,1,.36,1), box-shadow 0.28s ease; }
      .svc-card:hover { transform: translateY(-8px); box-shadow: 0 24px 48px rgba(15,23,42,0.15); }
      .svc-card img { transition: transform 0.45s ease; }
      .svc-card:hover img { transform: scale(1.06); }
      .step-dot { transition: background 0.2s, transform 0.2s; }
      .step-item:hover .step-dot { background: #dc2626; transform: scale(1.12); }
    </style>

    <!-- HERO -->
    <div class="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 py-20 px-6 text-center">
      <span class="inline-block bg-red-600 text-white text-xs font-bold tracking-widest uppercase px-4 py-1 rounded-full mb-5">Inspección Vehicular</span>
      <h1 class="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-4">¿Qué inspeccionamos?</h1>
      <p class="text-slate-300 text-lg max-w-2xl mx-auto">Evaluamos los principales sistemas de seguridad y emisiones de tu vehículo para garantizar el cumplimiento de la normativa vigente.</p>
    </div>

    <!-- CARDS GRID -->
    <section class="bg-slate-50 py-20 px-6">
      <div class="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        ${cards.map(card => `
          <article class="svc-card bg-white rounded-2xl overflow-hidden shadow-md border border-slate-100 flex flex-col">
            <div class="relative overflow-hidden h-48">
              <img src="${card.img}" alt="${card.title}" class="w-full h-full object-cover" loading="lazy">
              <div class="absolute inset-0 bg-gradient-to-t ${card.color} opacity-60"></div>
              <div class="absolute bottom-3 left-3 bg-white bg-opacity-20 backdrop-blur-sm border border-white border-opacity-30 text-white rounded-xl p-2 shadow">
                ${card.icon}
              </div>
            </div>
            <div class="p-6 flex flex-col flex-1">
              <h3 class="text-slate-900 font-bold text-lg mb-2">${card.title}</h3>
              <p class="text-slate-500 text-sm leading-relaxed flex-1">${card.desc}</p>
              <a href="#/agendar" class="mt-5 inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors w-fit">
                Agendar Cita
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
              </a>
            </div>
          </article>
        `).join("")}
      </div>
    </section>

    <!-- CÓMO FUNCIONA -->
    <section class="bg-white py-20 px-6">
      <div class="max-w-5xl mx-auto">
        <div class="text-center mb-14">
          <span class="inline-block bg-blue-50 text-blue-700 text-xs font-bold tracking-widest uppercase px-4 py-1 rounded-full mb-4">Proceso</span>
          <h2 class="text-3xl md:text-4xl font-extrabold text-slate-900">¿Cómo funciona?</h2>
          <p class="text-slate-500 mt-3 max-w-xl mx-auto">Un proceso simple, rápido y transparente para mantener tu vehículo en regla.</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          ${steps.map((s, i) => `
            <div class="step-item flex flex-col items-center text-center group">
              <div class="step-dot w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg mb-4 group-hover:bg-red-600 transition-all duration-300">
                ${s.icon}
              </div>
              <span class="text-xs font-bold text-red-600 tracking-widest mb-1">${s.n}</span>
              <h3 class="font-bold text-slate-900 text-base mb-1">${s.label}</h3>
              <p class="text-slate-500 text-sm">${s.sub}</p>
            </div>
          `).join("")}
        </div>
      </div>
    </section>

    <!-- CTA FINAL -->
    <section class="bg-gradient-to-r from-blue-950 via-slate-900 to-blue-950 py-20 px-6 text-center">
      <div class="max-w-2xl mx-auto">
        <h2 class="text-3xl md:text-4xl font-extrabold text-white mb-4">Agenda tu revisión técnico-mecánica hoy mismo</h2>
        <p class="text-slate-300 text-lg mb-10">Atención rápida, inspección confiable y cumplimiento normativo garantizado.</p>
        <a href="#/agendar" class="inline-flex items-center gap-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-lg px-10 py-4 rounded-2xl shadow-xl transition-all duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>
          Agendar Cita
        </a>
      </div>
    </section>
  `;
}

let appointmentStep = 0;
let appointmentData = {
  clientName: "",
  phone: "",
  email: "",
  plate: "",
  vehicle: "Vehículos Livianos",
  service: "Revisión Técnico-Mecánica",
  date: "",
  time: "09:00",
  payment: "PayU",
};

function schedulePage() {
  return `
    <section class="section">
      <div class="form-shell">
        <div class="title-block">
          <h2>Agendar Cita</h2>
          <p>Completa los siguientes pasos para reservar tu diagnóstico</p>
        </div>
        ${stepsMarkup()}
        <div class="form-card">${stepMarkup()}</div>
      </div>

    </section>
  `;
}

function stepsMarkup() {
  const labels = ["Datos Personales", "Vehículo y Servicio", "Fecha y Pago", "Confirmación"];
  return `<div class="steps">${labels
    .map((label, index) => `<div class="step ${index === appointmentStep ? "active" : index < appointmentStep ? "done" : ""}"><span>${index < appointmentStep ? "✓" : index + 1}</span>${label}</div>`)
    .join("")}</div>`;
}

function stepMarkup() {
  if (appointmentStep === 0) {
    return `
      <h3>Datos Personales</h3>
      <p>Ingresa tu información de contacto</p>
      <form id="appointmentForm" class="form-grid" style="margin-top:22px">
        <div class="field"><label for="clientName">Nombre Completo *</label><input id="clientName" name="clientName" value="${appointmentData.clientName}" placeholder="Juan Pérez" required></div>
        <div class="field"><label for="phone">Teléfono *</label><input id="phone" name="phone" value="${appointmentData.phone}" placeholder="316 6962144" required></div>
        <div class="field full"><label for="email">Email</label><input id="email" name="email" type="email" value="${appointmentData.email}" placeholder="tu@email.com"></div>
        <div class="field full button-row"><button class="button secondary" type="submit">Continuar</button></div>
      </form>
    `;
  }
  if (appointmentStep === 1) {
    return `
      <h3>Vehículo y Servicio</h3>
      <p>Información de tu vehículo y el servicio que necesitas</p>
      <form id="appointmentForm" class="form-grid" style="margin-top:22px">
        <div class="field"><label for="plate">Placa *</label><input id="plate" name="plate" value="${appointmentData.plate}" placeholder="ABC123" required></div>
        <div class="field"><label for="vehicle">Tipo de Vehículo</label><select id="vehicle" name="vehicle">${vehicleOptions(appointmentData.vehicle)}</select></div>
        <input type="hidden" name="service" value="Revisión Técnico-Mecánica">
        <div class="field full button-row"><button class="button ghost" type="button" data-back>Volver</button><button class="button secondary" type="submit">Continuar</button></div>
      </form>
    `;
  }
  if (appointmentStep === 2) {
    return `
      <h3>Fecha y Pago</h3>
      <p>Selecciona el momento y tu método de pago preferido</p>
      <form id="appointmentForm" class="form-grid" style="margin-top:22px">
        <div class="field"><label for="date">Fecha *</label><input id="date" name="date" type="date" value="${appointmentData.date}" required></div>
        <div class="field"><label for="time">Hora *</label><select id="time" name="time">
          ${["08:00", "09:00", "10:30", "14:00", "16:00"].map((time) => `<option ${appointmentData.time === time ? "selected" : ""}>${time}</option>`).join("")}
        </select></div>
        <div class="field full"><label for="payment">Método de Pago</label><select id="payment" name="payment">
          ${["PayU", "MercadoPago", "Efectivo", "Transferencia Bancaria"].map((pay) => `<option ${appointmentData.payment === pay ? "selected" : ""}>${pay}</option>`).join("")}
        </select></div>
        <div class="field full button-row"><button class="button ghost" type="button" data-back>Volver</button><button class="button secondary" type="submit">Continuar</button></div>
      </form>
    `;
  }
  return `
    <h3>Confirmación</h3>
    <p>Revisa los datos antes de reservar tu cita</p>
    <ul class="summary-list">
      <li><strong>Nombre</strong><span>${appointmentData.clientName}</span></li>
      <li><strong>Teléfono</strong><span>${appointmentData.phone}</span></li>
      <li><strong>Vehículo</strong><span>${appointmentData.vehicle} - ${appointmentData.plate}</span></li>
      <li><strong>Servicio</strong><span>${appointmentData.service}</span></li>
      <li><strong>Fecha</strong><span>${appointmentData.date} / ${appointmentData.time}</span></li>
      <li><strong>Pago</strong><span>${appointmentData.payment}</span></li>
    </ul>
    <div class="button-row"><button class="button ghost" data-back>Volver</button><button class="button secondary" id="saveAppointment">Agendar Cita</button></div>
  `;
}

function appointmentSurveyTable(items) {
  return `
    <section class="survey-panel">
      <div class="survey-head">
        <div>
          <p class="eyebrow">Encuesta de agendación</p>
          <h3>Tabla de citas registradas</h3>
          <p>Resumen completo de la información capturada en el formulario de agendación.</p>
        </div>
        <a class="button ghost" href="#/admin">Ver panel admin</a>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Cliente</th>
              <th>Contacto</th>
              <th>Vehículo</th>
              <th>Servicio</th>
              <th>Fecha</th>
              <th>Pago</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${
              items
                .map(
                  (item) => `
                    <tr>
                      <td>${item.id}</td>
                      <td>${item.clientName}</td>
                      <td>${item.phone}${item.email ? `<br><small>${item.email}</small>` : ""}</td>
                      <td>${item.vehicle}<br><small>${item.plate}</small></td>
                      <td>${item.service}</td>
                      <td>${item.date} ${item.time}</td>
                      <td>${item.payment}</td>
                      <td><span class="status ${item.status === "completada" ? "done" : ""}">${item.status}</span></td>
                    </tr>
                  `,
                )
                .join("") || `<tr><td colspan="8">Todavía no hay citas registradas.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function bindSchedule() {
  const form = document.querySelector("#appointmentForm");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      data.forEach((value, key) => (appointmentData[key] = value));
      appointmentStep += 1;
      render();
    });
  }
  document.querySelectorAll("[data-back]").forEach((button) => {
    button.addEventListener("click", () => {
      appointmentStep = Math.max(0, appointmentStep - 1);
      render();
    });
  });
  const save = document.querySelector("#saveAppointment");
  if (save) {
    save.addEventListener("click", () => {
      const appointments = storage.get("appointments", []);
      appointments.unshift({
        id: `CDA-${Date.now().toString().slice(-6)}`,
        ...appointmentData,
        status: "pendiente",
      });
      storage.set("appointments", appointments);
      appointmentStep = 0;
      appointmentData = {
        clientName: "",
        phone: "",
        email: "",
        plate: "",
        vehicle: "Vehículos Livianos",
        service: "Revisión Técnico-Mecánica",
        date: "",
        time: "09:00",
        payment: "PayU",
      };
      app.innerHTML = `<section class="section"><div class="container success-box"><h2>¡Cita Agendada!</h2><p>Nos pondremos en contacto contigo pronto para confirmar.</p><div class="button-row" style="justify-content:center"><a class="button secondary" href="#/agendar">Agendar otra cita</a></div></div></section>`;
    });
  }
}

function bindQuickAppointment() {
  const form = document.querySelector("#quickAppointmentForm");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const appointments = storage.get("appointments", []);
    appointments.unshift({
      id: `CDA-${Date.now().toString().slice(-6)}`,
      clientName: data.clientName,
      phone: data.phone,
      email: "",
      cedula: data.cedula,
      plate: data.plate,
      vehicle: data.vehicle,
      service: "Revisión Técnico-Mecánica",
      date: data.date,
      time: "09:00",
      payment: "Por confirmar",
      status: "pendiente",
    });
    storage.set("appointments", appointments);
    form.outerHTML = `
      <div class="quick-success">
        <h3>¡Cita solicitada!</h3>
        <p>Tu solicitud quedó registrada. Nos pondremos en contacto contigo para confirmar hora y pago.</p>
        <div class="button-row">
          <a class="button secondary" href="#/agendar">Completar agendación</a>
        </div>
      </div>
    `;
  });
}

function contactPage() {
  return `
    <section class="section">
      <div class="container">
        <div class="title-block">
          <p class="eyebrow">Contáctanos</p>
          <h2>Contacto</h2>
          <p>¿Tienes preguntas? Estamos aquí para ayudarte</p>
        </div>
        <div class="contact-grid">
          <form class="form-card form-grid" id="contactForm">
            <div class="field full"><label for="contactName">Nombre *</label><input id="contactName" name="name" placeholder="Tu nombre" required></div>
            <div class="field full"><label for="contactEmail">Email *</label><input id="contactEmail" name="email" type="email" placeholder="tu@email.com" required></div>
            <div class="field full"><label for="contactMessage">Mensaje *</label><textarea id="contactMessage" name="message" placeholder="Cuéntanos cómo podemos ayudarte" required></textarea></div>
            <div class="field full"><button class="button secondary" type="submit">Enviar Mensaje</button></div>
          </form>
          <div>
            <div class="info-list">
              <div class="info-item"><span>📍</span><div><b>Ubicación</b><p>${CDA.ubicacion}</p></div></div>
              <div class="info-item"><span>☎</span><div><b>Teléfono</b><p>${CDA.telefono}</p></div></div>
              <div class="info-item"><span>✉</span><div><b>Email</b><p>${CDA.email}</p></div></div>
              <div class="info-item"><span>🕒</span><div><b>Horario</b><p>${CDA.horario}</p></div></div>
            </div>
            <div class="map-frame" style="margin-top:18px"><iframe src="${CDA.maps}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function bindContact() {
  const form = document.querySelector("#contactForm");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const messages = storage.get("messages", []);
    messages.unshift({ ...data, date: new Date().toISOString().slice(0, 10) });
    storage.set("messages", messages);
    form.outerHTML = `<div class="success-box"><h2>¡Mensaje Enviado!</h2><p>Te responderemos lo antes posible.</p><div class="button-row" style="justify-content:center"><a class="button ghost" href="#/contacto">Enviar otro mensaje</a></div></div>`;
  });
}

function adminPage(section = "reservas") {
  const appointments = storage.get("appointments", []);
  const messages = storage.get("messages", []);
  const uniqueVehicles = new Set(appointments.map((item) => item.plate)).size;
  const pending = appointments.filter((item) => item.status === "pendiente").length;
  const completed = appointments.filter((item) => item.status === "completada").length;

  const content = {
    reservas: reservationsTable(appointments),
    vehiculos: vehiclesTable(appointments),
    mensajes: messagesTable(messages),
    reportes: reportsView(appointments, { pending, completed, uniqueVehicles }),
  }[section];

  return `
    <div class="admin-layout">
      <aside class="admin-sidebar">
        <strong>${CDA.nombre}</strong>
        <a class="${section === "reservas" ? "active" : ""}" href="#/admin">Reservas</a>
        <a class="${section === "vehiculos" ? "active" : ""}" href="#/admin/vehiculos">Vehículos</a>
        <a class="${section === "mensajes" ? "active" : ""}" href="#/admin/mensajes">Mensajes</a>
        <a class="${section === "reportes" ? "active" : ""}" href="#/admin/reportes">Reportes</a>
      </aside>
      <section class="admin-content">${content}</section>
    </div>
  `;
}

function reservationsTable(items) {
  return `
    <h2>Reservas</h2>
    <p>Gestiona las citas agendadas</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Cliente</th><th>Servicio</th><th>Vehículo</th><th>Fecha</th><th>Estado</th></tr></thead>
        <tbody>${items
          .map(
            (item) => `<tr><td>${item.id}</td><td>${item.clientName}<br><small>${item.phone}</small></td><td>${item.service}</td><td>${item.vehicle}<br><small>${item.plate}</small></td><td>${item.date} ${item.time}</td><td><span class="status ${item.status === "completada" ? "done" : ""}">${item.status}</span></td></tr>`,
          )
          .join("") || `<tr><td colspan="6">No hay citas registradas</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

function vehiclesTable(items) {
  return `
    <h2>Vehículos</h2>
    <p>Vehículos registrados en el sistema</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Placa</th><th>Tipo</th><th>Cliente</th><th>Último servicio</th></tr></thead>
        <tbody>${items
          .map((item) => `<tr><td>${item.plate}</td><td>${item.vehicle}</td><td>${item.clientName}</td><td>${item.service}</td></tr>`)
          .join("") || `<tr><td colspan="4">No hay vehículos registrados</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

function messagesTable(items) {
  return `
    <h2>Mensajes</h2>
    <p>Mensajes de contacto recibidos</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Fecha</th><th>Nombre</th><th>Email</th><th>Mensaje</th></tr></thead>
        <tbody>${items
          .map((item) => `<tr><td>${item.date}</td><td>${item.name}</td><td>${item.email}</td><td>${item.message}</td></tr>`)
          .join("") || `<tr><td colspan="4">No hay mensajes registrados</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

function reportsView(items, stats) {
  const byService = servicios.map((service) => ({
    name: service.titulo,
    count: items.filter((item) => item.service === service.titulo).length,
  }));
  const max = Math.max(1, ...byService.map((item) => item.count));
  return `
    <h2>Reportes</h2>
    <p>Resumen general del centro</p>
    <div class="stats" style="margin-top:24px">
      <div class="stat-card"><span>Total Citas</span><strong>${items.length}</strong></div>
      <div class="stat-card"><span>Pendientes</span><strong>${stats.pending}</strong></div>
      <div class="stat-card"><span>Completadas</span><strong>${stats.completed}</strong></div>
      <div class="stat-card"><span>Vehículos Únicos</span><strong>${stats.uniqueVehicles}</strong></div>
    </div>
    <div class="chart">
      <h3>Citas por Servicio</h3>
      ${byService
        .map(
          (item) => `<div class="bar"><span>${item.name}</span><div class="bar-track"><div class="bar-fill" style="width:${(item.count / max) * 100}%"></div></div><strong>${item.count}</strong></div>`,
        )
        .join("")}
    </div>
  `;
}



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
    a: "Atendemos motos 2T y 4T, vehículos livianos y vehículos pesados. También ofrecemos servicios como peritaje vehicular, diagnóstico electrónico, inspección de frenos y certificado de blindaje.",
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

const chatbotPrompts = {
  "agendar cita": {
    user: "Quiero agendar una cita.",
    bot: "Perfecto. Ve a Agendar Cita y completa tus datos, vehículo, fecha y pago. El sistema guarda tu solicitud al instante.",
    cta: "#/agendar",
  },
  horario: {
    user: "¿Cuál es el horario?",
    bot: `${CDA.horario}`,
    cta: "#/contacto",
  },
  servicios: {
    user: "¿Qué servicios ofrecen?",
    bot: "Ofrecemos revisión técnico-mecánica, revisión de gases, inspección de luces y frenos, peritaje vehicular, certificado de blindaje y diagnóstico electrónico.",
    cta: "#/servicios",
  },
  vehiculos: {
    user: "¿Qué vehículos atienden?",
    bot: "Atendemos motos 2T, motos 4T, vehículos livianos y vehículos pesados. También puedes revisar el detalle de cada tipo en la página principal.",
    cta: "#/",
  },
  ubicacion: {
    user: "¿Dónde están ubicados?",
    bot: `Nuestra sede queda en ${CDA.ubicacion}.`,
    cta: "#/contacto",
  },
  documentos: {
    user: "¿Qué debo llevar?",
    bot: "Lleva tu vehículo con la documentación básica al día y revisa antes del ingreso luces, frenos, llantas y niveles. Si tienes dudas, revisa la sección de preguntas frecuentes.",
    cta: "#/faq",
  },
};

function faqPage() {
  return `
    <section class="section">
      <div class="container">
        <div class="title-block">
          <p class="eyebrow">Preguntas Frecuentes</p>
          <h2>Respuestas claras sobre <span style="color:var(--primary)">revisión técnico-mecánica</span></h2>
          <p>Contenido útil para usuarios y buscadores: agendamiento, revisión de gases, tipos de vehículo, ubicación y requisitos básicos.</p>
        </div>

        <div class="faq-intro card">
          <div class="card-body">
            <h3>Palabras clave importantes</h3>
            <p>Revisión técnico-mecánica en Valledupar, CDA Valledupar, revisión de gases, diagnóstico automotriz, agendar cita CDA y certificado para vehículo.</p>
          </div>
        </div>

        <div class="faq-grid">
          ${faqItems
            .map(
              (item) => `
                <details class="faq-item card">
                  <summary>
                    <span>${item.q}</span>
                    <b>+</b>
                  </summary>
                  <div class="faq-answer">
                    <p>${item.a}</p>
                    <p class="faq-keywords">${item.keywords}</p>
                  </div>
                </details>
              `,
            )
            .join("")}
        </div>

        <div class="seo-band">
          <div>
            <p class="eyebrow">SEO local</p>
            <h3>CDA en Valledupar con atención rápida</h3>
            <p>Si buscas revisión técnico-mecánica Valledupar, revisión de gases, diagnóstico automotriz o agendar cita CDA, esta página concentra la información principal de la actividad.</p>
          </div>
          <div class="button-row">
            <a class="button secondary" href="#/agendar">Agendar Cita</a>
            <a class="button outline" href="#/contacto">Hablar con nosotros</a>
          </div>
        </div>
      </div>
    </section>
  `;
}

function chatbotWidget() {
  return `
    <aside class="chatbot-widget" id="chatbotWidget" aria-label="Asistente de preguntas frecuentes">
      <button class="chatbot-toggle" id="chatbotToggle" type="button" aria-expanded="false">
        <span>💬</span>
        <strong>Asistente rápido</strong>
      </button>
      <div class="chatbot-panel" id="chatbotPanel" hidden>
        <div class="chatbot-head">
          <div>
            <p class="eyebrow">CDA de Valledupar</p>
            <strong>Chatbot de ayuda</strong>
          </div>
          <button class="chatbot-close" id="chatbotClose" type="button" aria-label="Cerrar asistente">×</button>
        </div>
        <div class="chatbot-messages" id="chatbotMessages">
          <div class="chatbot-message bot">
            Elige una opción y te respondo de inmediato.
          </div>
        </div>
        <div class="chatbot-options">
          <button type="button" data-chat="agendar cita">Agendar cita</button>
          <button type="button" data-chat="horario">Horario</button>
          <button type="button" data-chat="servicios">Servicios</button>
          <button type="button" data-chat="vehiculos">Vehículos</button>
          <button type="button" data-chat="ubicacion">Ubicación</button>
          <button type="button" data-chat="documentos">Documentos</button>
        </div>
      </div>
    </aside>
  `;
}

function bindChatbot() {
  const widget = document.querySelector("#chatbotWidget");
  const panel = document.querySelector("#chatbotPanel");
  const toggle = document.querySelector("#chatbotToggle");
  const closeBtn = document.querySelector("#chatbotClose");
  const messages = document.querySelector("#chatbotMessages");
  if (!widget || !panel || !toggle || !closeBtn || !messages) return;

  const openPanel = () => {
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    widget.classList.add("open");
  };

  const closePanel = () => {
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    widget.classList.remove("open");
  };

  toggle.addEventListener("click", () => {
    panel.hidden ? openPanel() : closePanel();
  });

  closeBtn.addEventListener("click", closePanel);

  widget.querySelectorAll("[data-chat]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.getAttribute("data-chat");
      const response = chatbotPrompts[key];
      if (!response) return;

      messages.insertAdjacentHTML(
        "beforeend",
        `
          <div class="chatbot-message user">${response.user}</div>
          <div class="chatbot-message bot">
            ${response.bot}
            ${response.cta ? `<a class="chatbot-link" href="${response.cta}">Abrir sección</a>` : ""}
          </div>
        `,
      );
      messages.scrollTop = messages.scrollHeight;
      openPanel();
    });
  });
}

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

function setActiveNav(path) {
  document.querySelectorAll(".main-nav a").forEach((link) => {
    const href = link.getAttribute("href").replace("#", "");
    link.classList.toggle("active", href === path || (href === "/admin" && path.startsWith("/admin")));
  });
}



function whatsappButton() {
  return `
    <a 
      href="https://wa.me/573166962144?text=Hola,%20quiero%20agendar%20una%20revisión%20técnico-mecánica"
      class="whatsapp-float"
      target="_blank"
    >
      <img src="./assets/img/Whatsapp.png" alt="WhatsApp">
    </a>
  `;
}

function render() {
  ensureSeed();
  const path = location.hash.replace("#", "") || "/";
  setActiveNav(path);
  document.body.classList.remove("menu-open");

  const shell = (content) => `${content}${backedSection()}${whatsappButton()}${chatbotWidget()}`;

  if (path === "/") {
    app.innerHTML = shell(homePage());
    bindQuickAppointment();
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