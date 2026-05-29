// Buildable inventions. Standardized 9 basic items (always the same base set),
// 9 special items (richer passives, varied effects), 4 character items.
// All items have permanent passives — no one-time-only gains.
// Original placeholder content.

import { BIOME_LABELS, biomeDiscovered } from "./config";
import type { GameState, Item } from "./types";

// ---- 9 Standardized Basic items (permanent passives, no one-time gains) -----

export const BASIC_ITEMS: Item[] = [
  {
    id: "hatchet",
    tier: "basic",
    name: "Hatchet",
    description: "Permanent: +1 wood on every gather action.",
    cost: { wood: 1 },
    gatherWoodBonus: 1,
  },
  {
    id: "basket",
    tier: "basic",
    name: "Woven Basket",
    description: "Permanent: +1 food on every gather action.",
    cost: { wood: 1 },
    gatherFoodBonus: 1,
  },
  {
    id: "spear",
    tier: "basic",
    name: "Carved Spear",
    description: "Permanent: weapon strength +1.",
    cost: { wood: 1 },
    weaponBonus: 1,
  },
  {
    id: "firepit",
    tier: "basic",
    name: "Fire Pit",
    description: "Permanent: weather protection +1 (the fire's warmth counters rain and cold). Unlocks fire-based inventions.",
    cost: { wood: 2 },
    weatherProtection: 1,
  },
  {
    id: "signal-fire",
    tier: "basic",
    name: "Signal Fire",
    description: "A beacon on the highland. Required to complete the signal pile and escape in Castaways. Unlocks powerful fire-based inventions. Requires Mountains biome.",
    cost: { wood: 3 },
    requiresBiome: "mountains",
  },
  {
    id: "garden",
    tier: "basic",
    name: "Garden Plot",
    description: "Permanent: +1 food each Production phase. Requires Plains biome.",
    cost: { wood: 2 },
    requiresBiome: "plains",
    productionFoodBonus: 1,
  },
  {
    id: "fishtrap",
    tier: "basic",
    name: "Fish Trap",
    description: "Permanent: +1 food each Production phase. Requires Rivers biome.",
    cost: { wood: 1 },
    requiresBiome: "rivers",
    productionFoodBonus: 1,
  },
  {
    id: "outpost",
    tier: "basic",
    name: "Hill Outpost",
    description: "Permanent: weather protection +1. Requires Hills biome.",
    cost: { wood: 2 },
    requiresBiome: "hills",
    weatherProtection: 1,
  },
  {
    id: "healerkit",
    tier: "basic",
    name: "Healer's Kit",
    description: "Permanent: negates mitigable adventure-card follow-ups (infections, fevers, etc.). Injury dice deal 0 wounds.",
    cost: { wood: 1, food: 1 },
    mitigatesAdventures: true,
    injuryReduction: 1,
  },
];

// ---- 9 Special items (richer passives — require other items + sometimes biomes) ----

export const SPECIAL_ITEMS: Item[] = [
  {
    id: "waraxe",
    tier: "special",
    name: "War Axe",
    description: "Permanent: weapon strength +2 AND injury die wounds are reduced by 1 when hunting. Requires Hatchet & Carved Spear.",
    cost: { wood: 2, hide: 1 },
    requires: ["hatchet", "spear"],
    weaponBonus: 2,
    injuryReduction: 1,
  },
  {
    id: "greenhouse",
    tier: "special",
    name: "Greenhouse",
    description: "Permanent: +1 more food each Production AND keep 1 food from spoiling each night. Requires Garden Plot & Plains.",
    cost: { wood: 2, hide: 1 },
    requires: ["garden"],
    requiresBiome: "plains",
    productionFoodBonus: 1,
    preservesFood: 1,
  },
  {
    id: "dryingrack",
    tier: "special",
    name: "Drying Rack",
    description: "Permanent: keep up to 2 food from spoiling each night AND +1 food per gather. Requires Woven Basket.",
    cost: { wood: 2, hide: 1 },
    requires: ["basket"],
    preservesFood: 2,
    gatherFoodBonus: 1,
  },
  {
    id: "totem",
    tier: "special",
    name: "Spirit Totem",
    description: "Permanent: active abilities cost 1 less determination AND morale cannot drop below −2. Requires Fire Pit.",
    cost: { wood: 2, hide: 2 },
    requires: ["firepit"],
    abilityCostReduction: 1,
    moraleFloor: -2,
  },
  {
    id: "stormshelter",
    tier: "special",
    name: "Storm Shelter",
    description: "Permanent: weather protection +2 AND cancels 1 extra weather die each round (from adventure cards or events). Requires Signal Fire & Mountains.",
    cost: { wood: 3 },
    requires: ["signal-fire"],
    requiresBiome: "mountains",
    weatherProtection: 2,
    cancelExtraWeatherDie: 1,
  },
  {
    id: "toolkit",
    tier: "special",
    name: "Master Toolkit",
    description: "Permanent: +1 wood AND +1 food on every gather AND injury die wounds are reduced by 1 during all actions. Requires Hatchet & Woven Basket.",
    cost: { wood: 3, hide: 1 },
    requires: ["hatchet", "basket"],
    gatherWoodBonus: 1,
    gatherFoodBonus: 1,
    injuryReduction: 1,
  },
  {
    id: "smokehouse",
    tier: "special",
    name: "Smokehouse",
    description: "Permanent: keep up to 2 more food from spoiling AND immune to tile depletion effects. Requires Fish Trap, Drying Rack & Rivers.",
    cost: { wood: 2, hide: 2 },
    requires: ["fishtrap", "dryingrack"],
    requiresBiome: "rivers",
    preservesFood: 2,
    depletionImmune: true,
  },
  {
    id: "watchtower",
    tier: "special",
    name: "Watchtower",
    description: "Permanent: weather protection +1 AND cancels 1 extra weather die each round. Requires Hill Outpost & Hills.",
    cost: { wood: 3, hide: 1 },
    requires: ["outpost"],
    requiresBiome: "hills",
    weatherProtection: 1,
    cancelExtraWeatherDie: 1,
  },
  {
    id: "fireshrine",
    tier: "special",
    name: "Fire Shrine",
    description: "Permanent: morale cannot drop below −2 AND active abilities cost 1 less determination. Requires Signal Fire & Fire Pit.",
    cost: { wood: 2, hide: 1 },
    requires: ["signal-fire", "firepit"],
    moraleFloor: -2,
    abilityCostReduction: 1,
  },
];

