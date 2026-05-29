// Beast deck. New model: strength (wounds you take = max(0, strength-weapon)),
// weaponDull (reduces weaponLevel permanently after combat),
// food and leather rewards. Original placeholder content.

import type { Beast } from "./types";

export const BEAST_DECK: Beast[] = [
  { id: "beast-boar",   name: "Wild Boar",       strength: 2, weaponDull: 1, food: 2, leather: 1 },
  { id: "beast-goat",   name: "Mountain Goat",   strength: 1, weaponDull: 0, food: 1, leather: 1 },
  { id: "beast-wolf",   name: "Lean Wolf",        strength: 4, weaponDull: 2, food: 1, leather: 2 },
  { id: "beast-turtle", name: "Giant Turtle",     strength: 3, weaponDull: 1, food: 3, leather: 1 },
  { id: "beast-cat",    name: "Island Wildcat",   strength: 5, weaponDull: 3, food: 2, leather: 3 },
  { id: "beast-stag",   name: "Great Stag",       strength: 3, weaponDull: 1, food: 3, leather: 2 },
];
