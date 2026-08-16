import AchievementIcon from "./AchievementIcon";
import { ACHIEVEMENTS, TIER_META } from "../data/achievements";
import { isRecentUnlock } from "../utils/dates";

/**
 * Badge compacto de conquista (grade do Perfil).
 * Desbloqueada: ícone + borda na cor do tier. Bloqueada: apagada.
 * Recém-desbloqueada (hoje/ontem): pulso de glow na cor do tier + marca NOVO.
 */
export default function AchievementBadge({ id, unlockedAt }) {
  const ach = ACHIEVEMENTS.find((a) => a.id === id);
  if (!ach) return null;
  const tier = TIER_META[ach.tier];
  const unlocked = !!unlockedAt;
  const recent = unlocked && isRecentUnlock(unlockedAt);

  return (
    <div
      className={`sys-frame p-2 flex flex-col items-center gap-1 text-center min-h-[72px] justify-center relative ${
        recent ? "badge-pulse" : ""
      }`}
      style={{
        borderColor: unlocked ? tier.color : undefined,
        opacity: unlocked ? 1 : 0.45,
        ...(recent ? { "--pulse-color": tier.color } : {}),
      }}
    >
      {recent && (
        <span
          className="absolute top-1 right-1.5 font-display text-[7px] font-bold tracking-[0.12em]"
          style={{ color: "#facc15", textShadow: "0 0 6px rgba(250,204,21,0.8)" }}
        >
          NOVO
        </span>
      )}
      <span style={{ color: unlocked ? tier.color : "var(--color-secondary)" }}>
        <AchievementIcon id={ach.icon} size={18} />
      </span>
      <p
        className={`font-title text-[10px] font-semibold uppercase tracking-wider leading-tight ${
          unlocked ? "text-primary" : "text-secondary"
        }`}
      >
        {ach.title}
      </p>
      {unlocked && (
        <p className="text-[8px] text-ghost tabular">{unlockedAt}</p>
      )}
    </div>
  );
}
