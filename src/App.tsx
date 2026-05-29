import { useEffect, useRef, useState } from "react";
import {
  ABILITIES,
  ACTION_RISK,
  BIOME_ICONS,
  BIOME_LABELS,
  BASIC_ITEMS,
  BUILD_SPECS,
  scaledBuildCost,
  CHARACTER_ITEMS,
  ITEMS,
  SPECIAL_ITEMS,
  MORALE_MAX,
  MORALE_MIN,
  PHASE_LABELS,
  PHASE_ORDER,
  RESOURCE_LABELS,
  ROLE_NAMES,
  TERRAIN,
  TERRAIN_LABELS,

  biomeDiscovered,
  buildIsLegal,
  canAfford,
  characterOfPawn,
  hasUnclaimedTreasure,
  isFrontier,
  itemIsLegal,
  terrainYield,
  tileKey,
  type Ability,
  type ActionKind,
  type ActionRoll,
  type Assignment,
  type BuildTarget,
  type Character,
  type CharacterRole,
  type Effect,
  type GameState,
  type Phase,
  type ResolutionStep,
  type ResolveRequirement,
  type ResourceType,
  type Resources,
  type Tile,
  type TileTreasure,
  type WeatherStep,
  type ScenarioId,
} from "@engine";
import { useGame } from "@ui/useGame";

const RESOURCE_ICON: Record<ResourceType, string> = { wood: "🪵", food: "🍖", hide: "🧤" };

/** Represent a cost as repeated emojis (e.g. 2 wood → "🪵🪵"). Numbers only above 5. */
function emojiCost(resource: ResourceType, count: number): string {
  if (count <= 0) return "";
  const icon = RESOURCE_ICON[resource];
  return count <= 5 ? icon.repeat(count) : `${count}${icon}`;
}

/** Format a Partial<Resources> cost as emoji strings joined by spaces. */
function costStr(cost: Partial<Resources>): string {
  return (Object.keys(cost) as ResourceType[])
    .filter((r) => (cost[r] ?? 0) > 0)
    .map((r) => emojiCost(r, cost[r]!))
    .join(" ");
}
const BUILD_TARGETS: BuildTarget[] = ["shelter", "roof", "palisade", "weapon"];
const AUTO_PHASES: Phase[] = ["morale", "production", "actionDone", "weather", "night"];

function effectLabel(e: Effect): string {
  switch (e.kind) {
    case "none":
      return "no effect";
    case "gainResource":
      return `+${e.amount} ${RESOURCE_ICON[e.resource]}`;
    case "loseResource":
      return `−${e.amount} ${RESOURCE_ICON[e.resource]}`;
    case "loseHealthAll":
      return `−${e.amount} ❤️ (everyone)`;
    case "loseHealthOne":
      return `−${e.amount} ❤️`;
    case "healAll":
      return `+${e.amount} ❤️ (everyone)`;
    case "healOne":
      return `+${e.amount} ❤️`;
    case "gainWeapon":
      return `+${e.amount} ⚔️`;
    case "revealTile":
      return "reveal a tile";
    case "changeMorale":
      return `${e.amount >= 0 ? "+" : "−"}${Math.abs(e.amount)} 😀`;
    case "changeDetermination":
      return `${e.amount >= 0 ? "+" : "−"}${Math.abs(e.amount)} ✊`;
    case "grantReroll":
      return `↩ reroll ${e.actionFamily}`;
    case "mitigateWeather":
      return `🌂 mitigate weather ×${e.amount}`;
    case "boostAttack":
      return `⚔️ +${e.amount} attack this round`;
    case "depleteTile":
      return "⚠️ depletes a tile";
    case "extraWeatherDie":
      return `+1 ${e.die} die tonight`;
    case "skipProduction":
      return "⏭ skip production";
    case "palisadeDefend":
      return `🧱 palisade ${e.requiredLevel}+ to survive`;
  }
}

// ---- Resource reservation ---------------------------------------------------

function assignmentCost(state: GameState, a: Assignment): Partial<Resources> {
  if (a.action === "build") {
    if (a.itemId) return [...ITEMS, ...CHARACTER_ITEMS].find((i) => i.id === a.itemId)?.cost ?? {};
    if (a.buildTarget) {
      // Dynamic build costs: prefer wood, fall back to leather.
      const { wood: wCost, leather: lCost } = scaledBuildCost(state.playerCount);
      return state.resources.wood >= wCost ? { wood: wCost } : { hide: lCost };
    }
  }
  if (a.action === "resolveThreat") {
    return state.threatQueue.find((c) => c.id === a.threatId)?.resolve.requirement.resources ?? {};
  }
  return {};
}

function reservedResources(state: GameState): Resources {
  const r: Resources = { wood: 0, food: 0, hide: 0 };
  for (const a of state.assignments) {
    const c = assignmentCost(state, a);
    for (const k of Object.keys(c) as ResourceType[]) r[k] += c[k] ?? 0;
  }
  return r;
}

function subtract(a: Resources, b: Resources): Resources {
  return { wood: a.wood - b.wood, food: a.food - b.food, hide: a.hide - b.hide };
}

// ---- App --------------------------------------------------------------------

// ---- Setup screen -----------------------------------------------------------

const HUMAN_ROLES: CharacterRole[] = ["carpenter", "cook", "explorer", "soldier"];

