// Helpers puros do relógio do treino guiado (testáveis).

/** Segundos → "mm:ss" (ou "hh:mm:ss" se >= 1h). */
export function formatClock(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** Progresso de repetições (0..1), clampado. Usado no anel/barra da série. */
export function repProgress(done, target) {
  if (target <= 0) return 0;
  return Math.min(1, Math.max(0, done / target));
}

/** Segundos → "Xmin Ys" para o resumo da sessão. */
export function formatLong(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}s`;
  if (sec === 0) return `${m}min`;
  return `${m}min ${sec}s`;
}
