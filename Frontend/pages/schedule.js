// Página de Agendamiento de Citas

// Datos de una cita vacía. El servicio arranca SIN valor a propósito: es el cliente
// quien elige cuál necesita (FR-002) y la cita se registra con esa elección, no con
// un valor fijo (FR-003).
function citaVacia() {
  return {
    clientName: "",
    phone: "",
    email: "",
    plate: "",
    vehicle: "Vehículos Livianos",
    service: "",
    date: "",
    time: "09:00",
    payment: "PayU",
    // Campo trampa. Va acá, en la forma de la cita vacía, y no solo en el HTML:
    // así se REINICIA junto con el resto al terminar de agendar. Si solo se
    // agregara al enviar el paso 1, su valor sobreviviría a `citaVacia()` y la
    // siguiente cita arrastraría lo que hubiera quedado.
    [CAMPO_TRAMPA]: "",
  };
}

let appointmentStep = 0;
let appointmentData = citaVacia();

// Aviso que bloquea el paso actual del formulario. Vive en una variable porque
// render() reescribe el HTML completo y el mensaje tiene que sobrevivir a eso.
let scheduleAlert = "";

const MENSAJE_CATALOGO_NO_DISPONIBLE =
  "No pudimos cargar la lista de servicios del CDA. Sin ella no podemos registrar tu cita, porque no sabríamos qué servicio necesitas. Vuelve a intentarlo en unos minutos o escríbenos por WhatsApp.";

