# Verificación — Endurecimiento de seguridad (ronda 1)

Guion de validación de punta a punta. **Ninguna tarea se declara terminada sin haber corrido
la parte que le toca** (principio IV: está prohibido reportar como terminado algo que solo se
leyó).

## Antes de empezar

Hacen falta **los dos procesos**:

```bash
cd Backend && npm run dev      # API en http://localhost:3000/api
node Frontend/server.js        # sitio en http://localhost:5173
```

`Backend/.env` con un `ADMIN_TOKEN` real (no el de la plantilla). Tenelo a mano: hace falta
para la mitad de las pruebas.

---

## A — Backend automatizado

```bash
cd Backend
npx tsc --noEmit     # sin errores
npm test             # todo verde
```

### A1 · La prueba que protege el guard (FR-030) — **hay que verla fallar**

Una prueba de regresión que nunca se vio en rojo es una suposición, no una prueba:

1. Comentá `autenticacionAdmin` en `Backend/src/rutas/mensajes.ts` (el `router.get("/")`).
2. `npm test` → **tiene que fallar**.
3. Devolvelo y `npm test` → verde otra vez.

Si en el paso 2 pasa en verde, la prueba no sirve y hay que arreglarla antes de seguir.

### A2 · Fallo cerrado de configuración (FR-025, FR-026)

| Qué se prueba | Cómo | Esperado |
|---|---|---|
| Sin credencial | `ADMIN_TOKEN=` vacío en `.env`, arrancar | Avisa al arrancar; `GET /api/admin/sesion` → **503** |
| Credencial de ejemplo | `ADMIN_TOKEN=cambiar-por-un-token-largo-y-aleatorio` | **503 igual**, aunque supere los 16 caracteres |
| Sin origen permitido | `CORS_ORIGIN` sin definir | Lo informa al arrancar; **no** asume el valor de desarrollo en silencio |

### A3 · Límite de peticiones (FR-019, FR-020)

```bash
# Contacto: pasadas ~20 en 15 min, empieza el 429
for i in $(seq 1 25); do curl -s -o /dev/null -w "%{http_code} " \
  -X POST http://localhost:3000/api/mensajes \
  -H "Content-Type: application/json" \
  -d '{"name":"Prueba","email":"p@p.com","message":"mensaje de prueba"}'; done; echo

# Credencial: a los ~10 fallos, 429
for i in $(seq 1 15); do curl -s -o /dev/null -w "%{http_code} " \
  http://localhost:3000/api/admin/sesion -H "Authorization: Bearer incorrecto"; done; echo
```

Después del segundo bucle, **la credencial correcta tiene que seguir funcionando** una vez que
pase la ventana. Y con la credencial correcta, muchas peticiones seguidas **no** deben
bloquear: solo se cuentan los fallos.

### A4 · Registro sin datos personales (FR-027, FR-028)

Enviá un mensaje de contacto y listá los mensajes con credencial. Después mirá la salida del
API: cada línea debe traer fecha, método, ruta, estado y duración, y **ni un solo** nombre,
correo, texto de mensaje, credencial, cadena de consulta ni dirección de red.

### A5 · Cabeceras (FR-023)

```bash
curl -s -D - -o /dev/null http://localhost:3000/api/health
```

Presentes: `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Cross-Origin-Resource-Policy:
cross-origin`. **Ausente**: `X-Powered-By`.

> Si `Cross-Origin-Resource-Policy` dice `same-origin`, el sitio está roto aunque parezca que
> carga: es la trampa de D5. El síntoma es que el agendamiento no consigue el catálogo.

---

## B — Frontend en el navegador

**No hay atajo.** El frontend no tiene compilación ni pruebas: solo el navegador dice la
verdad. Con los dos procesos arriba, en `http://localhost:5173`, con la consola abierta.

### B1 · La puerta del panel (Historia 1) — las seis condiciones

