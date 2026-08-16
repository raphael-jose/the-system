// Sistema de disciplina (NoFap) — helpers puros, testáveis.
// O contador é temporal: dias limpos = dias desde a última recaída
// (ou desde o início do save, se nunca houve recaída).

import { todayStr } from "./dates";

export const NOFAP_MILESTONES = [
  { days: 7, xp: 50, title: "Barreira", desc: "7 dias limpos" },
  { days: 30, xp: 150, title: "Vontade de Ferro", desc: "30 dias limpos" },
  { days: 90, xp: 300, title: "Imaculado", desc: "90 dias limpos" },
];

function daysBetween(a, b) {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  const da = new Date(y1, m1 - 1, d1);
  const db = new Date(y2, m2 - 1, d2);
  return Math.round((db - da) / 86400000);
}

/** Dias limpos (0 = recaída hoje ou primeiro dia). `today` injetável p/ teste. */
export function nofapStreak(save, today = todayStr()) {
  const nf = save?.player?.nofap || {};
  const base = nf.lastRelapse || save?.createdAt || today;
  return Math.max(0, daysBetween(base, today));
}

/** Marcos com progresso parcial (current/days) e estado de reivindicação. */
export function nofapMilestoneProgress(save, today = todayStr()) {
  const streak = nofapStreak(save, today);
  const claimed = new Set(save?.player?.nofap?.milestones || []);
  return NOFAP_MILESTONES.map((m) => ({
    ...m,
    current: Math.min(streak, m.days),
    claimed: claimed.has(m.days),
  }));
}
