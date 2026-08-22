# webCDA — CDA de Valledupar

Sitio y sistema de agendamiento del Centro de Diagnóstico Automotor de Valledupar
(Cesar, Colombia). Revisión técnico-mecánica y de gases para motos y vehículos.

**Es un negocio real con clientes reales.** Los datos que maneja son datos personales
(nombre, teléfono, correo, placa) y lo que publica son promesas comerciales. Eso condiciona
casi todas las decisiones de este repositorio.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/002-endurecimiento-seguridad/plan.md
<!-- SPECKIT END -->

## Estructura

```
Frontend/   SPA en JavaScript sin build, sin npm, sin módulos
Backend/    API en Express + TypeScript (strict)
specs/      Especificaciones por funcionalidad (Spec Kit)
.specify/   Configuración de Spec Kit + la constitución del proyecto
.claude/    Agentes especializados y skills de Spec Kit
```

## Cómo se corre

Hacen falta **los dos procesos**. Desde que el catálogo de servicios vive en el API, el
sitio ya no funciona solo:

```bash
cd Backend && npm run dev     # API en http://localhost:3000/api
node Frontend/server.js       # sitio en http://localhost:5173
```

El backend necesita `Backend/.env` (copiar de `.env.example`). Sin `ADMIN_TOKEN` los
endpoints de administración responden 503 a propósito: fallan cerrado, nunca abiertos.

**Y necesita `DATABASE_URL`**: desde que citas y mensajes viven en Postgres, el API no
arranca sin base. Tiene que ser la cadena del **pooler de sesión** de Supabase
(`aws-…pooler.supabase.com:5432`), no la conexión directa: esa es solo IPv6 y falla con un
error que no menciona IPv6 por ningún lado.

## Lo que hay que saber antes de tocar código

**El frontend no tiene build.** Nada de `import`/`export`: todo vive en ámbito global y se
carga por `<script>` en orden de dependencia en `index.html`. Agregar una página son **cinco
ediciones** (el archivo en `pages/`, su `<script>`, la rama en `render()` de `app.js`, su
entrada en `METADATOS` y una `<url>` en `sitemap.xml`), y hay que **subir el `?v=`** o el
navegador sirve la versión vieja. Las dos últimas son nuevas desde que el sitio enruta por
rutas reales: **una página sin entrada en `METADATOS` sale con el título de "no encontrada"
y `noindex`**, o sea que existe para las personas y no para Google. Los detalles completos
están en el agente de frontend.

**La persistencia va detrás de una interfaz de repositorio** (`Backend/src/repositorios/`).
Los handlers de Express nunca tocan el almacenamiento. Citas y mensajes están en **Postgres
(Supabase)**, esquema `cda`, fuera de `public` y con RLS activado sin políticas: dos capas
para que la clave publicable —que viaja en el navegador de cualquier visitante— no alcance
los datos de los clientes. El esquema está versionado en `Backend/migraciones/`.

La mudanza del archivo JSON a Postgres fue **escribir otra implementación de la misma
interfaz y cambiar el punto de composición** (`dependencias.ts`); ni las rutas ni los
manejadores se tocaron. Si alguna vez hay que editar un manejador para cambiar de
almacenamiento, el diseño se rompió y se corrige antes de seguir.

**Trampa conocida:** Tailwind del CDN pisa la clase `.container` del sitio (misma
especificidad, se inyecta después), así que el ancho de contenido salta en escalones
768/1024/1280 en vez del `min(1180px, 100%)` que declara `styles.css`. Hoy no rompe nada,
pero explica desbordes raros en anchos intermedios. Corregirlo afecta todas las páginas.

**Sacar Tailwind está pendiente a propósito.** Son 399 KB —un compilador de CSS corriendo en
el navegador de cada visitante— y se usa en **un solo archivo**, `pages/services.js`
(30 atributos `class`, verificado archivo por archivo). Se pospuso al medirlo: con la
compresión encendida esos 399 KB viajan como ~122 KB, al lado de los 6,4 MB de imágenes que
sí se arreglaron. Sigue valiendo la pena por la CPU del teléfono y porque arregla el bug de
arriba, pero es rediseñar el CSS de una página entera y **exige verificación en navegador**:
va como trabajo propio, no de arrimado en otro cambio.

## Dónde vive el conocimiento

| Qué | Dónde |
|---|---|
| Principios no negociables del proyecto | [.specify/memory/constitution.md](.specify/memory/constitution.md) |
| Convenciones de cada dominio | [.claude/agents/](.claude/agents/) — `webcda-frontend`, `webcda-backend` |
| Qué se decidió y por qué | [specs/](specs/) — spec, plan, tasks, analysis, converge |
| El razonamiento de cada cambio | Los mensajes de commit |

**Leé la constitución antes de trabajar acá.** Dos principios son NO NEGOCIABLES: no
inventar datos del negocio (precios, servicios, horarios se confirman con el propietario),
y que los datos personales fallen cerrado.

## Estado actual

**En producción**: sitio en `https://cdavalledupar.com` y API en `https://api.cdavalledupar.com`,
los dos en Railway (US East), con la base en Supabase (`us-east-1`).

