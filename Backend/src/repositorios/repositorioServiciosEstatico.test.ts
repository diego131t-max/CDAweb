import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TIPOS_VEHICULO, servicioAplicaAVehiculo, type TipoVehiculo } from "../tipos/servicio.js";
import { RepositorioServiciosEstatico } from "./repositorioServiciosEstatico.js";

// El único servicio de FR-008, con el nombre exacto que publica el sitio.
// Este arreglo es a propósito una copia literal y no se deriva del catálogo:
// si alguien renombra un servicio en el código, el test tiene que fallar y
// obligar a confirmar el cambio con el propietario (principio I).
const NOMBRES_ESPERADOS = ["Revisión Técnico-Mecánica y de Gases"];

const ID_RTM = "revision-tecnico-mecanica";

// Los cinco que el catálogo tuvo hasta el 2026-08-21 y que el CDA no presta.
// Se listan por id para comprobar que el API los RECHAZA: mientras estuvieron,
// el sitio ofreció servicios inexistentes, y una cita con cualquiera de estos no
// se puede volver a registrar.
const IDS_RETIRADOS = [
  "revision-de-gases",
  "inspeccion-de-luces-y-frenos",
  "peritaje-vehicular",
  "certificado-de-blindaje",
  "diagnostico-electronico",
];

/** Los servicios que se le pueden ofrecer a un vehículo, según FR-009. */
async function disponiblesPara(vehiculo: TipoVehiculo): Promise<string[]> {
  const servicios = await new RepositorioServiciosEstatico().listar();
  return servicios.filter((servicio) => servicioAplicaAVehiculo(servicio, vehiculo)).map((s) => s.id);
}

describe("catálogo de servicios (FR-008)", () => {
  it("contiene exactamente el servicio que publica el sitio", async () => {
    const servicios = await new RepositorioServiciosEstatico().listar();

    assert.equal(servicios.length, 1);
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

  // El nombre cambió (antes no mencionaba los gases) y el id NO. Es la razón de
  // que se agende por id: si el id hubiera seguido al nombre, cada cita ya
  // registrada habría quedado apuntando a un servicio inexistente.
  it("conserva el id aunque el nombre haya cambiado", async () => {
    const servicio = await new RepositorioServiciosEstatico().obtenerPorId(ID_RTM);

    assert.equal(servicio?.id, ID_RTM);
    assert.equal(servicio?.nombre, NOMBRES_ESPERADOS[0]);
  });

  it("busca por id y devuelve null para un servicio que no existe", async () => {
    const repositorio = new RepositorioServiciosEstatico();

    assert.equal((await repositorio.obtenerPorId(ID_RTM))?.nombre, NOMBRES_ESPERADOS[0]);
    assert.equal(await repositorio.obtenerPorId("lavado-de-motor"), null);
    assert.equal(await repositorio.obtenerPorId(""), null);
  });

  // Lo que este test protege no es el catálogo: es que no se pueda volver a
  // agendar uno de los cinco servicios que el CDA no presta. rutas/citas.ts
  // rechaza la cita justamente cuando obtenerPorId devuelve null (FR-005).
  it("rechaza los cinco servicios retirados", async () => {
    const repositorio = new RepositorioServiciosEstatico();

    for (const id of IDS_RETIRADOS) {
      assert.equal(await repositorio.obtenerPorId(id), null, `'${id}' ya no debe existir en el catálogo`);
    }
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
  // Hoy el catálogo no tiene ninguna exclusión: la única que hubo —certificado
  // de blindaje no aplica a motos— se fue con el servicio. El test se conserva
  // porque el riesgo que cubre no cambió: que alguien agregue exclusiones
  // "razonables" que el negocio nunca pidió.
  it("no tiene ninguna exclusión en todo el catálogo", async () => {
    const servicios = await new RepositorioServiciosEstatico().listar();

    for (const servicio of servicios) {
      assert.deepEqual(
        servicio.vehiculosExcluidos,
        [],
        `'${servicio.nombre}' no debe excluir ningún tipo de vehículo`,
      );
    }
  });

  it("ofrece el catálogo completo a los cuatro tipos de vehículo", async () => {
    assert.equal(TIPOS_VEHICULO.length, 4);

    for (const vehiculo of TIPOS_VEHICULO) {
      const disponibles = await disponiblesPara(vehiculo);
      assert.equal(disponibles.length, 1, `${vehiculo} debe tener el único servicio disponible`);
      assert.deepEqual(disponibles, [ID_RTM]);
    }
  });
});

// Estas dos NO dependen del catálogo: prueban la función que hace cumplir la
// regla. Se conservan aunque hoy no haya ninguna exclusión, porque son las que
// garantizan que la maquinaria siga funcionando el día que vuelva a haber un
// servicio que no aplique a todos los vehículos.
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
