// The pure game reducer: (state, action) -> state. All state transitions go
// through here so the UI never mutates game state directly.

import { threatCard } from "./actions";
import { ABILITIES } from "./config";
import { applyEffect } from "./effects";
import { itemBonuses } from "./items";
import type { NewGameConfig } from "./setup";
import { advancePhase, resolveActionPhase, startGame } from "./phases";
import type { ActionKind, Assignment, BuildTarget, GameState } from "./types";

export type GameAction =
  | { type: "NEW_GAME"; config?: NewGameConfig }
  | {
      type: "ASSIGN_PAWN";
      action: ActionKind;
      buildTarget?: BuildTarget;
      itemId?: string;
      tileKey?: string;
      gatherResource?: "wood" | "food";
      threatId?: string;
      beastInstanceId?: string;
      pawnId?: string;
    }
  | { type: "UNASSIGN_PAWN"; pawnId: string }
  | { type: "USE_ABILITY"; charId: string; abilityId: string }
  | { type: "USE_TREASURE"; treasureId: string }
  | { type: "BUILD_WOOD_PILE" }
  | { type: "RESOLVE_ACTIONS" }
  | { type: "ADVANCE_PHASE" };

let assignmentCounter = 0;
function newAssignmentId(): string {
  return `asn-${assignmentCounter++}`;
}

export function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "NEW_GAME":
      return startGame(action.config);

    case "ASSIGN_PAWN":
      return assignPawn(state, action);

    case "UNASSIGN_PAWN":
      return unassignPawn(state, action.pawnId);

    case "USE_ABILITY":
      return useAbility(state, action.charId, action.abilityId);

    case "USE_TREASURE":
      return useTreasure(state, action.treasureId);

    case "BUILD_WOOD_PILE":
      return buildWoodPile(state);

    case "RESOLVE_ACTIONS":
      return resolveActionPhase(state);

    case "ADVANCE_PHASE":
      return advancePhase(state);

    default:
      return state;
  }
}

function assignPawn(
  state: GameState,
  action: Extract<GameAction, { type: "ASSIGN_PAWN" }>,
): GameState {
  if (state.phase !== "action") return state;

  const pawnId = action.pawnId ?? state.availablePawns[0];
  if (!pawnId || !state.availablePawns.includes(pawnId)) return state;

  // Dog can only be assigned to hunt or explore.
  const pawnChar = state.characters.find((c) => c.id === pawnId.split("#")[0]);
  const DOG_ALLOWED: ActionKind[] = ["hunt", "explore"];
  if (pawnChar?.companionType === "dog" && !DOG_ALLOWED.includes(action.action)) {
    return state;
  }

  let assignments: Assignment[];

  if (action.action === "resolveThreat") {
    // One slot per event; stack pawns onto it up to the resolution requirement.
    const card = threatCard(state, action.threatId);
    if (!card) return state;
    const existing = state.assignments.find((a) => a.threatId === action.threatId);
    if (existing) {
      if (existing.pawnIds.length >= card.resolve.requirement.pawns) return state; // full
      assignments = state.assignments.map((a) =>
        a.id === existing.id ? { ...a, pawnIds: [...a.pawnIds, pawnId] } : a,
      );
    } else {
      assignments = [
        ...state.assignments,
        { id: newAssignmentId(), action: "resolveThreat", threatId: action.threatId, pawnIds: [pawnId] },
      ];
    }
  } else {
    // A pawn pair (2 pawns on the same action+target) is "secure". Find an
    // existing single-pawn slot of the same kind to upgrade; otherwise open one.
    const match = state.assignments.find(
      (a) =>
        a.action === action.action &&
        a.buildTarget === action.buildTarget &&
        a.itemId === action.itemId &&
        a.tileKey === action.tileKey &&
        a.gatherResource === action.gatherResource &&
        a.beastInstanceId === action.beastInstanceId &&
        a.pawnIds.length === 1,
    );
    if (match) {
      assignments = state.assignments.map((a) =>
        a.id === match.id ? { ...a, pawnIds: [...a.pawnIds, pawnId] } : a,
      );
    } else {
      assignments = [
        ...state.assignments,
        {
          id: newAssignmentId(),
          action: action.action,
          buildTarget: action.buildTarget,
          itemId: action.itemId,
          tileKey: action.tileKey,
          gatherResource: action.gatherResource,
          beastInstanceId: action.beastInstanceId,
          pawnIds: [pawnId],
        },
      ];
    }
  }

  return {
    ...state,
    availablePawns: state.availablePawns.filter((p) => p !== pawnId),
    assignments,
  };
}

