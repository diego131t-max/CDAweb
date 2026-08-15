// Página de Administración

// ── Mensajes de contacto: vienen del API, no del navegador ────────────────────
//
// Antes esta sección leía storage.get("messages"), o sea los mensajes que había
// escrito quien estuviera usando ESE navegador. El personal del CDA nunca veía
// los de sus clientes. Ahora se piden a GET /api/mensajes con la credencial de la
// sesión (FR-011).
//
// render() es síncrono y adminPage() devuelve un string, así que la petición no
// puede vivir dentro del dibujado: acá se guarda el estado, adminPage() dibuja el
// estado ACTUAL, y bindAdmin() dispara el fetch y vuelve a llamar a render()
// cuando termina. Es el mismo patrón de [data-reintentar-catalogo] en
// pages/schedule.js y de bindAdminLogin() en pages/admin-login.js.
//
// Cuatro estados, y el tercero es el que importa:
//
//   sin-cargar → cargando → listo   (200: se muestra la tabla)
//                        ↘ error    (API caído, 5xx o 6 s sin respuesta)
//
// `error` NO es `listo` con cero mensajes. Mostrar la tabla vacía cuando la
// petición falló le diría al personal del CDA "nadie te escribió" cuando la
// verdad es "no pudimos preguntar": es la diferencia entre revisar el buzón y
// perder un cliente. Por eso el estado es explícito y ofrece reintentar.
//
// El 401 no es ninguno de los cuatro: significa que la credencial dejó de servir,
// así que la sesión vuelve a `sin-credencial` y el panel entero pide credencial
// de nuevo (principio II: nunca se degrada a mostrar algo).
const mensajesAdmin = {
  estado: "sin-cargar",
  items: [],
};

// ── Citas: mismo problema, misma solución ─────────────────────────────────────
//
// Antes las tres secciones de citas leían storage.get("appointments"), o sea las
// citas que había agendado quien estuviera usando ESE navegador. El personal del
// CDA nunca veía las de sus clientes: veía las suyas, si alguna vez había
// agendado desde ahí, y nada más.
//
// Los cuatro estados son los mismos que los de mensajes, y por el mismo motivo:
// `error` NO es `listo` con cero citas. Una tabla vacía cuando la consulta falló
// le diría al mostrador "hoy no agendó nadie" cuando la verdad es "no pudimos
// preguntar", y con eso se pierde un día de trabajo.
const citasAdmin = {
  estado: "sin-cargar",
  items: [],
};

function reiniciarCitasAdmin() {
  citasAdmin.estado = "sin-cargar";
  citasAdmin.items = [];
}

// Pide las citas al API. Nunca lanza: deja `citasAdmin` en un estado que render()
// sabe dibujar.
async function cargarCitasAdmin() {
  const credencial = credencialAdminGuardada();

  if (!credencial) {
    devolverSesionAdminSinCredencial("falta-credencial");
    return;
  }

  const controlador = new AbortController();
  const corte = setTimeout(() => controlador.abort(), 6000);

  try {
    const respuesta = await fetch(`${API_URL}/citas`, {
      headers: { Authorization: `Bearer ${credencial}` },
      cache: "no-store",
      signal: controlador.signal,
    });

    if (respuesta.status === 401) {
      devolverSesionAdminSinCredencial("credencial-incorrecta");
      return;
    }

    if (!respuesta.ok) throw new Error(`El API respondió ${respuesta.status}`);

    const cuerpo = await respuesta.json();
    // El API devuelve { citas: [...] }. Si llega otra cosa, no la entendemos, y
    // "no entendemos la respuesta" tampoco es "no hay citas".
    if (!cuerpo || !Array.isArray(cuerpo.citas)) throw new Error("El API no devolvió una lista de citas.");

    citasAdmin.items = cuerpo.citas;
    citasAdmin.estado = "listo";
  } catch (error) {
    citasAdmin.items = [];
    citasAdmin.estado = "error";
    console.error("No se pudieron cargar las citas del API.", error);
  } finally {
    clearTimeout(corte);
  }
}

