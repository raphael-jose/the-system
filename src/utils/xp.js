import { rankForLevel, RANK_INDEX } from "../data/ranks";

// XP para subir de level: level atual * 100 (Level 1→2 = 100, 2→3 = 200...)
export function xpToNext(level) {
  return level * 100;
}

// Bônus de streak: 3 dias +10%, 7 dias +25%, 30 dias +50%
export function streakMultiplier(streak) {
  if (streak >= 30) return 1.5;
  if (streak >= 7) return 1.25;
  if (streak >= 3) return 1.1;
  return 1;
}

/**
 * Aplica XP ao jogador, resolvendo múltiplos level ups.
 * Retorna o jogador atualizado + quantos níveis subiu.
 */
export function applyXp(player, amount) {
  let { level, xp } = player;
  let levelsGained = 0;
  xp += Math.round(amount);
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
    levelsGained += 1;
  }
  return {
    player: { ...player, level, xp },
    levelsGained,
  };
}

/** Detecta se houve mudança de rank entre dois levels. */
export function rankChanged(beforeLevel, afterLevel) {
  const before = RANK_INDEX[rankForLevel(beforeLevel).rank];
  const after = RANK_INDEX[rankForLevel(afterLevel).rank];
  return after > before;
}
