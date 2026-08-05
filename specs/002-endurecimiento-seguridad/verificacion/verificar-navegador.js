// Verificación en navegador de la funcionalidad 002 (quickstart.md, sección B).
// Maneja Chrome sin interfaz por el protocolo DevTools. No toca el repositorio.
//
// Uso: node verificar-navegador.js <ADMIN_TOKEN>

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const TOKEN = process.argv[2];
if (!TOKEN) {
  console.error("Falta el ADMIN_TOKEN como argumento.");
  process.exit(1);
}

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PUERTO_DEPURACION = 9333;
const SITIO = "http://localhost:5173";

const resultados = [];
function comprobar(nombre, ok, detalle = "") {
  resultados.push({ nombre, ok, detalle });
  console.log(`${ok ? "  OK  " : " FALLA"}  ${nombre}${detalle ? ` — ${detalle}` : ""}`);
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Conexión al protocolo DevTools ───────────────────────────────────────────
let ws = null;
let siguienteId = 1;
const pendientes = new Map();
const eventos = [];

function enviar(metodo, params = {}, sessionId) {
  const id = siguienteId++;
  const mensaje = { id, method: metodo, params };
  if (sessionId) mensaje.sessionId = sessionId;
  ws.send(JSON.stringify(mensaje));
  return new Promise((resolve, reject) => {
    pendientes.set(id, { resolve, reject });
    setTimeout(() => {
      if (pendientes.has(id)) {
        pendientes.delete(id);
        reject(new Error(`Sin respuesta de ${metodo}`));
      }
    }, 20000);
  });
}

async function conectar(url) {
  ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (evento) => {
    const dato = JSON.parse(evento.data);
    if (dato.id && pendientes.has(dato.id)) {
      const { resolve, reject } = pendientes.get(dato.id);
      pendientes.delete(dato.id);
      dato.error ? reject(new Error(JSON.stringify(dato.error))) : resolve(dato.result);
    } else if (dato.method) {
      eventos.push(dato);
    }
  };
}

// Evalúa una expresión en la página y devuelve su valor.
async function evaluar(expresion, sessionId) {
  const r = await enviar(
    "Runtime.evaluate",
    { expression: expresion, returnByValue: true, awaitPromise: true },
    sessionId,
  );
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "excepción en la página");
  return r.result.value;
}

// Navega a una ruta y espera a que el router termine de dibujar.
async function ir(sessionId, ruta, esperaMs = 1200) {
  await evaluar(`location.hash = ${JSON.stringify(ruta)}`, sessionId);
  await dormir(esperaMs);
}

// Recarga completa (nueva evaluación de todos los scripts).
async function recargar(sessionId, ruta, esperaMs = 2000) {
  await enviar("Page.navigate", { url: `${SITIO}/#${ruta}` }, sessionId);
  await dormir(esperaMs);
}

function violacionesDePolitica() {
  return eventos
    .filter((e) => e.method === "Log.entryAdded" && e.params.entry.source === "security")
    .map((e) => e.params.entry.text)
    .concat(
      eventos
        .filter((e) => e.method === "Runtime.consoleAPICalled")
        .flatMap((e) => e.params.args.map((a) => String(a.value || "")))
        .filter((t) => /Content Security Policy|Refused to/i.test(t)),
    );
}

