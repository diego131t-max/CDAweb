// Página de Contacto

// Enlace de WhatsApp que se ofrece como alternativa cuando el envío falla. Es el
// mismo número del botón flotante (whatsappButton en utils.js).
const WHATSAPP_CONTACTO = "https://wa.me/573166962144?text=Hola,%20quiero%20hacerles%20una%20consulta";

// Textos de cada forma de fallo del envío. Están juntos a propósito: la regla que
// tienen que cumplir TODOS es la misma —ninguno puede dar a entender que el
// mensaje llegó— y verlos en una sola lista es lo que permite revisarla de un
// vistazo. Antes el formulario decía "¡Mensaje Enviado!" pase lo que pase, y el
// CDA no recibía nada: la promesa era falsa (FR-011).
const MENSAJES_FALLO_CONTACTO = {
  // Red caída, corte por tiempo o error del servidor: el mensaje no salió y no
  // sabemos cuándo va a poder salir.
  sinEnvio:
    "No pudimos enviar tu mensaje en este momento. Revisa tu conexión y vuelve a intentarlo: tu texto sigue acá, no se perdió.",
  // 429 del limitador del API.
  demasiados:
    "Recibimos varios mensajes desde tu conexión en poco tiempo. Espera unos minutos y vuelve a intentarlo; tu texto sigue acá.",
  // 400 sin detalles utilizables.
  datos: "Revisa los datos del formulario: alguno no es válido y por eso no pudimos enviar tu mensaje.",
};

function contactPage() {
  return `
    <section class="section">
      <div class="container">
        <div class="title-block" data-animar>
          <p class="eyebrow">Contáctanos</p>
          <h2>Contacto</h2>
          <p>¿Tienes preguntas? Estamos aquí para ayudarte</p>
        </div>
        <div class="contact-grid">
          <form class="form-card form-grid" id="contactForm" data-animar>
            <div class="field full"><label for="contactName">Nombre *</label><input id="contactName" name="name" placeholder="Tu nombre" required></div>
            <div class="field full"><label for="contactEmail">Email *</label><input id="contactEmail" name="email" type="email" placeholder="tu@email.com" required></div>
            <div class="field full"><label for="contactMessage">Mensaje *</label><textarea id="contactMessage" name="message" placeholder="Cuéntanos cómo podemos ayudarte" required></textarea></div>
            ${campoTrampaMarkup()}
            ${contactAlertMarkup()}
            <div class="field full"><button class="button secondary" type="submit">Enviar Mensaje</button></div>
          </form>
          <div>
            <div class="info-list" data-animar>
              <div class="info-item"><span>📍</span><div><b>Ubicación</b><p>${CDA.ubicacion}</p><p class="info-nota">${CDA.referencia}. ${CDA.parqueadero}</p></div></div>
              <div class="info-item"><span>☎</span><div><b>Teléfono</b><p>${CDA.telefono}</p></div></div>
              <div class="info-item"><span>✉</span><div><b>Email</b><p>${CDA.email}</p></div></div>
              <div class="info-item"><span>🕒</span><div><b>Horario</b><p>${CDA.horario}</p></div></div>
            </div>
            ${mapaMarkup()}
          </div>
        </div>
      </div>
    </section>
  `;
}

// Mapa de Google embebido: contenido de un tercero corriendo dentro de nuestra
// página. El atributo `sandbox` le deja los permisos mínimos que necesita y le
// quita todo lo demás; sin él, el marco corre con los mismos permisos que el sitio.
//
// Lo que le QUITA por omisión, y que el mapa no necesita: enviar formularios como
// si fuéramos nosotros (allow-forms), llevarse la navegación de la pestaña que lo
// contiene a otra dirección (allow-top-navigation) y pedir permisos del navegador.
//
// Los cuatro que sí lleva son los que hacen falta para que funcione:
//   allow-scripts                  dibujar el mapa
//   allow-same-origin              hablar con Google; SIN ESTE EL MARCO QUEDA EN
//                                  BLANCO, es el que se suele quitar de más
//   allow-popups                   abrir "Ver en Google Maps"
//   allow-popups-to-escape-sandbox que esa pestaña nueva sea normal y no herede
//                                  las restricciones del marco
function mapaMarkup() {
  return `
    <div class="map-frame" style="margin-top:18px"><iframe
      src="${CDA.maps}"
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
    ></iframe></div>
  `;
}

// Contenedor del aviso de fallo. Se dibuja vacío y oculto; el texto lo pone
// mostrarAvisoContacto() con textContent. El enlace de WhatsApp es copia fija
// nuestra, así que sí va en la plantilla.
function contactAlertMarkup() {
  return `
    <div class="form-alert" id="contactAlert" role="alert" hidden>
      <span id="contactAlertTexto"></span>
      <br>
      <a href="${WHATSAPP_CONTACTO}" target="_blank" rel="noopener noreferrer">
        También puedes escribirnos por WhatsApp al ${CDA.telefono}
      </a>
    </div>
  `;
}

