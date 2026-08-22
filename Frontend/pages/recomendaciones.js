// Página de Recomendaciones
//
// Reemplaza a la vieja "¿Qué inspeccionamos?", que decía en qué consiste la
// revisión pero no lo que la persona necesita ANTES de venir. Todo el contenido
// sale de CONTENIDO_RTM (data.js), que a su vez sale del documento del proceso
// oficial del CDA.
//
// El orden de las secciones sigue el orden de las preguntas reales, no el del
// documento: primero qué llevo, después cómo traigo el carro, después si me toca,
// después qué pasa si no paso, y al final el detalle técnico de la inspección
// —que es lo que menos gente lee y lo único que estaba publicado antes—.

/** Tarjetas de los documentos requeridos, más la aclaración del SOAT. */
function seccionDocumentos() {
  const tarjetas = CONTENIDO_RTM.documentos
    .map(
      (d) => `
        <div class="reco-item">
          <h3>
            ${escaparHtml(d.titulo)}
            ${d.siAplica ? `<span class="reco-etiqueta">si aplica</span>` : ""}
          </h3>
          <p>${escaparHtml(d.detalle)}</p>
        </div>`,
    )
    .join("");

  return `
    <section class="section">
      <div class="container">
        <div class="title-block" data-animar>
          <p class="eyebrow">Antes de venir</p>
          <h2>Qué documentos <span style="color:var(--primary)">necesitas</span></h2>
          <div class="title-mark"><span></span><span></span></div>
        </div>

        <div class="reco-grid" data-animar>${tarjetas}</div>

        <div class="reco-destacado" data-animar>
          <h3>${escaparHtml(CONTENIDO_RTM.soat.titulo)}</h3>
          <p>${escaparHtml(CONTENIDO_RTM.soat.detalle)}</p>
        </div>
      </div>
    </section>`;
}

/**
 * Las condiciones de alistamiento.
 *
 * Es la sección más útil de la página y la que más viajes perdidos evita: si el
 * vehículo llega sin cumplir alguna, el recepcionista NO puede aceptarlo y la
 * persona se devuelve. Por eso el aviso de abajo es tan directo.
 */
function seccionAlistamiento() {
  const items = CONTENIDO_RTM.alistamiento
    .map((c) => `<li>${escaparHtml(c)}</li>`)
    .join("");

  return `
    <section class="section soft">
      <div class="container">
        <div class="title-block" data-animar>
          <p class="eyebrow">Para no perder el viaje</p>
          <h2>Cómo debe llegar tu <span style="color:var(--primary)">vehículo</span></h2>
          <div class="title-mark"><span></span><span></span></div>
          <p>
            Revisa esta lista antes de salir de tu casa. Si algo no se cumple, no podemos
            hacer la revisión y te toca volver otro día.
          </p>
        </div>

        <ul class="reco-lista" data-animar>${items}</ul>
      </div>
    </section>`;
}

/** Cuándo toca la primera revisión, y cómo verificar la vigencia en el RUNT. */
function seccionPeriodicidad() {
  const filas = CONTENIDO_RTM.periodicidad
    .map(
      (p) => `
        <tr>
          <td data-etiqueta="Tipo de vehículo"><strong>${escaparHtml(p.tipo)}</strong></td>
          <td data-etiqueta="Primera revisión">${escaparHtml(p.cuando)}</td>
        </tr>`,
    )
    .join("");

  return `
    <section class="section">
      <div class="container">
        <div class="title-block" data-animar>
          <p class="eyebrow">Periodicidad</p>
          <h2>¿Ya te toca la <span style="color:var(--primary)">revisión</span>?</h2>
          <div class="title-mark"><span></span><span></span></div>
          <p>Los plazos los fija la Ley 2294 de 2023 en su artículo 179.</p>
        </div>

        <div class="table-wrap" data-animar>
          <table class="tabla-apilable">
            <thead>
              <tr><th>Tipo de vehículo</th><th>Primera revisión</th></tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
        </div>

        <div class="reco-destacado" data-animar style="margin-top:24px">
          <h3>Verifica si tu revisión sigue vigente</h3>
          <p>
            El RUNT tiene una consulta ciudadana gratuita: escribes la placa y te dice el
            estado de tu técnico-mecánica y de tu SOAT.
          </p>
          <div class="button-row">
            <a class="button secondary"
               href="https://portalpublico.runt.gov.co/#/consulta-vehiculo/consulta/consulta-ciudadana"
               target="_blank" rel="noopener noreferrer">Consultar en el RUNT</a>
            <a class="button outline" href="/tarifas">Calcular mi tarifa</a>
          </div>
        </div>
      </div>
    </section>`;
}

