// Conquistas do SYSTEM — além dos títulos de dungeon.
// O catálogo é declarativo: cada conquista tem uma condição pura
// avaliada sobre o estado (sem efeitos colaterais).
import { rankForLevel, RANK_INDEX } from "./ranks";

export const ACHIEVEMENTS = [
  {
    id: "first-mission",
    title: "Primeiro Passo",
    desc: "Complete sua primeira missão.",
    tier: "common",
    icon: "crosshair",
  },
  {
    id: "first-level",
    title: "Despertar",
    desc: "Alcance o nível 2 — primeiro LEVEL UP.",
    tier: "common",
    icon: "zap",
  },
  {
    id: "day-complete",
    title: "Dia Perfeito",
    desc: "Feche todas as diárias de um dia.",
    tier: "common",
    icon: "check",
  },
  {
    id: "first-sp",
    title: "Distribuição",
    desc: "Distribua seu primeiro ponto de atributo (SP).",
    tier: "common",
    icon: "plus",
  },
  {
    id: "level-10",
    title: "Décimo Nível",
    desc: "Alcance o nível 10.",
    tier: "rare",
    icon: "shield",
  },
  {
    id: "rank-d",
    title: "Rank D",
    desc: "Alcance o Rank D — deixe de ser um caçador E.",
    tier: "rare",
    icon: "award",
  },
  {
    id: "streak-7",
    title: "Sete Dias",
    desc: "Mantenha uma sequência de 7 dias.",
    tier: "rare",
    icon: "flame",
  },
  {
    id: "missions-100",
    title: "Centésima",
    desc: "Complete 100 missões no total.",
    tier: "rare",
    icon: "list",
  },
  {
    id: "first-dungeon",
    title: "Conquistador",
    desc: "Reivindique a recompensa de uma dungeon.",
    tier: "rare",
    icon: "layers",
  },
  {
    id: "day-full-10",
    title: "Sobrecarga",
    desc: "Complete 10 missões em um único dia.",
    tier: "epic",
    icon: "bomb",
    spReward: 5,
  },
  {
    id: "streak-30",
    title: "Mês de Aço",
    desc: "Mantenha uma sequência de 30 dias.",
    tier: "epic",
    icon: "trophy",
    spReward: 10,
  },
];

export const TIER_META = {
  common: { label: "Comum", color: "#4f8ef7" },
  rare: { label: "Rara", color: "#a855f7" },
  epic: { label: "Épica", color: "#facc15" },
};

/** SP bônus concedido ao desbloquear cada conquista (declarado no catálogo). */
export const ACHIEVEMENT_SP_REWARD = Object.fromEntries(
  ACHIEVEMENTS.filter((a) => a.spReward).map((a) => [a.id, a.spReward])
);

/** Soma de SP bônus de um lote de conquistas recém-desbloqueadas. */
export function achievementSpReward(ids) {
  return (ids || []).reduce(
    (sum, id) => sum + (ACHIEVEMENT_SP_REWARD[id] || 0),
    0
  );
}

/** Nº de missões concluídas num registro de dia (aguenta formato antigo). */
function dayCount(rec) {
  if (Array.isArray(rec)) return rec.length;
  return Array.isArray(rec?.ids) ? rec.ids.length : 0;
}

/**
 * Progresso parcial de cada conquista sobre o estado atual.
 * Retorna { id → { current, target, unit } } — `unit` rotula a barra
 * (ex.: "missões hoje" → "Sobrecarga 7/10 missões hoje").
 * Conquista desbloqueada quando current >= target.
 */
export function achievementProgress(state) {
  const s = state || {};
  const p = s.player || {};
  const level = p.level || 1;
  const rankIdx = RANK_INDEX[rankForLevel(level).rank] ?? 0;

  // maior nº de missões concluídas em um único dia (histórico)
  let maxDay = 0;
  for (const rec of Object.values(s._dailyHistory || {})) {
    const n = dayCount(rec);
    if (n > maxDay) maxDay = n;
  }
  const claimed = (s.dungeons || []).filter((d) => d.claimedAt).length;

  return {
    "first-mission": {
      current: p.totalMissionsCompleted || 0,
      target: 1,
      unit: "missões totais",
    },
    "first-level": { current: level, target: 2, unit: "nível" },
    "day-complete": {
      current: Array.isArray(s._fullDailyDays) ? s._fullDailyDays.length : 0,
      target: 1,
      unit: "dias perfeitos",
    },
    "first-sp": {
      current: p.spAllocated || 0,
      target: 1,
      unit: "SP distribuído",
    },
    "level-10": { current: level, target: 10, unit: "nível" },
    "rank-d": { current: rankIdx, target: 1, unit: "Rank D" },
    "streak-7": {
      current: p.streak || 0,
      target: 7,
      unit: "dias de sequência",
    },
    "missions-100": {
      current: p.totalMissionsCompleted || 0,
      target: 100,
      unit: "missões totais",
    },
    "first-dungeon": {
      current: claimed,
      target: 1,
      unit: "dungeons reivindicadas",
    },
    "day-full-10": { current: maxDay, target: 10, unit: "missões hoje" },
    "streak-30": {
      current: p.streak || 0,
      target: 30,
      unit: "dias de sequência",
    },
  };
}

/**
 * Retorna TODOS os ids de conquistas satisfeitos pelo estado atual.
 * Derivado do progresso (current >= target) — fonte única de verdade.
 * O reducer filtra os que ainda não foram desbloqueados.
 */
export function evaluateAchievements(state) {
  const prog = achievementProgress(state);
  return Object.entries(prog)
    .filter(([, { current, target }]) => current >= target)
    .map(([id]) => id);
}
