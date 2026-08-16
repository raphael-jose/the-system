import { describe, it, expect, afterEach, vi } from "vitest";
import {
  buildSeries,
  computeInsights,
  currentRunStart,
  encouragementMessage,
  formatDuration,
  formatShort,
  longestStreak,
  patternSentence,
  sessionTotals,
  weeklyProgressLine,
} from "./history";

// Segunda-feira fixa (10/08/2026) — mesma base dos testes do reducer.
const MON = new Date(2026, 7, 10, 12, 0, 0);

afterEach(() => {
  vi.useRealTimers();
});

function hist(entries) {
  const out = {};
  for (const e of entries) {
    out[e.date] = {
      ids: e.ids || [],
      xp: e.xp || 0,
      hours: e.hours || [],
      byCat: e.byCat || {},
      sessions: e.sessions || [],
    };
  }
  return out;
}

describe("buildSeries", () => {
  it("gera 30 dias terminando hoje, zerando os vazios", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    const s = buildSeries(
      hist([{ date: "2026-08-10", ids: ["x"], xp: 50, byCat: { treino: 1 } }])
    );
    expect(s).toHaveLength(30);
    expect(s[29].date).toBe("2026-08-10");
    expect(s[29].xp).toBe(50);
    expect(s[29].count).toBe(1);
    expect(s[29].byCat.treino).toBe(1);
    expect(s[29].isToday).toBe(true);
    expect(s[0].xp).toBe(0);
    expect(s[0].count).toBe(0);
    expect(s[0].isToday).toBe(false);
  });

  it("formata datas curtas dd/mm", () => {
    expect(formatShort("2026-08-10")).toBe("10/08");
  });

  it("propaga sessões por dia", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    const s = buildSeries(
      hist([
        {
          date: "2026-08-10",
          ids: ["x"],
          sessions: [{ title: "30 Flexões", sec: 540, sets: 3 }],
        },
      ])
    );
    expect(s[29].sessions).toHaveLength(1);
    expect(s[29].sessions[0].sec).toBe(540);
    expect(s[0].sessions).toEqual([]);
  });
});

describe("sessionTotals / formatDuration", () => {
  it("soma sessões e tempo treinado no período", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    const s = buildSeries(
      hist([
        {
          date: "2026-08-10",
          ids: ["a"],
          sessions: [
            { title: "30 Flexões", sec: 540, sets: 3 },
            { title: "50 Agachamentos", sec: 900, sets: 5 },
          ],
        },
        {
          date: "2026-08-09",
          ids: ["a"],
          sessions: [{ title: "20 min de cardio", sec: 1200, sets: 4 }],
        },
      ])
    );
    expect(sessionTotals(s)).toEqual({ sessions: 3, sec: 2640 });
    expect(sessionTotals([])).toEqual({ sessions: 0, sec: 0 });
  });

  it("ignora sessões inválidas no total", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    const s = buildSeries(
      hist([
        {
          date: "2026-08-10",
          ids: ["a"],
          sessions: [{ title: "X", sec: -5, sets: 1 }],
        },
      ])
    );
    expect(sessionTotals(s)).toEqual({ sessions: 1, sec: 0 });
  });

  it("formata duração em horas/minutos/segundos", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(30)).toBe("30s");
    expect(formatDuration(540)).toBe("9min");
    expect(formatDuration(7500)).toBe("2h 05min");
    expect(formatDuration(3600)).toBe("1h 00min");
    expect(formatDuration(-10)).toBe("0s");
  });
});

describe("streaks", () => {
  it("conta a maior sequência e o início da sequência atual", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    // ativo: 10,09,08 (3 dias) · pausa 07,06 · ativo 05→31/07 (6 dias)
    const entries = [
      "2026-08-10",
      "2026-08-09",
      "2026-08-08",
      "2026-08-05",
      "2026-08-04",
      "2026-08-03",
      "2026-08-02",
      "2026-08-01",
      "2026-07-31",
    ].map((date) => ({ date, ids: ["x"] }));
    const s = buildSeries(hist(entries));
    expect(longestStreak(s)).toBe(6);
    // sequência atual = 3 últimos dias (08, 09, 10)
    expect(currentRunStart(s)).toBe(27);
  });

  it("sequência atual inclui ontem quando hoje ainda está vazio", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    const entries = [
      { date: "2026-08-09", ids: ["x"] },
      { date: "2026-08-08", ids: ["x"] },
    ];
    const s = buildSeries(hist(entries));
    expect(currentRunStart(s)).toBe(27); // células 27 e 28 douradas
  });
});

