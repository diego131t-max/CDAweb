import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TIPOS_VEHICULO, servicioAplicaAVehiculo, type TipoVehiculo } from "../tipos/servicio.js";
import { RepositorioServiciosEstatico } from "./repositorioServiciosEstatico.js";

// Los seis servicios de FR-008, con el nombre exacto que publica el sitio.
// Este arreglo es a propósito una copia literal y no se deriva del catálogo:
// si alguien renombra un servicio en el código, el test tiene que fallar y
// obligar a confirmar el cambio con el propietario (principio I).
const NOMBRES_ESPERADOS = [
  "Revisión Técnico-Mecánica",
  "Revisión de Gases",
  "Inspección de Luces y Frenos",
  "Peritaje Vehicular",
  "Certificado de Blindaje",
  "Diagnóstico Electrónico",
];

const MOTOS: TipoVehiculo[] = ["Motos 2T", "Motos 4T"];
const NO_MOTOS: TipoVehiculo[] = ["Vehículos Livianos", "Vehículos Pesados"];
const ID_BLINDAJE = "certificado-de-blindaje";

/** Los servicios que se le pueden ofrecer a un vehículo, según FR-009. */
async function disponiblesPara(vehiculo: TipoVehiculo): Promise<string[]> {
  const servicios = await new RepositorioServiciosEstatico().listar();
  return servicios.filter((servicio) => servicioAplicaAVehiculo(servicio, vehiculo)).map((s) => s.id);
}

describe("catálogo de servicios (FR-008)", () => {
  it("contiene exactamente los seis servicios que publica el sitio", async () => {
    const servicios = await new RepositorioServiciosEstatico().listar();

    assert.equal(servicios.length, 6);
    assert.deepEqual(
      servicios.map((servicio) => servicio.nombre),
      NOMBRES_ESPERADOS,
    );
  });

  it("da a cada servicio un id estable, único y sin acentos ni espacios", async () => {
    const servicios = await new RepositorioServiciosEstatico().listar();
    const ids = servicios.map((servicio) => servicio.id);

    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) {
      assert.match(id, /^[a-z0-9-]+$/, `el id '${id}' debe ser minúsculas, dígitos y guiones`);
    }
  });

  it("busca por id y devuelve null para un servicio que no existe", async () => {
    const repositorio = new RepositorioServiciosEstatico();

    assert.equal((await repositorio.obtenerPorId(ID_BLINDAJE))?.nombre, "Certificado de Blindaje");
    assert.equal(await repositorio.obtenerPorId("lavado-de-motor"), null);
    assert.equal(await repositorio.obtenerPorId(""), null);
  });

  // El catálogo es una constante compartida por todas las peticiones: si un
  // llamador la mutara, contaminaría al resto del proceso.
  it("no deja que quien recibe el catálogo lo mute", async () => {
    const repositorio = new RepositorioServiciosEstatico();

    const servicios = await repositorio.listar();
    servicios[0]!.nombre = "Nombre alterado";
    servicios[0]!.vehiculosExcluidos.push("Vehículos Pesados");

    const frescos = await repositorio.listar();
    assert.equal(frescos[0]?.nombre, NOMBRES_ESPERADOS[0]);
    assert.deepEqual(frescos[0]?.vehiculosExcluidos, []);
  });
});

describe("regla de exclusión servicio/vehículo (FR-009)", () => {
  it("no ofrece certificado de blindaje a las motos", async () => {
    for (const moto of MOTOS) {
      const disponibles = await disponiblesPara(moto);
      assert.equal(
        disponibles.includes(ID_BLINDAJE),
        false,
        `certificado de blindaje no debe estar disponible para ${moto}`,
      );
      assert.equal(disponibles.length, 5, `${moto} debe tener cinco servicios disponibles`);
    }
  });

  it("ofrece los seis servicios a livianos y pesados", async () => {
    for (const vehiculo of NO_MOTOS) {
      const disponibles = await disponiblesPara(vehiculo);
      assert.equal(disponibles.length, 6, `${vehiculo} debe tener los seis servicios disponibles`);
      assert.equal(disponibles.includes(ID_BLINDAJE), true);
    }
  });

  // El riesgo real acá es que alguien agregue exclusiones "razonables" que el
  // negocio nunca pidió. La spec es explícita: blindaje en motos es la única.
  it("no tiene ninguna otra exclusión en todo el catálogo", async () => {
    const servicios = await new RepositorioServiciosEstatico().listar();

    for (const servicio of servicios) {
      if (servicio.id === ID_BLINDAJE) {
        assert.deepEqual(servicio.vehiculosExcluidos, MOTOS);
        continue;
      }
      assert.deepEqual(
        servicio.vehiculosExcluidos,
        [],
        `'${servicio.nombre}' no debe excluir ningún tipo de vehículo`,
      );
    }
  });

  it("cubre los cuatro tipos de vehículo sin dejar ninguno sin servicios", async () => {
    assert.equal(TIPOS_VEHICULO.length, 4);

    for (const vehiculo of TIPOS_VEHICULO) {
      assert.ok((await disponiblesPara(vehiculo)).length > 0, `${vehiculo} se quedó sin servicios`);
    }
  });
});

describe("servicioAplicaAVehiculo", () => {
  it("aplica cuando el vehículo no está excluido", () => {
    const servicio = { id: "x", nombre: "X", vehiculosExcluidos: [] };
    for (const vehiculo of TIPOS_VEHICULO) {
      assert.equal(servicioAplicaAVehiculo(servicio, vehiculo), true);
    }
  });

  it("no aplica cuando el vehículo está excluido", () => {
    const servicio = { id: "x", nombre: "X", vehiculosExcluidos: ["Motos 2T" as TipoVehiculo] };

    assert.equal(servicioAplicaAVehiculo(servicio, "Motos 2T"), false);
    assert.equal(servicioAplicaAVehiculo(servicio, "Motos 4T"), true);
  });
});