// ---- 4 Character items (always available when that character is in the game) ----

export const CHARACTER_ITEMS: Item[] = [
  {
    id: "carp-bench",
    tier: "character",
    name: "Mastercraft Bench",
    description: "Permanent: +1 wood each Production AND injury dice during builds deal 0 wounds. (Carpenter's methodical workspace.)",
    cost: { wood: 2 },
    ownedBy: "carpenter",
    productionWoodBonus: 1,
    injuryReduction: 1,
  },
  {
    id: "cook-cellar",
    tier: "character",
    name: "Root Cellar",
    description: "Permanent: keep up to 3 food from spoiling each night. (Cook's careful preservation.)",
    cost: { wood: 2 },
    ownedBy: "cook",
    preservesFood: 3,
  },
  {
    id: "expl-charts",
    tier: "character",
    name: "Survey Charts",
    description: "Permanent: +1 wood and +1 food on every gather — the Explorer knows where to look.",
    cost: { wood: 1, hide: 1 },
    ownedBy: "explorer",
    gatherWoodBonus: 1,
    gatherFoodBonus: 1,
  },
  {
    id: "sol-armory",
    tier: "character",
    name: "Field Armory",
    description: "Permanent: weapon strength +2 AND injuries during hunts reduced by 1. (Soldier's disciplined upkeep.)",
    cost: { wood: 2, hide: 1 },
    ownedBy: "soldier",
    weaponBonus: 2,
    injuryReduction: 1,
  },
];

export const ITEMS: Item[] = [...BASIC_ITEMS, ...SPECIAL_ITEMS];

export function findItem(id: string): Item | undefined {
  return [...ITEMS, ...CHARACTER_ITEMS].find((i) => i.id === id);
}

export function hasMedicine(builtItems: string[]): boolean {
  return builtItems.some((id) => findItem(id)?.mitigatesAdventures);
}

export function itemIsLegal(state: GameState, item: Item): { ok: boolean; reason?: string } {
  if (state.builtItems.includes(item.id)) return { ok: false, reason: "Already built" };
  if (item.requires) {
    const missing = item.requires.filter((r) => !state.builtItems.includes(r));
    if (missing.length > 0) {
      const names = missing.map((id) => findItem(id)?.name ?? id).join(", ");
      return { ok: false, reason: `Needs: ${names}` };
    }
  }
  if (item.requiresBiome && !biomeDiscovered(state, item.requiresBiome)) {
    return { ok: false, reason: `Needs ${BIOME_LABELS[item.requiresBiome]} biome discovered` };
  }
  return { ok: true };
}

export interface ItemBonuses {
  productionWood: number;
  productionFood: number;
  gatherWood: number;
  gatherFood: number;
  weatherProtection: number;
  preservesFood: number;
  abilityCostReduction: number;
  injuryReduction: number;
  depletionImmune: boolean;
  cancelExtraWeatherDie: number;
  moraleFloor: number;
}

export function itemBonuses(builtItems: string[]): ItemBonuses {
  const acc: ItemBonuses = {
    productionWood: 0,
    productionFood: 0,
    gatherWood: 0,
    gatherFood: 0,
    weatherProtection: 0,
    preservesFood: 0,
    abilityCostReduction: 0,
    injuryReduction: 0,
    depletionImmune: false,
    cancelExtraWeatherDie: 0,
    moraleFloor: -99,
  };
  for (const id of builtItems) {
    const it = findItem(id);
    if (!it) continue;
    acc.productionWood += it.productionWoodBonus ?? 0;
    acc.productionFood += it.productionFoodBonus ?? 0;
    acc.gatherWood += it.gatherWoodBonus ?? 0;
    acc.gatherFood += it.gatherFoodBonus ?? 0;
    acc.weatherProtection += it.weatherProtection ?? 0;
    acc.preservesFood += it.preservesFood ?? 0;
    acc.abilityCostReduction += it.abilityCostReduction ?? 0;
    acc.injuryReduction += it.injuryReduction ?? 0;
    if (it.depletionImmune) acc.depletionImmune = true;
    acc.cancelExtraWeatherDie += it.cancelExtraWeatherDie ?? 0;
    if ((it.moraleFloor ?? -99) > acc.moraleFloor) acc.moraleFloor = it.moraleFloor ?? -99;
  }
  return acc;
}
