// Game setup: build a fresh GameState for a new game.

import {
  CHARACTER_DATA,
  DEFAULT_ROSTER,
  PAWNS_PER_CHARACTER,
  ROLE_NAMES,
} from "./config";
import { BEAST_DECK } from "./beasts";
import { EVENT_POOL, GENTLE_EVENT_POOL, OPENING_EVENT } from "./events";
import { generateIsland } from "./map";
// BEAST_DECK is used for seeded tile generation, not a persistent state field.
import { shuffle } from "./rng";
import type { Character, CharacterRole, GameState, Resources } from "./types";

export interface NewGameConfig {
  roster?: CharacterRole[];
  playerCount?: number;
  scenarioId?: import("./types").ScenarioId;
  maxRounds?: number;
  seed?: number;
}

function makeCharacter(role: CharacterRole, index: number): Character {
  const data = CHARACTER_DATA[role];
  return {
    id: `char-${index}-${role}`,
    role,
    name: ROLE_NAMES[role],
    health: data.maxHealth,
    maxHealth: data.maxHealth,
    pawns: PAWNS_PER_CHARACTER,
    determination: data.startDetermination,
    moraleLossAt: [...data.moraleLossAt],
  };
}

function makeFriday(): Character {
  return {
    id: "friday",
    role: "friday",
    name: "Friday",
    health: 3,
    maxHealth: 3,
    pawns: 1,
    determination: 0,
    moraleLossAt: [],
    isCompanion: true,
    companionType: "friday",
    immuneToPassiveDamage: true,
  };
}

function makeDog(): Character {
  return {
    id: "dog",
    role: "dog",
    name: "Dog",
    health: 3,
    maxHealth: 3,
    pawns: 1,
    determination: 0,
    moraleLossAt: [],
    isCompanion: true,
    companionType: "dog",
    invincible: true,
    immuneToPassiveDamage: true,
  };
}

function emptyResources(): Resources {
  return { wood: 0, food: 0, hide: 0 };
}

export function pawnsForRound(characters: Character[]): string[] {
  const ids: string[] = [];
  for (const c of characters) {
    for (let i = 0; i < c.pawns; i++) ids.push(`${c.id}#${i}`);
  }
  return ids;
}

export function createGame(config: NewGameConfig = {}): GameState {
  const humanRoles = (config.roster ?? DEFAULT_ROSTER).filter(
    (r) => r !== "friday" && r !== "dog",
  ) as CharacterRole[];
  const humanChars = humanRoles.map(makeCharacter);

  const playerCount = config.playerCount ?? humanRoles.length;
  const companions: Character[] = [];
  if (playerCount <= 2) companions.push(makeFriday());
  if (playerCount <= 1) companions.push(makeDog());

  const characters = [...humanChars, ...companions];
  const scenarioId = config.scenarioId ?? "survival";
  const maxRounds = config.maxRounds ?? (scenarioId === "castaways" ? 12 : 999);

  const baseSeed = config.seed ?? (Date.now() & 0xffffffff);
  // Shuffle beasts first — used for 50% tile assignment during island gen.
  const { items: shuffledBeasts, seed: afterBeasts } = shuffle(BEAST_DECK, baseSeed);
  const island = generateIsland(afterBeasts, shuffledBeasts);
  // Deck: opener → 2 shuffled gentle events (rounds 2-3) → shuffled main pool.
  const { items: gentleShuffled, seed: afterGentle } = shuffle(GENTLE_EVENT_POOL, island.seed);
  const { items: shuffledPool, seed } = shuffle(EVENT_POOL, afterGentle);
  const deck = [OPENING_EVENT, ...gentleShuffled.slice(0, 2), ...shuffledPool];

  return {
    round: 1,
    maxRounds,
    scenarioId,
    playerCount: Math.max(2, humanRoles.length),
    woodPileStage: 0,
    woodPileLastBuiltRound: 0,
    rerollGrants: [],
    weatherMitigations: 0,
    bonusAttackThisRound: 0,
    depletedTiles: [],
    extraWeatherDice: [],
    skipNextProduction: false,
    phase: "event",
    characters,
    availablePawns: [],
    assignments: [],
    resources: { ...emptyResources() },
    morale: 0,
    firstPlayerIndex: 0,
    usedAbilities: [],
    camp: { shelterBuilt: false, roofLevel: 0, palisadeLevel: 0, weaponLevel: 0 },
    tiles: island.tiles,
    builtItems: [],
    discoveredBeasts: [],
    lastRolls: [],
    resolutionSteps: [],
    resolutionId: 0,
    eventDrawPile: deck,
    threatQueue: [],
    eventDiscard: [],
    pendingFollowups: [],
    heldTreasures: [],
    weatherSteps: [],
    weatherId: 0,
    phaseSummary: [],
    log: ["A new game begins. You wash ashore on a cursed island."],
    rngSeed: seed,
  };
}

export function characterOfPawn(state: GameState, pawnId: string): Character | undefined {
  const charId = pawnId.split("#")[0];
  return state.characters.find((c) => c.id === charId);
}
