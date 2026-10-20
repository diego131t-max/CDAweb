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

/*
 * ESTADO DE LA CARGA INICIAL DEL API (catálogo y tarifas).
 *
 * `datosDelApi` es la promesa de esas dos cargas; `datosDelApiEnCurso` es verdadera mientras no
 * hayan terminado. Existen para que el sitio PINTE sin esperarlas: con el API dormido (Railway lo
 * apaga) la primera respuesta tarda hasta 6 s, y antes toda la página esperaba. Ver iniciar() y
 * render() en app.js.
 */
let datosDelApiEnCurso = false;
let datosDelApi = Promise.resolve();

/**
 * ¿Llegaron las tarifas del API?
 *
 * Se distingue de "no eligió el año" a propósito: si las tarifas no cargaron, el
 * problema es del sitio y hay que decirlo así, no mandar al cliente a revisar un
 * campo que ya llenó.
 */
let tarifasCargadas = false;

/*
 * ── VERSIÓN DE LOS ARCHIVOS ESTÁTICOS ───────────────────────────────────────
 *
 * EL PROBLEMA QUE RESUELVE, y costó una tarde encontrarlo:
 *
 * Los <script> y la hoja de estilos llevan `?v=N` en index.html, así que subir
 * ese número cambia su URL y el navegador los baja de nuevo. Las IMÁGENES no lo
 * llevaban: su URL era siempre la misma. Y el servidor las manda con
 * `max-age=86400` (ver politicaDeCache en server.js).
 *
 * O sea que al reemplazar una foto, el servidor servía la nueva de inmediato y
 * cualquiera que hubiera visitado el sitio en las últimas 24 horas seguía viendo
 * la vieja, sin forma de saberlo. Para quien hace el cambio parece que no se
 * aplicó; para el visitante, que el sitio está desactualizado.
 *
 * LA VERSIÓN NO SE ESCRIBE ACÁ A MANO. Se lee del propio <script> que cargó este
 * archivo, que ya la trae. Así no hay dos lugares que puedan quedar
 * desfasados: subir el `?v=` de index.html —que es el paso que ya existe y del
 * que nadie se olvida porque si no, no se ve ningún cambio— versiona también las
 * imágenes.
 *
 * `document.currentScript` solo vale mientras el script se está ejecutando, por
 * eso se lee acá arriba y no adentro de conVersion().
 */
const VERSION_ASSETS = (() => {
  try {
    const propio = document.currentScript && document.currentScript.src;
    if (!propio) return "";
    return new URL(propio, location.href).searchParams.get("v") || "";
  } catch (error) {
    // Si algo falla, se sigue sin versionar: una foto vieja en caché es mucho
    // menos grave que un sitio que no arranca.
    console.error("No se pudo leer la versión de los archivos estáticos.", error);
    return "";
  }
})();

/**
 * Le agrega la versión a la ruta de un archivo propio.
 *
 * Deja intactas las URL absolutas —las fotos de archivo, el logo— porque no las
 * servimos nosotros y no controlamos su caché. Y las que ya traen una consulta,
 * para no armar un `?a=1?v=2`.
 */
function conVersion(ruta) {
  if (!VERSION_ASSETS || !ruta) return ruta;
  if (/^https?:/i.test(ruta) || ruta.includes("?")) return ruta;
  return `${ruta}?v=${VERSION_ASSETS}`;
}

// Pide algo al API aguantando el ARRANQUE EN FRÍO del servidor.
//
// EL PROBLEMA QUE RESUELVE, medido contra producción el 2026-08-24:
//
//   API dormida .... 13,7 s en contestar
//   API despierta ... 0,3 s
//   corte del sitio ... 6 s
//
// Railway duerme el servicio cuando nadie lo usa. La primera petición después
// de un rato lo DESPIERTA, y ese despertar tarda más que el corte de seis
// segundos: el sitio abortaba y mostraba "no pudimos verificar tu credencial"
// o "no pudimos registrar tu cita" con un servidor que estaba perfectamente
// bien y ya venía en camino.
//
// El daño real no era el panel —ahí alcanza con reintentar— sino el
// agendamiento: el primer cliente del día que entrara a reservar veía que su
// cita NO quedó, y se iba.
//
// POR QUÉ REINTENTAR Y NO SUBIR EL CORTE A 25 SEGUNDOS. El corte de seis
// segundos está bien pensado y se conserva: un servidor que acepta la conexión
// y no contesta es un fallo, no una espera, y hacer esperar 25 segundos a
// alguien cuyo API está de verdad caído es peor que fallar rápido.
//
// Reintentar distingue los dos casos solo. El primer intento corto falla rápido
// cuando algo está roto; cuando lo que pasó es que el servidor estaba dormido,
// ese mismo intento ya lo despertó y el segundo —con más paciencia— lo
// encuentra despierto. El costo de la paciencia se paga únicamente en el caso
// donde sirve.
//
// Solo reintenta si el primer intento se AGOTÓ. Un 401, un 500 o una respuesta
// de cualquier tipo se devuelven tal cual: reintentar eso sería mandar dos
// veces la misma cita.
const CORTE_PRIMER_INTENTO = 6000;
const CORTE_SEGUNDO_INTENTO = 20000;

