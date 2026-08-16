import { useMemo } from "react";
import { Trophy } from "lucide-react";
import { useGame } from "../hooks/useGame.jsx";
import AchievementIcon from "../components/AchievementIcon";
import {
  ACHIEVEMENTS,
  TIER_META,
  achievementProgress,
} from "../data/achievements";
import { RANKS } from "../data/ranks";

const TIER_ORDER = ["common", "rare", "epic"];

/** Aba dedicada de conquistas — barra de progresso parcial em cada uma. */
export default function AchievementsScreen() {
  const { save } = useGame();
  const unlocked = useMemo(
    () => new Map((save?.achievements || []).map((a) => [a.id, a.unlockedAt])),
    [save?.achievements]
  );
  const prog = useMemo(() => achievementProgress(save), [save]);

  const byTier = TIER_ORDER.map((tier) => ({
    tier,
    items: ACHIEVEMENTS.filter((a) => a.tier === tier),
  }));

  return (
    <div className="px-4 pt-6 pb-32 space-y-4">
      <header>
        <p className="text-label">Registro de feitos</p>
        <h1 className="font-display font-black text-[22px] flex items-center gap-2">
          CONQUISTAS <Trophy size={17} className="text-gold" />
        </h1>
        <p className="text-[11px] text-ghost">
          {unlocked.size}/{ACHIEVEMENTS.length} desbloqueadas
        </p>
      </header>

      {byTier.map(({ tier, items }) => (
        <section key={tier} className="space-y-2">
          <p
            className="text-label"
            style={{ color: TIER_META[tier].color }}
          >
            {TIER_META[tier].label.toUpperCase()}
          </p>
          <div className="space-y-2">
            {items.map((ach) => (
              <AchievementCard
                key={ach.id}
                ach={ach}
                prog={prog[ach.id]}
                unlockedAt={unlocked.get(ach.id)}
              />
            ))}
          </div>
        </section>
      ))}

      <p className="text-[10px] text-ghost leading-relaxed">
        O Sistema registra cada feito automaticamente. As barras mostram o
        progresso parcial até a condição — nada além de observação local.
      </p>
    </div>
  );
}

function AchievementCard({ ach, prog, unlockedAt }) {
  const tier = TIER_META[ach.tier];
  const unlocked = !!unlockedAt;
  const { current = 0, target = 1, unit = "" } = prog || {};
  const pct = Math.min(100, Math.round((current / target) * 100));

  // Rank D usa a letra do rank atual em vez do índice numérico
  const isRank = ach.id === "rank-d";
  const rankLetter = RANKS[Math.min(current, RANKS.length - 1)]?.rank ?? "E";
  const rightLabel = unlocked
    ? "DESBLOQUEADA"
    : isRank
      ? `Rank ${rankLetter}`
      : `${pct}%`;
  const barLine = unlocked
    ? unlockedAt
      ? `Desbloqueada em ${unlockedAt}`
      : "Desbloqueada"
    : `${current}/${target} ${unit}`.trim();

  return (
    <div
      className="sys-frame p-3"
      style={{ borderColor: unlocked ? tier.color : undefined }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex-none mt-0.5"
          style={{ color: unlocked ? tier.color : "var(--color-secondary)" }}
        >
          <AchievementIcon id={ach.icon} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p
              className={`font-title text-[13px] font-semibold uppercase tracking-wider leading-tight ${
                unlocked ? "text-primary" : ""
              }`}
            >
              {ach.title}
            </p>
            <p
              className="text-[10px] font-display tabular whitespace-nowrap"
              style={{
                color: unlocked ? tier.color : "var(--color-secondary)",
              }}
            >
              {rightLabel}
            </p>
          </div>
          <p className="text-[11px] text-secondary leading-snug mt-0.5">
            {ach.desc}
          </p>

          <div className="mt-2">
            <div className="h-[5px] rounded-[2px] bg-dim overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${pct}%`,
                  background: unlocked ? tier.color : "var(--color-blue)",
                  boxShadow: unlocked
                    ? `0 0 6px ${tier.color}`
                    : undefined,
                }}
              />
            </div>
            <p className="text-[10px] text-ghost mt-1 tabular">
              {barLine}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
