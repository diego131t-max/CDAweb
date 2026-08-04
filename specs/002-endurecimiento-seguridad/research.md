# Investigación — Endurecimiento de seguridad (ronda 1)

**Fecha**: 2026-08-04 · **Feature**: `002-endurecimiento-seguridad`

Decisiones técnicas tomadas antes de escribir código. Cada una resuelve una incógnita del
Technical Context del plan.

---

## D1 — Una sola función de escape, no dos

**Decisión**: una única `escaparHtml(valor)` que reemplaza `& < > " '` por sus entidades, más
la regla de que **todo atributo se escribe entre comillas dobles**.

**Razón**: escapar esos cinco caracteres es suficiente para los dos contextos que usa la SPA
—texto entre etiquetas y valor de atributo entrecomillado— siempre que el atributo esté
entrecomillado. Dos funciones distintas obligan a acertar cuál usar en cada punto de
interpolación, y **equivocarse es silencioso**. Una sola función se aplica sin pensar.

**Alternativas descartadas**:

- *`escaparHtml` + `escaparAtributo` separadas* (lo que proponía el borrador del plan):
  complejidad sin beneficio, con un modo de fallo callado.
- *Reescribir todo con `createElement`/`textContent`*: correcto pero es reescribir el
  frontend entero; el sitio se construye con plantillas de texto por diseño.
- *`DOMPurify`*: es una dependencia con build, prohibida por las Restricciones Técnicas de la
  constitución.

**Límite que hay que respetar**: escapar **no** sirve para valores que van dentro de un
`href`/`src` (un `javascript:` escapado sigue siendo `javascript:`) ni dentro de un `<script>`
o de un atributo sin comillas. Hoy ningún dato externo llega a esos contextos, y la política
de contenido (D3) los bloquea de todos modos. Queda escrito para que nadie lo asuma resuelto.

---

## D2 — Vendorizar el script de Tailwind

**Decisión**: descargar el script del CDN a `Frontend/assets/vendor/tailwind.js`, servirlo
desde el propio sitio, y mover la configuración que hoy está en línea a
`Frontend/assets/vendor/tailwind-config.js`.

**Razón**: `pages/services.js` es el **único** consumidor (unas 50 clases de utilidad); el
resto del sitio va con `styles.css`. El compilador funciona igual servido desde donde sea, así
que el diseño no cambia. Vendorizar elimina de raíz el riesgo de cadena de suministro y es lo
que permite declarar `script-src 'self'` (D3). Mover la configuración fuera del HTML evita
tener que hashear un script en línea.

**Alternativas descartadas**:

- *Dejar el CDN y permitirlo en la política*: la política no protege de un script que uno
  mismo autorizó. Se cambia un riesgo por la ilusión de haberlo tratado.
- *Fijar la versión del CDN + SRI*: el CDN de Tailwind no publica hashes estables para una URL
  versionada; el SRI quedaría sobre un archivo que ellos pueden regenerar.
- *Reescribir `services.js` sin Tailwind*: es lo más limpio a largo plazo, pero es rehacer una
  página entera con riesgo real de romper el diseño, y T018 sigue abierta justamente por no
  haber probado en navegador.

**Deuda que queda anotada**: el compilador de Tailwind sigue generando CSS en el navegador en
cada carga, que es un costo de rendimiento que sus propios autores desaconsejan para
producción. Vendorizarlo arregla la **seguridad**, no el rendimiento. Eliminarlo del todo es
trabajo de otra funcionalidad.

---

## D3 — Composición de la política de contenido

**Decisión**:

```
default-src 'self';
script-src  'self';
style-src   'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src    'self' https://fonts.gstatic.com;
img-src     'self' data: https://images.unsplash.com https://media.base44.com;
frame-src   https://www.google.com;
connect-src 'self' http://localhost:3000;
object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'
```

En **dos lugares**: `<meta http-equiv>` en `index.html` (viaja con el sitio a cualquier
hosting) y cabecera real desde `Frontend/server.js` (`frame-ancestors` **no funciona** en un
meta; solo vale como cabecera).

**Razón de cada concesión**:

- `'unsafe-inline'` en `style-src` es **inevitable**: el compilador de Tailwind inyecta un
  `<style>` en caliente y el código usa `style="..."` en decenas de lugares. Se acepta porque
  el riesgo de CSS inyectado es muy inferior al de JavaScript inyectado.
- `script-src 'self'` **sin** `'unsafe-inline'` es la pieza que importa: bloquea `onerror=`,
  `onclick=` y `javascript:` inyectados, que es exactamente el vector que D1 ataca por el otro
  lado. Dos barreras independientes para el mismo riesgo.
- `connect-src` debe incluir el origen del API (`data.js`), y **hay que actualizarlo al
  publicar** junto con `API_URL`. Es el punto más fácil de olvidar de toda la funcionalidad.

