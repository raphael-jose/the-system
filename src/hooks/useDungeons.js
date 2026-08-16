import { useGame } from "./useGame.jsx";

/** Dungeons (desafios com prazo) + progresso manual e reivindicação. */
export function useDungeons() {
  const { save, act } = useGame();

  return {
    dungeons: save?.dungeons || [],
    addProgress: (id, amount) =>
      act({ type: "ADD_DUNGEON_PROGRESS", id, amount }),
    claim: (id) => act({ type: "CLAIM_DUNGEON", id }),
  };
}
