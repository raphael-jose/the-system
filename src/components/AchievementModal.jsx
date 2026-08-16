import { useEffect, useState } from "react";
import AchievementIcon from "./AchievementIcon";
import { ACHIEVEMENTS, TIER_META } from "../data/achievements";

/**
 * Modal próprio de conquista desbloqueada (diferente do LEVEL UP).
 * - Flash dourado + scanline do sistema
 * - Cards das conquistas entram em sequência (stagger)
 * - CONTINUAR aparece após 1.2s
 */
export default function AchievementModal({ batch, onClose }) {
  const [showBtn, setShowBtn] = useState(false);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShowBtn(false);
    setShown(0);
    const t1 = setTimeout(() => setShowBtn(true), 1200);
    const t2 = setTimeout(() => setShown(batch.length), 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [batch]);

  const items = batch
    .map((id) => ACHIEVEMENTS.find((a) => a.id === id))
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/85 animate-fade-in"
        style={{ animationDuration: "0.3s" }}
      />
      <div
        className="level-flash"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, rgba(250,204,21,0.45), transparent 70%)",
        }}
      />

      <div className="relative z-10 px-5 py-6 text-center animate-scale-pop max-h-[90dvh] overflow-y-auto">
        <p
          className="font-display font-black text-[15px] tracking-[0.35em] mb-4"
          style={{
            color: "#facc15",
            textShadow: "0 0 20px rgba(250,204,21,0.7)",
          }}
        >
          CONQUISTA DESBLOQUEADA
        </p>

        <div className="space-y-2">
          {items.slice(0, shown).map((ach, i) => {
            const tier = TIER_META[ach.tier];
            return (
              <div
                key={ach.id}
                className="sys-frame px-4 py-3 flex items-center gap-3 text-left animate-scale-pop"
                style={{
                  animationDelay: `${0.15 * i}s`,
                  borderColor: tier.color,
                  boxShadow: `0 0 10px ${tier.color}33`,
                }}
              >
                <span
                  className="flex-none w-[38px] h-[38px] rounded-[4px] flex items-center justify-center"
                  style={{ border: `1px solid ${tier.color}`, color: tier.color }}
                >
                  <AchievementIcon id={ach.icon} size={20} />
                </span>
                <div className="min-w-0">
                  <p className="font-title text-[16px] font-semibold text-primary leading-tight flex items-center gap-2">
                    {ach.title}
                    {ach.spReward ? (
                      <span
                        className="font-display text-[10px] font-bold px-1.5 py-0.5 rounded-[3px]"
                        style={{
                          color: "#facc15",
                          border: "1px solid rgba(250,204,21,0.6)",
                        }}
                      >
                        +{ach.spReward} SP
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[11px] text-secondary">{ach.desc}</p>
                  <p
                    className="text-[9px] uppercase tracking-[0.15em] mt-0.5"
                    style={{ color: tier.color }}
                  >
                    {tier.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {showBtn && (
          <button
            type="button"
            onClick={onClose}
            className="btn-system gold mt-6 px-10 py-2.5 text-[14px] animate-fade-in"
          >
            Continuar
          </button>
        )}
      </div>
    </div>
  );
}
