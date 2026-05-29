// Adventure ("chance") cards — 20 per deck (60 total).
// Varied effects: resource loss/gain, depletion, cross-phase effects,
// item-mitigated damage, choice-style good-now/bad-later, morale, health.
// All original placeholder content.

import type { AdventureCard } from "./types";

export const ADVENTURE_DECKS: Record<string, AdventureCard[]> = {

  // ---- GATHER deck (20 cards) ---- ~50% minor-neg, 25% serious, 25% positive

  gather: [
    // Minor negative
    {
      id: "adv-g-thorn", deck: "gather", title: "Thorn Scratch",
      text: "Reaching for berries, you tear your arm on the brambles.",
      effect: { kind: "loseHealthOne", amount: 1 },
      followup: { text: "The scratch festers into a nasty infection.", effect: { kind: "loseHealthOne", amount: 3 }, mitigable: true },
    },
    {
      id: "adv-g-slip", deck: "gather", title: "Slip on the Rocks",
      text: "Wet stone gives way underfoot.",
      effect: { kind: "loseHealthOne", amount: 1 },
      followup: { text: "The twisted ankle swells badly overnight.", effect: { kind: "loseHealthOne", amount: 2 }, mitigable: true },
    },
    {
      id: "adv-g-spoiled", deck: "gather", title: "Spoiled Find",
      text: "Half of what you gathered is already rotten.",
      effect: { kind: "loseResource", resource: "food", amount: 1 },
    },
    {
      id: "adv-g-gloom", deck: "gather", title: "Gloomy Toil",
      text: "Endless picking in the cold wears on you.",
      effect: { kind: "changeMorale", amount: -1 },
    },
    {
      id: "adv-g-bee", deck: "gather", title: "Beehive",
      text: "You disturb a nest. The swarm descends.",
      effect: { kind: "loseHealthOne", amount: 1 },
      effectMitigatedBy: "healerkit",
    },
    {
      id: "adv-g-mudslide", deck: "gather", title: "Mudslide",
      text: "The riverbank collapses, burying the work area.",
      effect: { kind: "loseHealthAll", amount: 1 },
      followup: { text: "The blockage cuts off tomorrow's production.", effect: { kind: "skipProduction" } },
    },
    {
      id: "adv-g-depletion", deck: "gather", title: "Stripped Bare",
      text: "The area has been over-harvested — nothing left to take.",
      effect: { kind: "depleteTile" },
    },
    {
      id: "adv-g-storm-warn", deck: "gather", title: "Ominous Clouds",
      text: "Storm clouds are building on the horizon. Tonight will be rough.",
      effect: { kind: "none" },
      followup: { text: "The storm breaks — an extra rain die rolls tonight.", effect: { kind: "extraWeatherDie", die: "rain" } },
    },
    {
      id: "adv-g-animal-tracks", deck: "gather", title: "Animal Tracks",
      text: "Something large has been through here recently. Nothing attacks — yet.",
      effect: { kind: "none" },
      followup: { text: "The predator returns and attacks the weakest.", effect: { kind: "loseHealthOne", amount: 2 } },
    },
    {
      id: "adv-g-earthquake", deck: "gather", title: "Minor Tremor",
      text: "The ground shudders. Everyone grabs a tree and waits.",
      effect: { kind: "loseHealthAll", amount: 1 },
    },
    // Serious negative
    {
      id: "adv-g-badwater", deck: "gather", title: "Tainted Water",
      text: "Someone drinks from a foul pool.",
      effect: { kind: "loseHealthOne", amount: 3 },
    },
    {
      id: "adv-g-collapse", deck: "gather", title: "Ground Collapse",
      text: "The bank gives way, pulling everyone down with it.",
      effect: { kind: "loseHealthAll", amount: 1 },
      followup: { text: "The collapse also ruins tomorrow's production access.", effect: { kind: "skipProduction" } },
    },
    {
      id: "adv-g-skip-prod", deck: "gather", title: "Root Blight",
      text: "The gather area is blighted — crops and roots are dead for the season.",
      effect: { kind: "skipProduction" },
    },
    // Positive
    {
      id: "adv-g-cache", deck: "gather", title: "Hidden Bounty",
      text: "Beneath the brush, more than you hoped for.",
      effect: { kind: "gainResource", resource: "food", amount: 1 },
    },
    {
      id: "adv-g-haul", deck: "gather", title: "Good Haul",
      text: "The pickings are unusually rich today.",
      effect: { kind: "gainResource", resource: "wood", amount: 1 },
    },
    {
      id: "adv-g-honey", deck: "gather", title: "Wild Honey",
      text: "A high branch hides a large comb. Sweet and plentiful.",
      effect: { kind: "gainResource", resource: "food", amount: 2 },
      followup: { text: "The bees return for revenge.", effect: { kind: "loseHealthOne", amount: 1 } },
    },
    {
      id: "adv-g-luck", deck: "gather", title: "Lucky Break",
      text: "You stumble across a narrow gap in the rock — and a cache inside.",
      effect: { kind: "changeDetermination", amount: 1 },
    },
    {
      id: "adv-g-hide", deck: "gather", title: "Careful Forager",
      text: "Working methodically, you recover useful animal remnants alongside the food.",
      effect: { kind: "gainResource", resource: "hide", amount: 1 },
    },
    {
      id: "adv-g-strange-fruit", deck: "gather", title: "Strange Fruit",
      text: "Bright red berries, plentiful and tempting. You eat them — probably fine.",
      effect: { kind: "gainResource", resource: "food", amount: 2 },
      followup: { text: "They were not fine. The poison hits overnight.", effect: { kind: "loseHealthOne", amount: 2 }, mitigable: true },
    },
    {
      id: "adv-g-reroll", deck: "gather", title: "Second Chance",
      text: "You spot a better route at the last moment.",
      effect: { kind: "grantReroll", actionFamily: "gather" },
    },
  ],

  // ---- EXPLORE deck (20 cards) ----

  explore: [
    // Minor negative
    {
      id: "adv-e-footing", deck: "explore", title: "Treacherous Footing",
      text: "Loose scree gives way and you take a tumble.",
      effect: { kind: "loseHealthOne", amount: 1 },
      followup: { text: "The gash turns septic in the humid jungle.", effect: { kind: "loseHealthOne", amount: 3 }, mitigable: true },
    },
    {
      id: "adv-e-swarm", deck: "explore", title: "Insect Swarm",
      text: "A cloud of biting flies descends without warning.",
      effect: { kind: "loseHealthOne", amount: 1 },
      followup: { text: "The bites swell and bring fever to the whole camp.", effect: { kind: "loseHealthAll", amount: 1 }, mitigable: true },
    },
    {
      id: "adv-e-lost", deck: "explore", title: "Lost Bearings",
      text: "Hours wasted finding your way back.",
      effect: { kind: "changeDetermination", amount: -1 },
    },
    {
      id: "adv-e-squall", deck: "explore", title: "Sudden Squall",
      text: "A downpour scatters the kit you were carrying.",
      effect: { kind: "loseResource", resource: "wood", amount: 1 },
    },
    {
      id: "adv-e-ghost-noise", deck: "explore", title: "Ghost Noise",
      text: "Howling from deep in the jungle keeps the whole camp awake.",
      effect: { kind: "changeMorale", amount: -1 },
      followup: { text: "Sleeplessness drains the team's resolve.", effect: { kind: "changeDetermination", amount: -1 } },
    },
    {
      id: "adv-e-unstable", deck: "explore", title: "Unstable Ground",
      text: "The area is riddled with sinkholes — nothing safe to gather here.",
      effect: { kind: "depleteTile" },
    },
    {
      id: "adv-e-predator", deck: "explore", title: "Predator Territory",
      text: "Deep scratch-marks on the trees warn you away. You back off — for now.",
      effect: { kind: "none" },
      followup: { text: "The predator tracks you back to camp and attacks.", effect: { kind: "loseHealthOne", amount: 2 } },
    },
    {
      id: "adv-e-rockslide", deck: "explore", title: "Impending Rockslide",
      text: "Cracks appear in the cliff above. You clear out, but the stress leaves everyone shaken.",
      effect: { kind: "none" },
      followup: { text: "The cliff face comes down overnight.", effect: { kind: "loseHealthAll", amount: 1 } },
    },
    {
      id: "adv-e-bog-fire", deck: "explore", title: "Bog Fire",
      text: "Methane from the swamp ignites. You escape, but the night air is thick and hot.",
      effect: { kind: "extraWeatherDie", die: "rain" },
    },
    {
      id: "adv-e-flooded", deck: "explore", title: "Flooded Path",
      text: "The route is underwater. You push through but take a battering.",
      effect: { kind: "loseHealthOne", amount: 1 },
      followup: { text: "Soaked through, spirits sink.", effect: { kind: "changeMorale", amount: -1 } },
    },
    // Serious negative
    {
      id: "adv-e-cliff", deck: "explore", title: "Cliff Fall",
      text: "A handhold crumbles over a very long drop.",
      effect: { kind: "loseHealthOne", amount: 3 },
    },
    {
      id: "adv-e-quagmire", deck: "explore", title: "Quagmire",
      text: "The whole party flounders in sucking mud.",
      effect: { kind: "loseHealthAll", amount: 1 },
    },
    {
      id: "adv-e-tropical-fever", deck: "explore", title: "Tropical Fever",
      text: "The jungle heat brings on a sudden debilitating fever.",
      effect: { kind: "loseHealthOne", amount: 1 },
      effectMitigatedBy: "healerkit",
      followup: { text: "The fever worsens dangerously.", effect: { kind: "loseHealthOne", amount: 3 }, mitigable: true },
    },
    // Positive
    {
      id: "adv-e-vista", deck: "explore", title: "Sweeping Vista",
      text: "From a rise, the land lays itself bare — heartening.",
      effect: { kind: "changeMorale", amount: 1 },
    },
    {
      id: "adv-e-oldcache", deck: "explore", title: "Old Campsite",
      text: "Someone was here before you, and left useful things.",
      effect: { kind: "gainResource", resource: "wood", amount: 1 },
    },
    {
      id: "adv-e-ruins", deck: "explore", title: "Ancient Ruins",
      text: "Crumbling walls hide a sealed chamber with preserved supplies.",
      effect: { kind: "gainResource", resource: "food", amount: 2 },
      followup: { text: "Disturbing the ruins releases a cloud of spores.", effect: { kind: "loseHealthAll", amount: 1 } },
    },
    {
      id: "adv-e-buried", deck: "explore", title: "Buried Supply",
      text: "A waterproof oilskin bundle hidden under a cairn — rare materials inside.",
      effect: { kind: "gainResource", resource: "hide", amount: 1 },
    },
    {
      id: "adv-e-herbs", deck: "explore", title: "Rare Herbs",
      text: "Medicinal plants, usable both to heal and to cook.",
      effect: { kind: "changeMorale", amount: 1 },
      followup: { text: "The herbs prove even more valuable — treated as medicine.", effect: { kind: "healOne", amount: 1 } },
    },
    {
      id: "adv-e-carvings", deck: "explore", title: "Strange Carvings",
      text: "Symbols in the rock — someone survived here before. It gives you hope.",
      effect: { kind: "changeDetermination", amount: 1 },
    },
    {
      id: "adv-e-reroll", deck: "explore", title: "Better Route",
      text: "You spot a safer path just in time.",
      effect: { kind: "grantReroll", actionFamily: "explore" },
    },
  ],

  // ---- BUILD deck (20 cards) ----

  build: [
    // Minor negative
    {
      id: "adv-b-splinter", deck: "build", title: "Splinter",
      text: "A stubborn plank drives a sliver deep into your palm.",
      effect: { kind: "loseHealthOne", amount: 1 },
      followup: { text: "The splinter wound goes bad.", effect: { kind: "loseHealthOne", amount: 3 }, mitigable: true },
    },
    {
      id: "adv-b-strain", deck: "build", title: "Strained Back",
      text: "Lifting a heavy beam, something pulls.",
      effect: { kind: "loseHealthOne", amount: 1 },
      followup: { text: "Your back gives out entirely, slowing future build work.", effect: { kind: "loseHealthOne", amount: 2 }, mitigable: true },
    },
    {
      id: "adv-b-waste", deck: "build", title: "Wasted Materials",
      text: "A miscut ruins a good plank. The waste is painful.",
      effect: { kind: "loseResource", resource: "wood", amount: 1 },
    },
    {
      id: "adv-b-frustration", deck: "build", title: "Frustration",
      text: "Nothing fits; tempers fray.",
      effect: { kind: "changeMorale", amount: -1 },
    },
    {
      id: "adv-b-fire-hazard", deck: "build", title: "Fire Hazard",
      text: "Sparks from the work catch dry brush nearby. A small blaze erupts.",
      effect: { kind: "loseResource", resource: "wood", amount: 1 },
      effectMitigatedBy: "firepit",
    },
    {
      id: "adv-b-termites", deck: "build", title: "Termite Damage",
      text: "You discover the timber is infested. Half the pile is compromised.",
      effect: { kind: "depleteTile" },
    },
    {
      id: "adv-b-design-flaw", deck: "build", title: "Design Flaw",
      text: "The structure seems sound — but a flaw you missed will make things worse later.",
      effect: { kind: "none" },
      followup: { text: "The flaw creates a dangerous weak point — tonight's weather is worse.", effect: { kind: "extraWeatherDie", die: "rain" } },
    },
    {
      id: "adv-b-scaffolding", deck: "build", title: "Scaffold Collapse",
      text: "The half-built frame comes down hard on the work party.",
      effect: { kind: "loseHealthAll", amount: 1 },
    },
    {
      id: "adv-b-structural", deck: "build", title: "Structural Failure",
      text: "The support gives way — the build is wasted and the site needs clearing.",
      effect: { kind: "loseResource", resource: "wood", amount: 2 },
      followup: { text: "The clearing blocks tomorrow's production access.", effect: { kind: "skipProduction" } },
    },
    {
      id: "adv-b-cold-snap", deck: "build", title: "Cold Front",
      text: "A sudden cold front moves in while you're working. Tonight will be bitter.",
      effect: { kind: "extraWeatherDie", die: "snow" },
    },
    // Serious negative
    {
      id: "adv-b-crush", deck: "build", title: "Crushed Hand",
      text: "A dropped log catches someone badly.",
      effect: { kind: "loseHealthOne", amount: 3 },
    },
    {
      id: "adv-b-cave-in", deck: "build", title: "Cave-In",
      text: "The ground gives way beneath the build site.",
      effect: { kind: "loseHealthAll", amount: 1 },
      followup: { text: "The dig-out takes all of tomorrow's energy — no production.", effect: { kind: "skipProduction" } },
    },
    {
      id: "adv-b-wasted-day", deck: "build", title: "Wasted Day",
      text: "The work falls apart completely. The whole effort was for nothing.",
      effect: { kind: "loseResource", resource: "wood", amount: 2 },
    },
    // Positive
    {
      id: "adv-b-honest", deck: "build", title: "Honest Work",
      text: "There is comfort in raising something solid.",
      effect: { kind: "changeMorale", amount: 1 },
    },
    {
      id: "adv-b-joinery", deck: "build", title: "Clever Joinery",
      text: "A trick of carpentry saves materials.",
      effect: { kind: "gainResource", resource: "wood", amount: 1 },
    },
    {
      id: "adv-b-breakthrough", deck: "build", title: "Engineering Breakthrough",
      text: "You figure out a better weapon-making technique mid-build.",
      effect: { kind: "gainWeapon", amount: 1 },
    },
    {
      id: "adv-b-cache", deck: "build", title: "Supply Find",
      text: "Digging the foundation, you find a useful cache.",
      effect: { kind: "gainResource", resource: "wood", amount: 2 },
    },
    {
      id: "adv-b-hide", deck: "build", title: "Salvaged Materials",
      text: "Stripping the old structure yields usable hide.",
      effect: { kind: "gainResource", resource: "hide", amount: 1 },
    },
    {
      id: "adv-b-inspired", deck: "build", title: "Inspired Design",
      text: "A flash of ingenuity simplifies the work entirely.",
      effect: { kind: "changeMorale", amount: 1 },
      followup: { text: "The improved design also improves the camp's resilience.", effect: { kind: "changeDetermination", amount: 1 } },
    },
    {
      id: "adv-b-reroll", deck: "build", title: "Second Attempt",
      text: "You spot a better approach before committing.",
      effect: { kind: "grantReroll", actionFamily: "build" },
    },
  ],
};
