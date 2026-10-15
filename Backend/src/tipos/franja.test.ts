import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aMinutos,
  CUPOS_POR_DIA_HABIL,
  CUPOS_SIMULTANEOS,
  cupoDeFranja,
  cupoParaHora,
  cuposDelDia,
  DURACION_MINUTOS,
  esFranjaDelDia,
  FRANJAS,
  franjasDelDia,
  ocupacionMaxima,
  rangoLegible,
  tipoDeDia,
} from "./franja.js";

describe("tipoDeDia", () => {
  it("distingue hábil, sábado, festivo y domingo", () => {
    assert.equal(tipoDeDia("2026-10-07"), "habil"); // miércoles
    assert.equal(tipoDeDia("2026-10-10"), "sabado");
    assert.equal(tipoDeDia("2026-10-11"), "domingo");
    assert.equal(tipoDeDia("2026-05-18"), "festivo"); // lunes de la Ascensión
  });

  it("el domingo gana sobre el festivo: un festivo en domingo sigue cerrado", () => {
    // 20 de julio de 2025 fue domingo y es festivo fijo.
    assert.equal(tipoDeDia("2025-07-20"), "domingo");
  });

  it("el festivo gana sobre el sábado", () => {
    // 1 de mayo de 2027 cae sábado y es festivo fijo.
    assert.equal(tipoDeDia("2027-05-01"), "festivo");
  });
});

