// ── Escape de HTML ────────────────────────────────────────────────────────────
//
// UNA sola función de escape para todo el sitio. Todo lo que escribe un cliente
// —nombre, teléfono, placa, mensaje— y todo lo que llega del API se interpola en
// plantillas que terminan en innerHTML. Sin esto, un valor como
// `<img src=x onerror=alert(1)>` deja de ser texto y pasa a ser código.
//
// DÓNDE ALCANZA: los dos únicos contextos que usa esta SPA —texto entre etiquetas
// y valor de atributo—, SIEMPRE QUE EL ATRIBUTO VAYA ENTRE COMILLAS DOBLES. Esa es
// la regla que hay que respetar al escribir plantillas:
//
//     value="${escaparHtml(dato)}"     SÍ
//     value=${escaparHtml(dato)}       NO: sin comillas, un espacio alcanza para
//                                      agregar otro atributo
//
// Con comillas dobles, escapar `"` ya impide que el valor cierre el atributo e
// inyecte un manejador de eventos, que es el vector más peligroso del formulario
// de agendamiento.
//
// DÓNDE NO ALCANZA (y hay que resolverlo de otra forma, no escapando):
//   - Dentro de `href` o `src`: un `javascript:alert(1)` escapado sigue siendo
//     `javascript:alert(1)`, porque no contiene ninguno de los cinco caracteres.
//     Ahí lo que corresponde es validar el esquema del enlace.
//   - Dentro de un `<script>`: su contenido no se parsea como HTML, así que las
//     entidades no significan nada y escapar no protege.
//   - En un atributo sin comillas: ver arriba.
// Hoy ningún dato de origen externo llega a esos tres contextos. Queda escrito
// para que nadie lo dé por resuelto el día que llegue.
//
// POR QUÉ UNA SOLA FUNCIÓN Y NO DOS (una para texto y otra para atributos): con
// dos hay que acertar cuál usar en cada punto de interpolación, y equivocarse no
// produce ningún error —acá no hay compilador ni pruebas que avisen—: falla en
// silencio y el hueco aparece meses después. Una sola se aplica sin pensar.
//
// SE ESCAPA AL MOSTRAR, NUNCA AL GUARDAR. Guardar el valor ya escapado dejaría
// `&amp;` dentro del dato para siempre; escapar al mostrar, además, cubre gratis
// las citas y los mensajes que ya estaban guardados de antes. Por lo mismo, un
// valor se escapa UNA vez: escaparlo dos veces muestra `&amp;` en pantalla.
function escaparHtml(valor) {
  // null y undefined se muestran como cadena vacía; los números, como su texto.
  // Un campo que todavía no se llenó no debe imprimir "undefined" en pantalla.
  if (valor === null || valor === undefined) return "";

  return String(valor)
    // El `&` va PRIMERO y no es un detalle de estilo: si fuera después, volvería
    // a escapar los `&` de las entidades recién generadas (`&lt;` → `&amp;lt;`).
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Sistema de almacenamiento local
const storage = {
  get(key, fallback) {
    // Un valor corrupto guardado en el navegador NO puede tumbar la página.
    // Antes, un JSON inválido bajo "appointments" hacía que JSON.parse lanzara
    // acá y el panel entero quedaba en blanco: la misma caída total que ya se
    // arregló una vez con el conteo por servicio. Si no se puede leer, se
    // devuelve el valor por defecto y el sitio sigue funcionando.
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.error(`No se pudo leer "${key}" del navegador; se usa el valor por defecto.`, error);
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

// Marca de que las citas de ejemplo ya se descartaron en este navegador (FR-011).
const CLAVE_CITAS_SEMILLA_DESCARTADAS = "seedCitasDescartadas";

// Marca equivalente para los mensajes de contacto (FR-013). Mismo patrón que la
// de arriba, por el mismo motivo: hay que limpiar UNA vez lo que ya quedó
// guardado en el navegador de quien visitó el sitio antes de este cambio.
const CLAVE_MENSAJES_LOCALES_DESCARTADOS = "seedMensajesDescartados";

// Inicializa datos por defecto
function ensureSeed() {
  // FR-011: las citas sembradas como ejemplo se descartan y el catálogo entra en
  // vigencia sin arrastrarlas. Ya no se siembran, pero las que quedaron guardadas
  // en el navegador de quien ya visitó el sitio hay que borrarlas una única vez:
  // si no, seguirían apareciendo en el panel con servicios y tipos de vehículo
  // que no existen en el catálogo. Las citas que se agenden de acá en adelante
  // se conservan, porque la marca queda puesta.
  if (!localStorage.getItem(CLAVE_CITAS_SEMILLA_DESCARTADAS)) {
    localStorage.removeItem("appointments");
    localStorage.setItem(CLAVE_CITAS_SEMILLA_DESCARTADAS, "1");
  }

  // FR-013: acá se sembraba un mensaje de ejemplo con nombre y correo inventados.
  // Eran datos personales ficticios que se escribían en el navegador de CADA
  // visitante nuevo, y en el panel se veían iguales a un mensaje real: nadie podía
  // distinguir el ejemplo del cliente que sí escribió.
  //
  // Además, los mensajes ya no viven acá: se envían al API y se leen desde el
  // servidor con credencial (ver bindContact en pages/contact.js y messagesTable
  // en pages/admin.js). La clave "messages" de localStorage quedó sin uso, así que
  // se borra una sola vez —con la misma marca que las citas— para no dejar datos
  // personales abandonados en el navegador de quien ya pasó por el sitio.
  if (!localStorage.getItem(CLAVE_MENSAJES_LOCALES_DESCARTADOS)) {
    localStorage.removeItem("messages");
    localStorage.setItem(CLAVE_MENSAJES_LOCALES_DESCARTADOS, "1");
  }
}

// Fecha de hoy en formato AAAA-MM-DD, calculada en HORARIO LOCAL.
//
// `toISOString().slice(0, 10)` NO sirve para esto: devuelve la fecha en UTC y
// Colombia está en UTC-5, así que a partir de las 19:00 hora local ya reporta el
// día siguiente. Usado como `min` de un <input type="date">, eso deja fuera el
// día de hoy justo en el horario en que alguien agenda desde el celular después
// del trabajo. Se arma con getFullYear/getMonth/getDate, que sí son locales.
function fechaHoyLocal() {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

// ── Catálogo de servicios ─────────────────────────────────────────────────────
//
// El catálogo vive en el API (GET /api/servicios) y es la única fuente de verdad
// sobre lo que el CDA ofrece (FR-001). Se carga UNA sola vez al arrancar, antes
// del primer render (ver app.js), y desde acá lo leen el agendamiento, el panel
// de administración y el asistente del sitio.
//
// A propósito NO hay una copia de respaldo del catálogo en el frontend: dos listas
// del mismo dato es justo la contradicción que esta funcionalidad viene a eliminar.
// Si el API no responde, el sitio lo dice y no deja agendar sin servicio, pero no
// se inventa una lista.

let catalogoServicios = [];
let catalogoServiciosCargado = false;

// Pide el catálogo al API. Nunca lanza: deja el catálogo vacío y devuelve false
// para que quien lo use decida qué mostrar.
async function cargarCatalogoServicios() {
  const controlador = new AbortController();
  // Corte de seguridad: si el API acepta la conexión pero no contesta, el sitio no
  // puede quedarse esperando para siempre antes de dibujar la primera pantalla.
  const corte = setTimeout(() => controlador.abort(), 6000);

  try {
    const respuesta = await fetch(`${API_URL}/servicios`, { signal: controlador.signal });
    if (!respuesta.ok) throw new Error(`El API respondió ${respuesta.status}`);

    const cuerpo = await respuesta.json();
    const recibidos = Array.isArray(cuerpo && cuerpo.servicios) ? cuerpo.servicios : [];
    catalogoServicios = recibidos
      .filter((servicio) => servicio && typeof servicio.nombre === "string")
      .map((servicio) => ({
        id: servicio.id,
        nombre: servicio.nombre,
        // Vacío = el servicio aplica a todos los tipos de vehículo.
        vehiculosExcluidos: Array.isArray(servicio.vehiculosExcluidos) ? servicio.vehiculosExcluidos : [],
      }));
    // Un catálogo vacío se trata como no disponible: el agendamiento no debe
    // ofrecer una lista vacía sin explicación.
    catalogoServiciosCargado = catalogoServicios.length > 0;
  } catch (error) {
    catalogoServicios = [];
    catalogoServiciosCargado = false;
    console.error("No se pudo cargar el catálogo de servicios del API.", error);
  } finally {
    clearTimeout(corte);
  }

  return catalogoServiciosCargado;
}

// ¿Este servicio se le puede ofrecer a este tipo de vehículo? (FR-009)
function servicioAplicaAVehiculo(servicio, vehiculo) {
  return Boolean(servicio) && !servicio.vehiculosExcluidos.includes(vehiculo);
}

// Busca un servicio del catálogo por su nombre visible. Devuelve null si no está,
// que es lo que permite rechazar un servicio fuera del catálogo (FR-004).
//
// Queda para el chatbot y para leer citas viejas. Lo que se AGENDA viaja por id:
// ver buscarServicioPorId.
function buscarServicio(nombre) {
  return catalogoServicios.find((servicio) => servicio.nombre === nombre) || null;
}

// Busca un servicio por su id estable ('revision-de-gases').
//
// Es la forma correcta de referirse a un servicio, y por eso es la que viaja en
// el formulario y en el API. El nombre cambia el día que el CDA decida
// presentarlo distinto; el id no. Si se agendara por nombre, ese cambio dejaría
// huérfanas todas las citas anteriores y el conteo del panel se partiría en dos.
function buscarServicioPorId(id) {
  return catalogoServicios.find((servicio) => servicio.id === id) || null;
}

// Servicios del catálogo aplicables a un tipo de vehículo.
function serviciosParaVehiculo(vehiculo) {
  return catalogoServicios.filter((servicio) => servicioAplicaAVehiculo(servicio, vehiculo));
}

// Genera opciones de servicios para selects, filtradas por el tipo de vehículo:
// a una moto nunca se le ofrece certificado de blindaje (FR-009).
// `selected` es el ID del servicio elegido, no su nombre.
function serviceOptions(vehicle = "", selected = "") {
  return serviciosParaVehiculo(vehicle)
    .map((servicio) => {
      // EL VALOR DEL <option> ES EL ID, no el nombre. Lo que viaja al servidor es
      // la referencia estable; el nombre es solo lo que ve el cliente. Antes iba
      // el nombre, y eso ataba cada cita registrada al texto exacto que se
      // mostraba ese día.
      //
      // Los dos vienen del API, o sea son datos de origen externo, así que van
      // escapados en los dos lugares donde aparecen: el `value` del atributo y el
      // texto de la opción. El escape del atributo no cambia lo que viaja en el
      // formulario —el navegador decodifica las entidades al leerlo— así que
      // `select.value` sigue devolviendo el id original.
      const id = escaparHtml(servicio.id);
      const nombre = escaparHtml(servicio.nombre);
      return `<option value="${id}" ${selected === servicio.id ? "selected" : ""}>${nombre}</option>`;
    })
    .join("");
}

// Registra una cita en el servidor.
//
// Devuelve { ok: true, cita } o { ok: false, mensaje } — nunca lanza. Quien la
// llama decide qué dibujar, pero NO puede confundir "no se pudo" con "listo":
// esa es toda la razón por la que devuelve un resultado en vez de un booleano.
//
// Es el mismo criterio que ya usa el formulario de contacto: la confirmación se
// muestra únicamente con un 201 del servidor.
async function registrarCitaEnServidor(cita) {
  const controlador = new AbortController();
  // Mismo corte de 6 s que el catálogo y la credencial: un servidor que acepta la
  // conexión y no contesta es un fallo, no una espera. Quedarse esperando para
  // siempre no es "todavía no sabemos": es un formulario colgado.
  const corte = setTimeout(() => controlador.abort(), 6000);

  try {
    const respuesta = await fetch(`${API_URL}/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cita),
      signal: controlador.signal,
    });

    if (respuesta.status === 201) {
      return { ok: true, cita: await respuesta.json() };
    }

    if (respuesta.status === 400) {
      // El servidor valida de nuevo lo que el navegador ya validó, y con razón:
      // acá caen los formularios viejos abiertos en una pestaña desde antes de
      // que cambiara el catálogo. Se muestra el detalle del primer campo, que es
      // accionable, en vez de un "datos inválidos" que no dice qué corregir.
      const cuerpo = await respuesta.json().catch(() => null);
      const detalle = cuerpo && Array.isArray(cuerpo.detalles) ? cuerpo.detalles[0] : null;
      return {
        ok: false,
        mensaje: detalle ? detalle.mensaje : "Revisa los datos de la cita e intenta de nuevo.",
      };
    }

    if (respuesta.status === 429) {
      return {
        ok: false,
        mensaje: "Recibimos demasiadas solicitudes desde tu conexión. Espera unos minutos e intenta de nuevo.",
      };
    }

    throw new Error(`El API respondió ${respuesta.status}`);
  } catch (error) {
    console.error("No se pudo registrar la cita en el servidor.", error);
    return {
      ok: false,
      mensaje:
        `No pudimos registrar tu cita en este momento y NO quedó agendada. ` +
        `Vuelve a intentarlo en unos minutos o escríbenos por WhatsApp al ${CDA.telefono}.`,
    };
  } finally {
    clearTimeout(corte);
  }
}

// Arma la respuesta "¿Qué servicios ofrecen?" del asistente desde el catálogo,
// para que el sitio no se contradiga entre el chatbot y el agendamiento (FR-001).
function textoServiciosChatbot() {
  if (!catalogoServiciosCargado) {
    return `En este momento no puedo consultar el listado de servicios. 🔧 Llámanos al <strong>${CDA.telefono}</strong> y con gusto te contamos todo.`;
  }

  // Los nombres vienen del API y esta frase termina en insertAdjacentHTML (ver
  // bindChatbot en chatbot.js), así que se escapan acá, en el origen. No se puede
  // escapar la frase entera del lado del chatbot: las respuestas del asistente
  // llevan <strong> a propósito y escaparlas mostraría las etiquetas en pantalla.
  const nombres = catalogoServicios.map((servicio) => escaparHtml(servicio.nombre));
  const listado =
    nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}` : nombres[0];
  return `Ofrecemos ${listado}. 🔧 ¡Todo en un solo lugar!`;
}

// ── Sesión de administración ──────────────────────────────────────────────────
//
// El panel muestra nombre, teléfono, correo y placa de clientes reales, así que
// no abre sin una credencial VERIFICADA CONTRA EL SERVIDOR (FR-001). Acá vive el
// estado de esa verificación; la pantalla de credencial está en
// pages/admin-login.js y la puerta en render() (app.js).
//
// Tres estados, y ninguno más:
//
//   sin-credencial ──(la persona la envía)──► verificando ──(200)──► verificada
//         ▲                                        │                     │
//         └────(401 / 429 / 503 / red caída / 6 s sin respuesta)─────────┘
//                              y también al cerrar sesión
//
// REGLAS QUE NO ADMITEN EXCEPCIÓN (principio II de la constitución, FR-002):
//
// 1. Solo `verificada` muestra datos. `sin-credencial` y `verificando` no
//    muestran ni uno: nunca se degrada a acceso abierto ni a datos parciales.
// 2. TODA salida del camino feliz termina en `sin-credencial`. Las cinco:
//    credencial incorrecta, demasiados intentos, servidor sin credencial
//    configurada, red caída y demora excesiva.
// 3. Recargar la página NUNCA lleva directo a `verificada`: aunque la credencial
//    siga guardada en la pestaña, cada carga se revalida contra el servidor. El
//    navegador nunca decide solo que alguien está autenticado.
//
// La credencial va en sessionStorage y no en localStorage a propósito (FR-003):
// muere al cerrar la pestaña, no la comparten otras pestañas y no queda en el
// equipo después de usar el panel en una máquina compartida, que es el caso real
// del mostrador de un CDA. Tampoco viaja NUNCA en la dirección del navegador.
const CLAVE_CREDENCIAL_ADMIN = "adminToken";

// ---------------------------------------------------------------------------
// CAMPO TRAMPA de los formularios públicos
//
// Un campo que ninguna persona ve ni llena, y que un guion que completa todo lo
// que encuentra sí. Si llega con contenido, el servidor descarta el envío.
//
// OJO, EL NOMBRE ESTÁ DUPLICADO en el backend (Backend/src/validacion/trampa.ts).
// No hay forma de compartirlo: este archivo no tiene módulos ni build. Si se
// cambia acá hay que cambiarlo allá, y subir el ?v= de index.html. Cambiarlo en
// un solo lado no rompe nada visible: la trampa simplemente deja de atrapar, que
// es la peor forma de romper algo.
//
// Sirve contra guiones que leen el HTML y llenan todo. NO sirve contra quien lea
// el contrato del API y haga POST directo — ese ni ve el formulario.
// ---------------------------------------------------------------------------
const CAMPO_TRAMPA = "sitio_web";

// El HTML del campo. Se arma acá y no en cada página para que los tres
// formularios usen exactamente el mismo, incluidos los atributos que lo hacen
// invisible de verdad.
//
// Cada atributo está por algo:
//   class      lo saca de la pantalla (ver .campo-trampa en styles.css). No se
//              usa type="hidden" porque muchos guiones saltean esos campos.
//   tabindex   que no se pueda caer en él tabulando.
//   aria-hidden que un lector de pantalla no lo anuncie. SIN ESTO la trampa se
//              convierte en una barrera de accesibilidad: una persona ciega lo
//              llenaría y su cita sería rechazada.
//   autocomplete que el navegador no lo rellene solo.
function campoTrampaMarkup() {
  return `<div class="campo-trampa" aria-hidden="true"><label for="${CAMPO_TRAMPA}">No llenes este campo</label><input id="${CAMPO_TRAMPA}" name="${CAMPO_TRAMPA}" type="text" value="" tabindex="-1" autocomplete="off"></div>`;
}

// Saca el valor de la trampa de un FormData ya convertido a objeto. Devuelve
// siempre una cadena: el backend solo se molesta si tiene contenido.
function valorCampoTrampa(datos) {
  return String((datos && datos[CAMPO_TRAMPA]) || "");
}

const sesionAdmin = {
  estado: "sin-credencial",
  // Motivo del último fallo, para que la pantalla de credencial pueda explicarlo.
  // Es un código interno; los textos visibles viven en pages/admin-login.js.
  motivo: "",
  // ¿Ya se intentó verificar en ESTA carga de página? Sin esta marca, una
  // credencial guardada que el servidor rechaza por red caída volvería a
  // dispararse en cada render y quedaría reintentando para siempre.
  intentoHecho: false,
};

// sessionStorage puede lanzar (modo privado, almacenamiento deshabilitado). Que
// no se pueda guardar la credencial significa quedarse afuera del panel, nunca
// que el panel abra igual.
function credencialAdminGuardada() {
  try {
    return sessionStorage.getItem(CLAVE_CREDENCIAL_ADMIN) || "";
  } catch (error) {
    console.error("No se pudo leer la credencial de administración de esta pestaña.", error);
    return "";
  }
}

function guardarCredencialAdmin(credencial) {
  try {
    sessionStorage.setItem(CLAVE_CREDENCIAL_ADMIN, credencial);
  } catch (error) {
    console.error("No se pudo guardar la credencial de administración en esta pestaña.", error);
  }
}

function olvidarCredencialAdmin() {
  try {
    sessionStorage.removeItem(CLAVE_CREDENCIAL_ADMIN);
  } catch (error) {
    console.error("No se pudo descartar la credencial de administración de esta pestaña.", error);
  }
}

// Cerrar sesión (FR-004): se descarta la credencial y se vuelve al principio.
function cerrarSesionAdmin() {
  olvidarCredencialAdmin();
  sesionAdmin.estado = "sin-credencial";
  sesionAdmin.motivo = "";
  // Ya no hay credencial guardada, así que no se revalida sola: la marca queda
  // puesta para que la puerta pida la credencial en vez de reintentar.
  sesionAdmin.intentoHecho = true;
}

// ¿Hay que revalidar contra el servidor al entrar al panel? Solo si hay una
// credencial guardada en la pestaña y todavía no se intentó en esta carga.
// Es lo que hace que recargar la página vuelva a preguntarle al servidor.
function debeRevalidarSesionAdmin() {
  return sesionAdmin.estado === "sin-credencial" && !sesionAdmin.intentoHecho && Boolean(credencialAdminGuardada());
}

// Deja el estado en "verificando" para que render() —que es síncrono— pueda
// dibujar la espera ANTES de que la verificación salga a la red.
function marcarSesionAdminVerificando() {
  sesionAdmin.estado = "verificando";
  sesionAdmin.motivo = "";
}

// Pregunta al API si la credencial sirve (GET /api/admin/sesion). Nunca lanza:
// deja el estado listo para que render() decida qué mostrar y devuelve true solo
// si el servidor respondió 200.
//
// Mismo patrón que cargarCatalogoServicios(): AbortController con corte a 6 s y
// clearTimeout en el finally.
async function verificarCredencialAdmin(credencial) {
  const token = typeof credencial === "string" && credencial ? credencial : credencialAdminGuardada();

  // Sin credencial no hay nada que verificar y no se pide nada al API.
  if (!token) {
    sesionAdmin.estado = "sin-credencial";
    sesionAdmin.motivo = "falta-credencial";
    sesionAdmin.intentoHecho = true;
    return false;
  }

  marcarSesionAdminVerificando();

  const controlador = new AbortController();
  // Corte de seguridad: si el API acepta la conexión pero no contesta, la demora
  // se trata como fallo. Quedarse esperando para siempre no es "todavía no
  // sabemos": es un panel que no abre y no explica por qué.
  const corte = setTimeout(() => controlador.abort(), 6000);

  try {
    const respuesta = await fetch(`${API_URL}/admin/sesion`, {
      headers: { Authorization: `Bearer ${token}` },
      // Que nadie guarde en caché el resultado de una verificación de credencial.
      cache: "no-store",
      signal: controlador.signal,
    });

    if (respuesta.ok) {
      guardarCredencialAdmin(token);
      sesionAdmin.estado = "verificada";
      sesionAdmin.motivo = "";
      return true;
    }

    if (respuesta.status === 401) {
      // El servidor rechazó la credencial: se borra para no reintentar con algo
      // que ya sabemos que no sirve.
      olvidarCredencialAdmin();
      sesionAdmin.motivo = "credencial-incorrecta";
    } else if (respuesta.status === 429) {
      sesionAdmin.motivo = "demasiados-intentos";
    } else if (respuesta.status === 503) {
      sesionAdmin.motivo = "servidor-sin-credencial";
    } else {
      // Cualquier otra respuesta (500, 404, un proxy de por medio) es una
      // verificación que no se pudo completar. No abre.
      sesionAdmin.motivo = "sin-respuesta";
    }

    sesionAdmin.estado = "sin-credencial";
    return false;
  } catch (error) {
    // Acá caen la red caída y el corte por tiempo (AbortError). Las dos fallan
    // cerradas, igual que las otras tres.
    sesionAdmin.estado = "sin-credencial";
    sesionAdmin.motivo = "sin-respuesta";
    console.error("No se pudo verificar la credencial de administración con el API.", error);
    return false;
  } finally {
    clearTimeout(corte);
    // Pase lo que pase, el intento de esta carga ya ocurrió.
    sesionAdmin.intentoHecho = true;
  }
}

// Genera opciones de vehículos para selects
function vehicleOptions(selected = "") {
  return vehiculos
    .map((item) => `<option ${selected === item.label ? "selected" : ""}>${item.label}</option>`)
    .join("");
}

// Componente: Hero header de página
function pageHero(title, subtitle, eyebrow = "CDA de Valledupar") {
  return `
    <section class="page-hero">
      <p class="eyebrow">${eyebrow}</p>
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </section>
  `;
}

// Componente: Botón de WhatsApp flotante
//
// `rel="noopener noreferrer"` acompaña siempre a `target="_blank"`: sin `noopener`,
// la pestaña que se abre recibe un `window.opener` apuntando a este sitio y puede
// redirigirlo desde afuera (tabnabbing); `noreferrer` además evita mandarle a
// WhatsApp la dirección exacta desde la que salió el clic.
function whatsappButton() {
  return `
    <a
      href="https://wa.me/573166962144?text=Hola,%20quiero%20agendar%20una%20revisión%20técnico-mecánica"
      class="whatsapp-float"
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="#fff" 
        stroke-width="2" 
        stroke-linecap="round" 
        stroke-linejoin="round" 
        class="icon icon-tabler icons-tabler-outline icon-tabler-brand-whatsapp"
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9" />
        <path d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1" />
      </svg>
    </a>
  `;
}

// Componente: Sección de respaldos
function backedSection() {
  return `
    <section class="backed-section">
      <div class="container">
        <p class="eyebrow">Respaldados por</p>
        <div class="backed-logos">
          <img src="./assets/img/concesion-runtdos.png" alt="RUNT">
          <img src="./assets/img/images.png" alt="Logo">
          <img src="./assets/img/Logo-Vigilados_Color_PNG.png" alt="SuperTransporte">
        </div>
      </div>
    </section>
  `;
}

// Activa navegación según ruta actual
function setActiveNav(path) {
  document.querySelectorAll(".main-nav a").forEach((link) => {
    const href = link.getAttribute("href").replace("#", "");
    link.classList.toggle("active", href === path || (href === "/admin" && path.startsWith("/admin")));
  });
}

// ── Flotantes: se retiran al llegar al pie ────────────────────────────────────
//
// El botón de WhatsApp y el del asistente son `position: fixed`, así que
// acompañaban el scroll hasta el final y tapaban los datos de contacto. Cuando
// la sección "Respaldados por" entra en pantalla, se retiran (el estilo vive en
// styles.css, bajo `body.flotantes-ocultos`).
//
// OJO: render() reescribe app.innerHTML en cada cambio de ruta y destruye los
// nodos, así que el observer anterior queda apuntando a elementos que ya no
// existen. Por eso se desconecta antes de crear el siguiente.
let observadorFlotantes = null;

function bindFlotantes() {
  if (observadorFlotantes) {
    observadorFlotantes.disconnect();
    observadorFlotantes = null;
  }
  document.body.classList.remove("flotantes-ocultos");

  // Sin flotantes no hay nada que ocultar: las rutas del panel no los dibujan (ver
  // renderizarAdmin en app.js). Sin esta salida el observador quedaría vigilando un
  // pie que además está en display:none, o sea que nunca intersecta.
  if (!document.querySelector(".whatsapp-float") && !document.querySelector(".chatbot-widget")) return;

  // La página de "no encontrada" no lleva la sección de respaldos; ahí el límite es el pie.
  const limite = document.querySelector(".backed-section") || document.querySelector(".footer");
  if (!limite || typeof IntersectionObserver === "undefined") return;

  observadorFlotantes = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        document.body.classList.toggle("flotantes-ocultos", entrada.isIntersecting);
      });
    },
    // Un margen negativo abajo evita que se oculten por asomar apenas un borde.
    { rootMargin: "0px 0px -80px 0px" },
  );

  observadorFlotantes.observe(limite);
}
