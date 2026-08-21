// Página de Agendamiento de Citas

// Datos de una cita vacía.
//
// El servicio arranca SIN valor y no con el id que se va a usar: este objeto se
// construye al cargar el archivo, cuando el catálogo del API todavía no llegó, y
// escribir acá un id "que seguro está" sería exactamente dar por hecho lo que
// hay que comprobar. Lo pone fijarYValidarServicio() al salir del paso 2, después
// de encontrarlo en el catálogo.
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
      <li><strong>Servicio</strong><span>${escaparHtml(nombreDelServicioDeLaCita())}</span></li>
      <li><strong>Fecha</strong><span>${escaparHtml(appointmentData.date)} / ${escaparHtml(appointmentData.time)}</span></li>
      <li><strong>Pago</strong><span>${escaparHtml(appointmentData.payment)}</span></li>
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
        const problema = fijarYValidarServicio();
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