describe("franjasDelDia — la grilla de media hora (2026-10-15)", () => {
  it("las constantes son las que decidió el propietario", () => {
    // Si alguien cambia una de estas, que sea a propósito y con esta prueba en rojo.
    assert.equal(CUPOS_SIMULTANEOS, 2);
    assert.equal(DURACION_MINUTOS, 60);
  });

  it("un día hábil ofrece veinte horas, de 07:30 a 17:00 cada media hora", () => {
    const horas = franjasDelDia("2026-10-07");
    assert.deepEqual(horas, FRANJAS);
    assert.equal(horas.length, 20);
    assert.deepEqual(horas.slice(0, 3), ["07:30", "08:00", "08:30"]);
    // 17:00 termina a las 18:00, el cierre; 17:30 terminaría pasado.
    assert.equal(horas.at(-1), "17:00");
    assert.equal(esFranjaDelDia("2026-10-07", "17:30"), false);
    assert.equal(esFranjaDelDia("2026-10-07", "07:00"), false);
  });

  it("el sábado abre a las 7:30 y la última es la de las 12:30, que acaba a la 1:30 PM", () => {
    const horas = franjasDelDia("2026-10-10");
    assert.equal(horas[0], "07:30");
    assert.equal(horas.at(-1), "12:30");
    assert.equal(horas.length, 11);
    assert.equal(esFranjaDelDia("2026-10-10", "13:00"), false);
    assert.equal(esFranjaDelDia("2026-10-10", "17:00"), false);
  });

  it("un festivo abre a las 8:00 y la última es la de las 11:00, que acaba al mediodía", () => {
    assert.deepEqual(franjasDelDia("2026-05-18"), ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00"]);
    assert.equal(esFranjaDelDia("2026-05-18", "07:30"), false);
    assert.equal(esFranjaDelDia("2026-05-18", "11:30"), false);
  });

  it("el domingo no ofrece ninguna", () => {
    assert.deepEqual(franjasDelDia("2026-10-11"), []);
    assert.equal(esFranjaDelDia("2026-10-11", "09:00"), false);
  });

  it("no acepta horas fuera de la grilla aunque estén dentro del horario", () => {
    for (const hora of ["09:07", "09:15", "09:45"]) assert.equal(esFranjaDelDia("2026-10-07", hora), false, hora);
  });

  it("nunca ofrece una hora que no esté en la grilla base", () => {
    for (const dia of ["2026-10-07", "2026-10-10", "2026-05-18", "2026-10-11"]) {
      for (const hora of franjasDelDia(dia)) assert.ok(FRANJAS.includes(hora), `${dia} ${hora}`);
    }
  });

  it("el rango legible resume la grilla para los mensajes", () => {
    assert.equal(rangoLegible(franjasDelDia("2026-10-07")), "entre 7:30 y 17:00, cada media hora");
    assert.equal(rangoLegible(franjasDelDia("2026-05-18")), "entre 8:00 y 11:00, cada media hora");
    assert.equal(rangoLegible(franjasDelDia("2026-10-11")), null);
  });
});

describe("cuposDelDia — techo de Reportes", () => {
  it("es CUPOS × las horas completas abiertas: 20 hábil, 12 sábado, 8 festivo, 0 domingo", () => {
    assert.equal(cuposDelDia("2026-10-07"), 20);
    assert.equal(cuposDelDia("2026-10-10"), 12);
    assert.equal(cuposDelDia("2026-05-18"), 8);
    assert.equal(cuposDelDia("2026-10-11"), 0);
    assert.equal(CUPOS_POR_DIA_HABIL, 20);
  });
});

describe("ocupacionMaxima — la cuenta en minutos", () => {
  const nueve = aMinutos("09:00");

  it("sin citas, cero", () => {
    assert.equal(ocupacionMaxima([], nueve, nueve + 60), 0);
  });

  it("tramos SEMIABIERTOS: una cita que termina justo cuando empieza la ventana no cuenta", () => {
    // La de las 8:00 ocupa [8:00, 9:00); la ventana es [9:00, 10:00).
    assert.equal(ocupacionMaxima([aMinutos("08:00")], nueve, nueve + 60), 0);
  });

  it("tramos SEMIABIERTOS: una cita que empieza justo cuando termina la ventana no cuenta", () => {
    // La de las 10:00 empieza en el instante en que la ventana [9:00, 10:00) acaba.
    assert.equal(ocupacionMaxima([aMinutos("10:00")], nueve, nueve + 60), 0);
  });

  it("un minuto de cruce ya cuenta", () => {
    assert.equal(ocupacionMaxima([aMinutos("08:01")], nueve, nueve + 60), 1);
    assert.equal(ocupacionMaxima([aMinutos("09:59")], nueve, nueve + 60), 1);
  });

  it("cuenta el PEOR instante, no la suma de las que se cruzan", () => {
    // 8:30 [8:30, 9:30) y 9:30 [9:30, 10:30) se cruzan las dos con [9:00, 10:00),
    // pero nunca están adentro a la vez: el máximo es 1, no 2.
    assert.equal(ocupacionMaxima([aMinutos("08:30"), aMinutos("09:30")], nueve, nueve + 60), 1);
  });

  it("cuenta las que se pisan dentro de la ventana", () => {
    // 9:00 y 9:30 están las dos adentro entre 9:30 y 10:00.
    assert.equal(ocupacionMaxima([aMinutos("09:00"), aMinutos("09:30")], nueve, nueve + 60), 2);
  });
});

describe("cupoParaHora — la regla del cupo", () => {
  it("el ejemplo del propietario: con 9:00 y 9:30 tomadas, 9:00 llena, 8:30 y 10:00 libres", () => {
    const tomadas = ["09:00", "09:30"];
    assert.deepEqual(cupoParaHora(tomadas, "09:00"), { ocupados: 2, disponibles: 0 });
    assert.deepEqual(cupoParaHora(tomadas, "08:30"), { ocupados: 1, disponibles: 1 });
    assert.deepEqual(cupoParaHora(tomadas, "10:00"), { ocupados: 1, disponibles: 1 });
    assert.deepEqual(cupoParaHora(tomadas, "09:30"), { ocupados: 2, disponibles: 0 });
    assert.deepEqual(cupoParaHora(tomadas, "10:30"), { ocupados: 0, disponibles: 2 });
    assert.deepEqual(cupoParaHora(tomadas, "08:00"), { ocupados: 0, disponibles: 2 });
  });

  it("dos a la misma hora llenan esa hora y las dos medias horas vecinas", () => {
    const tomadas = ["09:00", "09:00"];
    assert.equal(cupoParaHora(tomadas, "08:30").disponibles, 0);
    assert.equal(cupoParaHora(tomadas, "09:00").disponibles, 0);
    assert.equal(cupoParaHora(tomadas, "09:30").disponibles, 0);
    assert.equal(cupoParaHora(tomadas, "08:00").disponibles, 2);
    assert.equal(cupoParaHora(tomadas, "10:00").disponibles, 2);
  });

  it("las citas viejas en punto, cuatro a la misma hora, bloquean sin dar negativos", () => {
    const viejas = ["09:00", "09:00", "09:00", "09:00"];
    assert.deepEqual(cupoParaHora(viejas, "09:30"), { ocupados: 4, disponibles: 0 });
    assert.deepEqual(cupoParaHora(viejas, "10:00"), { ocupados: 0, disponibles: 2 });
  });

  it("una cita vieja FUERA de la grilla se cuenta por los minutos que de verdad ocupa", () => {
    // Una a las 9:07 ocupa [9:07, 10:07): se cruza con la ventana de las 10:00
    // por siete minutos, y eso basta.
    assert.equal(cupoParaHora(["09:07"], "10:00").ocupados, 1);
    assert.equal(cupoParaHora(["09:07"], "10:30").ocupados, 0);
    assert.equal(cupoParaHora(["09:07"], "08:30").ocupados, 1);
    assert.equal(cupoParaHora(["09:07"], "08:00").ocupados, 0);
    // Una vieja a las 9:07 y una nueva a las 9:30 están adentro a la vez desde
    // las 9:30: llenan las 9:30, aunque ninguna de las dos empiece a esa hora y
    // la de las 9:07 ni siquiera esté en la grilla.
    assert.equal(cupoParaHora(["09:07", "09:30"], "09:30").disponibles, 0);
    assert.equal(cupoParaHora(["09:07", "09:30"], "09:00").disponibles, 0);
  });

  it("acepta 'HH:MM:SS', que es como vuelve una columna `time`", () => {
    assert.deepEqual(cupoParaHora(["09:00:00", "09:30:00"], "09:00"), { ocupados: 2, disponibles: 0 });
  });

  it("cupoDeFranja agrega la hora de fin, una hora después", () => {
    assert.deepEqual(cupoDeFranja([], "09:30"), { hora: "09:30", fin: "10:30", ocupados: 0, disponibles: 2 });
    assert.equal(cupoDeFranja([], "17:00").fin, "18:00");
    assert.equal(cupoDeFranja([], "12:30").fin, "13:30");
  });
});
