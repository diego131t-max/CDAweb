// Página de la encuesta de satisfacción (/encuesta)
//
// A ella se llega con un código QR en el CDA, NO desde el menú y NO desde Google:
// no está en la navegación, no está en sitemap.xml y sale con `noindex` (ver
// `indexar: false` en METADATOS, app.js). Es a propósito: una encuesta que Google
// ofrece a cualquiera recibe respuestas de gente que nunca vino al CDA.
//
// Es ANÓNIMA: no pide nombre, cédula ni correo. Lo único que viaja son dos notas
// del 1 al 5 y un texto opcional. Lo que se guarda y cómo se lee: migración 006 y
// Backend/src/rutas/encuestas.ts.

// Lo que significan los extremos de la escala. Se muestran en pantalla porque una
// nota sin referencia no se contesta igual dos veces: "¿un 3 es bueno o malo?".
const ESCALA_ENCUESTA = { minimo: "Malo", maximo: "Excelente" };

// Las dos preguntas. `nombre` es el campo que espera el API tal cual.
const PREGUNTAS_ENCUESTA = [
  { nombre: "calificacionServicio", texto: "¿Cómo calificas el servicio?" },
  { nombre: "calificacionInstalaciones", texto: "¿Cómo calificas las instalaciones?" },
];

// Textos de cada forma de fallo. Igual que en contacto, la regla que los cubre a
// todos es la misma: ninguno puede dar a entender que la encuesta llegó.
const MENSAJES_FALLO_ENCUESTA = {
  sinEnvio:
    "No pudimos enviar tu encuesta en este momento. Revisa tu conexión y vuelve a intentarlo: tus respuestas siguen acá.",
  demasiados: "Recibimos varias encuestas desde tu conexión en poco tiempo. Espera unos minutos y vuelve a intentarlo.",
  faltan: "Elige una calificación del 1 al 5 en las dos preguntas.",
  datos: "Revisa las respuestas: alguna no es válida y por eso no pudimos enviar tu encuesta.",
};

// Un grupo de cinco opciones. Son radios de verdad (se manejan con teclado y con
// lector de pantalla) escondidos visualmente detrás de un botón numerado.
function grupoDeNotaMarkup(pregunta) {
  const opciones = [1, 2, 3, 4, 5]
    .map(
      (nota) => `
        <label class="nota-opcion">
          <input type="radio" name="${pregunta.nombre}" value="${nota}" ${nota === 1 ? "required" : ""}>
          <span>${nota}</span>
        </label>`,
    )
    .join("");

  return `
    <fieldset class="nota-grupo full">
      <legend>${pregunta.texto} *</legend>
      <div class="nota-opciones">${opciones}</div>
      <div class="nota-extremos" aria-hidden="true">
        <span>1 = ${ESCALA_ENCUESTA.minimo}</span>
        <span>5 = ${ESCALA_ENCUESTA.maximo}</span>
      </div>
    </fieldset>`;
}

function encuestaPage() {
  return `
    ${pageHero("Tu opinión nos importa", "Cuéntanos cómo te fue en el CDA. Toma menos de un minuto y es anónima.", "Encuesta")}
    <section class="section">
      <div class="container">
        <form class="form-card form-grid encuesta-form" id="encuestaForm" novalidate data-animar>
          ${PREGUNTAS_ENCUESTA.map(grupoDeNotaMarkup).join("")}
          <div class="field full">
            <label for="encuestaSugerencias">Sugerencias o comentarios</label>
            <textarea id="encuestaSugerencias" name="sugerencias" maxlength="1000" placeholder="¿Qué podemos mejorar? (opcional)"></textarea>
          </div>
          ${campoTrampaMarkup()}
          <div class="form-alert" id="encuestaAlert" role="alert" hidden></div>
          <div class="field full"><button class="button secondary" type="submit">Enviar encuesta</button></div>
        </form>
      </div>
    </section>
  `;
}

