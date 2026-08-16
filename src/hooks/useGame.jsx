import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { migrate, reduce } from "../state/reducer";

export const SAVE_KEY = "system.save.v1";

const GameContext = createContext(null);

/**
 * Fonte única de verdade: o save inteiro vive numa chave do localStorage.
 * Toda mutação passa pelo reducer puro (src/state/reducer.js).
 * Os componentes nunca tocam o storage diretamente.
 */
export function GameProvider({ children }) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return migrate(JSON.parse(raw));
    } catch {
      /* storage corrompido — recomeça do zero */
    }
    return null;
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  // Persistência em tempo real (a cada ação)
  useEffect(() => {
    if (state) {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      } catch {
        /* storage cheio — ignora */
      }
    }
  }, [state]);

  function act(action) {
    const prev = stateRef.current;
    if (
      !prev &&
      action.type !== "CREATE_PLAYER" &&
      action.type !== "RESET_ALL"
    ) {
      return null;
    }
    const [next, result] = reduce(prev, action);
    if (next !== prev) {
      stateRef.current = next;
      setState(next);
    }
    return result;
  }

  const value = useMemo(() => ({ save: state, act }), [state]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  return useContext(GameContext);
}
