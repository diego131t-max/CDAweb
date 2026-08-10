-- 002 — Índices y seguridad a nivel de fila
--
-- Se aplica después de 001. Idempotente.

-- ---------------------------------------------------------------------------
-- Índices
--
-- Son tres, sobre tablas que van a tener cientos de filas y no millones. Están
-- porque son baratos y porque el orden de listado ya es parte del
-- comportamiento observable del panel, no por una necesidad de rendimiento
-- medida.
-- ---------------------------------------------------------------------------

-- La consulta del panel: las citas del día, en orden. Sirve también para contar
-- las de una franja si el propietario confirma que hay cupos (FR-028).
create index if not exists citas_fecha_hora_idx
  on cda.citas (fecha, hora);

-- Lo que el mostrador mira todo el día: lo que falta atender. Es parcial porque
-- a nadie le interesa buscar rápido entre las canceladas de hace tres meses.
create index if not exists citas_pendientes_idx
  on cda.citas (fecha, hora)
  where estado = 'pendiente';

-- El panel lista los mensajes del más reciente al más viejo, que es como ya se
-- comportaba el archivo JSON. El índice conserva ese comportamiento cuando el
-- volumen crezca.
create index if not exists mensajes_creado_en_idx
  on cda.mensajes (creado_en desc);

-- ---------------------------------------------------------------------------
-- Row Level Security — la segunda capa
--
-- El esquema `cda` ya deja estas tablas fuera de lo que PostgREST expone. Esto
-- va ADEMÁS, y es el mismo criterio de defensa en dos capas que la funcionalidad
-- 002 aplicó al escape de HTML y a la política de contenido: dos caminos
-- independientes para el mismo riesgo, y un fallo en uno no basta.
--
-- Concretamente: si algún día alguien agrega `cda` a los esquemas expuestos en
-- la configuración del API, o mueve una de estas tablas a `public`, RLS activado
-- y SIN políticas deniega todo por omisión. Sin esto, ese cambio de una casilla
-- publicaría los datos personales de todos los clientes del CDA sin que nadie se
-- entere.
--
-- No se crea NINGUNA política a propósito. RLS sin políticas = nadie pasa.
--
-- El API no se ve afectado: se conecta como `postgres`, que es dueño de estas
-- tablas y no está sujeto a RLS. Los roles que sí lo están son `anon` y
-- `authenticated`, que son justamente los que usaría cualquiera con la clave
-- publicable.
-- ---------------------------------------------------------------------------
alter table cda.citas    enable row level security;
alter table cda.mensajes enable row level security;

-- ---------------------------------------------------------------------------
-- Comprobación
--
-- Después de aplicar 001 y 002, estas dos consultas tienen que dar lo esperado.
-- Están también en specs/003-persistencia-supabase/quickstart.md.
--
--   -- Las dos tablas existen y están fuera de public:
--   select table_schema, table_name from information_schema.tables
--   where table_schema = 'cda';
--
--   -- rowsecurity debe ser true en ambas:
--   select relname, relrowsecurity from pg_class
--   where relnamespace = 'cda'::regnamespace and relkind = 'r';
-- ---------------------------------------------------------------------------
