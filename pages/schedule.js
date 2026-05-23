// Página de Agendamiento de Citas

let appointmentStep = 0;
let appointmentData = {
  clientName: "",
  phone: "",
  email: "",
  plate: "",
  vehicle: "Vehículos Livianos",
  service: "Revisión Técnico-Mecánica",
  date: "",
  time: "09:00",
  payment: "PayU",
};

function stepsMarkup() {
  const labels = ["Datos Personales", "Vehículo y Servicio", "Fecha y Pago", "Confirmación"];
  return `<div class="steps">${labels
    .map((label, index) => `<div class="step ${index === appointmentStep ? "active" : index < appointmentStep ? "done" : ""}"><span>${index < appointmentStep ? "✓" : index + 1}</span>${label}</div>`)
    .join("")}</div>`;
}

function stepMarkup() {
  if (appointmentStep === 0) {
    return `
      <h3>Datos Personales</h3>
      <p>Ingresa tu información de contacto</p>
      <form id="appointmentForm" class="form-grid" style="margin-top:22px">
        <div class="field"><label for="clientName">Nombre Completo *</label><input id="clientName" name="clientName" value="${appointmentData.clientName}" placeholder="Juan Pérez" required></div>
        <div class="field"><label for="phone">Teléfono *</label><input id="phone" name="phone" value="${appointmentData.phone}" placeholder="316 6962144" required></div>
        <div class="field full"><label for="email">Email</label><input id="email" name="email" type="email" value="${appointmentData.email}" placeholder="tu@email.com"></div>
        <div class="field full button-row"><button class="button secondary" type="submit">Continuar</button></div>
      </form>
    `;
  }
  if (appointmentStep === 1) {
    return `
      <h3>Vehículo y Servicio</h3>
      <p>Información de tu vehículo y el servicio que necesitas</p>
      <form id="appointmentForm" class="form-grid" style="margin-top:22px">
        <div class="field"><label for="plate">Placa *</label><input id="plate" name="plate" value="${appointmentData.plate}" placeholder="ABC123" required></div>
        <div class="field"><label for="vehicle">Tipo de Vehículo</label><select id="vehicle" name="vehicle">${vehicleOptions(appointmentData.vehicle)}</select></div>
        <input type="hidden" name="service" value="Revisión Técnico-Mecánica">
        <div class="field full button-row"><button class="button ghost" type="button" data-back>Volver</button><button class="button secondary" type="submit">Continuar</button></div>
      </form>
    `;
  }
  if (appointmentStep === 2) {
    return `
      <h3>Fecha y Pago</h3>
      <p>Selecciona el momento y tu método de pago preferido</p>
      <form id="appointmentForm" class="form-grid" style="margin-top:22px">
        <div class="field"><label for="date">Fecha *</label><input id="date" name="date" type="date" value="${appointmentData.date}" required></div>
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
  return `
    <h3>Confirmación</h3>
    <p>Revisa los datos antes de reservar tu cita</p>
    <ul class="summary-list">
      <li><strong>Nombre</strong><span>${appointmentData.clientName}</span></li>
      <li><strong>Teléfono</strong><span>${appointmentData.phone}</span></li>
      <li><strong>Vehículo</strong><span>${appointmentData.vehicle} - ${appointmentData.plate}</span></li>
      <li><strong>Servicio</strong><span>${appointmentData.service}</span></li>
      <li><strong>Fecha</strong><span>${appointmentData.date} / ${appointmentData.time}</span></li>
      <li><strong>Pago</strong><span>${appointmentData.payment}</span></li>
    </ul>
    <div class="button-row"><button class="button ghost" data-back>Volver</button><button class="button secondary" id="saveAppointment">Agendar Cita</button></div>
  `;
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
  const form = document.querySelector("#appointmentForm");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      data.forEach((value, key) => (appointmentData[key] = value));
      appointmentStep += 1;
      render();
    });
  }
  document.querySelectorAll("[data-back]").forEach((button) => {
    button.addEventListener("click", () => {
      appointmentStep = Math.max(0, appointmentStep - 1);
      render();
    });
  });
  const save = document.querySelector("#saveAppointment");
  if (save) {
    save.addEventListener("click", () => {
      const appointments = storage.get("appointments", []);
      appointments.unshift({
        id: `CDA-${Date.now().toString().slice(-6)}`,
        ...appointmentData,
        status: "pendiente",
      });
      storage.set("appointments", appointments);
      appointmentStep = 0;
      appointmentData = {
        clientName: "",
        phone: "",
        email: "",
        plate: "",
        vehicle: "Vehículos Livianos",
        service: "Revisión Técnico-Mecánica",
        date: "",
        time: "09:00",
        payment: "PayU",
      };
      app.innerHTML = `<section class="section"><div class="container success-box"><h2>¡Cita Agendada!</h2><p>Nos pondremos en contacto contigo pronto para confirmar.</p><div class="button-row" style="justify-content:center"><a class="button secondary" href="#/agendar">Agendar otra cita</a></div></div></section>`;
    });
  }
}

function appointmentSurveyTable(items) {
  return `
    <section class="survey-panel">
      <div class="survey-head">
        <div>
          <p class="eyebrow">Encuesta de agendación</p>
          <h3>Tabla de citas registradas</h3>
          <p>Resumen completo de la información capturada en el formulario de agendación.</p>
        </div>
        <a class="button ghost" href="#/admin">Ver panel admin</a>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Cliente</th>
              <th>Contacto</th>
              <th>Vehículo</th>
              <th>Servicio</th>
              <th>Fecha</th>
              <th>Pago</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${
              items
                .map(
                  (item) => `
                    <tr>
                      <td>${item.id}</td>
                      <td>${item.clientName}</td>
                      <td>${item.phone}${item.email ? `<br><small>${item.email}</small>` : ""}</td>
                      <td>${item.vehicle}<br><small>${item.plate}</small></td>
                      <td>${item.service}</td>
                      <td>${item.date} ${item.time}</td>
                      <td>${item.payment}</td>
                      <td><span class="status ${item.status === "completada" ? "done" : ""}">${item.status}</span></td>
                    </tr>
                  `,
                )
                .join("") || `<tr><td colspan="8">Todavía no hay citas registradas.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
}
