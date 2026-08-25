// Página de Agendamiento de Citas

// Datos de una cita vacía.
//
// El servicio arranca SIN valor y no con el id que se va a usar: este objeto se
// construye al cargar el archivo, cuando el catálogo del API todavía no llegó, y
// escribir acá un id "que seguro está" sería exactamente dar por hecho lo que
// hay que comprobar. Lo pone fijarYValidarServicio() al salir del paso 2, después
// de encontrarlo en el catálogo.
// OJO: `comprobanteElegido` NO se limpia acá. Esta función solo arma el objeto
// de datos; el archivo vive en su propia variable de módulo y se suelta en el
// único lugar donde de verdad termina una cita: cuando el servidor la registró.
// Que sobreviva a irse de /agendar y volver es lo mismo que ya hace el resto de
// lo que escribió el cliente, y por la misma razón: no hacerlo empezar de cero.
function citaVacia() {
  return {
    clientName: "",
    phone: "",
    email: "",
    plate: "",
    vehicle: "Vehículos Livianos",
    service: "",
    date: "",
    // Vacía a propósito (FR-028). Antes empezaba en "09:00", que era una hora
    // que el cliente nunca eligió; con cupos por franja eso es peor que feo,
    // porque ocuparía un lugar real. La hora se elige recién cuando se sabe la
    // fecha y el servidor dice qué franjas tienen cupo.
    time: "",
    // Sale de la lista, no escrito a mano: acá decía "PayU" —una pasarela que el
    // CDA nunca tuvo— y como era el valor POR OMISIÓN, toda cita en la que el
    // cliente no tocara el desplegable se guardó con ese medio de pago.
    payment: mediosDePago[0].titulo,
    // Campo trampa. Va acá, en la forma de la cita vacía, y no solo en el HTML:
    // así se REINICIA junto con el resto al terminar de agendar. Si solo se
    // agregara al enviar el paso 1, su valor sobreviviría a `citaVacia()` y la
    // siguiente cita arrastraría lo que hubiera quedado.
    [CAMPO_TRAMPA]: "",
  };
}

let appointmentStep = 0;

/*
 * Cupos del día elegido — FR-028.
 *
 * `franjasDelDia` es null mientras no se haya consultado o si la consulta
 * falló, y esas dos cosas se dibujan distinto: "elige primero la fecha" no es
 * lo mismo que "no pudimos preguntar". Es el mismo criterio del panel, donde
 * una tabla vacía porque falló la consulta sería una mentira.
 *
 * NO hay una lista de horas de respaldo en el frontend, y es deliberado: la
 * copia local es justo el patrón que ya nos costó dos veces —las cinco horas
 * del <select> que no correspondían a nada, y los medios de pago que ofrecían
 * dos pasarelas inexistentes—. Si el API no contesta no se puede elegir hora,
 * que es correcto: tampoco se podría agendar.
 */
let franjasDelDia = null;
let cargandoFranjas = false;
let appointmentData = citaVacia();

// Aviso que bloquea el paso actual del formulario. Vive en una variable porque
// render() reescribe el HTML completo y el mensaje tiene que sobrevivir a eso.
let scheduleAlert = "";

/*
 * EL COMPROBANTE VIVE ACÁ Y NO EN `appointmentData`, y no es un detalle.
 *
 * `appointmentData` se vuelca al servidor con JSON.stringify. Un File adentro se
 * serializa como `{}`: llegaría un campo vacío y el archivo no saldría nunca del
 * navegador, sin ningún error a la vista. Además el volcado genérico del submit
 * (`data.forEach(...)`) mete TODO lo que haya en el formulario, así que ahí
 * también hay que saltearlo explícitamente.
 *
 * Y hay una segunda razón: el archivo tiene que sobrevivir a los repintados. El
 * router reescribe el DOM entero en cada `render()`, así que un <input type=file>
 * pierde lo que el cliente eligió cada vez que se vuelve del paso 3 al 2. La
 * variable de módulo es lo único que persiste.
 */
let comprobanteElegido = null;
let comprobanteAviso = "";

