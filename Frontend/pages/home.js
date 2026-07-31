// Página Principal / Home

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

function statsSection() {
  const stats = [
    { value: 15, suffix: "+", label: "Años sirviendo a Valledupar" },
    { value: 45000, suffix: "+", label: "Vehículos Revisados" },
    { value: 93, suffix: "%", label: "Clientes Satisfechos" },
  ];
  return `
    <section class="section stats-section">
      <div class="container">
        <div class="stats-grid">
          ${stats
            .map(
              ({ value, suffix, label }) => `
                <div class="stat-card">
                  <div class="stat-number">
                    <span class="counter-num" data-target="${value}">0</span><span class="stat-suffix">${suffix}</span>
                  </div>
                  <div class="stat-label">${label}</div>
                </div>
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
    ${statsSection()}
    ${vehiclesSection()}
    ${featuresSection()}
    ${processSection()}
    ${testimonialsSection()}
    ${finalCta()}
  `;
}

// Anima los contadores cuando la sección entra en pantalla
function bindCounters() {
  const counters = document.querySelectorAll(".counter-num");
  if (!counters.length) return;

  const animate = (el) => {
    const target = parseInt(el.dataset.target, 10);
    const duration = 1800;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(ease * target).toLocaleString("es-CO");
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target.toLocaleString("es-CO");
    };
    requestAnimationFrame(step);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 },
  );

  counters.forEach((el) => observer.observe(el));
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
