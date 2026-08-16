// Tabela de ranks do SYSTEM (níveis mínimos para atingir).
// Fonte: spec do projeto — E D C B A S SS SSS.

export const RANKS = [
  { rank: "E", minLevel: 1, color: "#6b7280", label: "Iniciante" },
  { rank: "D", minLevel: 10, color: "#22c55e", label: "Rastreador" },
  { rank: "C", minLevel: 20, color: "#3b82f6", label: "Caçador" },
  { rank: "B", minLevel: 35, color: "#a855f7", label: "Elite" },
  { rank: "A", minLevel: 50, color: "#f97316", label: "Veterano" },
  { rank: "S", minLevel: 70, color: "#facc15", label: "Sombra" },
  { rank: "SS", minLevel: 90, color: "#facc15", label: "Monarca" },
  { rank: "SSS", minLevel: 100, color: "#facc15", label: "Nacional" },
];

export function rankForLevel(level) {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (level >= r.minLevel) current = r;
  }
  return current;
}

export const RANK_COLORS = Object.fromEntries(
  RANKS.map((r) => [r.rank, r.color])
);

/** Index na tabela (E=0 ... SSS=7), para detectar mudança de rank. */
export const RANK_INDEX = Object.fromEntries(
  RANKS.map((r, i) => [r.rank, i])
);
