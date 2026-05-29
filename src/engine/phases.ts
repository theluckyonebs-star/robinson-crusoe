// The round state machine. Each phase has an "enter" function that applies its
// automatic effects (event/morale/production/weather/night) or sets up player
// interaction (action). `advancePhase` walks the six phases in order and rolls
// the round over after Night.

import { resolveAssignments } from "./actions";
import {
  DANGER_DIE,
  DANGER_LABELS,
  NIGHT_FOOD_PER_CHARACTER,
  RAIN_DIE,
  RAIN_FACE_LABELS,
  RAIN_FACE_RAIN,
  RAIN_FACE_SNOW,
  SNOW_DIE,
  SNOW_FACE_LABELS,
  SNOW_FACE_RAIN,
  SNOW_FACE_SNOW,
  STORM_DIE,
  STORM_LABELS,
  TERRAIN_LABELS,
  clampMorale,
  getWeatherDice,
} from "./config";
import { applyEffect } from "./effects";
import { EVENT_POOL } from "./events";
import { damageAll, damageCharacterAt, weakestLivingIndex } from "./health";
import { findItem, hasMedicine, itemBonuses } from "./items";
import { campProduction } from "./map";
import { pawnsForRound, createGame, type NewGameConfig } from "./setup";
import { nextRandom } from "./rng";
import type { DangerResult, GameState, Phase, StormResult, WeatherDie, WeatherStep } from "./types";

/** Attach the current phase, its summary lines, and append them to the log. */
function commit(state: GameState, phase: Phase, lines: string[]): GameState {
  return { ...state, phase, phaseSummary: lines, log: [...state.log, ...lines] };
}

/** If any character has died, the expedition is lost. */
function checkDefeat(state: GameState): GameState {
  if (state.outcome) return state;
  const dead = state.characters.find((c) => c.health <= 0 && !c.isCompanion);
  if (!dead) return state;
  return {
    ...state,
    phase: "gameOver",
    outcome: "lost",
    log: [...state.log, `${dead.name} has perished. The expedition is lost.`],
  };
}

/** Check scenario-specific win/lose conditions. */
function checkScenario(state: GameState): GameState {
  if (state.outcome) return state;
  if (state.scenarioId === "castaways") {
    if (state.woodPileStage >= 5 && state.round >= 10 && state.builtItems.includes("signal-fire")) {
      return { ...state, phase: "gameOver", outcome: "won", log: [...state.log, "The signal fire blazes from the highland and the pile roars to life. A ship turns toward shore. You are saved!"] };
    }
  }
  return state;
}

// ---- Weather die roller (lives here to access rng without circular dep) -----

function rollWeatherDie(
  seed: number,
  die: WeatherDie,
): { step: WeatherStep; rain: number; snow: number; danger: DangerResult | undefined; storm: StormResult | undefined; seed: number } {
  const r = nextRandom(seed);
  const idx = Math.floor(r.value * 6);
  if (die === "rain") {
    const face = RAIN_DIE[idx];
    return { step: { die, faceLabel: RAIN_FACE_LABELS[face], rain: RAIN_FACE_RAIN[face], snow: RAIN_FACE_SNOW[face] }, rain: RAIN_FACE_RAIN[face], snow: RAIN_FACE_SNOW[face], danger: undefined, storm: undefined, seed: r.seed };
  }
  if (die === "snow") {
    const face = SNOW_DIE[idx];
    return { step: { die, faceLabel: SNOW_FACE_LABELS[face], rain: SNOW_FACE_RAIN[face], snow: SNOW_FACE_SNOW[face] }, rain: SNOW_FACE_RAIN[face], snow: SNOW_FACE_SNOW[face], danger: undefined, storm: undefined, seed: r.seed };
  }
  if (die === "storm") {
    const face = STORM_DIE[idx % STORM_DIE.length];
    return { step: { die, faceLabel: STORM_LABELS[face], rain: 0, snow: 0, stormResult: face }, rain: 0, snow: 0, danger: undefined, storm: face, seed: r.seed };
  }
  // danger
  const face = DANGER_DIE[idx];
  return { step: { die, faceLabel: DANGER_LABELS[face], rain: 0, snow: 0, dangerResult: face }, rain: 0, snow: 0, danger: face, storm: undefined, seed: r.seed };
}

