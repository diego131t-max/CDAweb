function chatbotWidget() {
  return `
    <aside class="chatbot-widget" id="chatbotWidget" aria-label="Asistente de preguntas frecuentes">
 
      <div class="chatbot-panel" id="chatbotPanel" role="dialog" aria-label="Chatbot de ayuda">
 
        <div class="chatbot-head">
          <div class="chatbot-head-left">
            <div class="chatbot-avatar" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>
                <path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>
                <path d="M5 17h-2v-6l2-5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6-6h15m-6 0v-5"/>
              </svg>
            </div>
            <div class="chatbot-head-info">
              <p class="chatbot-eyebrow">CDA de Valledupar</p>
              <strong>Chatbot de ayuda</strong>
              <div class="chatbot-status">
                <span class="chatbot-dot"></span>
                <p>En línea</p>
              </div>
            </div>
          </div>
          <button class="chatbot-close" id="chatbotClose" type="button" aria-label="Cerrar asistente">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 6l-12 12"/><path d="M6 6l12 12"/>
            </svg>
          </button>
        </div>
 
        <div class="chatbot-messages" id="chatbotMessages">
          <div class="chatbot-message bot">
            ¡Hola! 👋 Elige una opción y te respondo de inmediato.
          </div>
        </div>
 
        <div class="chatbot-options-wrap">
          <p class="chatbot-options-label">¿En qué te ayudo?</p>
          <div class="chatbot-options">
 
            <button type="button" data-chat="agendar cita">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 5m0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2z"/>
                <path d="M16 3v4"/><path d="M8 3v4"/><path d="M4 11h16"/>
              </svg>
              Agendar cita
            </button>
 
            <button type="button" data-chat="horario">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
              </svg>
              Horario
            </button>
 
            <button type="button" data-chat="servicios">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M9 5h-2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-12a2 2 0 0 0-2-2h-2"/>
                <path d="M9 3m0 2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z"/>
                <path d="M9 12h6"/><path d="M9 16h6"/>
              </svg>
              Servicios
            </button>
 
            <button type="button" data-chat="vehiculos">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0"/>
                <path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0"/>
                <path d="M5 17h-2v-6l2-5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6-6h15m-6 0v-5"/>
              </svg>
              Vehículos
            </button>
 
            <button type="button" data-chat="ubicacion">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0-6 0"/>
                <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z"/>
              </svg>
              Ubicación
            </button>
 
            <button type="button" data-chat="documentos">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M14 3v4a1 1 0 0 0 1 1h4"/>
                <path d="M17 21h-10a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/>
                <path d="M9 12h6"/><path d="M9 16h6"/>
              </svg>
              Documentos
            </button>
 
            <button type="button" data-chat="precios">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0"/>
                <path d="M14.8 9a2 2 0 0 0-1.8-1h-2a2 2 0 1 0 0 4h2a2 2 0 1 0 0 4h-2a2 2 0 0 0-1.8-1"/>
                <path d="M12 7v10"/>
              </svg>
              Precios
            </button>
 
          </div>
        </div>
 
      </div>
 
      <button class="chatbot-toggle" id="chatbotToggle" type="button" aria-expanded="false">
        <div class="chatbot-toggle-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 21v-13a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-9l-4 4"/>
          </svg>
        </div>
        <strong>Asistente virtual</strong>
        <span class="chatbot-toggle-dot" aria-hidden="true"></span>
      </button>
 
    </aside>
  `;
}
 
// ── Lógica del widget ────────────────────────────────────────
 
function bindChatbot() {
  const panel    = document.getElementById("chatbotPanel");
  const toggle   = document.getElementById("chatbotToggle");
  const closeBtn = document.getElementById("chatbotClose");
  const messages = document.getElementById("chatbotMessages");
  if (!panel || !toggle || !closeBtn || !messages) return;
 
  const openPanel = () => {
    panel.classList.add("open");
    toggle.setAttribute("aria-expanded", "true");
  };
 
  const closePanel = () => {
    panel.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  };
 
  toggle.addEventListener("click", () =>
    panel.classList.contains("open") ? closePanel() : openPanel()
  );
  closeBtn.addEventListener("click", closePanel);
 
  document.querySelectorAll("[data-chat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-chat");
      const r = chatbotPrompts[key];
      if (!r) return;
 
      openPanel();
 
      messages.insertAdjacentHTML(
        "beforeend",
        `<div class="chatbot-message user">${r.user}</div>`
      );
      messages.scrollTop = messages.scrollHeight;
 
      const typing = document.createElement("div");
      typing.className = "chatbot-typing";
      typing.innerHTML = "<span></span><span></span><span></span>";
      messages.appendChild(typing);
      messages.scrollTop = messages.scrollHeight;
 
      setTimeout(() => {
        typing.remove();
        const ctaHtml = r.cta
          ? `<a class="chatbot-link" href="${r.cta}">
               <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                 <path d="M12 6h-6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>
                 <path d="M11 13l9-9"/><path d="M15 4h5v5"/>
               </svg>
               ${r.ctaLabel}
             </a>`
          : "";
        messages.insertAdjacentHTML(
          "beforeend",
          `<div class="chatbot-message bot">${r.bot}${ctaHtml ? "<br>" + ctaHtml : ""}</div>`
        );
        messages.scrollTop = messages.scrollHeight;
      }, 700);
    });
  });
}