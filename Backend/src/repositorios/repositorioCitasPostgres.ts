import type { Sql } from "postgres";

import { obtenerSql } from "../basedatos/conexion.js";
import type { Cita, EstadoCita, FiltroCitas, NuevaCita } from "../tipos/cita.js";
import type { TipoVehiculo } from "../tipos/servicio.js";
import { LIMITES_CITA } from "../validacion/citas.js";
import type { RepositorioCitas } from "./repositorioCitas.js";

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

  return cita;
}

export class RepositorioCitasPostgres implements RepositorioCitas {
  private readonly sql: Sql;

  /** El cliente se inyecta en las pruebas; en producción se toma el del proceso. */
  constructor(sql: Sql = obtenerSql()) {
    this.sql = sql;
  }

  async crear(datos: NuevaCita): Promise<Cita> {
    // `id`, `estado` y `creado_en` los pone la base (ver los DEFAULT de la
    // migración 001). No se mandan desde acá ni se aceptan del cliente.
    const filas = await this.sql<FilaCita[]>`
      insert into cda.citas (
        nombre_cliente, telefono, correo, placa, vehiculo,
        servicio_id, servicio_nombre, fecha, hora, pago
      ) values (
        ${datos.clientName}, ${datos.phone}, ${datos.email ?? null}, ${datos.plate}, ${datos.vehicle},
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

    return aCita(fila);
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
}

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