const MENSAJE_CATALOGO_NO_DISPONIBLE =
  "No pudimos comunicarnos con nuestro sistema para registrar tu cita. Vuelve a intentarlo en unos minutos o escríbenos por WhatsApp.";

// Distinto del anterior a propósito: acá el API SÍ respondió, pero el servicio
// con el que este formulario agenda no está en su catálogo. Es el caso de que el
// propietario lo retire o le cambie el id. No se agenda igual "por si acaso":
// sería registrar una cita de algo que el CDA no presta (FR-004).
const MENSAJE_SERVICIO_NO_DISPONIBLE =
  "En este momento no podemos registrar citas en línea. Escríbenos por WhatsApp y te agendamos nosotros.";

function stepsMarkup() {
  const labels = ["Datos Personales", "Tu Vehículo", "Fecha y Pago", "Confirmación"];
  return `<div class="steps">${labels
    .map((label, index) => `<div class="step ${index === appointmentStep ? "active" : index < appointmentStep ? "done" : ""}"><span>${index < appointmentStep ? "✓" : index + 1}</span>${label}</div>`)
    .join("")}</div>`;
}

// Los pasos del formulario vuelven a dibujar lo que el cliente ya escribió, así
// que cada `value` es dato de origen externo que entra en un atributo.
//
// TODOS los atributos van entre COMILLAS DOBLES y su valor pasa por
// escaparHtml(): sin eso, un nombre con una comilla doble cierra el atributo y lo
// que sigue queda como atributo nuevo del <input> —por ejemplo un manejador de
// eventos—. Es el punto más peligroso de toda la SPA, porque lo escribe cualquiera
// y se vuelve a dibujar en cada paso.
// ¿El medio elegido se paga antes de venir? De esto depende todo el panel.
function pagaEnLinea(medio) {
  const elegido = mediosDePago.find((candidato) => candidato.titulo === medio);
  return Boolean(elegido && elegido.enLinea);
}

/*
 * Panel del QR, los datos de la cuenta y el archivo del comprobante.
 *
 * SE PINTA SIEMPRE Y SE MUESTRA U OCULTA POR CLASE. Nunca se repinta al cambiar
 * el <select>: si el paso se volviera a dibujar, el archivo que el cliente ya
 * eligió desaparecería del <input type=file> —el DOM se rehace entero— y él no
 * tendría forma de saber que dejó de estar. Es el mismo motivo por el que
 * repintarCampoDeHora() toca solo #campoHora y no el formulario completo.
 *
 * El comprobante es OPCIONAL. Si el cliente no lo sube, la cita se registra
 * igual y queda pendiente de comprobante: perder el turno por un problema
 * subiendo una foto sería castigarlo por un fallo que no es suyo.
 */
function panelDePagoEnLinea() {
  const visible = pagaEnLinea(appointmentData.payment);

  // El titular sale vacío mientras el propietario no confirme el nombre legal
  // completo: la certificación del banco lo muestra cortado y completarlo a ojo
  // es inventar un dato del negocio (principio I).
  const titular = datosBancarios.titular
    ? `<li><span>Titular</span><strong>${escaparHtml(datosBancarios.titular)}</strong></li>`
    : "";

  return `
    <div class="field full pago-linea ${visible ? "" : "oculto"}" id="panelPagoLinea" ${visible ? "" : 'aria-hidden="true"'}>
      <div class="pago-linea-caja">
        <div class="pago-linea-qr">
          <img src="${conVersion(datosBancarios.qr)}" alt="Código QR de Bancolombia para pagar al CDA de Valledupar" width="754" height="754" loading="lazy" decoding="async">
          <p>Escanéalo desde la app de tu banco</p>
        </div>
        <div class="pago-linea-datos">
          <p class="pago-linea-titulo">O transfiere a:</p>
          <ul>
            <li><span>Banco</span><strong>${escaparHtml(datosBancarios.banco)}</strong></li>
            <li><span>${escaparHtml(datosBancarios.tipoDeCuenta)}</span><strong>${escaparHtml(datosBancarios.numero)}</strong></li>
            <li><span>NIT</span><strong>${escaparHtml(datosBancarios.nit)}</strong></li>
            ${titular}
          </ul>
          <button class="button ghost" type="button" data-copiar-cuenta="${escaparHtml(datosBancarios.numeroPlano)}">Copiar número de cuenta</button>
        </div>
      </div>
      <label for="comprobante">Comprobante de pago</label>
      <input id="comprobante" name="comprobante" type="file" accept="${escaparHtml(COMPROBANTE.extensiones)}">
      <p class="pago-linea-ayuda">Sube la foto o el PDF del pago. Si prefieres, puedes enviarlo después por WhatsApp: tu cita queda agendada igual.</p>
      <p class="comprobante-elegido" id="comprobanteElegido"${comprobanteElegido ? "" : " hidden"}>Archivo elegido: <strong>${escaparHtml(comprobanteElegido ? comprobanteElegido.name : "")}</strong></p>
      <p class="comprobante-error" id="comprobanteAviso" role="alert"${comprobanteAviso ? "" : " hidden"}>${escaparHtml(comprobanteAviso)}</p>
    </div>
  `;
}