/** Wound the weakest living non-companion character by 1 (passive source). */
function woundWeakest(state: GameState, context: string): { state: GameState; lines: string[] } {
  const idx = weakestLivingIndex(state, false);
  if (idx === -1) return { state, lines: [] };
  const name = state.characters[idx].name;
  const r = damageCharacterAt(state, idx, 1, true);
  return { state: r.state, lines: [`  ${context} wounds ${name} (-1 health).`, ...r.lines] };
}

// ---- Per-phase entry --------------------------------------------------------

function enterEvent(state: GameState): GameState {
  let s = state;
  const lines: string[] = [];

  // Resurfacing: with A/(12+A) chance (A = pending action cards) a shuffled-in
  // action card is drawn instead of an event, resolving its second effect. This
  // can chain until a normal event is drawn.
  while (s.pendingFollowups.length > 0) {
    const A = s.pendingFollowups.length;
    const p = A / (EVENT_POOL.length + A);
    const r = nextRandom(s.rngSeed);
    s = { ...s, rngSeed: r.seed };
    if (r.value >= p) break;

    const ri = nextRandom(s.rngSeed);
    s = { ...s, rngSeed: ri.seed };
    const idx = Math.floor(ri.value * s.pendingFollowups.length);
    const card = s.pendingFollowups[idx];
    s = { ...s, pendingFollowups: s.pendingFollowups.filter((_, i) => i !== idx) };

    const fu = card.followup!;
    lines.push(`A past misfortune resurfaces — ${card.title}: ${fu.text}`);
    if (fu.mitigable && hasMedicine(s.builtItems)) {
      lines.push("  Your medicine prevents the worst — no harm done.");
    } else {
      const er = applyEffect(s, fu.effect);
      s = er.state;
      lines.push(...er.lines.map((l) => `  ${l}`));
    }
  }

  let drawPile = s.eventDrawPile;
  let discard = s.eventDiscard;
  if (drawPile.length === 0 && discard.length > 0) {
    drawPile = discard;
    discard = [];
    lines.push("The event deck is reshuffled.");
  }

  if (drawPile.length === 0) {
    lines.push("No events remain.");
    return commit(s, "event", lines);
  }

  const [card, ...rest] = drawPile;
  drawPile = rest;
  lines.push(`Event — ${card.name}: ${card.immediate.text}`);
  const ev = applyEffect(s, card.immediate.effect);
  s = ev.state;
  lines.push(...ev.lines.map((l) => `  ${l}`));

  // Slide the card into the 2-page event book; the card pushed off the end
  // fires its consequence (unless it was resolved and removed earlier).
  let queue = [card, ...s.threatQueue];
  if (queue.length > 2) {
    const aged = queue[queue.length - 1];
    queue = queue.slice(0, 2);
    discard = [...discard, aged];
    lines.push(`The event "${aged.name}" falls from the book unresolved: ${aged.consequence.text}`);
    const tr = applyEffect(s, aged.consequence.effect);
    s = tr.state;
    lines.push(...tr.lines.map((l) => `  ${l}`));
  }

  s = { ...s, eventDrawPile: drawPile, eventDiscard: discard, threatQueue: queue };
  return commit(s, "event", lines);
}

function enterMorale(state: GameState): GameState {
  let s = state;
  const lines: string[] = [];
  const fpIndex = s.firstPlayerIndex;
  const fp = s.characters[fpIndex];
  const morale = s.morale;

  // Morale affects ONLY the first player — but Friday is immune to morale effects.
  if (fp.isCompanion) {
    lines.push("Morale is steady for the companions (Friday/Dog not affected by morale).");
  } else if (morale > 0) {
    s = {
      ...s,
      characters: s.characters.map((c, i) =>
        i === fpIndex ? { ...c, determination: c.determination + morale } : c,
      ),
    };
    lines.push(`Morale is +${morale}. As first player, ${fp.name} gains ${morale} determination.`);
  } else if (morale < 0) {
    const deficit = -morale;
    const pay = Math.min(fp.determination, deficit);
    s = {
      ...s,
      characters: s.characters.map((c, i) =>
        i === fpIndex ? { ...c, determination: c.determination - pay } : c,
      ),
    };
    lines.push(`Morale is ${morale}. As first player, ${fp.name} pays ${pay} determination.`);
    const remaining = deficit - pay;
    if (remaining > 0) {
      const r = damageCharacterAt(s, fpIndex, remaining, true);
      s = r.state;
      lines.push(`  With no determination left, ${fp.name} suffers ${remaining} damage.`);
      lines.push(...r.lines);
    }
  } else {
    lines.push("Morale is steady. Nothing happens.");
  }

  // Apply morale floor from items (e.g. Fire Shrine prevents going below -2).
  const floor = itemBonuses(s.builtItems).moraleFloor;
  if (floor > -99 && s.morale < floor) {
    lines.push(`  Morale held at ${floor} (prevented from going lower).`);
    s = { ...s, morale: floor };
  }
  return commit(s, "morale", lines);
}

