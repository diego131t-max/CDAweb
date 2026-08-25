// Dirección del API del CDA.
// El catálogo de servicios ya no vive en el frontend: se pide acá (ver
// cargarCatalogoServicios en utils.js). Por eso, para trabajar en el sitio hacen
// falta DOS procesos: `node Frontend/server.js` y el API en el puerto 3000.
//
// ⚠️ SI CAMBIA EL DOMINIO DEL API, ESTE NO ES EL ÚNICO LUGAR. La política de
// contenido declara a qué orígenes puede conectarse el navegador, y ese origen
// está escrito en DOS lugares más:
//
//   1. el <meta http-equiv="Content-Security-Policy"> de index.html
//   2. la constante POLITICA_DE_CONTENIDO de server.js (vía la variable
//      de entorno API_ORIGIN)
//
// Son TRES lugares y hay que tocar los tres. Si se cambia este y no los otros, el
// navegador bloquea todas las llamadas al API: el sitio se queda sin catálogo de
// servicios, el formulario de contacto no envía nada y el panel no abre, todo sin
// un solo error visible salvo en la consola.
//
// El sitio no tiene build, así que no puede leer variables de entorno: la
// dirección de producción va escrita acá, en una sola constante, y cuál se usa se
// decide en el navegador. Así el mismo archivo sirve para desarrollar y para
// publicar, sin editar nada al desplegar —que es justo el paso que se olvida.
const API_ORIGIN_PRODUCCION = "https://api.cdavalledupar.com";
const API_ORIGIN_DESARROLLO = "http://localhost:3000";

const ES_DESARROLLO = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const API_URL = `${ES_DESARROLLO ? API_ORIGIN_DESARROLLO : API_ORIGIN_PRODUCCION}/api`;

// Datos constantes del CDA
const CDA = {
  nombre: "CDA de Valledupar",
  ubicacion: "Cra. 18D #47 17, San Fernando, Valledupar, Cesar",
  // El punto de referencia para llegar, aparte de la dirección postal y a
  // propósito. `ubicacion` sola es la que necesitan el pie de página, la ficha
  // JSON-LD y el correo de confirmación: ahí un "queda frente a…" sobra, y
  // dentro del dato estructurado que lee Google directamente estorba —ese campo
  // espera una dirección, no una explicación—.
  //
  // Pero acá nadie llega por nomenclatura. Quien nunca ha venido pregunta por la
  // salida y por lo que se ve desde la vía, así que la referencia va donde se
  // está buscando cómo llegar: la página de contacto y el asistente.
  referencia: "Salida a La Paz, frente a la urbanización OGB",
  parqueadero: "Hay parqueadero disponible y es fácil llegar tanto en carro como en moto.",
  // Una sola cadena para TODOS los horarios, festivos incluidos, y no es cosmético:
  // antes el horario de los festivos vivía únicamente dentro de la respuesta del
  // asistente, así que la página de contacto —donde la gente va justo a buscar
  // esto— nunca lo mencionaba. Un dato que existe en un solo lugar del sitio es
  // un dato que la mitad de los visitantes no ve.
  horario: "Lunes a Viernes: 7:30 AM - 6:00 PM | Sábados: 7:30 AM - 4:00 PM | Festivos: 8:00 AM - 12:00 M",
  telefono: "316 6962144",
  // El correo OFICIAL del CDA, ratificado con el propietario (2026-08-24).
  //
  // Antes decía contacto@cdavalledupar.com. Es la cuenta con la que se
  // administra la empresa —la misma que es dueña del proyecto de Supabase— y es
  // la que el propietario efectivamente lee.
  //
  // OJO, ESTE NO ES EL ÚNICO LUGAR. El pie de página y la ficha JSON-LD de
  // index.html tienen su propia copia escrita a mano, porque son HTML estático
  // que se sirve a los rastreadores sin ejecutar JavaScript y no pueden leer de
  // acá. Si cambia el correo, se cambia en los tres.
  email: "admincdavalledupar@gmail.com",
  descripcion:
    "Somos el líder CDA en Valledupar. Realiza tu revisión con un equipo certificado, procesos confiables y atención ágil. Deja tu vehículo en manos expertas, agenda ya tu cita.",
  maps:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3923.7423356986833!2d-73.24193439999999!3d10.442009599999999!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e8ab9888e272a05%3A0xa9d98dcc823b9144!2sCentro%20de%20Diagnostico%20Automotriz%20Valledupar!5e0!3m2!1ses!2sco!4v1778993843497!5m2!1ses!2sco",
};

