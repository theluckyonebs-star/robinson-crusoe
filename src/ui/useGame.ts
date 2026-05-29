import { useReducer } from "react";
import { reducer, startGame, type GameAction, type GameState } from "@engine";

/** Wraps the pure engine reducer in React state. */
export function useGame(): [GameState, (action: GameAction) => void] {
  const [state, dispatch] = useReducer(reducer, undefined, () => startGame());
  return [state, dispatch];
}