function enterProduction(state: GameState): GameState {
  if (state.skipNextProduction) {
    const s = { ...state, skipNextProduction: false };
    return commit(s, "production", ["Production was skipped this round due to a prior disaster."]);
  }
  const camp = state.tiles.find((t) => t.hasCamp);
  const yield_ = campProduction(state.tiles);
  const b = itemBonuses(state.builtItems);
  const wood = yield_.wood + b.productionWood;
  const food = yield_.food + b.productionFood;
  const resources = {
    ...state.resources,
    wood: state.resources.wood + wood,
    food: state.resources.food + food,
  };
  const terrainName = camp ? TERRAIN_LABELS[camp.terrain] : "camp";
  const lines = [`The ${terrainName} camp produces ${wood} wood and ${food} food.`];
  if (b.productionWood > 0 || b.productionFood > 0) {
    lines.push(`  (Inventions: +${b.productionWood} wood, +${b.productionFood} food.)`);
  }
  return commit({ ...state, resources }, "production", lines);
}

function enterAction(state: GameState): GameState {
  const s = {
    ...state,
    availablePawns: pawnsForRound(state.characters),
    assignments: [],
    lastRolls: [],
    // Resets: per-round bonuses clear at the start of the action phase.
    weatherMitigations: 0,
    bonusAttackThisRound: 0,
    rerollGrants: [] as string[],
  };
  return commit(s, "action", ["Assign your action pawns, then resolve."]);
}

