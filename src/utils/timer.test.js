import { describe, it, expect } from "vitest";
import { formatClock, formatLong, repProgress } from "./timer";

describe("formatClock", () => {
  it("formata minutos e segundos", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(3)).toBe("00:03");
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(1200)).toBe("20:00");
  });

  it("inclui horas quando >= 1h", () => {
    expect(formatClock(3600)).toBe("01:00:00");
  });

  it("não aceita negativos", () => {
    expect(formatClock(-5)).toBe("00:00");
  });
});

describe("repProgress", () => {
  it("clampa entre 0 e 1", () => {
    expect(repProgress(0, 30)).toBe(0);
    expect(repProgress(30, 30)).toBe(1);
    expect(repProgress(50, 30)).toBe(1);
    expect(repProgress(-3, 30)).toBe(0);
  });

  it("calcula frações intermediárias", () => {
    expect(repProgress(10, 40)).toBe(0.25);
    expect(repProgress(15, 30)).toBe(0.5);
  });

  it("não divide por zero", () => {
    expect(repProgress(5, 0)).toBe(0);
  });
});

describe("formatLong", () => {
  it("resume a sessão em minutos e segundos", () => {
    expect(formatLong(0)).toBe("0s");
    expect(formatLong(45)).toBe("45s");
    expect(formatLong(60)).toBe("1min");
    expect(formatLong(185)).toBe("3min 5s");
    expect(formatLong(1200)).toBe("20min");
  });
});
