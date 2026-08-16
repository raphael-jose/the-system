// Pedômetro + rastreamento de caminhada — helpers puros, testáveis.
// A contagem de passos usa o acelerômetro quando existe (Android); sem
// sensor, estima pela distância do GPS (passo médio de caminhada).

const EARTH_KM = 6371;
const STRIDE_M = 0.75; // passo médio de caminhada (~75 cm)

/** Distância em km entre dois pontos (fórmula de haversine). */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
}

/** Distância total (km) de uma rota [[lat, lng], ...], ignorando pontos inválidos. */
export function routeDistanceKm(route) {
  const pts = route || [];
  let km = 0;
  for (let i = 1; i < pts.length; i++) {
    const [la1, lo1] = pts[i - 1];
    const [la2, lo2] = pts[i];
    if (
      [la1, lo1, la2, lo2].every(
        (n) => typeof n === "number" && Number.isFinite(n)
      )
    ) {
      km += haversineKm(la1, lo1, la2, lo2);
    }
  }
  return km;
}

/** Passos estimados a partir da distância (fallback sem acelerômetro). */
export function estimateSteps(km, strideM = STRIDE_M) {
  if (!(km > 0)) return 0;
  return Math.round((km * 1000) / strideM);
}

/**
 * Detector de passos por picos de aceleração (magnitude em unidades de g).
 * Conta uma transição repouso→pico acima do limiar, com intervalo mínimo
 * entre passos (evita múltiplos picos do mesmo passo). `push` retorna o
 * total acumulado. Testável com séries sintéticas.
 */
export function createStepCounter({ threshold = 1.25, minIntervalMs = 350 } = {}) {
  let steps = 0;
  let lastPeakAt = -Infinity;
  let above = false;
  return {
    push(mag, t) {
      if (mag >= threshold && !above) {
        above = true;
        if (t - lastPeakAt >= minIntervalMs) {
          steps += 1;
          lastPeakAt = t;
        }
      } else if (mag < threshold * 0.9) {
        above = false;
      }
      return steps;
    },
  };
}

/** Soma das caminhadas de uma série (para o Histórico). */
export function walkTotals(series) {
  let walks = 0;
  let steps = 0;
  let km = 0;
  let sec = 0;
  for (const d of series || []) {
    for (const w of d.walks || []) {
      walks++;
      steps += Math.max(0, Number(w.steps) || 0);
      km += Math.max(0, Number(w.km) || 0);
      sec += Math.max(0, Number(w.sec) || 0);
    }
  }
  return { walks, steps, km, sec };
}

/** Passos com separador pt-BR (ex.: 12.345). */
export function formatSteps(n) {
  return Math.max(0, Math.floor(n || 0)).toLocaleString("pt-BR");
}
