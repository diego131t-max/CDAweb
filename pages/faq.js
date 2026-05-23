// Página de Preguntas Frecuentes

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
