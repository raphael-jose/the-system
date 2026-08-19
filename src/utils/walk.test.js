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
  it("conta picos de aceleração com intervalo mínimo entre passos", () => {
    const counter = createStepCounter();
    const samples = [
      [1.0, 0],
      [2.0, 100], // pico → passo 1
      [1.0, 200], // abaixo do limiar → reseta o estado "above"
      [2.2, 500], // pico → passo 2 (400ms depois do primeiro)
      [1.0, 600],
      [2.1, 1000], // pico → passo 3
    ];
    let steps = 0;
    for (const [mag, t] of samples) steps = counter.push(mag, t);
    expect(steps).toBe(3);
  });

  it("não conta dois picos do mesmo passo (intervalo mínimo)", () => {
    const counter = createStepCounter();
    counter.push(2.0, 0);
    counter.push(2.1, 100); // muito cedo (< 250ms) → ignora
    counter.push(1.0, 200); // reseta
    expect(counter.push(2.0, 400)).toBe(2); // agora conta
  });

  it("ignora passos quando GPS mostra velocidade baixa (parado)", () => {
    const counter = createStepCounter();
    // Usuário parado (speed = 0.1 m/s) — balanço do celular
    counter.push(2.0, 0, 0.1);
    counter.push(2.1, 300, 0.1);
    counter.push(2.0, 600, 0.1);
    expect(counter.get()).toBe(0);
    // Agora começa a andar (speed = 1.2 m/s)
    // Buffer de velocidade precisa de amostras suficientes para mediana > 0.3
    counter.push(2.0, 700, 1.2);  // speedBuf=[0.1,0.1,0.1,1.2], mediana=0.1 < 0.3 → ignora
    counter.push(1.0, 800, 1.2);  // speedBuf=[0.1,0.1,1.2,1.2], mediana=0.1 < 0.3 → ignora
    counter.push(2.0, 1100, 1.2); // speedBuf=[0.1,1.2,1.2,1.2], mediana=1.2 ≥ 0.3 → passo 1
    counter.push(1.0, 1250, 1.2); // desacelera (reseta above)
    counter.push(2.1, 1500, 1.2); // passo 2
    counter.push(1.0, 1650, 1.2); // desacelera
    counter.push(2.0, 1900, 1.2); // passo 3
    expect(counter.get()).toBe(3);
  });

  it("ignora shaking rápido (< 250ms entre passos)", () => {
    const counter = createStepCounter();
    // Shaking: 150ms entre picos — muito rápido para caminhar
    counter.push(2.0, 0);   // passo 1 (dt > maxInterval → aceita)
    counter.push(2.1, 150); // < 250ms → ignora
    counter.push(1.0, 200); // reseta above
    // Próximo pico: dt = 350ms desde último passo válido (0ms) → aceita
    counter.push(2.0, 350); // passo 2
    expect(counter.get()).toBe(2);
    // Shaking rápido novamente
    counter.push(2.1, 400); // 50ms → ignora
    counter.push(1.0, 450);
    expect(counter.get()).toBe(2); // não aumentou
    // Cadência real (400ms depois do último passo válido em 350ms)
    counter.push(2.0, 800); // 450ms → aceita
    expect(counter.get()).toBe(3);
  });

  it("ativa modo bolso quando GPS confirma movimento + acel baixa", () => {
    const counter = createStepCounter();
    expect(counter.isPocketMode()).toBe(false);
    // Simula celular no bolso: GPS mostra 1.2 m/s, acel ~1.4g (abaixo do threshold 1.8g)
    for (let i = 0; i < 6; i++) {
      counter.push(1.4, i * 400, 1.2); // 1.4g < 1.8g, GPS > 0.5 m/s
    }
    expect(counter.isPocketMode()).toBe(true);
    // Com modo bolso ativo, threshold reduzido (1.4 * 1.15 ≈ 1.61) conta passos
    expect(counter.get()).toBeGreaterThan(0);
  });

  it("sai do modo bolso quando GPS para (parado)", () => {
    const counter = createStepCounter();
    // Ativa modo bolso
    for (let i = 0; i < 6; i++) {
      counter.push(1.4, i * 400, 1.2);
    }
    expect(counter.isPocketMode()).toBe(true);
    // Usuário para (GPS = 0.1 m/s)
    counter.push(1.4, 3000, 0.1);
    counter.push(1.4, 3400, 0.1);
    expect(counter.isPocketMode()).toBe(false);
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