function SetupScreen({ onStart }: { onStart: (roster: CharacterRole[], playerCount: number) => void }) {
  const [playerCount, setPlayerCount] = useState<number>(2);
  const [selected, setSelected] = useState<CharacterRole[]>(["carpenter", "cook"]);

  function toggle(role: CharacterRole) {
    setSelected((prev) => {
      if (prev.includes(role)) return prev.length === 1 ? prev : prev.filter((r) => r !== role);
      if (prev.length >= playerCount) return [...prev.slice(1), role];
      return [...prev, role];
    });
  }

  // Sync selection count to player count.
  useEffect(() => {
    if (selected.length > playerCount) setSelected((s) => s.slice(s.length - playerCount));
    else if (selected.length < playerCount) {
      const add = HUMAN_ROLES.filter((r) => !selected.includes(r)).slice(0, playerCount - selected.length);
      setSelected((s) => [...s, ...add]);
    }
  }, [playerCount]); // eslint-disable-line

  const companionNote = playerCount === 1 ? "Friday + Dog auto-added" : playerCount === 2 ? "Friday auto-added" : "";

  return (
    <div className="setup-screen">
      <h1 className="setup-title">Robinson Crusoe</h1>
      <p className="muted">Adventures on the Cursed Island</p>

      <div className="setup-section">
        <h2>Number of players</h2>
        <div className="count-buttons">
          {[1, 2, 3, 4].map((n) => (
            <button key={n} className={`count-btn ${playerCount === n ? "selected" : ""}`} onClick={() => setPlayerCount(n)}>
              {n}
            </button>
          ))}
        </div>
        {companionNote && <p className="companion-note">🤝 {companionNote}</p>}
      </div>

      <div className="setup-section">
        <h2>Choose characters <span className="muted small">(pick {playerCount})</span></h2>
        <div className="character-grid">
          {HUMAN_ROLES.map((role) => {
            const active = selected.includes(role);
            return (
              <button key={role} className={`char-pick ${active ? "selected" : ""}`} onClick={() => toggle(role)}>
                <div className="char-pick-name">{ROLE_NAMES[role]}</div>
                {active && <span className="char-pick-check">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      <button
        className="primary setup-start"
        disabled={selected.length !== playerCount}
        onClick={() => onStart(selected, playerCount)}
      >
        Wash Ashore →
      </button>
    </div>
  );
}

// ---- Scenario select screen -------------------------------------------------

const SCENARIOS: { id: ScenarioId; name: string; tagline: string; description: string; locked: boolean }[] = [
  {
    id: "survival",
    name: "Survival",
    tagline: "Freeplay — no win condition",
    description: "No objective. No time limit. Build, explore, endure. Play until your last survivor falls.",
    locked: false,
  },
  {
    id: "castaways",
    name: "Castaways",
    tagline: "Build the signal pile in 12 days",
    description: "Stack five stages of driftwood on the headland. A ship must see it burning before rescue can come — but not before day 10. Weather grows worse each week.",
    locked: false,
  },
];

function ScenarioScreen({
  onStart,
  onBack,
}: {
  onStart: (scenarioId: ScenarioId) => void;
  onBack: () => void;
}) {
  return (
    <div className="setup-screen">
      <button className="back-btn" onClick={onBack}>← Back</button>
      <h1 className="setup-title">Choose a scenario</h1>
      <div className="scenario-list">
        {SCENARIOS.map((sc) => (
          <div key={sc.id} className="scenario-card">
            <div className="scenario-name">{sc.name}</div>
            <div className="scenario-tagline">{sc.tagline}</div>
            <p className="scenario-desc">{sc.description}</p>
            <button className="primary" onClick={() => onStart(sc.id)}>
              Play →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Main app (game running) ------------------------------------------------

export default function App() {
  const [state, dispatch] = useGame();
  const [setupStep, setSetupStep] = useState<"players" | "scenario">("players");
  const [pendingConfig, setPendingConfig] = useState<{ roster: CharacterRole[]; playerCount: number } | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedPawn, setSelectedPawn] = useState<string | null>(null);
  const [gatherChoice, setGatherChoice] = useState<string | null>(null);
  const [tileActionChoice, setTileActionChoice] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<ResolutionStep[] | null>(null);
  const [weatherOverlay, setWeatherOverlay] = useState<WeatherStep[] | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const lastWeatherId = useRef(state.weatherId);
  // All hooks MUST be declared before any conditional return (Rules of Hooks).
  const lastResId = useRef(state.resolutionId);

  useEffect(() => {
    if (selectedPawn && !state.availablePawns.includes(selectedPawn)) setSelectedPawn(null);
  }, [state.availablePawns, selectedPawn]);

  useEffect(() => {
    if (state.resolutionId !== lastResId.current) {
      lastResId.current = state.resolutionId;
      if (state.resolutionSteps.length > 0) setOverlay(state.resolutionSteps);
    }
  }, [state.resolutionId, state.resolutionSteps]);

  useEffect(() => {
    if (state.weatherId !== lastWeatherId.current) {
      lastWeatherId.current = state.weatherId;
      if (state.weatherSteps.length > 0) setWeatherOverlay(state.weatherSteps);
    }
  }, [state.weatherId, state.weatherSteps]);

  // Setup screens before the game starts.
  if (!gameStarted) {
    if (setupStep === "players") {
      return (
        <SetupScreen
          onStart={(roster, playerCount) => {
            setPendingConfig({ roster, playerCount });
            setSetupStep("scenario");
          }}
        />
      );
    }
    return (
      <ScenarioScreen
        onStart={(scenarioId) => {
          dispatch({ type: "NEW_GAME", config: { ...pendingConfig, scenarioId } });
          setGameStarted(true);
        }}
        onBack={() => setSetupStep("players")}
      />
    );
  }

  const pawnToUse = selectedPawn ?? state.availablePawns[0];
  const reserved = reservedResources(state);
  const available = subtract(state.resources, reserved);

  function assign(action: ActionKind, opts?: Partial<Assignment>) {
    dispatch({
      type: "ASSIGN_PAWN",
      action,
      buildTarget: opts?.buildTarget,
      itemId: opts?.itemId,
      tileKey: opts?.tileKey,
      gatherResource: opts?.gatherResource,
      threatId: opts?.threatId,
      beastInstanceId: opts?.beastInstanceId,
      pawnId: pawnToUse,
    });
    setSelectedPawn(null);
  }

  function pawnsOnTile(key: string, resource?: "wood" | "food"): number {
    return state.assignments
      .filter((a) => a.tileKey === key && (resource ? a.gatherResource === resource : true))
      .reduce((n, a) => n + a.pawnIds.length, 0);
  }

  function onTileUnassign(key: string) {
    // Unassign the first pawn from any assignment targeting this tile.
    const hit = state.assignments.find((a) => a.tileKey === key && a.pawnIds.length > 0);
    if (hit) dispatch({ type: "UNASSIGN_PAWN", pawnId: hit.pawnIds[0] });
  }

  function onTileClick(tile: Tile) {
    if (state.phase !== "action" || !pawnToUse) return;
    const key = tileKey(tile.q, tile.r);
    if (!tile.explored) {
      if (isFrontier(state.tiles, key) && pawnsOnTile(key) < 2) assign("explore", { tileKey: key });
      return;
    }
    const y = terrainYield(tile.terrain);
    const hasTreasure = hasUnclaimedTreasure(tile);
    const hasResources = y.wood > 0 || y.food > 0;
    // If tile has both resources and treasure, show a picker.
    if (hasTreasure && hasResources) {
      setTileActionChoice(key);
      return;
    }
    if (hasTreasure) { assign("claimTreasure", { tileKey: key }); return; }
    if (y.wood && y.food) setGatherChoice(key);
    else if (y.wood && pawnsOnTile(key, "wood") < 2) assign("gather", { tileKey: key, gatherResource: "wood" });
    else if (y.food && pawnsOnTile(key, "food") < 2) assign("gather", { tileKey: key, gatherResource: "food" });
  }

  return (
    <div className="app">
      <Header state={state} onNewGame={() => { setGameStarted(false); setSetupStep("players"); }} />
      <PhaseTracker phase={state.phase} />
      <StatsBar state={state} reserved={reserved} onBuildPile={() => dispatch({ type: "BUILD_WOOD_PILE" })} />
      <MoraleBar morale={state.morale} />

      <EventBook
        state={state}
        interactive={state.phase === "action"}
        onCommit={(threatId) => assign("resolveThreat", { threatId })}
        onUncommit={(pawnId) => dispatch({ type: "UNASSIGN_PAWN", pawnId })}
      />

      <PendingThreats cards={state.pendingFollowups} hasMedicine={state.builtItems.some((id) => ITEMS.find((i) => i.id === id)?.mitigatesAdventures)} />

      <DiceTray rolls={state.lastRolls} />

      <div className="columns">
        <div className="main-col">
          <HexMap
            state={state}
            interactive={state.phase === "action"}
            hasPawn={Boolean(pawnToUse)}
            onTileClick={onTileClick}
            onTileUnassign={onTileUnassign}
          />

          {/* Quick-continue: always visible right below the map for every non-action phase */}
          {state.phase !== "action" && state.phase !== "gameOver" && (
            <div className="quick-continue">
              <button className="primary" onClick={() => dispatch({ type: "ADVANCE_PHASE" })}>
                {continueLabel(state)}
              </button>
            </div>
          )}

          {gatherChoice && (
            <GatherChoice
              tile={state.tiles.find((t) => tileKey(t.q, t.r) === gatherChoice)!}
              full={{ wood: pawnsOnTile(gatherChoice, "wood") >= 2, food: pawnsOnTile(gatherChoice, "food") >= 2 }}
              onPick={(res) => {
                assign("gather", { tileKey: gatherChoice, gatherResource: res });
                setGatherChoice(null);
              }}
              onCancel={() => setGatherChoice(null)}
            />
          )}

          {tileActionChoice && (
            <TileActionChoice
              tile={state.tiles.find((t) => tileKey(t.q, t.r) === tileActionChoice)!}
              onGatherWood={() => { assign("gather", { tileKey: tileActionChoice!, gatherResource: "wood" }); setTileActionChoice(null); }}
              onGatherFood={() => { assign("gather", { tileKey: tileActionChoice!, gatherResource: "food" }); setTileActionChoice(null); }}
              onClaim={() => { assign("claimTreasure", { tileKey: tileActionChoice! }); setTileActionChoice(null); }}
              onCancel={() => setTileActionChoice(null)}
            />
          )}

          <HeldTreasures
            treasures={state.heldTreasures}
            interactive={state.phase === "action"}
            onUse={(id) => dispatch({ type: "USE_TREASURE", treasureId: id })}
          />

          {state.phase === "event" && (
            <EventPhasePanel state={state} onContinue={() => dispatch({ type: "ADVANCE_PHASE" })} />
          )}

          {state.phase === "action" && (
            <ActionPanel
              state={state}
              available={available}
              selectedPawn={selectedPawn}
              onSelectPawn={setSelectedPawn}
              onUnassign={(pawnId) => dispatch({ type: "UNASSIGN_PAWN", pawnId })}
              onAssign={assign}
              onUseAbility={(charId, abilityId) => dispatch({ type: "USE_ABILITY", charId, abilityId })}
              onResolve={() => dispatch({ type: "RESOLVE_ACTIONS" })}
            />
          )}

          {AUTO_PHASES.includes(state.phase) && (
            <PhasePanel state={state} onContinue={() => dispatch({ type: "ADVANCE_PHASE" })} />
          )}

          {state.phase === "gameOver" && (
            <div className="panel">
              <h2>{state.outcome === "won" ? "🏝️ Victory" : "💀 Defeat"}</h2>
              <p className="muted">
                {state.outcome === "won" ? "You survived until rescue." : "The expedition did not make it."}
              </p>
              <button className="primary" onClick={() => dispatch({ type: "NEW_GAME" })}>
                Play again
              </button>
            </div>
          )}
        </div>

        <div className="side-col">
          {state.phase === "action" && (
            <AssignmentSidebar
              state={state}
              onUnassign={(p) => dispatch({ type: "UNASSIGN_PAWN", pawnId: p })}
            />
          )}
          <Characters
            state={state}
            onUseAbility={(charId, abilityId) => dispatch({ type: "USE_ABILITY", charId, abilityId })}
          />

          <button className="log-toggle" onClick={() => setLogOpen(true)} title="Open game log">
            📋 <span className="log-toggle-label">Log</span>
            <span className="log-toggle-count">{state.log.length}</span>
          </button>
        </div>

        {logOpen && (
          <div className="log-overlay" onClick={() => setLogOpen(false)}>
            <div className="log-overlay-panel" onClick={(e) => e.stopPropagation()}>
              <div className="log-overlay-header">
                <h2>Game Log</h2>
                <button onClick={() => setLogOpen(false)}>✕ Close</button>
              </div>
              <Log entries={state.log} />
            </div>
          </div>
        )}
      </div>

      {overlay && <ResolutionOverlay steps={overlay} onClose={() => setOverlay(null)} />}
      {weatherOverlay && <WeatherOverlay steps={weatherOverlay} onClose={() => setWeatherOverlay(null)} />}
    </div>
  );
}

function Header({ state, onNewGame }: { state: GameState; onNewGame: () => void }) {
  const companions = state.characters.filter((c) => c.isCompanion).map((c) => c.name);
  const roundLabel = state.scenarioId === "survival" ? `Day ${state.round}` : `Day ${state.round} / ${state.maxRounds}`;
  const scenarioLabel = state.scenarioId === "castaways" ? "🔥 Castaways" : "🏝️ Survival";
  return (
    <header className="header">
      <h1>Robinson Crusoe</h1>
      <div className="header-meta">
        <span className="pill">{roundLabel}</span>
        <span className="pill scenario-pill">{scenarioLabel}</span>
        {companions.length > 0 && <span className="pill companion-pill">🤝 {companions.join(" + ")}</span>}
        <button onClick={onNewGame}>New game</button>
      </div>
    </header>
  );
}

function PhaseTracker({ phase }: { phase: Phase }) {
  // "actionDone" highlights the same step as "action".
  const displayPhase: Phase = phase === "actionDone" ? "action" : phase;
  return (
    <div className="phase-tracker">
      {PHASE_ORDER.map((p, i) => (
        <div key={p} className={`phase-step ${p === displayPhase ? "current" : ""}`}>
          <span className="phase-num">{i + 1}</span>
          <span className="phase-name">{PHASE_LABELS[p]}</span>
        </div>
      ))}
    </div>
  );
}

function StatsBar({ state, reserved, onBuildPile }: {
  state: GameState;
  reserved: Resources;
  onBuildPile?: () => void;
}) {
  const WOOD_PILE_COSTS = [1, 2, 3, 4, 5];
  return (
    <div className="stats">
      <div className="stat-group">
        {(Object.keys(RESOURCE_LABELS) as ResourceType[]).map((r) => (
          <div className="stat" key={r} title={RESOURCE_LABELS[r]}>
            <span className="stat-icon">{RESOURCE_ICON[r]}</span>
            <span className="stat-val">{state.resources[r]}</span>
            {reserved[r] > 0 && <span className="stat-reserved" title="Reserved by planned actions">−{reserved[r]}</span>}
          </div>
        ))}
      </div>
      <div className="stat-group camp">
        <Badge label="Shelter" value={state.camp.shelterBuilt ? "✓" : "—"} />
        <Badge label="Roof" value={state.camp.roofLevel > 0 ? "✓" : "—"} />
        <Badge label="Palisade" value={String(state.camp.palisadeLevel)} />
        <Badge label="Weapon" value={String(state.camp.weaponLevel)} />
      </div>
      {state.scenarioId === "castaways" && (() => {
        const stage = state.woodPileStage;
        const doneThisRound = state.woodPileLastBuiltRound >= state.round;
        const nextCost = stage < 5 ? WOOD_PILE_COSTS[stage] : 0;
        const canAffordNext = state.resources.wood >= nextCost;
        const fireBuilt = state.builtItems.includes("signal-fire");
        return (
          <div className="stat-group castaways-progress">
            <div className="pile-mini-header">
              <span className="pile-mini-label">🔥 Signal Pile</span>
              <span className="pile-mini-val">{stage}/5</span>
            </div>
            <div className="pile-mini-stages">
              {WOOD_PILE_COSTS.map((_, i) => (
                <div key={i} className={`pile-mini-dot ${i < stage ? "built" : ""}`} />
              ))}
            </div>
            <div className={`pile-fire-req ${fireBuilt ? "met" : "unmet"}`}>
              {fireBuilt ? "✓" : "✗"} 🚨 Signal Fire
            </div>
            {stage < 5 && onBuildPile && (
              <button
                className="tiny pile-build-btn"
                disabled={doneThisRound || !canAffordNext}
                onClick={onBuildPile}
                title={doneThisRound ? "Already built this turn" : !canAffordNext ? `Need ${nextCost}🪵` : `Build stage ${stage + 1}`}
              >
                {doneThisRound ? "Built" : `+Stage (${nextCost}🪵)`}
              </button>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div className="badge">
      <span className="badge-label">{label}</span>
      <span className="badge-value">{value}</span>
    </div>
  );
}

// ---- Morale -----------------------------------------------------------------

function MoraleBar({ morale }: { morale: number }) {
  const face = morale < 0 ? "😟" : morale > 0 ? "😀" : "😐";
  const cells: number[] = [];
  for (let v = MORALE_MIN; v <= MORALE_MAX; v++) cells.push(v);
  return (
    <div className="morale-bar">
      <span className="morale-label">Morale</span>
      <div className="morale-cells">
        {cells.map((v) => {
          const sign = v < 0 ? "neg" : v > 0 ? "pos" : "zero";
          return (
            <div key={v} className={`morale-cell ${sign} ${v === morale ? "current" : ""}`}>
              {v === morale && <span className="morale-face">{face}</span>}
              <span className="morale-num">{v > 0 ? `+${v}` : v}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Event book -------------------------------------------------------------

function RequirementChips({ req }: { req: ResolveRequirement }) {
  return (
    <span className="req-chips">
      {req.pawns > 0 && <span className="req-chip">{"👤".repeat(Math.min(req.pawns, 5))}</span>}
      {req.resources &&
        (Object.keys(req.resources) as ResourceType[]).map((r) => (
          <span className="req-chip" key={r}>
            {emojiCost(r, req.resources![r] ?? 0)}
          </span>
        ))}
    </span>
  );
}

function EventBook({
  state,
  interactive,
  onCommit,
  onUncommit,
}: {
  state: GameState;
  interactive: boolean;
  onCommit: (threatId: string) => void;
  onUncommit: (pawnId: string) => void;
}) {
  const pages = [
    { card: state.threatQueue[0], turnsLeft: 2 },
    { card: state.threatQueue[1], turnsLeft: 1 },
  ];
  return (
    <div className="event-book">
      <div className="book-spine">📖</div>
      {pages.map((page, i) => (
        <BookPage key={i} card={page.card} turnsLeft={page.turnsLeft} state={state} interactive={interactive} onCommit={onCommit} onUncommit={onUncommit} />
      ))}
    </div>
  );
}

function BookPage({
  card,
  turnsLeft,
  state,
  interactive,
  onCommit,
  onUncommit,
}: {
  card: GameState["threatQueue"][number] | undefined;
  turnsLeft: number;
  state: GameState;
  interactive: boolean;
  onCommit: (threatId: string) => void;
  onUncommit: (pawnId: string) => void;
}) {
  if (!card) {
    return (
      <div className="book-page empty">
        <span className="muted">No event here yet.</span>
      </div>
    );
  }
  const req = card.resolve.requirement;
  const assignment = state.assignments.find((a) => a.threatId === card.id);
  const committed = assignment?.pawnIds ?? [];
  const enoughPawns = committed.length >= req.pawns;
  const affordable = canAfford(state.resources, req.resources ?? {});
  const ready = enoughPawns && affordable;
  const canCommitMore = interactive && committed.length < req.pawns && state.availablePawns.length > 0;

  return (
    <div className={`book-page ${turnsLeft === 1 ? "urgent" : ""} ${ready ? "ready" : ""}`}>
      <div className="page-header">
        <strong className="card-name">{card.name}</strong>
        <span className={`turns-badge ${turnsLeft === 1 ? "urgent" : ""}`}>{turnsLeft === 1 ? "1 turn left!" : "2 turns left"}</span>
      </div>
      <p className="card-story">{card.story}</p>
      <div className="card-parts">
        <div className="card-part">
          <span className="part-label">When drawn</span>
          <span className="part-text">
            {card.immediate.text} <em className="effect">({effectLabel(card.immediate.effect)})</em>
          </span>
        </div>
        <div className="card-part resolve">
          <span className="part-label">Resolve · <RequirementChips req={req} /></span>
          <span className="part-text">
            {card.resolve.text} <em className="effect good">→ reward {effectLabel(card.resolve.reward.effect)}</em>
          </span>
        </div>
        <div className="card-part">
          <span className="part-label">If unresolved</span>
          <span className="part-text">
            {card.consequence.text} <em className="effect bad">({effectLabel(card.consequence.effect)})</em>
          </span>
        </div>
      </div>
      {interactive && (
        <div className="resolve-controls">
          <div className="commit-row">
            <span className="muted">
              Committed {committed.length}/{req.pawns}
            </span>
            {committed.map((p) => (
              <button key={p} className="tiny" onClick={() => onUncommit(p)}>
                ✕ {characterOfPawn(state, p)?.name.slice(0, 4)}
              </button>
            ))}
            <button className="tiny commit" disabled={!canCommitMore} onClick={() => onCommit(card.id)}>
              ＋ Commit pawn
            </button>
          </div>
          {ready ? (
            <span className="ready-tag">✓ Will be resolved</span>
          ) : enoughPawns && !affordable ? (
            <span className="warn-tag">Need resources: <RequirementChips req={{ pawns: 0, resources: req.resources }} /></span>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ---- Island map -------------------------------------------------------------

const TERRAIN_COLOR: Record<string, string> = {
  beach: "#cdbb86",
  forest: "#2f6b41",
  plain: "#7fa653",
  hills: "#9c7a4d",
  swamp: "#566b4a",
  lake: "#3f6e8c",
  rocky: "#8a8f96",
};
const HEX_SIZE = 26;

function hexPoints(cx: number, cy: number, size: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${cx + size * Math.cos(a)},${cy + size * Math.sin(a)}`;
  }).join(" ");
}

function HexMap({
  state,
  interactive,
  hasPawn,
  onTileClick,
  onTileUnassign,
}: {
  state: GameState;
  interactive: boolean;
  hasPawn: boolean;
  onTileClick: (tile: Tile) => void;
  onTileUnassign?: (key: string) => void;
}) {
  const tiles = state.tiles;
  const centers = tiles.map((t) => ({
    t,
    x: HEX_SIZE * Math.sqrt(3) * (t.q + t.r / 2),
    y: HEX_SIZE * 1.5 * t.r,
  }));
  const pad = HEX_SIZE + 4;
  const xs = centers.map((c) => c.x);
  const ys = centers.map((c) => c.y);
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const vbW = Math.max(...xs) + pad - minX;
  const vbH = Math.max(...ys) + pad - minY;

  // Colored dot counts per tile: yellow=gather, green=explore
  const gatherDotsByTile = new Map<string, number>();
  const exploreDotsByTile = new Map<string, number>();
  const allAssignedPawnsByTile = new Map<string, string[]>();
  for (const a of state.assignments) {
    if (a.tileKey) {
      if (a.action === "gather") gatherDotsByTile.set(a.tileKey, (gatherDotsByTile.get(a.tileKey) ?? 0) + a.pawnIds.length);
      if (a.action === "explore") exploreDotsByTile.set(a.tileKey, (exploreDotsByTile.get(a.tileKey) ?? 0) + a.pawnIds.length);
      const existing = allAssignedPawnsByTile.get(a.tileKey) ?? [];
      allAssignedPawnsByTile.set(a.tileKey, [...existing, ...a.pawnIds]);
    }
  }
  const pawnsByTile = new Map(
    [...allAssignedPawnsByTile.entries()].map(([k, ids]) => [k, ids.length])
  );

  function actionable(t: Tile): boolean {
    if (!interactive || !hasPawn) return false;
    const key = tileKey(t.q, t.r);
    if (!t.explored) return isFrontier(tiles, key);
    const y = terrainYield(t.terrain);
    return y.wood > 0 || y.food > 0 || hasUnclaimedTreasure(t);
  }

  return (
    <div className="panel map-panel">
      <h2>The Island</h2>
      {interactive && !hasPawn && (
        <p className="muted small">All pawns assigned.</p>
      )}
      <svg className="hexmap" viewBox={`${minX} ${minY} ${vbW} ${vbH}`} role="img" aria-label="island map">
        {/* Pass 1: hexagon bases only (so icons aren't hidden under neighboring tiles) */}
        {centers.map(({ t, x, y }) => {
          const key = tileKey(t.q, t.r);
          const fill = t.explored ? TERRAIN_COLOR[t.terrain] : "#1b242e";
          const act = actionable(t);
          const yld = terrainYield(t.terrain);
          return (
            <polygon
              key={`hex-${key}`}
              points={hexPoints(x, y, HEX_SIZE - 1.5)}
              fill={fill}
              stroke={t.hasCamp ? "#d9a441" : act ? "#e8edf2" : "#0d141b"}
              strokeWidth={t.hasCamp ? 3 : act ? 2 : 1.5}
              className={act ? "hex-actionable" : ""}
              onClick={() => onTileClick(t)}
              style={{ cursor: act ? "pointer" : "default" }}
            >
              <title>
                {t.explored
                  ? `${TERRAIN_LABELS[t.terrain]} · ${TERRAIN[t.terrain].trait} biome · ${yld.wood} wood, ${yld.food} food`
                  : "Unexplored — click to explore"}
              </title>
            </polygon>
          );
        })}
        {/* Pass 2: all overlays (icons, text, dots, unassign) rendered on top */}
        {centers.map(({ t, x, y }) => {
          const key = tileKey(t.q, t.r);
          const yld = terrainYield(t.terrain);
          const prodText = [yld.wood > 0 ? `${yld.wood}🪵` : "", yld.food > 0 ? `${yld.food}🍖` : ""].filter(Boolean).join(" ");
          const pawnCount = pawnsByTile.get(key) ?? 0;
          const gCount = gatherDotsByTile.get(key) ?? 0;
          const eCount = exploreDotsByTile.get(key) ?? 0;
          return (
            <g key={`ov-${key}`} style={{ pointerEvents: "none" }}>
              {t.hasCamp ? (
                <>
                  <text x={x} y={y + 2} textAnchor="middle" fontSize={13}>🏕️</text>
                  <text x={x} y={y + 12} textAnchor="middle" fontSize={7} fontWeight={700} fill="#fff">CAMP</text>
                </>
              ) : t.explored ? (
                <>
                  <text x={x} y={y + 4} textAnchor="middle" fontSize={9} fill="#fff">{prodText}</text>
                  {t.beast && !state.discoveredBeasts.find(db => db.instanceId.endsWith(key)) && (
                    <text x={x} y={y - HEX_SIZE + 14} textAnchor="middle" fontSize={11}>
                      <title>A {t.beast.name} lairs here — discover it by exploring this tile</title>
                      {(t.beast as import("@engine").Beast & { icon: string }).icon ?? "🐗"}
                    </text>
                  )}
                  {t.treasures.some(tr => !tr.claimed) && (
                    <text x={x + HEX_SIZE - 6} y={y + 4} textAnchor="middle" fontSize={10}>
                      <title>{t.treasures.filter(tr => !tr.claimed).length} treasure(s) here</title>
                      📦
                    </text>
                  )}
                </>
              ) : (
                <text x={x} y={y + 5} textAnchor="middle" fontSize={14} fill="#5a6b7a">?</text>
              )}
              {pawnCount > 0 && (() => {
                const dotSpacing = 7;
                const allDots: Array<{ color: string }> = [
                  ...Array(gCount).fill({ color: "#d9a441" }),
                  ...Array(eCount).fill({ color: "#4a8c5c" }),
                ];
                const totalW = (allDots.length - 1) * dotSpacing;
                const dotY = y + HEX_SIZE - 8;
                return (
                  <g>
                    {allDots.map((d, i) => (
                      <circle key={i} cx={x - totalW / 2 + i * dotSpacing} cy={dotY} r={3.5} fill={d.color} stroke="#0d141b" strokeWidth={0.8} />
                    ))}
                    {interactive && onTileUnassign && (
                      <text
                        x={x} y={dotY - 8}
                        textAnchor="middle" fontSize={10} fill="#c75c4a" fontWeight={700}
                        style={{ cursor: "pointer", pointerEvents: "all" }}
                        onClick={(e) => { e.stopPropagation(); onTileUnassign(key); }}
                      >
                        ✕
                      </text>
                    )}
                  </g>
                );
              })()}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function GatherChoice({
  tile,
  full,
  onPick,
  onCancel,
}: {
  tile: Tile;
  full: { wood: boolean; food: boolean };
  onPick: (res: "wood" | "food") => void;
  onCancel: () => void;
}) {
  return (
    <div className="gather-choice">
      <span>
        Gather from the <strong>{TERRAIN_LABELS[tile.terrain]}</strong>:
      </span>
      <button disabled={full.wood} onClick={() => onPick("wood")}>🪵 Wood</button>
      <button disabled={full.food} onClick={() => onPick("food")}>🍖 Food</button>
      <button className="tiny" onClick={onCancel}>Cancel</button>
    </div>
  );
}

// ---- Characters -------------------------------------------------------------

function Characters({ state, onUseAbility }: { state: GameState; onUseAbility: (charId: string, abilityId: string) => void }) {
  return (
    <div className="characters">
      {state.characters.map((c, i) => (
        <CharacterCard
          key={c.id}
          character={c}
          isFirstPlayer={i === state.firstPlayerIndex}
          interactive={state.phase === "action"}
          usedAbilities={state.usedAbilities}
          onUseAbility={onUseAbility}
        />
      ))}
    </div>
  );
}

function CharacterCard({
  character: c,
  isFirstPlayer,
  interactive,
  usedAbilities,
  onUseAbility,
}: {
  character: Character;
  isFirstPlayer: boolean;
  interactive: boolean;
  usedAbilities: string[];
  onUseAbility: (charId: string, abilityId: string) => void;
}) {
  const dead = c.health <= 0;
  if (c.isCompanion) {
    return (
      <div className={`character companion-card ${dead ? "dead" : ""}`}>
        <div className="char-header">
          <span className="character-name">{c.companionType === "friday" ? "🏃" : "🐕"} {c.name}</span>
        </div>
        <div className="hearts" style={{fontSize:"11px"}}>
          {c.invincible ? <span className="companion-invincible">🛡️ Invincible</span>
            : Array.from({ length: c.maxHealth }, (_, i) => (
              <span key={i} className={i < c.health ? "heart full" : "heart empty"} style={{fontSize:"10px"}}>
                {i < c.health ? "❤️" : "🖤"}
              </span>
            ))}
        </div>
        <div className="companion-role muted" style={{fontSize:"10px"}}>
          {c.companionType === "friday" ? "Free agent · immune to environment · risky/events can wound" : "Hunt & Explore · invincible"}
        </div>
      </div>
    );
  }
  return (
    <div className={`character ${dead ? "dead" : ""}`}>
      <div className="char-header">
        <span className="character-name">
          {c.name}{isFirstPlayer && <span className="crown" title="First player">👑</span>}
        </span>
        <span className="char-det-inline" title="Determination">{c.determination > 0 ? "✊".repeat(Math.min(c.determination, 6)) : "—"}</span>
      </div>
      <div className="hearts-compact">
        {Array.from({ length: c.maxHealth }, (_, i) => {
          const value = i + 1;
          const filled = i < c.health;
          const isMark = c.moraleLossAt.includes(value);
          return (
            <span key={i} className="heart-pip">
              <span className={filled ? "heart full" : "heart empty"}>{filled ? "❤️" : "🖤"}</span>
              {isMark && <span className="morale-mark">▾</span>}
            </span>
          );
        })}
      </div>
      <div className="abilities">
        {ABILITIES[c.role].map((ab) => (
          <AbilityRow
            key={ab.id}
            ability={ab}
            character={c}
            interactive={interactive}
            used={usedAbilities.includes(`${c.id}:${ab.id}`)}
            onUse={() => onUseAbility(c.id, ab.id)}
          />
        ))}
      </div>
    </div>
  );
}

function AbilityRow({
  ability,
  character,
  interactive,
  used,
  onUse,
}: {
  ability: Ability;
  character: Character;
  interactive: boolean;
  used: boolean;
  onUse: () => void;
}) {
  const isActive = ability.kind === "active";
  const cost = ability.cost ?? 0;
  const canUse = interactive && isActive && !used && character.determination >= cost && character.health > 0;
  return (
    <div className="ability">
      <div className="ability-head">
        <span className="ability-name">{ability.name}</span>
        <span className={`ability-tag ${ability.kind}`}>{isActive ? "active" : "passive"}</span>
      </div>
      <div className="ability-desc">{ability.description}</div>
      {ability.effects && (
        <div className="ability-effects">{ability.effects.map((e, i) => <span key={i} className="eff-chip">{effectLabel(e)}</span>)}</div>
      )}
      {isActive && interactive && (
        <button className="tiny" disabled={!canUse} onClick={onUse} title={ability.description}>
          {used ? "✓" : "✊".repeat(Math.min(cost, 5))}
        </button>
      )}
    </div>
  );
}

// ---- Phase panels -----------------------------------------------------------

function continueLabel(state: GameState): string {
  if (state.phase === "night") return state.round >= state.maxRounds ? "See final results →" : "Begin next round →";
  if (state.phase === "actionDone") return "Continue to Weather ☁️ →";
  const idx = PHASE_ORDER.indexOf(state.phase);
  const next = PHASE_ORDER[idx + 1];
  return next ? `Continue to ${PHASE_LABELS[next]} →` : "Continue →";
}

function EventPhasePanel({ state, onContinue }: { state: GameState; onContinue: () => void }) {
  const drawn = state.threatQueue[0];
  const fellOff = state.phaseSummary.find((l) => l.includes("falls from the book"));
  return (
    <div className="panel">
      <h2>Event phase</h2>
      {drawn && (
        <div className="event-hero">
          <div className="event-hero-name">{drawn.name}</div>
          <p className="card-story">{drawn.story}</p>
          <p className="part-text">
            {drawn.immediate.text} <em className="effect">({effectLabel(drawn.immediate.effect)})</em>
          </p>
          <p className="muted small">It now sits in the event book. Resolve it during an Action phase, or its consequence strikes when it falls from the book.</p>
        </div>
      )}
      {fellOff && <div className="falloff-alert">⚠ {fellOff}</div>}
    </div>
  );
}

function PhasePanel({ state, onContinue: _onContinue }: { state: GameState; onContinue: () => void }) {
  const title = state.phase === "actionDone" ? "Actions resolved" : `${PHASE_LABELS[state.phase]} phase`;
  return (
    <div className="panel">
      <h2>{title}</h2>
      <ul className="summary">
        {state.phaseSummary.map((line, i) => (
          <li key={i} className={line.startsWith("  ") ? "sub" : ""}>{line.trim()}</li>
        ))}
      </ul>
    </div>
  );
}

// ---- Dice tray + resolution overlay ----------------------------------------

function PendingThreats({ cards, hasMedicine }: { cards: GameState["pendingFollowups"]; hasMedicine: boolean }) {
  if (cards.length === 0) return null;
  return (
    <div className="pending-threats">
      <span className="pending-label">
        🩹 Lingering troubles — shuffled into the deck, may resurface
        {hasMedicine && <em className="muted"> (medicine on hand mitigates the worst)</em>}
      </span>
      <div className="pending-list">
        {cards.map((c, i) => (
          <span className="pending-chip" key={`${c.id}-${i}`} title={c.followup?.text}>
            {c.title}
            {c.followup && <em className="effect bad"> {effectLabel(c.followup.effect)}{c.followup.mitigable ? " (mitigable)" : ""}</em>}
          </span>
        ))}
      </div>
    </div>
  );
}

function DiceTray({ rolls }: { rolls: ActionRoll[] }) {
  if (rolls.length === 0) return null;
  return (
    <div className="dice-tray">
      <span className="dice-tray-label">🎲 Last action rolls</span>
      {rolls.map((r, i) => (
        <div className="dice-row" key={i}>
          <span className="dice-action">{r.label}</span>
          <span className={`die ${r.success ? "hit" : "miss"}`}>{r.success ? "✓ success" : "✗ fail"}</span>
          <span className={`die ${r.injury ? "bad" : "off"}`}>{r.injury ? "🩸 wound" : "— safe"}</span>
          <span className={`die ${r.chance ? "card" : "off"}`}>{r.chance ? "🃏 card" : "— none"}</span>
        </div>
      ))}
    </div>
  );
}

function DiceAnim({ roll }: { roll: NonNullable<ResolutionStep["roll"]> }) {
  const [rolling, setRolling] = useState(true);
  useEffect(() => {
    setRolling(true);
    const t = setTimeout(() => setRolling(false), 700);
    return () => clearTimeout(t);
  }, [roll]);
  return (
    <div className="dice-anim">
      <span className={`bigdie ${rolling ? "rolling" : roll.success ? "hit" : "miss"}`} title="Success">
        {rolling ? "🎲" : roll.success ? "✓" : "✗"}
      </span>
      <span className={`bigdie ${rolling ? "rolling" : roll.injury ? "bad" : "off"}`} title="Injury">
        {rolling ? "🎲" : roll.injury ? "🩸" : "—"}
      </span>
      <span className={`bigdie ${rolling ? "rolling" : roll.chance ? "card" : "off"}`} title="Adventure">
        {rolling ? "🎲" : roll.chance ? "🃏" : "—"}
      </span>
    </div>
  );
}

function ResolutionOverlay({ steps, onClose }: { steps: ResolutionStep[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = steps[i];
  const isLast = i >= steps.length - 1;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-progress">
          Resolving action {i + 1} of {steps.length}
        </div>
        <h3>{step.label}</h3>
        {step.roll && <DiceAnim key={i} roll={step.roll} />}
        <ul className="summary">
          {step.lines.map((l, j) => (
            <li key={j} className={l.startsWith("  ") ? "sub" : ""}>{l.trim()}</li>
          ))}
        </ul>
        <div className="overlay-actions">
          {isLast ? (
            <button className="primary" onClick={onClose}>Continue →</button>
          ) : (
            <button className="primary" onClick={() => setI(i + 1)}>Next action →</button>
          )}
          <button onClick={onClose}>Skip</button>
        </div>
      </div>
    </div>
  );
}

// ---- Action panel -----------------------------------------------------------

// ---- Build structure cards + biome panel (must be before ActionPanel) -------

// ---- Role icons + colors for pawn circles -----------------------------------

const ROLE_ICON: Partial<Record<import("@engine").CharacterRole, string>> = {
  carpenter: "🪚", cook: "🍳", explorer: "🧭", soldier: "⚔️", friday: "🏃", dog: "🐕",
};
const ROLE_COLOR: Partial<Record<import("@engine").CharacterRole, string>> = {
  carpenter: "#c47f1a", cook: "#2a8c3a", explorer: "#3a72c8", soldier: "#c84a4a",
  friday: "#2a8c8c", dog: "#8c5a2a",
};

const STRUCTURE_ICON: Record<BuildTarget, string> = { shelter: "🛖", roof: "🏠", palisade: "🧱", weapon: "⚔️" };

const ITEM_ICONS: Record<string, string> = {
  hatchet: "🪓", basket: "🧺", spear: "🗡️", firepit: "🔥",
  "signal-fire": "🚨", garden: "🌱", fishtrap: "🎣", outpost: "🏕️", healerkit: "💊",
  waraxe: "⚔️", greenhouse: "🌿", dryingrack: "🪣", totem: "🗿",
  stormshelter: "⛺", toolkit: "🔧", smokehouse: "🏭", watchtower: "🗼", fireshrine: "⛩️",
  "carp-bench": "🪚", "cook-cellar": "🥔", "expl-charts": "🗺️", "sol-armory": "🛡️",
};
const STRUCTURE_DESC: Record<BuildTarget, string> = {
  shelter: "Protects against weather. Required for Roof.",
  roof: "Each level reduces weather breach. Requires shelter.",
  palisade: "Each level mitigates storm winds and damage.",
  weapon: "Each level reduces beast wounds and hunt casualties.",
};

function BuildCard({
  target, spec, legal, assignedPawnIds, secure, affordable, hasPawns,
  wCost, lCost, level, builtFlat, state, onAssign, onUnassign,
}: {
  target: BuildTarget;
  spec: (typeof BUILD_SPECS)[BuildTarget];
  legal: { ok: boolean; reason?: string };
  assignedPawnIds: string[]; secure: boolean; affordable: boolean; hasPawns: boolean;
  wCost: number; lCost: number; level: number | null; builtFlat: boolean;
  state: GameState;
  onAssign: (action: ActionKind, opts?: Partial<Assignment>) => void;
  onUnassign: (pawnId: string) => void;
}) {
  const locked = !legal.ok;
  const pawns = assignedPawnIds.length;
  const canBuild = hasPawns && legal.ok && affordable && !secure;
  const status = builtFlat ? "✓ Built" : level !== null ? `Level ${level}` : null;
  // Req checks: only roof requires shelter
  const reqs = target === "roof"
    ? [{ label: "🛖 Shelter", met: state.camp.shelterBuilt }]
    : [];

  return (
    <div className={`build-card ${locked ? "locked" : ""} ${secure ? "secured" : ""}`}>
      <div className="build-card-icon">{STRUCTURE_ICON[target]}</div>
      <div className="build-card-name">{spec.label}</div>
      {status && <div className="build-card-status">{status}</div>}
      <div className="build-card-desc">{STRUCTURE_DESC[target]}</div>
      {reqs.length > 0 && (
        <div className="card-reqs">
          {reqs.map((r) => (
            <span key={r.label} className={`card-req ${r.met ? "met" : "unmet"}`}>
              {r.met ? "✓" : "✗"} {r.label}
            </span>
          ))}
        </div>
      )}
      {locked ? (
        <div className="build-card-locked">{legal.reason}</div>
      ) : secure ? (
        <div className="build-card-locked">✓ Secured</div>
      ) : !affordable ? (
        <div className="build-card-locked">✗ Not enough resources</div>
      ) : null}
      {assignedPawnIds.length > 0 && (
        <div className="card-assigned-pawns">
          {assignedPawnIds.map((p) => (
            <span key={p} className="assigned-pawn-chip">
              {characterOfPawn(state, p)?.name.slice(0, 4)}
              <button className="unassign-x" onClick={() => onUnassign(p)}>✕</button>
            </span>
          ))}
          <span className="muted" style={{fontSize:10}}>
            {secure ? "(secure)" : "(risky)"}
          </span>
        </div>
      )}
      {!locked && !secure && (
        <button
          className={`tiny build-card-btn ${pawns === 1 ? "secure-hint" : ""}`}
          disabled={!canBuild}
          onClick={() => onAssign("build", { buildTarget: target })}
        >
          {pawns === 1 ? "🔒→🔓 Secure" : "Build (risky)"}
        </button>
      )}
    </div>
  );
}

const ALL_BIOMES: Array<import("@engine").Biome> = ["beach", "plains", "hills", "mountains", "rivers"];

function BiomePanel({ state }: { state: GameState }) {
  return (
    <div className="biome-panel">
      <h3>Discovered Biomes</h3>
      <div className="biome-grid">
        {ALL_BIOMES.map((b) => {
          const disc = biomeDiscovered(state, b);
          return (
            <div key={b} className={`biome-cell ${disc ? "disc" : "undisc"}`}>
              <span className="biome-cell-icon">{BIOME_ICONS[b]}</span>
              <span className="biome-cell-label">{BIOME_LABELS[b]}</span>
              <span className="biome-cell-state">{disc ? "Discovered" : "Not yet"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function ActionPanel({
  state,
  available,
  selectedPawn,
  onSelectPawn,
  onUnassign,
  onAssign,
  onUseAbility,
  onResolve,
}: {
  state: GameState;
  available: Resources;
  selectedPawn: string | null;
  onSelectPawn: (id: string) => void;
  onUnassign: (id: string) => void;
  onAssign: (action: ActionKind, opts?: Partial<Assignment>) => void;
  onUseAbility: (charId: string, abilityId: string) => void;
  onResolve: () => void;
}) {
  const hasPawns = state.availablePawns.length > 0;
  // Map each build target to how many pawns are already assigned (0, 1 risky, or 2 secure).
  const buildPawns = new Map<BuildTarget, number>();
  for (const a of state.assignments) {
    if (a.action === "build" && a.buildTarget) {
      buildPawns.set(a.buildTarget, a.pawnIds.length);
    }
  }
  // Same for items.
  const itemPawns = new Map<string, number>();
  for (const a of state.assignments) {
    if (a.action === "build" && a.itemId) {
      itemPawns.set(a.itemId, a.pawnIds.length);
    }
  }

  // Character inventions: show only for active characters in the current game.
  const activeRoles = new Set(state.characters.filter((c) => !c.isCompanion).map((c) => c.role));
  const characterItems = CHARACTER_ITEMS.filter((i) => i.ownedBy && activeRoles.has(i.ownedBy));
  // Order: basic → special → character (tier badges on cards tell the player which is which)
  const allInventions = [...BASIC_ITEMS, ...SPECIAL_ITEMS, ...characterItems];

  return (
    <div className="panel">
      <h2>Action phase</h2>

      <div className="subsection">
        <h3>Available pawns</h3>
        {hasPawns ? (
          <div className="pawn-row">
            {state.availablePawns.map((p) => {
              const owner = characterOfPawn(state, p);
              const role = owner?.role;
              const icon = (role && ROLE_ICON[role]) ?? "👤";
              const color = (role && ROLE_COLOR[role]) ?? "#555";
              const isSel = p === selectedPawn;
              return (
                <button
                  key={p}
                  className={`pawn-circle ${isSel ? "selected" : ""}`}
                  style={{ "--pawn-color": color } as React.CSSProperties}
                  onClick={() => onSelectPawn(p)}
                  title={owner?.name}
                >
                  <span className="pawn-icon">{icon}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="muted">All pawns assigned.</p>
        )}
      </div>

      <div className="subsection">
        <h3>Camp actions</h3>
        <div className="action-buttons">
          <button disabled={!hasPawns} onClick={() => onAssign("arrange")} title="Safe. Each pawn grants 1 determination.">🧹 Arrange Camp</button>
          <button disabled={!hasPawns} onClick={() => onAssign("rest")} title="Safe. Recover 1 health.">💤 Rest</button>
        </div>
      </div>

      <div className="subsection">
        <h3>Hunt</h3>
        {state.discoveredBeasts.length === 0 ? (
          <p className="muted small">No beasts discovered yet. Explore island tiles to find them.</p>
        ) : (
          <div className="build-cards">
            {state.discoveredBeasts.map((b) => {
              const beastAsn = state.assignments.find((a) => a.action === "hunt" && a.beastInstanceId === b.instanceId);
              const beastPawnIds = beastAsn?.pawnIds ?? [];
              const secure = beastPawnIds.length >= 2;
              const wounds = Math.max(0, b.strength - state.camp.weaponLevel);
              const bIcon = (b as typeof b & { icon?: string }).icon ?? "🐗";
              return (
                <div key={b.instanceId} className={`build-card ${secure ? "secured" : ""}`}>
                  <div className="build-card-icon">{bIcon}</div>
                  <div className="build-card-name">{b.name}</div>
                  <div className="build-card-desc">
                    Strength {b.strength} · dulls −{b.weaponDull}⚔️<br/>
                    Reward: {b.food}🍖 {b.leather}🧤
                  </div>
                  <div className={`build-card-cost ${wounds === 0 ? "" : "cost-unmet"}`}>
                    {wounds === 0 ? "✓ No wounds (weapon strong enough)" : `⚠ ${wounds} wound${wounds > 1 ? "s" : ""} likely`}
                  </div>
                  {beastPawnIds.length > 0 && (
                    <div className="card-assigned-pawns">
                      {beastPawnIds.map((p) => (
                        <span key={p} className="assigned-pawn-chip">
                          {characterOfPawn(state, p)?.name.slice(0, 4)}
                          <button className="unassign-x" onClick={() => onUnassign(p)}>✕</button>
                        </span>
                      ))}
                      <span className="muted" style={{fontSize:10}}>{secure ? "(secure)" : "(risky)"}</span>
                    </div>
                  )}
                  {!secure && (
                    <>
                      <div className="muted small" style={{fontSize:12}}>
                        {"👤".repeat(beastPawnIds.length)}{"○".repeat(2 - beastPawnIds.length)}
                      </div>
                      <button
                        className="tiny build-card-btn"
                        disabled={!hasPawns}
                        onClick={() => onAssign("hunt", { beastInstanceId: b.instanceId })}
                      >
                        {beastPawnIds.length === 1 ? "🏹 Add 2nd hunter" : "🏹 Assign hunter"}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="subsection">
        <BiomePanel state={state} />
      </div>

      <div className="subsection">
        <div className="build-header">
          <h3>Build structures</h3>
          <span className="build-cost-note muted small">
            {(() => { const {wood,leather} = scaledBuildCost(state.playerCount); return `${wood}🪵 or ${leather}🧤 each`; })()}
          </span>
        </div>
        <div className="build-cards">
          {BUILD_TARGETS.map((t) => {
            const spec = BUILD_SPECS[t];
            const legal = buildIsLegal(state, t);
            const buildAsn = state.assignments.filter((a) => a.action === "build" && a.buildTarget === t);
            const assignedPawnIds = buildAsn.flatMap((a) => a.pawnIds);
            const pawns = assignedPawnIds.length;
            const secure = pawns >= 2;
            const { wood: wCost, leather: lCost } = scaledBuildCost(state.playerCount);
            const canWood = canAfford(available, { wood: wCost });
            const canLeather = canAfford(available, { hide: lCost });
            const affordable = pawns === 1 ? true : (canWood || canLeather);
            const level = t === "palisade" ? state.camp.palisadeLevel
              : t === "weapon" ? state.camp.weaponLevel
              : t === "roof" ? state.camp.roofLevel
              : null;
            const builtFlat = (t === "shelter" && state.camp.shelterBuilt);
            return (
              <BuildCard
                key={t}
                target={t}
                spec={spec}
                legal={legal}
                assignedPawnIds={assignedPawnIds}
                secure={secure}
                affordable={affordable}
                hasPawns={hasPawns}
                wCost={wCost}
                lCost={lCost}
                level={level}
                builtFlat={builtFlat}
                state={state}
                onAssign={onAssign}
                onUnassign={onUnassign}
              />
            );
          })}
        </div>

        <h3>Inventions</h3>
        <div className="item-cards">
          {allInventions.map((item) => {
            const ids = state.assignments.filter(a => a.action === "build" && a.itemId === item.id).flatMap(a => a.pawnIds);
            return <ItemCard key={item.id} item={item} state={state} available={available} pawnCount={ids.length} assignedPawnIds={ids} hasPawns={hasPawns} onAssign={onAssign} onUnassign={onUnassign} />;
          })}
        </div>
      </div>

      <button className="primary" onClick={onResolve}>Resolve actions</button>
    </div>
  );
}

function ItemCard({
  item,
  state,
  available,
  pawnCount,
  assignedPawnIds,
  hasPawns,
  onAssign,
  onUnassign,
}: {
  item: (typeof ITEMS)[number] | (typeof CHARACTER_ITEMS)[number];
  state: GameState;
  available: Resources;
  pawnCount: number;
  assignedPawnIds: string[];
  hasPawns: boolean;
  onAssign: (action: ActionKind, opts?: Partial<Assignment>) => void;
  onUnassign: (pawnId: string) => void;
}) {
  const legal = itemIsLegal(state, item);
  const affordable = pawnCount === 1 ? true : canAfford(available, item.cost);
  const built = state.builtItems.includes(item.id);
  const secure = pawnCount >= 2;
  const canBuild = hasPawns && legal.ok && affordable && !secure && !built;
  const itemCostStr = costStr(item.cost);

  // Requirements with ✓/✗ status
  const reqs: Array<{ label: string; met: boolean }> = [];
  if (item.requires) {
    for (const rid of item.requires) {
      const dep = [...ITEMS, ...CHARACTER_ITEMS].find((i) => i.id === rid);
      const icon = dep ? (ITEM_ICONS[rid] ?? "🛠️") : "🛠️";
      const name = dep?.name ?? rid;
      reqs.push({ label: `${icon} ${name}`, met: state.builtItems.includes(rid) });
    }
  }
  if (item.requiresBiome) {
    const discovered = biomeDiscovered(state, item.requiresBiome);
    reqs.push({ label: `${BIOME_ICONS[item.requiresBiome]} ${BIOME_LABELS[item.requiresBiome]}`, met: discovered });
  }

  const icon = ITEM_ICONS[item.id] ?? "🛠️";
  const tierColor = item.tier === "character" ? "char" : item.tier === "special" ? "special" : "basic";

  return (
    <div className={`build-card item-card ${built ? "secured" : !legal.ok ? "locked" : ""}`}>
      <div className="build-card-icon">{icon}</div>
      <div className="build-card-name">
        {item.name}
        <span className={`item-tier ${tierColor}`}>{item.tier}</span>
      </div>
      {built && <div className="build-card-status">✓ Built</div>}
      <div className="build-card-desc">{item.description}</div>
      {reqs.length > 0 && (
        <div className="card-reqs">
          {reqs.map((r) => (
            <span key={r.label} className={`card-req ${r.met ? "met" : "unmet"}`}>
              {r.met ? "✓" : "✗"} {r.label}
            </span>
          ))}
        </div>
      )}
      {!built && (
        <div className={`build-card-cost ${!affordable && pawnCount !== 1 ? "cost-unmet" : ""}`}>
          {itemCostStr || "free"}
        </div>
      )}
      {assignedPawnIds.length > 0 && (
        <div className="card-assigned-pawns">
          {assignedPawnIds.map((p) => (
            <span key={p} className="assigned-pawn-chip">
              {characterOfPawn(state, p)?.name.slice(0, 4)}
              <button className="unassign-x" onClick={() => onUnassign(p)}>✕</button>
            </span>
          ))}
          <span className="muted" style={{fontSize:10}}>{secure ? "(secure)" : "(risky)"}</span>
        </div>
      )}
      {!built && !secure && (
        <button
          className={`tiny build-card-btn ${pawnCount === 1 ? "secure-hint" : ""}`}
          disabled={!canBuild}
          onClick={() => onAssign("build", { itemId: item.id })}
        >
          {pawnCount === 1 ? "🔒→🔓 Secure" : "Build (risky)"}
        </button>
      )}
    </div>
  );
}


function TileActionChoice({
  tile,
  onGatherWood,
  onGatherFood,
  onClaim,
  onCancel,
}: {
  tile: Tile;
  onGatherWood: () => void;
  onGatherFood: () => void;
  onClaim: () => void;
  onCancel: () => void;
}) {
  const y = terrainYield(tile.terrain);
  const unclaimed = tile.treasures.filter((tr) => !tr.claimed).length;
  return (
    <div className="gather-choice">
      <span>
        <strong>{TERRAIN_LABELS[tile.terrain]}</strong>:
      </span>
      {y.wood > 0 && <button onClick={onGatherWood}>🪵 Wood</button>}
      {y.food > 0 && <button onClick={onGatherFood}>🍖 Food</button>}
      {unclaimed > 0 && <button onClick={onClaim}>📦 Claim {unclaimed} treasure{unclaimed > 1 ? "s" : ""}</button>}
      <button className="tiny" onClick={onCancel}>Cancel</button>
    </div>
  );
}

function HeldTreasures({
  treasures,
  interactive,
  onUse,
}: {
  treasures: TileTreasure[];
  interactive: boolean;
  onUse: (id: string) => void;
}) {
  if (treasures.length === 0) return null;
  return (
    <div className="held-treasures">
      <span className="held-label">📦 Treasure trove</span>
      <div className="held-list">
        {treasures.map((tr) => (
          <div className="held-item" key={tr.id} title={tr.description}>
            <strong>{tr.name}</strong>
            <span className="muted"> — {tr.description}</span>
            {interactive && (
              <button className="tiny" onClick={() => onUse(tr.id)}>
                Use
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Castaways: Wood Pile ---------------------------------------------------

const WOOD_PILE_COSTS = [1, 2, 3, 4, 5];

function WoodPile({ state, onBuild, interactive }: { state: GameState; onBuild: () => void; interactive: boolean }) {
  const stage = state.woodPileStage;
  const doneThisRound = state.woodPileLastBuiltRound >= state.round;
  const nextCost = stage < 5 ? WOOD_PILE_COSTS[stage] : 0;
  const canAffordNext = state.resources.wood >= nextCost;
  const complete = stage >= 5;
  const fireBuilt = state.builtItems.includes("signal-fire");
  const waitingForDay10 = complete && state.round < 10;
  const waitingForFire = complete && !fireBuilt;

  return (
    <div className={`panel wood-pile-panel ${complete && fireBuilt ? "complete" : ""}`}>
      <h2>🔥 Signal Pile</h2>
      <div className="pile-stages">
        {WOOD_PILE_COSTS.map((cost, i) => (
          <div key={i} className={`pile-stage ${i < stage ? "built" : i === stage ? "next" : ""}`}>
            <span className="stage-num">Stage {i + 1}</span>
            <span className="stage-cost">{i < stage ? "✓" : `${cost}🪵`}</span>
          </div>
        ))}
      </div>
      <div className="pile-requires">
        <span className={fireBuilt ? "req-met" : "req-unmet"}>
          {fireBuilt ? "✓" : "✗"} Signal Fire {!fireBuilt && <span className="muted small">(🏔️ Mountains biome)</span>}
        </span>
      </div>
      {waitingForFire && <p className="pile-wait">Build the Signal Fire to light the pile and signal rescue.</p>}
      {waitingForDay10 && fireBuilt && <p className="pile-wait">Pile lit — waiting for a ship to be in range (day 10).</p>}
      {!complete && interactive && (
        <button
          className="primary"
          disabled={doneThisRound || !canAffordNext}
          onClick={onBuild}
          title={doneThisRound ? "Already built a stage this turn" : !canAffordNext ? `Need ${nextCost} wood` : ""}
        >
          {doneThisRound ? "Built this turn" : `Build stage ${stage + 1} (${nextCost}🪵)`}
        </button>
      )}
      {!complete && !interactive && (
        <p className="muted small">Available to build during the Action phase.</p>
      )}
    </div>
  );
}

// ---- Weather overlay --------------------------------------------------------

const WEATHER_DIE_ICONS: Record<WeatherStep["die"], string> = {
  rain: "🌧️",
  snow: "❄️",
  danger: "⚠️",
  storm: "🌀",
};

function WeatherDieAnim({ step, visible }: { step: WeatherStep; visible: boolean }) {
  const [rolling, setRolling] = useState(true);
  useEffect(() => {
    setRolling(true);
    const t = setTimeout(() => setRolling(false), 700);
    return () => clearTimeout(t);
  }, [step]);
  const icon = WEATHER_DIE_ICONS[step.die];
  const isDanger = step.dangerResult && step.dangerResult !== "nothing";
  const className = rolling ? "bigdie rolling" : isDanger ? "bigdie bad" : step.rain > 0 || step.snow > 0 ? "bigdie miss" : "bigdie off";
  return (
    <div className="weather-die-col">
      <div className={className} title={step.die}>
        {rolling ? "🎲" : icon}
      </div>
      <div className="weather-die-label">{visible && !rolling ? step.faceLabel : step.die}</div>
    </div>
  );
}

function WeatherOverlay({ steps, onClose }: { steps: WeatherStep[]; onClose: () => void }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 800);
    return () => clearTimeout(t);
  }, []);
  const totalRain = steps.reduce((s, d) => s + d.rain, 0);
  const totalSnow = steps.reduce((s, d) => s + d.snow, 0);
  const danger = steps.find((d) => d.dangerResult && d.dangerResult !== "nothing");

  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-progress">Weather Phase</div>
        <h3>Rolling the weather…</h3>
        <div className="dice-anim weather-dice-row">
          {steps.map((step, i) => (
            <WeatherDieAnim key={i} step={step} visible={revealed} />
          ))}
        </div>
        {revealed && (
          <div className="weather-summary">
            {totalRain > 0 && <div>🌧️ {totalRain} total rain pressure</div>}
            {totalSnow > 0 && <div>❄️ {totalSnow} total snow — burns wood to survive</div>}
            {danger && <div className="bad">⚠️ Danger: {danger.faceLabel}</div>}
            {!totalRain && !totalSnow && !danger && <div className="muted">Calm night — no effect.</div>}
          </div>
        )}
        <div className="overlay-actions">
          <button className="primary" onClick={onClose}>{revealed ? "Continue →" : "Skip"}</button>
        </div>
      </div>
    </div>
  );
}

// ---- Assignment sidebar -----------------------------------------------------

function assignmentLabel(a: Assignment, state: GameState): string {
  const terrain = a.tileKey ? state.tiles.find(t => `${t.q},${t.r}` === a.tileKey)?.terrain : undefined;
  const terrainName = terrain ? TERRAIN_LABELS[terrain] : "tile";
  if (a.action === "gather") return `Gather ${a.gatherResource === "food" ? "🍖" : "🪵"} @ ${terrainName}`;
  if (a.action === "explore") return `Explore → ${terrainName}`;
  if (a.action === "build" && a.buildTarget) return `Build ${BUILD_SPECS[a.buildTarget].label}`;
  if (a.action === "build" && a.itemId) return `Build ${ITEMS.find(i => i.id === a.itemId)?.name ?? a.itemId}`;
  if (a.action === "hunt") {
    const b = a.beastInstanceId ? state.discoveredBeasts.find(db => db.instanceId === a.beastInstanceId) : state.discoveredBeasts[0];
    return `Hunt: ${b?.name ?? "beast"}`;
  }
  if (a.action === "arrange") return `Arrange Camp`;
  if (a.action === "rest") return `Rest`;
  if (a.action === "claimTreasure") return `Claim Treasure`;
  return a.action;
}

function AssignmentSidebar({ state, onUnassign }: { state: GameState; onUnassign: (pawnId: string) => void }) {
  const assignments = state.assignments.filter(a => a.action !== "resolveThreat");
  return (
    <div className="assign-sidebar">
      <h3>Current Plan</h3>
      {assignments.length === 0 ? (
        <p className="muted small" style={{padding:"4px 0"}}>No actions assigned yet.</p>
      ) : (
        <div className="assign-list">
          {assignments.map((a) => (
            <div key={a.id} className="assign-entry">
              <div className="assign-entry-label">
                <span>{assignmentLabel(a, state)}</span>
                <span className={`assign-security ${a.pawnIds.length >= 2 ? "secure" : "risky"}`}>
                  {a.pawnIds.length >= 2 ? "🔒" : "🎲"}
                </span>
              </div>
              <div className="assign-entry-pawns">
                {a.pawnIds.map((p) => {
                  const char = characterOfPawn(state, p);
                  const role = char?.role;
                  const icon = (role && ROLE_ICON[role]) ?? "👤";
                  const color = (role && ROLE_COLOR[role]) ?? "#555";
                  return (
                    <span key={p} className="assign-pawn-badge" style={{ background: color }}>
                      {icon} {char?.name.slice(0, 4) ?? "?"}
                      <button className="unassign-x" onClick={() => onUnassign(p)}>✕</button>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Log({ entries }: { entries: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [entries.length]);
  return (
    <div className="log" ref={ref}>
      <h2>Log</h2>
      {entries.map((e, i) => (
        <div key={i} className={`log-entry ${e.startsWith("  ") ? "sub" : ""}`}>{e.trim()}</div>
      ))}
    </div>
  );
}
