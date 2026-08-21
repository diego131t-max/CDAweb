// Página de Preguntas Frecuentes
//
// Se retiraron dos bloques que estaban a la vista del visitante: uno titulado
// "Palabras clave importantes", que listaba términos de búsqueda sueltos, y una
// banda de "SEO local" que repetía los mismos términos en una frase.
//
// Eso se hacía en 2010. Hoy Google no le da ningún peso a una lista de palabras
// clave escrita para él, y a una persona le queda un renglón raro que no
// significa nada —peor: da la impresión de que el sitio le habla a una máquina y
// no a ella—. Lo que sí posiciona es que las respuestas contesten de verdad la
// pregunta, y de eso se ocupa el contenido nuevo de faqItems, sacado del proceso
// oficial del CDA.
//
// También se fue el campo `keywords` de cada pregunta, que se imprimía debajo de
// cada respuesta por el mismo motivo.
//
// La página pasó a usar pageHero como el resto del sitio: antes abría con un
// title-block suelto y era la única sin encabezado.

function faqPage() {
  const preguntas = faqItems
    .map(
      (item) => `
        <details class="faq-item card">
          <summary>
            <span>${escaparHtml(item.q)}</span>
            <b>+</b>
          </summary>
          <div class="faq-answer">
            <p>${item.a}</p>
          </div>
        </details>`,
    )
    .join("");

  return `
    ${pageHero(
      "Preguntas frecuentes",
      "Qué llevar, cuándo te toca, qué pasa si no apruebas y cómo agendar. Las dudas que más nos llegan, resueltas.",
      "Resolvemos tus dudas",
      // Fondo propio: la sala de espera real. Las otras tres páginas que usan
      // pageHero siguen con el de siempre (ver .page-hero.recepcion en styles.css).
      "recepcion",
    )}

    <section class="section">
      <div class="container">
        <div class="faq-grid">${preguntas}</div>

        <div class="cta" style="margin-top:32px">
          <p class="eyebrow">¿Te quedó alguna duda?</p>
          <h2>Escríbenos y te respondemos</h2>
          <p>Si tu pregunta no está acá, llámanos o mándanos un mensaje.</p>
          <div class="button-row" style="justify-content:center">
            <a class="button secondary" href="/agendar">Agendar Cita</a>
            <a class="button outline" href="/contacto">Hablar con nosotros</a>
          </div>
        </div>
      </div>
    </section>
  `;
}
