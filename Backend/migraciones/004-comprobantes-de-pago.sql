-- 004 — Pago en línea con comprobante
--
-- El propietario descartó la pasarela de pagos (Wompi queda afuera, no
-- pospuesto) y en su lugar habilitó dos medios en línea sin intermediario: el
-- código QR de Bancolombia y la transferencia. El sistema NO cobra y NO se
-- entera de que el dinero llegó: el cliente sube una foto del comprobante y una
-- persona del CDA la mira. Eso es todo lo que significa 'verificado' acá.
--
-- ⚠️ UN COMPROBANTE ES DATO PERSONAL. Trae el nombre de quien pagó, su banco y
-- a veces su número de cuenta. Aplica todo lo del principio II: el archivo vive
-- en un bucket PRIVADO, la ruta nunca sale dentro de la cita (que viaja al
-- navegador de cualquiera que agende), y para verlo hay que pedir una URL
-- firmada al endpoint de admin, que sí exige credencial.

-- Dónde va el pago. Lo DERIVA el servidor del medio elegido y de si hay
-- archivo; el cliente no lo manda. Si pudiera mandarlo, cualquiera podría
-- agendar un pago en línea y marcarlo 'verificado' de una vez.
--
-- 'no-aplica' es el default a propósito: las citas que ya están en la tabla se
-- pagan en el CDA, y esa es exactamente su situación.
alter table cda.citas add column if not exists pago_estado text not null default 'no-aplica';

-- Ruta del objeto en el almacenamiento ('citas/<uuid>.<ext>'). Nunca el nombre
-- de archivo que mandó el cliente.
alter table cda.citas add column if not exists comprobante_ruta text;
-- Tipo MIME verificado CONTRA LOS BYTES del archivo, no contra la cabecera que
-- mandó el navegador.
alter table cda.citas add column if not exists comprobante_tipo text;
alter table cda.citas add column if not exists comprobante_subido_en timestamptz;

-- La restricción va en la base y no solo en el código, con el mismo criterio de
-- `citas_estado_valido` en la 001: una restricción en el código protege al
-- código que la respeta; una en la base protege a la tabla.
alter table cda.citas drop constraint if exists citas_pago_estado_valido;
alter table cda.citas add constraint citas_pago_estado_valido
  check (pago_estado in ('no-aplica', 'pendiente', 'por-verificar', 'verificado', 'rechazado'));

-- POR QUÉ LA COLUMNA `pago` SIGUE SIN `check`, aunque ahora exista una lista
-- cerrada de medios en el servidor (Backend/src/tipos/pago.ts).
--
-- En producción hay filas guardadas con 'PayU' —una pasarela que el CDA nunca
-- tuvo, que era el valor por omisión del desplegable— y con 'Por confirmar'.
-- Agregar el `check` fallaría al aplicarse contra esas filas, y reescribirlas
-- sería peor: igual que `servicio_nombre` va congelado, `pago` registra lo que
-- se acordó con esa persona, no lo que el catálogo diría hoy. La lista se cierra
-- para lo que ENTRA, en `validarNuevaCita`.

-- Para que el panel encuentre rápido lo que hay que mirar. Parcial: solo indexa
-- las que esperan verificación, que son las únicas que se buscan por esto.
create index if not exists citas_por_verificar_idx
  on cda.citas (creado_en desc) where pago_estado = 'por-verificar';
