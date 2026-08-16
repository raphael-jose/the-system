import { useState } from "react";
import { Flame, Minus, Plus, Skull } from "lucide-react";
import { ExerciseGuide } from "./ExerciseIllustration";
import { addDays, daysUntil, todayStr } from "../utils/dates";

const STAT_COLOR_MAP = {
  FOR: "#f97316",
  AGI: "#4f8ef7",
  VIT: "#22c55e",
  INT: "#a855f7",
  PER: "#facc15",
  SEN: "#38bdf8",
};

/**
 * Dungeon: desafio com prazo e progresso manual.
 * O usuário registra quantas flexões/km/dias já fez.
 */
export default function DungeonCard({ dungeon, addProgress, claim }) {
  const [float, setFloat] = useState(null);

  const pct = Math.min(100, (dungeon.progress / dungeon.goal) * 100);
  const started = dungeon.startedAt || todayStr();
  const deadline = addDays(started, dungeon.deadlineDays);
  const daysLeft = daysUntil(deadline);
  const failed = dungeon.failed || (dungeon.progress < dungeon.goal && daysLeft < 0);
  const done = dungeon.completed;

  function bump(amount) {
    addProgress(dungeon.id, amount);
    if (amount > 0) {
      setFloat({ id: Date.now(), text: `+${amount} ${dungeon.unit}` });
      setTimeout(() => setFloat(null), 1200);
    }
  }

  function handleClaim() {
    claim(dungeon.id);
  }

  return (
    <div
      className={`sys-frame relative p-3 border-l-[3px] ${
        failed
          ? "border-l-danger"
          : done
            ? "border-l-success"
            : "border-l-purple"
      } ${failed ? "glow-danger" : done ? "" : "glow-purple"}`}
    >
      {float && <span className="float-xp">{float.text}</span>}

      <div className="flex items-start justify-between gap-2">
        <h3
          className={`font-title text-[17px] font-semibold leading-tight ${
            done ? "text-secondary" : failed ? "text-danger" : "text-primary"
          }`}
        >
          {dungeon.title}
        </h3>
        {dungeon.rewardTitle && (
          <span className="shrink-0 rank-badge !p-[2px_6px] !text-[10px] text-gold border-gold">
            {dungeon.rewardTitle}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-label">Progresso manual</span>
        <span
          className={`font-display text-[13px] tabular ${
            done ? "text-success" : failed ? "text-danger" : "text-purple"
          }`}
        >
          {dungeon.progress} / {dungeon.goal} {dungeon.unit}
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="mt-1.5 h-[8px] w-full rounded-[2px] bg-purpledim overflow-hidden">
        <div
          className="stat-fill h-full rounded-[2px]"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, #7c3aed, #a855f7, #c084fc)`,
          }}
        />
      </div>

      {/* Prazo */}
      <div className="flex items-center gap-1.5 mt-2">
        {failed ? (
          <>
            <Skull size={13} className="text-danger" />
            <span className="text-[12px] text-danger font-title uppercase tracking-wider">
              Dungeon falhada — prazo expirado
            </span>
          </>
        ) : done ? (
          <span className="text-[12px] text-success font-title uppercase tracking-wider">
            Concluída — recompensa disponível
          </span>
        ) : (
          <>
            <Flame size={13} className={daysLeft <= 5 ? "text-danger" : "text-purple"} />
            <span className="text-[12px] text-secondary">
              <span className={daysLeft <= 5 ? "text-danger" : "text-purple"}>
                {daysLeft} dias
              </span>{" "}
              restantes · prazo {deadline}
            </span>
          </>
        )}
      </div>

      {/* Ações */}
      {!failed && !done && (
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={() => bump(-10)}
            className="btn-system ghost px-2 py-1.5 flex items-center gap-1 !text-[11px]"
            aria-label="Diminuir 10"
          >
            <Minus size={12} />10
          </button>
          <button
            type="button"
            onClick={() => bump(1)}
            className="btn-system px-3 py-1.5 flex-1 !text-[12px]"
            aria-label="Registrar 1"
          >
            +1 {dungeon.unit}
          </button>
          <button
            type="button"
            onClick={() => bump(10)}
            className="btn-system px-3 py-1.5 !text-[12px]"
            aria-label="Registrar 10"
          >
            +10
          </button>
        </div>
      )}

      {done && !dungeon.claimedAt && (
        <div className="mt-3">
          <button
            type="button"
            onClick={handleClaim}
            className="btn-system gold w-full py-2 text-[13px] glow-gold"
          >
            Reivindicar recompensa
          </button>
          <p className="mt-1.5 text-center space-x-2">
            <span className="font-display text-[13px] text-gold tabular">
              +{dungeon.xp} XP
            </span>
            {Object.entries(dungeon.stats || {}).map(([k, v]) => (
              <span
                key={k}
                className="font-display text-[12px] tabular"
                style={{ color: STAT_COLOR_MAP[k] || "#e2e8f0" }}
              >
                +{v} {k}
              </span>
            ))}
            <span className="text-[11px] text-secondary">
              título: {dungeon.rewardTitle}
            </span>
          </p>
        </div>
      )}

      {done && dungeon.claimedAt && (
        <p className="mt-3 text-center font-title text-[12px] uppercase tracking-wider text-success">
          Recompensa reivindicada
        </p>
      )}

      <ExerciseGuide exercise={dungeon.exercise} />
    </div>
  );
}
