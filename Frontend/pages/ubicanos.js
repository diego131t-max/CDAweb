// Página de Ubícanos
//
// Todos los datos salen de CDA (data.js): dirección, referencia, parqueadero,
// horario, teléfono y mapa. Nada se escribe acá a propósito, para que esta página
// y la de contacto nunca digan cosas distintas.

// Latitud y longitud del CDA, tomadas del mismo mapa que ya usa CDA.maps (los
// parámetros !3d y !2d de la URL de embebido). Sirven para armar el enlace de
// "Cómo llegar", que abre la app de mapas del teléfono con la ruta ya puesta.
const COORDENADAS_CDA = { lat: 10.4420096, lng: -73.2419344 };
const URL_COMO_LLEGAR = `https://www.google.com/maps/dir/?api=1&destination=${COORDENADAS_CDA.lat},${COORDENADAS_CDA.lng}`;

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

// Rutas para llegar, según de dónde vienes. Los textos los dio el equipo del CDA.
// `paso` es un punto intermedio opcional que obliga a la ruta a pasar por ahí.
const DESTINO_RUTAS = encodeURIComponent("Cra. 18D #47-17, Valledupar, Cesar");
const RUTAS_CDA = [
  {
    titulo: "Desde La Paz",
    texto: "Toma la vía principal hacia Valledupar y sigue hacia la zona de San Fernando.",
    origen: "La Paz, Cesar",
    boton: "Ver ruta desde La Paz",
  },
  {
    titulo: "Desde la entrada de Bosconia",
    texto: "Ingresa a Valledupar por la vía principal y desplázate hacia el sector de San Fernando.",
    origen: "Bosconia, Cesar",
    boton: "Ver ruta desde Bosconia",
  },
  {
    titulo: "Por la cuarta detrás de San Fernando",
    texto: "Si estás en la ciudad, sube por la Cra. 4 detrás de la zona de San Fernando para llegar directo.",
    origen: "Parque De La Provincia, Valledupar, Cesar",
    // Punto intermedio: sin él Google elige otra vía y la ruta no pasa por la cuarta.
    paso: "Gym Power Zone, Cl 44A #4-44, Valledupar, Cesar",
    boton: "Ver ruta desde el Parque de la Provincia (vía Gym Power Zone)",
  },
];

// Enlace para abrir la ruta en la app de Google Maps (el respaldo del mapa embebido).
function enlaceRuta(ruta) {
  const origen = ruta.origen ? `&origin=${encodeURIComponent(ruta.origen)}` : "";
  const paso = ruta.paso ? `&waypoints=${encodeURIComponent(ruta.paso)}` : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${DESTINO_RUTAS}${origen}${paso}`;
}

// Mapa embebido de la ruta. Con origen se pide la ruta completa; sin origen se
// muestra el pin del CDA (el mismo mapa de arriba). `output=embed` no requiere
// clave de API, pero tampoco es una interfaz documentada por Google: si algún día
// dejara de funcionar, el enlace "Abrir en Google Maps" sigue sirviendo.
function urlMapaRuta(ruta) {
  if (!ruta.origen) return CDA.maps;
  // En este formato el punto intermedio va dentro de daddr: "paso to:destino".
  const destino = ruta.paso ? `${encodeURIComponent(ruta.paso)}+to:${DESTINO_RUTAS}` : DESTINO_RUTAS;
  return `https://www.google.com/maps?saddr=${encodeURIComponent(ruta.origen)}&daddr=${destino}&output=embed`;
}

function rutasMarkup() {
  return RUTAS_CDA.map(
    (ruta, indice) => `
      <div class="info-item ruta-item">
        <div>
          <b>${ruta.titulo}</b>
          <p>${ruta.texto}</p>
          <button class="button ghost" type="button" data-ruta="${indice}" aria-expanded="false" aria-controls="rutaMapa">${ruta.boton}</button>
        </div>
      </div>`,
  ).join("");
}

// Despliega el mapa de la ruta elegida debajo de las tarjetas. Un solo panel para
// las tres: tocar otra ruta cambia el mapa, tocar la que está abierta lo cierra.
// Va por delegación y con createElement porque render() destruye el DOM en cada
// cambio de ruta, y la política de contenido no deja atributos onclick.
function bindUbicanos() {
  const grilla = document.querySelector(".rutas-grid");
  const panel = document.querySelector("#rutaMapa");
  if (!grilla || !panel) return;

  const titulo = panel.querySelector("[data-ruta-titulo]");
  const marco = panel.querySelector(".map-frame");
  const enlace = panel.querySelector("[data-ruta-enlace]");
  let abierta = -1;

  grilla.addEventListener("click", (evento) => {
    const boton = evento.target.closest("button[data-ruta]");
    if (!boton) return;
    const indice = Number(boton.dataset.ruta);
    const ruta = RUTAS_CDA[indice];
    if (!ruta) return;

    grilla.querySelectorAll("button[data-ruta]").forEach((otro) => {
      otro.setAttribute("aria-expanded", "false");
      otro.textContent = RUTAS_CDA[Number(otro.dataset.ruta)].boton;
    });

    if (abierta === indice) {
      abierta = -1;
      panel.hidden = true;
      marco.replaceChildren();
      return;
    }

    abierta = indice;
    boton.setAttribute("aria-expanded", "true");
    boton.textContent = "Ocultar mapa";
    titulo.textContent = ruta.titulo;
    enlace.href = enlaceRuta(ruta);

    const iframe = document.createElement("iframe");
    iframe.title = `Mapa: ${ruta.titulo}`;
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox");
    iframe.src = urlMapaRuta(ruta);
    marco.replaceChildren(iframe);

    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

function ubicanosPage() {
  return `
    ${pageHero("Ubícanos", "Encuentra el CDA de Valledupar y llega sin perderte.", "Cómo llegar")}
    <section class="section">
      <div class="container">
        <div class="contact-grid">
          <div data-animar>
            ${mapaMarkup()}
            <div class="button-row" style="margin-top:18px">
              <a class="button" href="${URL_COMO_LLEGAR}" target="_blank" rel="noopener noreferrer">Cómo llegar</a>
              <a class="button ghost" href="/agendar">Agendar cita</a>
            </div>
          </div>
          <div class="info-list" data-animar>
            <div class="info-item"><span>📍</span><div><b>Dirección</b><p>${CDA.ubicacion}</p><p class="info-nota">${CDA.referencia}.</p></div></div>
            <div class="info-item"><span>🚗</span><div><b>Parqueadero</b><p>${CDA.parqueadero}</p></div></div>
            <div class="info-item"><span>🕒</span><div><b>Horario</b><p>${CDA.horario}</p><p class="info-nota">Los domingos permanecemos cerrados.</p></div></div>
            <div class="info-item"><span>☎</span><div><b>Teléfono</b><p><a href="tel:${CDA.telefono.replace(/\s/g, "")}">${CDA.telefono}</a></p></div></div>
          </div>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div class="title-block" data-animar>
          <h2>¿Cómo llegar a nuestro local?</h2>
          <p>Elige la ruta según de dónde vienes.</p>
        </div>
        <div class="rutas-grid" data-animar>${rutasMarkup()}</div>
        <div id="rutaMapa" class="ruta-mapa" hidden>
          <div class="ruta-mapa-cabecera">
            <b data-ruta-titulo></b>
            <a data-ruta-enlace href="#" target="_blank" rel="noopener noreferrer">Abrir en Google Maps</a>
          </div>
          <div class="map-frame"></div>
        </div>
      </div>
    </section>
  `;
}
