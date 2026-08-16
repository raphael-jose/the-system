import { describe, it, expect } from "vitest";
import {
  nofapStreak,
  nofapMilestoneProgress,
  NOFAP_MILESTONES,
} from "./nofap";

function save(over = {}) {
  return {
    createdAt: "2026-08-01",
    player: {
      nofap: { lastRelapse: null, bestStreak: 0, lastClaim: null, milestones: [] },
    },
    ...over,
  };
}

describe("nofapStreak", () => {
  it("conta desde o início quando nunca houve recaída", () => {
    expect(nofapStreak(save(), "2026-08-10")).toBe(9);
    expect(nofapStreak(save(), "2026-08-01")).toBe(0);
  });

  it("conta desde a última recaída", () => {
    const s = save();
    s.player.nofap.lastRelapse = "2026-08-08";
    expect(nofapStreak(s, "2026-08-10")).toBe(2);
    expect(nofapStreak(s, "2026-08-08")).toBe(0);
  });

  it("não fica negativo", () => {
    expect(nofapStreak(save(), "2026-07-01")).toBe(0);
  });

  it("usa hoje por padrão e aguenta save sem nofap", () => {
    expect(typeof nofapStreak({})).toBe("number");
    expect(nofapStreak({ player: {} })).toBe(0);
  });
});

describe("nofapMilestoneProgress", () => {
  it("progresso parcial e estado de reivindicação", () => {
    const s = save();
    s.player.nofap.milestones = [7];
    const p = nofapMilestoneProgress(s, "2026-08-10"); // streak 9
    expect(p[0]).toMatchObject({ days: 7, current: 7, claimed: true });
    expect(p[1]).toMatchObject({ days: 30, current: 9, claimed: false });
    expect(p[2]).toMatchObject({ days: 90, current: 9, claimed: false });
    expect(p).toHaveLength(NOFAP_MILESTONES.length);
  });

  it("marcos bloqueiam progresso acima do alvo", () => {
    const p = nofapMilestoneProgress(save(), "2026-08-10");
    expect(p[0].current).toBe(7);
    expect(p[0].claimed).toBe(false);
  });
});
