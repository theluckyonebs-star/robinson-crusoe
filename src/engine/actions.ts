// Action-phase resolution. Risky (single-pawn) Gather/Explore/Build actions
// roll the three action dice; Hunt/Arrange/Rest/Resolve are deterministic.

import { BUILD_SPECS, REST_HEAL, RESOURCE_LABELS, TERRAIN_LABELS, clampMorale, scaledBuildCost } from "./config";
import { ADVENTURE_DECKS } from "./adventures";
import { ACTION_RISK, rollActionDice, type RiskAction } from "./dice";
import { nextRandom } from "./rng";
import { applyEffect } from "./effects";
import { damageCharacterAt } from "./health";
import { findItem, itemBonuses, itemIsLegal } from "./items";
import { revealTile, tileByKey } from "./map";
import { pick } from "./rng";
import { characterOfPawn } from "./setup";
import type {
  Assignment,
  BuildTarget,
  EventCard,
  GameState,
  ResolutionStep,
  ResolveRequirement,
  ResourceType,
  Resources,
} from "./types";

// ---- Shared cost/affordability helpers (also used by the UI) ----------------

export function canAfford(resources: Resources, cost: Partial<Resources>): boolean {
  return (Object.keys(cost) as ResourceType[]).every((r) => resources[r] >= (cost[r] ?? 0));
}

function pay(resources: Resources, cost: Partial<Resources>): Resources {
  const next = { ...resources };
  for (const r of Object.keys(cost) as ResourceType[]) next[r] -= cost[r] ?? 0;
  return next;
}

export function buildIsLegal(state: GameState, target: BuildTarget): { ok: boolean; reason?: string } {
  const spec = BUILD_SPECS[target];
  if (spec.requiresShelter && !state.camp.shelterBuilt) {
    return { ok: false, reason: "Requires a shelter first" };
  }
  if (!spec.repeatable) {
    const alreadyBuilt =
      (target === "shelter" && state.camp.shelterBuilt) ||
      (target === "roof" && state.camp.roofLevel > 0);
    if (alreadyBuilt) return { ok: false, reason: "Already built" };
  } else if (spec.maxLevel !== undefined) {
    const level = target === "palisade" ? state.camp.palisadeLevel : state.camp.weaponLevel;
    if (level >= spec.maxLevel) return { ok: false, reason: "At maximum level" };
  }
  return { ok: true };
}

export function threatCard(state: GameState, threatId: string | undefined): EventCard | undefined {
  return state.threatQueue.find((c) => c.id === threatId);
}

export function requirementLabel(req: ResolveRequirement): string {
  const parts = [`${req.pawns} pawn${req.pawns === 1 ? "" : "s"}`];
  if (req.resources) {
    for (const r of Object.keys(req.resources) as ResourceType[]) {
      const n = req.resources[r] ?? 0;
      if (n) parts.push(`${n} ${RESOURCE_LABELS[r]}`);
    }
  }
  return parts.join(" + ");
}

function describe(cost: Partial<Resources>): string {
  const parts = (Object.keys(cost) as ResourceType[])
    .filter((r) => (cost[r] ?? 0) !== 0)
    .map((r) => `${cost[r]} ${r}`);
  return parts.length ? parts.join(", ") : "nothing";
}

// ---- Small state mutators ---------------------------------------------------

function addResource(s: GameState, r: ResourceType, n: number): GameState {
  return { ...s, resources: { ...s.resources, [r]: s.resources[r] + n } };
}

function addDeterminationTo(s: GameState, idx: number, n: number): GameState {
  if (idx < 0) return s;
  return {
    ...s,
    characters: s.characters.map((c, i) => (i === idx ? { ...c, determination: c.determination + n } : c)),
  };
}

function charIndexOfPawn(s: GameState, pawnId: string): number {
  const c = characterOfPawn(s, pawnId);
  return c ? s.characters.findIndex((x) => x.id === c.id) : -1;
}

/**
 * Returns the character index that should receive action damage.
 * If the assignment has both companion and non-companion pawns, the first
 * non-companion takes it (Friday cannot be a damage shield for humans).
 * If all pawns are companions (e.g. Dog solo hunt), the first pawn takes it
 * (Dog is invincible and will ignore it; Friday can be hurt solo).
 */
