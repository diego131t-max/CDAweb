// Página de Tarifas — calculadora de la RTMyEC
//
// Acá había una tabla con cuatro filas y precios escritos a mano que estaban entre
// tres y cuatro veces por debajo de lo real. La reemplaza una calculadora sobre la
// tabla oficial (TARIFAS_RTMYEC en data.js), que además contesta la pregunta que la
// gente hace ANTES que la del precio: si ya le toca la revisión.

// Los dos selectores arrancan SIN elegir, y la página no muestra ningún precio
// hasta que la persona elija las dos cosas.
//
// Antes abría con "Motos y similares / 2026" preseleccionados y una cifra ya en
// pantalla. El problema no es estético: esa cifra parece EL precio del CDA, y
// quien no se fija en los selectores se lleva el valor de una moto creyendo que
// es el de su carro. Un precio que nadie pidió es un precio que se lee mal.
const SIN_ELEGIR = "";

/** Los <option> del selector de tipo de vehículo. */
function opcionesDeTipo() {
  const opciones = TARIFAS_RTMYEC.categorias
    .map((c) => `<option value="${escaparHtml(c.id)}">${escaparHtml(c.label)}</option>`)
    .join("");
  return `<option value="${SIN_ELEGIR}" selected>Selecciona tu vehículo</option>${opciones}`;
}

/** Los <option> del selector de año de matrícula. */
function opcionesDeAnio() {
  const opciones = aniosDeMatricula()
    .map((a) => `<option value="${a.valor}">${escaparHtml(a.label)}</option>`)
    .join("");
  return `<option value="${SIN_ELEGIR}" selected>Selecciona el año</option>${opciones}`;
}

/**
 * Lo que se ve cuando las tarifas no llegaron del API.
 *
 * NO se muestra una tabla de respaldo ni un precio aproximado: una cifra vieja
 * con aire de correcta es peor que decir que no se pudo consultar (principio I).
 * Se ofrece reintentar y, sobre todo, el teléfono — que es lo que de verdad
 * resuelve el problema de quien vino a saber cuánto cuesta.
 */
function calculadoraSinTarifas() {
  return `
    <div class="card" data-animar>
      <div class="card-body">
        <h3>No pudimos consultar las tarifas</h3>
        <p style="margin-top:8px">
          El listado de precios no cargó. No te mostramos una cifra aproximada a propósito:
          preferimos no decirte un valor a decirte uno que no sea el tuyo.
        </p>
        <div class="button-row">
          <button class="button secondary" type="button" data-reintentar-tarifas>Reintentar</button>
          <a class="button ghost" href="tel:3166962144">Llamar ${escaparHtml(CDA.telefono)}</a>
        </div>
      </div>
    </div>`;
}

/** Lo que se ve mientras falte elegir algo. Invita, no informa de más. */
function esperandoSeleccion() {
  return `
    <div class="calc-espera">
      <p>Elige el tipo de vehículo y el año de matrícula para ver tu tarifa.</p>
    </div>`;
}

/**
 * El veredicto de periodicidad, que va ARRIBA del precio.
 *
 * El orden importa: a quien todavía no le toca, el precio no le sirve de nada —y
 * mostrárselo primero lo empuja a agendar algo que no necesita—. Se le dice que no
 * le toca y en qué año le va a tocar; el valor queda abajo, como referencia.
 */
function veredictoDeRevision(estado) {
  if (estado.toca) {
    return `
      <div class="calc-veredicto toca">
        <strong>A tu vehículo ya le corresponde la revisión.</strong>
        <p>Este es el valor que vas a pagar.</p>
      </div>`;
  }

  const cuando = estado.faltan === 1 ? "el año que viene" : `en ${estado.faltan} años`;
  return `
    <div class="calc-veredicto espera">
      <strong>Todavía no te toca.</strong>
      <p>
        Tu primera revisión es en <b class="calc-anio">${estado.anio}</b>, o sea ${cuando}. Abajo queda el
        valor por si quieres tenerlo presente.
      </p>
    </div>`;
}

/** El resultado completo: veredicto, total y desglose. */
function resultadoTarifa(categoria, anio) {
  const banda = bandaDeMatricula(anio);

  // Sin categoría o con un año fuera de la tabla NO se inventa un precio: se dice
  // que no está el dato y se ofrece el teléfono, que es lo honesto.
  if (!categoria || !banda) {
    return `
      <div class="calc-vacio">
        <p>
          No tenemos la tarifa para esa combinación. Llámanos al
          <a href="tel:3166962144">${escaparHtml(CDA.telefono)}</a> y te la confirmamos.
        </p>
      </div>`;
  }

  const { lineas, total } = desgloseRtmyec(categoria, banda);
  const estado = estadoDeRevision(categoria, anio);

  const filas = lineas
    .map((l) => `<li><span>${escaparHtml(l.rotulo)}</span><b>${escaparHtml(pesos(l.valor))}</b></li>`)
    .join("");

  return `
    ${veredictoDeRevision(estado)}

    <div class="calc-total-bloque">
      <p class="calc-total-label">Valor de la revisión</p>
      <p class="calc-total">${escaparHtml(pesos(total))}</p>
      <p class="calc-total-pie">
        ${escaparHtml(categoria.label)} · matrícula ${escaparHtml(String(anio))}${anio === 2009 ? " o anterior" : ""}
      </p>
    </div>

    <details class="calc-desglose">
      <summary>De dónde sale este valor</summary>
      <ul class="summary-list">
        ${filas}
        <li class="calc-suma"><span>Total</span><b>${escaparHtml(pesos(total))}</b></li>
      </ul>
      <p class="calc-nota">
        De ese total, <b>${escaparHtml(pesos(categoria.componentes.rtmyec))}</b> corresponden al
        servicio de revisión. El resto son IVA, RUNT, SICOV, recaudo y la tasa de la Agencia
        Nacional de Seguridad Vial, que el CDA recauda y transfiere.
      </p>
    </details>`;
}

