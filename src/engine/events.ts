// The Event deck. First card is always the guaranteed opener (beneficial).
// The rest of the deck is shuffled from the main pool, weighted toward threats
// with occasional good events. All original placeholder content.
//
// In enterEvent (phases.ts), the opener is drawn first on round 1;
// subsequent draws come from the shuffled pool.

import type { EventCard } from "./types";

/** Guaranteed first event — always beneficial, eases the opening. */
export const OPENING_EVENT: EventCard = {
  id: "evt-open",
  name: "Safe Landfall",
  story: "The wreck has left you battered but alive. On the shore you find the tide has brought gifts: rope, planks, and sealed containers of rations.",
  immediate: { text: "The beach yields useful salvage.", effect: { kind: "gainResource", resource: "wood", amount: 2 } },
  resolve: {
    text: "Organise the camp and log the supplies carefully.",
    requirement: { pawns: 1 },
    reward: { text: "A careful inventory raises everyone's spirits.", effect: { kind: "changeMorale", amount: 1 } },
  },
  consequence: { text: "Disorganised, you lose half the salvage.", effect: { kind: "loseResource", resource: "wood", amount: 1 } },
};

/**
 * Gentle event pool — drawn for rounds 2 and 3.
 * Consequences are neutral; these ease the player into the game.
 */
export const GENTLE_EVENT_POOL: EventCard[] = [
  {
    id: "evt-calm",
    name: "Calm Waters",
    story: "For once the sea lies flat and the sky stays clear. A rare gift.",
    immediate: { text: "Nothing threatens today.", effect: { kind: "none" } },
    resolve: { text: "Make good use of the quiet to fish.", requirement: { pawns: 1 }, reward: { text: "A full net. A good day.", effect: { kind: "gainResource", resource: "food", amount: 2 } } },
    consequence: { text: "The calm passes without incident.", effect: { kind: "none" } },
  },
  {
    id: "evt-good-fishing",
    name: "Tide Pool",
    story: "The low tide reveals rich tide pools along the shore.",
    immediate: { text: "Easy pickings along the rocks.", effect: { kind: "gainResource", resource: "food", amount: 1 } },
    resolve: { text: "Spend a morning harvesting properly.", requirement: { pawns: 1 }, reward: { text: "More than expected — and some useful material.", effect: { kind: "gainResource", resource: "hide", amount: 1 } } },
    consequence: { text: "The tide comes back in. You keep what you gathered.", effect: { kind: "none" } },
  },
  {
    id: "evt-clear-sky",
    name: "Perfect Morning",
    story: "The kind of morning that makes you briefly forget the situation.",
    immediate: { text: "Clear skies and warm sun lift everyone's mood.", effect: { kind: "changeMorale", amount: 1 } },
    resolve: { text: "Organise the camp while conditions last.", requirement: { pawns: 1 }, reward: { text: "A productive morning of sorting and stockpiling.", effect: { kind: "gainResource", resource: "wood", amount: 1 } } },
    consequence: { text: "The day passes pleasantly. No harm done.", effect: { kind: "none" } },
  },
];