// Tipos de vehículos
// Tipos de vehículo.
//
// `recorte: true` significa que la imagen es un vehículo RECORTADO sobre fondo
// transparente, no una foto de una escena. Los dos son válidos, pero se dibujan
// distinto y por eso el dato viaja: ver `.image-top img.recorte` en styles.css.
//
// La ranura de la tarjeta mide 176px de alto y su ANCHO depende del ancho de la
// pantalla: 1.57:1 en escritorio con cuatro columnas, 2.06:1 en celular y 4.84:1
// en tablet, donde la grilla pasa a una sola columna. Con `object-fit: cover` un
// recorte se destroza en esas proporciones —la moto de 2T perdía las ruedas ya en
// escritorio, y en tablet quedaba una franja horizontal por la mitad—. Una foto
// de escena aguanta el recorte; un objeto suelto no.
const vehiculos = [
  {
    label: "Motos 2T",
    desc: "Revisión técnico-mecánica y de gases para motocicletas de 2 tiempos.",
    img: "/assets/img/moto2t.webp",
    recorte: true,
  },
  {
    label: "Motos 4T",
    desc: "Diagnóstico completo para motocicletas de 4 tiempos, estándar y deportivas.",
    img: "/assets/img/moto4t.webp",
    recorte: true,
  },
  {
    label: "Vehículos Livianos",
    desc: "Carros y camionetas particulares con inspección integral certificada.",
    img: "/assets/img/liviano.webp",
    recorte: true,
  },
  {
    label: "Vehículos Pesados",
    desc: "Buses, camiones y tracto-mulas con revisión según normativa de carga.",
    img: "/assets/img/pesado.webp",
    recorte: true,
  },
];

/* ===========================================================================
 * TARIFAS OFICIALES DE LA RTMyEC — VIGENCIA 2026
 *
 * Salen de la tabla que entregó el propietario, y son la ÚNICA fuente de precios
 * del sitio. Antes acá había $65.000 y $95.000, que eran entre un tercio y un
 * cuarto de lo real.
 *
 * LA TARIFA ES REGULADA. Sube cada enero con la UVT y es la misma en los nueve
 * CDA de Valledupar: nadie puede cobrar de menos ni de más. Eso tiene una
 * consecuencia útil para el sitio —no se compite por precio, así que publicarlo
 * completo no regala nada— y una obligación: EN ENERO HAY QUE ACTUALIZAR ESTA
 * TABLA Y CORRER UN AÑO LAS BANDAS, o el sitio queda mintiendo igual que antes.
 *
 * LOS TOTALES NO SE GUARDAN, SE SUMAN (ver totalRtmyec en utils.js). Si estuvieran
 * escritos, un día alguien corrige un componente y se olvida del total, y el
 * desglose pasa a contradecir a la cifra que encabeza. Sumando, eso no puede pasar.
 *
 * ⚠️ PENDIENTE DE CONFIRMAR CON EL PROPIETARIO: en las cinco categorías, la banda
 * "2009 o anterior" repite EXACTAMENTE el ANSV de la banda "2019 a 2023", cuando
 * la progresión de las otras tres es creciente. Las 20 combinaciones cierran
 * aritméticamente contra la tabla, así que se cargó tal cual está; huele a
 * arrastre de planilla, pero corregirlo por cuenta propia sería inventar un precio.
 * =========================================================================== */