// ── Guion ────────────────────────────────────────────────────────────────────
(async () => {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "cdaperfil-"));
  const chrome = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${PUERTO_DEPURACION}`,
    `--user-data-dir=${perfil}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "about:blank",
  ]);

  const limpiar = () => {
    try { chrome.kill("SIGKILL"); } catch {}
  };
  process.on("exit", limpiar);

  // Esperar a que el puerto de depuración conteste.
  let version = null;
  for (let intento = 0; intento < 40; intento += 1) {
    try {
      version = await (await fetch(`http://127.0.0.1:${PUERTO_DEPURACION}/json/version`)).json();
      break;
    } catch { await dormir(400); }
  }
  if (!version) { console.error("Chrome no abrió el puerto de depuración."); process.exit(1); }
  console.log(`\nNavegador: ${version.Browser}\n`);

  await conectar(version.webSocketDebuggerUrl);
  const { targetId } = await enviar("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await enviar("Target.attachToTarget", { targetId, flatten: true });

  await enviar("Page.enable", {}, sessionId);
  await enviar("Runtime.enable", {}, sessionId);
  await enviar("Log.enable", {}, sessionId);
  await enviar("Network.enable", {}, sessionId);

  const peticiones = [];
  ws.addEventListener("message", (evento) => {
    const dato = JSON.parse(evento.data);
    if (dato.method === "Network.requestWillBeSent") peticiones.push(dato.params.request.url);
  });

  // ══ T004 — el catálogo sigue cargando (la trampa de helmet/CORP) ═══════════
  console.log("T004 — el sitio sigue cargando el catálogo con helmet puesto");
  await recargar(sessionId, "/agendar", 3000);

  const catalogo = await evaluar("({ cargado: catalogoServiciosCargado, cantidad: catalogoServicios.length })", sessionId);
  comprobar("el catálogo de servicios carga desde el API", catalogo.cargado === true, `${catalogo.cantidad} servicios`);

  const avisoCatalogo = await evaluar(
    `(document.querySelector("#scheduleAlert")?.textContent || "").includes("No pudimos cargar la lista")`,
    sessionId,
  );
  comprobar("#/agendar NO muestra el aviso de catálogo caído", avisoCatalogo === false);

  // ══ B4 — orígenes ═════════════════════════════════════════════════════════
  console.log("\nB4 — orígenes declarados y sin terceros");
  const rutas = ["/", "/servicios", "/tarifas", "/faq", "/agendar", "/contacto", "/admin"];
  for (const ruta of rutas) await ir(sessionId, ruta, 700);

  comprobar("cero peticiones a cdn.tailwindcss.com", !peticiones.some((u) => u.includes("cdn.tailwindcss.com")));
  const violaciones = violacionesDePolitica();
  comprobar("las siete rutas sin violaciones de política", violaciones.length === 0, violaciones.slice(0, 2).join(" | "));

  const tailwindLocal = peticiones.filter((u) => u.includes("assets/vendor/tailwind"));
  comprobar("Tailwind se sirve desde el propio sitio", tailwindLocal.length >= 2, `${tailwindLocal.length} archivos`);

  // La política bloquea un onerror inyectado (la segunda barrera de US2).
  const inyeccion = await evaluar(
    `(() => { window.__ejecuto = false;
      const d = document.createElement("div");
      d.innerHTML = '<img src="x" onerror="window.__ejecuto = true">';
      document.body.appendChild(d);
      return new Promise(r => setTimeout(() => r(window.__ejecuto), 400)); })()`,
    sessionId,
  );
  comprobar("la política bloquea un onerror inyectado por innerHTML", inyeccion === false);

  // ══ B1 — la puerta del panel ══════════════════════════════════════════════
  console.log("\nB1 — la puerta del panel, las seis condiciones");

  await recargar(sessionId, "/admin", 2000);
  const sinCredencial = await evaluar(
    `({ estado: sesionAdmin.estado, hayTabla: !!document.querySelector(".admin-content table"),
        pidePass: !!document.querySelector('input[type=password]'),
        texto: document.body.innerText.slice(0, 400) })`,
    sessionId,
  );
  comprobar("1. sin credencial: no hay ninguna tabla de datos", sinCredencial.hayTabla === false);
  comprobar("1. sin credencial: pide la credencial", sinCredencial.pidePass === true);

  // Credencial incorrecta.
  await evaluar(
    `(async () => { const i = document.querySelector('input[type=password]'); i.value = "credencial-incorrecta-larga";
      document.querySelector('#adminLoginForm')?.dispatchEvent(new Event('submit', {bubbles:true, cancelable:true}));
      })()`,
    sessionId,
  );
  await dormir(1500);
  const incorrecta = await evaluar(
    `({ estado: sesionAdmin.estado, hayTabla: !!document.querySelector(".admin-content table"),
        aviso: document.querySelector('.form-alert')?.textContent || "" })`,
    sessionId,
  );
  comprobar("2. credencial incorrecta: no abre", incorrecta.hayTabla === false && incorrecta.estado === "sin-credencial");
  comprobar("2. el aviso no revela nada de la credencial esperada",
    !/\d{2,}|longitud|caracteres|hex/i.test(incorrecta.aviso), incorrecta.aviso.slice(0, 90));

  // Credencial correcta.
  await evaluar(
    `(async () => { const i = document.querySelector('input[type=password]'); i.value = ${JSON.stringify(TOKEN)};
      document.querySelector('#adminLoginForm')?.dispatchEvent(new Event('submit', {bubbles:true, cancelable:true}));
      })()`,
    sessionId,
  );
  await dormir(2000);
  const correcta = await evaluar(
    `({ estado: sesionAdmin.estado, hayTabla: !!document.querySelector(".admin-content table"),
        enSession: !!sessionStorage.getItem("adminToken"), enLocal: !!localStorage.getItem("adminToken"),
        url: location.href })`,
    sessionId,
  );
  comprobar("3. credencial correcta: el panel abre", correcta.estado === "verificada" && correcta.hayTabla === true);
  comprobar("3. la credencial está en sessionStorage y NO en localStorage",
    correcta.enSession === true && correcta.enLocal === false);
  comprobar("3. la credencial no aparece en la barra de direcciones", !correcta.url.includes(TOKEN));

  // Navegar entre secciones sin volver a pedirla.
  await ir(sessionId, "/admin/vehiculos", 900);
  await ir(sessionId, "/admin/reportes", 900);
  const navegando = await evaluar(`({ estado: sesionAdmin.estado, hayContenido: !!document.querySelector(".admin-content") })`, sessionId);
  comprobar("3. navegar entre secciones no vuelve a pedir credencial", navegando.estado === "verificada");

  // ══ B2 — datos hostiles se ven como texto ═════════════════════════════════
  console.log("\nB2 — lo que escribe un cliente no se ejecuta");
  const HOSTILES = [
    '<img src=x onerror=window.__xss=1>',
    '" autofocus onfocus="window.__xss=1',
    '<script>window.__xss=1<\\/script>',
    "'><svg onload=window.__xss=1>",
    "Juan & María O'Brien",
  ];
  await evaluar(
    `(() => { window.__xss = false;
      localStorage.setItem("appointments", JSON.stringify([{
        id: "CDA-000001", clientName: ${JSON.stringify(HOSTILES[0])}, phone: ${JSON.stringify(HOSTILES[1])},
        email: "", cedula: "", plate: ${JSON.stringify(HOSTILES[3])}, vehicle: "Motos 4T",
        service: ${JSON.stringify(HOSTILES[2])}, date: "2026-08-10", time: "09:00",
        payment: "Por confirmar", status: ${JSON.stringify(HOSTILES[4])}
      }])); })()`,
    sessionId,
  );
  await ir(sessionId, "/admin", 1200);
  await dormir(600);

  const panelHostil = await evaluar(
    `({ xss: window.__xss === true,
        etiquetasInyectadas: document.querySelectorAll(".admin-content img, .admin-content svg, .admin-content script").length,
        texto: document.querySelector(".admin-content table")?.innerText || "" })`,
    sessionId,
  );
  comprobar("los cinco valores hostiles NO ejecutan nada", panelHostil.xss === false);
  comprobar("no se inyectó ninguna etiqueta en el panel", panelHostil.etiquetasInyectadas === 0);
  comprobar("el valor hostil se ve como texto literal", panelHostil.texto.includes("onerror"));
  comprobar("sin doble escape: se lee «Juan & María O'Brien»",
    panelHostil.texto.includes("Juan & María O'Brien") && !panelHostil.texto.includes("&amp;"));

  // ══ B6 — datos corruptos no tumban el panel ═══════════════════════════════
  console.log("\nB6 — higiene");
  await evaluar(`localStorage.setItem("appointments", "esto no es json")`, sessionId);
  await ir(sessionId, "/admin", 1200);
  const corrupto = await evaluar(
    `({ estado: sesionAdmin.estado, hayContenido: !!document.querySelector(".admin-content") })`, sessionId);
  comprobar("el panel abre igual con localStorage corrupto", corrupto.hayContenido === true);
  await evaluar(`localStorage.removeItem("appointments")`, sessionId);

  // Rutas parecidas no abren el panel.
  await ir(sessionId, "/administracion", 900);
  const falsaRuta = await evaluar(`!!document.querySelector(".admin-content")`, sessionId);
  comprobar("#/administracion NO abre el panel", falsaRuta === false);

  // Fecha mínima.
  await ir(sessionId, "/agendar", 900);
  const hoy = await evaluar(
    `(() => { const d = new Date(); const m = String(d.getMonth()+1).padStart(2,"0");
      const dd = String(d.getDate()).padStart(2,"0"); return d.getFullYear()+"-"+m+"-"+dd; })()`, sessionId);
  await ir(sessionId, "/", 900);
  const minFecha = await evaluar(`document.querySelector("#quickDate")?.getAttribute("min")`, sessionId);
  comprobar("el campo de fecha no acepta días pasados", minFecha === hoy, `min=${minFecha}`);

  // Enlace de WhatsApp.
  const rel = await evaluar(`document.querySelector(".whatsapp-float")?.getAttribute("rel")`, sessionId);
  comprobar("el enlace de WhatsApp lleva noopener noreferrer", rel === "noopener noreferrer");

  // Mapa con sandbox.
  await ir(sessionId, "/contacto", 1200);
  const sandbox = await evaluar(`document.querySelector(".map-frame iframe")?.getAttribute("sandbox")`, sessionId);
  comprobar("el iframe de Maps tiene sandbox", typeof sandbox === "string" && sandbox.includes("allow-scripts"));

  // ══ B3 — el formulario de contacto ════════════════════════════════════════
  console.log("\nB3 — los mensajes llegan de verdad");
  const marca = `prueba-verificacion-${Date.now()}`;
  await evaluar(
    `(async () => {
       document.querySelector("#contactName").value = "Prueba Verificacion";
       document.querySelector("#contactEmail").value = "prueba@ejemplo.test";
       document.querySelector("#contactMessage").value = ${JSON.stringify(marca)};
       document.querySelector("#contactForm").dispatchEvent(new Event("submit", {bubbles:true, cancelable:true}));
     })()`,
    sessionId,
  );
  await dormir(2500);
  const enviado = await evaluar(`!!document.querySelector(".success-box")`, sessionId);
  comprobar("con el API arriba: confirma el envío", enviado === true);

  const enServidor = await fetch("http://localhost:3000/api/mensajes", {
    headers: { Authorization: `Bearer ${TOKEN}` },
  }).then((r) => r.json());
  comprobar("el mensaje llegó DE VERDAD al servidor",
    Array.isArray(enServidor) && enServidor.some((m) => m.message === marca),
    `${enServidor.length} mensajes en el servidor`);

  await enviar("Target.closeTarget", { targetId });
  limpiar();

  // ── Resumen ────────────────────────────────────────────────────────────────
  const fallidas = resultados.filter((r) => !r.ok);
  console.log(`\n${"═".repeat(60)}`);
  console.log(`${resultados.length - fallidas.length}/${resultados.length} comprobaciones en verde`);
  if (fallidas.length) {
    console.log("\nFALLARON:");
    fallidas.forEach((f) => console.log(`  - ${f.nombre} ${f.detalle}`));
  }
  process.exit(fallidas.length ? 1 : 0);
})().catch((error) => {
  console.error("\nEl guion se cortó:", error.message);
  process.exit(1);
});
