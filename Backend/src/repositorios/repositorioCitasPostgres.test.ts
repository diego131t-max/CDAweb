import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Sql } from "postgres";

import type { NuevaCita } from "../tipos/cita.js";
import { claveDelCandado, RepositorioCitasPostgres } from "./repositorioCitasPostgres.js";

/**
 * Guardián del ORDEN del listado de citas.
 *
 * Se prueba con un cliente de base falso que solo captura el texto de la consulta:
 * el orden vive en el SQL, y las otras pruebas usan un repositorio en memoria que
 * ni siquiera pasa por él. Sin esto, volver a `order by fecha asc` pasaría la suite
 * entera y el panel volvería a esconder las citas próximas apenas hubiera más de
 * 200, sin que nada se pusiera rojo.
 */
function clienteQueCaptura(consultas: string[]): Sql {
  const cliente = (plantilla: TemplateStringsArray): Promise<unknown[]> => {
    consultas.push(plantilla.join("?"));
    return Promise.resolve([]);
  };
  return cliente as unknown as Sql;
}

/** Una consulta capturada: el texto con `?` en lugar de los valores, y los valores aparte. */
interface Consulta {
  texto: string;
  valores: unknown[];
}

function normalizar(texto: string | undefined): string {
  return String(texto).replace(/\s+/g, " ");
}

/**
 * Cliente falso que alcanza para `crear` y `disponibilidad`: soporta `begin` (corre
 * la función con el mismo cliente, sin transacción de verdad), devuelve `horas`
 * cuando le piden las horas del día y una fila completa cuando le piden insertar.
 *
 * Lo que NO puede probar es que el candado serialice de verdad: eso es de
 * Postgres, y se verificó contra Supabase con la cita CUP001 cuando se escribió
 * la primera versión. Lo que sí fija es QUÉ clave se toma y en qué orden van las
 * consultas, que es donde vive el error que se arregló el 2026-10-15.
 */
function clienteDeTransaccion(horas: string[], consultas: Consulta[]): Sql {
  const cliente = (plantilla: TemplateStringsArray, ...valores: unknown[]): Promise<unknown[]> => {
    const texto = normalizar(plantilla.join("?"));
    consultas.push({ texto, valores });
    if (texto.includes("select to_char(hora")) return Promise.resolve(horas.map((hora) => ({ hora })));
    if (texto.includes("insert into cda.citas")) {
      return Promise.resolve([
        {
          id: "11111111-2222-3333-4444-555555555555",
          nombre_cliente: "Cliente De Prueba",
          telefono: "3166962144",
          correo: null,
          cedula: null,
          placa: "ABC123",
          vehiculo: "Vehículos Livianos",
          servicio_id: "revision-tecnico-mecanica",
          servicio_nombre: "Revisión Técnico-Mecánica y de Gases",
          fecha: new Date("2099-12-01T00:00:00Z"),
          hora: String(valores[9]) + ":00",
          pago: "Efectivo",
          pago_estado: "no-aplica",
          uso: null,
          anio_matricula: null,
          valor: null,
          comprobante_ruta: null,
          comprobante_tipo: null,
          comprobante_subido_en: null,
          estado: "pendiente",
          creado_en: new Date("2099-11-01T00:00:00Z"),
        },
      ]);
    }
    return Promise.resolve([]);
  };
  const conBegin = Object.assign(cliente, {
    begin: <T>(funcion: (sql: unknown) => Promise<T>): Promise<T> => funcion(cliente),
  });
  return conBegin as unknown as Sql;
}

describe("RepositorioCitasPostgres.listar", () => {
  it("ordena de la cita más nueva a la más antigua", async () => {
    const consultas: string[] = [];
    const repositorio = new RepositorioCitasPostgres(clienteQueCaptura(consultas));

    await repositorio.listar({ limite: 5 });

    assert.equal(consultas.length, 1);
    const consulta = String(consultas[0]).replace(/\s+/g, " ");
    assert.match(consulta, /order by fecha desc, hora desc/);
    assert.doesNotMatch(consulta, /order by fecha asc/);
    // El tope se aplica DESPUÉS de ordenar: es lo que hace que se caiga lo viejo.
    assert.ok(consulta.indexOf("order by") < consulta.indexOf("limit"), "primero se ordena y luego se corta");
  });
});