Implementado y verificado contra producción: catálogo de servicios en el API; agendamiento
que **llega al servidor** (antes la cita se guardaba en el navegador del cliente y el CDA no
se enteraba nunca), con la regla de exclusión por vehículo aplicada del lado del servidor;
panel de administración que lista citas y mensajes, marca una cita como atendida o cancelada
y **borra las canceladas**; mensajes de contacto en Postgres; limitador de peticiones con
`trust proxy` bien configurado; HSTS y **campo trampa** en los tres formularios públicos;
compresión, caché e imágenes en WebP (el inicio pasó de **7 MB a 436 KB**); y la redirección
de `www` al dominio raíz, con el DNS puesto y **verificada contra el dominio real**
(2026-08-15): resuelve, el certificado es válido, y la ruta y la cadena de consulta se
conservan en el 301.

**Sin desplegar, en dos ramas**: `008-indexacion-en-google` y `009-rutas-reales`. Salieron de
medir que el sitio **no estaba indexado** —buscando `"cdavalledupar.com"` entre comillas
Google no lo devolvía ni una vez, mientras los tres CDA de la competencia sí salían—. La 008
es lo que faltaba para ser descubierto (`robots.txt`, `sitemap.xml`, canónica, `og:`, la ficha
JSON-LD del negocio). La 009 es la que mueve la aguja: **el sitio dejó de enrutar por
fragmento**, así que las seis páginas pasaron de ser una sola URL para Google a ser seis, cada
una con su título. La 009 **no se despliega hasta verificarla en navegador** (T081).

Pendiente, en orden de importancia (detalle en
[specs/003-persistencia-supabase/tasks.md](specs/003-persistencia-supabase/tasks.md)):

1. **Verificación en navegador real** de agendamiento, panel y caminos de fallo (T025, T030,
   T042), del borrado (T057), de los formularios después del campo trampa (T060), del
   aspecto del sitio después de la conversión a WebP (T063) y de **las rutas reales de la
   009** (T081, que además bloquea su despliegue). El principio IV de la constitución la
   exige y prohíbe simularla.
2. **FR-028 ya está implementado** (2026-08-22). El propietario confirmó el tope: **cuatro
   vehículos por franja, compartidos entre todos los tipos de vehículo**, y **diez franjas**,
   cada hora en punto de 8 a 17 — o sea un techo de 40 vehículos diarios.

   Lo que importa saber si se toca: la lista de franjas vive en `Backend/src/tipos/franja.ts`
   y **el frontend no tiene copia**, ni de respaldo. El desplegable de horas se arma con lo
   que devuelve `GET /api/citas/disponibilidad`. Antes eran cinco horas escritas en un
   `<select>` que no correspondían a nada, y el servidor aceptaba cualquier `HH:MM`: con
   tope eso se vuelve un agujero, porque mandar `09:07` abre una franja nueva y vacía.

   **Contar cupos e insertar ocurren dentro de una transacción con
   `pg_advisory_xact_lock` por (fecha, hora).** No es adorno: sin el candado, dos envíos
   simultáneos cuentan los dos "tres ocupados", insertan los dos, y la franja queda con
   cinco carros. Por eso la regla vive en el repositorio y no en la ruta —es el único lugar
   donde se puede tomar el candado— y por eso `crear()` devuelve `ResultadoCreacion` en vez
   de una cita.

   **Pendiente conocido:** las diez franjas valen para todos los días, así que un sábado se
   puede agendar a las 17:00 aunque el sitio publique cierre a las 4, y un festivo también.
   Resolverlo exige el calendario de festivos de Colombia, que se mueve cada año y no se
   puede inventar.

   **Hay una cita de prueba en producción para borrar:** "PRUEBA CUPOS - BORRAR", placa
   CUP001, 2099-12-31 17:00. Se creó para verificar que la transacción funciona contra
   Supabase de verdad —lo único que las pruebas no pueden cubrir—. Se borra desde el panel:
   cancelar y después borrar.

   **Los medios de pago ya se ratificaron, y también estaban mal** (2026-08-22): son
   **dos**, efectivo y tarjeta por datáfono, los dos al llegar al CDA. El formulario
   ofrecía "PayU", "MercadoPago", "Efectivo" y "Transferencia Bancaria", con **"PayU" como
   valor por omisión**: toda cita en la que el cliente no tocara el desplegable quedó
   guardada con una pasarela que el CDA nunca tuvo. Hoy la lista vive en `mediosDePago`
   (`Frontend/data.js`) y de ahí leen tanto el formulario como la sección del inicio, que
   antes tenían cada una la suya. Falta confirmar **qué franquicias acepta el datáfono**:
   por eso la sección no muestra logos de Visa/Mastercard/Amex.

   **El pago en línea con Wompi no existe todavía** y la cuenta de comercio está sin crear.
   Por eso el sitio no anuncia ningún "próximamente": sería una promesa sin fecha. Wompi
   soporta diez medios (`CARD`, `BANCOLOMBIA_TRANSFER`, `BANCOLOMBIA_QR`, `NEQUI`, `PSE`,
   `DAVIPLATA`, `BANCOLOMBIA_COLLECT`, `PCOL`, `BANCOLOMBIA_BNPL`, `SU_PLUS`), pero cada
   comercio habilita los suyos: cuáles se publiquen sale del panel, no de esa lista.

   **Los servicios ya se ratificaron, y la respuesta cambió el sistema** (2026-08-21): el
   CDA presta **uno solo**, "Revisión Técnico-Mecánica y de Gases". Los otros cinco
   —gases aparte, luces y frenos, peritaje, certificado de blindaje y diagnóstico
   electrónico— **no existen**, y el sitio los estuvo ofreciendo. Por eso el catálogo tenía
   escrita la advertencia de que faltaba confirmarlo. Consecuencias: el formulario de
   agendamiento ya no pregunta el servicio, y **la regla de exclusión de FR-009/FR-010 se
   quedó sin ningún caso real** —era blindaje en motos—. La maquinaria que la aplica sigue
   ahí, del lado del cliente y del servidor, y su prueba se reescribió para inyectar un
   catálogo con exclusión: sin eso pasaba en verde sin probar nada.
