-- 001 — Esquema y tablas del CDA de Valledupar
--
-- Se aplica desde el editor SQL del panel de Supabase, en orden numérico.
-- Vive en el repositorio y no solo en el panel a propósito: el esquema es parte
-- del diseño y tiene que poder leerse, revisarse en un diff y explicarse en un
-- mensaje de commit, como todo lo demás acá.
--
-- Es idempotente: se puede volver a correr sin romper nada.

-- ---------------------------------------------------------------------------
-- El esquema: FUERA de `public`, y eso no es cosmético.
--
-- Supabase expone automáticamente por PostgREST las tablas del esquema `public`,
-- y la clave anónima está DISEÑADA para ser pública: viaja en el navegador de
-- cualquier visitante. Una tabla `public.citas` es una tabla que cualquiera con
-- esa clave lee entera — nombre, teléfono, correo y placa de cada cliente del
-- CDA. Eso es exactamente la filtración que el principio II de la constitución
-- existe para impedir.
--
-- PostgREST solo expone los esquemas configurados en el panel (`public` y
-- `graphql_public` por omisión). Las tablas de `cda` no existen para el API de
-- datos. La segunda capa —RLS— va en la migración 002.
-- ---------------------------------------------------------------------------
create schema if not exists cda;

-- ---------------------------------------------------------------------------
-- Citas
--
-- Los nombres de columna van en español y snake_case, que es la convención de
-- Postgres. Los campos del API mantienen los nombres que ya usa el frontend
-- (clientName, plate, service…) porque son el contrato que el panel renderiza.
-- La traducción entre ambos es trabajo del repositorio y está escrita campo por
-- campo en specs/003-persistencia-supabase/data-model.md.
-- ---------------------------------------------------------------------------
create table if not exists cda.citas (
  -- Lo genera el servidor. Hoy el navegador arma el id con Date.now() recortado
  -- a seis dígitos: colisiona, y además deja que el cliente elija su propio
  -- identificador.
  id              uuid        primary key default gen_random_uuid(),

  nombre_cliente  text        not null,
  telefono        text        not null,

  -- El ÚNICO campo opcional. El formulario lo marca sin asterisco, y de acá sale
  -- la rama del aviso por correo: sin correo no se intenta ningún envío.
  correo          text,

  placa           text        not null,
  vehiculo        text        not null,

  -- DOS columnas para el servicio, y cada una responde una pregunta distinta.
  --
  -- `servicio_id` es la referencia estable ('revision-de-gases'). Sirve para
  -- agrupar y contar, y sobrevive a que el servicio se renombre de cara al
  -- cliente. Es para lo que existe el id en tipos/servicio.ts.
  --
  -- `servicio_nombre` es LO QUE EL CLIENTE VIO Y ACEPTÓ, congelado en el momento
  -- de agendar. No se resuelve del catálogo al mostrarlo, y esa es toda la
  -- gracia: si mañana el CDA renombra o retira un servicio, la cita sigue
  -- diciendo qué se acordó con esa persona. Es un negocio real haciendo
  -- promesas comerciales; el registro de lo prometido no puede cambiar solo.
  --
  -- Guardar solo el id dejaría citas viejas apuntando a nada el día que un
  -- servicio se retire. Guardar solo el nombre rompería el conteo el día que se
  -- renombre. Por eso van las dos.
  servicio_id     text        not null,
  servicio_nombre text        not null,

  -- Fecha y hora en columnas separadas, no en un timestamptz. Dos razones:
  --   1. Contar cuántas citas hay en una franja es una consulta directa sobre
  --      `hora`, que es lo que hará falta si el propietario confirma que hay
  --      cupos (FR-028, pendiente).
  --   2. Una cita es una hora local de Valledupar acordada con una persona, no
  --      un instante absoluto. Guardarla con zona horaria invitaría a que se
  --      corra sola si algún día el servidor cambia de región.
  fecha           date        not null,
  hora            time        not null,

  -- Preferencia declarada, NO un pago: el sistema no cobra nada. El formulario
  -- ofrece PayU, MercadoPago, Efectivo y Transferencia Bancaria.
  -- PENDIENTE DE RATIFICAR con el propietario si el CDA acepta los cuatro.
  pago            text        not null,

  -- La restricción va en la base y no solo en el código. Una restricción en el
  -- código protege al código que la respeta; una en la base protege a la tabla.
  estado          text        not null default 'pendiente'
                  constraint citas_estado_valido
                  check (estado in ('pendiente', 'atendida', 'cancelada')),

  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz
);

-- ---------------------------------------------------------------------------
-- Mensajes de contacto
--
-- Réplica exacta del tipo `Mensaje` que ya existe en el backend. NO se aprovecha
-- la mudanza para rediseñarlo: mezclar una migración de datos con un cambio de
-- contrato es cómo se pierden datos sin saber cuál de los dos cambios tuvo la
-- culpa.
-- ---------------------------------------------------------------------------
create table if not exists cda.mensajes (
  id         uuid        primary key default gen_random_uuid(),
  nombre     text        not null,
  correo     text        not null,
  mensaje    text        not null,

  -- Fecha en hora de Colombia, la que calcula fechaHoyEnColombia(). Al mudar los
  -- mensajes del archivo JSON se conserva la ORIGINAL, no la de la mudanza: un
  -- mensaje del 8 de agosto sigue siendo del 8 de agosto.
  fecha      date        not null,

  -- Da orden estable dentro de un mismo día.
  creado_en  timestamptz not null default now()
);