// Las bandas son por AÑO DE MATRÍCULA, no por edad calculada, y es a propósito:
// la tabla rotula "2010-2018" como "8-17 años", pero en 2026 esos vehículos tienen
// entre 8 y 16; y "2009 hacia atrás" lo rotula "18 a más" cuando 2009 son 17. Los
// dos criterios no coinciden. El año de matrícula no es ambiguo, es lo que dice la
// primera columna de la tabla, y es lo que la persona lee en su tarjeta de propiedad.
/* ===========================================================================
 * TARIFAS — YA NO VIVEN ACÁ
 *
 * La tabla se mudó al API (`GET /api/tarifas`, Backend/src/tipos/tarifa.ts) y el
 * sitio la consume al arrancar, igual que el catálogo de servicios.
 *
 * POR QUÉ SE MUDÓ. El servidor necesita calcular cuánto cuesta una cita para
 * guardarlo con ella —no puede creerle el precio al cliente, o cualquiera
 * mandaría su propio monto—. Mientras la tabla estuvo acá, el backend tenía que
 * mantener una copia. Esa duplicación se sostuvo un rato con una prueba que
 * comparaba número por número, y funcionaba, pero un precio duplicado es una
 * bomba de tiempo: el día que las dos copias se separan, el sitio cotiza una
 * cifra y el panel muestra otra, y nadie se entera hasta que un cliente reclame.
 *
 * Estas tres variables se llenan en `cargarTarifas()` (utils.js). Empiezan
 * VACÍAS y no con una copia de respaldo: un respaldo desactualizado publicaría
 * precios viejos sin que nadie lo note, que es peor que decir "no pude
 * consultarlos". Es el mismo criterio con el que se retiró el almacenamiento en
 * archivo del backend.
 * ======================================================================== */

let TARIFAS_RTMYEC = { vigencia: 0, categorias: [] };
let BANDAS_MATRICULA = [];
let COMPONENTES_RTMYEC = [];

// Características principales
//
// La cuarta columna es la foto y la quinta, OPCIONAL, el encuadre: qué parte se
// conserva cuando object-fit la recorta a la ranura de la tarjeta, que es casi
// 2.5:1. Sin encuadre, recorta del centro.
//
// YA NO QUEDA NINGUNA foto de archivo en este bloque: las cuatro tarjetas son del
// CDA de verdad (2026-08-25). La última en caer fue "Resultados en Minutos", que
// además arrastraba un problema viejo: esa misma photo-1492144534655 de Unsplash
// también ilustraba "Confianza y Tecnología" hasta que a esa se le puso la foto
// del CDA, o sea que estuvo REPETIDA en la misma fila.
//
// ⚠️ ESTO NO ALCANZA PARA SACAR images.unsplash.com DEL CSP, aunque el comentario
// que estaba acá decía que sí. Se equivocaba: los TRES pasos del proceso, en
// pages/home.js, siguen apuntando a Unsplash. Recién cuando esos tres tengan foto
// propia se puede limpiar `img-src` en server.js y en el <meta> de index.html.
//
// El sitio NO queda libre de terceros con eso: media.base44.com sigue en el CSP
// porque de ahí sale el LOGO de la cabecera (index.html), que se descarga de un
// host ajeno en cada visita y en todas las páginas. Si ese host cae o borra el
// archivo, el sitio se queda sin logo. Es un pendiente aparte y más grave que
// estas fotos.
const features = [
  // Ruta absoluta y no "assets/...": una relativa se resuelve contra el
  // directorio de la URL actual, y esta sección hoy solo se dibuja en "/" pero
  // nada garantiza que siga siendo así. Es la misma razón por la que todos los
  // assets del sitio van con "/" adelante (ver el comentario de RUTAS REALES).
  ["user-check", "Técnicos Certificados", "Personal con certificaciones oficiales y amplia experiencia en diagnóstico automotor.", "/assets/img/tecnicos-cda.webp", "center 40%"],
  // 900px de ancho, más del doble que sus tres hermanas, y no es capricho: la
  // ranura de esta tarjeta llega a 852px en tablet, donde la grilla pasa a una
  // columna. Las otras tres se agrandan ahí y se ven blandas; esta se dibuja a
  // escala real. Son 73 KB, y a cambio se ahorra la petición a un tercero.
  //
  // El 40% sube el recorte para que en tablet —donde solo se ve el 31% del alto—
  // entren la cara del técnico y el capó abierto. Con el recorte por omisión
  // quedaban medio piso y los techos.
  ["gauge", "Resultados en Minutos", "Proceso ágil con diagnóstico inmediato para que no pierdas tiempo valioso.", "/assets/img/resultados-cda.webp", "center 40%"],
  ["clock", "Agilidad / Eficiencia", "Atención rápida y eficiente sin sacrificar la calidad, valoramos tu tiempo.", "/assets/img/agilidad-cda.webp", "center 20%"],
  // El 20% acá es más alto que el 40% de las otras dos a propósito: lo que hace
  // creíble a esta tarjeta es el EQUIPO, y el monitor de diagnóstico está arriba
  // en la foto. Con el recorte por omisión quedaba fuera y solo se veía el piso.
  ["badge-dollar", "Confianza y Tecnología", "Equipos de última generación respaldados por años de experiencia.", "/assets/img/tecnologia-cda.webp", "center 20%"],
];