**Trampa detectada**: el bloque `<script type="application/ld+json">` de datos estructurados.
Los navegadores no lo ejecutan, pero las implementaciones de la política difieren en si lo
bloquean igual. **Hay que verificarlo en el navegador**; si se bloquea, se resuelve con su
hash SHA-256 en `script-src`, no aflojando la política.

---

## D4 — Limitador de peticiones escrito a mano

**Decisión**: ventana deslizante por clave, en memoria, en
`Backend/src/middlewares/limitarPeticiones.ts`. Una fábrica configurable con dos usos:

| Uso | Ventana | Tope | Qué protege |
|---|---|---|---|
| Operaciones públicas | 15 min | 20 | `POST /api/mensajes` (T021) |
| Autenticación | 15 min | 10 fallos | Fuerza bruta del token |

**Tres detalles que no son opcionales**:

1. **La clave es un hash de la dirección de red, no la dirección.** FR-028 prohíbe que las
   direcciones de red aparezcan en el registro; guardarlas en memoria en claro sería
   incoherente con eso. Un SHA-256 truncado sirve igual como clave y no es reversible de un
   vistazo en un volcado de memoria.
2. **Hay que purgar las entradas vencidas.** Un mapa que solo crece es, él mismo, la vía para
   tumbar el servicio. Purga perezosa en cada acceso más un barrido periódico.
3. **El limitador de autenticación cuenta solo los fallos.** Si contara los aciertos, el
   personal del CDA se autobloquearía en un día de trabajo normal.

**Alternativas descartadas**:

- *`express-rate-limit`*: es buena librería, pero su almacén en memoria tiene exactamente la
  misma limitación de un solo proceso, así que no compra nada a cambio de la dependencia.
- *Ventana fija*: más simple, pero permite el doble del tope justo en el borde de la ventana.

**Limitación aceptada y escrita**: el conteo vive en la memoria de **un** proceso. Con varias
instancias el tope se cuenta por instancia. Aceptable hoy; se revisa en la ronda 2. Y sin
`trust proxy` configurado, detrás de un proxy inverso todas las peticiones comparten la
dirección del proxy: **habría que configurarlo antes de publicar** o el limitador bloquea a
todo el mundo junto.

---

## D5 — helmet: qué hay que desactivar para no romper el sitio

**Decisión**: `helmet@8.3.0` (cero dependencias transitivas, verificado con `npm view`), con
**`crossOriginResourcePolicy` en `cross-origin`**.

**Razón, y es la trampa más cara de esta funcionalidad**: helmet activa por omisión
`Cross-Origin-Resource-Policy: same-origin`. El sitio corre en `localhost:5173` y el API en
`localhost:3000`: **son orígenes distintos**. Con el valor por omisión, el navegador descarta
las respuestas del API y el catálogo de servicios deja de cargar — o sea, se cae el
agendamiento entero. El CORS del API seguiría diciendo que sí; la que bloquea es esta otra
cabecera, y el síntoma no menciona helmet por ningún lado.

**Síntoma a reconocer si aparece**: el sitio carga, el agendamiento dice "no pudimos cargar la
lista de servicios", la petición figura como completada en la pestaña de red y la consola
habla de una política de recursos entre orígenes.

**Lo demás de helmet se deja como viene**: `nosniff`, `Referrer-Policy`, HSTS,
`X-Frame-Options`, `X-Permitted-Cross-Domain-Policies` y el resto. La política de contenido
que helmet pone sobre respuestas JSON es inofensiva y no se toca — la que importa es la del
sitio (D3), que la sirve `Frontend/server.js`.

`app.disable("x-powered-by")` va aparte: helmet lo borra, pero dejarlo explícito documenta la
intención y sobrevive a que alguien saque helmet.

---

## D6 — Un endpoint propio para verificar la credencial

**Decisión**: agregar `GET /api/admin/sesion`, detrás del mismo middleware, que devuelve
`200 {"estado":"ok"}` y nada más.

**Razón**: el panel necesita comprobar la credencial *antes* de mostrar nada. Usar
`GET /api/mensajes` como sonda funcionaría, pero **ensuciaría el registro de accesos a datos
personales** (FR-027) con entradas que no son lecturas reales de datos, y además transporta
datos personales solo para responder "sí o no". Un endpoint que no devuelve nada mantiene el
registro limpio y honesto: cada entrada de lectura de datos personales corresponde a una
lectura de verdad.

**Alternativas descartadas**:

- *`GET /api/mensajes?limite=1` como sonda*: contamina el registro y mueve datos personales sin
  necesidad.
- *`POST /api/admin/login` que devuelva una sesión*: es la solución de la ronda 2. Hoy no hay
  sesiones que emitir; inventarlas ahora es trabajo que se tira.

---

## D7 — La puerta del panel dentro de un router síncrono

