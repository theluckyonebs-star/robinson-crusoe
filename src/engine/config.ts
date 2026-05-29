// Tunable game-balance numbers, kept in one place so we can refine them against
// the rulebook without touching engine logic. Values marked PLACEHOLDER are
// reasonable approximations for the vertical slice, not final/faithful numbers.

import type {
  Ability,
  Biome,
  BuildTarget,
  CharacterRole,
  DangerResult,
  GameState,
  Phase,
  ResourceType,
  ScenarioId,
  StormResult,
  TerrainType,
  WeatherDie,
} from "./types";

export const ROLE_NAMES: Record<CharacterRole, string> = {
  carpenter: "Carpenter",
  cook: "Cook",
  explorer: "Explorer",
  soldier: "Soldier",
  friday: "Friday",
  dog: "Dog",
};

export const RESOURCE_LABELS: Record<ResourceType, string> = {
  wood: "Wood",
  food: "Food",
  hide: "Leather",
};

export const PHASE_ORDER: Phase[] = [
  "event",
  "morale",
  "production",
  "action",
  "weather",
  "night",
];

export const PHASE_LABELS: Record<Phase, string> = {
  event: "Event",
  morale: "Morale",
  production: "Production",
  action: "Action",
  actionDone: "Action",   // same tracker step as action
  weather: "Weather",
  night: "Night",
  gameOver: "Game Over",
};

/** Each character provides this many action pawns per round. */
export const PAWNS_PER_CHARACTER = 2;

/** Default scenario length for the slice. */
export const DEFAULT_MAX_ROUNDS = 10;

/** Resource yield for a single gather action (per assignment, not per pawn). */
export const GATHER_YIELD = {
  gatherWood: { wood: 2 } as Partial<Record<ResourceType, number>>,
  gatherFood: { food: 2 } as Partial<Record<ResourceType, number>>,
};

/** Health restored by a `rest` action. */
export const REST_HEAL = 1;

/**
 * Build costs (PLACEHOLDER — to be reconciled with the rulebook).
 * `requiresShelter` gates roof on having built the basic shelter first.
 * `maxLevel` caps repeatable builds.
 */
export interface BuildSpec {
  label: string;
  cost: Partial<Record<ResourceType, number>>;
  requiresShelter?: boolean;
  /** Repeatable structures (palisade/weapon) raise a level; one-shots set built flag. */
  repeatable: boolean;
  maxLevel?: number;
}

// Note: shelter/roof/palisade/weapon costs are computed dynamically at runtime
// via scaledBuildCost(). These placeholders are used only for legality checks.
export const BUILD_SPECS: Record<BuildTarget, BuildSpec> = {
  shelter: { label: "Shelter", cost: {}, repeatable: false },
  roof: { label: "Roof", cost: {}, requiresShelter: true, repeatable: true, maxLevel: 6 },
  palisade: { label: "Palisade", cost: {}, repeatable: true, maxLevel: 6 },
  weapon: { label: "Weapon", cost: {}, repeatable: true, maxLevel: 6 },
};

/** Default roster — all four base-game characters. */
export const DEFAULT_ROSTER: CharacterRole[] = ["carpenter", "cook", "explorer", "soldier"];

// ---- Characters -------------------------------------------------------------
// NOTE: These stats are BEST-EFFORT approximations of the base-game characters,
// not verified against the rulebook. `maxHealth` and `moraleLossAt` (the health
// values that cost the team morale when reached) in particular should be
// confirmed/corrected against your copy. Ability text is paraphrased.

export interface CharacterData {
  maxHealth: number;
  startDetermination: number;
  /** Health values that trigger -1 morale when reached by damage. */
  moraleLossAt: number[];
}

export const CHARACTER_DATA: Record<CharacterRole, CharacterData> = {
  // NOTE: HP and morale-mark values are set per the user's specification.
  // moraleLossAt: health value that triggers −1 morale when reached by damage.
  // Marks spaced as evenly as possible, heftiest gap first.
  // Carpenter 11 HP × 3 marks: segments 3,3,3,2 → marks at 8,5,2
  carpenter: { maxHealth: 11, startDetermination: 0, moraleLossAt: [8, 5, 2] },
  // Cook 12 HP × 4 marks: segments 3,3,2,2,2 → marks at 9,6,4,2
  cook: { maxHealth: 12, startDetermination: 0, moraleLossAt: [9, 6, 4, 2] },
  // Explorer 12 HP × 2 marks: segments 4,4,4 → marks at 8,4
  explorer: { maxHealth: 12, startDetermination: 0, moraleLossAt: [8, 4] },
  // Soldier 12 HP × 2 marks: segments 4,4,4 → marks at 8,4
  soldier: { maxHealth: 12, startDetermination: 0, moraleLossAt: [8, 4] },
  // Companions — data used for display only; companions are constructed manually.
  friday: { maxHealth: 3, startDetermination: 0, moraleLossAt: [] },
  dog: { maxHealth: 3, startDetermination: 0, moraleLossAt: [] },
};