| # | Situación | Esperado |
|---|---|---|
| 1 | `#/admin` sin credencial | Pide credencial. **Cero** datos de clientes en pantalla |
| 2 | Credencial incorrecta | No abre. Explica el fallo sin pistas sobre la correcta |
| 3 | Credencial correcta | Abre. Navegar entre las cuatro secciones no la vuelve a pedir |
| 4 | **API apagado** (`Ctrl+C` en el backend), credencial correcta | **NO abre.** Explica que no se pudo verificar |
| 5 | API con `ADMIN_TOKEN` vacío | **NO abre** |
| 6 | Cerrar sesión, y también cerrar y reabrir la pestaña | Vuelve a pedir credencial |

Además: con el panel abierto, **recargar la página (F5)** debe revalidar contra el servidor —
si el API está caído en ese momento, el panel **no** vuelve a abrir.

Y en `Application → Session Storage` / `Local Storage`: la credencial está en **session**,
nunca en **local**, y **nunca** aparece en la barra de direcciones.

### B2 · Lo que escribe un cliente no se ejecuta (Historia 2)

Agendá una cita —y mandá un mensaje de contacto— poniendo en **nombre**, **placa** y **texto**
cada uno de estos valores:

```
<img src=x onerror=alert(1)>
" autofocus onfocus="alert(1)
<script>alert(1)</script>
'><svg onload=alert(1)>
Juan & María O'Brien
```

En el panel, los cinco tienen que verse **como texto literal**. Cero ventanas emergentes, cero
`&amp;` o `&#39;` visibles en pantalla (el último caso es el que detecta escape doble).

El segundo valor es el importante para el paso 1 del agendamiento: volvé atrás y comprobá que
el campo conserva el texto completo y el formulario no se rompió.

### B3 · Los mensajes llegan de verdad (Historia 3)

1. Enviá un mensaje de contacto → confirmación.
2. Abrí el panel **en otro navegador** (o ventana privada), sección Mensajes, con credencial →
   **el mensaje está ahí**. Eso prueba que salió del navegador de origen.
3. **Apagá el API** y enviá otro mensaje → avisa que **no** se pudo enviar, ofrece otra vía de
   contacto y **conserva lo escrito**. Nunca dice "¡Mensaje Enviado!".
4. Navegador nuevo (o `localStorage` limpio) → en `Application` **no** aparece ninguna clave
   `messages` con datos de ejemplo.

### B4 · Orígenes declarados (Historia 4)

1. Recorré las **siete** rutas: `#/`, `#/servicios`, `#/tarifas`, `#/faq`, `#/agendar`,
   `#/contacto`, `#/admin`. Consola **sin una sola violación de política** y sin recursos
   bloqueados.
2. En la pestaña de red, filtrando por dominio: **ninguna petición a `cdn.tailwindcss.com`**.
3. **`#/servicios` idéntica a antes.** Es la única página que usa Tailwind: si algo se rompió,
   se rompió acá. Compará contra la versión anterior antes de commitear.
4. Si la consola se queja del bloque `application/ld+json`, aplicá su hash en `script-src`
   (D3). **No aflojar la política.**

### B5 · El servidor del sitio aguanta (FR-021, FR-022)

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5173/%"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5173/../Backend/.env"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5173/server.js"
```

Los tres tienen que dar error (400/403/404) y —lo que importa— **el proceso tiene que seguir
vivo**: `http://localhost:5173` carga normal después de los tres. El primero es el que hoy mata
el servidor.

### B6 · Higiene

- Panel abre con `localStorage.setItem("appointments", "no es json")` puesto a mano: explica
  qué sección no pudo mostrar, **no se cae entero**.
- Fecha del agendamiento: no deja elegir días pasados.
- `#/administracion` **no** abre el panel.
- El `?v=` de `index.html` subió a 13 en **todos** los recursos.

---

## Definición de terminado

- [ ] A: `tsc --noEmit` limpio y `npm test` verde, **con A1 verificado a mano** (se vio fallar)
- [ ] B1: las seis condiciones de la puerta, más la revalidación al recargar
- [ ] B2: los cinco valores hostiles se ven como texto en las tres vistas del panel
- [ ] B3: mensaje visible desde otro navegador; con el API caído no se miente
- [ ] B4: siete rutas sin violaciones, cero peticiones al CDN, `#/servicios` intacta
- [ ] B5: los tres casos dan error y el servidor sigue vivo
- [ ] B6: higiene y `?v=` subido