function getActionActorIndex(s: GameState, a: Assignment): number {
  for (const pawnId of a.pawnIds) {
    const c = characterOfPawn(s, pawnId);
    if (c && !c.isCompanion) return s.characters.findIndex((x) => x.id === c.id);
  }
  return charIndexOfPawn(s, a.pawnIds[0]);
}

function riskFamily(action: Assignment["action"]): RiskAction | null {
  if (action === "gather") return "gather";
  if (action === "explore") return "explore";
  if (action === "build") return "build";
  return null;
}

export function actionLabel(a: Assignment): string {
  switch (a.action) {
    case "gather": {
      const t = a.tileKey ? `${a.gatherResource === "food" ? "Food" : "Wood"}` : "";
      return `Gather ${t}`.trim();
    }
    case "explore":
      return "Explore";
    case "build":
      return a.itemId ? `Build ${findItem(a.itemId)?.name ?? "item"}` : `Build ${BUILD_SPECS[a.buildTarget!].label}`;
    case "hunt":
      return "Hunt";
    case "arrange":
      return "Arrange Camp";
    case "rest":
      return "Rest";
    case "resolveThreat":
      return "Resolve threat";
    case "claimTreasure":
      return "Claim Treasure";
  }
}

// ---- Per-action success effects --------------------------------------------

function applySuccess(s: GameState, a: Assignment, tag: string): { state: GameState; lines: string[] } {
  switch (a.action) {
    case "gather": {
      const resource: ResourceType = a.gatherResource === "food" ? "food" : "wood";
      const tile = a.tileKey ? tileByKey(s.tiles, a.tileKey) : undefined;
      const where = tile ? TERRAIN_LABELS[tile.terrain] : "the wild";
      // Check depletion.
      if (a.tileKey && s.depletedTiles.includes(a.tileKey)) {
        return { state: s, lines: [`Gather ${tag}: the ${where} is depleted — nothing to gather.`] };
      }
      const b = itemBonuses(s.builtItems);
      const amount = 1 + (resource === "wood" ? b.gatherWood : b.gatherFood);
      return {
        state: addResource(s, resource, amount),
        lines: [`Gather ${tag}: +${amount} ${RESOURCE_LABELS[resource]} from the ${where}.`],
      };
    }

    case "explore": {
      if (!a.tileKey) return { state: s, lines: [`Explore ${tag}: no target tile.`] };
      const { tiles, revealed } = revealTile(s.tiles, a.tileKey);
      if (!revealed) return { state: s, lines: [`Explore ${tag}: nothing left to reveal there.`] };
      let next = { ...s, tiles };
      const lines: string[] = [`Explore ${tag}: discovered ${TERRAIN_LABELS[revealed.terrain]}.`];
      if (revealed.beast) {
        const instanceId = `${revealed.beast.id}-${a.tileKey}`;
        next = { ...next, discoveredBeasts: [...next.discoveredBeasts, { ...revealed.beast, instanceId }] };
        lines.push(`  A ${revealed.beast.name} is spotted on this tile!`);
      }
      return { state: next, lines };
    }

    case "build":
      return a.itemId ? buildItem(s, a.itemId, tag) : buildStructure(s, a, tag);

    default:
      return { state: s, lines: [] };
  }
}

function buildStructure(s: GameState, a: Assignment, tag: string): { state: GameState; lines: string[] } {
  const target = a.buildTarget!;
  const spec = BUILD_SPECS[target];
  const legal = buildIsLegal(s, target);
  if (!legal.ok) return { state: s, lines: [`Build ${spec.label} ${tag}: ${legal.reason}.`] };

  // Dynamic costs: scale with player count. Try wood first, then leather (hide).
  const { wood: woodCost, leather: leatherCost } = scaledBuildCost(s.playerCount);
  const woodPay: Partial<import("./types").Resources> = { wood: woodCost };
  const leatherPay: Partial<import("./types").Resources> = { hide: leatherCost };
  const useWood = canAfford(s.resources, woodPay);
  const useLeather = !useWood && canAfford(s.resources, leatherPay);

  if (!useWood && !useLeather) {
    return { state: s, lines: [`Build ${spec.label} ${tag}: need ${woodCost}🪵 or ${leatherCost}🧤 (not enough).`] };
  }

  const cost = useWood ? woodPay : leatherPay;
  const costStr = useWood ? `${woodCost} wood` : `${leatherCost} leather`;
  const camp = { ...s.camp };
  if (target === "shelter") camp.shelterBuilt = true;
  else if (target === "roof") camp.roofLevel = 1;
  else if (target === "palisade") camp.palisadeLevel += 1;
  else if (target === "weapon") camp.weaponLevel += 1;
  return {
    state: { ...s, resources: pay(s.resources, cost), camp },
    lines: [`Built ${spec.label} ${tag} for ${costStr}.`],
  };
}