/** Qué pasa si el vehículo no aprueba. */
function seccionReproceso() {
  return `
    <section class="section soft">
      <div class="container">
        <div class="title-block" data-animar>
          <p class="eyebrow">Si no apruebas</p>
          <h2>Tienes <span style="color:var(--primary)">${CONTENIDO_RTM.reproceso.dias} días</span> para volver sin pagar</h2>
          <div class="title-mark"><span></span><span></span></div>
        </div>

        <div class="reco-destacado" data-animar>
          <p>${escaparHtml(CONTENIDO_RTM.reproceso.detalle)}</p>
        </div>

        <div class="reco-destacado" data-animar style="margin-top:16px">
          <h3>Una sola solicitud a la vez</h3>
          <p>
            Tu vehículo no puede tener una solicitud de revisión abierta en otro CDA. Si la
            tiene, el sistema no nos deja recibirlo — y es la razón más común por la que
            devolvemos a alguien que no entiende por qué.
          </p>
        </div>
      </div>
    </section>`;
}

/** El detalle técnico: qué mide cada equipo y qué revisa una persona. */
function seccionInspeccion() {
  const mecanizada = CONTENIDO_RTM.mecanizada
    .map(
      (m) => `
        <div class="reco-item">
          <h3>${escaparHtml(m.nombre)}</h3>
          <p>${escaparHtml(m.detalle)}</p>
        </div>`,
    )
    .join("");

  const lista = (items) => items.map((i) => `<li>${escaparHtml(i)}</li>`).join("");

  return `
    <section class="section">
      <div class="container">
        <div class="title-block" data-animar>
          <p class="eyebrow">Qué inspeccionamos</p>
          <h2>Todo lo que <span style="color:var(--primary)">revisamos</span></h2>
          <div class="title-mark"><span></span><span></span></div>
          <p>
            La revisión tiene dos partes: la que hacen los equipos y la que hace un técnico
            con sus propios ojos, sin desarmar nada. Los requisitos están en la NTC 5375.
          </p>
        </div>

        <h3 class="reco-subtitulo">Pruebas con equipos</h3>
        <div class="reco-grid" data-animar>${mecanizada}</div>

        <h3 class="reco-subtitulo">Inspección visual</h3>
        <div class="reco-columnas" data-animar>
          <div class="reco-item">
            <h3>Carros y camionetas</h3>
            <ul class="reco-lista compacta">${lista(CONTENIDO_RTM.sensorial.livianos)}</ul>
          </div>
          <div class="reco-item">
            <h3>Motos</h3>
            <ul class="reco-lista compacta">${lista(CONTENIDO_RTM.sensorial.motos)}</ul>
          </div>
        </div>
      </div>
    </section>`;
}

function recomendacionesPage() {
  return `
    ${pageHero(
      "Recomendaciones",
      "Qué documentos llevar, cómo traer tu vehículo y qué revisamos. Todo lo que necesitas saber antes de venir.",
      "Prepara tu revisión",
    )}

    ${seccionDocumentos()}
    ${seccionAlistamiento()}
    ${seccionPeriodicidad()}
    ${seccionReproceso()}
    ${seccionInspeccion()}

    <section class="section">
      <div class="container">
        <div class="cta">
          <p class="eyebrow">Ya estás listo</p>
          <h2>Agenda tu cita y evita la fila</h2>
          <p>Elige el día y la hora que mejor te sirvan.</p>
          <div class="button-row" style="justify-content:center">
            <a class="button secondary" href="/agendar">Agendar Cita</a>
            <a class="button outline" href="/faq">Preguntas frecuentes</a>
          </div>
        </div>
      </div>
    </section>
  `;
}
