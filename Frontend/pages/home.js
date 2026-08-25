// Página Principal / Home

// El servicio con el que agenda este formulario es SERVICIO_UNICO_ID (utils.js),
// el mismo que usa el formulario de cuatro pasos. Acá había una constante propia
// escrita como NOMBRE ("Revisión Técnico-Mecánica"); se fue el 2026-08-21, al
// renombrarse el servicio para que nombrara también los gases. Ese cambio la
// habría dejado sin encontrar nada y este formulario habría dejado de agendar
// sin que nadie tocara este archivo: el nombre cambia, el id no.

// El campo de fecha lleva `min` con el día de hoy (fechaHoyLocal, en utils.js):
// hasta ahora se podían solicitar revisiones para fechas ya pasadas.
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
        <div class="quick-split">
          <div class="field">
            <label for="quickDate">Fecha</label>
            <input id="quickDate" name="date" type="date" min="${fechaHoyLocal()}" required>
          </div>
          <div class="field" id="quickCampoHora">${campoDeHoraRapida()}</div>
        </div>
        ${campoTrampaMarkup()}
        ${quickAlertMarkup()}
        <button class="button secondary quick-submit" type="submit">Solicitar Cita</button>
      </form>
    </aside>
  `;
}

function vehiclesSection() {
  return `
    <section class="section">
      <div class="container">
        <div class="title-block" data-animar>
          <p class="eyebrow">Revisión Técnico-Mecánica y de Gases</p>
          <h2>Tipos de Vehículos que <span style="color:var(--primary)">Atendemos</span></h2>
          <div class="title-mark"><span></span><span></span></div>
        </div>
        <div class="grid four">
          ${vehiculos
            .map(
              (item, index) => `
                <article class="card" data-animar>
                  <div class="image-top">
                    <img class="${item.recorte ? "recorte" : ""}" src="${conVersion(item.img)}" alt="${item.label}" width="600" height="400" loading="lazy" decoding="async">
                    <span class="badge-number">${String(index + 1).padStart(2, "0")}</span>
                    <span class="image-title">${item.label}</span>
                  </div>
                  <div class="card-body">
                    <p>${item.desc}</p>
                    <div class="button-row"><a class="button" href="/agendar">Agendar Cita</a></div>
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
    <section class="section soft features">
      <div class="container">
        <div class="title-block" data-animar>
          <h2>Por Qué Elegir <span style="color:var(--primary)">${CDA.nombre}</span></h2>
        </div>
        <div class="grid four">
          ${features
            .map(
              // `encuadre` es opcional: qué parte de la foto se conserva cuando
              // object-fit la recorta. La ranura es casi 2.5:1 y una foto normal
              // no lo es, así que sin esto el recorte sale del centro y puede
              // cortar justo lo que importa —en la de técnicos, las cabezas—.
              ([icon, title, desc, img, encuadre]) => `
                <article class="card center feature-card" data-animar>
                  <div class="image-top">
                    <img src="${conVersion(img)}" alt="${title}" width="600" height="400" loading="lazy" decoding="async"${encuadre ? ` style="object-position:${encuadre}"` : ""}>
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
    // Los dos de abajo los usa mediosDePagoSection(), no las tarjetas de
    // features. Viven en este registro porque es el único que hay, y porque son
    // del mismo juego: trazo con currentColor, sin relleno, viewBox de 24.
    efectivo: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="6" width="20" height="12" rx="2"></rect>
        <circle cx="12" cy="12" r="2.5"></circle>
        <path d="M6 12h.01"></path>
        <path d="M18 12h.01"></path>
      </svg>
    `,
    tarjeta: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="5" width="20" height="14" rx="2"></rect>
        <path d="M2 10h20"></path>
        <path d="M6 15h4"></path>
      </svg>
    `,
    qr: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1"></rect>
        <rect x="14" y="3" width="7" height="7" rx="1"></rect>
        <rect x="3" y="14" width="7" height="7" rx="1"></rect>
        <path d="M14 14h3v3h-3z"></path>
        <path d="M20 14h1"></path>
        <path d="M14 20h1"></path>
        <path d="M20 17v4h-3"></path>
      </svg>
    `,
    transferencia: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 8h15"></path>
        <path d="m15 5 3 3-3 3"></path>
        <path d="M21 16H6"></path>
        <path d="m9 13-3 3 3 3"></path>
      </svg>
    `,
  };
  return icons[icon] || icons.clock;
}

