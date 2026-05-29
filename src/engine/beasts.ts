// Beast deck with unique icons per beast. Original placeholder content.

import type { Beast } from "./types";

export const BEAST_DECK: (Beast & { icon: string })[] = [
  { id: "beast-boar",   name: "Wild Boar",      icon: "🐗", strength: 2, weaponDull: 1, food: 2, leather: 1 },
  { id: "beast-goat",   name: "Mountain Goat",  icon: "🐐", strength: 1, weaponDull: 0, food: 1, leather: 1 },
  { id: "beast-wolf",   name: "Lean Wolf",       icon: "🐺", strength: 4, weaponDull: 2, food: 1, leather: 2 },
  { id: "beast-turtle", name: "Giant Turtle",    icon: "🐢", strength: 3, weaponDull: 1, food: 3, leather: 1 },
  { id: "beast-cat",    name: "Island Wildcat",  icon: "🦁", strength: 5, weaponDull: 3, food: 2, leather: 3 },
  { id: "beast-stag",   name: "Great Stag",      icon: "🦌", strength: 3, weaponDull: 1, food: 3, leather: 2 },
];