/**
 * Two active abilities per character.
 * 2pt: reroll the success die for the character's primary action (soldier: weapon+1 instead).
 * 3pt: produce a key resource or unique effect (see descriptions).
 */
export const ABILITIES: Record<CharacterRole, Ability[]> = {
  carpenter: [
    {
      id: "carp-reroll",
      name: "Precise Crafting",
      description: "Reroll the success die for your next build action.",
      kind: "active",
      cost: 2,
      effects: [{ kind: "grantReroll", actionFamily: "build" }],
    },
    {
      id: "carp-weatherproof",
      name: "Weatherproofing",
      description: "Reinforce the camp: mitigate 1 weather effect this round.",
      kind: "active",
      cost: 3,
      effects: [{ kind: "mitigateWeather", amount: 1 }],
    },
  ],
  cook: [
    {
      id: "cook-reroll",
      name: "Forager's Eye",
      description: "Reroll the success die for your next gather action.",
      kind: "active",
      cost: 2,
      effects: [{ kind: "grantReroll", actionFamily: "gather" }],
    },
    {
      id: "cook-ration",
      name: "Double Ration",
      description: "Stretch the stores: gain 3 food.",
      kind: "active",
      cost: 3,
      effects: [{ kind: "gainResource", resource: "food", amount: 3 }],
    },
  ],
  explorer: [
    {
      id: "expl-reroll",
      name: "Trail Sense",
      description: "Reroll the success die for your next explore action.",
      kind: "active",
      cost: 2,
      effects: [{ kind: "grantReroll", actionFamily: "explore" }],
    },
    {
      id: "expl-salvage",
      name: "Salvage Run",
      description: "Range out and strip usable timber: gain 3 wood.",
      kind: "active",
      cost: 3,
      effects: [{ kind: "gainResource", resource: "wood", amount: 3 }],
    },
  ],
  soldier: [
    {
      id: "sol-sharpen",
      name: "Sharpen Arms",
      description: "Permanently hone the weapons: weapon strength +1.",
      kind: "active",
      cost: 2,
      effects: [{ kind: "gainWeapon", amount: 1 }],
    },
    {
      id: "sol-fury",
      name: "Battle Fury",
      description: "Channel aggression: attack power +3 for the next hunt this round.",
      kind: "active",
      cost: 3,
      effects: [{ kind: "boostAttack", amount: 3 }],
    },
  ],
  friday: [],
  dog: [],
};

/** Morale track bounds: the marker sits on a discrete space from -3 to +3. */
export const MORALE_MIN = -3;
export const MORALE_MAX = 3;

/** Keep a morale value on the track. */
export function clampMorale(value: number): number {
  return Math.max(MORALE_MIN, Math.min(MORALE_MAX, value));
}

// ---- Phase-specific balance -------------------------------------------------

// ---- Island terrain ---------------------------------------------------------
// Production values are BEST-EFFORT placeholders (wood, food per tile), tunable.

export const TERRAIN_LABELS: Record<TerrainType, string> = {
  beach: "Beach",
  forest: "Woodland",   // Plains biome
  plain: "Plain",       // Plains biome
  hills: "Hills",
  swamp: "Wetland",     // Rivers biome
  lake: "Lake",         // Rivers biome
  rocky: "Mountain",    // Mountains biome
};

/** Each terrain has up to one wood source and one food source, plus a trait. */
export interface TerrainDef {
  wood: boolean;
  food: boolean;
  trait: string;
}

export const TERRAIN: Record<TerrainType, TerrainDef> = {
  beach: { wood: true, food: true, trait: "Beach" },
  forest: { wood: true, food: false, trait: "Plains" },   // Plains biome
  plain: { wood: false, food: true, trait: "Plains" },    // Plains biome
  hills: { wood: true, food: true, trait: "Hills" },
  swamp: { wood: false, food: true, trait: "Rivers" },    // Rivers biome
  lake: { wood: false, food: true, trait: "Rivers" },     // Rivers biome
  rocky: { wood: true, food: false, trait: "Mountains" }, // Mountains biome
};

/** Resource counts (0 or 1 each) a terrain tile provides. */
export function terrainYield(t: TerrainType): { wood: number; food: number } {
  const d = TERRAIN[t];
  return { wood: d.wood ? 1 : 0, food: d.food ? 1 : 0 };
}

