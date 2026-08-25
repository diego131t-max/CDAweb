import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BANDAS,
  CATEGORIAS_TARIFA,
  COMPONENTES_TARIFA,
  bandaDeAnio,
  categoriaDeTarifa,
  usoAplica,
  valorDeLaCita,
} from "./tarifa.js";

/*
 * Acá vivía un guardián que leía `Frontend/data.js` y comparaba número por
 * número, porque la tabla estaba duplicada en los dos lados. Ya no hace falta:
 * la tabla vive SOLO acá y el sitio la consume por `GET /api/tarifas`. La
 * duplicación se eliminó en vez de vigilarla.
 */

describe("la tabla de tarifas", () => {
  it("tiene las cinco categorías que presta el CDA", () => {
    assert.deepEqual(
      CATEGORIAS_TARIFA.map((c) => c.id).sort(),
      ["liviano-particular", "liviano-publico", "motos", "pesado-particular", "pesado-publico"],
    );
  });

  it("cada categoría tiene ANSV para las cuatro bandas", () => {
    // Si a una le faltara una banda, `valorDeLaCita` devolvería null justo para
    // los vehículos de ese rango de años y nadie sabría por qué.
    for (const categoria of CATEGORIAS_TARIFA) {
      for (const banda of BANDAS) {
        assert.equal(
          typeof categoria.ansv[banda.id],
          "number",
          `a '${categoria.id}' le falta el ANSV de la banda '${banda.id}'`,
        );
      }
    }
  });

  it("las bandas cubren cualquier año sin huecos ni solapes", () => {
    for (let anio = 1990; anio <= 2026; anio += 1) {
      const encontradas = BANDAS.filter((b) => anio <= b.hasta && (b.desde === null || anio >= b.desde));
      assert.equal(encontradas.length, 1, `el año ${anio} cae en ${encontradas.length} bandas`);
    }
  });

  it("el desglose que se publica tiene los ocho renglones", () => {
    // Siete componentes fijos más el ANSV. Es lo que muestra /tarifas.
    assert.equal(COMPONENTES_TARIFA.length, 8);
    assert.equal(COMPONENTES_TARIFA[COMPONENTES_TARIFA.length - 1]?.[0], "ansv");
  });

  it("ningún precio es cero ni negativo", () => {
    for (const categoria of CATEGORIAS_TARIFA) {
      for (const [clave, monto] of Object.entries(categoria.componentes)) {
        assert.ok(monto > 0, `'${categoria.id}.${clave}' es ${monto}`);
      }
      for (const [banda, monto] of Object.entries(categoria.ansv)) {
        assert.ok(monto > 0, `'${categoria.id}.ansv.${banda}' es ${monto}`);
      }
    }
  });
});

describe("valorDeLaCita", () => {
  it("suma los siete componentes fijos más el ANSV de la banda", () => {
    // Sumado a mano desde la tabla del propietario: 216043 + 41048 + 5600 +
    // 29825 + 5667 + 8693 + 1652 = 308528. Un 2020 en vigencia 2026 son 6 años,
    // o sea banda "3-7", cuyo ANSV particular es 9300.
    assert.equal(valorDeLaCita("Vehículos Livianos", "particular", 2020), 317828);
    // Mismos componentes, ANSV público de esa banda: 8700.
    assert.equal(valorDeLaCita("Vehículos Livianos", "publico", 2020), 317228);
  });

  it("particular y público NO dan lo mismo: por eso se pregunta", () => {
    assert.notEqual(
      valorDeLaCita("Vehículos Pesados", "particular", 2015),
      valorDeLaCita("Vehículos Pesados", "publico", 2015),
    );
  });

  it("las motos no necesitan uso: tienen una sola categoría", () => {
    assert.equal(valorDeLaCita("Motos 2T", undefined, 2020), valorDeLaCita("Motos 4T", undefined, 2020));
    assert.equal(categoriaDeTarifa("Motos 4T", undefined), "motos");
    assert.equal(usoAplica("Motos 2T"), false);
    assert.equal(usoAplica("Vehículos Livianos"), true);
  });

  it("un liviano SIN uso no da precio, en vez de suponer 'particular'", () => {
    // Suponerlo le cobraría de más a un taxi sin que nadie lo note.
    assert.equal(valorDeLaCita("Vehículos Livianos", undefined, 2020), null);
  });

  it("sin año no hay precio", () => {
    assert.equal(valorDeLaCita("Vehículos Livianos", "particular", undefined), null);
  });

  it("un año fuera de la tabla NO inventa un precio", () => {
    // Un precio aproximado sería un dato inventado (principio I). La cita se
    // registra igual, con el valor en null.
    assert.equal(bandaDeAnio(2027), null);
    assert.equal(valorDeLaCita("Vehículos Livianos", "particular", 2027), null);
  });

  it("los años viejos caen todos en la última banda", () => {
    assert.equal(bandaDeAnio(1998), "18+");
    assert.equal(bandaDeAnio(2009), "18+");
    assert.equal(bandaDeAnio(2010), "8-17");
  });
});
