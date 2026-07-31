// Página de Tarifas

function tarifasPage() {
  // Las filas salen de `vehiculos` para no duplicar los tipos de vehículo.
  // Si un tipo no tiene tarifa confirmada en `tarifas`, se muestra "Consultar".
  const filas = vehiculos
    .map((item) => {
      const tarifa = tarifas[item.label];
      const precio = tarifa ? tarifa.precio : null;
      return `
        <tr>
          <td><strong>${item.label}</strong></td>
          <td>${item.desc}</td>
          <td>${
            precio
              ? `<strong style="color:var(--primary)">Desde ${precio}</strong>`
              : `<span class="status">Consultar</span>`
          }</td>
        </tr>
      `;
    })
    .join("");

  return `
    ${pageHero(
      "Tarifas",
      "Consulta el valor de referencia de tu revisión técnico-mecánica y de gases según el tipo de vehículo.",
      "Precios CDA de Valledupar",
    )}

    <section class="section">
      <div class="container">
        <div class="title-block">
          <p class="eyebrow">Tarifas por tipo de vehículo</p>
          <h2>¿Cuánto cuesta tu <span style="color:var(--primary)">revisión</span>?</h2>
          <div class="title-mark"><span></span><span></span></div>
          <p>Estos son los valores de referencia por tipo de vehículo. Si el tuyo aparece como "Consultar", escríbenos o llámanos y te damos el precio exacto.</p>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tipo de vehículo</th>
                <th>Qué revisamos</th>
                <th>Tarifa</th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
        </div>

        <div class="card" style="margin-top:24px">
          <div class="card-body">
            <p class="eyebrow">Importante</p>
            <h3>Las tarifas son referenciales</h3>
            <p style="margin-top:8px">${tarifasAviso}</p>
            <div class="button-row">
              <a class="button ghost" href="tel:3166962144">Llamar ${CDA.telefono}</a>
              <a class="button ghost" href="#/contacto">Escribirnos</a>
            </div>
          </div>
        </div>

        <div class="cta" style="margin-top:32px">
          <p class="eyebrow">Agenda tu cita</p>
          <h2>Reserva tu revisión en minutos</h2>
          <p>Elige el día y la hora que mejor te sirvan, y confirma el valor de tu revisión con nuestro equipo.</p>
          <div class="button-row" style="justify-content:center">
            <a class="button secondary" href="#/agendar">Agendar Cita</a>
            <a class="button outline" href="#/servicios">Ver qué inspeccionamos</a>
          </div>
        </div>
      </div>
    </section>
  `;
}
