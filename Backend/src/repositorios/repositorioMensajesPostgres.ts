import type { Sql } from "postgres";

import { obtenerSql } from "../basedatos/conexion.js";
import type { FiltroMensajes, Mensaje, NuevoMensaje } from "../tipos/mensaje.js";
import { fechaHoyEnColombia } from "../utilidades/fecha.js";
import { LIMITES } from "../validacion/mensajes.js";
import type { RepositorioMensajes } from "./repositorioMensajes.js";

/**
 * Implementación de `RepositorioMensajes` sobre Postgres.
 *
 * Implementa la interfaz TAL COMO ESTÁ, sin cambiarla ni aprovechar la mudanza
 * para rediseñar el tipo `Mensaje`. Mezclar una migración de datos con un cambio
 * de contrato es cómo se pierden datos sin saber cuál de los dos cambios tuvo la
 * culpa. Si algo del modelo hay que mejorar, se mejora después, con los datos ya
 * mudados y verificados.
 *
 * El mapeo columna↔campo se escribe a mano, igual que en las citas y por el mismo
 * motivo: un mapeo automático que se equivoca no falla, guarda el dato en la
 * columna equivocada y sigue andando.
 */

/** Cómo vuelve una fila de `cda.mensajes` desde Postgres. */
interface FilaMensaje {
  id: string;
  nombre: string;
  correo: string;
  mensaje: string;
  fecha: Date;
  creado_en: Date;
}

/**
 * Traduce una fila a la forma que el panel ya renderiza.
 *
 * `fecha` vuelve como `Date` porque la columna es `date`, y hay que formatearla
 * de nuevo a 'YYYY-MM-DD'. Se usan los componentes UTC a propósito: postgres.js
 * la construye a medianoche UTC, así que leerla con métodos locales en un
 * servidor al oeste de Greenwich devolvería el día anterior.
 */
function aMensaje(fila: FilaMensaje): Mensaje {
  return {
    id: fila.id,
    name: fila.nombre,
    email: fila.correo,
    message: fila.mensaje,
    date: fila.fecha.toISOString().slice(0, 10),
    creadoEn: fila.creado_en.toISOString(),
  };
}

export class RepositorioMensajesPostgres implements RepositorioMensajes {
  private readonly sql: Sql;

  /** El cliente se inyecta en las pruebas; en producción se toma el del proceso. */
  constructor(sql: Sql = obtenerSql()) {
    this.sql = sql;
  }

  async crear(datos: NuevoMensaje): Promise<Mensaje> {
    /*
     * `fecha` la calcula el servidor con la hora de COLOMBIA y no se delega a un
     * `current_date` de Postgres. La base corre en UTC: después de las 19:00 de
     * Valledupar, `current_date` ya pasó al día siguiente y el mensaje quedaría
     * fechado mañana. Es el mismo error que ya se corrigió en el frontend con
     * fechaHoyLocal().
     *
     * `id` y `creado_en` sí los pone la base (ver los DEFAULT de la migración
     * 001): son valores que no dependen de ninguna zona horaria.
     */
    const filas = await this.sql<FilaMensaje[]>`
      insert into cda.mensajes (nombre, correo, mensaje, fecha)
      values (${datos.name}, ${datos.email}, ${datos.message}, ${fechaHoyEnColombia()})
      returning *
    `;

    const fila = filas[0];
    if (fila === undefined) {
      // `insert ... returning` siempre devuelve la fila insertada; si no lo hizo,
      // algo se rompió de una forma que no conviene disimular.
      throw new Error("La inserción del mensaje no devolvió ninguna fila.");
    }

    return aMensaje(fila);
  }

  async listar(filtro: FiltroMensajes = {}): Promise<Mensaje[]> {
    /*
     * Sin `limite` se aplica el tope por omisión, y no "todos". La
     * implementación en archivo devolvía todo cuando no se le pedía tope; contra
     * una base eso es una sola consulta llevándose el listado entero de datos
     * personales. La ruta ya manda siempre un tope (ver validarFiltroMensajes),
     * así que esto es la segunda red: la que protege a cualquier código futuro
     * que llame al repositorio directo y se olvide.
     */
    const limite = filtro.limite ?? LIMITES.listadoPorOmision;

    /*
     * Los filtros son opcionales y se resuelven dentro del `where` comparando
     * contra null, en vez de armar la consulta por concatenación. Así el SQL es
     * uno solo y no hay ningún punto donde un valor del cliente se pegue al
     * texto de la consulta.
     */
    const filas = await this.sql<FilaMensaje[]>`
      select * from cda.mensajes
      where (${filtro.desde ?? null}::date is null or fecha >= ${filtro.desde ?? null}::date)
        and (${filtro.hasta ?? null}::date is null or fecha <= ${filtro.hasta ?? null}::date)
      order by creado_en desc
      limit ${limite}
    `;

    return filas.map(aMensaje);
  }
}