function stepsMarkup() {
  const labels = ["Datos Personales", "Vehículo y Servicio", "Fecha y Pago", "Confirmación"];
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
      <h3>Vehículo y Servicio</h3>
      <p>Información de tu vehículo y el servicio que necesitas</p>
      <form id="appointmentForm" class="form-grid" style="margin-top:22px">
        <div class="field"><label for="plate">Placa *</label><input id="plate" name="plate" value="${escaparHtml(appointmentData.plate)}" placeholder="ABC123" required></div>
        <div class="field"><label for="vehicle">Tipo de Vehículo</label><select id="vehicle" name="vehicle">${vehicleOptions(appointmentData.vehicle)}</select></div>
        <div class="field full"><label for="service">Servicio *</label>${serviceFieldMarkup()}</div>
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
      <p>Selecciona el momento y tu método de pago preferido</p>
      <form id="appointmentForm" class="form-grid" style="margin-top:22px">
        <div class="field"><label for="date">Fecha *</label><input id="date" name="date" type="date" min="${fechaHoyLocal()}" value="${escaparHtml(appointmentData.date)}" required></div>
        <div class="field"><label for="time">Hora *</label><select id="time" name="time">
          ${["08:00", "09:00", "10:30", "14:00", "16:00"].map((time) => `<option ${appointmentData.time === time ? "selected" : ""}>${time}</option>`).join("")}
        </select></div>
        <div class="field full"><label for="payment">Método de Pago</label><select id="payment" name="payment">
          ${["PayU", "MercadoPago", "Efectivo", "Transferencia Bancaria"].map((pay) => `<option ${appointmentData.payment === pay ? "selected" : ""}>${pay}</option>`).join("")}
        </select></div>
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
      <li><strong>Servicio</strong><span>${escaparHtml(appointmentData.service) || "Sin seleccionar"}</span></li>
      <li><strong>Fecha</strong><span>${escaparHtml(appointmentData.date)} / ${escaparHtml(appointmentData.time)}</span></li>
      <li><strong>Pago</strong><span>${escaparHtml(appointmentData.payment)}</span></li>
    </ul>
    ${scheduleAlertMarkup()}
    <div class="button-row"><button class="button ghost" data-back>Volver</button><button class="button secondary" id="saveAppointment">Agendar Cita</button></div>
  `;
}

// Campo de servicio del paso 2: un <select> real alimentado por el catálogo y
// filtrado por el tipo de vehículo elegido (FR-002 y FR-009).
function serviceFieldMarkup() {
  if (!catalogoServiciosCargado) {
    // Sin catálogo no se ofrece una lista vacía ni un valor inventado: el campo
    // queda deshabilitado —así tampoco viaja en el formulario— y el aviso de
    // arriba explica qué pasó.
    return `<select id="service" name="service" disabled><option>No disponible en este momento</option></select>`;
  }

  // Si el servicio guardado ya no aplica al vehículo actual, no se preselecciona:
  // el cliente tiene que elegir uno válido a propósito.
  const servicioElegido = buscarServicioPorId(appointmentData.service);
  const vigente = servicioAplicaAVehiculo(servicioElegido, appointmentData.vehicle);
  const seleccionado = vigente ? appointmentData.service : "";

  return `
    <select id="service" name="service" required>
      <option value="" disabled ${seleccionado ? "" : "selected"}>Selecciona un servicio</option>
      ${serviceOptions(appointmentData.vehicle, seleccionado)}
    </select>
  `;
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

// Valida el servicio de la cita contra el catálogo. Devuelve el mensaje que explica
// por qué no se puede continuar, o "" si la combinación es válida.
function validarServicioElegido() {
  // Sin catálogo no hay forma de saber si el servicio existe: no se agenda (FR-002).
  if (!catalogoServiciosCargado) return MENSAJE_CATALOGO_NO_DISPONIBLE;

  // FR-004: el servicio tiene que pertenecer al catálogo. Por el <select> solo pasan
  // servicios válidos, así que acá caen los envíos manipulados y los datos viejos.
  const servicio = buscarServicioPorId(appointmentData.service);
  if (!servicio) return "Elige un servicio de la lista para continuar.";

  // FR-010: la combinación de servicio y vehículo también tiene que ser válida,
  // aunque el servicio exista (por ejemplo, blindaje con una moto).
  if (!servicioAplicaAVehiculo(servicio, appointmentData.vehicle)) {
    return `${servicio.nombre} no aplica a ${appointmentData.vehicle}. Elige otro servicio o cambia el tipo de vehículo.`;
  }

  return "";
}

function schedulePage() {
  return `
    <section class="section">
      <div class="form-shell">
        <div class="title-block">
          <h2>Agendar Cita</h2>
          <p>Completa los siguientes pasos para reservar tu diagnóstico</p>
        </div>
        ${stepsMarkup()}
        <div class="form-card">${stepMarkup()}</div>
      </div>

    </section>
  `;
}

function bindSchedule() {
  // Si el catálogo no cargó, ese aviso manda sobre cualquier otro: sin catálogo no
  // se puede elegir servicio y no se debe poder agendar.
  mostrarAvisoAgendamiento(catalogoServiciosCargado ? scheduleAlert : MENSAJE_CATALOGO_NO_DISPONIBLE);

  const form = document.querySelector("#appointmentForm");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      data.forEach((value, key) => (appointmentData[key] = value));

      // Del paso de vehículo y servicio no se sale con una combinación que el
      // catálogo no admita (FR-004 y FR-010).
      if (appointmentStep === 1) {
        const problema = validarServicioElegido();
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

  // Al cambiar el tipo de vehículo se rearma la lista de servicios para ese tipo.
  // Si el servicio ya elegido no aplica al nuevo vehículo, la selección se limpia y
  // se avisa: así el cliente no avanza con una combinación inválida sin enterarse.
  const vehicle = document.querySelector("#vehicle");
  const service = document.querySelector("#service");
  if (vehicle && service && catalogoServiciosCargado) {
    vehicle.addEventListener("change", () => {
      const nuevoVehiculo = vehicle.value;
      const elegido = service.value;
      const sigueAplicando = servicioAplicaAVehiculo(buscarServicioPorId(elegido), nuevoVehiculo);

      appointmentData.vehicle = nuevoVehiculo;
      appointmentData.service = sigueAplicando ? elegido : "";
      service.innerHTML = `
        <option value="" disabled ${sigueAplicando ? "" : "selected"}>Selecciona un servicio</option>
        ${serviceOptions(nuevoVehiculo, sigueAplicando ? elegido : "")}
      `;

      mostrarAvisoAgendamiento(
        elegido && !sigueAplicando
          // El nombre, no el id: "revision-de-gases no aplica a Motos 2T" no es
          // un mensaje para un cliente.
          ? `${(buscarServicioPorId(elegido) || {}).nombre || "El servicio elegido"} no aplica a ${nuevoVehiculo}. Elige otro servicio para continuar.`
          : "",
      );
    });
  }

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
      const problema = validarServicioElegido();
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
        return;
      }

      appointmentStep = 0;
      appointmentData = citaVacia();
      scheduleAlert = "";
      // Se muestra el número de la cita: es lo que el cliente puede mencionar si
      // llama, y la prueba de que el CDA la recibió de verdad.
      app.innerHTML = `<section class="section"><div class="container success-box"><h2>¡Cita Agendada!</h2><p>Tu cita quedó registrada. Nos pondremos en contacto contigo pronto para confirmar.</p><p><small>Número de tu cita: ${escaparHtml(resultado.cita.id)}</small></p><div class="button-row" style="justify-content:center"><a class="button secondary" href="/agendar">Agendar otra cita</a></div></div></section>`;
    });
  }
}

// Acá vivía appointmentSurveyTable(): una tabla con todos los datos de todas las
// citas —nombre, teléfono, correo, placa— que no llamaba nadie. Se eliminó en vez
// de corregirle el escape: arreglar código muerto es dejar una trampa cargada para
// quien lo conecte, y esta además mostraba datos personales fuera del panel, sin
// pasar por la credencial de administración.