// Cambia el estado de una cita. Devuelve true solo si el servidor lo confirmó:
// el panel nunca pinta un estado optimista (FR-022).
async function cambiarEstadoCita(id, estado) {
  const credencial = credencialAdminGuardada();
  if (!credencial) {
    devolverSesionAdminSinCredencial("falta-credencial");
    return false;
  }

  const controlador = new AbortController();
  const corte = setTimeout(() => controlador.abort(), 6000);

  try {
    const respuesta = await fetch(`${API_URL}/citas/${encodeURIComponent(id)}/estado`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${credencial}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: estado }),
      signal: controlador.signal,
    });

    if (respuesta.status === 401) {
      devolverSesionAdminSinCredencial("credencial-incorrecta");
      return false;
    }

    if (!respuesta.ok) throw new Error(`El API respondió ${respuesta.status}`);

    const cita = await respuesta.json();
    // Se reemplaza con lo que DEVOLVIÓ el servidor, no con lo que se pidió.
    const indice = citasAdmin.items.findIndex((item) => item.id === cita.id);
    if (indice >= 0) citasAdmin.items[indice] = cita;
    return true;
  } catch (error) {
    console.error("No se pudo cambiar el estado de la cita.", error);
    return false;
  } finally {
    clearTimeout(corte);
  }
}

// Borra una cita DEFINITIVAMENTE. Solo el servidor decide si se puede: acá no se
// vuelve a comprobar el estado, se muestra lo que el servidor conteste.
//
// Devuelve { ok: true } o { ok: false, mensaje }. Nunca lanza.
async function borrarCita(id) {
  const credencial = credencialAdminGuardada();
  if (!credencial) {
    devolverSesionAdminSinCredencial("falta-credencial");
    return { ok: false, mensaje: "" };
  }

  const controlador = new AbortController();
  const corte = setTimeout(() => controlador.abort(), 6000);

  try {
    const respuesta = await fetch(`${API_URL}/citas/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${credencial}` },
      signal: controlador.signal,
    });

    if (respuesta.status === 401) {
      devolverSesionAdminSinCredencial("credencial-incorrecta");
      return { ok: false, mensaje: "" };
    }

    if (!respuesta.ok) {
      // El 409 ("cancelala primero") y el 404 ("ya no está") traen un mensaje
      // escrito para que lo lea una persona. Se muestra ese y no uno genérico:
      // son dos situaciones distintas y quien está en el mostrador necesita
      // saber cuál de las dos le tocó.
      let mensaje = "No pudimos borrar la cita. Intenta de nuevo en unos segundos.";
      try {
        const cuerpo = await respuesta.json();
        if (cuerpo && typeof cuerpo.error === "string" && cuerpo.error) mensaje = cuerpo.error;
      } catch (_) {
        // Sin cuerpo legible se queda el mensaje de arriba.
      }
      return { ok: false, mensaje };
    }

    citasAdmin.items = citasAdmin.items.filter((item) => item.id !== id);
    return { ok: true };
  } catch (error) {
    console.error("No se pudo borrar la cita.", error);
    return { ok: false, mensaje: "No pudimos borrar la cita. Intenta de nuevo en unos segundos." };
  } finally {
    clearTimeout(corte);
  }
}

// Se llama al cerrar sesión y ante un 401: los mensajes de una sesión no pueden
// quedar en memoria para que los vea la siguiente.
function reiniciarMensajesAdmin() {
  mensajesAdmin.estado = "sin-cargar";
  mensajesAdmin.items = [];
}

// Los datos de una sesión no pueden quedar en memoria para que los vea la
// siguiente. Vale para citas igual que para mensajes.
function reiniciarDatosAdmin() {
  reiniciarMensajesAdmin();
  reiniciarCitasAdmin();
}

// La credencial dejó de servir. Se descarta, la sesión vuelve al principio y el
// próximo render() muestra la pantalla de credencial en vez del panel.
function devolverSesionAdminSinCredencial(motivo) {
  reiniciarDatosAdmin();
  cerrarSesionAdmin();
  sesionAdmin.motivo = motivo;
}