function tarifasPage() {
  return `
    ${pageHero(
      "Tarifas",
      "Calcula el valor exacto de tu revisión técnico-mecánica y de gases según tu vehículo y su año de matrícula.",
      "Calculadora de tarifas",
    )}

    <section class="section">
      <div class="container">
        <div class="title-block" data-animar>
          <p class="eyebrow">Calcula tu tarifa</p>
          <h2>¿Cuánto cuesta tu <span style="color:var(--primary)">revisión</span>?</h2>
          <div class="title-mark"><span></span><span></span></div>
          <p>
            Elige el tipo de vehículo y el año en que fue matriculado. Te decimos si ya te
            corresponde la revisión y cuánto vale.
          </p>
        </div>

        ${tarifasCargadas ? "" : calculadoraSinTarifas()}
        <div class="card calculadora ${tarifasCargadas ? "" : "oculto"}" data-animar>
          <div class="card-body">
            <div class="form-grid">
              <div class="field">
                <label for="calcTipo">Tipo de vehículo</label>
                <select id="calcTipo">${opcionesDeTipo()}</select>
                <p class="calc-ayuda" data-calc-ayuda></p>
              </div>
              <div class="field">
                <label for="calcAnio">Año de matrícula</label>
                <select id="calcAnio">${opcionesDeAnio()}</select>
                <p class="calc-ayuda">Está en tu licencia de tránsito (tarjeta de propiedad).</p>
              </div>
            </div>

            <div data-calc-resultado>${esperandoSeleccion()}</div>
          </div>
        </div>

        <div class="card" data-animar style="margin-top:24px">
          <div class="card-body">
            <p class="eyebrow">Por qué el precio es este</p>
            <h3>La tarifa es regulada, no la pone el CDA</h3>
            <p style="margin-top:8px">
              El valor de la revisión técnico-mecánica lo fija el Estado y sube cada enero con
              la UVT. Es <b>el mismo en todos los CDA del país</b>, así que nadie puede cobrarte
              menos ni más. ${TARIFAS_RTMYEC.vigencia ? `Estas cifras corresponden a la vigencia <b>${TARIFAS_RTMYEC.vigencia}</b>.` : ""}
            </p>
            <p style="margin-top:8px">
              ¿No sabes si tu revisión sigue vigente? Consúltalo gratis en el
              <a href="https://portalpublico.runt.gov.co/#/consulta-vehiculo/consulta/consulta-ciudadana"
                 target="_blank" rel="noopener noreferrer">portal del RUNT</a>.
            </p>
            <div class="button-row">
              <a class="button ghost" href="tel:3166962144">Llamar ${escaparHtml(CDA.telefono)}</a>
              <a class="button ghost" href="/contacto">Escribirnos</a>
            </div>
          </div>
        </div>

        <div class="cta" style="margin-top:32px">
          <p class="eyebrow">Agenda tu cita</p>
          <h2>Reserva tu revisión en minutos</h2>
          <p>Elige el día y la hora que mejor te sirvan y evita la fila.</p>
          <div class="button-row" style="justify-content:center">
            <a class="button secondary" href="/agendar">Agendar Cita</a>
            <a class="button outline" href="/faq">Preguntas frecuentes</a>
          </div>
        </div>
      </div>
    </section>
  `;
}

/**
 * Conecta los dos selectores.
 *
 * Se vuelve a dibujar SOLO el bloque del resultado y no la página entera: si
 * repintara todo, los <select> se reconstruirían y perderían el foco, y el
 * desplegable del desglose se cerraría en cada cambio. Igual que en el resto del
 * sitio, los listeners se cuelgan en cada render porque el innerHTML del router
 * destruye los nodos.
 */
function bindTarifas() {
  document.querySelectorAll("[data-reintentar-tarifas]").forEach((boton) => {
    boton.addEventListener("click", async () => {
      boton.disabled = true;
      boton.textContent = "Reintentando…";
      await cargarTarifas();
      // render() vuelve a dibujar la página con la tabla ya cargada, o con el
      // mismo aviso si tampoco esta vez se pudo.
      render();
    });
  });

  const tipo = document.querySelector("#calcTipo");
  const anio = document.querySelector("#calcAnio");
  const salida = document.querySelector("[data-calc-resultado]");
  const ayuda = document.querySelector("[data-calc-ayuda]");
  if (!tipo || !anio || !salida) return;

  const recalcular = () => {
    const categoria = categoriaDeTarifa(tipo.value);

    // La ayuda del tipo aparece apenas se elige uno, aunque falte el año: es
    // justo cuando sirve, porque aclara si una cuatrimoto cuenta como moto.
    if (ayuda) ayuda.textContent = categoria ? categoria.ayuda : "";

    // Con algo sin elegir NO se muestra un precio a medias ni el de otro
    // vehículo: se vuelve al estado de espera.
    if (!categoria || anio.value === SIN_ELEGIR) {
      salida.innerHTML = esperandoSeleccion();
      return;
    }

    salida.innerHTML = resultadoTarifa(categoria, Number(anio.value));
  };

  tipo.addEventListener("change", recalcular);
  anio.addEventListener("change", recalcular);
}
