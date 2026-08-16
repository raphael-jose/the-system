import { useDungeons } from "../hooks/useDungeons";
import DungeonCard from "../components/DungeonCard";

export default function DungeonsScreen({ run }) {
  const { dungeons } = useDungeons();

  const addProgress = (id, amount) =>
    run({ type: "ADD_DUNGEON_PROGRESS", id, amount });
  const claim = (id) => run({ type: "CLAIM_DUNGEON", id });

  return (
    <div className="px-4 pt-6 pb-32">
      <p className="text-label">Desafios com prazo</p>
      <h1 className="font-display font-black text-[22px] mb-4">DUNGEONS</h1>

      <div className="space-y-3">
        {dungeons.map((d) => (
          <DungeonCard
            key={d.id}
            dungeon={d}
            addProgress={addProgress}
            claim={claim}
          />
        ))}
      </div>

      <p className="mt-4 text-center text-[11px] text-ghost">
        Dungeons são desafios de longo prazo. O progresso é registrado
        manualmente a cada dia. Se o prazo expirar, a dungeon falha.
      </p>
    </div>
  );
}