**Decisión**: un estado de módulo con tres valores —`sin-credencial`, `verificando`,
`verificada`— que `render()` lee de forma síncrona, y un `bindAdmin()` que hace la
verificación asíncrona y vuelve a llamar a `render()`.

**Razón**: `render()` arma HTML con plantillas y lo asigna de una sola vez; volverlo asíncrono
es reescribir el router. El proyecto **ya resolvió este mismo problema dos veces**: la carga
del catálogo antes del primer render (`app.js:62`) y el botón de reintentar
(`schedule.js:226`). Se repite el patrón que ya existe en vez de inventar otro.

**Flujo al recargar la página**: la credencial sobrevive en la pestaña pero el estado del
módulo vuelve a cero. `render()` dibuja "verificando…" cuando hay credencial guardada pero sin
verificar, y `bindAdmin()` la revalida contra el servidor. **Nunca se abre el panel por confiar
en lo guardado**: cada carga de página se revalida contra el servidor.

**Por qué en `sessionStorage` y no en `localStorage`**: muere al cerrar la pestaña, no lo
comparten otras pestañas, y no queda en el equipo después de que alguien usa el panel en una
máquina compartida — que es el caso real del mostrador de un CDA.

---

## D8 — Pruebas de integración HTTP sin dependencias nuevas

**Decisión**: `node:test` levantando la app real con `app.listen(0)` (puerto libre que asigna
el sistema) y pegándole con el `fetch` nativo de Node. Requiere extraer la construcción de la
app a `Backend/src/app.ts`, dejando `server.ts` solo con el arranque.

**Razón**: es la única prueba que cumple FR-030 —debe fallar si alguien deja el endpoint de
datos personales sin protección—. Hoy toda la suite pasa en verde aunque se borre el
middleware, porque las pruebas existentes prueban el middleware **aislado**, no que esté
efectivamente montado en la ruta. Node 22 trae `fetch` y `node:test`: no hace falta
`supertest`.

**El paso que valida la prueba**: hay que quitar el middleware a propósito y comprobar que la
suite se pone roja. Una prueba de regresión que nunca se vio fallar no es una prueba, es una
suposición.

---

## D9 — Registro de accesos sin datos personales

**Decisión**: una línea por petición con fecha ISO, método, ruta **sin cadena de consulta**,
código de estado y duración.

**Razón, y es lo que más fácil se hace mal**: la cadena de consulta de `GET /api/mensajes`
lleva `desde`, `hasta` y `limite` —no es dato personal—, pero registrar la ruta completa
sienta el precedente de registrar cadenas de consulta, y la primera que traiga un correo o una
placa se filtra sola. Se corta la cadena y listo.

**Lo que está prohibido registrar** (FR-028): cuerpo de la petición, cabecera de autorización,
y la dirección de red. **La dirección de red es dato personal** bajo la Ley 1581 de 2012 y
bajo el principio II, que dice que los datos personales no deben aparecer en registros.

**Consecuencia que hay que aceptar de frente**: sin dirección de red, el registro sirve para
saber **qué** se accedió y **cuándo**, no **quién**. Con una credencial compartida y sin
usuarios, "quién" no es una pregunta que este sistema pueda responder de todos modos. La
trazabilidad real llega en la ronda 2 con usuarios.

---

## D10 — Cómo se arregla el recorrido de rutas del servidor estático

**Decisión**: `path.resolve` y luego comprobar `resuelto === raiz || resuelto.startsWith(raiz + path.sep)`.

**Razón**: el guard de hoy compara prefijos de texto sin separador, así que un directorio
hermano llamado `Frontend-backup` pasa el filtro. Comparar con el separador incluido convierte
la comparación de texto en una comparación de segmentos de ruta, que es lo que se quería.

Junto con esto, dos cosas más en el mismo archivo:

- `decodeURIComponent` va dentro de un `try/catch`: hoy un `GET /%` lanza y **mata el
  proceso**, porque no hay captura en ninguna parte del archivo. Es un ataque de un solo
  request.
- Lista de denegación para `server.js`, `*.log` y `.vscode/`, que hoy se sirven porque están
  bajo la raíz.

**Descartado por ahora**: resolver enlaces simbólicos con `realpath`. Añade una llamada al
sistema por petición para un vector que requiere que alguien ya pueda escribir dentro de
`Frontend/`. Queda anotado, no implementado.

---

## Resumen de dependencias nuevas

| Paquete | Versión | Dependencias transitivas | Por qué |
|---|---|---|---|
| `helmet` | ^8.3.0 | **ninguna** | Acertar 12 cabeceras a mano es donde se cometen errores callados |

El backend pasa de 3 a 4 dependencias de ejecución. El limitador de peticiones se escribe a
mano (D4) y las pruebas de integración no necesitan nada (D8). **El frontend no incorpora
ninguna dependencia** — lo prohíben las Restricciones Técnicas de la constitución.
