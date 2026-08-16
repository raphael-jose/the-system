import { describe, it, expect } from "vitest";
import { ORAL_SLOTS, ORAL_BRUSH_SEC, ORAL_XP, ORAL_BONUS_XP } from "./oralCare";

describe("higiene bucal", () => {
  it("tem 3 horários do dia, cada um com o seu momento", () => {
    expect(ORAL_SLOTS).toHaveLength(3);
    expect(ORAL_SLOTS.map((s) => s.label)).toEqual(["Manhã", "Tarde", "Noite"]);
    expect(ORAL_SLOTS.map((s) => s.hint)).toEqual([
      "ao acordar",
      "depois do almoço",
      "antes de dormir",
    ]);
    // ids únicos e ordenados para o reducer (0/1/2)
    expect(ORAL_SLOTS.map((s) => s.id)).toEqual([0, 1, 2]);
  });

  it("escovação exige 2 minutos (padrão dos dentistas)", () => {
    expect(ORAL_BRUSH_SEC).toBe(120);
  });

  it("recompensas padrão: +5 XP por escovação e +10 XP pelo 3/3", () => {
    expect(ORAL_XP).toBe(5);
    expect(ORAL_BONUS_XP).toBe(10);
  });
});
