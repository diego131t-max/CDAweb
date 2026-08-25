import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { BANDAS, TARIFAS, bandaDeAnio, categoriaDeTarifa, valorDeLaCita } from "./tarifa.js";

/**
 * EL GUARDIÁN DE LA DUPLICACIÓN.
 *
 * La tabla de tarifas vive en dos lados: `Frontend/data.js`, que es la fuente que
 * entregó el propietario y la que el sitio publica, y `tipos/tarifa.ts`, que es
 * con la que el servidor calcula lo que se guarda en la cita.
 *
 * Duplicar un precio es peligroso: si las dos copias se separan, el sitio cotiza
 * una cifra, el panel muestra otra, y nadie se entera hasta que un cliente
 * reclame. Esta prueba lee el archivo del frontend y compara número por número.
 *
 * SI ESTA PRUEBA FALLA, no la ajustes: alguien cambió una tabla y no la otra.
 * Averiguá cuál es la correcta —la del frontend es la fuente— y sincronizá.
 */

function leerDataJs(): string {
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  return readFileSync(path.resolve(aqui, "../../../Frontend/data.js"), "utf8");
}

/** Saca del frontend, por categoría, la suma de componentes y el ansv por banda. */
function tarifasDelFrontend(fuente: string): Record<string, { base: number; ansv: Record<string, number> }> {
  const desde = fuente.indexOf("const TARIFAS_RTMYEC");
  const hasta = fuente.indexOf("const COMPONENTES_RTMYEC");
  assert.ok(desde !== -1 && hasta > desde, "no se encontró TARIFAS_RTMYEC en Frontend/data.js");
  const bloque = fuente.slice(desde, hasta);

  const salida: Record<string, { base: number; ansv: Record<string, number> }> = {};
  const patron = /id: "([\w-]+)",[\s\S]*?componentes: \{([^}]+)\},\s*\n\s*ansv: \{([^}]+)\}/g;

  for (const coincidencia of bloque.matchAll(patron)) {
    const id = coincidencia[1] as string;
    const base = [...(coincidencia[2] as string).matchAll(/:\s*(\d+)/g)].reduce(
      (suma, n) => suma + Number(n[1]),
      0,
    );
    const ansv: Record<string, number> = {};
    for (const par of (coincidencia[3] as string).matchAll(/"([\w+-]+)":\s*(\d+)/g)) {
      ansv[par[1] as string] = Number(par[2]);
    }
    salida[id] = { base, ansv };
  }
  return salida;
}

describe("la tabla del servidor no se separó de la del sitio", () => {
  const delFrontend = tarifasDelFrontend(leerDataJs());

  it("encuentra las cinco categorías en Frontend/data.js", () => {
    // Si esto falla, cambió la FORMA del archivo del frontend y el resto de esta
    // prueba estaría comparando contra un objeto vacío —o sea, pasando sola—.
    assert.equal(Object.keys(delFrontend).length, 5, "se esperaban 5 categorías");
  });

  it("tiene exactamente las mismas categorías", () => {
    assert.deepEqual(Object.keys(TARIFAS).sort(), Object.keys(delFrontend).sort());
  });

  it("cada componente base coincide al peso", () => {
    for (const [id, tarifa] of Object.entries(TARIFAS)) {
      assert.equal(tarifa.base, delFrontend[id]?.base, `la base de '${id}' no coincide`);
    }
  });

  it("cada ANSV coincide al peso, banda por banda", () => {
    for (const [id, tarifa] of Object.entries(TARIFAS)) {
      assert.deepEqual(tarifa.ansv, delFrontend[id]?.ansv, `el ANSV de '${id}' no coincide`);
    }
  });

  it("las bandas del servidor cubren los mismos años", () => {
    const bloque = leerDataJs();
    const desde = bloque.indexOf("const BANDAS_MATRICULA");
    const crudo = bloque.slice(desde, bloque.indexOf("];", desde));
    for (const banda of BANDAS) {
      assert.ok(crudo.includes(`"${banda.id}"`), `la banda '${banda.id}' no está en el frontend`);
      assert.ok(crudo.includes(`hasta: ${banda.hasta}`), `el tope de '${banda.id}' no coincide`);
    }
  });
});

describe("valorDeLaCita", () => {
  it("suma la base y el ANSV de la banda que toca", () => {
    // 2020 en vigencia 2026 son 6 años: banda "3-7". 308528 + 9300 = 317828.
    assert.equal(valorDeLaCita("Vehículos Livianos", "particular", 2020), 317828);
    // Mismos componentes, ANSV público de esa banda: 308528 + 8700.
    assert.equal(valorDeLaCita("Vehículos Livianos", "publico", 2020), 317228);
  });

  it("particular y público NO dan lo mismo: por eso se pregunta", () => {
    const particular = valorDeLaCita("Vehículos Pesados", "particular", 2015);
    const publico = valorDeLaCita("Vehículos Pesados", "publico", 2015);
    assert.notEqual(particular, publico);
  });

  it("las motos no necesitan uso: tienen una sola categoría", () => {
    assert.equal(valorDeLaCita("Motos 2T", undefined, 2020), valorDeLaCita("Motos 4T", undefined, 2020));
    assert.equal(categoriaDeTarifa("Motos 4T", undefined), "motos");
  });

  it("un liviano SIN uso no da precio, en vez de suponer 'particular'", () => {
    // Suponerlo le cobraría de más a un taxi sin que nadie lo note.
    assert.equal(valorDeLaCita("Vehículos Livianos", undefined, 2020), null);
  });

  it("sin año no hay precio", () => {
    assert.equal(valorDeLaCita("Vehículos Livianos", "particular", undefined), null);
  });

  it("un año fuera de la tabla NO inventa un precio", () => {
    // 2027 con la tabla de 2026: se devuelve null y la cita queda sin valor, que
    // es honesto. Un precio aproximado sería un dato inventado (principio I).
    assert.equal(bandaDeAnio(2027), null);
    assert.equal(valorDeLaCita("Vehículos Livianos", "particular", 2027), null);
  });

  it("los años viejos caen todos en la última banda", () => {
    assert.equal(bandaDeAnio(1998), "18+");
    assert.equal(bandaDeAnio(2009), "18+");
    assert.equal(bandaDeAnio(2010), "8-17");
  });
});