// El mensaje NUNCA se interpola en el HTML: se asigna con textContent. Parte de
// estos textos vienen del API (los `detalles` de una validación 400), así que son
// dato de origen externo; con textContent el navegador los trata como texto y no
// hay forma de que se ejecuten. Mismo criterio que mostrarAvisoAgendamiento()
// en pages/schedule.js y mostrarAvisoSesionAdmin() en pages/admin-login.js.
function mostrarAvisoContacto(mensaje) {
  const aviso = document.querySelector("#contactAlert");
  const texto = document.querySelector("#contactAlertTexto");
  if (!aviso || !texto) return;
  texto.textContent = mensaje;
  aviso.hidden = !mensaje;
}

// Traduce una respuesta de error del API al texto que ve la persona.
//
// El 400 es el único caso en que vale la pena repetir lo que dijo el servidor: sus
// `detalles` ya vienen en español, por campo y redactados para un cliente ("El
// mensaje debe tener entre 5 y 1000 caracteres."). Para el resto no hay nada útil
// que contar y se usa un texto nuestro.
async function mensajeDeFalloContacto(respuesta) {
  if (respuesta.status === 429) return MENSAJES_FALLO_CONTACTO.demasiados;

  if (respuesta.status === 400) {
    // El cuerpo puede no ser JSON (un proxy de por medio, por ejemplo): si no se
    // puede leer, se cae al texto genérico en vez de romper el manejador.
    let cuerpo = null;
    try {
      cuerpo = await respuesta.json();
    } catch (error) {
      return MENSAJES_FALLO_CONTACTO.datos;
    }

    const detalles = Array.isArray(cuerpo && cuerpo.detalles) ? cuerpo.detalles : [];
    const textos = detalles.map((detalle) => detalle && detalle.mensaje).filter((mensaje) => typeof mensaje === "string");
    if (textos.length > 0) return `No pudimos enviar tu mensaje: ${textos.join(" ")}`;

    return typeof (cuerpo && cuerpo.error) === "string" ? `No pudimos enviar tu mensaje: ${cuerpo.error}` : MENSAJES_FALLO_CONTACTO.datos;
  }

  // 5xx y cualquier otro estado inesperado: el mensaje no salió y punto.
  return MENSAJES_FALLO_CONTACTO.sinEnvio;
}

function bindContact() {
  const form = document.querySelector("#contactForm");
  if (!form) return;

  const boton = form.querySelector("button[type=submit]");

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mostrarAvisoContacto("");

    const datos = Object.fromEntries(new FormData(form));
    // Solo los tres campos que el API acepta, y recortados: así el 400 por
    // "obligatorio" no salta por un espacio suelto.
    const cuerpo = {
      name: String(datos.name || "").trim(),
      email: String(datos.email || "").trim(),
      message: String(datos.message || "").trim(),
      // El campo trampa viaja tal cual, sin recortar: si un guion lo llenó, el
      // servidor descarta el envío. Una persona lo manda siempre vacío.
      [CAMPO_TRAMPA]: valorCampoTrampa(datos),
    };

    // Mientras el envío está en curso el botón se deshabilita: sin esto, tocarlo
    // tres veces manda el mismo mensaje tres veces y el CDA lo recibe repetido.
    const etiquetaBoton = boton ? boton.textContent : "";
    if (boton) {
      boton.disabled = true;
      boton.textContent = "Enviando…";
    }

    const controlador = new AbortController();
    // Mismo corte que cargarCatalogoServicios() y verificarCredencialAdmin(): si el
    // servidor acepta la conexión pero no contesta, a los 6 s se trata como fallo.
    // Quedarse esperando indefinidamente con el botón bloqueado es peor que avisar.
    const corte = setTimeout(() => controlador.abort(), 6000);

    try {
      const respuesta = await fetch(`${API_URL}/mensajes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
        signal: controlador.signal,
      });

      // ÚNICO camino que muestra la confirmación: el servidor respondió que lo
      // recibió (201). Cualquier otra cosa conserva el formulario tal como está,
      // con lo que la persona escribió, y explica qué pasó.
      if (respuesta.ok) {
        form.outerHTML = `<div class="success-box"><h2>¡Mensaje Enviado!</h2><p>Te responderemos lo antes posible.</p><div class="button-row" style="justify-content:center"><a class="button ghost" href="/contacto">Enviar otro mensaje</a></div></div>`;
        return;
      }

      mostrarAvisoContacto(await mensajeDeFalloContacto(respuesta));
    } catch (error) {
      // Acá caen la red caída y el corte por tiempo (AbortError). El mensaje no
      // salió, así que se avisa igual que un 5xx.
      console.error("No se pudo enviar el mensaje de contacto al API.", error);
      mostrarAvisoContacto(MENSAJES_FALLO_CONTACTO.sinEnvio);
    } finally {
      clearTimeout(corte);
      // Si el envío salió bien, el formulario ya fue reemplazado por la
      // confirmación y el botón no está en el documento: no hay nada que reponer.
      if (boton && boton.isConnected) {
        boton.disabled = false;
        boton.textContent = etiquetaBoton;
      }
    }
  });
}
