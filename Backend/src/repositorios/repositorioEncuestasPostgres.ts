import type { Sql } from "postgres";

import { obtenerSql } from "../basedatos/conexion.js";
import type { Encuesta, FiltroEncuestas, NuevaEncuesta, ResumenEncuestas } from "../tipos/encuesta.js";
import { fechaHoyEnColombia } from "../utilidades/fecha.js";
import { LIMITES } from "../validacion/mensajes.js";
import type { RepositorioEncuestas } from "./repositorioEncuestas.js";

/** Cómo vuelve una fila de `cda.encuestas` desde Postgres. */
interface FilaEncuesta {
  id: string;
  calificacion_servicio: number;
  calificacion_instalaciones: number;
  sugerencias: string | null;
  fecha: Date;
  creado_en: Date;
}

/**
 * Traduce una fila al contrato del API. El mapeo columna↔campo se escribe a mano,
 * como en citas y mensajes: uno automático que se equivoca no falla, guarda el dato
 * en la columna equivocada y sigue andando.
 *
 * `fecha` se lee con componentes UTC: postgres.js la construye a medianoche UTC.
 */
function aEncuesta(fila: FilaEncuesta): Encuesta {
  const encuesta: Encuesta = {
    id: fila.id,
    calificacionServicio: fila.calificacion_servicio,
    calificacionInstalaciones: fila.calificacion_instalaciones,
    date: fila.fecha.toISOString().slice(0, 10),
    creadoEn: fila.creado_en.toISOString(),
  };
  if (fila.sugerencias !== null) encuesta.sugerencias = fila.sugerencias;
  return encuesta;
}

export class RepositorioEncuestasPostgres implements RepositorioEncuestas {
  private readonly sql: Sql;

  /** El cliente se inyecta en las pruebas; en producción se toma el del proceso. */
  constructor(sql: Sql = obtenerSql()) {
    this.sql = sql;
  }

  async crear(datos: NuevaEncuesta): Promise<Encuesta> {
    // `fecha` la calcula el servidor con la hora de COLOMBIA, no `current_date`
    // de Postgres (que corre en UTC). Ver el mismo comentario en mensajes.
    const filas = await this.sql<FilaEncuesta[]>`
      insert into cda.encuestas (calificacion_servicio, calificacion_instalaciones, sugerencias, fecha)
      values (${datos.calificacionServicio}, ${datos.calificacionInstalaciones}, ${datos.sugerencias ?? null}, ${fechaHoyEnColombia()})
      returning *
    `;

    const fila = filas[0];
    if (fila === undefined) {
      throw new Error("La inserción de la encuesta no devolvió ninguna fila.");
    }

    return aEncuesta(fila);
  }

  async listar(filtro: FiltroEncuestas = {}): Promise<Encuesta[]> {
    // Sin `limite` se aplica el tope por omisión, y no "todas": segunda red por si
    // algún código futuro llama al repositorio directo y se olvida de pedirlo.
    const limite = filtro.limite ?? LIMITES.listadoPorOmision;

    const filas = await this.sql<FilaEncuesta[]>`
      select * from cda.encuestas
      where (${filtro.desde ?? null}::date is null or fecha >= ${filtro.desde ?? null}::date)
        and (${filtro.hasta ?? null}::date is null or fecha <= ${filtro.hasta ?? null}::date)
      order by creado_en desc
      limit ${limite}
    `;

    return filas.map(aEncuesta);
  }

  async resumen(filtro: FiltroEncuestas = {}): Promise<ResumenEncuestas> {
    // `avg` de un smallint devuelve numeric, que postgres.js entrega como texto;
    // el cast a float8 lo entrega como número. Sin filas, `avg` devuelve null.
    const filas = await this.sql<
      { total: number; promedio_servicio: number | null; promedio_instalaciones: number | null }[]
    >`
      select
        count(*)::int                           as total,
        avg(calificacion_servicio)::float8      as promedio_servicio,
        avg(calificacion_instalaciones)::float8 as promedio_instalaciones
      from cda.encuestas
      where (${filtro.desde ?? null}::date is null or fecha >= ${filtro.desde ?? null}::date)
        and (${filtro.hasta ?? null}::date is null or fecha <= ${filtro.hasta ?? null}::date)
    `;

    const fila = filas[0];
    return {
      total: fila?.total ?? 0,
      promedioServicio: fila?.promedio_servicio ?? null,
      promedioInstalaciones: fila?.promedio_instalaciones ?? null,
    };
  }
}