describe("RepositorioCitasPostgres.disponibilidad", () => {
  // La regla por día vive en `franjasDelDia`, pero es el repositorio el que la
  // aplica al armar la respuesta. Se prueba con un cliente falso que no devuelve
  // ninguna cita: lo único que importa acá es QUÉ horas dibuja, no cuántas están
  // ocupadas.
  const sinCitas = (): Sql => clienteQueCaptura([]);

  it("un día hábil devuelve veinte horas, de 07:30 a 17:00, todas con cupo y con su fin", async () => {
    const franjas = await new RepositorioCitasPostgres(sinCitas()).disponibilidad("2026-10-07");
    assert.equal(franjas.length, 20);
    assert.deepEqual(franjas[0], { hora: "07:30", fin: "08:30", ocupados: 0, disponibles: 2 });
    assert.equal(franjas.at(-1)?.hora, "17:00");
    assert.ok(franjas.every((franja) => franja.disponibles === 2));
  });

  it("un sábado va de 07:30 a 12:30", async () => {
    const franjas = await new RepositorioCitasPostgres(sinCitas()).disponibilidad("2026-10-10");
    assert.equal(franjas[0]?.hora, "07:30");
    assert.equal(franjas.at(-1)?.hora, "12:30");
  });

  it("un festivo devuelve siete y un domingo ninguna", async () => {
    const repositorio = new RepositorioCitasPostgres(sinCitas());
    assert.equal((await repositorio.disponibilidad("2026-05-18")).length, 7);
    assert.equal((await repositorio.disponibilidad("2026-10-11")).length, 0);
  });

  it("cuenta por solapamiento con las horas que devuelve la base, sin agrupar por hora", async () => {
    const consultas: Consulta[] = [];
    const repositorio = new RepositorioCitasPostgres(clienteDeTransaccion(["09:00", "09:30"], consultas));
    const franjas = await repositorio.disponibilidad("2099-12-01");
    const de = (hora: string) => franjas.find((franja) => franja.hora === hora)?.disponibles;

    assert.deepEqual([de("08:30"), de("09:00"), de("09:30"), de("10:00")], [1, 0, 0, 1]);

    const consulta = normalizar(consultas[0]?.texto);
    // Solo la columna `hora`: el endpoint que la usa es público.
    assert.match(consulta, /select to_char\(hora, 'HH24:MI'\) as hora from cda\.citas/);
    assert.match(consulta, /estado <> 'cancelada'/);
    assert.doesNotMatch(consulta, /group by/, "la regla necesita una fila por carro, no un conteo por hora exacta");
  });
});

describe("RepositorioCitasPostgres.crear — candado y cupo", () => {
  const nueva = (time: string): NuevaCita => ({
    clientName: "Cliente De Prueba",
    phone: "3166962144",
    plate: "ABC123",
    vehicle: "Vehículos Livianos",
    service: "revision-tecnico-mecanica",
    serviceName: "Revisión Técnico-Mecánica y de Gases",
    date: "2099-12-01",
    time,
    payment: "Efectivo",
  });

  it("toma el candado POR DÍA, no por hora: las 9:00 y las 9:30 compiten por el mismo cupo", async () => {
    const consultas: Consulta[] = [];
    const repositorio = new RepositorioCitasPostgres(clienteDeTransaccion([], consultas));

    await repositorio.crear(nueva("09:00"));
    await repositorio.crear(nueva("09:30"));

    const candados = consultas.filter((consulta) => consulta.texto.includes("pg_advisory_xact_lock"));
    assert.equal(candados.length, 2);
    // Las dos horas tienen que tomar la MISMA clave; si la clave incluyera la hora,
    // dos envíos simultáneos a las 9:00 y a las 9:30 contarían sin verse.
    assert.deepEqual(candados[0]?.valores, candados[1]?.valores);
    assert.deepEqual(candados[0]?.valores, [claveDelCandado("2099-12-01")]);
    assert.ok(!String(candados[0]?.valores[0]).includes("09:00"), "la clave del candado no lleva la hora");
  });

  it("primero el candado, después leer las horas, y por último insertar", async () => {
    const consultas: Consulta[] = [];
    await new RepositorioCitasPostgres(clienteDeTransaccion([], consultas)).crear(nueva("09:00"));

    const indice = (fragmento: string) => consultas.findIndex((consulta) => consulta.texto.includes(fragmento));
    assert.ok(indice("pg_advisory_xact_lock") < indice("select to_char(hora"));
    assert.ok(indice("select to_char(hora") < indice("insert into cda.citas"));
  });

  it("rechaza sin insertar cuando la hora se cruza con dos carros", async () => {
    const consultas: Consulta[] = [];
    const repositorio = new RepositorioCitasPostgres(clienteDeTransaccion(["09:00", "09:30"], consultas));

    const resultado = await repositorio.crear(nueva("09:00"));

    assert.deepEqual(resultado, { resultado: "franja-llena", ocupados: 2 });
    assert.ok(!consultas.some((consulta) => consulta.texto.includes("insert into")), "no se inserta lo que no cabe");
  });

  it("inserta cuando cabe, aunque haya citas a otras horas del día", async () => {
    const consultas: Consulta[] = [];
    const repositorio = new RepositorioCitasPostgres(clienteDeTransaccion(["09:00", "09:30"], consultas));

    const resultado = await repositorio.crear(nueva("10:00"));

    assert.equal(resultado.resultado, "creada");
    assert.ok(consultas.some((consulta) => consulta.texto.includes("insert into cda.citas")));
  });
});