function stepMarkup() {
  if (appointmentStep === 0) {
    return `
      <h3>Datos Personales</h3>
      <p>Ingresa tu información de contacto</p>
      <form id="appointmentForm" class="form-grid" style="margin-top:22px">
        <div class="field"><label for="clientName">Nombre Completo *</label><input id="clientName" name="clientName" value="${escaparHtml(appointmentData.clientName)}" placeholder="Juan Pérez" required></div>
        <div class="field"><label for="phone">Teléfono *</label><input id="phone" name="phone" value="${escaparHtml(appointmentData.phone)}" placeholder="316 6962144" required></div>
        <div class="field full"><label for="email">Email</label><input id="email" name="email" type="email" value="${escaparHtml(appointmentData.email)}" placeholder="tu@email.com"></div>
        ${campoTrampaMarkup()}
        <div class="field full button-row"><button class="button secondary" type="submit">Continuar</button></div>
      </form>
    `;
  }
  if (appointmentStep === 1) {
    return `
      <h3>Tu Vehículo</h3>
      <p>La placa y el tipo de vehículo que vas a traer</p>
      <form id="appointmentForm" class="form-grid" style="margin-top:22px">
        <div class="field"><label for="plate">Placa *</label><input id="plate" name="plate" value="${escaparHtml(appointmentData.plate)}" placeholder="ABC123" required></div>
        <div class="field"><label for="vehicle">Tipo de Vehículo</label><select id="vehicle" name="vehicle">${vehicleOptions(appointmentData.vehicle)}</select></div>
        ${scheduleAlertMarkup()}
        <div class="field full button-row">
          <button class="button ghost" type="button" data-back>Volver</button>
          <button class="button secondary" type="submit">Continuar</button>
          ${catalogoServiciosCargado ? "" : `<button class="button ghost" type="button" data-reintentar-catalogo>Reintentar</button>`}
        </div>
      </form>
    `;
  }
  if (appointmentStep === 2) {
    return `
      <h3>Fecha y Pago</h3>
      <p>Elige el momento y cómo prefieres pagar. Agendar no te cuesta nada.</p>
      <form id="appointmentForm" class="form-grid" style="margin-top:22px">
        <div class="field"><label for="date">Fecha *</label><input id="date" name="date" type="date" min="${fechaHoyLocal()}" value="${escaparHtml(appointmentData.date)}" required></div>
        <div class="field" id="campoHora">${campoDeHora()}</div>
        <div class="field full"><label for="payment">Método de Pago</label><select id="payment" name="payment">
          ${mediosDePago.map((medio) => `<option ${appointmentData.payment === medio.titulo ? "selected" : ""}>${escaparHtml(medio.titulo)}</option>`).join("")}
        </select></div>
        ${panelDePagoEnLinea()}
        <div class="field full button-row"><button class="button ghost" type="button" data-back>Volver</button><button class="button secondary" type="submit">Continuar</button></div>
      </form>
    `;
  }
  // El resumen repite todo lo que escribió el cliente, ahora como texto entre
  // etiquetas. Vehículo y pago salen de un <select>, pero llegan acá por FormData:
  // un envío manipulado puede traer cualquier cosa, así que también se escapan.
  return `
    <h3>Confirmación</h3>
    <p>Revisa los datos antes de reservar tu cita</p>
    <ul class="summary-list">
      <li><strong>Nombre</strong><span>${escaparHtml(appointmentData.clientName)}</span></li>
      <li><strong>Teléfono</strong><span>${escaparHtml(appointmentData.phone)}</span></li>
      <li><strong>Vehículo</strong><span>${escaparHtml(appointmentData.vehicle)} - ${escaparHtml(appointmentData.plate)}</span></li>
      <li><strong>Servicio</strong><span>${escaparHtml(nombreDelServicioDeLaCita())}</span></li>
      <li><strong>Fecha</strong><span>${escaparHtml(appointmentData.date)} / ${escaparHtml(appointmentData.time)}</span></li>
      <li><strong>Pago</strong><span>${escaparHtml(appointmentData.payment)}</span></li>
      ${
        pagaEnLinea(appointmentData.payment)
          ? `<li><strong>Comprobante</strong><span>${
              comprobanteElegido
                ? escaparHtml(comprobanteElegido.name)
                : "Sin adjuntar — puedes enviarlo después"
            }</span></li>`
          : ""
      }
    </ul>
    ${scheduleAlertMarkup()}
    <div class="button-row"><button class="button ghost" data-back>Volver</button><button class="button secondary" id="saveAppointment">Agendar Cita</button></div>
  `;
}