// Medios de pago.
//
// RATIFICADO con el propietario el 2026-08-22. Son DOS, y los dos se pagan al
// llegar al CDA: efectivo y tarjeta por datáfono.
//
// Esto cierra un pendiente que estaba anotado en CLAUDE.md, y la respuesta
// desmintió lo que el sitio publicaba. El formulario de agendamiento ofrecía
// "PayU", "MercadoPago", "Efectivo" y "Transferencia Bancaria", y "PayU" era
// además el valor POR OMISIÓN: toda cita en la que el cliente no tocara el
// desplegable quedó guardada como pagada por una pasarela que el CDA nunca
// tuvo. PayU y MercadoPago son competencia de Wompi, que es la que se piensa
// integrar algún día; la transferencia tampoco se acepta.
//
// ESTA LISTA ES LA ÚNICA FUENTE. La sección del inicio y el <select> del
// formulario leen de acá, para que no puedan volver a decir cosas distintas
// —que es exactamente lo que pasó—.
//
// NO se nombran franquicias (Visa, Mastercard, Amex) a propósito: cuáles acepta
// el datáfono no está confirmado, y poner un logo de una que rechace en caja es
// prometer algo que no se cumple.
//
// PAGO EN LÍNEA: SÍ EXISTE, y no es una pasarela (2026-08-24).
//
// El propietario descartó Wompi —descartado, no pospuesto— y habilitó dos vías
// directas: el código QR de Bancolombia y la transferencia a su cuenta. La
// diferencia con una pasarela es toda la diferencia: el sistema NO COBRA y NO SE
// ENTERA de que el dinero llegó. Por eso los dos medios en línea piden
// comprobante y por eso alguien del CDA lo tiene que mirar.
//
// `enLinea: true` es lo que dispara todo eso en el formulario. NO es cosmético:
// de esa marca dependen que aparezca el panel del QR, que se pida el archivo, y
// que el servidor deje la cita en 'pendiente de comprobante'.
//
// EL ORDEN IMPORTA. El valor por omisión de toda cita del formulario largo es
// `mediosDePago[0].titulo` (pages/schedule.js). Los medios en línea van al final
// a propósito: si "Efectivo" dejara de ser el primero, cambiaría en silencio lo
// que se guarda en toda cita en la que el cliente no toque el desplegable — que
// es exactamente el error que dejó citas guardadas como pagadas por PayU.
//
// Los `titulo` son el contrato con el servidor: viajan tal cual en el campo
// `payment` y tienen que coincidir con MEDIOS_DE_PAGO de Backend/src/tipos/pago.ts,
// que ahora sí es una lista cerrada y rechaza cualquier otra cosa.
const mediosDePago = [
  {
    icono: "efectivo",
    titulo: "Efectivo",
    detalle: "Pagas en el mostrador el día de tu revisión.",
  },
  {
    icono: "tarjeta",
    titulo: "Tarjeta débito y crédito",
    detalle: "Tenemos datáfono en el CDA. Traes tu tarjeta y listo.",
  },
  {
    icono: "qr",
    titulo: "QR Bancolombia",
    detalle: "Escaneas el código desde la app de tu banco y adjuntas el comprobante.",
    enLinea: true,
  },
  {
    icono: "transferencia",
    titulo: "Transferencia",
    detalle: "Transfieres a nuestra cuenta de ahorros y adjuntas el comprobante.",
    enLinea: true,
  },
];