async function fetchConCorte(url, opciones, corteMs) {
  const controlador = new AbortController();
  const corte = setTimeout(() => controlador.abort(), corteMs);
  try {
    return await fetch(url, { ...opciones, signal: controlador.signal });
  } finally {
    clearTimeout(corte);
  }
}

async function fetchConEspera(url, opciones = {}) {
  try {
    return await fetchConCorte(url, opciones, CORTE_PRIMER_INTENTO);
  } catch (error) {
    // `AbortError` es el corte propio. Cualquier otro fallo —DNS, red caída,
    // CORS— se propaga sin reintentar: no lo va a arreglar esperar más.
    if (!error || error.name !== "AbortError") throw error;

    /*
     * SOLO SE REINTENTAN LAS LECTURAS, Y ESTO NO ES PRUDENCIA DE MÁS.
     *
     * Cuando el servidor está dormido, la petición queda encolada y él la
     * PROCESA igual cuando despierta —aunque el navegador ya se haya rendido a
     * los seis segundos y nunca vea la respuesta—. Con un POST eso significa
     * que la cita SÍ se creó; reintentar crearía una segunda.
     *
     * Y con dos vehículos a la vez como tope, una cita duplicada no es solo
     * una fila fea en el panel: ocupa el segundo de los dos cupos y deja esa
     * hora llena con un solo carro.
     *
     * QUE NO SE REINTENTE EL POST NO DEJA EL AGENDAMIENTO ROTO, porque para
     * cuando alguien envía el formulario el servidor YA ESTÁ DESPIERTO: cargar
     * la página pide el catálogo y elegir la fecha pide la disponibilidad, y
     * las dos son lecturas que sí se reintentan. El primer GET paga el
     * despertar; el POST llega a un servidor caliente.
     */
    const metodo = String(opciones.method || "GET").toUpperCase();
    if (metodo !== "GET" && metodo !== "HEAD") throw error;

    console.warn("El API no contestó en 6 s; probablemente estaba dormido. Reintentando la lectura con más espera…");
    return await fetchConCorte(url, opciones, CORTE_SEGUNDO_INTENTO);
  }
}