/* ===========================================================================
 * EL FORMULARIO YA NO PREGUNTA EL SERVICIO
 *
 * Acá había un <select> alimentado por el catálogo y filtrado por tipo de
 * vehículo. Se fue el 2026-08-21: el CDA presta UN solo servicio, así que la
 * casilla obligaba a elegir de una lista de uno. Ofrecer una opción única es
 * pedirle al cliente que confirme algo que ya está decidido.
 *
 * Pero el servicio SIGUE VIAJANDO en la cita, y sigue saliendo del catálogo del
 * API. Lo que se quitó es la pregunta, no el dato: la cita se registra con el id
 * que el catálogo declara, el panel lo sigue contando y el resumen del paso 4 lo
 * muestra por nombre.
 * =========================================================================== */

/** El servicio del catálogo con el que se registra la cita, o null si no está. */
function servicioDeLaCita() {
  return buscarServicioPorId(SERVICIO_UNICO_ID);
}

/** El nombre para mostrarle al cliente en el resumen. */
function nombreDelServicioDeLaCita() {
  const servicio = servicioDeLaCita();
  return servicio ? servicio.nombre : "No disponible";
}

// Contenedor del aviso. Se dibuja vacío y lo llena mostrarAvisoAgendamiento() con
// textContent, para no interpolar en el HTML datos que eligió el cliente.
function scheduleAlertMarkup() {
  return `<p class="form-alert" id="scheduleAlert" role="alert" hidden></p>`;
}

function mostrarAvisoAgendamiento(mensaje) {
  scheduleAlert = mensaje;
  const aviso = document.querySelector("#scheduleAlert");
  if (!aviso) return;
  aviso.textContent = mensaje;
  aviso.hidden = !mensaje;
}

// Deja la cita con el servicio del catálogo y devuelve el mensaje que impide
// continuar, o "" si se puede seguir.
//
// Hace las dos cosas y por eso se llama así. Antes solo validaba, porque el
// servicio lo ponía el <select>; ahora que no hay casilla, alguien tiene que
// ponerlo, y tiene que ser el mismo que acaba de comprobar que existe.
function fijarYValidarServicio() {
  // Sin catálogo no hay forma de saber si el servicio existe: no se agenda (FR-002).
  if (!catalogoServiciosCargado) return MENSAJE_CATALOGO_NO_DISPONIBLE;

  // FR-004: el servicio tiene que pertenecer al catálogo. Antes esto atrapaba
  // envíos manipulados; ahora atrapa además el caso de que el propietario retire
  // del catálogo el servicio que este formulario da por hecho. Si eso pasa, el
  // formulario lo dice en vez de registrar una cita de algo que no se presta.
  const servicio = servicioDeLaCita();
  if (!servicio) return MENSAJE_SERVICIO_NO_DISPONIBLE;

  appointmentData.service = servicio.id;

  // FR-010: la combinación de servicio y vehículo también tiene que ser válida.
  // Hoy el catálogo no tiene ninguna exclusión, así que esto nunca dispara. Se
  // conserva porque el día que vuelva a haber un servicio que no aplique a todo,
  // esta es la comprobación que lo impide del lado del cliente —y el servidor la
  // repite igual (FR-010 en rutas/citas.ts)—.
  if (!servicioAplicaAVehiculo(servicio, appointmentData.vehicle)) {
    return `${servicio.nombre} no aplica a ${appointmentData.vehicle}. Escríbenos por WhatsApp y te orientamos.`;
  }

  return "";
}