function buildItem(s: GameState, itemId: string, tag: string): { state: GameState; lines: string[] } {
  const item = findItem(itemId);
  if (!item) return { state: s, lines: ["Build item: unknown invention."] };
  const legal = itemIsLegal(s, item);
  if (!legal.ok) return { state: s, lines: [`Build ${item.name} ${tag}: ${legal.reason}.`] };
  if (!canAfford(s.resources, item.cost)) {
    return { state: s, lines: [`Build ${item.name} ${tag}: not enough resources (${describe(item.cost)}).`] };
  }

  let next: GameState = { ...s, resources: pay(s.resources, item.cost), builtItems: [...s.builtItems, itemId] };
  const lines = [`Built ${item.name} ${tag} for ${describe(item.cost)}.`];
  if (item.weaponBonus) {
    next = { ...next, camp: { ...next.camp, weaponLevel: next.camp.weaponLevel + item.weaponBonus } };
    lines.push(`  Weapon strength +${item.weaponBonus}.`);
  }
  if (item.onBuild) {
    const r = applyEffect(next, item.onBuild);
    next = r.state;
    lines.push(...r.lines.map((l) => `  ${l}`));
  }
  return { state: next, lines };
}

// ---- Risky / secure resolution ---------------------------------------------

interface ActionResult {
  state: GameState;
  lines: string[];
  roll?: { success: boolean; injury: boolean; chance: boolean };
}

function resolveRisk(s: GameState, a: Assignment, family: RiskAction): ActionResult {
  const secure = a.pawnIds.length >= 2;
  const tag = secure ? "(secure)" : "(risky)";
  const label = actionLabel(a);
  const lines: string[] = [];
  const actorIdx = getActionActorIndex(s, a);
  const actorChar = s.characters[actorIdx];

  let success = true;
  let injury = false;
  let chance = false;
  let roll: ActionResult["roll"];

  if (!secure) {
    const grantKey = actorChar ? `${actorChar.id}:${family}` : "";
    const hasGrant = grantKey !== "" && s.rerollGrants.includes(grantKey);

    if (hasGrant) {
      // Guarantee success: consume grant, still roll injury and chance dice.
      s = { ...s, rerollGrants: s.rerollGrants.filter((k) => k !== grantKey) };
      success = true;
      const ri = nextRandom(s.rngSeed); s = { ...s, rngSeed: ri.seed };
      injury = ri.value < ACTION_RISK[family].injury;
      const rc = nextRandom(s.rngSeed); s = { ...s, rngSeed: rc.seed };
      chance = rc.value < ACTION_RISK[family].chance;
      roll = { success: true, injury, chance };
      s = { ...s, lastRolls: [...s.lastRolls, { label, ...roll }] };
      lines.push(`  ${actorChar?.name ?? "the worker"}'s skill guarantees success this action.`);
    } else {
      const rolled = rollActionDice(s.rngSeed, ACTION_RISK[family]);
      s = { ...s, rngSeed: rolled.seed, lastRolls: [...s.lastRolls, { label, ...rolled.roll }] };
      ({ success, injury, chance } = rolled.roll);
      roll = rolled.roll;
    }
  }

  if (success) {
    const r = applySuccess(s, a, tag);
    s = r.state;
    lines.push(...r.lines);
  } else {
    s = addDeterminationTo(s, actorIdx, 2);
    lines.push(`${label} (risky): failed — ${actorChar?.name ?? "the worker"} gains 2 determination.`);
  }

  if (injury) {
    const name = actorChar?.name ?? "the worker";
    const reduction = itemBonuses(s.builtItems).injuryReduction;
    const damage = Math.max(0, 1 - reduction);
    if (damage === 0) {
      lines.push(`  Injury die: ${name} is hurt, but their gear absorbs it.`);
    } else {
      const r = damageCharacterAt(s, actorIdx, damage, false);
      s = r.state;
      lines.push(`  Injury die: ${name} is hurt (-${damage} health).`);
      lines.push(...r.lines);
    }
  }

  if (chance) {
    const d = drawAdventure(s, family, actorIdx);
    s = d.state;
    lines.push(...d.lines);
  }

  return { state: s, lines, roll };
}