// Pide los mensajes al API. Nunca lanza: deja `mensajesAdmin` en un estado que
// render() sabe dibujar.
async function cargarMensajesAdmin() {
  const credencial = credencialAdminGuardada();

  // Sin credencial guardada no hay nada que pedir (pasa si otra pestaña cerró la
  // sesión, o si el navegador bloqueó sessionStorage). No se pide sin credencial.
  if (!credencial) {
    devolverSesionAdminSinCredencial("falta-credencial");
    return;
  }

  const controlador = new AbortController();
  // Mismo corte de 6 s que cargarCatalogoServicios() y verificarCredencialAdmin():
  // un servidor que acepta la conexión y no contesta es un fallo, no una espera.
  const corte = setTimeout(() => controlador.abort(), 6000);

  try {
    const respuesta = await fetch(`${API_URL}/mensajes`, {
      headers: { Authorization: `Bearer ${credencial}` },
      // Son datos personales: que no queden en el caché del navegador.
      cache: "no-store",
      signal: controlador.signal,
    });

    if (respuesta.status === 401) {
      devolverSesionAdminSinCredencial("credencial-incorrecta");
      return;
    }

    if (!respuesta.ok) throw new Error(`El API respondió ${respuesta.status}`);

    const cuerpo = await respuesta.json();
    // El API devuelve un arreglo plano. Si llega otra cosa, no la entendemos, y
    // "no entendemos la respuesta" tampoco es "no hay mensajes".
    if (!Array.isArray(cuerpo)) throw new Error("El API no devolvió una lista de mensajes.");

    mensajesAdmin.items = cuerpo;
    mensajesAdmin.estado = "listo";
  } catch (error) {
    mensajesAdmin.items = [];
    mensajesAdmin.estado = "error";
    console.error("No se pudieron cargar los mensajes de contacto del API.", error);
  } finally {
    clearTimeout(corte);
  }
}

function adminPage(section = "reservas") {
  // Las CUATRO secciones dependen ahora del API: tres de las citas y una de los
  // mensajes. Cada una recibe el ESTADO completo de su carga, no una lista, para
  // poder distinguir "no hay nada" de "no pudimos preguntar" — con un arreglo
  // vacío esas dos cosas son indistinguibles y una de ellas es una mentira.
  const content = {
    reservas: reservationsTable(citasAdmin),
    vehiculos: vehiclesTable(citasAdmin),
    mensajes: messagesTable(mensajesAdmin),
    reportes: reportsView(citasAdmin),
  }[section];

  return `
    <div class="admin-layout">
      <aside class="admin-sidebar">
        <strong>${CDA.nombre}</strong>
        <a class="${section === "reservas" ? "active" : ""}" href="/admin">Reservas</a>
        <a class="${section === "vehiculos" ? "active" : ""}" href="/admin/vehiculos">Vehículos</a>
        <a class="${section === "mensajes" ? "active" : ""}" href="/admin/mensajes">Mensajes</a>
        <a class="${section === "reportes" ? "active" : ""}" href="/admin/reportes">Reportes</a>
        <!-- El panel se dibuja sin el encabezado del sitio, así que esta barra es la
             única navegación que hay. Va apagado y separado del bloque de secciones
             para que no se lea como una quinta sección del panel. -->
        <a class="admin-volver" href="/">← Volver al sitio</a>
        <button class="button ghost" type="button" data-cerrar-sesion-admin>Cerrar sesión</button>
      </aside>
      <section class="admin-content">${content}</section>
    </div>
  `;
}

