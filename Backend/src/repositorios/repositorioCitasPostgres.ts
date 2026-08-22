import type { Sql } from "postgres";

import { obtenerSql } from "../basedatos/conexion.js";
import type { Cita, EstadoCita, FiltroCitas, NuevaCita } from "../tipos/cita.js";
import type { CupoDeFranja } from "../tipos/franja.js";
import { CUPOS_POR_FRANJA, FRANJAS } from "../tipos/franja.js";
import type { TipoVehiculo } from "../tipos/servicio.js";
import { LIMITES_CITA } from "../validacion/citas.js";
import type { RepositorioCitas, ResultadoBorrado, ResultadoCreacion } from "./repositorioCitas.js";

/**
 * Implementación de `RepositorioCitas` sobre Postgres.
 *
 * EL MAPEO COLUMNA↔CAMPO SE ESCRIBE A MANO, fila por fila, y no con una
 * transformación automática de nombres. Un mapeo implícito no falla cuando se
 * equivoca: guarda el dato en la columna equivocada y sigue andando, y eso se
 * descubre semanas después mirando datos que no cuadran. Acá, si falta un campo,
 * TypeScript lo dice al compilar.
 *
 * La correspondencia completa está en specs/003-persistencia-supabase/data-model.md.
 */

/** Cómo vuelve una fila de `cda.citas` desde Postgres. */
interface FilaCita {
  id: string;
  nombre_cliente: string;
  telefono: string;
  correo: string | null;
  cedula: string | null;
  placa: string;
  vehiculo: string;
  servicio_id: string;
  servicio_nombre: string;
  fecha: Date;
  hora: string;
  pago: string;
  estado: string;
  creado_en: Date;
}

/**
 * Traduce una fila a la forma que espera el frontend.
 *
 * `fecha` vuelve como `Date` porque la columna es `date`, y hay que formatearla
 * de nuevo a 'YYYY-MM-DD'. Se usan los componentes UTC del objeto a propósito:
 * postgres.js construye la fecha a medianoche UTC, así que leerla con métodos
 * locales en un servidor al oeste de Greenwich devolvería el día anterior.
 */
function aCita(fila: FilaCita): Cita {
  const cita: Cita = {
    id: fila.id,
    clientName: fila.nombre_cliente,
    phone: fila.telefono,
    plate: fila.placa,
    vehicle: fila.vehiculo as TipoVehiculo,
    service: fila.servicio_id,
    serviceName: fila.servicio_nombre,
    date: fila.fecha.toISOString().slice(0, 10),
    // La columna es `time`, que vuelve como 'HH:MM:SS'. El contrato es 'HH:MM'.
    time: fila.hora.slice(0, 5),
    payment: fila.pago,
    status: fila.estado as EstadoCita,
    creadoEn: fila.creado_en.toISOString(),
  };

  // `exactOptionalPropertyTypes`: la propiedad existe solo si hay correo. Un
  // cliente sin correo no tiene `email: null`, no tiene `email`.
  if (fila.correo !== null) cita.email = fila.correo;
  if (fila.cedula !== null) cita.cedula = fila.cedula;

  return cita;
}

export class RepositorioCitasPostgres implements RepositorioCitas {
  private readonly sql: Sql;

  /** El cliente se inyecta en las pruebas; en producción se toma el del proceso. */
  constructor(sql: Sql = obtenerSql()) {
    this.sql = sql;
  }

  async crear(datos: NuevaCita): Promise<ResultadoCreacion> {
    /*
     * FR-028 — Contar los cupos e insertar TIENEN que ser indivisibles.
     *
     * `sql.begin` abre una transacción y el candado consultivo la serializa por
     * franja: cualquier otra inserción para ese mismo (fecha, hora) espera acá
     * hasta que esta termine. Sin el candado, dos envíos simultáneos contarían
     * los dos "tres ocupados", insertarían los dos, y la franja quedaría con
     * cinco carros —un error que solo se descubre en el mostrador—.
     *
     * `pg_advisory_xact_lock` se suelta solo al terminar la transacción, con
     * commit o con error. No hay forma de olvidarse de liberarlo.
     *
     * Se serializa por FRANJA y no por tabla: dos personas agendando para horas
     * distintas no se estorban. Si `hashtext` hiciera colisionar dos franjas
     * distintas, lo único que pasaría es que esas dos esperen de más; el conteo
     * sigue siendo correcto porque se hace por (fecha, hora) exactos.
     */
    return await this.sql.begin(async (sql): Promise<ResultadoCreacion> => {
      await sql`select pg_advisory_xact_lock(hashtext(${`${datos.date} ${datos.time}`}))`;

      // Las canceladas NO cuentan: cancelar libera el lugar. Las atendidas sí,
      // porque ya ocurrieron.
      const conteo = await sql<{ ocupados: number }[]>`
        select count(*)::int as ocupados
        from cda.citas
        where fecha = ${datos.date}::date
          and hora = ${datos.time}::time
          and estado <> 'cancelada'
      `;
      const ocupados = conteo[0]?.ocupados ?? 0;
      if (ocupados >= CUPOS_POR_FRANJA) {
        return { resultado: "franja-llena", ocupados };
      }

      // `id`, `estado` y `creado_en` los pone la base (ver los DEFAULT de la
      // migración 001). No se mandan desde acá ni se aceptan del cliente.
      const filas = await sql<FilaCita[]>`
        insert into cda.citas (
          nombre_cliente, telefono, correo, cedula, placa, vehiculo,
          servicio_id, servicio_nombre, fecha, hora, pago
        ) values (
          ${datos.clientName}, ${datos.phone}, ${datos.email ?? null}, ${datos.cedula ?? null}, ${datos.plate}, ${datos.vehicle},
          ${datos.service}, ${datos.serviceName}, ${datos.date}, ${datos.time}, ${datos.payment}
        )
        returning *
      `;

      const fila = filas[0];
      if (fila === undefined) {
        // `insert ... returning` siempre devuelve la fila insertada; si no lo hizo,
        // algo se rompió de una forma que no conviene disimular.
        throw new Error("La inserción de la cita no devolvió ninguna fila.");
      }

      return { resultado: "creada", cita: aCita(fila) };
    });
  }