function drawAdventure(s: GameState, family: RiskAction, actorIdx: number): { state: GameState; lines: string[] } {
  const deck = ADVENTURE_DECKS[family];
  const { item: card, seed } = pick(deck, s.rngSeed);
  s = { ...s, rngSeed: seed };
  const lines = [`  Chance die — Adventure: ${card.title}. ${card.text}`];

  // Depletion immunity: if this card depletes a tile and we're immune, skip.
  const skipEffect = card.effect.kind === "depleteTile" && itemBonuses(s.builtItems).depletionImmune;
  // Item-dependent mitigation.
  const itemMitigated = card.effectMitigatedBy && s.builtItems.includes(card.effectMitigatedBy);

  if (skipEffect) {
    lines.push(`    (Depletion prevented — your stores are protected.)`);
  } else if (itemMitigated) {
    const itemName = s.builtItems.includes(card.effectMitigatedBy!) ? card.effectMitigatedBy : "";
    lines.push(`    (Effect mitigated by your ${itemName}.)`);
  } else {
    // For grantReroll, use the actual actor charId instead of placeholder.
    if (card.effect.kind === "grantReroll") {
      const actor = s.characters[actorIdx];
      if (actor) {
        s = { ...s, rerollGrants: [...s.rerollGrants, `${actor.id}:${card.effect.actionFamily}`] };
        lines.push(`    ${actor.name} can reroll their next ${card.effect.actionFamily} action.`);
      }
    } else {
      const r = applyEffect(s, card.effect, { actorIdx, canTargetCompanions: true });
      s = r.state;
      lines.push(...r.lines.map((l) => `    ${l}`));
    }
  }

  if (card.followup) {
    s = { ...s, pendingFollowups: [...s.pendingFollowups, card] };
    lines.push(`    (This may resurface later: ${card.followup.text})`);
  }
  return { state: s, lines };
}

// ---- Deterministic actions --------------------------------------------------

function resolveSafe(s: GameState, a: Assignment): ActionResult {
  switch (a.action) {
    case "rest": {
      // Each pawn heals its owner once (2 cooks = cook heals 2; cook+carp = each heals 1).
      const healCounts = new Map<number, number>();
      for (const pawnId of a.pawnIds) {
        const idx = charIndexOfPawn(s, pawnId);
        if (idx >= 0) healCounts.set(idx, (healCounts.get(idx) ?? 0) + 1);
      }
      const names: string[] = [];
      const characters = s.characters.map((c, i) => {
        const heals = healCounts.get(i) ?? 0;
        if (heals > 0 && c.health > 0) {
          names.push(`${c.name} +${heals * REST_HEAL}`);
          return { ...c, health: Math.min(c.maxHealth, c.health + heals * REST_HEAL) };
        }
        return c;
      });
      return { state: { ...s, characters }, lines: [`Rest: ${names.join(", ") || "no one"} recovered.`] };
    }

    case "arrange": {
      const idxs = a.pawnIds.map((p) => charIndexOfPawn(s, p)).filter((i) => i >= 0);
      let next = s;
      for (const idx of idxs) next = addDeterminationTo(next, idx, 1);
      next = { ...next, morale: clampMorale(next.morale + 1) };
      return {
        state: next,
        lines: [`Arrange Camp: the team gains ${idxs.length} determination and morale rises by 1.`],
      };
    }

    case "hunt":
      return resolveHunt(s, a);

    case "resolveThreat":
      return resolveThreatAction(s, a);

    case "claimTreasure":
      return resolveClaimTreasure(s, a);

    default:
      return { state: s, lines: [] };
  }
}