// Listeners del panel. render() reescribe app.innerHTML en cada cambio de ruta y
// se lleva los nodos con sus listeners, así que esto se vuelve a llamar en cada
// dibujado del panel (ver renderizarAdmin en app.js).
function bindAdmin(section = "reservas") {
  // Cerrar sesión: descarta la credencial de la pestaña y vuelve el estado a
  // `sin-credencial`, así que el siguiente render() muestra la pantalla de
  // credencial en vez del panel (FR-004). Los mensajes traídos del API se
  // descartan con ella: no pueden quedar en memoria para la sesión siguiente.
  document.querySelectorAll("[data-cerrar-sesion-admin]").forEach((boton) => {
    boton.addEventListener("click", () => {
      reiniciarDatosAdmin();
      cerrarSesionAdmin();
      render();
    });
  });

  // Los mensajes se piden CADA VEZ que se entra a la sección, no una sola vez por
  // sesión. Es la diferencia entre un buzón y una foto vieja del buzón: quien
  // atiende el mostrador deja la pestaña abierta toda la mañana, y una lista que
  // se cargó a las 8:00 y no se vuelve a consultar esconde todo lo que llegó
  // después. Peor todavía si el API se cayó mientras tanto: seguiría mostrando la
  // lista de antes como si estuviera al día.
  //
  // Lo que hace que "cada vez" funcione sin ciclo infinito es el reinicio al SALIR
  // de la sección: mientras se está en Mensajes el estado ya no es "sin-cargar",
  // así que el render() que dispara la propia respuesta no vuelve a pedir nada.
  // Las tres secciones de citas piden al servidor con el mismo criterio que
  // Mensajes: cada vez que se entra, no una vez por sesión. Quien atiende el
  // mostrador deja la pestaña abierta toda la mañana, y una lista cargada a las
  // 8:00 esconde todo lo que se agendó después.
  if (section === "reservas" || section === "vehiculos" || section === "reportes") {
    if (citasAdmin.estado === "sin-cargar") {
      citasAdmin.estado = "cargando";
      cargarCitasAdmin().then(() => render());
    }
  } else {
    reiniciarCitasAdmin();
  }

  document.querySelectorAll("[data-reintentar-citas]").forEach((boton) => {
    boton.addEventListener("click", async () => {
      boton.disabled = true;
      boton.textContent = "Reintentando…";
      citasAdmin.estado = "cargando";
      render();
      await cargarCitasAdmin();
      render();
    });
  });

  // Marcar atendida / cancelada / pendiente.
  document.querySelectorAll("[data-marcar-cita]").forEach((boton) => {
    boton.addEventListener("click", async () => {
      const id = boton.getAttribute("data-marcar-cita");
      const estado = boton.getAttribute("data-estado");

      boton.disabled = true;
      const textoOriginal = boton.textContent;
      boton.textContent = "Guardando…";

      const listo = await cambiarEstadoCita(id, estado);

      if (!listo) {
        // NO se repinta la fila: el estado que se muestra sigue siendo el REAL,
        // el que devolvió el servidor la última vez (FR-022). Mostrar "atendida"
        // cuando la escritura falló le haría creer al mostrador que ya registró
        // algo que no registró.
        boton.disabled = false;
        boton.textContent = textoOriginal;
        window.alert("No pudimos guardar el cambio. El estado que ves sigue siendo el que está guardado. Intenta de nuevo en unos segundos.");
        return;
      }

      render();
    });
  });

  // Borrar definitivamente. Solo se engancha en las canceladas: accionesDeCita()
  // no dibuja el botón en ninguna otra.
  document.querySelectorAll("[data-borrar-cita]").forEach((boton) => {
    boton.addEventListener("click", async () => {
      const id = boton.getAttribute("data-borrar-cita");
      const placa = boton.getAttribute("data-placa") || "";

      // Es la única operación del panel que no se puede deshacer, así que se
      // pregunta. Va la placa en la pregunta y no solo "¿estás seguro?": lo que
      // hay que confirmar es CUÁL fila, que es donde está el error posible.
      const seguro = window.confirm(
        `Vas a borrar definitivamente la cita de la placa ${placa}.\n\n` +
          "Esto no se puede deshacer y no queda registro de que existió.\n\n" +
          "¿Seguro?",
      );
      if (!seguro) return;

      boton.disabled = true;
      const textoOriginal = boton.textContent;
      boton.textContent = "Borrando…";

      const resultado = await borrarCita(id);

      if (!resultado.ok) {
        // La fila NO se saca de la pantalla: sigue existiendo en el servidor, y
        // hacerla desaparecer acá haría creer que se borró algo que no se borró.
        boton.disabled = false;
        boton.textContent = textoOriginal;
        if (resultado.mensaje) window.alert(resultado.mensaje);
        return;
      }

      render();
    });
  });

  if (section === "mensajes") {
    if (mensajesAdmin.estado === "sin-cargar") {
      mensajesAdmin.estado = "cargando";
      cargarMensajesAdmin().then(() => render());
    }
  } else {
    // Al mirar otra sección los mensajes se sueltan. Dos motivos: volver a entrar
    // vuelve a preguntarle al servidor, y los datos personales no se quedan en
    // memoria mientras nadie los está mirando.
    reiniciarMensajesAdmin();
  }

  // Reintentar sin recargar la página ni volver a escribir la credencial.
  document.querySelectorAll("[data-reintentar-mensajes]").forEach((boton) => {
    boton.addEventListener("click", async () => {
      boton.disabled = true;
      boton.textContent = "Reintentando…";
      mensajesAdmin.estado = "cargando";
      render();
      await cargarMensajesAdmin();
      render();
    });
  });
}

