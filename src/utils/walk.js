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
 * Detector de passos por acelerômetro com validação multi-camada.
 *
 * Camadas anti-falso-positivo (todas devem passar para contar um passo):
 *
 *  1. LOW-PASS FILTER — suaviza o sinal bruto (EMA α=0.2), remove
 *     ruído de alta frequência (tremor de mão, vibração).
 *
 *  2. DETECÇÃO DE PICO — só registra transição repouso→pico quando
 *     a magnitude cruza um limiar adaptativo (= baseline + 0.35g).
 *     O baseline é a média das últimas ~50 amostras (≈ 1.7s a 30 Hz).
 *     Isso garante que o pico é significativo ACIMA do ruído local.
 *
 *  3. CADÊNCIA — intervalo entre passos deve ser 250-750ms
 *     (1.3-4.0 Hz). Shaking costuma ser > 4 Hz ou irregular.
 *
 *  4. AMPLITUDE CONSISTENTE — picos consecutivos devem ter
 *     magnitude similar (desvio < 40% da média). Shaking tende a
 *     ter amplitudes muito variáveis.
 *
 *  5. GPS CROSS-VALIDATION — se GPS disponível, velocidade mediana
 *     das últimas 5 amostras deve ser > 0.3 m/s.
 *
 * Modo bolso: quando GPS confirma movimento mas acelerômetro tem
 * picos baixos, reduz o limiar adaptativo proporcionalmente.
 *
 * @returns {{ push(mag, t, gpsSpeed): number, reset(): void, isPocketMode(): boolean, get(): number }}
 */
export function createStepCounter({
  alpha = 0.2,         // EMA do low-pass filter
  cadenceMinMs = 250,  // passo mais rápido (corrida leve)
  cadenceMaxMs = 750,  // passo mais lento (caminhada)
  baselineWindow = 50, // amostras para baseline (~1.7s a 30Hz)
  peakProminence = 0.35, // pico precisa ser ≥ 0.35g acima do baseline
  ampTolerance = 0.4,  // tolerância de amplitude entre passos (40%)
  pocketThresholdFloor = 1.0,
} = {}) {
  let steps = 0;
  let lastPeakAt = -Infinity;
  let lastPeakMag = 0;
  let above = false;

  // Low-pass filter state
  let filtered = 1.0; // magnitude filtrada (inicia em 1g = repouso)
  let firstSample = true;

  // Baseline (média móvel das últimas N amostras)
  const baselineBuf = [];

  // Cadência: histórico dos últimos 6 intervalos para validar padrão
  const intervalBuf = [];

  // GPS speed buffer para mediana
  const speedBuf = [];

  // Modo bolso
  let pocketMode = false;
  const accelPeaksBuf = [];
  let consecutiveLow = 0;

  function getBaseline() {
    if (baselineBuf.length < 5) return 1.0; // fallback: 1g
    let sum = 0;
    for (let i = 0; i < baselineBuf.length; i++) sum += baselineBuf[i];
    return sum / baselineBuf.length;
  }

  function getMedianSpeed() {
    if (speedBuf.length === 0) return null;
    const sorted = [...speedBuf].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  function isCadenceValid(dt) {
    if (dt < cadenceMinMs) return false; // rápido demais (shaking)
    if (dt > cadenceMaxMs) return true;  // lento → primeiro passo ou caminhada lenta
    // Para intervalos dentro da janela, verifica consistência
    // dos últimos passos (desvio padrão < 200ms)
    if (intervalBuf.length >= 2) {
      const mean = intervalBuf.reduce((a, b) => a + b, 0) / intervalBuf.length;
      const variance = intervalBuf.reduce((s, v) => s + (v - mean) ** 2, 0) / intervalBuf.length;
      if (Math.sqrt(variance) > 200) return false; // irregular → shaking
    }
    return true;
  }

  function isAmplitudeConsistent(mag) {
    if (lastPeakMag === 0) return true; // primeiro passo
    const ratio = Math.abs(mag - lastPeakMag) / Math.max(lastPeakMag, 0.1);
    return ratio < ampTolerance;
  }

  function updatePocketMode(mag, gpsSpeed) {
    if (gpsSpeed != null && gpsSpeed < 0.3) {
      pocketMode = false;
      consecutiveLow = 0;
      return;
    }
    if (gpsSpeed == null || gpsSpeed < 0.5) {
      consecutiveLow = 0;
      return;
    }
    // GPS confirma movimento, mas acelerômetro baixo?
    const baseline = getBaseline();
    const prominence = mag - baseline;
    if (prominence < peakProminence && mag > 0.8) {
      consecutiveLow++;
    } else {
      consecutiveLow = Math.max(0, consecutiveLow - 2);
    }
    if (consecutiveLow >= 5 && !pocketMode) {
      pocketMode = true;
    }
    if (pocketMode && (gpsSpeed < 0.3 || (mag - baseline) >= peakProminence)) {
      pocketMode = false;
    }
  }

  return {
    push(mag, t, gpsSpeed) {
      // --- 1. Low-pass filter (EMA) ---
      if (firstSample) {
        filtered = mag;
        firstSample = false;
      } else {
        filtered = alpha * mag + (1 - alpha) * filtered;
      }

      // --- 2. Atualiza baseline (média móvel) ---
      baselineBuf.push(filtered);
      if (baselineBuf.length > baselineWindow) baselineBuf.shift();

      // --- 3. GPS speed filter ---
      if (gpsSpeed != null) {
        speedBuf.push(gpsSpeed);
        if (speedBuf.length > 5) speedBuf.shift();
        const medianSpeed = getMedianSpeed();
        if (medianSpeed != null && medianSpeed < 0.3) {
          above = false;
          return steps;
        }
      }

      // --- 4. Modo bolso ---
      if (filtered > 0.8) accelPeaksBuf.push(filtered);
      if (accelPeaksBuf.length > 20) accelPeaksBuf.shift();
      updatePocketMode(filtered, gpsSpeed);

      // --- 5. Detecção de pico (usa valor CRU, não filtrado) ---
      // O filtro suaviza o baseline; o pico real deve ser detectado no
      // sinal bruto para não perder a transição repouso→pico.
      const baseline = getBaseline();
      const prominence = mag - baseline;
      const effectiveProminence = pocketMode ? peakProminence * 0.7 : peakProminence;

      if (prominence >= effectiveProminence && !above) {
        above = true;
        const dt = t - lastPeakAt;

        const cadenceOk = isCadenceValid(dt);
        const amplitudeOk = isAmplitudeConsistent(mag);

        if (cadenceOk && amplitudeOk) {
          steps += 1;
          lastPeakAt = t;
          lastPeakMag = mag;
          if (dt >= cadenceMinMs && dt <= cadenceMaxMs) {
            intervalBuf.push(dt);
            if (intervalBuf.length > 6) intervalBuf.shift();
          }
        }
      } else if (prominence < effectiveProminence * 0.7) {
        above = false;
      }

      return steps;
    },
    reset() {
      steps = 0;
      lastPeakAt = -Infinity;
      lastPeakMag = 0;
      above = false;
      filtered = 1.0;
      firstSample = true;
      baselineBuf.length = 0;
      intervalBuf.length = 0;
      speedBuf.length = 0;
      accelPeaksBuf.length = 0;
      pocketMode = false;
      consecutiveLow = 0;
    },
    isPocketMode() {
      return pocketMode;
    },
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
