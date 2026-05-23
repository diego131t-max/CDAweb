// Página de Contacto

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