function schedulePage() {
  return `
    <section class="section">
      <div class="form-shell">
        <div class="title-block" data-animar>
          <h2>Agendar Cita</h2>
          <p>Completa los siguientes pasos para reservar tu diagnóstico</p>
        </div>
        ${stepsMarkup()}
        <div class="form-card" data-animar>${stepMarkup()}</div>
      </div>

    </section>
  `;
}

/*
 * El campo de hora, dibujado a partir de los cupos que devolvió el servidor.
 *
 * Se dibuja aparte del resto del formulario porque se repinta solo cuando
 * cambia la fecha, sin volver a dibujar la página entera: un render() completo
 * ahí le sacaría el foco al cliente en medio de elegir.
 */
function campoDeHora() {
  const etiqueta = `<label for="time">Hora *</label>`;

  if (!appointmentData.date) {
    return `${etiqueta}<select id="time" name="time" disabled><option>Elige primero la fecha</option></select>`;
  }
  if (cargandoFranjas) {
    return `${etiqueta}<select id="time" name="time" disabled><option>Consultando cupos…</option></select>`;
  }
  if (franjasDelDia === null) {
    return `${etiqueta}<select id="time" name="time" disabled><option>No pudimos consultar los cupos</option></select>`;
  }

  // Día completo. Se dice que está lleno, no que no hay horas: son cosas
  // distintas y la segunda haría pensar que el CDA no abre ese día.
  if (!franjasDelDia.some((franja) => franja.disponibles > 0)) {
    return `${etiqueta}<select id="time" name="time" disabled><option>Sin cupo este día — elige otra fecha</option></select>`;
  }

  return `${etiqueta}<select id="time" name="time" required>${opcionesDeFranja(franjasDelDia, appointmentData.time)}</select>`;
}

/** Repinta SOLO el campo de hora. Ver el comentario de campoDeHora(). */
function repintarCampoDeHora() {
  const contenedor = document.querySelector("#campoHora");
  if (contenedor) contenedor.innerHTML = campoDeHora();
}

/**
 * Vuelve a preguntarle al servidor cuántos cupos quedan ese día.
 *
 * Si la hora que el cliente traía elegida se llenó mientras tanto, se mueve
 * sola a la primera que tenga lugar: dejarla apuntando a una franja llena
 * significaría que el botón "Continuar" lo lleva a un rechazo garantizado.
 */
async function refrescarFranjas(fecha) {
  if (!fecha) {
    franjasDelDia = null;
    repintarCampoDeHora();
    return;
  }

  cargandoFranjas = true;
  repintarCampoDeHora();

  const resultado = await consultarDisponibilidad(fecha);
  cargandoFranjas = false;

  if (!resultado.ok) {
    franjasDelDia = null;
    repintarCampoDeHora();
    return;
  }

  franjasDelDia = resultado.franjas;
  const elegida = franjasDelDia.find((franja) => franja.hora === appointmentData.time);
  if (!elegida || elegida.disponibles <= 0) {
    appointmentData.time = primeraFranjaLibre(franjasDelDia) || "";
  }
  repintarCampoDeHora();
}

/**
 * Lo que impide salir del paso de fecha y hora, o "" si se puede seguir.
 *
 * Hace falta porque el <select> deshabilitado NO viaja en el FormData: sin esta
 * comprobación, un día lleno o una consulta caída dejarían pasar al resumen con
 * la hora vacía, y el rechazo aparecería recién al final.
 */