/** Main event pool — shuffled each game. Roughly 75% threatening, 25% beneficial. */
export const EVENT_POOL: EventCard[] = [
  // ---- Threats & disasters ----
  {
    id: "evt-storm",
    name: "Gathering Storm",
    story: "The sky bruises purple to the west and the wind turns cold, carrying the smell of rain in off the sea.",
    immediate: { text: "Dark clouds mass on the horizon.", effect: { kind: "none" } },
    resolve: { text: "Lash the camp down and dig drainage channels.", requirement: { pawns: 1, resources: { wood: 1 } }, reward: { text: "Your preparations hold.", effect: { kind: "changeMorale", amount: 1 } } },
    consequence: { text: "The downpour floods the stores.", effect: { kind: "loseResource", resource: "food", amount: 2 } },
  },
  {
    id: "evt-tremor",
    name: "Tremors",
    story: "A deep groan rolls up through the soles of your feet.",
    immediate: { text: "Part of the woodpile topples.", effect: { kind: "loseResource", resource: "wood", amount: 1 } },
    resolve: { text: "Brace the camp against further quakes.", requirement: { pawns: 1 }, reward: { text: "The work steadies nerves as much as timbers.", effect: { kind: "changeDetermination", amount: 1 } } },
    consequence: { text: "A second stronger quake throws everyone to the ground.", effect: { kind: "loseHealthAll", amount: 1 } },
  },
  {
    id: "evt-beast",
    name: "Prowling Beast",
    story: "At dusk, two eyes glint from the treeline. Something large is patient.",
    immediate: { text: "It watches but does not attack — yet.", effect: { kind: "none" } },
    resolve: { text: "Mount a hunt and drive it off.", requirement: { pawns: 2 }, reward: { text: "You wound it. It flees, leaving a pelt behind.", effect: { kind: "gainResource", resource: "fur", amount: 1 } } },
    consequence: { text: "The beast slips into camp and mauls the weakest.", effect: { kind: "loseHealthOne", amount: 2 } },
  },
  {
    id: "evt-rats",
    name: "Rats!",
    story: "A skitter of claws in the dark — vermin have found your food.",
    immediate: { text: "They get into the stores before anyone notices.", effect: { kind: "loseResource", resource: "food", amount: 1 } },
    resolve: { text: "Set traps and seal the stores in wood.", requirement: { pawns: 1, resources: { wood: 1 } }, reward: { text: "You catch enough to eat and save what's left.", effect: { kind: "gainResource", resource: "food", amount: 1 } } },
    consequence: { text: "The infestation spreads through everything you have.", effect: { kind: "loseResource", resource: "food", amount: 2 } },
  },
  {
    id: "evt-fog",
    name: "Thick Fog",
    story: "A cold grey fog rolls in off the water and swallows the whole island.",
    immediate: { text: "The murk presses down on everyone's spirits.", effect: { kind: "changeMorale", amount: -1 } },
    resolve: { text: "Keep the fire roaring and everyone close.", requirement: { pawns: 1, resources: { wood: 1 } }, reward: { text: "Light and company push back the gloom.", effect: { kind: "changeMorale", amount: 1 } } },
    consequence: { text: "Someone wanders off in the murk and stumbles back hurt.", effect: { kind: "loseHealthOne", amount: 1 } },
  },
  {
    id: "evt-fever",
    name: "Fever",
    story: "One of you wakes burning hot, shivering and slick with sweat.",
    immediate: { text: "The sickness takes hold overnight.", effect: { kind: "loseHealthOne", amount: 1 } },
    resolve: { text: "Brew medicine from bitter island herbs.", requirement: { pawns: 1, resources: { food: 1 } }, reward: { text: "By dawn the fever breaks and spirits rise.", effect: { kind: "changeMorale", amount: 1 } } },
    consequence: { text: "The sickness spreads through the entire camp.", effect: { kind: "loseHealthAll", amount: 1 } },
  },
  {
    id: "evt-despair",
    name: "Creeping Despair",
    story: "No sail. No smoke. Another grey day bleeds into another grey night.",
    immediate: { text: "Doubt gnaws quietly at everyone.", effect: { kind: "changeMorale", amount: -1 } },
    resolve: { text: "Gather round the fire and share stories of home.", requirement: { pawns: 1 }, reward: { text: "For a while, hope feels real again.", effect: { kind: "changeMorale", amount: 2 } } },
    consequence: { text: "Hope drains away entirely.", effect: { kind: "changeMorale", amount: -2 } },
  },
  {
    id: "evt-coldsnap",
    name: "Cold Snap",
    story: "The temperature plunges the moment the sun drops. By dawn, frost rimes every leaf.",
    immediate: { text: "A bitter wind knifes through the camp.", effect: { kind: "none" } },
    resolve: { text: "Stockpile firewood and bank the fire high.", requirement: { pawns: 1, resources: { wood: 1 } }, reward: { text: "Warm and rested, the team takes heart.", effect: { kind: "changeMorale", amount: 1 } } },
    consequence: { text: "You burn through your reserves to survive the night.", effect: { kind: "loseResource", resource: "wood", amount: 2 } },
  },
  {
    id: "evt-wildfire",
    name: "Wildfire",
    story: "A column of smoke rises from the dry brush to the east.",
    immediate: { text: "Embers drift into the camp and set the woodpile alight.", effect: { kind: "loseResource", resource: "wood", amount: 1 } },
    resolve: { text: "Cut firebreaks and dig a defensive perimeter.", requirement: { pawns: 2, resources: { wood: 1 } }, reward: { text: "The camp is spared. Ash makes the soil richer.", effect: { kind: "changeMorale", amount: 1 } } },
    consequence: { text: "The blaze tears through the camp — everyone takes cover but nothing is left undamaged.", effect: { kind: "loseHealthAll", amount: 1 } },
  },
  {
    id: "evt-poison-spring",
    name: "Poisoned Spring",
    story: "The usual water source smells wrong. Something has changed upstream.",
    immediate: { text: "One person drinks without thinking.", effect: { kind: "loseHealthOne", amount: 1 } },
    resolve: { text: "Follow the stream and find the source of contamination.", requirement: { pawns: 1 }, reward: { text: "Clean water flows again, and you found a useful mineral deposit.", effect: { kind: "gainResource", resource: "hide", amount: 1 } } },
    consequence: { text: "With no clean water, thirst and sickness set in.", effect: { kind: "loseHealthAll", amount: 1 } },
  },
  {
    id: "evt-territorial",
    name: "Territorial Birds",
    story: "A flock of large aggressive birds has decided the camp is in their nesting ground.",
    immediate: { text: "They spoil part of the food stores.", effect: { kind: "loseResource", resource: "food", amount: 1 } },
    resolve: { text: "Build scarecrows and smoke them out.", requirement: { pawns: 1, resources: { wood: 1 } }, reward: { text: "They leave. Their abandoned eggs are a bonus.", effect: { kind: "gainResource", resource: "food", amount: 1 } } },
    consequence: { text: "The birds continue to harass and deplete your stores.", effect: { kind: "loseResource", resource: "food", amount: 1 } },
  },
  {
    id: "evt-rockfall",
    name: "Rockfall",
    story: "A crack from the hillside, then a rumble. The upper camp scatter.",
    immediate: { text: "A boulder grazes the work area.", effect: { kind: "loseHealthOne", amount: 1 } },
    resolve: { text: "Clear the debris and shore up the slope.", requirement: { pawns: 2, resources: { wood: 1 } }, reward: { text: "The slope is stabilised and yields useful stone.", effect: { kind: "changeDetermination", amount: 1 } } },
    consequence: { text: "The path to the upper gathering grounds is now blocked.", effect: { kind: "changeMorale", amount: -1 } },
  },
  {
    id: "evt-early-winter",
    name: "Early Winter",
    story: "The season turns two weeks earlier than anyone expected. Ice forms on the tidepools.",
    immediate: { text: "The cold arrives without warning.", effect: { kind: "extraWeatherDie", die: "snow" } },
    resolve: { text: "Insulate the camp with hide and straw.", requirement: { pawns: 1, resources: { hide: 1 } }, reward: { text: "The camp is protected for the season ahead.", effect: { kind: "changeMorale", amount: 1 } } },
    consequence: { text: "Caught unprepared, the frost bites deep.", effect: { kind: "loseHealthAll", amount: 1 } },
  },
  {
    id: "evt-plague",
    name: "Plague of Flies",
    story: "A cloud of biting insects descends on the camp from the swamp.",
    immediate: { text: "The swarm drives everyone from their work.", effect: { kind: "changeMorale", amount: -1 } },
    resolve: { text: "Smoke them out with burning herbs.", requirement: { pawns: 1, resources: { wood: 1 } }, reward: { text: "Clean air restores focus.", effect: { kind: "changeDetermination", amount: 1 } } },
    consequence: { text: "Bites and welts bring a creeping fever through the camp.", effect: { kind: "loseHealthAll", amount: 1 } },
  },
  {
    id: "evt-resource-depletion",
    name: "Overuse",
    story: "One area of the island has been stripped bare. The land needs rest you cannot afford to give it.",
    immediate: { text: "The nearest source runs dry.", effect: { kind: "depleteTile" } },
    resolve: { text: "Explore a new area and rotate gathering sites.", requirement: { pawns: 1 }, reward: { text: "Fresh land, fresh hope.", effect: { kind: "changeMorale", amount: 1 } } },
    consequence: { text: "The depletion spreads to another source.", effect: { kind: "depleteTile" } },
  },
  {
    id: "evt-skip-prod",
    name: "Drought",
    story: "The wells run dry and the soil cracks. Nothing grows and nothing can be harvested.",
    immediate: { text: "This round's production is lost.", effect: { kind: "skipProduction" } },
    resolve: { text: "Find alternate sources and conserve carefully.", requirement: { pawns: 1 }, reward: { text: "You manage to recover half the expected yield.", effect: { kind: "gainResource", resource: "food", amount: 1 } } },
    consequence: { text: "The drought drags on. Next round's production is lost too.", effect: { kind: "skipProduction" } },
  },
  // ---- Animal events (semi-rare, use palisade to defend) ----
  {
    id: "evt-prowler",
    name: "Prowling Predator",
    story: "Something large has been circling the camp at night, testing the perimeter. Heavy tracks in the morning mud.",
    immediate: { text: "It watches but does not attack — yet.", effect: { kind: "none" } },
    resolve: { text: "Drive it off with torches and noise.", requirement: { pawns: 2 }, reward: { text: "It retreats. You find a food cache it left behind.", effect: { kind: "gainResource", resource: "food", amount: 1 } } },
    consequence: { text: "The predator charges the camp.", effect: { kind: "palisadeDefend", requiredLevel: 2, fallbackEffect: { kind: "loseHealthAll", amount: 1 } } },
  },
  {
    id: "evt-pack",
    name: "Scavenger Pack",
    story: "A dozen lean animals. They have found the smell of the camp and are moving in cautiously.",
    immediate: { text: "They raid the outer edge of camp first.", effect: { kind: "loseResource", resource: "food", amount: 1 } },
    resolve: { text: "Reinforce the perimeter and set torches.", requirement: { pawns: 1, resources: { wood: 1 } }, reward: { text: "The pack scatters.", effect: { kind: "changeMorale", amount: 1 } } },
    consequence: { text: "The pack breaks through.", effect: { kind: "palisadeDefend", requiredLevel: 1, fallbackEffect: { kind: "loseHealthOne", amount: 2 } } },
  },
  {
    id: "evt-territorial",
    name: "Territorial Beast",
    story: "A powerful animal has decided this is its territory. It is not going to share without a fight.",
    immediate: { text: "It charges the camp and injures someone before being driven back.", effect: { kind: "loseHealthOne", amount: 1 } },
    resolve: { text: "Mount a hunting party and drive it from the area.", requirement: { pawns: 2 }, reward: { text: "You wound it badly. It will not return.", effect: { kind: "changeMorale", amount: 1 } } },
    consequence: { text: "The beast charges again tonight.", effect: { kind: "palisadeDefend", requiredLevel: 2, fallbackEffect: { kind: "loseHealthAll", amount: 1 } } },
  },
  {
    id: "evt-nightstalker",
    name: "Night Stalker",
    story: "Something slips into camp after dark, moving through the shadows. No one sees it, but things go missing.",
    immediate: { text: "Food stores are raided in the dark.", effect: { kind: "loseResource", resource: "food", amount: 1 } },
    resolve: { text: "Set watch and traps around camp.", requirement: { pawns: 1 }, reward: { text: "You catch it — useful hides.", effect: { kind: "gainResource", resource: "hide", amount: 1 } } },
    consequence: { text: "It returns for a second raid, this time drawing blood.", effect: { kind: "palisadeDefend", requiredLevel: 1, fallbackEffect: { kind: "loseHealthOne", amount: 2 } } },
  },
  // ---- Storm-triggering events ----
  {
    id: "evt-gale",
    name: "Building Gale",
    story: "The barometer is plunging. A serious storm is brewing off the coast and it will hit tonight.",
    immediate: { text: "A storm is coming. A storm die will be rolled tonight.", effect: { kind: "extraWeatherDie", die: "storm" } },
    resolve: { text: "Shore up the camp and lash everything down.", requirement: { pawns: 2, resources: { wood: 1 } }, reward: { text: "Good preparation turns the storm into a minor inconvenience.", effect: { kind: "changeMorale", amount: 1 } } },
    consequence: { text: "The unmitigated storm intensifies — roll an extra rain die too.", effect: { kind: "extraWeatherDie", die: "rain" } },
  },
  {
    id: "evt-hurricane-warning",
    name: "Hurricane Season",
    story: "The old signs are all there — circling birds, a reddish sky at dawn, an ominous stillness.",
    immediate: { text: "A hurricane-force storm will roll through tonight.", effect: { kind: "extraWeatherDie", die: "storm" } },
    resolve: { text: "Dig in deep and waterproof every seam.", requirement: { pawns: 2 }, reward: { text: "Your preparation pays off — and you found useful timber in the bracing.", effect: { kind: "gainResource", resource: "wood", amount: 1 } } },
    consequence: { text: "You weather the storm, but supplies are scattered.", effect: { kind: "loseResource", resource: "wood", amount: 1 } },
  },
  // ---- Beneficial events (occasional good news) ----
  {
    id: "evt-cache",
    name: "Castaway's Cache",
    story: "Half-buried in the wet sand sits a waterlogged crate, washed up from some long-lost ship.",
    immediate: { text: "Inside: sealed tins of food, somehow still good.", effect: { kind: "gainResource", resource: "food", amount: 2 } },
    resolve: { text: "Break down the crate and salvage it before the tide turns.", requirement: { pawns: 1 }, reward: { text: "Its planks make fine, dry timber.", effect: { kind: "gainResource", resource: "wood", amount: 2 } } },
    consequence: { text: "The tide takes the rest back out to sea.", effect: { kind: "none" } },
  },
  {
    id: "evt-driftwood",
    name: "Driftwood",
    story: "The morning tide leaves a tangle of pale, salt-bleached timber strewn along the shoreline.",
    immediate: { text: "You gather an armful of usable wood.", effect: { kind: "gainResource", resource: "wood", amount: 2 } },
    resolve: { text: "Haul the whole lot up the beach before noon.", requirement: { pawns: 1 }, reward: { text: "A solid haul of seasoned timber.", effect: { kind: "gainResource", resource: "wood", amount: 1 } } },
    consequence: { text: "The next tide reclaims what you left behind.", effect: { kind: "none" } },
  },
  {
    id: "evt-spring",
    name: "Fresh Spring",
    story: "Following a faint trickle uphill, you find a clear pool bubbling straight out of the rock.",
    immediate: { text: "Clean water, and roots growing thick around it.", effect: { kind: "gainResource", resource: "food", amount: 1 } },
    resolve: { text: "Haul water back and cache it in camp.", requirement: { pawns: 1 }, reward: { text: "A reserve against the dry days ahead.", effect: { kind: "gainResource", resource: "food", amount: 1 } } },
    consequence: { text: "Untended, the channel chokes with mud and dries up.", effect: { kind: "none" } },
  },
  {
    id: "evt-signal",
    name: "A Light on the Water",
    story: "Far out past the reef, a flicker in the dark — a ship's lantern?",
    immediate: { text: "The mere possibility of rescue lifts every heart.", effect: { kind: "changeMorale", amount: 1 } },
    resolve: { text: "Build a towering signal pyre on the headland.", requirement: { pawns: 2, resources: { wood: 2 } }, reward: { text: "It blazes against the night. They might come.", effect: { kind: "changeMorale", amount: 2 } } },
    consequence: { text: "The light fades, and with it the hope it carried.", effect: { kind: "none" } },
  },
];

// The full deck used by setup: opener first, then the shuffled pool.
export const EVENT_DECK = [OPENING_EVENT, ...EVENT_POOL];
