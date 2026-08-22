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

// ── Navegación ────────────────────────────────────────────────────────────────

/**
 * Sube al inicio de la página, de golpe.
 *
 * `behavior: "instant"` es explícito y no una redundancia. El <html> tenía
 * `scroll-behavior: smooth`, así que un `scrollTo(0, 0)` no saltaba: ANIMABA
 * todo el recorrido de vuelta hacia arriba. Al cambiar de página se veía como si
 * la nueva apareciera empezada por la mitad y subiera sola, cuando lo que uno
 * espera al hacer clic es estar arriba y ya. Cuanto más abajo estabas, más larga
 * era la animación y más raro se sentía.
 *
 * Esa regla de CSS se quitó —el sitio no tiene un solo enlace de ancla que la
 * aprovechara, así que solo servía para causar esto—, y este `instant` queda
 * igual: la próxima vez que alguien vuelva a poner `smooth` en el <html>, el
 * cambio de ruta no se rompe otra vez.
 *
 * Los tres lugares que suben al inicio pasan por acá: el cambio de ruta, el clic
 * en un enlace que apunta a la página en la que ya estás, y el mismo caso desde
 * un enlace del asistente.
 */
function irAlInicio() {
  // El try no es decorativo. "instant" es un valor de ENUMERACIÓN: en un
  // navegador que no lo conozca —salió del borrador de la especificación y
  // volvió años después, así que hay versiones reales sin él— convertirlo lanza
  // TypeError. Y como esto corre dentro de render(), esa excepción no rompería
  // el scroll: dejaría el sitio EN BLANCO. En un teléfono viejo, que es
  // justamente el que puede no tenerlo.
  //
  // El respaldo funciona igual de bien mientras el <html> no traiga `smooth`,
  // que es la situación de hoy y está explicada en styles.css.
  try {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  } catch {
    window.scrollTo(0, 0);
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

/* ===========================================================================
 * ENTRADA AL SCROLLEAR
 *
 * Los elementos con `data-animar` aparecen con un desplazamiento corto cuando
 * entran en pantalla. Una sola vez cada uno: se deja de observar apenas se
 * dispara, o el bloque parpadearía cada vez que se sube y se baja.
 *
 * EL CONTENIDO NUNCA DEPENDE DE QUE LA ANIMACIÓN CORRA. El estado oculto lo pone
 * el JAVASCRIPT, no la hoja de estilos: si este archivo no carga, si el navegador
 * no tiene IntersectionObserver o si el sistema pide movimiento reducido, no se
 * agrega nada y las tarjetas se ven, quietas. Al revés —ocultarlas desde el CSS y
 * revelarlas con JS— cualquiera de esas tres cosas dejaría la sección en blanco.
 *
 * SE ANIMA CON @keyframes Y NO CON UNA TRANSICIÓN, y esa decisión tiene una razón
 * concreta: `.card:hover` levanta la tarjeta con `transform`. Una transición
 * obliga a dejar puesta una regla de `transform` en el estado final, que le gana
 * por especificidad al hover y lo mata. La animación, sin `fill-mode`, no deja
 * NADA aplicado cuando termina: la tarjeta vuelve a sus estilos normales y el
 * hover funciona igual que siempre.
 *
 * El observer vive en el ámbito del módulo y se DESCONECTA antes de crear el
 * siguiente: render() rehace `#app` entero en cada cambio de ruta, así que el
 * anterior quedaría observando nodos que ya no existen.
 * =========================================================================== */
let observadorEntrada = null;

function bindEntradas() {
  if (observadorEntrada) {
    observadorEntrada.disconnect();
    observadorEntrada = null;
  }

  const objetivos = document.querySelectorAll("[data-animar]");
  if (!objetivos.length) return;

  // Movimiento reducido: se sale ANTES de ocultar nada. Hay gente a la que el
  // movimiento le provoca mareo o migraña.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!("IntersectionObserver" in window)) return;

  observadorEntrada = new IntersectionObserver(
    (entradas, observador) => {
      // El escalonado se calcula sobre las que entran JUNTAS, no sobre el índice
      // global: las cuatro tarjetas de una fila aparecen una detrás de otra, pero
      // una que entra sola más abajo no arranca con medio segundo de retraso.
      entradas
        .filter((entrada) => entrada.isIntersecting)
        .forEach((entrada, indice) => {
          // 100ms entre una y otra. Con 80 y una animación de 0.42s las cuatro
          // se pisaban tanto que parecían entrar todas juntas y de golpe.
          entrada.target.style.animationDelay = `${indice * 100}ms`;
          entrada.target.classList.remove("entrada-oculta");
          entrada.target.classList.add("entrada-visible");
          observador.unobserve(entrada.target);
        });
    },
    { threshold: 0.15 },
  );

  objetivos.forEach((elemento) => {
    // Se oculta ACÁ, no en el CSS, y de forma síncrona: render() llama a este
    // bind justo después de asignar el innerHTML, antes de que el navegador
    // pinte. Por eso no se ve el parpadeo de "aparece y se esconde".
    elemento.classList.remove("entrada-visible");
    elemento.style.animationDelay = "";
    elemento.classList.add("entrada-oculta");
    observadorEntrada.observe(elemento);
  });
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

/* ---------------------------------------------------------------------------
 * Acá vivían buscarServicio(nombre), serviciosParaVehiculo() y serviceOptions().
 *
 * Las tres armaban el <select> de servicios del agendamiento, filtrado por tipo
 * de vehículo. Se fueron el 2026-08-21 con la casilla: el CDA presta un solo
 * servicio y no hay lista que ofrecer ni que filtrar.
 *
 * Se BORRAN en vez de quedarse "por si acaso". Sus comentarios explicaban un
 * <select> que ya no existe y una exclusión —blindaje en motos— de un servicio
 * que el CDA no presta: leerlas mañana sería entender mal cómo funciona el
 * sitio. Si el catálogo vuelve a tener varios servicios, están en el historial.
 * --------------------------------------------------------------------------- */

// Busca un servicio por su id estable ('revision-tecnico-mecanica').
//
// Es la forma correcta de referirse a un servicio, y por eso es la que viaja en
// el formulario y en el API. El nombre cambia el día que el CDA decida
// presentarlo distinto; el id no. Si se agendara por nombre, ese cambio dejaría
// huérfanas todas las citas anteriores y el conteo del panel se partiría en dos.
function buscarServicioPorId(id) {
  return catalogoServicios.find((servicio) => servicio.id === id) || null;
}

// El id del servicio con el que se registran TODAS las citas del sitio.
//
// El CDA presta uno solo, así que ni el formulario de cuatro pasos ni el rápido
// preguntan cuál: los dos usan este. Está acá y no repetido en cada página
// porque hasta el 2026-08-21 el formulario rápido tenía su propia copia, escrita
// como NOMBRE ("Revisión Técnico-Mecánica"), y al renombrarse el servicio esa
// copia habría dejado de encontrarlo y el formulario rápido habría dejado de
// agendar sin que nadie tocara ese archivo.
//
// Es el ID y no el nombre a propósito: el nombre cambia el día que el CDA decida
// presentarlo distinto —ya pasó, ahora nombra también los gases— y el id no.
//
// NO se da por sentado que exista: quien lo usa lo busca en el catálogo del API
// y, si no está, lo dice en vez de registrar una cita de un servicio que el CDA
// no presta (FR-004).
const SERVICIO_UNICO_ID = "revision-tecnico-mecanica";

// Consulta cuántos cupos quedan en cada franja de un día — FR-028.
//
// Devuelve { ok: true, franjas } o { ok: false, mensaje }. Nunca lanza, igual
// que registrarCitaEnServidor y por el mismo motivo: quien la llama tiene que
// poder distinguir "no hay cupo" de "no pudimos preguntar", y con una excepción
// esas dos cosas terminan dibujando lo mismo.
//
// LA LISTA DE HORAS SALE DE ACÁ Y NO DE UNA CONSTANTE DEL FRONTEND.
//
// Es deliberado, y va contra la tentación de tener una copia local "por si
// acaso". El servidor es el que decide qué franjas existen y cuál acepta; una
// lista de respaldo en el navegador es exactamente el patrón que ya nos costó
// dos veces —las horas del <select> que no correspondían a nada, y los medios
// de pago que ofrecían dos pasarelas inexistentes—.
//
// Si el API no contesta, el desplegable queda vacío con un aviso. Eso NO es una
// pérdida de funcionalidad: sin API tampoco se puede agendar, porque el POST
// iría al mismo servidor que no está contestando.
async function consultarDisponibilidad(fecha) {
  const controlador = new AbortController();
  // Mismo corte de 6 s que el resto del sitio.
  const corte = setTimeout(() => controlador.abort(), 6000);

  try {
    const respuesta = await fetch(`${API_URL}/citas/disponibilidad?fecha=${encodeURIComponent(fecha)}`, {
      signal: controlador.signal,
    });

    if (!respuesta.ok) throw new Error(`El API respondió ${respuesta.status}`);

    const cuerpo = await respuesta.json();
    if (!Array.isArray(cuerpo.franjas)) throw new Error("La respuesta no trae franjas.");

    return { ok: true, franjas: cuerpo.franjas };
  } catch (error) {
    console.error("No se pudieron consultar los cupos.", error);
    return {
      ok: false,
      mensaje: "No pudimos consultar los cupos disponibles. Intenta de nuevo en unos minutos.",
    };
  } finally {
    clearTimeout(corte);
  }
}

// Dibuja las <option> del desplegable de hora a partir de lo que devolvió
// consultarDisponibilidad.
//
// Las franjas llenas se muestran DESHABILITADAS, no se ocultan. Ocultarlas haría
// que el desplegable cambie de largo entre un día y otro sin explicación, y
// alguien que quiere venir a las 9 necesita saber que las 9 existen y están
// tomadas —si no, va a pensar que el CDA no atiende a esa hora—.
function opcionesDeFranja(franjas, horaElegida) {
  return franjas
    .map((franja) => {
      const lleno = franja.disponibles <= 0;
      const restantes =
        franja.disponibles === 1 ? "queda 1 cupo" : `quedan ${franja.disponibles} cupos`;
      const etiqueta = lleno ? `${franja.hora} · sin cupo` : `${franja.hora} · ${restantes}`;
      // `value` es la hora pelada: lo que se manda al servidor no lleva el
      // adorno del rótulo.
      return `<option value="${escaparHtml(franja.hora)}"${lleno ? " disabled" : ""}${
        !lleno && franja.hora === horaElegida ? " selected" : ""
      }>${escaparHtml(etiqueta)}</option>`;
    })
    .join("");
}

// La primera franja con cupo, o null si el día está lleno. Sirve para elegir por
// omisión algo que de verdad se pueda reservar.
function primeraFranjaLibre(franjas) {
  const libre = franjas.find((franja) => franja.disponibles > 0);
  return libre ? libre.hora : null;
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

    if (respuesta.status === 409) {
      /*
       * FR-028 — La franja se llenó MIENTRAS el cliente llenaba el formulario.
       *
       * No es un caso raro: alguien elige las 9:00 cuando quedaba un lugar, se
       * toma dos minutos escribiendo la placa, y en el medio otra persona lo
       * toma. Sin esta rama caía en el `throw` de abajo y el cliente leía "no
       * pudimos registrar tu cita", que le hace pensar que el sitio falló —y lo
       * manda a reintentar exactamente lo mismo—.
       *
       * `franjaLlena` viaja aparte del mensaje para que quien llama sepa que
       * tiene que volver a consultar los cupos: los que tiene en pantalla ya
       * están viejos.
       */
      const cuerpo = await respuesta.json().catch(() => null);
      return {
        ok: false,
        franjaLlena: true,
        mensaje:
          cuerpo && cuerpo.error
            ? cuerpo.error
            : "Esa hora se llenó mientras completabas el formulario. Elige otra hora u otro día.",
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

  // Con un solo servicio la frase cambia entera, y no es cosmético: "Ofrecemos X.
  // ¡Todo en un solo lugar!" promete variedad donde hay una sola cosa, y quien
  // pregunta qué servicios hay merece saber que es uno. El plural se conserva
  // porque el catálogo es del API y puede volver a tener varios.
  if (nombres.length === 1) {
    return `Hacemos <strong>${nombres[0]}</strong>. 🔧 Es el único servicio que prestamos, y lo hacemos completo: puedes agendar tu cita en línea.`;
  }

  const listado = `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
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
//
// `variante` es un modificador OPCIONAL para cambiarle el fondo a una página sin
// tocárselo a las demás. Las cuatro páginas que usan este componente —tarifas,
// recomendaciones, preguntas frecuentes y la de "no encontrada"— comparten un
// solo `.page-hero::before`, así que sin esto cambiar una foto las cambia todas.
//
// NO lleva escapado y es correcto: el valor sale de nuestro propio código, nunca
// de un dato del cliente. El día que eso deje de ser cierto, hay que escaparlo:
// entra en un atributo.
function pageHero(title, subtitle, eyebrow = "CDA de Valledupar", variante = "") {
  return `
    <section class="page-hero${variante ? ` ${variante}` : ""}">
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
          <img src="/assets/img/concesion-runtdos.webp" alt="RUNT" loading="lazy" decoding="async">
          <img src="/assets/img/images.webp" alt="Logo" loading="lazy" decoding="async">
          <img src="/assets/img/Logo-Vigilados_Color_PNG.webp" alt="SuperTransporte" loading="lazy" decoding="async">
        </div>
      </div>
    </section>
  `;
}

// Activa navegación según ruta actual.
// El href ya es la ruta tal cual ("/tarifas"), así que se compara directo; antes
// había que sacarle el "#" porque el sitio enrutaba por fragmento.
function setActiveNav(path) {
  document.querySelectorAll(".main-nav a").forEach((link) => {
    const href = link.getAttribute("href");
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

/* ===========================================================================
 * CALCULADORA DE TARIFAS
 *
 * La tabla vive en data.js (TARIFAS_RTMYEC); acá está lo que la interpreta.
 * =========================================================================== */

/** $217.881, con el punto de miles que se usa en Colombia. */
function pesos(valor) {
  return "$" + valor.toLocaleString("es-CO");
}

/**
 * La banda de tarifa que le corresponde a un año de matrícula.
 *
 * Devuelve null si el año cae fuera de la tabla —un 2027 cuando la tabla es de
 * 2026, por ejemplo—. Esa es la razón de que exista el null: permite que la
 * pantalla diga "no tengo ese dato" en vez de mostrar un precio inventado.
 */
function bandaDeMatricula(anio) {
  return BANDAS_MATRICULA.find((b) => anio <= b.hasta && (b.desde === null || anio >= b.desde)) || null;
}

/** La categoría por su id. `find` y no `TARIFAS[id]`: un id inventado da null, no basura del prototipo. */
function categoriaDeTarifa(id) {
  return TARIFAS_RTMYEC.categorias.find((c) => c.id === id) || null;
}

/**
 * El desglose completo y su total.
 *
 * EL TOTAL SE SUMA ACÁ, no se lee de ninguna parte. Si estuviera escrito en la
 * tabla, el día que alguien corrija un componente y se olvide del total, la cifra
 * grande pasaría a contradecir a las ocho líneas que tiene debajo —y la que la
 * gente recuerda es la grande—. Sumando, esa contradicción no puede existir.
 */
function desgloseRtmyec(categoria, banda) {
  const lineas = COMPONENTES_RTMYEC.map(([clave, rotulo]) => ({
    rotulo,
    valor: clave === "ansv" ? categoria.ansv[banda.id] : categoria.componentes[clave],
  }));
  return { lineas, total: lineas.reduce((suma, l) => suma + l.valor, 0) };
}

/**
 * ¿A este vehículo ya le toca la revisión?
 *
 * Motos y servicio público a los 2 años de la matrícula; particulares y oficiales
 * a partir del quinto (Ley 2294 de 2023, art. 179).
 *
 * SE CUENTA CONTRA `vigencia` Y NO CONTRA EL AÑO REAL DEL RELOJ, a propósito. Si
 * usara el año real, en enero el veredicto se actualizaría solo mientras los
 * precios se quedarían en el año viejo: la página diría estar al día con cifras
 * que no lo están. Atado a `vigencia`, si nadie actualiza en enero las dos cosas
 * quedan viejas JUNTAS, y el rótulo "vigencia 2026" que se muestra en pantalla lo
 * delata. Un dato desactualizado que se nota es mucho mejor que uno que no.
 *
 * La excepción de los matriculados entre el 20/05/2017 y el 19/05/2018 —que van al
 * sexto año— no está implementada porque NO PUEDE CAMBIAR NINGUNA RESPUESTA: en
 * 2026 esos vehículos ya pasaron los seis años. Vuelve a importar si alguna vez se
 * calcula hacia atrás. Queda escrita en la página de recomendaciones.
 */
function estadoDeRevision(categoria, anioMatricula) {
  const edad = TARIFAS_RTMYEC.vigencia - anioMatricula;
  if (edad >= categoria.primeraRevision) return { toca: true };
  return {
    toca: false,
    anio: anioMatricula + categoria.primeraRevision,
    faltan: categoria.primeraRevision - edad,
  };
}

/**
 * Los años que ofrece el selector: uno por uno hasta 2010, y de ahí para atrás
 * un solo "2009 o anterior".
 *
 * Se agrupan porque de 2009 hacia atrás la tarifa es la misma y la revisión
 * corresponde con certeza: distinguir 1998 de 2003 le pediría precisión a la
 * persona sin cambiarle ni el precio ni la respuesta.
 */
function aniosDeMatricula() {
  const anios = [];
  for (let a = TARIFAS_RTMYEC.vigencia; a >= 2010; a -= 1) anios.push({ valor: a, label: String(a) });
  anios.push({ valor: 2009, label: "2009 o anterior" });
  return anios;
}
