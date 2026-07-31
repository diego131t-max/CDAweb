// Página de Administración

function adminPage(section = "reservas") {
  const appointments = storage.get("appointments", []);
  const messages = storage.get("messages", []);
  const uniqueVehicles = new Set(appointments.map((item) => item.plate)).size;
  const pending = appointments.filter((item) => item.status === "pendiente").length;
  const completed = appointments.filter((item) => item.status === "completada").length;

  const content = {
    reservas: reservationsTable(appointments),
    vehiculos: vehiclesTable(appointments),
    mensajes: messagesTable(messages),
    reportes: reportsView(appointments, { pending, completed, uniqueVehicles }),
  }[section];

  return `
    <div class="admin-layout">
      <aside class="admin-sidebar">
        <strong>${CDA.nombre}</strong>
        <a class="${section === "reservas" ? "active" : ""}" href="#/admin">Reservas</a>
        <a class="${section === "vehiculos" ? "active" : ""}" href="#/admin/vehiculos">Vehículos</a>
        <a class="${section === "mensajes" ? "active" : ""}" href="#/admin/mensajes">Mensajes</a>
        <a class="${section === "reportes" ? "active" : ""}" href="#/admin/reportes">Reportes</a>
      </aside>
      <section class="admin-content">${content}</section>
    </div>
  `;
}

function reservationsTable(items) {
  return `
    <h2>Reservas</h2>
    <p>Gestiona las citas agendadas</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Cliente</th><th>Servicio</th><th>Vehículo</th><th>Fecha</th><th>Estado</th></tr></thead>
        <tbody>${items
          .map(
            (item) => `<tr><td>${item.id}</td><td>${item.clientName}<br><small>${item.phone}</small></td><td>${item.service}</td><td>${item.vehicle}<br><small>${item.plate}</small></td><td>${item.date} ${item.time}</td><td><span class="status ${item.status === "completada" ? "done" : ""}">${item.status}</span></td></tr>`,
          )
          .join("") || `<tr><td colspan="6">No hay citas registradas</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

function vehiclesTable(items) {
  return `
    <h2>Vehículos</h2>
    <p>Vehículos registrados en el sistema</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Placa</th><th>Tipo</th><th>Cliente</th><th>Último servicio</th></tr></thead>
        <tbody>${items
          .map((item) => `<tr><td>${item.plate}</td><td>${item.vehicle}</td><td>${item.clientName}</td><td>${item.service}</td></tr>`)
          .join("") || `<tr><td colspan="4">No hay vehículos registrados</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

function messagesTable(items) {
  return `
    <h2>Mensajes</h2>
    <p>Mensajes de contacto recibidos</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Fecha</th><th>Nombre</th><th>Email</th><th>Mensaje</th></tr></thead>
        <tbody>${items
          .map((item) => `<tr><td>${item.date}</td><td>${item.name}</td><td>${item.email}</td><td>${item.message}</td></tr>`)
          .join("") || `<tr><td colspan="4">No hay mensajes registrados</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

function reportsView(items, stats) {
  const byService = servicios.map((service) => ({
    name: service.titulo,
    count: items.filter((item) => item.service === service.titulo).length,
  }));
  const max = Math.max(1, ...byService.map((item) => item.count));
  return `
    <h2>Reportes</h2>
    <p>Resumen general del centro</p>
    <div class="stats" style="margin-top:24px">
      <div class="stat-card"><span>Total Citas</span><strong>${items.length}</strong></div>
      <div class="stat-card"><span>Pendientes</span><strong>${stats.pending}</strong></div>
      <div class="stat-card"><span>Completadas</span><strong>${stats.completed}</strong></div>
      <div class="stat-card"><span>Vehículos Únicos</span><strong>${stats.uniqueVehicles}</strong></div>
    </div>
    <div class="chart">
      <h3>Citas por Servicio</h3>
      ${byService
        .map(
          (item) => `<div class="bar"><span>${item.name}</span><div class="bar-track"><div class="bar-fill" style="width:${(item.count / max) * 100}%"></div></div><strong>${item.count}</strong></div>`,
        )
        .join("")}
    </div>
  `;
}
