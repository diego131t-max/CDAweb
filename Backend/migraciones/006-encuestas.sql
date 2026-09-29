-- 006 — Encuesta de satisfacción
--
-- Al cliente que termina su revisión se le da un código QR que lleva a
-- /encuesta: califica de 1 a 5 el servicio y las instalaciones (1 = malo,
-- 5 = excelente) y puede dejar una sugerencia.
--
-- ES ANÓNIMA A PROPÓSITO. No se pide nombre, cédula, correo ni placa: sin ellos
-- no hay dato personal que proteger, y a quien va a decir algo incómodo del
-- servicio no se le pide identificarse. Por lo mismo no hay forma de saber si una
-- persona contestó dos veces; lo único que lo acota es el limitador de
-- peticiones públicas del API.
--
-- Mismo tratamiento que las otras tablas: esquema `cda` fuera de `public` y RLS
-- activado SIN políticas (ver 001 y 002). La sugerencia es texto libre y puede
-- traer cualquier cosa que escriba la persona, incluido un dato personal, así que
-- se lee solo detrás de credencial.
--
-- Es idempotente: se puede volver a correr sin romper nada.

create table if not exists cda.encuestas (
  id                          uuid        primary key default gen_random_uuid(),

  -- Enteros de 1 a 5. El `check` está acá y no solo en el API: la base es la
  -- última que puede negarse a guardar una nota que no existe.
  calificacion_servicio       smallint    not null check (calificacion_servicio between 1 and 5),
  calificacion_instalaciones  smallint    not null check (calificacion_instalaciones between 1 and 5),

  -- Opcional. Nula cuando la persona no escribió nada.
  sugerencias                 text,

  -- Fecha en hora de Colombia, la que calcula fechaHoyEnColombia(): la base corre
  -- en UTC y pasadas las 19:00 de Valledupar `current_date` ya sería mañana.
  fecha                       date        not null,

  -- Da orden estable dentro de un mismo día.
  creado_en                   timestamptz not null default now()
);

create index if not exists encuestas_fecha_idx on cda.encuestas (fecha);

alter table cda.encuestas enable row level security;