// TODAS las tablas del panel muestran datos que escribió un cliente en el
// formulario de agendamiento o en el de contacto. Cada valor pasa por
// escaparHtml() al mostrarse (nunca al guardarse), así que lo que escribió el
// cliente se ve como texto y no se ejecuta. La clase de `.status` se decide con
// una comparación sobre el valor SIN escapar y produce una cadena fija.
// Encabezado + aviso cuando la carga de citas no llegó a buen puerto.
//
// Se factoriza porque las TRES secciones de citas necesitan exactamente el mismo
// comportamiento, y tres copias del mismo texto se desincronizan solas.
// Devuelve null cuando hay datos que dibujar.
function avisoDeCitas(estado, titulo, subtitulo) {
  const encabezado = `<h2>${titulo}</h2><p>${subtitulo}</p>`;

  if (estado.estado === "error") {
    // No se dibuja la tabla, ni siquiera vacía: una tabla sin filas se lee como
    // "hoy no agendó nadie", y eso sería mentirle al personal del CDA.
    return `
      ${encabezado}
      <p class="form-alert" role="alert">No pudimos cargar las citas: el servidor no respondió. Esto no significa que no haya citas, sino que no se pudieron consultar. Vuelve a intentarlo en unos segundos.</p>
      <div class="button-row"><button class="button ghost" type="button" data-reintentar-citas>Reintentar</button></div>
    `;
  }

  if (estado.estado !== "listo") return `${encabezado}<p>Consultando las citas al servidor…</p>`;

  return null;
}

// Nombre visible del estado de una cita. Los tres valores vienen del servidor.
function claseDeEstadoCita(estado) {
  if (estado === "atendida") return "done";
  if (estado === "cancelada") return "cancelled";
  return "";
}

