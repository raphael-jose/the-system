import { xpToNext, streakMultiplier } from "../utils/xp";
import { rankForLevel } from "../data/ranks";
import { usePlayer } from "./usePlayer";

/** Derivados de XP/rank/streak do jogador atual. */
export function useXP() {
  const { player } = usePlayer();
  if (!player) {
    return {
      level: 1,
      xp: 0,
      xpToNext: 100,
      pct: 0,
      rank: rankForLevel(1),
      multiplier: 1,
    };
  }
  const need = xpToNext(player.level);
  return {
    level: player.level,
    xp: player.xp,
    xpToNext: need,
    pct: Math.min(100, Math.round((player.xp / need) * 100)),
    rank: rankForLevel(player.level),
    multiplier: streakMultiplier(player.streak),
  };
}
