// The island: a small hex map in axial coordinates (q, r). Generation is
// seeded so games are reproducible. Exploration is not built yet, so we reveal
// the camp tile and its immediate neighbours and hide the rest.

import { ISLAND_RADIUS, ISLAND_TERRAINS, terrainYield } from "./config";
import { nextRandom } from "./rng";
import { generateTreasures } from "./treasures";
import type { Beast, Tile } from "./types";

export interface Axial {
  q: number;
  r: number;
}

/** The six axial directions around a hex. */
const DIRECTIONS: Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function tileKey(q: number, r: number): string {
  return `${q},${r}`;
}

export function neighbors(q: number, r: number): Axial[] {
  return DIRECTIONS.map((d) => ({ q: q + d.q, r: r + d.r }));
}

/** Axial hex distance from the origin (0,0). */
function ringDistance(q: number, r: number): number {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
}

/** Build the island: camp at the centre, terrain seeded around it.
 *  Accepts an optional beastPool for tile beast generation. */
export function generateIsland(seed: number, beastPool: Beast[] = []): { tiles: Tile[]; seed: number } {
  const coords: Axial[] = [];
  for (let q = -ISLAND_RADIUS; q <= ISLAND_RADIUS; q++) {
    for (let r = -ISLAND_RADIUS; r <= ISLAND_RADIUS; r++) {
      if (ringDistance(q, r) <= ISLAND_RADIUS) coords.push({ q, r });
    }
  }

  // Only the camp tile starts revealed; the rest is discovered by exploring.
  let s = seed;
  const tiles: Tile[] = coords.map(({ q, r }) => {
    if (q === 0 && r === 0) {
      return { q, r, terrain: "beach", explored: true, hasCamp: true, treasures: [] };
    }
    const roll = nextRandom(s);
    s = roll.seed;
    const terrain = ISLAND_TERRAINS[Math.floor(roll.value * ISLAND_TERRAINS.length)];
    const key = tileKey(q, r);
    const tRes = generateTreasures(s, key);
    s = tRes.seed;
    // 65% chance of a beast on this tile (pick with replacement).
    let tileBeast: Beast | undefined;
    const beastRoll = nextRandom(s);
    s = beastRoll.seed;
    if (beastRoll.value < 0.65 && beastPool.length > 0) {
      const pickRoll = nextRandom(s);
      s = pickRoll.seed;
      const idx = Math.floor(pickRoll.value * beastPool.length);
      tileBeast = beastPool[idx]; // pick without removing — all tiles have equal chance
    }
    return { q, r, terrain, explored: false, hasCamp: false, treasures: tRes.treasures, beast: tileBeast };
  });

  return { tiles, seed: s };
}

/** Resources produced by the tile the camp is on. */
export function campProduction(tiles: Tile[]): { wood: number; food: number } {
  const camp = tiles.find((t) => t.hasCamp);
  if (!camp) return { wood: 0, food: 0 };
  return terrainYield(camp.terrain);
}

/** Find a tile by its "q,r" key. */
export function tileByKey(tiles: Tile[], key: string): Tile | undefined {
  return tiles.find((t) => tileKey(t.q, t.r) === key);
}

/** Reveal a specific (frontier) tile by key, if it is hidden. Treasures are preserved. */
export function revealTile(tiles: Tile[], key: string): { tiles: Tile[]; revealed?: Tile } {
  let revealed: Tile | undefined;
  const next = tiles.map((t) => {
    if (tileKey(t.q, t.r) === key && !t.explored) {
      revealed = { ...t, explored: true };
      return revealed;
    }
    return t;
  });
  return { tiles: next, revealed };
}

/** Whether a tile has at least one unclaimed treasure. */
export function hasUnclaimedTreasure(tile: Tile): boolean {
  return tile.treasures.some((tr) => !tr.claimed);
}

/** Is a hidden tile adjacent to an explored one (a valid explore target)? */
export function isFrontier(tiles: Tile[], key: string): boolean {
  const byKey = new Map(tiles.map((t) => [tileKey(t.q, t.r), t]));
  const tile = byKey.get(key);
  if (!tile || tile.explored) return false;
  return neighbors(tile.q, tile.r).some((n) => byKey.get(tileKey(n.q, n.r))?.explored);
}

/** Are there any hidden tiles adjacent to an explored one? */
export function hasUnexplored(tiles: Tile[]): boolean {
  return nextHiddenFrontierKey(tiles) !== undefined;
}

/** Pick the next tile to reveal: a hidden tile adjacent to an explored one,
 *  closest to the camp (lowest ring distance), with a stable tie-break. */
function nextHiddenFrontierKey(tiles: Tile[]): string | undefined {
  const byKey = new Map(tiles.map((t) => [tileKey(t.q, t.r), t]));
  const frontier = tiles.filter((t) => {
    if (t.explored) return false;
    return neighbors(t.q, t.r).some((n) => byKey.get(tileKey(n.q, n.r))?.explored);
  });
  if (frontier.length === 0) return undefined;
  frontier.sort((a, b) => {
    const da = ringDistance(a.q, a.r);
    const db = ringDistance(b.q, b.r);
    if (da !== db) return da - db;
    if (a.r !== b.r) return a.r - b.r;
    return a.q - b.q;
  });
  return tileKey(frontier[0].q, frontier[0].r);
}

/** Reveal the next frontier tile, returning the new tiles and what was found. */
export function revealNextTile(tiles: Tile[]): { tiles: Tile[]; revealed?: Tile } {
  const key = nextHiddenFrontierKey(tiles);
  if (!key) return { tiles };
  let revealed: Tile | undefined;
  const next = tiles.map((t) => {
    if (tileKey(t.q, t.r) === key) {
      revealed = { ...t, explored: true };
      return revealed;
    }
    return t;
  });
  return { tiles: next, revealed };
}
