// Puerta del panel de administración: pantalla de credencial y pantalla de espera.
//
// El panel muestra datos personales de clientes reales, así que esto es lo único
// que se ve mientras la sesión no esté verificada contra el servidor. Ni una fila
// de datos, ni un conteo, ni un "mientras tanto": el estado de la sesión vive en
// utils.js (sesionAdmin) y solo `verificada` deja pasar.

// Textos visibles de cada motivo de fallo. Están acá y no en utils.js porque son
// copia de la pantalla, no lógica de la sesión.
//
// NINGUNO revela nada sobre la credencial esperada (FR-005): ni el largo, ni el
// formato, ni si el usuario "casi" acertó. Quien intenta adivinarla no aprende
// nada de estos mensajes.
const MENSAJES_SESION_ADMIN = {
  "credencial-incorrecta": "La credencial no es correcta. Vuelve a intentarlo.",
  "demasiados-intentos": "Demasiados intentos seguidos. Espera unos minutos antes de volver a intentar.",
  "servidor-sin-credencial":
    "El panel no está disponible: el servidor no tiene configurada la autenticación. Avísale a quien administra el sistema.",
  "sin-respuesta":
    "No pudimos verificar tu credencial con el servidor. Revisa tu conexión e inténtalo de nuevo: si no se puede verificar, el panel no abre.",
  // Todavía no se intentó nada (primera visita o sesión recién cerrada): no hay
  // nada que explicar y el aviso queda oculto.
  "falta-credencial": "",
};

function adminLoginPage(estado = sesionAdmin) {
  const hayCredencialGuardada = Boolean(credencialAdminGuardada());
  // El botón de reintentar solo tiene sentido si quedó una credencial guardada en
  // la pestaña y el fallo NO fue que el servidor la rechazara: sirve para el API
  // caído o la demora, donde reintentar es exactamente lo que hace falta.
  const puedeReintentar = hayCredencialGuardada && estado && estado.motivo !== "credencial-incorrecta";

  return `
    <section class="section">
      <div class="form-shell">
        <div class="title-block">
          <p class="eyebrow">Acceso restringido</p>
          <h2>Panel de administración</h2>
          <p>Esta zona muestra datos personales de los clientes del CDA. Ingresa tu credencial para continuar.</p>
        </div>
        <div class="form-card">
          <form id="adminLoginForm" class="form-grid" autocomplete="off">
            <div class="field full">
              <label for="adminCredencial">Credencial de administración</label>
              <input
                id="adminCredencial"
                name="credencial"
                type="password"
                autocomplete="off"
                placeholder="Escribe tu credencial"
                required
              >
            </div>
            <p class="form-alert" id="adminLoginAlert" role="alert" hidden></p>
            <div class="field full button-row">
              <button class="button secondary" type="submit">Entrar al panel</button>
              ${puedeReintentar ? `<button class="button ghost" type="button" data-reintentar-sesion>Reintentar</button>` : ""}
              <a class="button ghost" href="#/">Volver al inicio</a>
            </div>
          </form>
        </div>
      </div>
    </section>
  `;
}

// Pantalla de espera mientras el servidor responde. No muestra NI UN dato: hasta
// que la verificación termine, esta pantalla y la de credencial son lo mismo en
// términos de lo que dejan ver.
function adminVerificandoPage() {
  return `
    <section class="section">
      <div class="form-shell">
        <div class="title-block">
          <p class="eyebrow">Acceso restringido</p>
          <h2>Verificando tu credencial…</h2>
          <p>Estamos comprobando tu credencial con el servidor. Esto toma unos segundos.</p>
        </div>
      </div>
    </section>
  `;
}

// El mensaje se escribe con textContent y NO se interpola en el HTML, igual que
// mostrarAvisoAgendamiento() en pages/schedule.js.
function mostrarAvisoSesionAdmin(mensaje) {
  const aviso = document.querySelector("#adminLoginAlert");
  if (!aviso) return;
  aviso.textContent = mensaje;
  aviso.hidden = !mensaje;
}

function bindAdminLogin() {
  mostrarAvisoSesionAdmin(MENSAJES_SESION_ADMIN[sesionAdmin.motivo] || "");

  const campo = document.querySelector("#adminCredencial");
  if (campo) campo.focus();

  // Verifica contra el servidor y redibuja. render() es síncrono y no puede
  // esperar, así que la espera vive acá: se marca "verificando", se dibuja esa
  // pantalla, y cuando el API contesta se vuelve a llamar a render(). Es el mismo
  // patrón que [data-reintentar-catalogo] en pages/schedule.js.
  const verificarYRedibujar = async (credencial) => {
    marcarSesionAdminVerificando();
    render();
    await verificarCredencialAdmin(credencial);
    render();
  };

  const form = document.querySelector("#adminLoginForm");
  if (form) {
    form.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      const credencial = campo ? campo.value.trim() : "";
      if (!credencial) {
        mostrarAvisoSesionAdmin("Escribe tu credencial para continuar.");
        return;
      }
      await verificarYRedibujar(credencial);
    });
  }

  // Reintentar con la credencial que ya está guardada en la pestaña, sin volver a
  // escribirla: sirve cuando el fallo fue del servidor o de la red.
  document.querySelectorAll("[data-reintentar-sesion]").forEach((boton) => {
    boton.addEventListener("click", async () => {
      boton.disabled = true;
      boton.textContent = "Reintentando…";
      await verificarYRedibujar();
    });
  });
}