describe("computeInsights", () => {
  it("retorna calibragem quando não há dados", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    const ins = computeInsights({}, { streak: 0 });
    expect(ins).toHaveLength(1);
    expect(ins[0].id).toBe("empty");
  });

  it("detecta o dia da semana com mais treino (terças)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    const entries = [
      { date: "2026-08-11", ids: ["a"], xp: 20, byCat: { treino: 1 } }, // terça
      { date: "2026-08-04", ids: ["a"], xp: 20, byCat: { treino: 1 } }, // terça
      { date: "2026-07-28", ids: ["a"], xp: 20, byCat: { treino: 1 } }, // terça
      { date: "2026-08-10", ids: ["a"], xp: 20, byCat: { estudo: 1 } }, // segunda
    ];
    const ins = computeInsights(hist(entries), { streak: 0 });
    const day = ins.find((x) => x.id === "day");
    expect(day.value).toBe("TERÇAS");
    expect(day.label).toBe("Você treina mais às");
  });

  it("detecta horário de pico e dia mais produtivo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    const entries = [
      {
        date: "2026-08-10",
        ids: ["a", "b", "c"],
        xp: 120,
        hours: [19, 19, 20],
      },
      { date: "2026-08-09", ids: ["a"], xp: 20, hours: [19] },
    ];
    const ins = computeInsights(hist(entries), { streak: 2 });
    const hour = ins.find((x) => x.id === "hour");
    expect(hour.value).toBe("19h–20h");
    const best = ins.find((x) => x.id === "best");
    expect(best.value).toBe("10/08 · 120 XP");
  });

  it("calcula média por dia ativo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    const entries = [
      { date: "2026-08-10", ids: ["a", "b"], xp: 40 }, // 2 missões
      { date: "2026-08-09", ids: ["a"], xp: 20 }, // 1 missão
    ];
    const ins = computeInsights(hist(entries), { streak: 0 });
    const avg = ins.find((x) => x.id === "avg");
    expect(avg.value).toBe("1,5");
    expect(avg.detail).toContain("2 dias ativos");
  });
});

describe("patternSentence", () => {
  it("retorna null sem padrão claro (menos de 2 treinos no mesmo dia)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    const entries = [{ date: "2026-08-10", ids: ["a"], byCat: { treino: 1 } }];
    expect(patternSentence(hist(entries), "2026-08-10")).toBeNull();
    expect(patternSentence({}, "2026-08-10")).toBeNull();
  });

  it("reconhece o dia forte quando hoje É o melhor dia (terças)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 11, 12, 0, 0)); // terça 11/08
    const entries = [
      { date: "2026-08-11", ids: ["a"], byCat: { treino: 1 } }, // terça
      { date: "2026-08-04", ids: ["a"], byCat: { treino: 1 } }, // terça
      { date: "2026-08-03", ids: ["a"], byCat: { estudo: 1 } }, // segunda
    ];
    expect(patternSentence(hist(entries), "2026-08-11")).toBe(
      "Terça é seu dia de treino forte."
    );
  });

  it("menciona o melhor dia quando hoje não é ele", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON); // segunda 10/08
    const entries = [
      { date: "2026-08-04", ids: ["a"], byCat: { treino: 1 } }, // terça
      { date: "2026-07-28", ids: ["a"], byCat: { treino: 1 } }, // terça
      { date: "2026-08-10", ids: ["a"], byCat: { treino: 1 } }, // segunda (1x)
    ];
    expect(patternSentence(hist(entries), "2026-08-10")).toBe(
      "Seu dia mais forte costuma ser terça."
    );
  });
});

