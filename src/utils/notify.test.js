import { describe, it, expect } from "vitest";
import { dungeonsExpiring, nextDungeonDeadline, noonSummary } from "./notify";

const DUNGEONS = [
  { id: "dg-soon", title: "Soon", startedAt: "2026-08-14", deadlineDays: 5 }, // vence 19/08 → 3 dias
  { id: "dg-far", title: "Far", startedAt: "2026-08-01", deadlineDays: 30 }, // vence 31/08 → 15 dias
  { id: "dg-done", title: "Done", startedAt: "2026-08-01", deadlineDays: 30, completed: true },
  { id: "dg-failed", title: "Failed", startedAt: "2026-07-01", deadlineDays: 10, failed: true },
  { id: "dg-unstarted", title: "Nunca", deadlineDays: 10 }, // sem startedAt
];

describe("dungeonsExpiring", () => {
  it("retorna só as ativas a N dias (ou menos) do prazo", () => {
    const due = dungeonsExpiring(DUNGEONS, 3, "2026-08-16");
    expect(due).toEqual([{ id: "dg-soon", title: "Soon", daysLeft: 3 }]);
  });

  it("não repete as já avisadas no dia", () => {
    const due = dungeonsExpiring(DUNGEONS, 3, "2026-08-16", ["dg-soon"]);
    expect(due).toEqual([]);
  });

  it("threshold 0 avisa apenas no dia do vencimento", () => {
    const list = [
      { id: "dg-today", title: "Hoje", startedAt: "2026-08-11", deadlineDays: 5 },
      { id: "dg-tomorrow", title: "Amanhã", startedAt: "2026-08-12", deadlineDays: 5 },
    ];
    const due = dungeonsExpiring(list, 0, "2026-08-16");
    expect(due).toEqual([{ id: "dg-today", title: "Hoje", daysLeft: 0 }]);
  });

  it("ignora dungeons concluídas, falhadas ou não iniciadas", () => {
    const due = dungeonsExpiring(DUNGEONS, 30, "2026-08-16");
    const ids = due.map((d) => d.id);
    expect(ids).not.toContain("dg-done");
    expect(ids).not.toContain("dg-failed");
    expect(ids).not.toContain("dg-unstarted");
  });
});

describe("nextDungeonDeadline", () => {
  it("retorna a dungeon ativa com o prazo mais próximo", () => {
    const next = nextDungeonDeadline(DUNGEONS, "2026-08-16");
    expect(next).toMatchObject({ id: "dg-soon", title: "Soon", daysLeft: 3 });
    // longe do prazo: sem contagem em horas
    expect(next.hoursLeft).toBeNull();
  });

  it("ignora concluídas, falhadas e não iniciadas", () => {
    const next = nextDungeonDeadline(DUNGEONS, "2026-08-16");
    expect(next.id).not.toBe("dg-done");
    expect(next.id).not.toBe("dg-failed");
    expect(next.id).not.toBe("dg-unstarted");
  });

  it("retorna null quando não há dungeon ativa iniciada", () => {
    const none = nextDungeonDeadline(
      [{ id: "x", title: "X", deadlineDays: 10 }],
      "2026-08-16"
    );
    expect(none).toBeNull();
  });

  it("daysLeft negativo indica prazo já vencido", () => {
    const vencida = {
      id: "dg-old",
      title: "Velha",
      startedAt: "2026-08-01",
      deadlineDays: 10,
    };
    const next = nextDungeonDeadline([vencida], "2026-08-16");
    expect(next.daysLeft).toBeLessThan(0);
  });

  it("contagem em horas quando faltam menos de 24h", () => {
    // vence 19/08 à meia-noite; agora = 18/08 22:00 → faltam 2h
    const next = nextDungeonDeadline(
      [{ id: "dg-soon", title: "Soon", startedAt: "2026-08-14", deadlineDays: 5 }],
      "2026-08-18",
      new Date(2026, 7, 18, 22, 0, 0).getTime()
    );
    expect(next.hoursLeft).toBe(2);
    expect(next.minsLeft).toBe(0);
  });

  it("minutos quando falta menos de 1h", () => {
    const next = nextDungeonDeadline(
      [{ id: "dg-soon", title: "Soon", startedAt: "2026-08-14", deadlineDays: 5 }],
      "2026-08-18",
      new Date(2026, 7, 18, 23, 45, 0).getTime() // faltam 15min
    );
    expect(next.hoursLeft).toBe(0);
    expect(next.minsLeft).toBe(15);
  });

  it("sem contagem em horas com 24h ou mais", () => {
    const next = nextDungeonDeadline(
      [{ id: "dg-soon", title: "Soon", startedAt: "2026-08-14", deadlineDays: 5 }],
      "2026-08-16",
      new Date(2026, 7, 16, 12, 0, 0).getTime() // faltam ~2,5 dias
    );
    expect(next.hoursLeft).toBeNull();
    expect(next.minsLeft).toBeNull();
  });
});

describe("noonSummary", () => {
  const save = (ids, xp, completedCount, total) => ({
    dailyMissions: Array.from({ length: total }, (_, i) => ({
      id: `d${i}`,
      completed: i < completedCount,
    })),
    _dailyHistory: {
      "2026-08-16": { ids, xp, hours: [], byCat: {}, sessions: [] },
    },
  });

  it("dia parado: nenhuma missão registrada", () => {
    const msg = noonSummary(save([], 0, 0, 9), "2026-08-16");
    expect(msg).toBe(
      "Meio-dia, caçador. Nenhuma missão registrada ainda. 9 aguardando — o Sistema observa."
    );
  });

  it("dia parcial: resume feito, XP e pendentes", () => {
    const msg = noonSummary(save(["a", "b", "c"], 95, 3, 9), "2026-08-16");
    expect(msg).toBe(
      "Meio-dia, caçador. Hoje: 3/9 missões · +95 XP. Faltam 6 — o Sistema aguarda."
    );
  });

  it("dia completo: reconhece a constância", () => {
    const msg = noonSummary(
      save(["a", "b", "c", "d", "e", "f", "g", "h", "i"], 210, 9, 9),
      "2026-08-16"
    );
    expect(msg).toBe(
      "Meio-dia, caçador. Dia completo: 9/9 missões · +210 XP hoje. O Sistema reconhece sua constância."
    );
  });

  it("aguenta save sem histórico ou sem missões", () => {
    expect(noonSummary({}, "2026-08-16")).toContain("0 aguardando");
    expect(noonSummary({ dailyMissions: [] }, "2026-08-16")).toContain(
      "0 aguardando"
    );
  });
});