// Pide el catálogo al API. Nunca lanza: deja el catálogo vacío y devuelve false
// para que quien lo use decida qué mostrar.
async function cargarCatalogoServicios() {
  try {
    const respuesta = await fetchConEspera(`${API_URL}/servicios`);
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
  try {
    const respuesta = await fetchConEspera(`${API_URL}/citas/disponibilidad?fecha=${encodeURIComponent(fecha)}`, {
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
  }
}

// "09:30" → { texto: "9:30", sufijo: "AM" }. Solo para MOSTRAR: lo que viaja al
// servidor sigue siendo el "HH:MM" exacto que él mandó.
//
// Doce horas con AM/PM, sin cero a la izquierda, y las 12:00 en punto como "M"
// (meridiano): es como lo escribe CDA.horario ("Festivos: 8:00 AM - 12:00 M"), y
// un desplegable que dijera "13:30" al lado de un horario que dice "1:30 PM"
// obligaría a la persona a traducir. Devuelve null si la cadena no tiene forma
// de hora, para que quien llama muestre lo que vino tal cual.
function partesDeHora(hhmm) {
  const coincide = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
  if (!coincide) return null;
  const hora = Number(coincide[1]);
  const minutos = coincide[2];
  if (hora > 23) return null;

  const sufijo = hora === 12 && minutos === "00" ? "M" : hora < 12 ? "AM" : "PM";
  const hora12 = hora % 12 === 0 ? 12 : hora % 12;
  return { texto: `${hora12}:${minutos}`, sufijo };
}

// El rango de una franja para el rótulo: "9:30 – 10:30 AM", "11:30 AM – 12:30 PM".
// El sufijo va una sola vez cuando los dos extremos lo comparten, y en los dos
// cuando cambia (pasando el mediodía): "11:30 – 12:30 PM" se leería como de noche.
function rotuloDeFranja(franja) {
  const inicio = partesDeHora(franja.hora);
  if (!inicio) return String(franja.hora);

  const fin = partesDeHora(franja.fin);
  if (!fin) return `${inicio.texto} ${inicio.sufijo}`;
  if (inicio.sufijo === fin.sufijo) return `${inicio.texto} – ${fin.texto} ${fin.sufijo}`;
  return `${inicio.texto} ${inicio.sufijo} – ${fin.texto} ${fin.sufijo}`;
}

// La primera franja con cupo, o null si el día está lleno. Sirve para elegir por
// omisión algo que de verdad se pueda reservar.
function primeraFranjaLibre(franjas) {
  const libre = franjas.find((franja) => franja.disponibles > 0);
  return libre ? libre.hora : null;
}

/* ===========================================================================
 * LA FRANJA DE TIEMPO — el selector de hora de los dos formularios (076).
 *
 * Reemplaza al <select> de horas. Con citas de una hora que empiezan cada media
 * hora, la lista eran veinte renglones casi iguales; la franja muestra el día
 * entero de un vistazo: dónde hay lugar, dónde queda uno y dónde está lleno.
 *
 * NO TIENE COPIA DE NINGUNA REGLA. Las horas de inicio, el fin de cada cita y los
 * cupos salen tal cual de GET /api/citas/disponibilidad. Las horas se pasan a
 * minutos solo para saber DÓNDE dibujar cada tramo; el corchete va de `hora` a
 * `fin` como los manda el servidor, sin sumarle una hora en el navegador.
 *
 * Cómo está armada, y por qué:
 *
 * - Por debajo es un grupo de <input type="radio" name="time"> de verdad, ocultos
 *   a la vista pero no al lector de pantalla ni al teclado. Así el navegador da
 *   gratis lo difícil: Tab entra al grupo en la hora elegida, las flechas
 *   recorren las horas SALTANDO las llenas (que van `disabled`), y el formulario
 *   envía el "HH:MM" exacto en `time` igual que lo hacía el <select>.
 *
 * - En celular, veinte tramos en ~320 px son ~16 px cada uno: menos que un dedo.
 *   Por eso tocar la barra NO exige acertarle al tramo: elige la hora con cupo
 *   más cercana al punto tocado, y deslizar el dedo de lado recorre las horas
 *   viendo el rótulo grande. El camino cómodo son las flechas ◀ ▶ de abajo
 *   (44 px), que saltan a la hora anterior o siguiente CON cupo. Se descartó el
 *   desplazamiento horizontal: esconde parte del día, que es justo lo que la
 *   franja vino a mostrar entero.
 *
 * - El lleno no se distingue solo por el color: lleva rayado diagonal, el
 *   "queda 1" va lleno a media altura, y la leyenda lo dice con palabras.
 *
 * - Las páginas repintan solo el contenedor del campo (ver repintarCampoDeHora en
 *   pages/schedule.js), así que los listeners van DELEGADOS en ese contenedor,
 *   que sobrevive al repintado. Y elegir una hora NO repinta nada: mueve el
 *   corchete y cambia dos textos sobre los nodos que ya están, para que no se
 *   pierda el foco ni se corte la animación.
 * ======================================================================== */

// "09:30" → 570. Solo para DIBUJAR: decir a qué altura de la barra cae una hora.
function minutosDeHora(hhmm) {
  const coincide = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
  if (!coincide) return null;
  return Number(coincide[1]) * 60 + Number(coincide[2]);
}

function cupoDeFranja(franja) {
  if (franja.disponibles <= 0) return "sin cupo";
  return franja.disponibles === 1 ? "queda 1 cupo" : `quedan ${franja.disponibles} cupos`;
}

// La clase del tramo. "pocos" es "queda uno", sin suponer cuál es el tope: eso lo
// sabe el servidor.
function nivelDeFranja(franja) {
  if (franja.disponibles <= 0) return "lleno";
  return franja.disponibles === 1 ? "pocos" : "libre";
}

/*
 * Dónde cae cada cosa en la barra, en porcentaje de su ancho.
 *
 * Cada tramo va de su hora de inicio a la siguiente (media hora hoy, lo que
 * diga el servidor mañana). La barra termina en el `fin` más tardío, así que
 * después del último tramo queda una "cola" sin color: es la hora que dura la
 * última cita, en la que ya no se puede EMPEZAR otra.
 *
 * Devuelve null si alguna hora no tiene forma de hora: mejor un aviso que una
 * barra dibujada con números inventados.
 */
function geometriaDeFranjas(franjasRecibidas) {
  const franjas = franjasRecibidas
    .map((franja) => ({ franja, inicio: minutosDeHora(franja.hora), fin: minutosDeHora(franja.fin) }))
    .sort((a, b) => a.inicio - b.inicio);
  if (franjas.length === 0 || franjas.some((item) => item.inicio === null)) return null;

  // La separación entre inicios, para el ancho de cada tramo.
  let paso = Infinity;
  for (let i = 1; i < franjas.length; i += 1) {
    const diferencia = franjas[i].inicio - franjas[i - 1].inicio;
    if (diferencia > 0 && diferencia < paso) paso = diferencia;
  }
  if (!Number.isFinite(paso)) {
    const unica = franjas[0];
    paso = unica.fin !== null && unica.fin > unica.inicio ? unica.fin - unica.inicio : 30;
  }

  // Un API anterior a la 076 no manda `fin`: el corchete cubre entonces solo su
  // tramo, que es lo único que se sabe sin inventar la duración.
  const finDe = (item) => (item.fin !== null && item.fin > item.inicio ? item.fin : item.inicio + paso);

  const desde = franjas[0].inicio;
  const hasta = Math.max(...franjas.map(finDe));
  const pct = (minutos) => Math.round(((minutos - desde) / (hasta - desde)) * 100000) / 1000;

  return {
    desde,
    hasta,
    pct,
    tramos: franjas.map((item, i) => {
      const siguiente = franjas[i + 1];
      const ancho = siguiente ? Math.min(paso, siguiente.inicio - item.inicio) : paso;
      return {
        franja: item.franja,
        izq: pct(item.inicio),
        der: pct(item.inicio + ancho),
        marcoIzq: pct(item.inicio),
        marcoAncho: Math.round((pct(finDe(item)) - pct(item.inicio)) * 1000) / 1000,
      };
    }),
  };
}

// El corchete se mueve con `transform` y no con `left`, para que la animación
// corra en la capa de composición. translateX en % es relativo a SU ancho.
function transformDelMarco(izq, ancho) {
  return `translateX(${Math.round((izq / ancho) * 100000) / 1000}%)`;
}

// El rango escrito bajo el corchete se pega al borde cuando el corchete está en
// una punta, para no salirse de la tarjeta.
function alineacionDelRango(izq, ancho) {
  const centro = izq + ancho / 2;
  if (centro < 22) return "al-inicio";
  if (centro > 78) return "al-final";
  return "";
}

// El rango del rótulo grande, para que en celular se corte SOLO en la raya
// ("11:30 AM –" / "12:30 PM") y nunca deje un "PM" solo en el segundo renglón.
function rotuloSinCortes(rango) {
  return String(rango).replace(/ (AM|PM|M)\b/g, " $1");
}

// "8 AM", "12 M", "1 PM": lo justo para el eje.
function etiquetaDelEje(minutos) {
  const partes = partesDeHora(`${Math.floor(minutos / 60)}:00`);
  return partes ? `${partes.texto.replace(/:00$/, "")} ${partes.sufijo}` : "";
}

// Índice de la hora con cupo anterior (dir -1) o siguiente (dir +1). Sin hora
// elegida, la primera o la última con cupo. -1 si no hay.
function indiceVecinoConCupo(libres, actual, dir) {
  if (actual < 0) {
    const indices = libres.map((libre, i) => (libre ? i : -1)).filter((i) => i >= 0);
    if (indices.length === 0) return -1;
    return dir > 0 ? indices[0] : indices[indices.length - 1];
  }
  for (let i = actual + dir; i >= 0 && i < libres.length; i += dir) {
    if (libres[i]) return i;
  }
  return -1;
}

function flechaSvg(dir) {
  const trazo = dir < 0 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7";
  return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="${trazo}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/**
 * El campo cuando todavía no hay horas que mostrar: sin fecha, consultando, sin
 * conexión o el CDA cerrado ese día. Cada caso trae su propio mensaje, porque
 * "no atendemos ese día" y "no pudimos consultar" mandan a hacer cosas distintas.
 */
function franjaDeTiempoAvisoMarkup(prefijo, titulo, mensaje, tono = "") {
  return `
    <p class="franja-titulo" id="${prefijo}Titulo">${escaparHtml(titulo)}</p>
    <p class="franja-aviso ${tono}" id="${prefijo}Aviso">${escaparHtml(mensaje)}</p>`;
}

/**
 * La franja de tiempo de un día. `prefijo` hace únicos los id ("time" en el
 * formulario de cuatro pasos, "quickTime" en el rápido).
 *
 * Todo lo que viene del servidor entra escapado: el rótulo se arma con su `hora`
 * y su `fin`, y aunque hoy sean "HH:MM", escapar en el origen es la regla.
 */
function franjaDeTiempoMarkup(prefijo, titulo, franjas, horaElegida) {
  const geometria = geometriaDeFranjas(franjas);
  if (!geometria) {
    return franjaDeTiempoAvisoMarkup(prefijo, titulo, "No pudimos mostrar las horas de ese día. Intenta de nuevo en unos minutos.", "error");
  }

  const { tramos } = geometria;
  const libres = tramos.map((tramo) => tramo.franja.disponibles > 0);
  const hayCupo = libres.some(Boolean);
  const indiceElegido = tramos.findIndex((tramo) => tramo.franja.hora === horaElegida && tramo.franja.disponibles > 0);
  const elegido = indiceElegido >= 0 ? tramos[indiceElegido] : null;

  const ultimo = tramos[tramos.length - 1];
  const cola = ultimo.der < 100 ? `<span class="franja-cola" style="left:${ultimo.der}%;width:${Math.round((100 - ultimo.der) * 1000) / 1000}%"></span>` : "";

  // El eje: una marca en cada hora en punto. Con muchas, en pantallas angostas
  // se ve una sí y una no (ver `.franja-escala.densa` en styles.css).
  const marcas = [];
  for (let minutos = Math.ceil(geometria.desde / 60) * 60; minutos <= geometria.hasta; minutos += 60) {
    const posicion = geometria.pct(minutos);
    const borde = posicion < 4 ? " borde-inicio" : posicion > 96 ? " borde-final" : "";
    marcas.push(`<span class="franja-marca${marcas.length % 2 ? " impar" : ""}${borde}" style="left:${posicion}%">${escaparHtml(etiquetaDelEje(minutos))}</span>`);
  }

  const visual = tramos
    .map((tramo) => `<span class="franja-tramo ${nivelDeFranja(tramo.franja)}" style="left:${tramo.izq}%;width:${Math.round((tramo.der - tramo.izq) * 1000) / 1000}%"></span>`)
    .join("");

  const radios = tramos
    .map((tramo, i) => {
      const { franja } = tramo;
      const lleno = franja.disponibles <= 0;
      const rango = rotuloDeFranja(franja);
      // Para el lector de pantalla, "a" en vez de la raya: "10:00 a 11:00 AM".
      const nombre = `${rango.replace(" – ", " a ")}, ${cupoDeFranja(franja)}`;
      return `<input class="franja-radio" type="radio" name="time" id="${prefijo}-${i}" value="${escaparHtml(franja.hora)}" aria-label="${escaparHtml(nombre)}" style="left:${tramo.izq}%"
        data-izq="${tramo.izq}" data-der="${tramo.der}" data-marco-izq="${tramo.marcoIzq}" data-marco-ancho="${tramo.marcoAncho}"
        data-rotulo="${escaparHtml(rango)}" data-cupo="${escaparHtml(cupoDeFranja(franja))}" data-nivel="${nivelDeFranja(franja)}"${lleno ? " disabled" : ""}${i === indiceElegido ? " checked" : ""}>`;
    })
    .join("");

  const marco = elegido
    ? `<span class="franja-marco ${alineacionDelRango(elegido.marcoIzq, elegido.marcoAncho)}" data-franja-marco style="width:${elegido.marcoAncho}%;transform:${transformDelMarco(elegido.marcoIzq, elegido.marcoAncho)}"><span class="franja-marco-rango" data-franja-rango>${escaparHtml(rotuloDeFranja(elegido.franja))}</span></span>`
    : `<span class="franja-marco" data-franja-marco hidden><span class="franja-marco-rango" data-franja-rango></span></span>`;

  let lectura;
  if (elegido) {
    lectura = `<strong>${escaparHtml(rotuloSinCortes(rotuloDeFranja(elegido.franja)))}</strong><span class="franja-punto" aria-hidden="true"> · </span><span class="franja-cupo ${nivelDeFranja(elegido.franja)}">${escaparHtml(cupoDeFranja(elegido.franja))}</span>`;
  } else if (hayCupo) {
    lectura = `<span class="franja-cupo">Toca la franja o usa las flechas para elegir la hora</span>`;
  } else {
    lectura = `<span class="franja-cupo lleno">Sin cupo este día — elige otra fecha</span>`;
  }

  const anterior = indiceVecinoConCupo(libres, indiceElegido, -1);
  const siguiente = indiceVecinoConCupo(libres, indiceElegido, 1);

  return `
    <p class="franja-titulo" id="${prefijo}Titulo">${escaparHtml(titulo)}</p>
    <div class="franja-tiempo" role="radiogroup" aria-labelledby="${prefijo}Titulo">
      <div class="franja-escala${marcas.length > 7 ? " densa" : ""}" aria-hidden="true">${marcas.join("")}</div>
      <div class="franja-pista" data-franja-pista>
        <div class="franja-tramos" aria-hidden="true">${visual}${cola}</div>
        ${radios}
        ${marco}
      </div>
      <div class="franja-lector">
        <button class="franja-flecha" type="button" data-franja-mover="-1" aria-label="Hora anterior con cupo"${anterior < 0 ? " disabled" : ""}>${flechaSvg(-1)}</button>
        <p class="franja-lectura" data-franja-lectura aria-live="polite">${lectura}</p>
        <button class="franja-flecha" type="button" data-franja-mover="1" aria-label="Siguiente hora con cupo"${siguiente < 0 ? " disabled" : ""}>${flechaSvg(1)}</button>
      </div>
      <ul class="franja-leyenda" aria-hidden="true">
        <li><span class="franja-muestra libre"></span>Libre</li>
        <li><span class="franja-muestra pocos"></span>Queda 1</li>
        <li><span class="franja-muestra lleno"></span>Lleno</li>
      </ul>
    </div>`;
}

/**
 * Pone el corchete, el rótulo grande y las flechas de acuerdo con el radio
 * marcado. Toca los nodos que ya están; no repinta.
 */
function actualizarFranjaDeTiempo(contenedor) {
  const grupo = contenedor.querySelector(".franja-tiempo");
  if (!grupo) return;

  const radios = Array.from(grupo.querySelectorAll(".franja-radio"));
  const actual = radios.findIndex((radio) => radio.checked);
  const radio = radios[actual];
  const marco = grupo.querySelector("[data-franja-marco]");
  const rango = grupo.querySelector("[data-franja-rango]");
  const lectura = grupo.querySelector("[data-franja-lectura]");

  if (radio && marco && rango && lectura) {
    const izq = Number(radio.dataset.marcoIzq);
    const ancho = Number(radio.dataset.marcoAncho);
    marco.hidden = false;
    marco.style.width = `${ancho}%`;
    marco.style.transform = transformDelMarco(izq, ancho);
    marco.classList.remove("al-inicio", "al-final");
    const alineacion = alineacionDelRango(izq, ancho);
    if (alineacion) marco.classList.add(alineacion);
    // textContent: el rótulo salió del servidor y ya no se vuelve a interpretar.
    rango.textContent = radio.dataset.rotulo || radio.value;

    const fuerte = document.createElement("strong");
    fuerte.textContent = rotuloSinCortes(radio.dataset.rotulo || radio.value);
    const punto = document.createElement("span");
    punto.className = "franja-punto";
    punto.setAttribute("aria-hidden", "true");
    punto.textContent = " · ";
    const cupo = document.createElement("span");
    cupo.className = `franja-cupo ${radio.dataset.nivel || ""}`;
    cupo.textContent = radio.dataset.cupo || "";
    lectura.replaceChildren(fuerte, punto, cupo);
  }

  const libres = radios.map((candidato) => !candidato.disabled);
  grupo.querySelectorAll("[data-franja-mover]").forEach((flecha) => {
    flecha.disabled = indiceVecinoConCupo(libres, actual, Number(flecha.dataset.franjaMover)) < 0;
  });
}

/**
 * Ata la franja de tiempo que vive dentro de `contenedor`. `alElegir(hora)` se
 * llama con el "HH:MM" del servidor cada vez que cambia la hora elegida.
 *
 * Los listeners van en `contenedor` y no en la franja: las páginas repintan su
 * interior (al cambiar la fecha, al llegar los cupos) y él sigue en pie. Se
 * llama desde el bind de cada página, que corre en cada navegación con un DOM
 * nuevo, así que nunca se acumulan dos juegos sobre el mismo nodo.
 */
function bindFranjaDeTiempo(contenedor, alElegir) {
  if (!contenedor) return;

  const radiosDe = (nodo) => Array.from(nodo.querySelectorAll(".franja-radio"));

  const elegir = (radio) => {
    if (!radio || radio.disabled) return;
    const cambio = !radio.checked;
    radio.checked = true;
    actualizarFranjaDeTiempo(contenedor);
    if (cambio) alElegir(radio.value);
  };

  // Tocar la barra elige la hora CON CUPO más cercana al punto tocado: con
  // tramos de 16 px, exigir puntería sería castigar al que agenda desde el celular.
  const elegirPorPosicion = (pista, x) => {
    if (!pista.isConnected) return;
    const caja = pista.getBoundingClientRect();
    if (caja.width <= 0) return;
    const punto = ((x - caja.left) / caja.width) * 100;

    let mejor = null;
    let menorDistancia = Infinity;
    radiosDe(pista).forEach((radio) => {
      if (radio.disabled) return;
      const izq = Number(radio.dataset.izq);
      const der = Number(radio.dataset.der);
      const distancia = punto < izq ? izq - punto : punto > der ? punto - der : 0;
      if (distancia < menorDistancia) {
        menorDistancia = distancia;
        mejor = radio;
      }
    });
    elegir(mejor);
  };

  // Teclado: las flechas del navegador sobre los radios disparan `change`.
  contenedor.addEventListener("change", (evento) => {
    const radio = evento.target;
    if (!radio.classList || !radio.classList.contains("franja-radio")) return;
    actualizarFranjaDeTiempo(contenedor);
    alElegir(radio.value);
  });

  // Las flechas ◀ ▶: saltan a la hora anterior o siguiente con cupo. El foco se
  // queda en el botón, para poder tocarlo varias veces; el rótulo grande se
  // anuncia solo (aria-live).
  contenedor.addEventListener("click", (evento) => {
    const flecha = evento.target.closest("[data-franja-mover]");
    if (!flecha || flecha.disabled) return;
    const grupo = flecha.closest(".franja-tiempo");
    if (!grupo) return;
    const radios = radiosDe(grupo);
    const actual = radios.findIndex((radio) => radio.checked);
    const destino = indiceVecinoConCupo(radios.map((radio) => !radio.disabled), actual, Number(flecha.dataset.franjaMover));
    if (destino >= 0) elegir(radios[destino]);
  });

  /*
   * El puntero sobre la barra.
   *
   * Con mouse se elige al apretar y se puede arrastrar. Con el dedo se elige al
   * SOLTAR, o al deslizar de lado más de unos píxeles: elegir al apoyar haría que
   * quien solo quería bajar la página cambie la hora sin darse cuenta. El
   * `touch-action: pan-y` de la barra deja el desplazamiento vertical al
   * navegador, que avisa con `pointercancel` y entonces no se elige nada.
   */
  let gesto = null;
  const terminar = () => {
    if (gesto && gesto.pista.isConnected) gesto.pista.classList.remove("arrastrando");
    gesto = null;
  };

  contenedor.addEventListener("pointerdown", (evento) => {
    const pista = evento.target.closest("[data-franja-pista]");
    if (!pista) return;
    if (evento.pointerType === "mouse" && evento.button !== 0) return;

    gesto = { pista, id: evento.pointerId, x0: evento.clientX, arrastrando: evento.pointerType === "mouse" };
    try {
      pista.setPointerCapture(evento.pointerId);
    } catch (error) {
      // Sin captura el gesto igual funciona mientras el puntero siga encima.
    }
    if (gesto.arrastrando) {
      evento.preventDefault();
      pista.classList.add("arrastrando");
      elegirPorPosicion(pista, evento.clientX);
    }
  });

  contenedor.addEventListener("pointermove", (evento) => {
    if (!gesto || evento.pointerId !== gesto.id) return;
    if (!gesto.arrastrando && Math.abs(evento.clientX - gesto.x0) > 8) {
      gesto.arrastrando = true;
      gesto.pista.classList.add("arrastrando");
    }
    if (gesto.arrastrando) elegirPorPosicion(gesto.pista, evento.clientX);
  });

  contenedor.addEventListener("pointerup", (evento) => {
    if (!gesto || evento.pointerId !== gesto.id) return;
    elegirPorPosicion(gesto.pista, evento.clientX);
    terminar();
  });

  contenedor.addEventListener("pointercancel", terminar);
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
  try {
    const respuesta = await fetchConEspera(`${API_URL}/citas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cita),
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
  }
}

// ---------------------------------------------------------------------------
// COMPROBANTE DE PAGO
//
// Quien elige pagar en línea —QR de Bancolombia o transferencia— adjunta la foto
// del comprobante en el mismo formulario. El sitio NO COBRA: el dinero se mueve
// por fuera y esto es lo único que llega al CDA, así que alguien lo tiene que
// mirar antes de darlo por bueno.
// ---------------------------------------------------------------------------

// Comprueba el archivo ANTES de subirlo. Devuelve "" si sirve, o el motivo.
//
// El servidor lo vuelve a comprobar igual, y además mira los BYTES del archivo y
// no su nombre —un .exe renombrado a .jpg llega diciendo image/jpeg—. Esto de acá
// existe para no hacerle gastar cinco megas de datos móviles a alguien para
// después rechazárselos.
function revisarComprobante(archivo) {
  if (!archivo) return "";

  if (archivo.size > COMPROBANTE.tamanoMaximo) {
    const megas = Math.round(COMPROBANTE.tamanoMaximo / (1024 * 1024));
    return `El archivo pesa demasiado. El máximo son ${megas} MB.`;
  }

  // Los teléfonos a veces mandan el tipo vacío. Si no lo declara, se deja pasar y
  // que decida el servidor, que sí puede mirar el contenido.
  if (archivo.type && !COMPROBANTE.tiposAceptados.includes(archivo.type)) {
    return "Ese formato no sirve. Sube una foto (JPG, PNG o WEBP) o un PDF.";
  }

  return "";
}

// Reduce una foto antes de subirla. Los PDF y lo que no se pueda procesar pasan
// tal cual.
//
// POR QUÉ. Una foto de teléfono ronda los 4 MB, y subirla entera por datos
// móviles es donde esto falla en la vida real. A 1400 px de ancho un comprobante
// se lee perfecto y pesa unos 300 KB.
//
// NUNCA LANZA: si el navegador no puede con el canvas, devuelve el archivo
// original y que el servidor decida. Reducir es una mejora, no un requisito.
async function reducirFoto(archivo) {
  if (!archivo || archivo.type === "application/pdf") return archivo;
  if (!archivo.type || !archivo.type.startsWith("image/")) return archivo;

  try {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, COMPROBANTE.anchoMaximoDeFoto / bitmap.width);

    // Ya es chica: no se toca. Recomprimirla solo le sacaría calidad.
    if (escala >= 1) {
      bitmap.close();
      return archivo;
    }

    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(bitmap.width * escala);
    lienzo.height = Math.round(bitmap.height * escala);
    lienzo.getContext("2d").drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
    bitmap.close();

    const blob = await new Promise((resolver) => lienzo.toBlob(resolver, "image/jpeg", 0.82));
    if (!blob || blob.size >= archivo.size) return archivo;

    return new File([blob], "comprobante.jpg", { type: "image/jpeg" });
  } catch (error) {
    console.warn("No se pudo reducir la foto; se sube tal cual.", error);
    return archivo;
  }
}

// Sube el comprobante de una cita ya registrada.
//
// Devuelve { ok: true } o { ok: false, mensaje } — nunca lanza, igual que
// registrarCitaEnServidor(). Y por el mismo motivo: quien llama tiene que poder
// distinguir "listo" de "no se pudo", porque acá la diferencia le cambia el texto
// al cliente. La CITA YA ESTÁ GUARDADA cuando esto corre, así que un fallo de
// esta función NO significa que se haya perdido el turno.
//
// El archivo viaja CRUDO, con su tipo en Content-Type. Nada de FormData: el
// servidor lo lee con express.raw() y así no hace falta multipart de ningún lado.
async function subirComprobante(idDeCita, archivo) {
  try {
    const listo = await reducirFoto(archivo);

    const respuesta = await fetchConEspera(`${API_URL}/citas/${encodeURIComponent(idDeCita)}/comprobante`, {
      method: "POST",
      headers: { "Content-Type": listo.type || "application/octet-stream" },
      body: listo,
    });

    if (respuesta.ok) return { ok: true };

    // 400 (formato), 409 (ya tiene uno), 503 (el CDA no puede recibirlo ahora):
    // los tres traen un texto que ya explica qué pasó y qué hacer.
    const cuerpo = await respuesta.json().catch(() => null);
    if (cuerpo && cuerpo.error) return { ok: false, mensaje: cuerpo.error };
    if (cuerpo && Array.isArray(cuerpo.detalles) && cuerpo.detalles[0]) {
      return { ok: false, mensaje: cuerpo.detalles[0].mensaje };
    }

    throw new Error(`El API respondió ${respuesta.status}`);
  } catch (error) {
    console.error("No se pudo subir el comprobante.", error);
    return {
      ok: false,
      mensaje:
        "Tu cita quedó agendada, pero no pudimos recibir el comprobante. " +
        `Mándalo por WhatsApp al ${CDA.telefono} con tu número de cita.`,
    };
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

  try {
    const respuesta = await fetchConEspera(`${API_URL}/admin/sesion`, {
      headers: { Authorization: `Bearer ${token}` },
      // Que nadie guarde en caché el resultado de una verificación de credencial.
      cache: "no-store",
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
//
// Tres grupos y no una sola fila de "Respaldados por" (Diego, 2026-10-20): no es
// lo mismo quien VIGILA al CDA que un aliado o quien lo ACREDITA, y juntarlos
// bajo un mismo rótulo decía de más sobre unos y de menos sobre otros.
const GRUPOS_DE_RESPALDO = [
  {
    titulo: "Vigilados por",
    logos: [
      { src: "images.webp", alt: "Ministerio de Transporte" },
      { src: "Logo-Vigilados_Color_PNG.webp", alt: "Vigilados por SuperTransporte" },
      { src: "logo-corpocesar.webp", alt: "Corpocesar, Corporación Autónoma Regional del Cesar" },
    ],
  },
  {
    titulo: "Aliados",
    logos: [
      { src: "concesion-runtdos.webp", alt: "RUNT" },
      { src: "logo-consorcio-sicov-crc.webp", alt: "Consorcio SICOV-CRC" },
      // Logotipo muy apaisado (5:1): a la altura de los demás se ve el doble de
      // grande, así que va más bajo para que pese lo mismo.
      { src: "logo-supergiros.webp", alt: "SuperGiros", clase: "logo-apaisado" },
    ],
  },
  {
    titulo: "Acreditados por",
    logos: [{ src: "logo-onac.webp", alt: "ONAC, Organismo Nacional de Acreditación de Colombia" }],
  },
];

function backedSection() {
  const grupos = GRUPOS_DE_RESPALDO.map(
    (grupo) => `
          <div class="backed-group">
            <p class="backed-title">${escaparHtml(grupo.titulo)}</p>
            <div class="backed-logos">
              ${grupo.logos
                .map(
                  (logo) =>
                    `<img src="/assets/img/${logo.src}" alt="${escaparHtml(logo.alt)}"${
                      logo.clase ? ` class="${logo.clase}"` : ""
                    } loading="lazy" decoding="async">`,
                )
                .join("\n              ")}
            </div>
          </div>`,
  ).join("");

  return `
    <section class="backed-section">
      <div class="container backed-groups">${grupos}
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
 * La tabla la sirve el API y la guardan las tres variables de data.js; acá está
 * lo que la interpreta y lo que la trae.
 * =========================================================================== */

/**
 * Trae la tabla de tarifas del API.
 *
 * NUNCA LANZA: si el API no responde, las tarifas quedan vacías y el sitio se
 * dibuja igual. Lo que NO hace es caer a una copia de respaldo — una tabla vieja
 * publicaría precios que ya no son, y un precio equivocado con aire de correcto
 * es peor que un "no pudimos consultarlo".
 *
 * Devuelve si pudo, para que el arranque no tenga que mirar el estado global.
 */
async function cargarTarifas() {
  try {
    const respuesta = await fetchConEspera(`${API_URL}/tarifas`);
    if (!respuesta.ok) throw new Error(`El API respondió ${respuesta.status}`);

    const cuerpo = await respuesta.json();
    if (!cuerpo || !Array.isArray(cuerpo.categorias) || cuerpo.categorias.length === 0) {
      throw new Error("La respuesta de tarifas no trae categorías.");
    }

    TARIFAS_RTMYEC = { vigencia: cuerpo.vigencia, categorias: cuerpo.categorias };
    BANDAS_MATRICULA = cuerpo.bandas || [];
    COMPONENTES_RTMYEC = cuerpo.componentes || [];
    tarifasCargadas = true;
  } catch (error) {
    TARIFAS_RTMYEC = { vigencia: 0, categorias: [] };
    BANDAS_MATRICULA = [];
    COMPONENTES_RTMYEC = [];
    tarifasCargadas = false;
    console.error("No se pudieron cargar las tarifas del API.", error);
  }

  return tarifasCargadas;
}

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