function enterWeather(state: GameState): GameState {
  const dice = getWeatherDice(state.scenarioId, state.round);

  // Merge any extra dice from adventure card effects.
  const allDice = [...dice];
  const b = itemBonuses(state.builtItems);
  let extraDiceRemaining = [...state.extraWeatherDice];
  let cancelled = b.cancelExtraWeatherDie;
  for (const d of extraDiceRemaining) {
    if (cancelled > 0) { cancelled--; continue; }
    allDice.push(d);
  }
  const s0: GameState = { ...state, extraWeatherDice: [] };

  if (allDice.length === 0) {
    const s: GameState = { ...s0, weatherSteps: [], weatherId: s0.weatherId + 1, lastWeather: { faces: [], rainTotal: 0, breach: 0 } };
    return commit(s, "weather", ["Clear skies — no weather this round."]);
  }

  let s = s0;
  const steps: WeatherStep[] = [];
  let totalRain = 0;
  let totalSnow = 0;
  let dangerResult: DangerResult | undefined;
  let stormResult: StormResult | undefined;

  for (const die of allDice) {
    const rolled = rollWeatherDie(s.rngSeed, die);
    s = { ...s, rngSeed: rolled.seed };
    steps.push(rolled.step);
    totalRain += rolled.rain;
    totalSnow += rolled.snow;
    if (rolled.danger && rolled.danger !== "nothing") dangerResult = rolled.danger;
    if (rolled.storm) stormResult = rolled.storm;
  }

  const lines: string[] = [];

  // ---- Storm: fierce winds double rain pressure, hurricane doubles snow (vs palisade) ----
  if (stormResult === "fierce-winds") {
    if (s.camp.palisadeLevel < 1) {
      totalRain += 2;
      lines.push(`Fierce winds! (palisade 0/1) — +2 rain pressure.`);
    } else {
      lines.push(`Fierce winds! Your palisade holds.`);
    }
  } else if (stormResult === "hurricane") {
    if (s.camp.palisadeLevel < 2) {
      totalSnow += 2;
      lines.push(`Hurricane! (palisade ${s.camp.palisadeLevel}/2) — +2 snow pressure.`);
    } else {
      lines.push(`Hurricane! Your palisade absorbs the worst.`);
    }
  }

  // ---- Snow: always costs 1 wood per point regardless of roof ----
  if (totalSnow > 0) {
    lines.push(`Snow: ${totalSnow} points — each burns 1 wood (roof provides no snow protection).`);
    for (let i = 0; i < totalSnow; i++) {
      if (s.resources.wood > 0) {
        s = { ...s, resources: { ...s.resources, wood: s.resources.wood - 1 } };
      } else {
        const w = woundWeakest(s, "Frostbite");
        if (w.lines.length > 0) { s = w.state; lines.push(...w.lines); }
      }
    }
  }

  // ---- Combined rain+snow vs roof; each breach point costs 1 food AND 1 wood ----
  const totalPressure = totalRain + totalSnow;
  const protection = s.camp.roofLevel + itemBonuses(s.builtItems).weatherProtection + s.weatherMitigations;
  const breach = Math.max(0, totalPressure - protection);

  if (breach > 0) {
    lines.push(`Weather breach: ${breach} (pressure ${totalPressure} vs protection ${protection}). Each breach point costs 1 food + 1 wood.`);
    const foodPaid = Math.min(s.resources.food, breach);
    s = { ...s, resources: { ...s.resources, food: s.resources.food - foodPaid } };
    const foodMissing = breach - foodPaid;
    if (foodMissing > 0) {
      lines.push(`  Out of food! ${foodMissing} unpaid — everyone takes ${foodMissing} damage.`);
      const fr = damageAll(s, foodMissing, true); s = fr.state; lines.push(...fr.lines);
    }
    const woodPaid = Math.min(s.resources.wood, breach);
    s = { ...s, resources: { ...s.resources, wood: s.resources.wood - woodPaid } };
    const woodMissing = breach - woodPaid;
    if (woodMissing > 0) {
      lines.push(`  Out of wood! ${woodMissing} unpaid — everyone takes ${woodMissing} damage.`);
      const wr = damageAll(s, woodMissing, true); s = wr.state; lines.push(...wr.lines);
    }
  } else if (totalPressure > 0) {
    lines.push(`Shelter holds (pressure ${totalPressure} vs protection ${protection}) — no breach.`);
  } else {
    lines.push("No rain or snow — clear night.");
  }

  // ---- Danger die ----
  if (dangerResult) {
    if (dangerResult === "palisade") {
      const lvl = Math.max(0, s.camp.palisadeLevel - 1);
      s = { ...s, camp: { ...s.camp, palisadeLevel: lvl } };
      lines.push(`Danger: palisade breached! Level −1 (now ${lvl}).`);
    } else if (dangerResult === "roof") {
      const lvl = Math.max(0, s.camp.roofLevel - 1);
      s = { ...s, camp: { ...s.camp, roofLevel: lvl } };
      lines.push(`Danger: roof damaged! Level −1 (now ${lvl}).`);
    } else if (dangerResult === "beast") {
      lines.push("Danger: a 3-strength beast charges the camp!");
      const wounds = Math.max(0, 3 - s.camp.weaponLevel);
      if (wounds === 0) lines.push("  Your weapon strength drives it off.");
      else for (let i = 0; i < wounds; i++) {
        const w = woundWeakest(s, "Beast charge");
        if (w.lines.length === 0) break;
        s = w.state; lines.push(...w.lines);
      }
    }
  }

  s = { ...s, weatherSteps: steps, weatherId: s.weatherId + 1, lastWeather: { faces: [], rainTotal: totalRain, breach } };
  return commit(s, "weather", lines);
}

