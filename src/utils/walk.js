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
 *
 * Melhorias anti-falso-positivo:
 *  1. Threshold mais alto (1.8g) — balançar o celular sem andar gera
 *     picos de ~1.2-1.5g; caminhada real gera 1.8-2.5g no eixo vertical.
 *  2. Janela de cadência (250-750ms) — passos reais têm intervalo
 *     entre 250ms (corrida leve) e 750ms (caminhada lenta). Shaking
 *     costuma ser muito mais rápido (<200ms) ou irregular.
 *  3. Validação GPS opcional: `getSpeed()` retorna a velocidade atual
 *     em m/s. Se < 0.3 m/s, o usuário está parado e os passos são
 *     ignorados (balanço sem deslocamento).
 *
 * `push(mag, t)` retorna o total acumulado de passos.
 */
export function createStepCounter({
  threshold = 1.8,
  minIntervalMs = 250,
  maxIntervalMs = 750,
  hysteresis = 0.85,
  pocketThresholdFloor = 1.0,
} = {}) {
  let steps = 0;
  let lastPeakAt = -Infinity;
  let above = false;
  // buffer de velocidades GPS para mediana
  const speedBuf = [];
  // --- Modo bolso ---
  // Detecta quando o celular está no bolso: GPS confirma movimento
  // mas acelerômetro tem picos baixos (sinal atenuado).
  // Reduz o threshold proporcionalmente para compensar.
  let pocketMode = false;
  let pocketThreshold = threshold; // threshold atual (pode ser reduzido)
  const accelPeaksBuf = []; // últimos picos de aceleração quando GPS > 0.5 m/s
  let consecutiveLow = 0; // quantos picos consecutivos abaixo do threshold

  function updatePocketMode(mag, gpsSpeed) {
    // Se o GPS parou ou acelerômetro voltou ao normal, sai do modo bolso
    if (gpsSpeed != null && gpsSpeed < 0.3) {
      pocketMode = false;
      pocketThreshold = threshold;
      consecutiveLow = 0;
      return;
    }
    if (pocketMode && mag >= threshold) {
      pocketMode = false;
      pocketThreshold = threshold;
      consecutiveLow = 0;
      return;
    }
    // sem GPS suficiente — não alterna modo bolso
    if (gpsSpeed == null || gpsSpeed < 0.5) {
      consecutiveLow = 0;
      return;
    }
    // GPS confirma movimento, mas acelerômetro está baixo?
    if (mag < threshold && mag > 0.8) {
      consecutiveLow++;
    } else {
      consecutiveLow = Math.max(0, consecutiveLow - 2);
    }
    // Após 5 picos consecutivos abaixo do threshold com GPS ativo,
    // ativa modo bolso e reduz o threshold.
    if (consecutiveLow >= 5 && !pocketMode) {
      pocketMode = true;
      const recentPeaks = accelPeaksBuf.slice(-10);
      if (recentPeaks.length >= 3) {
        const avg = recentPeaks.reduce((a, b) => a + b, 0) / recentPeaks.length;
        // threshold = média dos picos (ligeiramente abaixo para capturar)
        pocketThreshold = Math.max(pocketThresholdFloor, Math.min(avg * 0.95, threshold));
      } else {
        pocketThreshold = 1.2;
      }
    }
  }

  return {
    push(mag, t, gpsSpeed) {
      // --- Filtro de velocidade GPS ---
      if (gpsSpeed != null) {
        speedBuf.push(gpsSpeed);
        if (speedBuf.length > 5) speedBuf.shift();
        const sorted = [...speedBuf].sort((a, b) => a - b);
        const medianSpeed = sorted[Math.floor(sorted.length / 2)];
        if (medianSpeed < 0.3) {
          above = false;
          return steps;
        }
      }

      // --- Modo bolso: detecta e ajusta threshold ---
      if (mag > 0.8) accelPeaksBuf.push(mag);
      if (accelPeaksBuf.length > 20) accelPeaksBuf.shift();
      updatePocketMode(mag, gpsSpeed);

      const effThreshold = pocketMode ? pocketThreshold : threshold;

      // --- Detecção de pico com hysteresis ---
      if (mag >= effThreshold && !above) {
        above = true;
        const dt = t - lastPeakAt;
        // cadência dentro da janela válida?
        if (dt >= minIntervalMs && dt <= maxIntervalMs) {
          steps += 1;
          lastPeakAt = t;
        }
        // se dt < minIntervalMs: muito rápido (shaking) → ignora
        // se dt > maxIntervalMs: muito lento ou primeiro passo → aceita
        else if (dt > maxIntervalMs) {
          steps += 1;
          lastPeakAt = t;
        }
      } else if (mag < effThreshold * hysteresis) {
        above = false;
      }
      return steps;
    },
    /** Zera o contador (novo dia / reset). */
    reset() {
      steps = 0;
      lastPeakAt = -Infinity;
      above = false;
      speedBuf.length = 0;
      accelPeaksBuf.length = 0;
      pocketMode = false;
      pocketThreshold = threshold;
      consecutiveLow = 0;
    },
    /** Retorna se o modo bolso está ativo (threshold reduzido). */
    isPocketMode() {
      return pocketMode;
    },
    /** Retorna o threshold efetivo atual (útil para debug/UI). */
    getEffectiveThreshold() {
      return pocketMode ? pocketThreshold : threshold;
    },
    /** Retorna o total atual sem incrementar. */
    get() {
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
