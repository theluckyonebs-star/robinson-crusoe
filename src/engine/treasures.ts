// Treasure boxes found on island tiles. Original placeholder content, all
// effects are one-time and applied immediately on USE_TREASURE.

import { nextRandom } from "./rng";
import type { TileTreasure } from "./types";

interface TreasureTemplate {
  templateId: string;
  name: string;
  description: string;
  effect: TileTreasure["effect"];
}

export const TREASURE_TEMPLATES: TreasureTemplate[] = [
  { templateId: "t-supply", name: "Supply Cache", description: "+2 wood.", effect: { kind: "gainResource", resource: "wood", amount: 2 } },
  { templateId: "t-rations", name: "Dried Rations", description: "+2 food.", effect: { kind: "gainResource", resource: "food", amount: 2 } },
  { templateId: "t-oldmap", name: "Old Map", description: "Reveal 2 hidden tiles.", effect: { kind: "revealTile", count: 2 } },
  { templateId: "t-salve", name: "Field Salve", description: "Heal the most-wounded character 2 health.", effect: { kind: "healOne", amount: 2 } },
  { templateId: "t-blade", name: "Improvised Blade", description: "Weapon strength +1.", effect: { kind: "gainWeapon", amount: 1 } },
  { templateId: "t-mirror", name: "Signal Mirror", description: "+1 morale.", effect: { kind: "changeMorale", amount: 1 } },
  { templateId: "t-charm", name: "Lucky Charm", description: "+2 determination (shared out from first player).", effect: { kind: "changeDetermination", amount: 2 } },
  { templateId: "t-bundle", name: "Wrapped Bundle", description: "+1 hide.", effect: { kind: "gainResource", resource: "hide", amount: 1 } },
  { templateId: "t-pelt", name: "Tanned Pelt", description: "+1 fur.", effect: { kind: "gainResource", resource: "fur", amount: 1 } },
];

/**
 * Generate up to `maxCount` treasures for a tile, using the seeded RNG.
 * Returns { treasures, seed }. IDs are unique using tileKey + index.
 */
export function generateTreasures(
  seed: number,
  tileKey: string,
): { treasures: TileTreasure[]; seed: number } {
  // 50% none, 30% one, 15% two, 5% three
  const r1 = nextRandom(seed);
  let count = 0;
  if (r1.value < 0.05) count = 3;
  else if (r1.value < 0.20) count = 2;
  else if (r1.value < 0.50) count = 1;

  const treasures: TileTreasure[] = [];
  let s = r1.seed;
  for (let i = 0; i < count; i++) {
    const r2 = nextRandom(s);
    s = r2.seed;
    const tmpl = TREASURE_TEMPLATES[Math.floor(r2.value * TREASURE_TEMPLATES.length)];
    treasures.push({ id: `${tmpl.templateId}-${tileKey}-${i}`, name: tmpl.name, description: tmpl.description, effect: tmpl.effect, claimed: false });
  }
  return { treasures, seed: s };
}