function resolveHunt(s: GameState, a: Assignment): ActionResult {
  if (a.pawnIds.length < 2) {
    return { state: s, lines: ["Hunt: you need at least 2 people to hunt safely — assign another pawn."] };
  }
  const beast = a.beastInstanceId
    ? s.discoveredBeasts.find((b) => b.instanceId === a.beastInstanceId)
    : s.discoveredBeasts[0];
  if (!beast) return { state: s, lines: ["Hunt: no beasts available — explore tiles to find them."] };

  const weapon = s.camp.weaponLevel + s.bonusAttackThisRound;
  if (s.bonusAttackThisRound > 0) s = { ...s, bonusAttackThisRound: 0 };
  const wounds = Math.max(0, beast.strength - weapon);
  // Remove the beast from discovered pool + give rewards.
  let next: GameState = { ...s, discoveredBeasts: s.discoveredBeasts.filter((b) => b.instanceId !== beast.instanceId) };
  next = addResource(addResource(next, "food", beast.food), "hide", beast.leather);
  const newWeaponLevel = Math.max(0, next.camp.weaponLevel - beast.weaponDull);
  if (beast.weaponDull > 0) next = { ...next, camp: { ...next.camp, weaponLevel: newWeaponLevel } };

  const lines = [`Hunt: brought down the ${beast.name}! +${beast.food} food, +${beast.leather} leather.`];
  if (beast.weaponDull > 0) lines.push(`  The fight dulled your weapon (−${beast.weaponDull} weapon strength, now ${newWeaponLevel}).`);
  if (beast.strength > weapon) {
    lines.push(`  Weapon strength ${weapon} vs the beast's strength ${beast.strength}.`);
  }

  const hunters = a.pawnIds.map((p) => charIndexOfPawn(next, p)).filter((i) => i >= 0);
  let remaining = wounds;
  let i = 0;
  while (remaining > 0 && hunters.length > 0) {
    const idx = hunters[i % hunters.length];
    const name = next.characters[idx]?.name ?? "a hunter";
    const r = damageCharacterAt(next, idx, 1);
    next = r.state;
    lines.push(`  The ${beast.name} wounds ${name} (-1 health).`);
    lines.push(...r.lines);
    remaining--;
    i++;
  }
  if (wounds === 0) lines.push("  Your weapons kept the hunters unharmed.");
  return { state: next, lines };
}

function resolveThreatAction(s: GameState, a: Assignment): ActionResult {
  const card = threatCard(s, a.threatId);
  if (!card) return { state: s, lines: ["A threat resolution fizzles — the event left the book."] };
  const req = card.resolve.requirement;
  if (a.pawnIds.length < req.pawns) {
    return { state: s, lines: [`"${card.name}" not resolved: needed ${req.pawns} pawn(s), only ${a.pawnIds.length} committed.`] };
  }
  const cost = req.resources ?? {};
  if (!canAfford(s.resources, cost)) {
    return { state: s, lines: [`"${card.name}" not resolved: not enough resources (${describe(cost)}).`] };
  }
  let next: GameState = {
    ...s,
    resources: pay(s.resources, cost),
    threatQueue: s.threatQueue.filter((c) => c.id !== card.id),
    eventDiscard: [...s.eventDiscard, card],
  };
  const lines = [`Resolved "${card.name}": ${card.resolve.reward.text}`];
  const rw = applyEffect(next, card.resolve.reward.effect);
  next = rw.state;
  lines.push(...rw.lines.map((l) => `  ${l}`));
  return { state: next, lines };
}

function resolveClaimTreasure(s: GameState, a: Assignment): ActionResult {
  const tile = a.tileKey ? tileByKey(s.tiles, a.tileKey) : undefined;
  if (!tile || !tile.explored) return { state: s, lines: ["Claim Treasure: tile not found or unexplored."] };
  const unclaimed = tile.treasures.filter((tr) => !tr.claimed);
  if (unclaimed.length === 0) return { state: s, lines: ["Claim Treasure: no treasures here."] };
  const tiles = s.tiles.map((t) =>
    t === tile ? { ...t, treasures: t.treasures.map((tr) => ({ ...tr, claimed: true })) } : t,
  );
  const heldTreasures = [...s.heldTreasures, ...unclaimed];
  return {
    state: { ...s, tiles, heldTreasures },
    lines: [`Claimed ${unclaimed.length} treasure${unclaimed.length > 1 ? "s" : ""}: ${unclaimed.map((tr) => tr.name).join(", ")}.`],
  };
}

// ---- Entry point ------------------------------------------------------------

export function resolveAssignments(state: GameState): { state: GameState; lines: string[] } {
  let s: GameState = { ...state, lastRolls: [] };
  const lines: string[] = [];
  const steps: ResolutionStep[] = [];

  for (const a of state.assignments) {
    const family = riskFamily(a.action);
    const res = family ? resolveRisk(s, a, family) : resolveSafe(s, a);
    s = res.state;
    lines.push(...res.lines);
    steps.push({ label: actionLabel(a), roll: res.roll, lines: res.lines });
  }

  return {
    state: { ...s, assignments: [], resolutionSteps: steps, resolutionId: s.resolutionId + 1 },
    lines,
  };
}
