import { useCountUp } from "../hooks/useCountUp";

/** Barra de XP principal: 10px, gradiente azul, shimmer + contagem animada. */
export default function XpBar({ xp, need, pct }) {
  const displayXp = useCountUp(xp);
  const displayPct = useCountUp(pct);

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-label">EXP</span>
        <span className="font-display text-[14px] text-blue tabular">
          {displayXp} / {need}
        </span>
      </div>
      <div className="relative h-[10px] w-full rounded-[2px] bg-bluedim overflow-hidden glow-blue">
        <div
          className="xp-fill h-full rounded-[2px] transition-[width] duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #3b6fd4, #4f8ef7, #7eb3ff)",
          }}
        />
      </div>
      <div className="mt-1 text-right">
        <span className="font-display text-[12px] text-secondary tabular">
          {displayPct}%
        </span>
      </div>
    </div>
  );
}
