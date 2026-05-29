// Deterministic, seedable RNG (mulberry32). The engine stays pure by threading
// the seed through state: each draw returns the value plus the next seed.

export function nextRandom(seed: number): { value: number; seed: number } {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, seed: t >>> 0 };
}

/** Roll an n-sided die (1..n) using and advancing the seed. */
export function rollDie(seed: number, sides = 6): { roll: number; seed: number } {
  const { value, seed: next } = nextRandom(seed);
  return { roll: Math.floor(value * sides) + 1, seed: next };
}

/** Pick a uniformly random element, advancing the seed. */
export function pick<T>(items: readonly T[], seed: number): { item: T; seed: number } {
  const { value, seed: next } = nextRandom(seed);
  return { item: items[Math.floor(value * items.length)], seed: next };
}

/** Fisher-Yates shuffle using and advancing the seed. Returns a new array. */
export function shuffle<T>(items: readonly T[], seed: number): { items: T[]; seed: number } {
  const a = [...items];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    const r = nextRandom(s);
    s = r.seed;
    const j = Math.floor(r.value * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return { items: a, seed: s };
}