// El mensaje NUNCA se interpola en el HTML: se asigna con textContent. Parte de
// estos textos vienen del API (los `detalles` de un 400), o sea dato de origen
// externo. Mismo criterio que mostrarAvisoContacto().
function mostrarAvisoEncuesta(mensaje) {
  const aviso = document.querySelector("#encuestaAlert");
  if (!aviso) return;
  aviso.textContent = mensaje;
  aviso.hidden = !mensaje;
}

// Traduce una respuesta de error del API al texto que ve la persona. El 400 es el
// único caso en que vale la pena repetir lo que dijo el servidor.
async function mensajeDeFalloEncuesta(respuesta) {
  if (respuesta.status === 429) return MENSAJES_FALLO_ENCUESTA.demasiados;

  if (respuesta.status === 400) {
    let cuerpo = null;
    try {
      cuerpo = await respuesta.json();
    } catch (error) {
      return MENSAJES_FALLO_ENCUESTA.datos;
    }

    const detalles = Array.isArray(cuerpo && cuerpo.detalles) ? cuerpo.detalles : [];
    const textos = detalles.map((detalle) => detalle && detalle.mensaje).filter((mensaje) => typeof mensaje === "string");
    if (textos.length > 0) return `No pudimos enviar tu encuesta: ${textos.join(" ")}`;

    return typeof (cuerpo && cuerpo.error) === "string"
      ? `No pudimos enviar tu encuesta: ${cuerpo.error}`
      : MENSAJES_FALLO_ENCUESTA.datos;
  }

  // 5xx (incluido el 503 de "no pudimos guardar") y cualquier otro estado: la
  // encuesta no quedó y punto.
  return MENSAJES_FALLO_ENCUESTA.sinEnvio;
}

function bindEncuesta() {
  const form = document.querySelector("#encuestaForm");
  if (!form) return;

  const boton = form.querySelector("button[type=submit]");

  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    mostrarAvisoEncuesta("");

    const datos = Object.fromEntries(new FormData(form));

    // Las dos notas son obligatorias. `novalidate` en el formulario es a propósito:
    // así el aviso sale en el mismo lugar y con el mismo estilo que los demás.
    const cuerpo = {};
    for (const pregunta of PREGUNTAS_ENCUESTA) {
      const nota = Number(datos[pregunta.nombre]);
      if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
        mostrarAvisoEncuesta(MENSAJES_FALLO_ENCUESTA.faltan);
        return;
      }
      cuerpo[pregunta.nombre] = nota;
    }
    cuerpo.sugerencias = String(datos.sugerencias || "").trim();
    // La trampa viaja tal cual, sin recortar: una persona la manda siempre vacía.
    cuerpo[CAMPO_TRAMPA] = valorCampoTrampa(datos);

    // Mientras el envío está en curso el botón se deshabilita: tocarlo tres veces
    // mandaría tres encuestas iguales.
    const etiquetaBoton = boton ? boton.textContent : "";
    if (boton) {
      boton.disabled = true;
      boton.textContent = "Enviando…";
    }

    const controlador = new AbortController();
    // Mismo corte de 6 s que el formulario de contacto.
    const corte = setTimeout(() => controlador.abort(), 6000);

    try {
      const respuesta = await fetch(`${API_URL}/encuestas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
        signal: controlador.signal,
      });

      // ÚNICO camino que muestra el agradecimiento: el servidor respondió 201.
      // Cualquier otra cosa conserva el formulario tal como está y explica qué pasó.
      if (respuesta.ok) {
        form.outerHTML = `<div class="success-box"><h2>¡Gracias por tu opinión!</h2><p>Nos ayuda a mejorar el servicio del CDA.</p><div class="button-row" style="justify-content:center"><a class="button ghost" href="/">Ir al inicio</a></div></div>`;
        return;
      }

      mostrarAvisoEncuesta(await mensajeDeFalloEncuesta(respuesta));
    } catch (error) {
      console.error("No se pudo enviar la encuesta al API.", error);
      mostrarAvisoEncuesta(MENSAJES_FALLO_ENCUESTA.sinEnvio);
    } finally {
      clearTimeout(corte);
      if (boton && boton.isConnected) {
        boton.disabled = false;
        boton.textContent = etiquetaBoton;
      }
    }
  });
}