// Los datos de la cuenta a la que se transfiere.
//
// SALEN DE LA CERTIFICACIÓN BANCARIA que entregó el propietario, no de ningún
// otro lado (principio I): Bancolombia, cuenta de ahorros 52330041668, NIT
// 900084186. El QR es el del poster oficial de Bancolombia/Redeban que él mismo
// mandó, extraído del PDF sin retocar ni un píxel.
//
// FALTA EL TITULAR, y está vacío a propósito. La certificación muestra el nombre
// CORTADO ("CENTRO DE DIAGNOSTICO AUTOMOTOR DE VALLE") y el QR también lo trae
// truncado a 21 caracteres por límite del formato EMV. Completar un nombre legal
// a ojo es justo lo que el principio I prohíbe: se llena cuando el propietario
// lo confirme, y hasta entonces no se muestra ese renglón.
const datosBancarios = {
  banco: "Bancolombia",
  tipoDeCuenta: "Cuenta de ahorros",
  numero: "523-300416-68",
  // Sin separadores: es el que se copia al portapapeles y el que se pega en la
  // app del banco. El de arriba es el que se lee.
  numeroPlano: "52330041668",
  nit: "900084186",
  titular: "",
  qr: "/assets/img/qr-bancolombia.png",
};

// Cuánto puede pesar un comprobante y qué formatos se aceptan.
//
// Tiene que coincidir con TAMANO_MAXIMO y TIPOS_ACEPTADOS de
// Backend/src/almacenamiento/comprobantes.ts. Acá sirve para avisarle al cliente
// ANTES de que suba cinco megas por datos móviles y se los rechacen; el servidor
// vuelve a comprobarlo igual, y además mira los bytes del archivo y no el nombre.
const COMPROBANTE = {
  tiposAceptados: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  extensiones: ".jpg,.jpeg,.png,.webp,.pdf",
  tamanoMaximo: 5 * 1024 * 1024,
  // Las fotos se reducen en el navegador antes de subirlas: una foto de teléfono
  // ronda los 4 MB y en esta anchura queda en unos 300 KB, que es de sobra para
  // leer un comprobante. Los PDF se mandan tal cual.
  anchoMaximoDeFoto: 1400,
};

// Acá vivían dos citas de ejemplo (defaultAppointments). Se eliminaron por FR-011:
// eran datos de prueba, no citas reales, y además traían tipos de vehículo que no
// existen ("Vehículo Liviano", "Moto 4T", en singular). El sitio arranca sin citas;
// ver ensureSeed() en utils.js, que además descarta las que quedaron sembradas.