function reservationsTable(estado) {
  const aviso = avisoDeCitas(estado, "Reservas", "Gestiona las citas agendadas");
  if (aviso !== null) return aviso;

  return `
    <h2>Reservas</h2>
    <p>Gestiona las citas agendadas</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Cliente</th><th>Servicio</th><th>Vehículo</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>${estado.items
          .map(
            (item) => `<tr><td>${escaparHtml(item.clientName)}<br><small>${escaparHtml(item.phone)}</small>${item.cedula ? `<br><small>CC ${escaparHtml(item.cedula)}</small>` : ""}</td><td>${escaparHtml(item.serviceName)}</td><td>${escaparHtml(item.vehicle)}<br><small>${escaparHtml(item.plate)}</small></td><td>${escaparHtml(item.date)} ${escaparHtml(item.time)}</td><td><span class="status ${claseDeEstadoCita(item.status)}">${escaparHtml(item.status)}</span></td><td>${accionesDeCita(item)}</td></tr>`,
          )
          .join("") || `<tr><td colspan="6">No hay citas registradas</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

// Botones de cambio de estado. Solo se ofrece lo que tiene sentido hacer: a una
// cita ya atendida no se le ofrece "marcar atendida".
//
// El id va en un data-atributo y NO interpolado en un onclick: los listeners se
// enganchan en bindAdmin(), que es como funciona todo lo demás del panel.
function accionesDeCita(cita) {
  const botones = [];
  if (cita.status !== "atendida") {
    botones.push(`<button class="button ghost" type="button" data-marcar-cita="${escaparHtml(cita.id)}" data-estado="atendida">Atendida</button>`);
  }
  if (cita.status !== "cancelada") {
    botones.push(`<button class="button ghost" type="button" data-marcar-cita="${escaparHtml(cita.id)}" data-estado="cancelada">Cancelar</button>`);
  }
  if (cita.status !== "pendiente") {
    botones.push(`<button class="button ghost" type="button" data-marcar-cita="${escaparHtml(cita.id)}" data-estado="pendiente">Pendiente</button>`);
  }
  // Borrar SOLO aparece en las citas canceladas, y es lo que hace que borrar sean
  // dos decisiones y no un clic: para que aparezca el botón hay que haber
  // cancelado antes, que es reversible. Es la misma regla que aplica el servidor
  // —acá solo se deja de ofrecer lo que igual iba a rechazar—.
  if (cita.status === "cancelada") {
    botones.push(`<button class="button ghost peligro" type="button" data-borrar-cita="${escaparHtml(cita.id)}" data-placa="${escaparHtml(cita.plate || "")}">Borrar</button>`);
  }
  return botones.join(" ");
}

function vehiclesTable(estado) {
  const aviso = avisoDeCitas(estado, "Vehículos", "Vehículos registrados en el sistema");
  if (aviso !== null) return aviso;

  return `
    <h2>Vehículos</h2>
    <p>Vehículos registrados en el sistema</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Placa</th><th>Tipo</th><th>Cliente</th><th>Último servicio</th></tr></thead>
        <tbody>${estado.items
          .map((item) => `<tr><td>${escaparHtml(item.plate)}</td><td>${escaparHtml(item.vehicle)}</td><td>${escaparHtml(item.clientName)}</td><td>${escaparHtml(item.serviceName)}</td></tr>`)
          .join("") || `<tr><td colspan="4">No hay vehículos registrados</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

// Recibe el estado completo de la carga, no una lista: la sección tiene que poder
// distinguir "no hay mensajes" de "no pudimos traerlos", y con un arreglo vacío
// esas dos cosas son indistinguibles.
//
// Los campos siguen pasando por escaparHtml(), y ahora importa más que antes: los
// escribe cualquiera de internet en el formulario de contacto y los lee el
// personal del CDA. El dato ya no lo pone y lo ve la misma persona.
function messagesTable(estado) {
  const encabezado = `
    <h2>Mensajes</h2>
    <p>Mensajes de contacto recibidos</p>
  `;

  if (estado.estado === "error") {
    // No se dibuja la tabla, ni siquiera vacía: una tabla sin filas se lee como
    // "no te escribió nadie", y eso sería mentirle al personal del CDA.
    return `
      ${encabezado}
      <p class="form-alert" role="alert">No pudimos cargar los mensajes: el servidor no respondió. Esto no significa que no haya mensajes, sino que no se pudieron consultar. Vuelve a intentarlo en unos segundos.</p>
      <div class="button-row"><button class="button ghost" type="button" data-reintentar-mensajes>Reintentar</button></div>
    `;
  }

  if (estado.estado !== "listo") {
    return `${encabezado}<p>Consultando los mensajes al servidor…</p>`;
  }

  return `
    ${encabezado}
    <div class="table-wrap">
      <table>
        <thead><tr><th>Fecha</th><th>Nombre</th><th>Email</th><th>Mensaje</th></tr></thead>
        <tbody>${estado.items
          .map((item) => `<tr><td>${escaparHtml(item.date)}</td><td>${escaparHtml(item.name)}</td><td>${escaparHtml(item.email)}</td><td>${escaparHtml(item.message)}</td></tr>`)
          .join("") || `<tr><td colspan="4">Todavía no hay mensajes de contacto</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

function reportsView(estado) {
  const aviso = avisoDeCitas(estado, "Reportes", "Resumen general del centro");
  if (aviso !== null) return aviso;

  // Los conteos se calculan ACÁ y no en adminPage(): un número calculado sobre
  // una lista vacía porque la consulta falló es peor que no mostrar el número.
  // Al llegar hasta acá ya sabemos que los datos son reales.
  const items = estado.items;
  const pendientes = items.filter((item) => item.status === "pendiente").length;
  const atendidas = items.filter((item) => item.status === "atendida").length;
  const canceladas = items.filter((item) => item.status === "cancelada").length;
  const vehiculosUnicos = new Set(items.map((item) => item.plate)).size;

  return `
    <h2>Reportes</h2>
    <p>Resumen general del centro</p>
    <div class="stats" style="margin-top:24px">
      <div class="stat-card"><span>Total Citas</span><strong>${items.length}</strong></div>
      <div class="stat-card"><span>Pendientes</span><strong>${pendientes}</strong></div>
      <div class="stat-card"><span>Atendidas</span><strong>${atendidas}</strong></div>
      <div class="stat-card"><span>Canceladas</span><strong>${canceladas}</strong></div>
      <div class="stat-card"><span>Vehículos Únicos</span><strong>${vehiculosUnicos}</strong></div>
    </div>
    <div class="chart">
      <h3>Citas por Servicio</h3>
      ${appointmentsByServiceMarkup(items)}
    </div>
  `;
}

// Conteo de citas por servicio, armado sobre el catálogo del API.
//
// Antes esto recorría un `servicios` que nunca existió como dato: el ReferenceError
// que tumbaba las cuatro secciones del panel salía justo de acá. Ahora la lista sale
// del catálogo, que sí existe.
function appointmentsByServiceMarkup(items) {
  if (!catalogoServiciosCargado) {
    // El panel tiene que abrir igual (FR-007): se explica qué falta en vez de
    // mostrar un conteo que no se puede calcular.
    return `<p>No pudimos cargar el catálogo de servicios, así que el conteo por servicio no está disponible. El resto del panel funciona con normalidad.</p>`;
  }

  // Se recorre el catálogo y no las citas: así los servicios sin ninguna cita
  // aparecen en cero en vez de desaparecer del reporte (FR-006).
  // Se compara contra el ID y no contra el nombre: es lo que la cita guarda, y es
  // lo que sigue coincidiendo el día que el CDA renombre un servicio.
  const byService = catalogoServicios.map((servicio) => ({
    name: servicio.nombre,
    count: items.filter((item) => item.service === servicio.id).length,
  }));

  // Las citas cuyo servicio ya no figura en el catálogo se cuentan aparte, sin
  // romper el reporte: el detalle de cada una sigue visible en Reservas (FR-007).
  const fueraDelCatalogo = items.filter((item) => !buscarServicioPorId(item.service)).length;
  if (fueraDelCatalogo > 0) byService.push({ name: "Fuera del catálogo", count: fueraDelCatalogo });

  const max = Math.max(1, ...byService.map((item) => item.count));
  // `item.name` sale del catálogo del API: dato de origen externo, va escapado.
  // El ancho de la barra y el conteo son números calculados acá mismo (una
  // división y un .length), no datos de nadie: no se tocan.
  return byService
    .map(
      (item) => `<div class="bar"><span>${escaparHtml(item.name)}</span><div class="bar-track"><div class="bar-fill" style="width:${(item.count / max) * 100}%"></div></div><strong>${item.count}</strong></div>`,
    )
    .join("");
}