function useAbility(state: GameState, charId: string, abilityId: string): GameState {
  if (state.phase !== "action") return state;
  const char = state.characters.find((c) => c.id === charId);
  if (!char || char.health <= 0) return state;

  const ability = ABILITIES[char.role].find((a) => a.id === abilityId);
  if (!ability || ability.kind !== "active" || !ability.effects?.length) return state;

  const key = `${charId}:${abilityId}`;
  if (state.usedAbilities.includes(key)) return state; // once per round
  const reduction = itemBonuses(state.builtItems).abilityCostReduction;
  const cost = Math.max(0, (ability.cost ?? 0) - reduction);
  if (char.determination < cost) return state;

  let next: GameState = {
    ...state,
    characters: state.characters.map((c) =>
      c.id === charId ? { ...c, determination: c.determination - cost } : c,
    ),
    usedAbilities: [...state.usedAbilities, key],
  };
  const lines: string[] = [];
  for (const effect of ability.effects) {
    const r = applyEffect(next, effect);
    next = r.state;
    lines.push(...r.lines);
  }
  // Replace placeholder reroll keys with the actual character id.
  const rerollGrants = next.rerollGrants.map((k) =>
    k.startsWith("__reroll__:") ? `${charId}:${k.slice("__reroll__:".length)}` : k,
  );
  next = { ...next, rerollGrants };
  return {
    ...next,
    log: [...next.log, `${char.name} uses ${ability.name}.`, ...lines.map((l) => `  ${l}`)],
  };
}

const WOOD_PILE_COSTS = [1, 2, 3, 4, 5];

function buildWoodPile(state: GameState): GameState {
  if (state.scenarioId !== "castaways") return state;
  if (state.phase !== "action") return state;
  if (state.woodPileStage >= 5) return state;
  if (state.woodPileLastBuiltRound >= state.round) return state; // once per round
  const cost = WOOD_PILE_COSTS[state.woodPileStage];
  if (state.resources.wood < cost) return state;

  const newStage = state.woodPileStage + 1;
  let next: GameState = {
    ...state,
    resources: { ...state.resources, wood: state.resources.wood - cost },
    woodPileStage: newStage,
    woodPileLastBuiltRound: state.round,
    log: [...state.log, `Signal pile: stage ${newStage}/5 raised (spent ${cost} wood).`],
  };

  const hasFireLit = next.builtItems.includes("signal-fire");
  if (newStage >= 5 && state.round >= 10 && hasFireLit) {
    return { ...next, phase: "gameOver", outcome: "won", log: [...next.log, "The signal fire blazes from the highland and the pile roars to life. A ship turns toward shore. You are saved!"] };
  }
  if (newStage >= 5 && !hasFireLit) {
    next = { ...next, log: [...next.log, `The pile is complete — but you still need to build the Signal Fire to light it.`] };
  } else if (newStage >= 5) {
    next = { ...next, log: [...next.log, `The pile is complete — but rescue won't come before day 10. Hold on.`] };
  }
  return next;
}

function useTreasure(state: GameState, treasureId: string): GameState {
  if (state.phase !== "action") return state;
  const treasure = state.heldTreasures.find((t) => t.id === treasureId);
  if (!treasure) return state;
  const heldTreasures = state.heldTreasures.filter((t) => t.id !== treasureId);
  const { state: next, lines } = applyEffect({ ...state, heldTreasures }, treasure.effect);
  return {
    ...next,
    log: [...next.log, `Used treasure: ${treasure.name}. ${treasure.description}`, ...lines.map((l) => `  ${l}`)],
  };
}

function unassignPawn(state: GameState, pawnId: string): GameState {
  if (state.phase !== "action") return state;
  let changed = false;
  const assignments: Assignment[] = [];
  for (const a of state.assignments) {
    if (a.pawnIds.includes(pawnId)) {
      changed = true;
      const remaining = a.pawnIds.filter((p) => p !== pawnId);
      if (remaining.length > 0) assignments.push({ ...a, pawnIds: remaining });
    } else {
      assignments.push(a);
    }
  }
  if (!changed) return state;
  return {
    ...state,
    assignments,
    availablePawns: [...state.availablePawns, pawnId],
  };
}