function enterNight(state: GameState): GameState {
  let s = state;
  const lines: string[] = [];

  // Companions (Friday/Dog) don't eat.
  const living = s.characters.filter((c) => c.health > 0 && !c.isCompanion);
  const needed = living.length * NIGHT_FOOD_PER_CHARACTER;
  const eaten = Math.min(s.resources.food, needed);
  const fedCount = Math.floor(eaten / NIGHT_FOOD_PER_CHARACTER);
  const hungry = living.length - fedCount;

  s = { ...s, resources: { ...s.resources, food: s.resources.food - eaten } };
  lines.push(`Night meal: ${fedCount} of ${living.length} survivors eat (${eaten} food).`);

  if (hungry > 0) {
    let toWound = hungry;
    while (toWound > 0) {
      const w = woundWeakest(s, "Hunger");
      if (w.lines.length === 0) break;
      s = w.state;
      lines.push(...w.lines);
      toWound--;
    }
    s = { ...s, morale: clampMorale(s.morale - hungry) };
    lines.push(`  Hunger saps morale (-${hungry}).`);
  }

  // Fresh food spoils overnight, except what built preservation items can keep.
  const preserve = s.builtItems.reduce((sum, id) => sum + (findItem(id)?.preservesFood ?? 0), 0);
  const keep = Math.min(s.resources.food, preserve);
  const spoiled = s.resources.food - keep;
  if (spoiled > 0) {
    lines.push(
      keep > 0
        ? `${spoiled} food spoils overnight (${keep} preserved).`
        : `${spoiled} food spoils overnight.`,
    );
    s = { ...s, resources: { ...s.resources, food: keep } };
  }

  return commit(s, "night", lines);
}

// ---- Phase entry dispatch + progression ------------------------------------

export function enterPhase(state: GameState, phase: Phase): GameState {
  switch (phase) {
    case "event":
      return checkScenario(checkDefeat(enterEvent(state)));
    case "morale":
      return checkDefeat(enterMorale(state));
    case "production":
      return enterProduction(state);
    case "action":
      return enterAction(state);
    case "actionDone":
      return state; // reached via resolveActionPhase, not enterPhase
    case "weather":
      return checkDefeat(enterWeather(state));
    case "night":
      return checkDefeat(enterNight(state));
    case "gameOver":
      return { ...state, phase: "gameOver" };
  }
}

/** Begin a new game at the Event phase. */
export function startGame(config?: NewGameConfig): GameState {
  return enterPhase(createGame(config), "event");
}

/** Resolve actions and enter the "actionDone" holding phase. The player then
 *  clicks Continue to trigger the separate Weather phase. */
export function resolveActionPhase(state: GameState): GameState {
  if (state.phase !== "action") return state;
  const { state: applied, lines } = resolveAssignments(state);
  const summary = lines.length > 0 ? lines : ["No actions were planned."];
  const withLog = { ...applied, log: [...applied.log, "— Actions resolved —", ...lines] };
  return commit({ ...withLog }, "actionDone", summary);
}

/** Advance from an auto-resolving phase to the next phase. */
export function advancePhase(state: GameState): GameState {
  switch (state.phase) {
    case "event":
      return enterPhase(state, "morale");
    case "morale":
      return enterPhase(state, "production");
    case "production":
      return enterPhase(state, "action");
    case "actionDone":
      return enterPhase(state, "weather");
    case "weather":
      return enterPhase(state, "night");
    case "night": {
      // Castaways: lose if round limit exceeded without completing the pile.
      if (state.scenarioId === "castaways" && state.round >= state.maxRounds) {
        if (state.woodPileStage < 5) {
          return { ...state, phase: "gameOver", outcome: "lost", log: [...state.log, "Twelve days gone. The pile was never finished. No one is coming."] };
        }
      }
      // Survival: no win condition (play until death). Other scenarios: survive maxRounds.
      if (state.scenarioId !== "survival" && state.scenarioId !== "castaways" && state.round >= state.maxRounds) {
        return {
          ...state,
          phase: "gameOver",
          outcome: "won",
          log: [...state.log, "You survived until rescue. The island is conquered!"],
        };
      }
      // Rotate the first-player token among HUMAN characters only (never companions).
      const humans = state.characters.filter((c) => !c.isCompanion);
      const currentHumanPos = humans.findIndex((h) => h.id === state.characters[state.firstPlayerIndex]?.id);
      const nextHuman = humans[(currentHumanPos + 1) % humans.length];
      const firstPlayerIndex = state.characters.findIndex((c) => c.id === nextHuman?.id);
      const safeFirstPlayer = firstPlayerIndex >= 0 ? firstPlayerIndex : 0;
      const next = {
        ...state,
        round: state.round + 1,
        firstPlayerIndex: safeFirstPlayer,
        usedAbilities: [],
        log: [...state.log, `=== Round ${state.round + 1} ===`],
      };
      return enterPhase(next, "event");
    }
    default:
      return state;
  }
}