function validarFranjaElegida() {
  if (!appointmentData.date) return "Elige la fecha de tu cita.";
  if (cargandoFranjas) return "Estamos consultando los cupos disponibles. Espera un momento.";
  if (franjasDelDia === null) {
    return "No pudimos consultar los cupos disponibles. Intenta de nuevo en unos minutos.";
  }

  const elegida = franjasDelDia.find((franja) => franja.hora === appointmentData.time);
  if (!elegida) return "Elige una hora para tu cita.";
  if (elegida.disponibles <= 0) {
    return "Esa hora ya no tiene cupo. Elige otra de la lista.";
  }
  return "";
}

function bindSchedule() {
  // Si el catálogo no cargó, ese aviso manda sobre cualquier otro: sin catálogo no
  // se puede elegir servicio y no se debe poder agendar.
  mostrarAvisoAgendamiento(catalogoServiciosCargado ? scheduleAlert : MENSAJE_CATALOGO_NO_DISPONIBLE);

  /*
   * Cupos del paso de fecha y hora (FR-028).
   *
   * Se consulta al ENTRAR al paso, no solo al cambiar la fecha: quien vuelve
   * atrás desde el resumen ya tiene una fecha puesta, y sin esto vería el
   * desplegable vacío. `void` porque bindSchedule no es async y el resultado se
   * dibuja solo cuando llega.
   */
  const campoFecha = document.querySelector("#date");
  if (campoFecha) {
    if (appointmentData.date && franjasDelDia === null && !cargandoFranjas) {
      void refrescarFranjas(appointmentData.date);
    }

    campoFecha.addEventListener("change", () => {
      appointmentData.date = campoFecha.value;
      // Los cupos del día anterior no valen para el nuevo. Se descartan ANTES
      // de preguntar para que no se vea un instante de números de otro día.
      franjasDelDia = null;
      mostrarAvisoAgendamiento("");
      void refrescarFranjas(campoFecha.value);
    });
  }

  /*
   * El panel de pago en línea se muestra u oculta SIN repintar el paso, y lo
   * mismo vale para el nombre del archivo y el aviso: se les cambia el texto a
   * dos nodos que ya están.
   *
   * Volver a dibujar el formulario acá vaciaría el <input type=file>. El cliente
   * elige el archivo, cambia de idea sobre el medio de pago, vuelve, y su
   * comprobante ya no está — sin que nada se lo diga. Es el mismo motivo por el
   * que repintarCampoDeHora() toca solo #campoHora.
   */
  const selectPago = document.querySelector("#payment");
  const panelPago = document.querySelector("#panelPagoLinea");
  if (selectPago && panelPago) {
    selectPago.addEventListener("change", () => {
      appointmentData.payment = selectPago.value;
      const visible = pagaEnLinea(selectPago.value);
      panelPago.classList.toggle("oculto", !visible);
      if (visible) panelPago.removeAttribute("aria-hidden");
      else panelPago.setAttribute("aria-hidden", "true");
    });
  }

  const campoComprobante = document.querySelector("#comprobante");
  if (campoComprobante) {
    campoComprobante.addEventListener("change", () => {
      const archivo = (campoComprobante.files && campoComprobante.files[0]) || null;
      const problema = revisarComprobante(archivo);

      if (problema) {
        // Se descarta y se limpia el campo: dejarlo elegido mostrando un error
        // haría creer que igual se va a subir.
        comprobanteElegido = null;
        comprobanteAviso = problema;
        campoComprobante.value = "";
      } else {
        comprobanteElegido = archivo;
        comprobanteAviso = "";
      }

      const rotulo = document.querySelector("#comprobanteElegido");
      if (rotulo) {
        rotulo.hidden = !comprobanteElegido;
        // textContent y no innerHTML: el nombre del archivo lo escribe quien sube.
        const negrita = rotulo.querySelector("strong");
        if (negrita) negrita.textContent = comprobanteElegido ? comprobanteElegido.name : "";
      }

      const aviso = document.querySelector("#comprobanteAviso");
      if (aviso) {
        aviso.hidden = !comprobanteAviso;
        aviso.textContent = comprobanteAviso;
      }
    });
  }

  document.querySelectorAll("[data-copiar-cuenta]").forEach((boton) => {
    boton.addEventListener("click", async () => {
      const numero = boton.getAttribute("data-copiar-cuenta") || "";
      try {
        await navigator.clipboard.writeText(numero);
        const original = boton.textContent;
        boton.textContent = "¡Copiado!";
        window.setTimeout(() => {
          if (boton.isConnected) boton.textContent = original;
        }, 1800);
      } catch (error) {
        // Sin portapapeles (o sin permiso) el número igual está a la vista
        // arriba: no hay nada que arreglar, solo que no hubo atajo.
        console.warn("No se pudo copiar al portapapeles.", error);
      }
    });
  });

  const form = document.querySelector("#appointmentForm");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      data.forEach((value, key) => {
        // El comprobante NO entra acá. `appointmentData` va al servidor con
        // JSON.stringify, y un File adentro se serializa como `{}`: llegaría un
        // campo vacío y el archivo no saldría nunca del navegador, sin ningún
        // error a la vista. Vive en `comprobanteElegido` y se sube aparte.
        if (value instanceof File) return;
        appointmentData[key] = value;
      });

      // Del paso de vehículo y servicio no se sale con una combinación que el
      // catálogo no admita (FR-004 y FR-010).
      if (appointmentStep === 1) {
        const problema = fijarYValidarServicio();
        if (problema) {
          mostrarAvisoAgendamiento(problema);
          return;
        }
      }

      // Del paso de fecha y hora no se sale sin una franja con cupo (FR-028).
      if (appointmentStep === 2) {
        const problema = validarFranjaElegida();
        if (problema) {
          mostrarAvisoAgendamiento(problema);
          return;
        }
      }

      mostrarAvisoAgendamiento("");
      appointmentStep += 1;
      render();
    });
  }

  /*
   * Acá se ataba un manejador al cambio de tipo de vehículo que rearmaba la lista
   * de servicios y avisaba si el elegido dejaba de aplicar. Se fue con el
   * <select>: no hay lista que rearmar ni elección que invalidar.
   *
   * La regla no quedó sin aplicar. fijarYValidarServicio() la comprueba antes de
   * salir del paso y otra vez antes de enviar, y el servidor la repite. Lo único
   * que se perdió es el aviso inmediato al cambiar el <select> de vehículo, que
   * hoy no tendría nada que avisar porque el catálogo no tiene exclusiones.
   */

  // Reintentar la carga del catálogo sin recargar la página.
  document.querySelectorAll("[data-reintentar-catalogo]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Reintentando…";
      await cargarCatalogoServicios();
      scheduleAlert = "";
      render();
    });
  });

  document.querySelectorAll("[data-back]").forEach((button) => {
    button.addEventListener("click", () => {
      scheduleAlert = "";
      appointmentStep = Math.max(0, appointmentStep - 1);
      render();
    });
  });

  const save = document.querySelector("#saveAppointment");
  if (save) {
    save.addEventListener("click", async () => {
      // Última barrera del lado del cliente: el servicio tiene que existir en el
      // catálogo y aplicar al vehículo (FR-004 y FR-010). Cubre también el caso
      // del catálogo caído: no se agenda una cita sin servicio.
      //
      // El servidor vuelve a comprobar las dos cosas. Esto no es redundancia
      // inútil: acá se le ahorra al cliente un viaje de ida y vuelta, allá se
      // impide que alguien las saltee con una petición hecha a mano.
      const problema = fijarYValidarServicio();
      if (problema) {
        mostrarAvisoAgendamiento(problema);
        return;
      }

      /*
       * ANTES ESTO ESCRIBÍA EN localStorage.
       *
       * O sea que la cita se guardaba en el navegador de quien agendaba y el CDA
       * no se enteraba nunca: la persona veía "¡Cita Agendada!" y se quedaba
       * esperando un turno que el centro jamás recibió. Ahora va al servidor, y la
       * confirmación aparece SOLO si el servidor dice que quedó.
       */
      save.disabled = true;
      const textoOriginal = save.textContent;
      // Tocar el botón tres veces mandaba la cita tres veces.
      save.textContent = "Agendando…";
      mostrarAvisoAgendamiento("");

      const resultado = await registrarCitaEnServidor(appointmentData);

      if (!resultado.ok) {
        // NO se limpia el formulario y NO se muestra confirmación: la cita no
        // quedó, y lo que el cliente escribió tiene que seguir ahí para que pueda
        // reintentar sin volver a llenar cuatro pasos.
        save.disabled = false;
        save.textContent = textoOriginal;
        mostrarAvisoAgendamiento(resultado.mensaje);

        /*
         * FR-028 — La franja se llenó mientras completaba el formulario.
         *
         * Dejarlo en el resumen sería un callejón sin salida: el único botón que
         * hay es "Agendar", y volver a tocarlo daría el mismo rechazo. Se lo
         * devuelve al paso de fecha y hora, con los cupos vueltos a consultar,
         * que es el único lugar donde puede arreglar lo que pasó.
         *
         * Lo que escribió NO se pierde: appointmentData sigue entero y los pasos
         * anteriores se dibujan con sus valores.
         */
        if (resultado.franjaLlena) {
          franjasDelDia = null;
          appointmentStep = 2;
          render();
          await refrescarFranjas(appointmentData.date);
        }
        return;
      }

      /*
       * LA CITA YA ESTÁ GUARDADA. Lo que sigue es el comprobante, y su suerte NO
       * puede cambiar eso: pase lo que pase con la subida, el turno está tomado.
       *
       * Va acá y no antes por el mismo motivo por el que el correo va después del
       * `res.json()` en el servidor: el archivo se sube contra el id de la cita,
       * que recién existe cuando el servidor la registró.
       */
      let subida = null;
      if (comprobanteElegido) {
        save.textContent = "Subiendo comprobante…";
        subida = await subirComprobante(resultado.cita.id, comprobanteElegido);
      }

      const eraEnLinea = pagaEnLinea(appointmentData.payment);

      appointmentStep = 0;
      appointmentData = citaVacia();
      scheduleAlert = "";
      comprobanteElegido = null;
      comprobanteAviso = "";
      // Los cupos consultados eran de la cita que se acaba de agendar: si no se
      // descartan, la siguiente arrancaría mostrando números de antes de ella.
      franjasDelDia = null;

      /*
       * TRES FINALES, porque son tres situaciones distintas y decirle lo mismo a
       * las tres sería mentirle a dos.
       *
       * Los dos últimos mandan el comprobante por WhatsApp con el número de cita:
       * es la vía de recuperación, y no cuesta código porque el botón ya está en
       * todo el sitio.
       */
      let notaDelPago = "";
      if (subida && subida.ok) {
        notaDelPago = "<p>Recibimos tu comprobante. El CDA lo verifica y te confirma.</p>";
      } else if (subida) {
        notaDelPago = `<p class="comprobante-error">${escaparHtml(subida.mensaje)}</p>`;
      } else if (eraEnLinea) {
        notaDelPago =
          `<p>Todavía no nos enviaste el comprobante del pago. Puedes mandarlo por WhatsApp al ` +
          `<strong>${escaparHtml(CDA.telefono)}</strong> con el número de cita de abajo.</p>`;
      }

      // Se muestra el número de la cita: es lo que el cliente puede mencionar si
      // llama, y la prueba de que el CDA la recibió de verdad.
      app.innerHTML = `<section class="section"><div class="container success-box"><h2>¡Cita Agendada!</h2><p>Tu cita quedó registrada. Nos pondremos en contacto contigo pronto para confirmar.</p>${notaDelPago}<p><small>Número de tu cita: ${escaparHtml(resultado.cita.id)}</small></p><div class="button-row" style="justify-content:center"><a class="button secondary" href="/agendar">Agendar otra cita</a></div></div></section>`;
    });
  }
}

// Acá vivía appointmentSurveyTable(): una tabla con todos los datos de todas las
// citas —nombre, teléfono, correo, placa— que no llamaba nadie. Se eliminó en vez
// de corregirle el escape: arreglar código muerto es dejar una trampa cargada para
// quien lo conecte, y esta además mostraba datos personales fuera del panel, sin
// pasar por la credencial de administración.
