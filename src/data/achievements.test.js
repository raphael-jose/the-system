import { describe, it, expect } from "vitest";
import {
  ACHIEVEMENTS,
  achievementProgress,
  evaluateAchievements,
} from "./achievements";

function save(over = {}) {
  return {
    player: {
      level: 1,
      streak: 0,
      totalMissionsCompleted: 0,
      spAllocated: 0,
      ...(over.player || {}),
    },
    _dailyHistory: {},
    _fullDailyDays: [],
    dungeons: [],
    ...over,
  };
}

function day(ids) {
  return { ids, xp: 0, hours: [], byCat: {} };
}

describe("achievementProgress", () => {
  it("Sobrecarga mostra progresso parcial 7/10 missões hoje", () => {
    const s = save({
      _dailyHistory: {
        "2026-08-16": day(["a", "b", "c", "d", "e", "f", "g"]),
      },
    });
    expect(achievementProgress(s)["day-full-10"]).toEqual({
      current: 7,
      target: 10,
      unit: "missões hoje",
    });
    expect(evaluateAchievements(s)).not.toContain("day-full-10");
  });

  it("Sobrecarga desbloqueia ao atingir 10 num único dia", () => {
    const s = save({
      _dailyHistory: {
        "2026-08-16": day(Array.from({ length: 10 }, (_, i) => "m" + i)),
      },
    });
    const p = achievementProgress(s)["day-full-10"];
    expect(p.current).toBe(10);
    expect(evaluateAchievements(s)).toContain("day-full-10");
  });

  it("usa o melhor dia do período, não apenas hoje", () => {
    const s = save({
      _dailyHistory: {
        "2026-08-10": day(["a", "b", "c"]),
        "2026-08-12": day(Array.from({ length: 9 }, (_, i) => "x" + i)),
      },
    });
    expect(achievementProgress(s)["day-full-10"].current).toBe(9);
  });

  it("streak parcial 3/7 e 3/30", () => {
    const s = save({ player: { streak: 3 } });
    expect(achievementProgress(s)["streak-7"]).toEqual({
      current: 3,
      target: 7,
      unit: "dias de sequência",
    });
    expect(achievementProgress(s)["streak-30"]).toEqual({
      current: 3,
      target: 30,
      unit: "dias de sequência",
    });
    expect(evaluateAchievements(s)).not.toContain("streak-7");
  });

  it("rank: caçador E vale 0, D vale 1", () => {
    expect(achievementProgress(save())["rank-d"].current).toBe(0);
    const d = save({ player: { level: 12 } });
    expect(achievementProgress(d)["rank-d"].current).toBe(1);
    expect(evaluateAchievements(d)).toContain("rank-d");
  });

  it("conquistas desbloqueadas mantêm current >= target", () => {
    const s = save({
      player: { level: 25, streak: 9, totalMissionsCompleted: 120 },
    });
    const p = achievementProgress(s);
    expect(p["level-10"].current).toBe(25);
    expect(p["streak-7"].current).toBe(9);
    expect(p["missions-100"].current).toBe(120);
    for (const id of ["level-10", "streak-7", "missions-100"]) {
      expect(evaluateAchievements(s)).toContain(id);
    }
  });

  it("dias perfeitos contam no _fullDailyDays", () => {
    const s = save({ _fullDailyDays: ["2026-08-10"] });
    expect(achievementProgress(s)["day-complete"]).toEqual({
      current: 1,
      target: 1,
      unit: "dias perfeitos",
    });
    expect(evaluateAchievements(s)).toContain("day-complete");
  });

  it("toda conquista do catálogo tem progresso definido", () => {
    const p = achievementProgress(save());
    for (const a of ACHIEVEMENTS) {
      expect(p[a.id], a.id).toBeTruthy();
      expect(typeof p[a.id].target).toBe("number");
      expect(typeof p[a.id].current).toBe("number");
    }
  });
});
