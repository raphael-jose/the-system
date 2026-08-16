import { useState } from "react";
import { useMissions } from "../hooks/useMissions";
import { useGame } from "../hooks/useGame.jsx";
import MissionCard from "../components/MissionCard";
import TrainingModal from "../components/TrainingModal";

export default function MissionsScreen({ run }) {
  const { dailyMissions, weeklyMissions } = useMissions();
  const { save } = useGame();
  const [tab, setTab] = useState("daily");
  const [training, setTraining] = useState(null);

  const dailyDone = dailyMissions.filter((m) => m.completed).length;

  const complete = (type, id, session) =>
    run({ type: "COMPLETE_MISSION", list: type, id, session });

  return (
    <div className="px-4 pt-6 pb-32">
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="text-label">Registro de missões</p>
          <h1 className="font-display font-black text-[22px]">MISSÕES</h1>
        </div>
        {tab === "daily" && (
          <span className="font-display text-[13px] text-blue tabular">
            {dailyDone}/{dailyMissions.length}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1 mb-4 sys-frame p-1">
        {[
          { id: "daily", label: "Diárias" },
          { id: "weekly", label: "Semanais" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-[4px] py-2 font-title font-semibold text-[13px] uppercase tracking-widest transition-colors ${
              tab === t.id
                ? "bg-elevated text-blue glow-blue"
                : "text-secondary"
            }`}
            aria-pressed={tab === t.id}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-2.5">
        {tab === "daily" &&
          dailyMissions.map((m) => (
            <MissionCard
              key={m.id}
              mission={m}
              type="daily"
              onComplete={complete}
              onTrain={setTraining}
            />
          ))}
        {tab === "weekly" &&
          weeklyMissions.map((m) => (
            <MissionCard key={m.id} mission={m} type="weekly" onComplete={complete} />
          ))}
      </div>

      {tab === "daily" && (
        <p className="mt-4 text-center text-[11px] text-ghost">
          As diárias resetam à meia-noite. O bônus de fechar o dia vale{" "}
          +50 XP e +1 SEN.
        </p>
      )}

      {training && (
        <TrainingModal
          mission={training}
          restSec={save?.player?.restSec ?? 45}
          onSetRest={(sec) => run({ type: "SET_REST_SEC", sec })}
          immersiveDefault={save?.player?.trainingImmersive === true}
          onSetImmersive={(value) =>
            run({ type: "SET_TRAINING_IMMERSIVE", value })
          }
          onComplete={(m, session) => {
            complete("daily", m.id, session);
            setTraining(null);
          }}
          onClose={() => setTraining(null)}
        />
      )}
    </div>
  );
}
