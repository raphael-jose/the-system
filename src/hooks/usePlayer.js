import { useGame } from "./useGame.jsx";

/** Estado e ações do jogador (nome, XP, level, rank, streak, atributos). */
export function usePlayer() {
  const { save, act } = useGame();
  const player = save?.player || null;

  return {
    player,
    setName: (name) => act({ type: "SET_NAME", name }),
    createPlayer: (name) => act({ type: "CREATE_PLAYER", name }),
    toggleNotifications: () => act({ type: "TOGGLE_NOTIFICATIONS" }),
  };
}
