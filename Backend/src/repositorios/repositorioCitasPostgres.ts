import type { Sql } from "postgres";

import { obtenerSql } from "../basedatos/conexion.js";
import type { Cita, EstadoCita, FiltroCitas, NuevaCita, ResumenCitas, ResumenDeUnDia } from "../tipos/cita.js";
import type { EstadoPago } from "../tipos/pago.js";
import { estadoPagoInicial } from "../tipos/pago.js";
import type { CupoDeFranja } from "../tipos/franja.js";
import { CUPOS_POR_FRANJA, FRANJAS } from "../tipos/franja.js";
import { TIPOS_VEHICULO, type TipoVehiculo } from "../tipos/servicio.js";
import { LIMITES_CITA } from "../validacion/citas.js";
import type {
  EstadoDelComprobante,
  RepositorioCitas,
  ResultadoBorrado,
  ResultadoComprobante,
  ResultadoCreacion,
} from "./repositorioCitas.js";

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
  pago_estado: string;
  comprobante_ruta: string | null;
  comprobante_tipo: string | null;
  comprobante_subido_en: Date | null;
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
    pagoEstado: fila.pago_estado as EstadoPago,
    status: fila.estado as EstadoCita,
    creadoEn: fila.creado_en.toISOString(),
  };

  // `exactOptionalPropertyTypes`: la propiedad existe solo si hay correo. Un
  // cliente sin correo no tiene `email: null`, no tiene `email`.
  if (fila.correo !== null) cita.email = fila.correo;
  if (fila.cedula !== null) cita.cedula = fila.cedula;

  // La RUTA del archivo no sale de acá. `Cita` viaja al navegador de cualquiera
  // que agende, y una ruta de almacenamiento es justo lo que no debe viajar.
  if (fila.comprobante_subido_en !== null && fila.comprobante_tipo !== null) {
    cita.comprobante = {
      subidoEn: fila.comprobante_subido_en.toISOString(),
      tipo: fila.comprobante_tipo,
    };
  }

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
      //
      // `pago_estado` lo DERIVA el servidor del medio elegido, no lo manda el
      // cliente: si pudiera mandarlo, cualquiera podría agendar un pago en línea
      // y marcarlo 'verificado' de una vez.
      const filas = await sql<FilaCita[]>`
        insert into cda.citas (
          nombre_cliente, telefono, correo, cedula, placa, vehiculo,
          servicio_id, servicio_nombre, fecha, hora, pago, pago_estado
        ) values (
          ${datos.clientName}, ${datos.phone}, ${datos.email ?? null}, ${datos.cedula ?? null}, ${datos.plate}, ${datos.vehicle},
          ${datos.service}, ${datos.serviceName}, ${datos.date}, ${datos.time}, ${datos.payment},
          ${estadoPagoInicial(datos.payment)}
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

  async resumen(desde: string, hasta: string): Promise<ResumenCitas> {
    /*
     * UNA sola consulta agrupada, no una por número del reporte.
     *
     * Agrupar por (fecha, estado, vehículo) devuelve como mucho
     * días × 3 estados × 4 tipos de filas —para un mes lleno, unas trescientas
     * filas de puros conteos—. De ahí salen TODOS los cortes del resumen
     * sumando en memoria, que es gratis comparado con volver a la base.
     *
     * Y sobre todo: acá no viaja ni un nombre, ni un teléfono, ni un correo.
     * Solo fechas, etiquetas y números.
     */
    const filas = await this.sql<FilaDelResumen[]>`
      select
        to_char(fecha, 'YYYY-MM-DD') as fecha,
        estado,
        vehiculo,
        servicio_nombre,
        count(*)::int as total
      from cda.citas
      where fecha >= ${desde}::date
        and fecha <= ${hasta}::date
      group by fecha, estado, vehiculo, servicio_nombre
      order by fecha asc
    `;

    // Las placas distintas no salen del agrupamiento de arriba: contar valores
    // únicos que se reparten entre varios grupos exige preguntarlo aparte.
    const unicas = await this.sql<{ unicos: number }[]>`
      select count(distinct placa)::int as unicos
      from cda.citas
      where fecha >= ${desde}::date
        and fecha <= ${hasta}::date
    `;

    return armarResumen(desde, hasta, filas, unicas[0]?.unicos ?? 0);
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

  async adjuntarComprobante(id: string, ruta: string, tipo: string): Promise<ResultadoComprobante> {
    if (!ES_UUID.test(id)) return { resultado: "no-existe" };

    /*
     * Mirar si ya tiene y escribir van en UNA transacción con `for update`, por
     * el mismo motivo que en `borrar`: sin eso, dos envíos simultáneos del mismo
     * formulario ven los dos "no tiene comprobante" y el segundo pisa al primero.
     * Con el candado de fila, el segundo espera y sale por `ya-tiene`.
     *
     * Que el archivo ya esté subido al almacenamiento cuando llegamos acá es a
     * propósito: si esta transacción decide `ya-tiene`, lo que sobra es un
     * objeto huérfano en el bucket, que no le hace daño a nadie. Al revés
     * —marcar la fila y después fallar al subir— dejaría una cita diciendo que
     * tiene comprobante sin tenerlo.
     */
    return this.sql.begin(async (tx) => {
      const actuales = await tx<{ comprobante_ruta: string | null }[]>`
        select comprobante_ruta from cda.citas where id = ${id}::uuid for update
      `;

      const actual = actuales[0];
      if (actual === undefined) return { resultado: "no-existe" };
      if (actual.comprobante_ruta !== null) return { resultado: "ya-tiene" };

      const filas = await tx<FilaCita[]>`
        update cda.citas
        set comprobante_ruta = ${ruta},
            comprobante_tipo = ${tipo},
            comprobante_subido_en = now(),
            pago_estado = 'por-verificar',
            actualizado_en = now()
        where id = ${id}::uuid
        returning *
      `;

      const fila = filas[0];
      if (fila === undefined) return { resultado: "no-existe" };
      return { resultado: "adjuntado", cita: aCita(fila) };
    }) as Promise<ResultadoComprobante>;
  }

  async cambiarEstadoDePago(id: string, estado: EstadoPago): Promise<Cita | null> {
    if (!ES_UUID.test(id)) return null;

    const filas = await this.sql<FilaCita[]>`
      update cda.citas
      set pago_estado = ${estado}, actualizado_en = now()
      where id = ${id}::uuid
      returning *
    `;

    const fila = filas[0];
    return fila === undefined ? null : aCita(fila);
  }

  async estadoDelComprobante(id: string): Promise<EstadoDelComprobante> {
    if (!ES_UUID.test(id)) return { existe: false };

    // Solo la columna del comprobante: no hace falta leer nombre ni teléfono
    // para responder esto, así que no se leen.
    const filas = await this.sql<{ comprobante_ruta: string | null }[]>`
      select comprobante_ruta from cda.citas where id = ${id}::uuid
    `;

    const fila = filas[0];
    if (fila === undefined) return { existe: false };
    return { existe: true, ruta: fila.comprobante_ruta };
  }
}

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Convierte las filas agrupadas en el resumen que espera el panel.
 *
 * Vive fuera de la clase a propósito, igual que `aCita`: no toca la base, así
 * que es una transformación pura y se puede razonar —y probar— sin Postgres.
 */
/** Una fila del agrupamiento del resumen. */
interface FilaDelResumen {
  fecha: string;
  estado: string;
  vehiculo: string;
  servicio_nombre: string;
  total: number;
}

function armarResumen(
  desde: string,
  hasta: string,
  filas: FilaDelResumen[],
  vehiculosUnicos: number,
): ResumenCitas {
  const porEstado: Record<EstadoCita, number> = { pendiente: 0, atendida: 0, cancelada: 0 };

  // Se arranca de los CUATRO tipos en cero y no de los que aparecieron en las
  // filas: un tipo sin citas tiene que salir en cero, no desaparecer. Que no
  // haya venido ninguna moto es justamente lo que hay que poder ver.
  const porVehiculo: Record<string, number> = {};
  for (const tipo of TIPOS_VEHICULO) porVehiculo[tipo] = 0;

  const porServicio: Record<string, number> = {};
  const dias = new Map<string, ResumenDeUnDia>();
  let total = 0;

  for (const fila of filas) {
    total += fila.total;

    if (fila.estado === "pendiente" || fila.estado === "atendida" || fila.estado === "cancelada") {
      porEstado[fila.estado] += fila.total;
    }

    // Un vehículo que ya no está en la lista de tipos igual se cuenta: la cita
    // existió. Se agrega su clave en vez de perderla en un "otros" mudo.
    porVehiculo[fila.vehiculo] = (porVehiculo[fila.vehiculo] ?? 0) + fila.total;
    porServicio[fila.servicio_nombre] = (porServicio[fila.servicio_nombre] ?? 0) + fila.total;

    const dia = dias.get(fila.fecha) ?? {
      fecha: fila.fecha,
      total: 0,
      pendientes: 0,
      atendidas: 0,
      canceladas: 0,
    };
    dia.total += fila.total;
    if (fila.estado === "pendiente") dia.pendientes += fila.total;
    if (fila.estado === "atendida") dia.atendidas += fila.total;
    if (fila.estado === "cancelada") dia.canceladas += fila.total;
    dias.set(fila.fecha, dia);
  }

  return {
    desde,
    hasta,
    total,
    porEstado,
    porVehiculo,
    porServicio,
    // La consulta ya viene ordenada por fecha y un Map conserva el orden de
    // inserción, así que no hace falta volver a ordenar.
    porDia: [...dias.values()],
    vehiculosUnicos,
    cuposPorDia: FRANJAS.length * CUPOS_POR_FRANJA,
  };
}