describe("encouragementMessage", () => {
  it("inclui o padrão, o dia completo e a sequência quando há streak", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 11, 12, 0, 0)); // terça 11/08
    const entries = [
      { date: "2026-08-11", ids: ["a"], byCat: { treino: 1 } },
      { date: "2026-08-04", ids: ["a"], byCat: { treino: 1 } },
    ];
    const msg = encouragementMessage(hist(entries), { streak: 3 }, "2026-08-11");
    expect(msg).toContain("Terça é seu dia de treino forte.");
    expect(msg).toContain("Dia completo: todas as missões concluídas.");
    expect(msg).toContain("3 dias de sequência registrados.");
    expect(msg.endsWith("O Sistema reconhece sua constância, caçador.")).toBe(
      true
    );
  });

  it("omite o padrão e a sequência quando não existem", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    const msg = encouragementMessage({}, { streak: 0 }, "2026-08-10");
    expect(msg).not.toContain("dia de treino forte");
    expect(msg).not.toContain("sequência registrados");
    expect(msg).toContain("Dia completo: todas as missões concluídas.");
  });

  it("inclui o que falta para a semanal mais próxima", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    const weeklies = [
      { id: "w-trainings", title: "5 Treinos na Semana", need: 5, unit: "treinos", progress: 3 },
      { id: "w-reading", title: "Ler 100 Minutos na Semana", need: 100, unit: "min", progress: 60 },
    ];
    const msg = encouragementMessage({}, { streak: 0 }, "2026-08-10", weeklies);
    expect(msg).toContain(
      'Faltam 2 treinos para a semanal "5 Treinos na Semana".'
    );
  });

  it("sem semanais em andamento não muda a mensagem", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MON);
    const done = [
      { id: "w-trainings", title: "5 Treinos na Semana", need: 5, unit: "treinos", progress: 5, completed: true },
    ];
    const msg = encouragementMessage({}, { streak: 0 }, "2026-08-10", done);
    expect(msg).not.toContain("Faltam");
  });
});

describe("weeklyProgressLine", () => {
  it("null sem semanais ou todas concluídas", () => {
    expect(weeklyProgressLine()).toBeNull();
    expect(weeklyProgressLine([])).toBeNull();
    expect(
      weeklyProgressLine([
        { id: "w-trainings", title: "X", need: 5, unit: "treinos", progress: 5, completed: true },
      ])
    ).toBeNull();
  });

  it("faltam N unidades da semanal mais próxima", () => {
    const weeklies = [
      { id: "w-reading", title: "Ler 100 Minutos na Semana", need: 100, unit: "min", progress: 40 },
      { id: "w-trainings", title: "5 Treinos na Semana", need: 5, unit: "treinos", progress: 3 },
      { id: "w-streak", title: "7 Dias de Streak", need: 7, unit: "dias", progress: 0 },
    ];
    // a mais próxima de completar é a de treinos (60% > 40% > 0%)
    expect(weeklyProgressLine(weeklies)).toBe(
      'Faltam 2 treinos para a semanal "5 Treinos na Semana".'
    );
  });

  it("singular quando falta 1 unidade", () => {
    expect(
      weeklyProgressLine([
        { id: "w-trainings", title: "5 Treinos na Semana", need: 5, unit: "treinos", progress: 4 },
      ])
    ).toBe('Falta 1 treino para a semanal "5 Treinos na Semana".');
  });

  it("sem progresso ainda mostra a meta inteira", () => {
    expect(
      weeklyProgressLine([
        { id: "w-trainings", title: "5 Treinos na Semana", need: 5, unit: "treinos", progress: 0 },
      ])
    ).toBe('Faltam 5 treinos para a semanal "5 Treinos na Semana".');
  });

  it("arredonda para cima frações (leitura 80/100 → faltam 20 min)", () => {
    expect(
      weeklyProgressLine([
        { id: "w-reading", title: "Ler 100 Minutos na Semana", need: 100, unit: "min", progress: 80 },
      ])
    ).toBe('Faltam 20 min para a semanal "Ler 100 Minutos na Semana".');
  });
});
