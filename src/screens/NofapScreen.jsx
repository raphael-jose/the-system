import { useState } from "react";
import { CalendarCheck, Flame, ShieldCheck, X } from "lucide-react";
import { useGame } from "../hooks/useGame.jsx";
import { playSound } from "../utils/sound";
import { todayStr } from "../utils/dates";
import { nofapMilestoneProgress, nofapStreak } from "../utils/nofap";

/** Sistema de disciplina (NoFap): contador de dias limpos, check-in diário
 *  com XP, marcos de 7/30/90 dias e registro de recaída. */
export default function NofapScreen({ run, onClose }) {
  const { save } = useGame();
  const [confirmRelapse, setConfirmRelapse] = useState(false);

  const nf = save?.player?.nofap || {};
  const streak = nofapStreak(save);
  const milestones = nofapMilestoneProgress(save);
  const claimedToday = nf.lastClaim === todayStr();
  const best = Math.max(nf.bestStreak || 0, streak);

  function doRelapse() {
    playSound("streak");
    run({ type: "NOFAP_RELAPSE" });
    setConfirmRelapse(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/85 animate-fade-in"
        style={{ animationDuration: "0.25s" }}
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-[380px] px-4 pb-6">
        <div className="sys-frame p-4 animate-scale-pop glow-blue max-h-[88dvh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-purple" />
              <p className="text-label">Disciplina</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-[34px] h-[34px] rounded-[4px] border border-dim flex items-center justify-center text-secondary active:text-danger active:border-danger"
              aria-label="Fechar disciplina"
            >
              <X size={16} />
            </button>
          </div>

          {/* Contador */}
          <div className="text-center py-4">
            <p className="font-display font-black text-[56px] leading-none tabular text-primary">
              {streak}
            </p>
            <p className="text-label mt-1">DIAS LIMPOS</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="flex items-center gap-1 text-[11px] text-secondary">
                <Flame size={12} className="text-gold" />
                recorde: {best}
              </span>
              <span className="text-ghost">·</span>
              <span className="text-[11px] text-secondary">
                desde{" "}
                {nf.lastRelapse
                  ? nf.lastRelapse.slice(5).replace("-", "/")
                  : (save?.createdAt || todayStr()).slice(5).replace("-", "/")}
              </span>
            </div>
          </div>

          {/* Check-in diário */}
          <button
            type="button"
            onClick={() => run({ type: "NOFAP_CHECKIN" })}
            disabled={claimedToday}
            className={`btn-system w-full py-2.5 text-[13px] flex items-center justify-center gap-2 ${
              claimedToday ? "opacity-60" : ""
            }`}
          >
            <CalendarCheck size={15} />
            {claimedToday ? "Dia registrado" : "Registrar dia limpo · +15 XP"}
          </button>
          <p className="text-[10px] text-ghost text-center mt-1.5">
            Recompensa diária: +15 XP · +1 SEN — uma vez por dia
          </p>

          {/* Marcos */}
          <div className="mt-4 space-y-2">
            <p className="text-label">Marcos</p>
            {milestones.map((m) => {
              const pct = Math.min(100, Math.round((m.current / m.days) * 100));
              return (
                <div key={m.days} className="rounded-[4px] border border-dim p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-title text-[12px] font-semibold uppercase tracking-wider text-primary">
                      {m.title}
                    </p>
                    <p
                      className="text-[10px] font-display tabular"
                      style={{
                        color: m.claimed ? "#facc15" : "var(--color-secondary)",
                      }}
                    >
                      {m.claimed
                        ? `CONQUISTADO +${m.xp} XP`
                        : `${m.current}/${m.days} dias`}
                    </p>
                  </div>
                  <p className="text-[10px] text-ghost">{m.desc}</p>
                  <div className="h-[4px] rounded-[2px] bg-dim overflow-hidden mt-1.5">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        background: m.claimed ? "#facc15" : "var(--color-purple)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recaída */}
          <div className="mt-5 pt-3 border-t border-dim">
            {confirmRelapse ? (
              <div className="space-y-2">
                <p className="text-[11px] text-danger text-center">
                  Recaída zera o contador de dias limpos. Confirmar?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmRelapse(false)}
                    className="btn-system py-2 text-[12px]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={doRelapse}
                    className="btn-system danger py-2 text-[12px]"
                  >
                    Confirmar recaída
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRelapse(true)}
                className="btn-system danger ghost w-full py-2 text-[12px]"
              >
                Registrar recaída
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
