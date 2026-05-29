// Determination is held per-character. These helpers grant and spend it across
// the team, always starting from the current first player (whose call it is).

import type { GameState } from "./types";

/** Hand out `amount` determination, one at a time, round-robin from first player. */
export function grantDetermination(state: GameState, amount: number): GameState {
  if (amount <= 0 || state.characters.length === 0) return state;
  const n = state.characters.length;
  const characters = state.characters.map((c) => ({ ...c }));
  for (let k = 0; k < amount; k++) {
    const idx = (state.firstPlayerIndex + k) % n;
    characters[idx].determination += 1;
  }
  return { ...state, characters };
}

/**
 * Spend up to `amount` determination from the team, starting with the first
 * player and continuing around the table. Returns how much was actually paid.
 */
export function spendDetermination(state: GameState, amount: number): { state: GameState; paid: number } {
  if (amount <= 0 || state.characters.length === 0) return { state, paid: 0 };
  const n = state.characters.length;
  const characters = state.characters.map((c) => ({ ...c }));
  let paid = 0;
  // Multiple passes so a single rich player can cover more than one token.
  let progressed = true;
  while (paid < amount && progressed) {
    progressed = false;
    for (let k = 0; k < n && paid < amount; k++) {
      const idx = (state.firstPlayerIndex + k) % n;
      if (characters[idx].determination > 0) {
        characters[idx].determination -= 1;
        paid += 1;
        progressed = true;
      }
    }
  }
  return { state: { ...state, characters }, paid };
}
