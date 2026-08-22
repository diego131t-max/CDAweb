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
  // Cuántos llegaron desde la última vez que alguien miró esta sección, y desde
  // qué instante contar. Ver contarMensajesNuevos().
  nuevos: 0,
  corteDeNuevos: 0,
};

/*
 * Hasta qué mensaje ya se miró, en milisegundos.
 *
 * NO SE GUARDA NINGÚN MENSAJE, solo una marca de tiempo. Es deliberado: el
 * panel suelta los mensajes de memoria al salir de la sección justamente para
 * que los datos personales no queden dando vueltas, y escribirlos en el disco
 * del navegador desharía esa decisión. Un número no dice quién escribió ni qué.
 *
 * LIMITACIÓN, y conviene tenerla presente: vive en el navegador. Si el CDA mira
 * los mensajes desde el computador del mostrador y después desde un celular, el
 * celular los va a contar todos como nuevos, porque en ese navegador nunca se
 * miraron. Que sea compartido entre dispositivos exige guardar el estado de
 * leído en la base, que es otro trabajo.
 */
const CLAVE_MENSAJES_VISTOS = "cdaMensajesVistos";

/**
 * Cuántos de estos mensajes llegaron después de la última mirada, y deja
 * anotado hasta dónde se miró ahora.
 *
 * SE CUENTA ACÁ, AL CARGAR, Y NO AL DIBUJAR. render() corre varias veces por
 * visita —cada cambio de estado del panel lo llama— así que contar al dibujar
 * haría que la insignia se vaciara sola en el segundo dibujado, antes de que
 * nadie alcanzara a leerla.
 *
 * Se compara con Date.parse y no comparando las cadenas ISO entre sí: son
 * equivalentes mientras el formato no cambie, y esa es justo la clase de
 * suposición que se rompe callada.
 */
function contarMensajesNuevos(mensajes) {
  const visto = Number(storage.get(CLAVE_MENSAJES_VISTOS, 0)) || 0;

  let nuevos = 0;
  let masReciente = visto;
  for (const mensaje of mensajes) {
    const cuando = Date.parse(mensaje.creadoEn);
    if (Number.isNaN(cuando)) continue;
    if (cuando > visto) nuevos += 1;
    if (cuando > masReciente) masReciente = cuando;
  }

  // storage.set no atrapa nada, y en modo privado setItem puede lanzar. Un
  // contador de mensajes nuevos no puede tumbar el panel entero.
  try {
    storage.set(CLAVE_MENSAJES_VISTOS, masReciente);
  } catch (error) {
    console.error("No se pudo anotar hasta dónde se miraron los mensajes.", error);
  }

  return { nuevos, corte: visto };
}

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
  mensajesAdmin.nuevos = 0;
  mensajesAdmin.corteDeNuevos = 0;
}

