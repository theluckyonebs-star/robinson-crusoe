// Centralised health changes. All wounds route here so morale-loss marks fire.
// Dogs are invincible; Friday is immune to passive damage sources.

import { clampMorale } from "./config";
import type { GameState } from "./types";

/**
 * Index of the living non-companion character with the lowest health.
 * Pass `includeCompanions: true` for effects that can target Friday (e.g.
 * event/adventure cards that deal loseHealthOne to "someone").
 */
export function weakestLivingIndex(state: GameState, includeCompanions = false): number {
  let best = -1;
  const cs = state.characters;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (c.health <= 0) continue;
    if (c.invincible) continue;
    if (!includeCompanions && c.isCompanion) continue;
    if (best === -1 || c.health < cs[best].health) best = i;
  }
  return best;
}

/**
 * Wound one character by `amount`, applying any morale-loss marks crossed.
 * `passive` = damage from weather/hunger/morale — ignored by immuneToPassiveDamage.
 */
export function damageCharacterAt(
  state: GameState,
  index: number,
  amount: number,
  passive = false,
): { state: GameState; lines: string[] } {
  const c = state.characters[index];
  if (!c || amount <= 0 || c.health <= 0) return { state, lines: [] };
  if (c.invincible) return { state, lines: [] };
  if (passive && c.immuneToPassiveDamage) return { state, lines: [] };

  const oldHealth = c.health;
  const newHealth = Math.max(0, oldHealth - amount);
  const characters = state.characters.map((ch, i) =>
    i === index ? { ...ch, health: newHealth } : ch,
  );

  let moraleLoss = 0;
  for (const mark of c.moraleLossAt) {
    if (oldHealth > mark && newHealth <= mark) moraleLoss += 1;
  }

  let s: GameState = { ...state, characters };
  const lines: string[] = [];
  if (moraleLoss > 0) {
    s = { ...s, morale: clampMorale(s.morale - moraleLoss) };
    lines.push(`  Seeing ${c.name} suffer shakes the team (morale −${moraleLoss}).`);
  }
  return { state: s, lines };
}

/** Wound every living, non-invincible character by `amount`. */
export function damageAll(state: GameState, amount: number, passive = false): { state: GameState; lines: string[] } {
  let s = state;
  const lines: string[] = [];
  for (let i = 0; i < s.characters.length; i++) {
    const c = s.characters[i];
    if (c.health > 0 && !c.invincible && !(passive && c.immuneToPassiveDamage)) {
      const r = damageCharacterAt(s, i, amount, passive);
      s = r.state;
      lines.push(...r.lines);
    }
  }
  return { state: s, lines };
}
