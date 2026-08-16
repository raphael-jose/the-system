import { useEffect, useMemo, useState } from "react";
import RankBadge from "./RankBadge";
import { STAT_NAMES, STAT_COLORS, STAT_ORDER } from "../data/statMeta";

const PARTICLES = 22;

/**
 * Overlay de LEVEL UP / RANK UP.
 * - Flash de luz na tela
 * - Texto escala 0.5 → 1.2 → 1
 * - Rank up: partículas douradas + texto grande por 1s
 * - Atributos ganhos aparecem em sequência (stagger 0.1s)
 * - SP (pontos de atributo) distribuíveis antes de CONTINUAR
 * - Botão CONTINUAR só aparece após 1.5s
 */
export default function LevelUpModal({ overlay, sp, stats, onSpend, onAuto, onClose }) {
  const { toLevel, rankBefore, rankAfter, statsGained, levelsGained } = overlay;
  const isRankUp = rankBefore && rankAfter && rankBefore !== rankAfter;
  const [showBtn, setShowBtn] = useState(false);
  const [shownStats, setShownStats] = useState(0);
  const [autoMsg, setAutoMsg] = useState(null);

  function handleAuto() {
    const res = onAuto?.();
    if (res?.spAllocated) {
      const parts = Object.entries(res.spAllocated).map(([k, v]) => `+${v} ${k}`);
      setAutoMsg(`Auto: ${parts.join(" · ")}`);
    }
  }

  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLES }, (_, i) => ({
        id: i,
        left: `${(i * 137) % 100}%`,
        delay: `${(i % 10) * 0.28}s`,
        size: 2 + (i % 3),
      })),
    []
  );

  useEffect(() => {
    setShowBtn(false);
    setShownStats(0);
    const t1 = setTimeout(() => setShowBtn(true), isRankUp ? 3000 : 1500);
    const statsKeys = Object.keys(statsGained || {});
    const t2 = setTimeout(() => setShownStats(statsKeys.length), isRankUp ? 1600 : 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [overlay, isRankUp, statsGained]);

  const statsKeys = Object.keys(statsGained || {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* overlay escuro */}
      <div
        className="absolute inset-0 bg-black/85 animate-fade-in"
        style={{ animationDuration: "0.3s" }}
      />

      {/* flash de luz */}
      <div
        className="level-flash"
        style={{
          background: isRankUp
            ? "radial-gradient(circle at 50% 40%, rgba(250,204,21,0.5), transparent 70%)"
            : "radial-gradient(circle at 50% 40%, rgba(79,142,247,0.45), transparent 70%)",
        }}
      />

      {/* partículas (rank up) */}
      {isRankUp &&
        particles.map((p) => (
          <span
            key={p.id}
            className="particle"
            style={{
              left: p.left,
              width: p.size,
              height: p.size,
              background: p.id % 3 === 0 ? "#a855f7" : "#facc15",
              "--delay": p.delay,
            }}
          />
        ))}

      <div
        className={`relative z-10 px-6 py-6 text-center animate-scale-pop max-h-[90dvh] overflow-y-auto ${
          isRankUp ? "glow-gold" : "glow-blue"
        }`}
      >
        <p
          className="font-display font-black text-[16px] tracking-[0.35em] mb-1 animate-fade-in"
          style={{
            color: isRankUp ? "#facc15" : "#4f8ef7",
            textShadow: isRankUp
              ? "0 0 20px rgba(250,204,21,0.7)"
              : "0 0 20px rgba(79,142,247,0.7)",
          }}
        >
          {isRankUp ? "RANK UP" : "LEVEL UP"}
        </p>

        {isRankUp && (
          <div className="my-3 animate-scale-pop" style={{ animationDelay: "0.4s" }}>
            <RankBadge rank={rankAfter} size="lg" />
          </div>
        )}

        <div className="my-4">
          <span className="font-display font-black text-[26px] text-secondary line-through mr-3 tabular">
            LV {overlay.fromLevel}
          </span>
          <span className="level-number text-[64px] align-middle">
            {toLevel}
          </span>
        </div>

        {levelsGained > 1 && (
          <p className="font-title text-[13px] uppercase tracking-widest text-secondary">
            {levelsGained} níveis de uma vez
          </p>
        )}

        {/* Atributos ganhos — stagger */}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {statsKeys.slice(0, shownStats).map((k, i) => (
            <span
              key={k}
              className="sys-frame px-3 py-1.5 animate-scale-pop"
              style={{ animationDelay: `${0.1 * i}s`, borderColor: STAT_COLORS[k] }}
            >
              <span
                className="font-display text-[14px] tabular"
                style={{ color: STAT_COLORS[k] }}
              >
                +{statsGained[k]} {STAT_NAMES[k]}
              </span>
            </span>
          ))}
          {overlay.spGained > 0 && shownStats > 0 && (
            <span
              className="sys-frame px-3 py-1.5 animate-scale-pop"
              style={{
                animationDelay: `${0.1 * statsKeys.length}s`,
                borderColor: "#facc15",
              }}
            >
              <span className="font-display text-[14px] text-gold tabular">
                +{overlay.spGained} SP
              </span>
            </span>
          )}
        </div>

        {/* Distribuição de SP (antes do CONTINUAR) */}
        {autoMsg && (
          <p className="mt-6 text-[12px] text-gold animate-fade-in">{autoMsg}</p>
        )}
        {sp > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-label">
                SP disponíveis: <span className="text-gold">{sp}</span>
              </p>
              <button
                type="button"
                onClick={handleAuto}
                className="btn-system ghost px-2.5 py-1 text-[10px]"
              >
                Distribuir auto
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {STAT_ORDER.map((stat) => (
                <button
                  key={stat}
                  type="button"
                  onClick={() => onSpend(stat)}
                  className="sys-frame px-2 py-1.5 text-center active:bg-elevated"
                  style={{ borderColor: STAT_COLORS[stat] }}
                >
                  <span
                    className="block font-display text-[10px] leading-tight"
                    style={{ color: STAT_COLORS[stat] }}
                  >
                    {stat} {stats?.[stat] ?? 10}
                  </span>
                  <span className="block font-display text-[13px] text-primary tabular">
                    +1
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {showBtn && (
          <button
            type="button"
            onClick={onClose}
            className={`btn-system mt-6 px-10 py-2.5 text-[14px] animate-fade-in ${
              isRankUp ? "gold" : ""
            }`}
          >
            Continuar
          </button>
        )}
      </div>
    </div>
  );
}