// Preguntas frecuentes.
//
// Las respuestas salen de CONTENIDO_RTM, o sea del documento del proceso oficial
// del CDA. Antes decían cosas como "la documentación básica al día", que no le
// sirve a nadie: quien pregunta qué llevar quiere una lista, no una categoría.
//
// `corto` es el rótulo del botón en el asistente; `q` es la pregunta completa,
// que es la que se ve en la página y la que la gente escribe en Google. Son
// distintas a propósito: en un botón de 120 píxeles no entra una pregunta.
//
// SE FUE EL CAMPO `keywords`. Era una lista de palabras clave que se imprimía en
// pantalla debajo de cada respuesta. Eso se usaba en 2010; hoy Google lo ignora y
// al visitante le queda un renglón raro que no significa nada.
const faqItems = [
  {
    corto: "¿Qué revisan?",
    q: "¿Qué hace un CDA y qué revisan en la inspección?",
    a: "Un CDA verifica que tu vehículo cumpla las condiciones mínimas para circular. La revisión tiene dos partes: las pruebas con equipos —frenos, alineación, suspensión, emisiones, luces y ruido— y una inspección visual de carrocería, vidrios, cinturones, llantas, dirección y motor. Los requisitos están en la NTC 5375.",
  },
  {
    corto: "¿Qué llevo?",
    q: "¿Qué documentos necesito para la revisión técnico-mecánica?",
    a: "La licencia de tránsito (tarjeta de propiedad) y tu cédula. Si el vehículo funciona con gas, además el certificado de conversión vigente; y si presta servicio —público, escolar, empresarial o de turismo—, la tarjeta de operación. <strong>El SOAT no es un requisito</strong>: no es obligatorio tenerlo vigente para la revisión, según la Ley 2050 de 2020.",
  },
  {
    corto: "¿Cuándo me toca?",
    q: "¿Cuándo me toca la primera revisión técnico-mecánica?",
    a: "Las motos y los vehículos de servicio público, a los dos años de la fecha de matrícula. Los particulares y oficiales, a partir del quinto año. Los matriculados entre el 20 de mayo de 2017 y el 19 de mayo de 2018 van a partir del sexto. Lo fija la Ley 2294 de 2023 en su artículo 179.",
  },
  {
    corto: "¿Si no paso?",
    q: "¿Qué pasa si mi vehículo no aprueba la revisión?",
    a: "Tienes <strong>15 días calendario</strong> para corregir lo que salió mal y volver a presentarlo sin pagar de nuevo. Pasado ese plazo, la revisión se cobra completa otra vez. Ten en cuenta también que tu vehículo no puede tener una solicitud de revisión abierta en otro CDA: si la tiene, el sistema no nos deja recibirlo.",
  },
  {
    corto: "¿Cómo agendo?",
    q: "¿Cómo agendo una cita en CDA de Valledupar?",
    a: "Desde la página de agendamiento: dejas tus datos, eliges el vehículo y el servicio, escoges la fecha y confirmas. Te llega la confirmación y evitas la fila.",
  },
  {
    corto: "¿Cuánto vale?",
    q: "¿Cuánto cuesta la revisión técnico-mecánica?",
    a: "Depende del tipo de vehículo y del año de matrícula. La tarifa es <strong>regulada por el Estado</strong> y es la misma en todos los CDA del país: nadie puede cobrarte menos ni más. En la página de tarifas hay una calculadora que te da el valor exacto.",
  },
  {
    corto: "¿Qué vehículos?",
    q: "¿Qué tipos de vehículos atienden?",
    a: "Motos y similares —cuatrimoto, mototriciclo, tricimoto, motocarro—, vehículos livianos particulares y públicos, y vehículos pesados particulares y públicos. 🚗🏍️",
  },
  {
    corto: "¿Cómo lo traigo?",
    q: "¿Cómo debe llegar mi vehículo al CDA?",
    a: "Descargado, limpio, con la alarma desactivada, sin copas ni tapacubos, con las placas legibles y al menos un cuarto de combustible. Sin testigos de falla en el tablero y sin fugas. Si algo de eso no se cumple no podemos hacer la revisión, así que conviene revisarlo antes de salir de casa.",
  },
  {
    corto: "¿Dónde están?",
    q: "¿Dónde está ubicado CDA de Valledupar?",
    // La dirección se interpola y no se vuelve a escribir: estaba copiada tal
    // cual acá, así que el día que el CDA se mude esta respuesta seguiría
    // mandando gente a la sede vieja sin que nadie se diera cuenta.
    a: `En ${CDA.ubicacion} — ${CDA.referencia}. En la página de contacto está el mapa y todos nuestros canales de atención.`,
  },
];