  async disponibilidad(fecha: string): Promise<CupoDeFranja[]> {
    /*
     * Una sola consulta agrupada para todo el día, no diez.
     *
     * Devuelve únicamente horas y conteos: ni un nombre, ni una placa, ni un
     * teléfono. Eso es lo que permite que el endpoint que la usa sea público
     * sin abrirle a nadie los datos de los clientes.
     */
    const filas = await this.sql<{ hora: string; ocupados: number }[]>`
      select to_char(hora, 'HH24:MI') as hora, count(*)::int as ocupados
      from cda.citas
      where fecha = ${fecha}::date
        and estado <> 'cancelada'
      group by hora
    `;

    const ocupadosPorFranja = new Map(filas.map((fila) => [fila.hora, fila.ocupados]));

    // Se recorre FRANJAS y no las filas: la respuesta trae SIEMPRE las diez
    // franjas, también las que no tienen ninguna cita. El formulario dibuja su
    // desplegable con esto, así que una franja vacía tiene que venir igual.
    return FRANJAS.map((hora) => {
      const ocupados = ocupadosPorFranja.get(hora) ?? 0;
      return { hora, ocupados, disponibles: Math.max(0, CUPOS_POR_FRANJA - ocupados) };
    });
  }

  async listar(filtro: FiltroCitas = {}): Promise<Cita[]> {
    const limite = filtro.limite ?? LIMITES_CITA.listadoPorOmision;

    /*
     * Los filtros son opcionales y se resuelven dentro del `where` con
     * comparaciones contra null, en vez de armar la consulta por concatenación.
     * Así el SQL es uno solo, legible y sin ramas —y no hay ningún punto donde
     * un valor del cliente se pegue al texto de la consulta—.
     */
    const filas = await this.sql<FilaCita[]>`
      select * from cda.citas
      where (${filtro.desde ?? null}::date is null or fecha >= ${filtro.desde ?? null}::date)
        and (${filtro.hasta ?? null}::date is null or fecha <= ${filtro.hasta ?? null}::date)
        and (${filtro.estado ?? null}::text is null or estado = ${filtro.estado ?? null}::text)
      order by fecha asc, hora asc
      limit ${limite}
    `;

    return filas.map(aCita);
  }

  async actualizarEstado(id: string, estado: EstadoCita): Promise<Cita | null> {
    /*
     * El `where id = ...` con un id que no es un UUID válido haría que Postgres
     * lance un error de tipo en vez de devolver cero filas. Se acota antes para
     * que un id inventado en la URL termine en 404 y no en 500.
     */
    if (!ES_UUID.test(id)) return null;

    const filas = await this.sql<FilaCita[]>`
      update cda.citas
      set estado = ${estado}, actualizado_en = now()
      where id = ${id}::uuid
      returning *
    `;

    const fila = filas[0];
    return fila === undefined ? null : aCita(fila);
  }

  async borrar(id: string): Promise<ResultadoBorrado> {
    // Mismo cuidado que en actualizarEstado: un id que no es UUID haría que
    // Postgres lance un error de tipo en vez de decir "no existe".
    if (!ES_UUID.test(id)) return { resultado: "no-existe" };

    /*
     * Mirar y borrar van en UNA transacción, y no en dos consultas sueltas, para
     * que entre la comprobación y el borrado no pueda colarse un cambio de
     * estado. Sin eso, dos personas del mostrador trabajando a la vez podrían
     * conseguir que se borre una cita que acababa de volver a pendiente.
     */
    return this.sql.begin(async (tx) => {
      const actuales = await tx<{ estado: string }[]>`
        select estado from cda.citas where id = ${id}::uuid for update
      `;

      const actual = actuales[0];
      if (actual === undefined) return { resultado: "no-existe" };

      if (actual.estado !== "cancelada") {
        return { resultado: "no-cancelada", estado: actual.estado as EstadoCita };
      }

      await tx`delete from cda.citas where id = ${id}::uuid`;
      return { resultado: "borrada" };
    }) as Promise<ResultadoBorrado>;
  }
}

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