// Los datos de una sesión no pueden quedar en memoria para que los vea la
// siguiente. Vale para citas igual que para mensajes.
function reiniciarDatosAdmin() {
  reiniciarMensajesAdmin();
  reiniciarCitasAdmin();
  reiniciarReporteAdmin();
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
    const conteo = contarMensajesNuevos(cuerpo);
    mensajesAdmin.nuevos = conteo.nuevos;
    mensajesAdmin.corteDeNuevos = conteo.corte;
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
    reportes: reportsView(),
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

  if (section === "reportes") {
    if (reporteAdmin.estado === "sin-cargar") {
      reporteAdmin.estado = "cargando";
      cargarReporteAdmin().then(() => render());
    }

    document.querySelectorAll("[data-periodo]").forEach((boton) => {
      boton.addEventListener("click", () => {
        const elegido = boton.getAttribute("data-periodo");
        if (elegido === reporteAdmin.periodo) return;
        reporteAdmin.periodo = elegido;
        // El reporte anterior se descarta ANTES de pedir el nuevo: si no, se
        // verían los números de un periodo bajo el rótulo de otro.
        reporteAdmin.datos = null;
        reporteAdmin.estado = "cargando";
        render();
        cargarReporteAdmin().then(() => render());
      });
    });

    document.querySelectorAll("[data-reintentar-reporte]").forEach((boton) => {
      boton.addEventListener("click", () => {
        boton.disabled = true;
        boton.textContent = "Reintentando…";
        reporteAdmin.estado = "cargando";
        render();
        cargarReporteAdmin().then(() => render());
      });
    });
  } else {
    // Fuera de la sección, el reporte se suelta: volver a entrar vuelve a
    // preguntarle al servidor en vez de mostrar números de hace media hora.
    reiniciarReporteAdmin();
  }

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

/*
 * ¿Esta cita ya pasó?
 *
 * Se compara con la hora local del navegador de quien abre el panel, que es el
 * mostrador del CDA y está en Colombia. Es la misma zona en la que se acordó la
 * cita, así que la comparación es la correcta.
 *
 * Se arma la fecha componente por componente y no con `new Date(cadena)`: el
 * constructor interpreta 'YYYY-MM-DD' como UTC y 'YYYY-MM-DDTHH:MM' como local,
 * o sea que las dos formas que parecen equivalentes se llevan cinco horas de
 * diferencia. Acá esas cinco horas son justo la ventana en la que una cita de
 * la tarde se vería como vencida sin serlo.
 */
function citaYaPaso(cita) {
  const [anio, mes, dia] = String(cita.date).split("-").map(Number);
  const [hora, minuto] = String(cita.time).split(":").map(Number);
  if (!anio || !mes || !dia) return false;

  const cuando = new Date(anio, mes - 1, dia, hora || 0, minuto || 0);
  return cuando.getTime() < Date.now();
}

/**
 * Reservas, separadas en próximas y vencidas.
 *
 * POR QUÉ SEPARARLAS. Una sola lista ordenada por fecha mezcla las citas de
 * mañana con las de hace tres semanas, y las dibuja igual. Al mes son veinte
 * "pendientes" viejas tapando las cuatro que de verdad hay que preparar.
 *
 * POR QUÉ EL ESTADO SIGUE ESTANDO. Próxima/vencida sale de la FECHA; pendiente,
 * atendida y cancelada salen de lo que pasó. No son la misma pregunta: una cita
 * vencida y todavía pendiente es un cliente que no vino, y eso es información
 * que el CDA pierde si se reemplaza el estado por la fecha.
 */
function reservationsTable(estado) {
  const aviso = avisoDeCitas(estado, "Reservas", "Gestiona las citas agendadas");
  if (aviso !== null) return aviso;

  const proximas = estado.items.filter((item) => !citaYaPaso(item));
  // Las vencidas van de la más reciente a la más vieja: al revés que las
  // próximas. Lo que interesa de lo que ya pasó es lo de ayer, no lo del mes
  // pasado, y el orden del servidor (fecha ascendente) deja eso al final.
  const vencidas = estado.items.filter(citaYaPaso).reverse();

  return `
    <h2>Reservas</h2>
    <p>Gestiona las citas agendadas</p>

    <h3 class="admin-grupo">Próximas <span class="admin-cuenta">${proximas.length}</span></h3>
    ${tablaDeCitas(proximas, "No hay citas próximas.")}

    <h3 class="admin-grupo">Vencidas <span class="admin-cuenta">${vencidas.length}</span></h3>
    <p class="admin-nota">Su fecha ya pasó. Las que sigan en <strong>pendiente</strong> son clientes que no vinieron.</p>
    ${tablaDeCitas(vencidas, "No hay citas vencidas.")}
  `;
}

/** Una tabla de citas. Las dos de Reservas son la misma con distinto contenido. */
function tablaDeCitas(citas, mensajeVacio) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Cliente</th><th>Servicio</th><th>Vehículo</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>${citas
          .map(
            (item) => `<tr><td>${escaparHtml(item.clientName)}<br><small>${escaparHtml(item.phone)}</small>${item.cedula ? `<br><small>CC ${escaparHtml(item.cedula)}</small>` : ""}</td><td>${escaparHtml(item.serviceName)}</td><td>${escaparHtml(item.vehicle)}<br><small>${escaparHtml(item.plate)}</small></td><td>${escaparHtml(item.date)} ${escaparHtml(item.time)}<br><small>Registrada ${escaparHtml(fechaDeRegistro(item.creadoEn))}</small></td><td><span class="status ${claseDeEstadoCita(item.status)}">${escaparHtml(item.status)}</span></td><td>${accionesDeCita(item)}</td></tr>`,
          )
          .join("") || `<tr><td colspan="6">${escaparHtml(mensajeVacio)}</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

/*
 * Cuándo ENTRÓ la reserva, que es distinto de cuándo es la cita.
 *
 * El dato ya venía en cada cita (`creadoEn`) y el panel no lo mostraba en
 * ningún lado, así que no se podía distinguir una reserva que entró hace un mes
 * de una que entró hace diez minutos — ni saber si el formulario está trayendo
 * gente.
 *
 * Se muestra corto y en hora local: al lado de la fecha de la cita, un ISO
 * completo compite por atención con el dato principal.
 */
function fechaDeRegistro(creadoEn) {
  if (!creadoEn) return "—";
  const cuando = new Date(creadoEn);
  if (Number.isNaN(cuando.getTime())) return "—";
  return cuando.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
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

/**
 * Agrupa las citas por placa: un vehículo, una fila.
 *
 * ANTES ESTA TABLA DIBUJABA UNA FILA POR CITA. Se llamaba "Vehículos
 * registrados en el sistema" y en realidad era la tabla de citas con cuatro de
 * sus columnas: un carro que volvía para su segunda revisión aparecía dos
 * veces, y el conteo de "vehículos" era en realidad el de citas.
 *
 * Agrupar por placa es seguro porque el servidor la normaliza a mayúsculas al
 * validar (ver validarNuevaCita), así que 'abc123' y 'ABC123' no pueden
 * convertirse en dos vehículos distintos.
 *
 * El tipo y el cliente salen de la cita MÁS RECIENTE, no de la primera: un
 * vehículo puede cambiar de dueño, y quien lo trae hoy es el contacto útil.
 */
function agruparPorVehiculo(citas) {
  const porPlaca = new Map();

  for (const cita of citas) {
    const placa = String(cita.plate || "").trim();
    if (!placa) continue;

    const vehiculo = porPlaca.get(placa) || { placa, citas: 0, ultima: null, tipo: "", cliente: "" };
    vehiculo.citas += 1;

    // 'YYYY-MM-DD HH:MM' se compara bien como texto: ancho fijo y de mayor a
    // menor unidad. No hace falta construir fechas para saber cuál es posterior.
    const cuando = `${cita.date} ${cita.time}`;
    if (vehiculo.ultima === null || cuando > vehiculo.ultima) {
      vehiculo.ultima = cuando;
      vehiculo.tipo = cita.vehicle;
      vehiculo.cliente = cita.clientName;
      vehiculo.estadoUltima = cita.status;
    }

    porPlaca.set(placa, vehiculo);
  }

  // De visto más recientemente a más antiguo. Un orden alfabético por placa no
  // le sirve a nadie: nadie busca "el vehículo que empieza con A".
  return [...porPlaca.values()].sort((uno, otro) => String(otro.ultima).localeCompare(String(uno.ultima)));
}

/*
 * Vehículos: uno por placa.
 *
 * SE FUE LA COLUMNA "ÚLTIMO SERVICIO". El CDA presta un solo servicio, así que
 * las cuatro filas decían exactamente lo mismo: una columna que repite el mismo
 * valor no informa, ocupa ancho. En su lugar van dos datos que sí cambian entre
 * un vehículo y otro —cuántas veces vino y cuándo fue la última—, que además
 * son los que contestan si un carro ya pasó por acá.
 */
function vehiclesTable(estado) {
  const aviso = avisoDeCitas(estado, "Vehículos", "Vehículos registrados en el sistema");
  if (aviso !== null) return aviso;

  const vehiculos = agruparPorVehiculo(estado.items);

  return `
    <h2 class="admin-titulo">Vehículos <span class="admin-cuenta">${vehiculos.length}</span></h2>
    <p>Uno por placa. Un vehículo que vuelve suma una cita, no una fila.</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Placa</th><th>Tipo</th><th>Cliente</th><th>Citas</th><th>Última</th></tr></thead>
        <tbody>${vehiculos
          .map(
            (vehiculo) => `<tr><td>${escaparHtml(vehiculo.placa)}</td><td>${escaparHtml(vehiculo.tipo)}</td><td>${escaparHtml(vehiculo.cliente)}</td><td>${vehiculo.citas > 1 ? `<strong>${vehiculo.citas}</strong>` : vehiculo.citas}</td><td>${escaparHtml(String(vehiculo.ultima).slice(0, 10))}<br><small>${escaparHtml(vehiculo.estadoUltima || "")}</small></td></tr>`,
          )
          .join("") || `<tr><td colspan="5">No hay vehículos registrados</td></tr>`}</tbody>
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
  // La insignia solo aparece si hay algo que avisar. Un "0" permanente al lado
  // del título es ruido: se aprende a ignorar, y el día que diga 3 tampoco se
  // va a mirar.
  const insignia =
    estado.estado === "listo" && estado.nuevos > 0
      ? `<span class="admin-cuenta nuevo">${estado.nuevos}</span>`
      : "";

  const encabezado = `
    <h2 class="admin-titulo">Mensajes ${insignia}</h2>
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
          .map((item) => {
            // Se marca CUÁL es nuevo, no solo cuántos. Un número sin saber a qué
            // fila corresponde obliga a leerlos todos para encontrarlo.
            const esNuevo = Date.parse(item.creadoEn) > estado.corteDeNuevos;
            return `<tr${esNuevo ? ' class="fila-nueva"' : ""}><td>${escaparHtml(item.date)}${esNuevo ? '<br><span class="etiqueta-nuevo">nuevo</span>' : ""}</td><td>${escaparHtml(item.name)}</td><td>${escaparHtml(item.email)}</td><td>${escaparHtml(item.message)}</td></tr>`;
          })
          .join("") || `<tr><td colspan="4">Todavía no hay mensajes de contacto</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

/*
 * ── REPORTES ────────────────────────────────────────────────────────────────
 *
 * Antes esta sección calculaba sus números recorriendo la lista de citas que el
 * panel ya tenía cargada. Eso tenía dos problemas.
 *
 * El primero: esa lista viene con tope. Con el CDA lleno son cinco días de
 * agenda, así que un reporte mensual saldría calculado sobre una lista
 * truncada —números que parecen correctos y no lo son, que es la peor clase de
 * número—.
 *
 * El segundo: para contar cuántas citas hubo, el navegador se bajaba el nombre,
 * el teléfono, el correo, la cédula y la placa de cada cliente. Cientos de
 * personas, para calcular cinco totales.
 *
 * Ahora los conteos los hace la base y lo que viaja son números.
 */

/** Los periodos que ofrece el reporte. `rango` devuelve ['YYYY-MM-DD', 'YYYY-MM-DD']. */
const PERIODOS_DE_REPORTE = [
  { id: "hoy", etiqueta: "Hoy", rango: () => [diaISO(0), diaISO(0)] },
  { id: "ayer", etiqueta: "Ayer", rango: () => [diaISO(-1), diaISO(-1)] },
  {
    id: "semana",
    etiqueta: "Esta semana",
    // Lunes a domingo de la semana en curso, no "los últimos 7 días": el CDA
    // razona por semana calendario, y comparar dos semanas parciales no dice
    // nada. Incluye los días que todavía no llegaron, así que el reporte
    // también muestra lo que YA está reservado para el resto de la semana.
    rango: () => {
      const hoy = new Date();
      // getDay() da 0 para domingo; acá la semana arranca el lunes.
      const desplazamiento = (hoy.getDay() + 6) % 7;
      return [diaISO(-desplazamiento), diaISO(6 - desplazamiento)];
    },
  },
  {
    id: "mes",
    etiqueta: "Este mes",
    rango: () => {
      const hoy = new Date();
      const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      return [aISO(primero), aISO(ultimo)];
    },
  },
];

/*
 * Fechas en hora LOCAL, nunca con toISOString().
 *
 * toISOString() convierte a UTC, y en Colombia (UTC-5) eso adelanta el día
 * desde las 7 de la tarde: el reporte de "hoy" pedido a las 8 PM traería el de
 * mañana. Es la misma trampa que ya está documentada en citaYaPaso().
 */
function aISO(fecha) {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function diaISO(desplazamiento) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + desplazamiento);
  return aISO(fecha);
}

// Estado del reporte. Mismos cuatro estados que el resto del panel, por el mismo
// motivo: un reporte en cero porque la consulta falló diría "no vino nadie".
const reporteAdmin = {
  estado: "sin-cargar",
  periodo: "semana",
  datos: null,
};

function reiniciarReporteAdmin() {
  reporteAdmin.estado = "sin-cargar";
  reporteAdmin.datos = null;
}

async function cargarReporteAdmin() {
  const periodo = PERIODOS_DE_REPORTE.find((uno) => uno.id === reporteAdmin.periodo);
  if (!periodo) return;
  const [desde, hasta] = periodo.rango();

  const credencial = credencialAdminGuardada();
  if (!credencial) return;

  const controlador = new AbortController();
  const corte = setTimeout(() => controlador.abort(), 6000);

  try {
    const respuesta = await fetch(
      `${API_URL}/citas/resumen?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
      { headers: { Authorization: `Bearer ${credencial}` }, signal: controlador.signal },
    );

    if (respuesta.status === 401) {
      devolverSesionAdminSinCredencial("La credencial dejó de ser válida.");
      return;
    }
    if (!respuesta.ok) throw new Error(`El API respondió ${respuesta.status}`);

    reporteAdmin.datos = await respuesta.json();
    reporteAdmin.estado = "listo";
  } catch (error) {
    reporteAdmin.datos = null;
    reporteAdmin.estado = "error";
    console.error("No se pudo cargar el reporte del periodo.", error);
  } finally {
    clearTimeout(corte);
  }
}

function reportsView() {
  const encabezado = `
    <h2>Reportes</h2>
    <p>Resumen del centro por periodo</p>
    <div class="reporte-periodos">
      ${PERIODOS_DE_REPORTE.map(
        (periodo) =>
          `<button class="button ghost ${periodo.id === reporteAdmin.periodo ? "activo" : ""}" type="button" data-periodo="${periodo.id}">${escaparHtml(periodo.etiqueta)}</button>`,
      ).join("")}
    </div>
  `;

  if (reporteAdmin.estado === "error") {
    return `
      ${encabezado}
      <p class="form-alert" role="alert">No pudimos calcular el reporte: el servidor no respondió. Esto NO significa que no haya citas en el periodo, sino que no se pudieron contar.</p>
      <div class="button-row"><button class="button ghost" type="button" data-reintentar-reporte>Reintentar</button></div>
    `;
  }

  if (reporteAdmin.estado !== "listo" || !reporteAdmin.datos) {
    return `${encabezado}<p>Calculando el reporte…</p>`;
  }

  const datos = reporteAdmin.datos;
  const estados = datos.porEstado || {};
  const dias = Array.isArray(datos.porDia) ? datos.porDia : [];
  const hoy = diaISO(0);

  /*
   * No vinieron: días YA PASADOS que quedaron en pendiente.
   *
   * Es el número que ningún otro corte muestra. "Pendiente" a secas mezcla al
   * cliente de mañana con el que no apareció la semana pasada, y esos dos son
   * cosas opuestas: uno es trabajo por delante y el otro es un cupo perdido.
   */
  const noVinieron = dias
    .filter((dia) => dia.fecha < hoy)
    .reduce((suma, dia) => suma + (dia.pendientes || 0), 0);

  const diasConCitas = dias.length;
  const promedio = diasConCitas > 0 ? (datos.total / diasConCitas).toFixed(1) : "0";

  return `
    ${encabezado}
    <p class="admin-nota">Del ${escaparHtml(datos.desde)} al ${escaparHtml(datos.hasta)}.</p>

    <div class="stats" style="margin-top:16px">
      <div class="stat-card"><span>Citas</span><strong>${datos.total}</strong></div>
      <div class="stat-card"><span>Atendidas</span><strong>${estados.atendida || 0}</strong></div>
      <div class="stat-card"><span>Por atender</span><strong>${estados.pendiente || 0}</strong></div>
      <div class="stat-card"><span>Canceladas</span><strong>${estados.cancelada || 0}</strong></div>
      <div class="stat-card ${noVinieron > 0 ? "alerta" : ""}"><span>No vinieron</span><strong>${noVinieron}</strong></div>
      <div class="stat-card"><span>Vehículos distintos</span><strong>${datos.vehiculosUnicos || 0}</strong></div>
      <div class="stat-card"><span>Promedio por día</span><strong>${escaparHtml(promedio)}</strong></div>
    </div>

    <div class="chart">
      <h3>Día por día</h3>
      ${barrasPorDia(dias, datos.cuposPorDia || 40)}
    </div>

    <div class="chart">
      <h3>Por tipo de vehículo</h3>
      ${barrasDeConteo(datos.porVehiculo)}
    </div>

    ${
      Object.keys(datos.porServicio || {}).length > 1
        ? `<div class="chart"><h3>Por servicio</h3>${barrasDeConteo(datos.porServicio)}</div>`
        : ""
    }
  `;
}

/*
 * Las barras del día por día se miden contra los CUPOS del día, no contra el
 * día más ocupado del periodo.
 *
 * Es la diferencia entre "el martes fue el mejor día" y "el martes se usaron 32
 * de 40". Lo segundo se puede accionar; lo primero no dice si el CDA está lleno
 * o vacío, porque una barra al 100% podría ser tres carros.
 */
function barrasPorDia(dias, cuposPorDia) {
  if (dias.length === 0) return `<p>No hubo ninguna cita en este periodo.</p>`;

  return dias
    .map((dia) => {
      const ocupacion = Math.min(100, (dia.total / cuposPorDia) * 100);
      return `<div class="bar"><span>${escaparHtml(diaLegible(dia.fecha))}</span><div class="bar-track"><div class="bar-fill" style="width:${ocupacion}%"></div></div><strong>${dia.total}<small>/${cuposPorDia}</small></strong></div>`;
    })
    .join("");
}

/** Barras de un Record<etiqueta, conteo>, medidas contra el mayor. */
function barrasDeConteo(conteos) {
  const entradas = Object.entries(conteos || {});
  if (entradas.length === 0) return `<p>Sin datos en este periodo.</p>`;

  const mayor = Math.max(1, ...entradas.map(([, cuenta]) => cuenta));
  // Las etiquetas salen de la base (tipo de vehículo, nombre del servicio
  // congelado en la cita), así que van escapadas. Los anchos y los conteos son
  // números calculados acá.
  return entradas
    .map(
      ([etiqueta, cuenta]) =>
        `<div class="bar"><span>${escaparHtml(etiqueta)}</span><div class="bar-track"><div class="bar-fill" style="width:${(cuenta / mayor) * 100}%"></div></div><strong>${cuenta}</strong></div>`,
    )
    .join("");
}

/** '2026-08-22' → 'sáb 22 ago'. Un ISO suelto no se lee de un vistazo. */
function diaLegible(fecha) {
  const [anio, mes, dia] = String(fecha).split("-").map(Number);
  if (!anio || !mes || !dia) return String(fecha);
  return new Date(anio, mes - 1, dia).toLocaleDateString("es-CO", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}
