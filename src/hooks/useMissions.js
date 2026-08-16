import { useGame } from "./useGame.jsx";

/** Missões diárias e semanais + ação de completar. */
export function useMissions() {
  const { save, act } = useGame();

  const completeMission = (list, id) =>
    act({ type: "COMPLETE_MISSION", list, id });

  return {
    dailyMissions: save?.dailyMissions || [],
    weeklyMissions: save?.weeklyMissions || [],
    completeMission,
  };
}
