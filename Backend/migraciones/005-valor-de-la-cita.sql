-- 005 — Cuánto hay que cobrar por esta cita
--
-- El sitio pedía pagar por QR o transferencia y NUNCA decía el monto. No faltaba
-- un texto: el formulario no preguntaba lo necesario para calcularlo. La tarifa
-- depende de la CATEGORÍA y del AÑO DE MATRÍCULA, y `vehiculo` solo aporta media
-- —un liviano puede ser particular o público, y son tarifas distintas—.
--
-- Ahora el formulario pide las dos, y acá se guarda el resultado para que el
-- mostrador pueda comparar el comprobante contra lo que había que pagar.
--
-- ⚠️ EL VALOR LO CALCULA EL SERVIDOR, no llega del cliente. Si viajara en el JSON
-- del formulario, cualquiera mandaría 1000, transferiría mil pesos, y el panel
-- mostraría "debía $1.000" al lado de un comprobante de $1.000: el fraude se
-- vería consistente. El cliente manda los insumos —uso y año, los dos contra
-- listas cerradas— y el total se suma en Backend/src/tipos/tarifa.ts.

-- Los insumos. NULLABLE porque el formulario rápido del inicio no los pide, y
-- porque las motos no necesitan `uso`: tienen una sola categoría de tarifa.
-- Ausente no significa "particular", significa que no se preguntó.
alter table cda.citas add column if not exists uso text;
alter table cda.citas add column if not exists anio_matricula integer;

-- El total, en pesos enteros. NULLABLE a propósito: cuando falta un insumo o el
-- año cae fuera de la tabla, se guarda null y el panel muestra "por confirmar".
-- Null y NUNCA un aproximado — un precio inventado es peor que no tener precio
-- (principio I). Las citas que ya están en la tabla quedan en null, que es la
-- verdad: de esas nunca se calculó el valor.
alter table cda.citas add column if not exists valor integer;

alter table cda.citas drop constraint if exists citas_uso_valido;
alter table cda.citas add constraint citas_uso_valido
  check (uso is null or uso in ('particular', 'publico'));

-- Un valor negativo o cero no es un precio. La restricción va en la base con el
-- mismo criterio que `citas_estado_valido`: una en el código protege al código
-- que la respeta, una en la base protege a la tabla.
alter table cda.citas drop constraint if exists citas_valor_positivo;
alter table cda.citas add constraint citas_valor_positivo
  check (valor is null or valor > 0);
