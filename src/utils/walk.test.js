import { describe, it, expect } from "vitest";
import {
  createStepCounter,
  estimateSteps,
  formatSteps,
  haversineKm,
  routeDistanceKm,
  walkTotals,
} from "./walk";

describe("haversineKm", () => {
  it("1 grau de latitude ≈ 111,19 km", () => {
    expect(haversineKm(0, 0, 1, 0)).toBeGreaterThan(110.5);
    expect(haversineKm(0, 0, 1, 0)).toBeLessThan(112);
  });

  it("0 km para o mesmo ponto e simétrico", () => {
    expect(haversineKm(-23.55, -46.63, -23.55, -46.63)).toBe(0);
    expect(haversineKm(-23.55, -46.63, -23.56, -46.63)).toBeCloseTo(
      haversineKm(-23.56, -46.63, -23.55, -46.63),
      6
    );
  });
});

describe("routeDistanceKm", () => {
  it("soma os segmentos da rota", () => {
    const route = [
      [0, 0],
      [1, 0], // ~111,19 km
      [1, 1], // ~111,19 km
    ];
    expect(routeDistanceKm(route)).toBeGreaterThan(220);
    expect(routeDistanceKm(route)).toBeLessThan(225);
  });

  it("ignora pontos inválidos e rota vazia", () => {
    expect(routeDistanceKm([])).toBe(0);
    expect(routeDistanceKm([[0, 0]])).toBe(0);
    // o ponto inválido no fim quebra só o último segmento
    const expected = haversineKm(0, 0, 1, 0) + haversineKm(1, 0, 1, 1);
    expect(
      routeDistanceKm([
        [0, 0],
        [1, 0],
        [1, 1],
        [null, 2],
      ])
    ).toBeCloseTo(expected, 6);
    expect(routeDistanceKm(null)).toBe(0);
  });
});

describe("estimateSteps", () => {
  it("estima passos pela distância (passo médio 75 cm)", () => {
    expect(estimateSteps(1)).toBe(1333); // 1000 m / 0,75 m
    expect(estimateSteps(0)).toBe(0);
    expect(estimateSteps(-1)).toBe(0);
  });
});

describe("createStepCounter", () => {
  // Helper: alimenta baseline com N amostras em 1.0g
  function feedBaseline(counter, n = 10) {
    for (let i = 0; i < n; i++) counter.push(1.0, i * 50);
  }

  it("conta passos com cadência e amplitude consistentes", () => {
    const counter = createStepCounter();
    feedBaseline(counter);
    // 3 passos simulados: baseline ~1.0g, picos ~2.0g, intervalo ~400ms
    counter.push(2.0, 600);  // passo 1
    counter.push(1.0, 700);
    counter.push(2.0, 1000); // passo 2 (400ms)
    counter.push(1.0, 1100);
    counter.push(2.0, 1400); // passo 3 (400ms)
    expect(counter.get()).toBe(3);
  });

  it("ignora shaking rápido (< 250ms)", () => {
    const counter = createStepCounter();
    feedBaseline(counter);
    counter.push(2.0, 600);  // passo 1
    counter.push(1.0, 700);
    counter.push(2.1, 800);  // 100ms depois → muito rápido
    counter.push(1.0, 850);
    expect(counter.get()).toBe(1);
    counter.push(2.0, 1100); // 500ms depois → aceita
    expect(counter.get()).toBe(2);
  });

  it("ignora shaking com amplitude inconsistente", () => {
    const counter = createStepCounter({ ampTolerance: 0.4 });
    feedBaseline(counter);
    counter.push(2.0, 600);  // passo 1
    counter.push(1.0, 700);
    counter.push(4.0, 1000); // amplitude 3x maior → rejeita
    counter.push(1.0, 1100);
    expect(counter.get()).toBe(1);
  });

  it("ignora GPS parado (velocidade mediana < 0.3)", () => {
    const counter = createStepCounter();
    feedBaseline(counter);
    counter.push(2.0, 600, 0.1);
    counter.push(1.0, 700, 0.1);
    counter.push(2.0, 1000, 0.1);
    expect(counter.get()).toBe(0);
  });

  it("ativa modo bolso quando GPS confirma movimento + acel baixa", () => {
    const counter = createStepCounter();
    expect(counter.isPocketMode()).toBe(false);
    feedBaseline(counter, 10);
    for (let i = 0; i < 6; i++) {
      counter.push(1.3, 600 + i * 400, 1.2);
    }
    expect(counter.isPocketMode()).toBe(true);
  });

  it("sai do modo bolso quando GPS para", () => {
    const counter = createStepCounter();
    feedBaseline(counter, 10);
    for (let i = 0; i < 6; i++) {
      counter.push(1.3, 600 + i * 400, 1.2);
    }
    expect(counter.isPocketMode()).toBe(true);
    counter.push(1.3, 3500, 0.1);
    counter.push(1.3, 3900, 0.1);
    expect(counter.isPocketMode()).toBe(false);
  });

  it("zera com reset()", () => {
    const counter = createStepCounter();
    feedBaseline(counter);
    counter.push(2.0, 600);
    counter.push(1.0, 700);
    counter.push(2.0, 1000);
    expect(counter.get()).toBe(2);
    counter.reset();
    expect(counter.get()).toBe(0);
  });
});

describe("walkTotals", () => {
  it("soma caminhadas da série", () => {
    const series = [
      { walks: [{ steps: 1200, km: 0.9, sec: 600 }] },
      { walks: [{ steps: 2000, km: 1.5, sec: 900 }] },
      { walks: [] },
    ];
    expect(walkTotals(series)).toEqual({ walks: 2, steps: 3200, km: 2.4, sec: 1500 });
  });

  it("ignora valores inválidos e série vazia", () => {
    expect(walkTotals([])).toEqual({ walks: 0, steps: 0, km: 0, sec: 0 });
    expect(
      walkTotals([{ walks: [{ steps: -5, km: "x", sec: null }] }])
    ).toEqual({ walks: 1, steps: 0, km: 0, sec: 0 });
  });
});

describe("formatSteps", () => {
  it("formata com separador pt-BR", () => {
    expect(formatSteps(12345)).toBe("12.345");
    expect(formatSteps(0)).toBe("0");
    expect(formatSteps(-10)).toBe("0");
  });
});
