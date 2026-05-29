// Data-driven effects. `opts.actorIdx` overrides who takes loseHealthOne
// damage — used in action context so the first pawn (not the weakest) is hurt.
// `opts.canTargetCompanions` lets event cards wound Friday.

import { RESOURCE_LABELS, TERRAIN_LABELS, clampMorale } from "./config";
import { grantDetermination, spendDetermination } from "./determination";
import { damageAll, damageCharacterAt, weakestLivingIndex } from "./health";
import { revealNextTile } from "./map";
import { nextRandom } from "./rng";
import type { Effect, GameState } from "./types";

export interface EffectOpts {
  /** If provided, loseHealthOne targets this character index instead of weakest. */
  actorIdx?: number;
  /** Whether loseHealthOne can target Friday (event cards = true; passive = false). */
  canTargetCompanions?: boolean;
}

export function applyEffect(
  state: GameState,
  effect: Effect,
  opts: EffectOpts = {},
): { state: GameState; lines: string[] } {
  switch (effect.kind) {
    case "none":
      return { state, lines: ["No immediate effect."] };

    case "gainResource": {
      const resources = { ...state.resources, [effect.resource]: state.resources[effect.resource] + effect.amount };
      return { state: { ...state, resources }, lines: [`Gained ${effect.amount} ${RESOURCE_LABELS[effect.resource]}.`] };
    }

    case "loseResource": {
      const have = state.resources[effect.resource];
      const lost = Math.min(have, effect.amount);
      const resources = { ...state.resources, [effect.resource]: have - lost };
      return { state: { ...state, resources }, lines: [`Lost ${lost} ${RESOURCE_LABELS[effect.resource]}.`] };
    }

    case "loseHealthAll": {
      const r = damageAll(state, effect.amount, false);
      return { state: r.state, lines: [`Everyone loses ${effect.amount} health.`, ...r.lines] };
    }

    case "loseHealthOne": {
      let idx = opts.actorIdx;
      if (idx === undefined || idx < 0 || state.characters[idx]?.invincible) {
        // Fall back: pick the weakest, optionally including companions
        idx = weakestLivingIndex(state, opts.canTargetCompanions ?? false);
      }
      if (idx === -1) return { state, lines: ["No one left to wound."] };
      const target = state.characters[idx];
      const r = damageCharacterAt(state, idx, effect.amount, false);
      return { state: r.state, lines: [`${target.name} loses ${effect.amount} health.`, ...r.lines] };
    }

    case "healAll": {
      const characters = state.characters.map((c) =>
        c.health > 0 ? { ...c, health: Math.min(c.maxHealth, c.health + effect.amount) } : c,
      );
      return { state: { ...state, characters }, lines: [`Everyone recovers ${effect.amount} health.`] };
    }

    case "healOne": {
      // Heal the most-wounded (lowest health) non-companion first.
      let best = -1;
      for (let i = 0; i < state.characters.length; i++) {
        const c = state.characters[i];
        if (c.health <= 0 || c.isCompanion) continue;
        if (best === -1 || c.health < state.characters[best].health) best = i;
      }
      if (best === -1) return { state, lines: ["No one to heal."] };
      const target = state.characters[best];
      const characters = state.characters.map((c, i) =>
        i === best ? { ...c, health: Math.min(c.maxHealth, c.health + effect.amount) } : c,
      );
      return { state: { ...state, characters }, lines: [`${target.name} recovers ${effect.amount} health.`] };
    }

    case "gainWeapon": {
      const camp = { ...state.camp, weaponLevel: state.camp.weaponLevel + effect.amount };
      return { state: { ...state, camp }, lines: [`Weapon strength +${effect.amount}.`] };
    }

    case "revealTile": {
      const count = effect.count ?? 1;
      let s = state;
      const lines: string[] = [];
      for (let i = 0; i < count; i++) {
        const { tiles, revealed } = revealNextTile(s.tiles);
        if (!revealed) { lines.push("Nothing left to discover."); break; }
        s = { ...s, tiles };
        lines.push(`Discovered ${TERRAIN_LABELS[revealed.terrain]}.`);
      }
      return { state: s, lines };
    }

    case "changeMorale": {
      const morale = clampMorale(state.morale + effect.amount);
      const verb = effect.amount >= 0 ? "rises" : "falls";
      return { state: { ...state, morale }, lines: [`Morale ${verb} by ${Math.abs(effect.amount)}.`] };
    }

    case "changeDetermination": {
      if (effect.amount >= 0) {
        return { state: grantDetermination(state, effect.amount), lines: [`The team gains ${effect.amount} determination.`] };
      }
      const { state: next, paid } = spendDetermination(state, -effect.amount);
      return { state: next, lines: [`The team loses ${paid} determination.`] };
    }

    case "grantReroll": {
      // The key is finalized in the USE_ABILITY reducer (which knows the charId).
      // applyEffect just records the family; reducer replaces the placeholder key.
      const key = `__reroll__:${effect.actionFamily}`;
      return { state: { ...state, rerollGrants: [...state.rerollGrants, key] }, lines: [`Reroll granted for next ${effect.actionFamily} action.`] };
    }

    case "mitigateWeather": {
      return { state: { ...state, weatherMitigations: state.weatherMitigations + effect.amount }, lines: [`Weather mitigation +${effect.amount} this round.`] };
    }

    case "boostAttack": {
      return { state: { ...state, bonusAttackThisRound: state.bonusAttackThisRound + effect.amount }, lines: [`Attack power +${effect.amount} for next hunt this round.`] };
    }

    case "depleteTile": {
      const candidates = state.tiles.filter((t) => t.explored && !t.hasCamp && !state.depletedTiles.includes(`${t.q},${t.r}`));
      if (candidates.length === 0) return { state, lines: ["A source was targeted for depletion, but nothing suitable was found."] };
      const r = nextRandom(state.rngSeed);
      const tgt = candidates[Math.floor(r.value * candidates.length)];
      const key = `${tgt.q},${tgt.r}`;
      return { state: { ...state, depletedTiles: [...state.depletedTiles, key], rngSeed: r.seed }, lines: [`The ${TERRAIN_LABELS[tgt.terrain]} tile has been depleted — it can no longer be gathered from.`] };
    }

    case "extraWeatherDie": {
      return { state: { ...state, extraWeatherDice: [...state.extraWeatherDice, effect.die] }, lines: [`An extra ${effect.die} die will be rolled in tonight's weather phase!`] };
    }

    case "skipProduction": {
      return { state: { ...state, skipNextProduction: true }, lines: ["The next Production phase will be skipped."] };
    }

    case "palisadeDefend": {
      if (state.camp.palisadeLevel >= effect.requiredLevel) {
        return { state, lines: [`Your palisade (level ${state.camp.palisadeLevel}) holds the threat off.`] };
      }
      const r = applyEffect(state, effect.fallbackEffect, opts);
      return { state: r.state, lines: [`Palisade too low (${state.camp.palisadeLevel}/${effect.requiredLevel} needed) — the threat breaks through!`, ...r.lines] };
    }
  }
}
