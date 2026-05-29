// Core domain types for the Robinson Crusoe digital engine.
// The engine is pure (no React / DOM). The UI reads this state and dispatches
// GameActions through the reducer in `reducer.ts`.

export type ResourceType = "wood" | "food" | "hide" | "fur";

export type Resources = Record<ResourceType, number>;

/** The character roles from the base game, plus companion types. */
export type CharacterRole = "carpenter" | "cook" | "explorer" | "soldier" | "friday" | "dog";

export interface Character {
  id: string;
  role: CharacterRole;
  name: string;
  health: number;
  maxHealth: number;
  pawns: number;
  determination: number;
  moraleLossAt: number[];
  /** Companion: Friday or Dog. Companions have special immunity rules. */
  isCompanion?: boolean;
  companionType?: "friday" | "dog";
  /** Dog is completely invincible — damage is always a no-op. */
  invincible?: boolean;
  /**
   * Friday is immune to passive environmental damage:
   * weather exposure, hunger wounds, morale overflow wounds.
   * He CAN be hurt by risky action injury dice, beast attacks (solo hunt),
   * and event/adventure card effects.
   */
  immuneToPassiveDamage?: boolean;
}

export type AbilityKind = "passive" | "active";

export interface Ability {
  id: string;
  name: string;
  description: string;
  kind: AbilityKind;
  cost?: number;
  effects?: Effect[];
}

/** Things you can raise/build at the camp. */
export type BuildTarget = "shelter" | "roof" | "palisade" | "weapon";

export interface CampState {
  shelterBuilt: boolean;
  roofLevel: number;
  palisadeLevel: number;
  weaponLevel: number;
}

/** Terrain types for the island's hex tiles. */
export type TerrainType =
  | "beach"
  | "forest"
  | "plain"
  | "hills"
  | "swamp"
  | "lake"
  | "rocky";

/** A one-time-use treasure found on a tile. */
export interface TileTreasure {
  /** Unique instance id (templateId-tileKey-index). */
  id: string;
  name: string;
  description: string;
  effect: Effect;
  claimed: boolean;
}

/** One hex tile of the island, addressed by axial coordinates (q, r). */
export interface Tile {
  q: number;
  r: number;
  terrain: TerrainType;
  explored: boolean;
  hasCamp: boolean;
  treasures: TileTreasure[];
  /** Optional beast living on this tile, discoverable when explored. */
  beast?: Beast;
}

/** What a pawn can be assigned to do during the Action phase. */
export type ActionKind =
  | "gather"
  | "explore"
  | "build"
  | "hunt"
  | "arrange"
  | "rest"
  | "resolveThreat"
  | "claimTreasure";

/** One assignment of a pawn (or pair of pawns) to an action. */
export interface Assignment {
  id: string;
  action: ActionKind;
  pawnIds: string[];
  buildTarget?: BuildTarget;
  itemId?: string;
  tileKey?: string;
  gatherResource?: "wood" | "food";
  threatId?: string;
  beastInstanceId?: string;
}

export type ScenarioId = "survival" | "castaways";

/** The five island biomes. Beach is always discovered (camp starts there). */
export type Biome = "beach" | "plains" | "hills" | "mountains" | "rivers";

export type WeatherDie = "rain" | "snow" | "danger" | "storm";
export type DangerResult = "nothing" | "palisade" | "roof" | "beast";
export type StormResult = "fierce-winds" | "hurricane";

/** One weather die roll, stored for animated playback. */
export interface WeatherStep {
  die: WeatherDie;
  faceLabel: string;
  rain: number;
  snow: number;
  dangerResult?: DangerResult;
  stormResult?: StormResult;
}

/** The six phases of a round, in order, plus the terminal state. */
export type Phase =
  | "event"
  | "morale"
  | "production"
  | "action"
  | "actionDone"   // actions resolved; player clicks to proceed to weather
  | "weather"
  | "night"
  | "gameOver";

// ---- Data-driven effects ----------------------------------------------------

export type Effect =
  | { kind: "none" }
  | { kind: "gainResource"; resource: ResourceType; amount: number }
  | { kind: "loseResource"; resource: ResourceType; amount: number }
  | { kind: "loseHealthAll"; amount: number }
  | { kind: "loseHealthOne"; amount: number }
  | { kind: "healAll"; amount: number }
  | { kind: "healOne"; amount: number }
  | { kind: "gainWeapon"; amount: number }
  | { kind: "revealTile"; count?: number }
  | { kind: "changeMorale"; amount: number }
  | { kind: "changeDetermination"; amount: number }
  /** Grant the acting character a one-time reroll for their next action of the given family. */
  | { kind: "grantReroll"; actionFamily: "gather" | "explore" | "build" }
  | { kind: "mitigateWeather"; amount: number }
  | { kind: "boostAttack"; amount: number }
  /** Randomly deplete a gathered tile (resources can no longer be gathered there). */
  | { kind: "depleteTile" }
  /** Add a weather die to tonight's weather phase. */
  | { kind: "extraWeatherDie"; die: WeatherDie }
  /** Skip the next production phase entirely. */
  | { kind: "skipProduction" }
  /**
   * Check palisade level: if camp.palisadeLevel >= requiredLevel, no harm.
   * Otherwise apply fallbackEffect.
   */
  | { kind: "palisadeDefend"; requiredLevel: number; fallbackEffect: Effect };

