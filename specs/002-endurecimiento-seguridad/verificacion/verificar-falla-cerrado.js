// Verificación del FALLO CERRADO (principio II, NO NEGOCIABLE).
//
// Lo que prueba: que con el API caído el panel NO abre aunque la credencial sea
// correcta y ya esté guardada, que el formulario de contacto no miente, y que la
// sección Mensajes distingue "no pudimos preguntar" de "no hay mensajes".
//
// Uso: node verificar-falla-cerrado.js <ADMIN_TOKEN>

const { spawn, execSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const TOKEN = process.argv[2];
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PUERTO = 9334;
const SITIO = "http://localhost:5173";
const RAIZ = "c:\\Users\\diego\\Downloads\\web2\\webCDA_modificado";

const resultados = [];
function comprobar(nombre, ok, detalle = "") {
  resultados.push({ nombre, ok, detalle });
  console.log(`${ok ? "  OK  " : " FALLA"}  ${nombre}${detalle ? ` — ${detalle}` : ""}`);
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Control del API ──────────────────────────────────────────────────────────
function apagarApi() {
  try {
    execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { taskkill /PID $($_.OwningProcess) /T /F }"`,
      { stdio: "ignore" },
    );
  } catch {}
}

async function apiVivo() {
  try {
    const r = await fetch("http://localhost:3000/api/health", { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch { return false; }
}

async function esperarApi(quieroVivo, maxMs = 30000) {
  const hasta = Date.now() + maxMs;
  while (Date.now() < hasta) {
    if ((await apiVivo()) === quieroVivo) return true;
    await dormir(500);
  }
  return false;
}

// ── Protocolo DevTools ───────────────────────────────────────────────────────
let ws = null, siguienteId = 1;
const pendientes = new Map();

function enviar(metodo, params = {}, sessionId) {
  const id = siguienteId++;
  ws.send(JSON.stringify(sessionId ? { id, method: metodo, params, sessionId } : { id, method: metodo, params }));
  return new Promise((resolve, reject) => {
    pendientes.set(id, { resolve, reject });
    setTimeout(() => { if (pendientes.delete(id)) reject(new Error(`sin respuesta de ${metodo}`)); }, 25000);
  });
}

async function conectar(url) {
  ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const d = JSON.parse(ev.data);
    if (d.id && pendientes.has(d.id)) {
      const { resolve, reject } = pendientes.get(d.id);
      pendientes.delete(d.id);
      d.error ? reject(new Error(JSON.stringify(d.error))) : resolve(d.result);
    }
  };
}

async function evaluar(expr, sid) {
  const r = await enviar("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sid);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "excepción");
  return r.result.value;
}
const ir = async (sid, ruta, ms = 1200) => { await evaluar(`location.hash=${JSON.stringify(ruta)}`, sid); await dormir(ms); };

// RECARGA DE VERDAD. `Page.navigate` a una URL que solo difiere en el fragmento
// hace una navegación en la MISMA página: no vuelve a evaluar los scripts y el
// estado en memoria sobrevive. Para probar que la credencial se revalida en cada
// carga hace falta un reload real, que es lo que hace un F5.
const recargar = async (sid, ruta, ms = 2500) => {
  await enviar("Page.navigate", { url: `${SITIO}/#${ruta}` }, sid);
  await dormir(200);
  await enviar("Page.reload", { ignoreCache: true }, sid);
  await dormir(ms);
};

// Espera a que aparezca un selector. Con el API caído, iniciar() aguanta hasta 6 s
// pidiendo el catálogo antes del primer render, así que los elementos tardan.
async function esperarSelector(sid, selector, maxMs = 20000) {
  const hasta = Date.now() + maxMs;
  while (Date.now() < hasta) {
    if (await evaluar(`!!document.querySelector(${JSON.stringify(selector)})`, sid)) return true;
    await dormir(400);
  }
  return false;
}

// Escribe la credencial y envía el formulario. Espera a que el campo exista.
async function iniciarSesion(sid, token) {
  for (let i = 0; i < 30; i += 1) {
    const hay = await evaluar(`!!document.querySelector('input[type=password]')`, sid);
    if (hay) break;
    await dormir(400);
  }
  await evaluar(
    `(() => { const i = document.querySelector('input[type=password]'); if (!i) return false;
       i.value = ${JSON.stringify(token)};
       document.querySelector('#adminLoginForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
       return true; })()`,
    sid,
  );
  await dormir(2500);
}

// ── Guion ────────────────────────────────────────────────────────────────────
(async () => {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "cdafc-"));
  const chrome = spawn(CHROME, [
    "--headless=new", `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`,
    "--no-first-run", "--no-default-browser-check", "--disable-gpu", "about:blank",
  ]);
  const limpiar = () => { try { chrome.kill("SIGKILL"); } catch {} };
  process.on("exit", limpiar);

  let version = null;
  for (let i = 0; i < 40 && !version; i += 1) {
    try { version = await (await fetch(`http://127.0.0.1:${PUERTO}/json/version`)).json(); } catch { await dormir(400); }
  }
  console.log(`\nNavegador: ${version.Browser}\n`);

  await conectar(version.webSocketDebuggerUrl);
  const { targetId } = await enviar("Target.createTarget", { url: "about:blank" });
  const { sessionId: sid } = await enviar("Target.attachToTarget", { targetId, flatten: true });
  await enviar("Page.enable", {}, sid);
  await enviar("Runtime.enable", {}, sid);

  // ══ Preparación: entrar al panel con el API arriba ════════════════════════
  console.log("Preparación — entrar al panel con el API arriba");
  if (!(await apiVivo())) { console.error("El API no está arriba; arrancalo antes."); process.exit(1); }

  await recargar(sid, "/admin", 3000);
  await iniciarSesion(sid, TOKEN);
  const abierto = await evaluar(`({e: sesionAdmin.estado, t: !!document.querySelector('.admin-content table')})`, sid);
  comprobar("preparación: el panel abrió con la credencial correcta", abierto.e === "verificada" && abierto.t === true);

  // ══ 4. API APAGADO — el panel NO puede abrir ══════════════════════════════
  console.log("\n4. API apagado, credencial correcta y ya guardada");
  apagarApi();
  const cayo = await esperarApi(false, 20000);
  comprobar("el API quedó efectivamente apagado", cayo === true);

  await recargar(sid, "/admin", 9000); // margen para el corte de 6 s
  const conApiCaido = await evaluar(
    `({ estado: sesionAdmin.estado,
        hayTabla: !!document.querySelector('.admin-content table'),
        hayContenidoAdmin: !!document.querySelector('.admin-content'),
        pidePass: !!document.querySelector('input[type=password]'),
        credencialSigue: !!sessionStorage.getItem('adminToken'),
        texto: document.body.innerText.replace(/\\s+/g,' ').slice(0, 220) })`,
    sid,
  );
  comprobar("4. con el API caído el panel NO abre", conApiCaido.hayTabla === false && conApiCaido.hayContenidoAdmin === false);
  comprobar("4. no muestra NINGÚN dato personal", !/CDA-\d|@/.test(conApiCaido.texto));
  comprobar("4. explica que no se pudo verificar", conApiCaido.pidePass === true, conApiCaido.texto.slice(0, 110));
  comprobar("4. recargar NO reutiliza la credencial guardada como si fuera válida",
    conApiCaido.estado === "sin-credencial");

  // Reintentar con el API caído tampoco abre.
  await evaluar(
    `(() => { const i = document.querySelector('input[type=password]'); if (!i) return;
       i.value = ${JSON.stringify(TOKEN)};
       document.querySelector('#adminLoginForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); })()`,
    sid,
  );
  await dormir(8000);
  const reintento = await evaluar(`({t: !!document.querySelector('.admin-content table'), e: sesionAdmin.estado})`, sid);
  comprobar("4. reintentar con la credencial correcta tampoco abre", reintento.t === false);

  // ══ Contacto con el API caído — no puede mentir ═══════════════════════════
  console.log("\nB3.3 — el formulario de contacto con el API caído");
  await recargar(sid, "/contacto", 2500);
  const hayForm = await esperarSelector(sid, "#contactForm");
  comprobar("la página de contacto carga aunque el API esté caído", hayForm === true);
  const TEXTO = "mensaje que no se debe perder al fallar el envio";
  await evaluar(
    `(() => { document.querySelector('#contactName').value = 'Prueba Caida';
       document.querySelector('#contactEmail').value = 'caida@ejemplo.test';
       document.querySelector('#contactMessage').value = ${JSON.stringify(TEXTO)};
       document.querySelector('#contactForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})); })()`,
    sid,
  );
  await dormir(9000);
  const contacto = await evaluar(
    `({ dijoEnviado: !!document.querySelector('.success-box'),
        aviso: document.querySelector('#contactAlertTexto')?.textContent || '',
        textoConservado: document.querySelector('#contactMessage')?.value || '',
        botonActivo: !document.querySelector('#contactForm button[type=submit]')?.disabled,
        hayWhatsapp: !!document.querySelector('#contactAlert a[href*="wa.me"]') })`,
    sid,
  );
  comprobar("NO dice «¡Mensaje Enviado!» cuando no se envió", contacto.dijoEnviado === false);
  comprobar("avisa del fallo en español", contacto.aviso.length > 0, contacto.aviso.slice(0, 95));
  comprobar("conserva lo que la persona escribió", contacto.textoConservado === TEXTO);
  comprobar("ofrece WhatsApp como alternativa", contacto.hayWhatsapp === true);
  comprobar("vuelve a habilitar el botón para reintentar", contacto.botonActivo === true);

  // ══ API de vuelta: Mensajes con el API caído a mitad de sesión ════════════
  console.log("\nT021 — la sección Mensajes distingue «no pudimos preguntar» de «no hay»");
  const api = spawn("npm", ["run", "dev"], { cwd: path.join(RAIZ, "Backend"), shell: true, stdio: "ignore", detached: false });
  const volvio = await esperarApi(true, 40000);
  comprobar("el API volvió a levantarse", volvio === true);

  await recargar(sid, "/admin", 3000);
  await iniciarSesion(sid, TOKEN);
  await ir(sid, "/admin/mensajes", 3000);
  const conApi = await evaluar(`({ hayTabla: !!document.querySelector('.admin-content table'), estado: mensajesAdmin.estado })`, sid);
  comprobar("con el API arriba, Mensajes muestra la tabla", conApi.hayTabla === true && conApi.estado === "listo");

  // Ahora se cae el API con la sesión abierta.
  apagarApi();
  await esperarApi(false, 20000);
  await ir(sid, "/", 1200);            // salir del panel del todo
  await ir(sid, "/admin", 1200);       // Reservas vive en /admin, no en /admin/reservas
  await ir(sid, "/admin/mensajes", 3000);
  await esperarSelector(sid, ".admin-content", 15000);
  await dormir(8000);
  const mensajesCaido = await evaluar(
    `({ hayTabla: !!document.querySelector('.admin-content table'),
        hayAviso: !!document.querySelector('.admin-content .form-alert'),
        hayReintentar: !!document.querySelector('[data-reintentar-mensajes]'),
        texto: document.querySelector('.admin-content')?.innerText.replace(/\\s+/g,' ').slice(0,200) || '' })`,
    sid,
  );
  comprobar("Mensajes NO muestra una tabla vacía como si no hubiera mensajes", mensajesCaido.hayTabla === false);
  comprobar("Mensajes explica que no se pudieron consultar", mensajesCaido.hayAviso === true, mensajesCaido.texto.slice(0, 110));
  comprobar("ofrece reintentar", mensajesCaido.hayReintentar === true);

  // Las otras secciones siguen funcionando con el API caído.
  await evaluar(
    `localStorage.setItem("appointments", JSON.stringify([{id:"CDA-777777",clientName:"Ana Perez",phone:"3000000000",
       email:"",cedula:"",plate:"ABC123",vehicle:"Motos 4T",service:"Revisión de Gases",date:"2026-08-20",
       time:"09:00",payment:"Efectivo",status:"pendiente"}]))`,
    sid,
  );
  await ir(sid, "/admin/vehiculos", 1500);
  const otraSeccion = await evaluar(
    `({ hayTabla: !!document.querySelector('.admin-content table'), texto: document.querySelector('.admin-content')?.innerText || '' })`,
    sid,
  );
  comprobar("Reservas/Vehiculos siguen funcionando con el API caido",
    otraSeccion.hayTabla === true && otraSeccion.texto.includes("ABC123"));
  await evaluar(`localStorage.removeItem("appointments")`, sid);

  // ══ 6. Cerrar sesión ══════════════════════════════════════════════════════
  console.log("\n6. cerrar sesión");
  const hayBoton = await evaluar(`!!document.querySelector('[data-cerrar-sesion-admin]')`, sid);
  if (hayBoton) {
    await evaluar(`document.querySelector('[data-cerrar-sesion-admin]').click()`, sid);
    await dormir(1500);
  }
  const cerrada = await evaluar(
    `({ credencial: sessionStorage.getItem('adminToken'), pidePass: !!document.querySelector('input[type=password]'),
        hayTabla: !!document.querySelector('.admin-content table') })`,
    sid,
  );
  comprobar("cerrar sesión descarta la credencial", cerrada.credencial === null);
  comprobar("cerrar sesión vuelve a pedir credencial", cerrada.pidePass === true && cerrada.hayTabla === false);

  await enviar("Target.closeTarget", { targetId });
  limpiar();

  const fallidas = resultados.filter((r) => !r.ok);
  console.log(`\n${"═".repeat(62)}`);
  console.log(`${resultados.length - fallidas.length}/${resultados.length} comprobaciones en verde`);
  if (fallidas.length) { console.log("\nFALLARON:"); fallidas.forEach((f) => console.log(`  - ${f.nombre} ${f.detalle}`)); }
  process.exit(fallidas.length ? 1 : 0);
})().catch((e) => { console.error("\nEl guion se cortó:", e.message); process.exit(1); });