// Prompts del chatbot
const chatbotPrompts = {
  "agendar cita": {
    user: "Quiero agendar una cita.",
    bot: "¡Perfecto! 🗓️ Ve a <strong>Agendar Cita</strong>, completa tus datos, selecciona el vehículo, la fecha disponible y realiza el pago. Tu turno queda reservado al instante.",
    cta: "/agendar",
    ctaLabel: "Ir a agendar",
  },
  horario: {
    user: "¿Cuál es el horario?",
    // Los festivos ya no se nombran acá: los trae CDA.horario. Solo queda el
    // domingo, que es el único día en que el CDA no abre.
    bot: `Estamos abiertos <strong>${CDA.horario}</strong>. 🕐 Los domingos permanecemos cerrados.`,
    cta: "/contacto",
    ctaLabel: "Ver contacto",
  },
  servicios: {
    user: "¿Qué servicios ofrecen?",
    // La lista de servicios NO se escribe acá (FR-001): se arma desde el catálogo
    // del API, que es la única fuente de verdad sobre lo que el CDA ofrece. Así el
    // asistente y el formulario de agendamiento nunca dicen cosas distintas.
    // Es un getter, y no un texto fijo, porque este archivo se carga antes de que
    // el catálogo llegue; al momento del clic el catálogo ya está disponible.
    get bot() {
      return textoServiciosChatbot();
    },
    cta: "/servicios",
    ctaLabel: "Ver servicios",
  },
  vehiculos: {
    user: "¿Qué vehículos atienden?",
    bot: "Atendemos <strong>motos 2T y 4T, vehículos livianos y vehículos pesados</strong>. 🚗🏍️ Si tienes dudas sobre tu tipo de vehículo, nuestro equipo te orienta con gusto.",
    // Apuntaba a "/" (la home), donde no hay nada específico sobre tipos de
    // vehículo: la página de tarifas sí tiene una fila por cada uno.
    cta: "/tarifas",
    ctaLabel: "Ver tipos y tarifas",
  },
  ubicacion: {
    user: "¿Dónde están ubicados?",
    bot: `${CDA.referencia}. Nos encontramos en <strong>${CDA.ubicacion}</strong>. 📍 ${CDA.parqueadero}`,
    cta: "/contacto",
    ctaLabel: "Ver en mapa",
  },
  documentos: {
    user: "¿Qué debo llevar?",
    bot: "Necesitas la <strong>tarjeta de propiedad</strong> y el <strong>SOAT vigente</strong>. Antes de venir, revisa que las luces, frenos, llantas y niveles estén en buen estado. ✅",
    cta: "/faq",
    ctaLabel: "Ver preguntas frecuentes",
  },
  precios: {
    user: "¿Cuánto vale la revisión?",
    bot: "Las tarifas varían según el tipo de vehículo. 💰 Motos desde <strong>$65.000</strong> y vehículos livianos desde <strong>$95.000</strong>. Incluye certificado oficial al aprobar.",
    cta: "/tarifas",
    ctaLabel: "Ver tarifas completas",
  },
};

/* ===========================================================================
 * CONTENIDO DE LA REVISIÓN — TODO SALE DE `INFO PAG. WEB.docx`
 *
 * Es el documento del proceso oficial que entregó el CDA. Nada de acá está
 * redactado desde cero ni deducido: cada requisito, cada condición y cada plazo
 * están en ese archivo, y donde hay una norma se cita.
 *
 * Citar la norma no es adorno. "No hace falta el SOAT" dicho a secas es una
 * afirmación que nadie se atreve a creer y que el mostrador puede desmentir; con
 * la Ley 2050 de 2020 al lado, es un dato que el visitante puede verificar y que
 * el CDA puede sostener.
 *
 * Lo usan la página de recomendaciones, el FAQ y el asistente. Si algo cambia,
 * cambia acá y aparece corregido en los tres lados.
 * =========================================================================== */