export interface ResolveRequirement {
  pawns: number;
  resources?: Partial<Resources>;
}

export interface EventCard {
  id: string;
  name: string;
  story: string;
  immediate: { text: string; effect: Effect };
  resolve: {
    text: string;
    requirement: ResolveRequirement;
    reward: { text: string; effect: Effect };
  };
  consequence: { text: string; effect: Effect };
}

export type WeatherFace = "sun" | "rain" | "storm";

export interface WeatherResult {
  faces: WeatherFace[];
  rainTotal: number;
  breach: number;
}

export type AdventureDeck = "gather" | "explore" | "build";

export interface AdventureCard {
  id: string;
  deck: AdventureDeck;
  title: string;
  text: string;
  effect: Effect;
  /** If this item id is built, the immediate effect is negated. */
  effectMitigatedBy?: string;
  followup?: { text: string; effect: Effect; mitigable?: boolean };
}

export interface Item {
  id: string;
  name: string;
  description: string;
  tier: "basic" | "special" | "character";
  cost: Partial<Resources>;
  requires?: string[];
  /** A biome must be discovered (a tile of matching terrain explored) to build. Beach is always discovered. */
  requiresBiome?: Biome;
  /** If set, this invention is always available when that character is in the roster. */
  ownedBy?: CharacterRole;
  onBuild?: Effect;
  weaponBonus?: number;
  productionWoodBonus?: number;
  productionFoodBonus?: number;
  gatherWoodBonus?: number;
  gatherFoodBonus?: number;
  weatherProtection?: number;
  preservesFood?: number;
  abilityCostReduction?: number;
  mitigatesAdventures?: boolean;
  injuryReduction?: number;
  depletionImmune?: boolean;
  cancelExtraWeatherDie?: number;
  moraleFloor?: number;
}

export interface Beast {
  id: string;
  name: string;
  strength: number;
  weaponDull: number;
  food: number;
  leather: number;
}

/** A beast discovered on an explored tile, available to hunt. */
export interface DiscoveredBeast extends Beast {
  /** Unique id: "{beast.id}-{tileKey}" */
  instanceId: string;
}

export interface ActionRoll {
  label: string;
  success: boolean;
  injury: boolean;
  chance: boolean;
}

export interface ResolutionStep {
  label: string;
  roll?: { success: boolean; injury: boolean; chance: boolean };
  lines: string[];
}

export interface GameState {
  round: number;
  maxRounds: number;
  phase: Phase;

  characters: Character[];
  availablePawns: string[];
  assignments: Assignment[];

  resources: Resources;
  morale: number;
  firstPlayerIndex: number;
  usedAbilities: string[];
  camp: CampState;
  tiles: Tile[];
  builtItems: string[];
  discoveredBeasts: DiscoveredBeast[];
  lastRolls: ActionRoll[];
  resolutionSteps: ResolutionStep[];
  resolutionId: number;

  eventDrawPile: EventCard[];
  threatQueue: EventCard[];
  eventDiscard: EventCard[];
  pendingFollowups: AdventureCard[];

  scenarioId: ScenarioId;
  /** Number of human players (used for dynamic build costs). */
  playerCount: number;
  woodPileStage: number;
  woodPileLastBuiltRound: number;

  /** Pending reroll grants: "${charId}:${actionFamily}" — consumed when a matching action is resolved. */
  rerollGrants: string[];
  /** Weather effects reduced by this many points this round (Carpenter ability). Reset each action phase. */
  weatherMitigations: number;
  /** Temporary weapon strength bonus for the next hunt this round (Soldier ability). Reset each action phase. */
  bonusAttackThisRound: number;
  depletedTiles: string[];
  extraWeatherDice: WeatherDie[];
  skipNextProduction: boolean;

  heldTreasures: TileTreasure[];

  /** Weather die rolls from the most recent weather phase, for animated overlay. */
  weatherSteps: WeatherStep[];
  /** Increments each weather phase to trigger the overlay. */
  weatherId: number;

  lastWeather?: WeatherResult;
  phaseSummary: string[];
  log: string[];
  rngSeed: number;
  outcome?: "won" | "lost";
}