/** Terrain types eligible for randomly-generated (non-camp) tiles. */
// Hills have both wood + food. Adding more hills makes dual-resource tiles more common.
export const ISLAND_TERRAINS: TerrainType[] = [
  "forest",
  "plain",
  "hills",
  "hills",
  "hills",
  "swamp",
  "lake",
  "rocky",
];

/** Island size: the hex map spans this many rings out from the camp. */
export const ISLAND_RADIUS = 2;

/** Morale phase: positive morale grants at most this much determination per round. */
export const MORALE_GAIN_CAP = 2;

// ---- New weather dice system ------------------------------------------------
// Rain die (6 faces): 4× "1 rain", 1× "2 rain", 1× "1 snow"
export type RainFace = "rain1" | "rain2" | "snow1";
export const RAIN_DIE: RainFace[] = ["rain1","rain1","rain1","rain1","rain2","snow1"];
export const RAIN_FACE_LABELS: Record<RainFace, string> = { rain1:"1 Rain", rain2:"2 Rain", snow1:"1 Snow" };
export const RAIN_FACE_RAIN: Record<RainFace, number>  = { rain1:1, rain2:2, snow1:0 };
export const RAIN_FACE_SNOW: Record<RainFace, number>  = { rain1:0, rain2:0, snow1:1 };

// Snow die (6 faces): 3× "1 snow", 2× "1 rain", 1× "2 snow"
export type SnowFace = "snow1" | "snow2" | "rain1";
export const SNOW_DIE: SnowFace[] = ["snow1","snow1","snow1","rain1","rain1","snow2"];
export const SNOW_FACE_LABELS: Record<SnowFace, string> = { snow1:"1 Snow", snow2:"2 Snow", rain1:"1 Rain" };
export const SNOW_FACE_RAIN: Record<SnowFace, number>  = { snow1:0, snow2:0, rain1:1 };
export const SNOW_FACE_SNOW: Record<SnowFace, number>  = { snow1:1, snow2:2, rain1:0 };

// Danger die (6 faces): 3× nothing, 1× palisade, 1× roof, 1× beast
export const DANGER_DIE: DangerResult[] = ["nothing","nothing","nothing","palisade","roof","beast"];
export const DANGER_LABELS: Record<DangerResult, string> = { nothing:"Safe", palisade:"Palisade Hit!", roof:"Roof Hit!", beast:"Beast Attacks!" };

/** Which dice to roll given the scenario and current round. */
export function getWeatherDice(scenarioId: ScenarioId, round: number): WeatherDie[] {
  if (scenarioId === "castaways") {
    if (round <= 3) return [];
    if (round <= 6) return ["rain"];
    return ["rain", "snow", "danger"];
  }
  // survival escalation
  if (round <= 5) return ["rain"];
  if (round <= 10) return ["snow"];
  if (round <= 15) return ["rain", "snow"];
  return ["rain", "snow", "danger"];
}

// Storm die: 2 faces fierce-winds (33%), 4 faces hurricane (67%).
export const STORM_DIE: StormResult[] = ["fierce-winds", "fierce-winds", "hurricane", "hurricane", "hurricane", "hurricane"];
export const STORM_LABELS: Record<StormResult, string> = {
  "fierce-winds": "Fierce Winds!",
  "hurricane": "Hurricane!",
};

// rollWeatherDie lives in phases.ts to avoid circular imports with rng.

// ---- Dynamic build costs ---------------------------------------------------

/**
 * Build costs scale with player count (min 2 for 1-player games).
 * Returns the wood cost and the leather (hide) alternative cost (wood−1).
 * Callers try wood first; fall back to leather.
 */
export function scaledBuildCost(playerCount: number): { wood: number; leather: number } {
  const n = Math.max(2, playerCount);
  return { wood: n, leather: n - 1 };
}

// ---- Biome system -----------------------------------------------------------

export const TERRAIN_BIOME: Record<TerrainType, Biome> = {
  beach: "beach",
  forest: "plains",
  plain: "plains",
  hills: "hills",
  swamp: "rivers",
  lake: "rivers",
  rocky: "mountains",
};

export const BIOME_LABELS: Record<Biome, string> = {
  beach: "Beach",
  plains: "Plains",
  hills: "Hills",
  mountains: "Mountains",
  rivers: "Rivers",
};

export const BIOME_ICONS: Record<Biome, string> = {
  beach: "🏖️",
  plains: "🌿",
  hills: "⛰️",
  mountains: "🏔️",
  rivers: "🌊",
};

/** Whether any tile belonging to this biome has been explored. Beach is always true. */
export function biomeDiscovered(state: GameState, biome: Biome): boolean {
  if (biome === "beach") return true;
  return state.tiles.some((t) => t.explored && TERRAIN_BIOME[t.terrain] === biome);
}

/** Night phase: food each character must eat. */
export const NIGHT_FOOD_PER_CHARACTER = 1;