3. **Correo de confirmación al cliente — CONSTRUIDO Y APAGADO A PROPÓSITO.** El código está
   completo, probado y desplegado (`Backend/src/correo/`), pero **no manda nada**: sin
   `RESEND_API_KEY` y `CORREO_REMITENTE` la función corta antes de tocar la red. **No hay
   nada que reimplementar.** Lo que falta es el trámite: crear la cuenta de Resend, verificar
   el dominio con sus registros de DNS y poner esas dos variables en Railway (T043), y
   después verificar que el correo llegue a bandeja de entrada y no a spam (T048). El
   propietario decidió esperar; prenderlo es poner las dos variables.
4. **Rotar la contraseña de la base.** El `ADMIN_TOKEN` ya se rotó (2026-08-15); la de
   Postgres no, por decisión explícita del propietario. Es corta y adivinable, y el endpoint
   se alcanza desde internet: hoy lo que protege los datos es que el esquema `cda` está fuera
   de `public` y que RLS está activo sin políticas. Son dos capas reales, pero ninguna de las
   dos es la contraseña.
5. **Registrar el sitio en Search Console** (T074): verificar el dominio **con la etiqueta
   HTML, no por DNS**, mandar el sitemap y solicitar la indexación. Bloqueado hasta que la
   008 esté desplegada, porque la etiqueta tiene que estar publicada para que Google la lea.
   Y después del despliegue, apuntar el botón de Reservas del Perfil de Empresa a `/agendar`
   (T082): hoy tiene que seguir en `#/agendar`, que es lo único que funciona con el código
   que hay arriba.
6. **El listado de citas del panel devuelve las MÁS VIEJAS cuando hay más de 200.**
   `GET /api/citas` ordena `fecha asc` con tope de 200, así que apenas la tabla pase ese
   número, Reservas va a mostrar las doscientas citas más antiguas y ninguna de las
   próximas —sin ningún aviso—. Con el tope de 40 vehículos por día, **son cinco días de
   agenda llena**.

   Reportes ya no depende de eso: desde la 039 sus números salen de
   `GET /api/citas/resumen`, que cuenta en la base sobre el rango completo. El que queda
   expuesto es el listado de Reservas. El arreglo es ordenar descendente y dar vuelta la
   lista del lado del cliente, o paginar; toca `repositorioCitasPostgres.listar()` y el
   orden que espera `reservationsTable`.

7. **Retirar el volumen de Railway** (T050). Conservarlo al menos una semana después de la
   mudanza; la implementación en archivo ya se retiró.
8. **Verificar la transferencia internacional de datos bajo la Ley 1581** (T054). La base
   está en Virginia y guarda datos personales de clientes colombianos. No bloquea nada, pero
   si la respuesta es adversa el remedio es migrar la base entera: la región de un proyecto
   de Supabase no se cambia.

> ⚠️ **La conexión a Postgres verifica contra una raíz fijada en el código**
> (`Backend/src/basedatos/certificadoSupabase.ts`), que **vence el 26 de abril de 2031**. Es
> lo correcto —falla cerrado— y tiene un precio: si Supabase rota su CA, el API deja de
> conectar y no hay agendamiento. El síntoma es un error de TLS que no menciona nada de
> esto. **Si el API deja de conectar sin que nadie haya tocado el código, empezá por acá:**
> `cd Backend && npx tsx scripts/verificar-tls.ts`

## Convenciones

- **Todo el texto visible y los mensajes de error, en español**, tuteando al usuario.
  Comentarios en español también.
- TypeScript estricto en el backend; nada de `any` sin justificación escrita.
- El backend valida con `npx tsc --noEmit` y `npm test`. El frontend no tiene tests ni
  build: **se valida en el navegador**, y no hay atajo.
- El trabajo se delega a los agentes de `.claude/agents/` según el dominio. Una tarea que
  cruce front y back se reparte, no se resuelve mezclada.
