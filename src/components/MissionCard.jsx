import { useState } from "react";
import { Timer } from "lucide-react";
import { ExerciseGuide } from "./ExerciseIllustration";

const STAT_COLOR_MAP = {
  FOR: "#f97316",
  AGI: "#4f8ef7",
  VIT: "#22c55e",
  INT: "#a855f7",
  PER: "#facc15",
  SEN: "#38bdf8",
};

function statText(stats) {
  return Object.entries(stats)
    .map(([k, v]) => `+${v} ${k}`)
    .join("  ");
}

/**
 * Card de missão (diária ou semanal).
 * - Checkbox custom SVG com traço animado (nunca checkbox nativo)
 * - Texto flutuante "+XP +ATRIBUTOS" ao completar
 * - Flash verde no card
 * - Guia de exercício expansível quando houver
 */
export default function MissionCard({ mission, type, onComplete, onTrain, isBonus }) {
  const [floating, setFloating] = useState(null);
  const [flash, setFlash] = useState(false);

  const done = mission.completed;

  function handleComplete() {
    if (done) return;
    onComplete(type, mission.id);
    const text = `+${mission.xp} XP  ${statText(mission.stats)}`;
    setFloating({ id: Date.now(), text });
    setFlash(true);
    setTimeout(() => {
      setFloating(null);
      setFlash(false);
    }, 1250);
  }

  const hasGuide = !!mission.exercise;
  const bonus = isBonus || mission.isBonus;

  return (
    <div
      className={`sys-frame relative p-3 border-l-[3px] ${
        done
          ? "border-l-success bg-[rgba(34,197,94,0.05)]"
          : "border-l-glow"
      } ${flash ? "animate-flash-green" : ""}`}
    >
      {floating && <span className="float-xp">{floating.text}</span>}

      <button
        type="button"
        onClick={handleComplete}
        disabled={done}
        className={`w-full flex items-start gap-3 text-left ${
          done ? "cursor-default" : "cursor-pointer"
        }`}
        style={{ minHeight: 44 }}
        aria-label={done ? `${mission.title} (concluída)` : `Completar ${mission.title}`}
      >
        <span className={`sys-check mt-[2px] ${done ? "done" : ""}`}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6.5 L4.8 9.2 L10 3"
              stroke={done ? "#22c55e" : "#4f8ef7"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={`block font-title text-[17px] font-semibold leading-tight ${
              done ? "text-secondary line-through decoration-success/50" : "text-primary"
            }`}
          >
            {mission.title}
            {bonus && (
              <span className="ml-2 align-middle inline-block rank-badge !p-[2px_6px] !text-[10px] text-gold border-gold">
                BÔNUS
              </span>
            )}
            {mission.timeLabel && !bonus && (
              <span className="ml-2 align-middle inline-block rounded-[3px] border border-dim px-1.5 py-[1px] font-display text-[9px] tracking-[0.18em] text-secondary uppercase">
                {mission.timeLabel}
              </span>
            )}
          </span>

          {mission.description && (
            <span className="block text-[12px] text-secondary mt-0.5 leading-snug">
              {mission.description}
            </span>
          )}

          {/* Progresso de missões semanais */}
          {type === "weekly" && mission.progress != null && (
            <span className="block mt-2">
              <span className="inline-block h-[4px] w-full max-w-[160px] rounded-[2px] bg-bluedim align-middle overflow-hidden mr-2">
                <span
                  className="block h-full rounded-[2px] bg-purple transition-[width] duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      (mission.progress / mission.need) * 100
                    )}%`,
                  }}
                />
              </span>
              <span className="font-display text-[11px] text-secondary tabular">
                {mission.progress}/{mission.need}
                {mission.unit ? ` ${mission.unit}` : ""}
              </span>
            </span>
          )}

          <span className="block mt-1.5 space-x-2">
            <span className="font-display text-[13px] text-blue tabular">
              +{mission.xp} XP
            </span>
            {Object.entries(mission.stats || {}).map(([k, v]) => (
              <span
                key={k}
                className="font-display text-[12px] tabular"
                style={{ color: STAT_COLOR_MAP[k] || "#e2e8f0" }}
              >
                +{v} {k}
              </span>
            ))}
          </span>
        </span>
      </button>

      {mission.training && !done && (
        <div className="flex justify-end mt-2 -mb-0.5">
          <button
            type="button"
            onClick={() => onTrain?.(mission)}
            className="btn-system px-3 py-1.5 text-[11px] flex items-center gap-1.5"
            aria-label={`Treino guiado: ${mission.title}`}
          >
            <Timer size={12} /> Treino guiado
          </button>
        </div>
      )}

      {hasGuide && <ExerciseGuide exercise={mission.exercise} />}
    </div>
  );
}