const CONTENIDO_RTM = {
  // Lo que hay que llevar. El orden es el del documento.
  documentos: [
    {
      titulo: "Licencia de tránsito",
      detalle: "La tarjeta de propiedad del vehículo. Es el único documento que no puede faltar nunca.",
    },
    {
      titulo: "Cédula de ciudadanía",
      detalle:
        "O cualquier documento equivalente que identifique a quien solicita el servicio. Lo exige la Ley 1581 de 2012, de protección de datos personales.",
    },
    {
      titulo: "Certificado de conversión a gas",
      detalle: "Vigente, y solo si el vehículo opera con gas.",
      siAplica: true,
    },
    {
      titulo: "Tarjeta de operación",
      detalle:
        "Para transporte público de pasajeros y para particulares que prestan servicio: escolares, empresariales y de turismo.",
      siAplica: true,
    },
  ],

  // La aclaración que más gente va a buscar, y la que más rápido genera un
  // reclamo si el sitio y la caja no dicen lo mismo.
  soat: {
    titulo: "El SOAT no es un requisito",
    detalle:
      "Es un dato informativo: no es obligatorio tenerlo vigente para hacer la revisión, según la Ley 2050 de 2020. Podés venir sin él.",
  },

  // Cómo tiene que llegar el vehículo. Si algo de esto no se cumple, el
  // recepcionista no puede aceptarlo, y la persona vuelve a su casa sin revisión.
  alistamiento: [
    "Que no tenga otra solicitud de revisión vigente en otro CDA.",
    "Descargado.",
    "Limpio, lo suficiente para poder inspeccionarlo.",
    "Con la alarma desactivada.",
    "Con la presión de inflado correcta en las llantas.",
    "Sin tapas, copas ni tapacubos en los rines y las tuercas.",
    "Con las placas legibles.",
    "Con al menos un cuarto de combustible.",
    "Si es bicombustible (gasolina y gas), el sistema a gasolina tiene que funcionar.",
    "Si es eléctrico, con más del 50% de carga y sin testigo de riesgo eléctrico ni cables sueltos a la vista.",
    "Con el nivel del líquido de frenos visible.",
    "Sin forros, carpas, fundas ni tapas protectoras: hay que retirarlos.",
    "Sin testigos de falla del motor encendidos en el tablero, y sin ruidos anormales.",
    "Con los candados retirados o abiertos: batería, puertas, compuertas, tapa de combustible, cabina basculante y soporte de la llanta de repuesto.",
    "Que encienda al menos una luz fija.",
    "Con la carrocería puesta. Las motos, con sus pastas y su tablero.",
    "Sin fugas importantes de combustible, refrigerante o aceite.",
    "Las motos automáticas, con el soporte central funcionando.",
  ],

  // Cuándo toca la primera revisión (Ley 2294 de 2023, artículo 179).
  periodicidad: [
    { tipo: "Motos y similares", cuando: "A los 2 años de la fecha de matrícula." },
    { tipo: "Servicio público", cuando: "A los 2 años de la fecha de matrícula." },
    { tipo: "Particular y oficial", cuando: "A partir del quinto año desde la matrícula." },
    {
      tipo: "Matriculados entre el 20/05/2017 y el 19/05/2018",
      cuando: "A partir del sexto año (circular externa 20234000000637 de MinTransporte).",
    },
    { tipo: "Placas extranjeras", cuando: "Si entran al país por hasta 3 meses, no necesitan revisión." },
  ],

  // Qué pasa si el vehículo no aprueba.
  reproceso: {
    dias: 15,
    detalle:
      "Si tu vehículo no aprueba, tenés 15 días calendario para corregir lo que salió mal y volver a presentarlo sin pagar de nuevo. Pasado ese plazo, la revisión se cobra completa otra vez.",
  },

  // Las pruebas que hacen los equipos.
  mecanizada: [
    { nombre: "Alineación", detalle: "Desviación lateral en todos los ejes, con el alineador al paso." },
    { nombre: "Frenos", detalle: "Eficacia de frenado, freno de estacionamiento y desequilibrio por eje, con el frenómetro." },
    { nombre: "Suspensión", detalle: "Adherencia entre la rueda y el equipo. Solo aplica a vehículos livianos." },
    { nombre: "Emisiones contaminantes", detalle: "Analizador de gases para motores a gasolina y opacímetro para diésel." },
    { nombre: "Luces", detalle: "Intensidad y alineación de bajas, altas y exploradoras, con el luxómetro." },
    { nombre: "Ruido", detalle: "Nivel de presión sonora exterior con el vehículo detenido, con el sonómetro." },
  ],

  // Lo que revisa una persona, sin desarmar nada.
  sensorial: {
    livianos: [
      "Carrocería y chasis, limpiaparabrisas, peldaños y retrovisores",
      "Vidrios y soporte de la rueda de repuesto",
      "Habitáculo, cinturones de seguridad y sus anclajes",
      "Bocina y dispositivos sonoros no permitidos",
      "Alumbrado y señalización, y salida de emergencia",
      "Frenos, suspensión y dirección",
      "Rines y llantas",
      "Motor, sistema de combustible y transmisión",
    ],
    motos: [
      "Exterior y chasis, y retrovisores",
      "Sillín y reposapiés",
      "Elementos que producen ruido",
      "Alumbrado y señalización",
      "Emisiones en los gases de escape",
      "Frenos, suspensión y dirección",
      "Rines y llantas",
      "Soporte de estacionamiento",
      "Motor y caja",
    ],
  },
};
