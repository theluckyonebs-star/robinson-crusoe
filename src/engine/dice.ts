// The three action dice. Risky (single-pawn) Gather / Explore / Build actions
// roll all three: Success (did it work?), Injury (a wound?), and Chance (draw an
// adventure card?). Probabilities are per action type, set from the game's rules.

import { nextRandom } from "./rng";

/** The action families that roll dice when attempted with a single pawn. */
export type RiskAction = "gather" | "explore" | "build";

export interface RiskProfile {
  success: number;
  injury: number;
  chance: number;
}

export const ACTION_RISK: Record<RiskAction, RiskProfile> = {
  gather: { success: 5 / 6, injury: 1 / 2, chance: 1 / 2 },
  explore: { success: 5 / 6, injury: 1 / 2, chance: 5 / 6 },
  build: { success: 2 / 3, injury: 2 / 3, chance: 1 / 2 },
};

export interface DiceRoll {
  success: boolean;
  injury: boolean;
  chance: boolean;
}

/** Roll the three action dice for a profile, advancing the seed. */
export function rollActionDice(seed: number, profile: RiskProfile): { roll: DiceRoll; seed: number } {
  const a = nextRandom(seed);
  const b = nextRandom(a.seed);
  const c = nextRandom(b.seed);
  return {
    roll: {
      success: a.value < profile.success,
      injury: b.value < profile.injury,
      chance: c.value < profile.chance,
    },
    seed: c.seed,
  };
}