// Check de la lista de confianza del hero. Mismo patrón que featureIconSvg():
// trazo con currentColor, sin relleno. El color y el tamaño los pone .trust-list li svg.
function checkIconSvg() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4 12.5 5 5 11-11"></path>
    </svg>
  `;
}

// Medios de pago.
//
// Va DESPUÉS del proceso de 3 pasos porque contesta la pregunta que queda cuando
// ya entendiste cómo es el trámite: "¿y con qué pago?".
//
// Lee de `mediosDePago` (data.js) en vez de traer su propia lista, que es la
// misma fuente que alimenta el <select> del formulario de agendamiento. Cuando
// cada uno tenía la suya, la del formulario terminó ofreciendo dos pasarelas que
// el CDA nunca tuvo.
//
// El subtítulo distingue las dos vías a propósito, y desde 2026-08-24 son dos.
// Antes decía solo "en el CDA" porque el sitio no cobraba nada; ahora hay pago en
// línea —QR de Bancolombia y transferencia— y omitirlo dejaría medio catálogo sin
// explicación. Lo que sigue siendo cierto, y por eso se conserva la última frase:
// AGENDAR ES GRATIS. El sitio no cobra ni siquiera en la vía en línea, donde el
// dinero se mueve por fuera y lo único que llega acá es el comprobante.
function mediosDePagoSection() {
  return `
    <section class="section soft pagos">
      <div class="container">
        <div class="title-block" data-animar>
          <p class="eyebrow">Medios de pago</p>
          <h2>¿Cómo puedes pagar?</h2>
          <p>Pagas en el CDA el día de tu revisión, o en línea al agendar. Agendar no te cuesta nada.</p>
        </div>
        <div class="pagos-grid" data-animar>
          ${mediosDePago
            .map(
              (medio) => `
                <article class="card pago-card">
                  <div class="card-body">
                    <span class="pago-icono">${featureIconSvg(medio.icono)}</span>
                    <h3>${escaparHtml(medio.titulo)}</h3>
                    <p>${escaparHtml(medio.detalle)}</p>
                  </div>
                </article>`,
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
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
        <div class="title-block" data-animar><h2>Proceso Fácil en <span style="color:var(--secondary)">3 Pasos</span></h2></div>
        <div class="grid three">
          ${steps
            .map(
              ([num, title, desc, img]) => `
                <article class="card process-card" data-animar>
                  <div class="image-top">
                    <img src="${conVersion(img)}" alt="${title}" width="600" height="400" loading="lazy" decoding="async">
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
        <div class="title-block" data-animar><h2>Opiniones de <span style="color:var(--primary)">Clientes Satisfechos</span></h2></div>
        <div class="grid three">
          ${items
            .map(
              ([name, city, text, avatar]) => `
                <article class="card" data-animar>
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
  // Las tres cifras que el sitio publica sobre el negocio.
  //
  // No son decoración: son afirmaciones comerciales sobre el CDA, y quien las
  // lee las toma como ciertas. Los años y los vehículos los actualizó Diego el
  // 2026-08-21 (de 15 y 45.000), y vienen de él, no de un documento que se pueda
  // volver a consultar. Si alguna vez hay que sustentarlas, ese es el origen.
  //
  // El 93% de clientes satisfechos sigue como estaba: no se tocó porque nadie lo
  // pidió, y tampoco se sabe de dónde salió.
  //
  // El separador de miles no se escribe acá: toLocaleString("es-CO") en
  // bindCounters convierte 200000 en "200.000".
  const stats = [
    { value: 20, suffix: "+", label: "Años sirviendo a Valledupar" },
    { value: 200000, suffix: "+", label: "Vehículos Revisados" },
    { value: 93, suffix: "%", label: "Clientes Satisfechos" },
  ];
  return `
    <section class="section stats-section">
      <div class="container">
        <div class="stats-grid">
          ${stats
            .map(
              ({ value, suffix, label }) => `
                <div class="stat-card" data-animar>
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
    <section class="page-hero" data-animar>
      <h2>¡No esperes más!</h2>
      <p>Garantiza el rendimiento de tu vehículo y optimiza la seguridad de tu automóvil.</p>
      <div class="button-row" style="justify-content:center">
        <a class="button secondary" href="/agendar">Solicitar Revisión Hoy</a>
      </div>
    </section>
  `;
}

/* ===========================================================================
 * QUIÉNES SOMOS — ENCENDIDO POR DECISIÓN DE DIEGO, NO POR APROBACIÓN DEL DUEÑO
 *
 * OJO CON ESTA DISTINCIÓN, QUE ES TODO EL PUNTO. El interruptor pasó a `true` el
 * 2026-08-20 porque Diego lo pidió y asumió la responsabilidad de publicarlo. El
 * propietario NO ha leído este texto. No es lo mismo y no conviene que dentro de
 * seis meses alguien lea "está publicado" y deduzca "está aprobado".
 *
 * Por qué importa: una misión y una visión en el sitio de un negocio real son una
 * declaración SUYA, no nuestra. El principio I de la constitución pide que los
 * datos del negocio se confirmen con el propietario, y esto se publica sin esa
 * confirmación. Queda pendiente que las lea y las corrija.
 *
 * De dónde salió el borrador: de "INFO PAG. WEB.docx", que define para qué existe
 * la RTMyEC —reducir la accidentalidad, controlar las emisiones, verificar
 * defectos que sean riesgo para la seguridad vial— y qué la hace confiable: equipos
 * especializados y personal competente, "siendo este último determinante". O sea
 * que no está inventado, pero tampoco está dicho por él.
 *
 * LA HISTORIA TIENE UN HUECO Y ESTÁ MARCADO. "Primer CDA del Cesar y La Guajira"
 * es un dato histórico que no aparece en ningún documento disponible: no se puede
 * deducir ni estimar. Hasta que lo confirme, con el año, ese párrafo no se escribe.
 * Que la sección esté publicada no cambia esto: se publica sin historia.
 *
 * PARA APAGARLO otra vez —si el propietario objeta el texto—: pasar esto a `false`
 * y subir el ?v=. La sección desaparece del sitio sin borrar nada.
 * =========================================================================== */
const QUIENES_SOMOS_APROBADO = true;

function quienesSomosSection() {
  return `
    <section class="section soft">
      <div class="container">
        <div class="title-block" data-animar>
          <p class="eyebrow">Quiénes somos</p>
          <h2>Más que un <span style="color:var(--primary)">certificado</span></h2>
          <div class="title-mark"><span></span><span></span></div>
        </div>

        <div class="grid two">
          <article class="card" data-animar>
            <div class="card-body">
              <h3>Nuestra misión</h3>
              <p>
                Evaluar con rigor técnico el estado de los vehículos que circulan por el
                Cesar, aplicando los procedimientos de la NTC 5375 con equipos calibrados y
                personal competente. Cada certificado que entregamos tiene que significar
                algo: que ese vehículo es seguro para quien lo conduce y para los demás.
              </p>
            </div>
          </article>

          <article class="card" data-animar>
            <div class="card-body">
              <h3>Nuestra visión</h3>
              <p>
                Ser el centro de diagnóstico automotor al que la gente vuelve por decisión
                propia: por la seriedad de la inspección, por explicar con claridad cada
                defecto que encontramos y por respetar el tiempo de quien nos visita.
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>`;
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
            <a class="button secondary" href="/agendar">Agendar Cita Ahora</a>
            <a class="button outline" href="/recomendaciones">Recomendaciones</a>
          </div>
          <ul class="trust-list">
            ${["Técnicos Certificados", "Resultados en Minutos", "Precios Asequibles"]
              .map((item) => `<li>${checkIconSvg()}${item}</li>`)
              .join("")}
          </ul>
        </div>
        ${quickAppointmentCard()}
      </div>
    </section>
    ${statsSection()}
    ${vehiclesSection()}
    ${featuresSection()}
    ${QUIENES_SOMOS_APROBADO ? quienesSomosSection() : ""}
    ${processSection()}
    ${mediosDePagoSection()}
    ${testimonialsSection()}
    ${finalCta()}
  `;
}

// Anima los contadores cuando la sección entra en pantalla
// El observer vive fuera de la función y se desconecta antes de crear el
// siguiente. Sin esto, cada vuelta al inicio dejaba uno más observando nodos que
// render() ya había destruido: nunca se rompía nada a la vista, pero se
// acumulaban. Mismo patrón que bindEntradas() en utils.js.
let observadorContadores = null;

function bindCounters() {
  if (observadorContadores) {
    observadorContadores.disconnect();
    observadorContadores = null;
  }

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

  observadorContadores = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          observadorContadores.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 },
  );

  counters.forEach((el) => observadorContadores.observe(el));
}
// Contenedor del aviso del formulario rápido. Se dibuja vacío y oculto; el texto
// lo pone mostrarAvisoCitaRapida() con textContent, igual que en el formulario de
// cuatro pasos (mostrarAvisoAgendamiento en pages/schedule.js).
function quickAlertMarkup() {
  return `<p class="form-alert" id="quickAlert" role="alert" hidden></p>`;
}

function mostrarAvisoCitaRapida(mensaje) {
  const aviso = document.querySelector("#quickAlert");
  if (!aviso) return;
  aviso.textContent = mensaje;
  aviso.hidden = !mensaje;
}

// Valida contra el catálogo el servicio con el que se va a registrar la cita
// rápida. Devuelve el mensaje que explica por qué no se puede agendar, o "" si la
// combinación es válida. Mismo criterio que fijarYValidarServicio() en
// pages/schedule.js, porque las dos rutas terminan guardando la misma cita: sería
// absurdo que el formulario largo rechace lo que el corto acepta sin mirar.
//
// MENSAJE_CATALOGO_NO_DISPONIBLE vive en pages/schedule.js, que se carga DESPUÉS
// que este archivo. No es problema: esto se ejecuta al enviar el formulario, con
// todos los scripts ya evaluados. Se reusa el texto en vez de copiarlo para que no
// haya dos versiones de la misma explicación que puedan quedar desincronizadas.
/** Lo que impide enviar la cita rápida por la hora, o "" si se puede. */
function validarFranjaRapida() {
  if (cargandoFranjasRapidas) return "Estamos consultando los cupos. Espera un momento.";
  if (franjasRapidas === null) {
    return "No pudimos consultar los cupos disponibles. Intenta de nuevo en unos minutos.";
  }

  const elegida = franjasRapidas.find((franja) => franja.hora === horaRapidaElegida);
  if (!elegida) return "Elige una hora para tu cita.";
  if (elegida.disponibles <= 0) return "Esa hora ya no tiene cupo. Elige otra de la lista.";
  return "";
}

function validarServicioCitaRapida(vehiculo) {
  // Sin catálogo no hay forma de saber si el servicio existe: no se agenda.
  if (!catalogoServiciosCargado) return MENSAJE_CATALOGO_NO_DISPONIBLE;

  const servicio = buscarServicioPorId(SERVICIO_UNICO_ID);
  if (!servicio) return MENSAJE_SERVICIO_NO_DISPONIBLE;

  if (!servicioAplicaAVehiculo(servicio, vehiculo)) {
    return `${servicio.nombre} no aplica a ${vehiculo}. Escríbenos por WhatsApp y te orientamos.`;
  }

  return "";
}

/*
 * Cupos del formulario rápido — FR-028.
 *
 * ESTE FORMULARIO NO PREGUNTABA LA HORA: mandaba "09:00" fijo para todos, y el
 * mensaje de éxito decía que el CDA llamaría "para confirmar hora y pago".
 *
 * Mientras no hubo tope eso era feo pero inofensivo. Con cuatro cupos por
 * franja se vuelve un callejón: las primeras cuatro solicitudes del día llenan
 * las 9:00, y a partir de la quinta el servidor responde que "esa hora se
 * llenó" — a alguien que nunca eligió una hora y no tiene forma de cambiarla.
 *
 * Así que ahora la pregunta. Es un campo más en un formulario que se llama
 * "rápido", y aun así es lo correcto: convierte una solicitud vaga en una
 * reserva real, que es lo que el cliente cree que está haciendo.
 */
let franjasRapidas = null;
let cargandoFranjasRapidas = false;
let horaRapidaElegida = "";
/*
 * La fecha elegida se guarda ACÁ y no se lee del DOM.
 *
 * No es un capricho: campoDeHoraRapida() corre mientras render() arma la
 * cadena de HTML, o sea ANTES de asignarla. En ese instante el #quickDate que
 * hay en el documento es el de la página anterior —render() todavía no lo
 * reemplazó—, así que preguntarle su valor devuelve el de la visita pasada.
 */
let fechaRapidaElegida = "";

function campoDeHoraRapida() {
  const etiqueta = `<label for="quickTime">Hora</label>`;

  if (!fechaRapidaElegida) {
    return `${etiqueta}<select id="quickTime" name="time" disabled><option>Elige la fecha</option></select>`;
  }
  if (cargandoFranjasRapidas) {
    return `${etiqueta}<select id="quickTime" name="time" disabled><option>Consultando…</option></select>`;
  }
  if (franjasRapidas === null) {
    return `${etiqueta}<select id="quickTime" name="time" disabled><option>Sin conexión</option></select>`;
  }
  if (!franjasRapidas.some((franja) => franja.disponibles > 0)) {
    return `${etiqueta}<select id="quickTime" name="time" disabled><option>Sin cupo ese día</option></select>`;
  }

  return `${etiqueta}<select id="quickTime" name="time" required>${opcionesDeFranja(franjasRapidas, horaRapidaElegida)}</select>`;
}

function repintarHoraRapida() {
  const contenedor = document.querySelector("#quickCampoHora");
  if (contenedor) contenedor.innerHTML = campoDeHoraRapida();
}

async function refrescarFranjasRapidas(fecha) {
  fechaRapidaElegida = fecha;
  if (!fecha) {
    franjasRapidas = null;
    repintarHoraRapida();
    return;
  }

  cargandoFranjasRapidas = true;
  repintarHoraRapida();

  const resultado = await consultarDisponibilidad(fecha);
  cargandoFranjasRapidas = false;

  if (!resultado.ok) {
    franjasRapidas = null;
    repintarHoraRapida();
    return;
  }

  franjasRapidas = resultado.franjas;
  const elegida = franjasRapidas.find((franja) => franja.hora === horaRapidaElegida);
  if (!elegida || elegida.disponibles <= 0) {
    horaRapidaElegida = primeraFranjaLibre(franjasRapidas) || "";
  }
  repintarHoraRapida();
}

function bindQuickAppointment() {
  const form = document.querySelector("#quickAppointmentForm");
  if (!form) return;

  // Cupos (FR-028). El estado es de módulo y render() vuelve a dibujar el
  // formulario en blanco, así que se reinicia acá: si no, al volver al inicio
  // se verían los cupos de la visita anterior con una fecha ya borrada.
  franjasRapidas = null;
  cargandoFranjasRapidas = false;
  horaRapidaElegida = "";
  fechaRapidaElegida = "";

  const campoFecha = form.querySelector("#quickDate");
  if (campoFecha) {
    campoFecha.addEventListener("change", () => {
      fechaRapidaElegida = campoFecha.value;
      franjasRapidas = null;
      mostrarAvisoCitaRapida("");
      void refrescarFranjasRapidas(campoFecha.value);
    });
  }

  // El <select> de hora se redibuja entero cada vez, así que el listener no
  // puede vivir en él: se engancha al formulario y se filtra por objetivo.
  form.addEventListener("change", (evento) => {
    if (evento.target && evento.target.id === "quickTime") {
      horaRapidaElegida = evento.target.value;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));

    // El servicio se verifica ANTES de enviar. Hasta hace poco este formulario
    // escribía un nombre fijo sin comprobarlo contra nada, así que esquivaba por
    // completo la validación que sí hace el formulario de cuatro pasos.
    const problema = validarServicioCitaRapida(data.vehicle);
    if (problema) {
      mostrarAvisoCitaRapida(problema);
      return;
    }

    // El <select> deshabilitado no viaja en el FormData, así que sin esto una
    // consulta caída o un día lleno dejarían enviar sin hora (FR-028).
    const problemaDeHora = validarFranjaRapida();
    if (problemaDeHora) {
      mostrarAvisoCitaRapida(problemaDeHora);
      return;
    }
    mostrarAvisoCitaRapida("");

    /*
     * ESTA ERA LA SEGUNDA VÍA POR LA QUE SE PERDÍAN CITAS.
     *
     * Igual que el formulario de cuatro pasos, escribía en localStorage: el
     * cliente veía "¡Cita solicitada!" y el CDA no recibía nada. Arreglar solo el
     * formulario largo habría dejado este agujero abierto justo en la página de
     * inicio, que es por donde entra la mayoría.
     */
    const boton = form.querySelector("button[type=submit]");
    const textoOriginal = boton ? boton.textContent : "";
    if (boton) {
      boton.disabled = true;
      boton.textContent = "Enviando…";
    }

    const resultado = await registrarCitaEnServidor({
      clientName: data.clientName,
      phone: data.phone,
      cedula: data.cedula,
      plate: data.plate,
      vehicle: data.vehicle,
      // El ID del catálogo, no el nombre: es la referencia estable que entiende
      // el servidor. validarServicioCitaRapida ya comprobó que está.
      service: buscarServicioPorId(SERVICIO_UNICO_ID).id,
      date: data.date,
      // La hora que eligió, no un "09:00" fijo para todos. Ver el comentario de
      // franjasRapidas.
      time: data.time || horaRapidaElegida,
      // Este formulario no pregunta el medio de pago. Se registra como pendiente
      // de acordar en vez de inventar uno: es un dato del negocio y el cliente no
      // lo eligió (principio I).
      payment: "Por confirmar",
      // Campo trampa: si lo llenó un guion, el servidor descarta el envío.
      [CAMPO_TRAMPA]: valorCampoTrampa(data),
    });

    if (boton) {
      boton.disabled = false;
      boton.textContent = textoOriginal;
    }

    if (!resultado.ok) {
      // El formulario NO se reemplaza: lo que el cliente escribió sigue ahí y
      // puede reintentar. Y sobre todo, no se le dice que quedó agendado.
      mostrarAvisoCitaRapida(resultado.mensaje);

      // Si la franja se llenó mientras llenaba el formulario, los cupos en
      // pantalla ya están viejos: se vuelven a pedir para que el desplegable
      // muestre lo que de verdad queda (FR-028).
      if (resultado.franjaLlena) {
        franjasRapidas = null;
        await refrescarFranjasRapidas(data.date);
      }
      return;
    }

    form.outerHTML = `
      <div class="quick-success">
        <h3>¡Cita solicitada!</h3>
        <p>Tu cita quedó registrada para la fecha y hora que elegiste. Nos pondremos en contacto contigo para confirmar el medio de pago.</p>
        <p><small>Número de tu cita: ${escaparHtml(resultado.cita.id)}</small></p>
        <div class="button-row">
          <a class="button secondary" href="/agendar">Completar agendación</a>
        </div>
      </div>
    `;
  });
}
