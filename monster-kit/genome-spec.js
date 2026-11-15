// Foto -> Monster-Genom: JSON-Schema und Prompt für die OpenAI Responses API (strict json_schema).
// Wird von scripts/genome-test.mjs und der Convex-Action benutzt. Keine Abhängigkeiten.

export const SHAPES = ['blob', 'egg', 'drop', 'cylinder', 'box', 'cactus', 'strawberry', 'bean'];
export const PART_TYPES = ['handle', 'coffee', 'steam', 'straw', 'cap', 'stem', 'leafCrown', 'flower', 'seeds', 'spots', 'spikes', 'screen', 'headphones', 'beak', 'ears', 'horns', 'antenna', 'wings', 'tail'];
export const ELEMENTS = ['fire', 'water', 'plant', 'metal', 'fluff', 'spirit'];
export const MOVE_KINDS = ['melee', 'shot', 'beam', 'burst', 'dash'];
const MOVE = { type: 'object', additionalProperties: false, required: ['name', 'kind', 'element'], properties: { name: { type: 'string' }, kind: { type: 'string', enum: MOVE_KINDS }, element: { type: 'string', enum: ELEMENTS } } };

export const GENOME_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['object', 'safe', 'matchesPrompt', 'name', 'lore', 'element', 'shape', 'proportions', 'colors', 'eyes', 'mouth', 'limbStyle', 'pose', 'parts', 'traits', 'move1', 'move2'],
  properties: {
    object: { type: 'string' },
    safe: { type: 'boolean' },
    matchesPrompt: { type: 'number' },
    name: { type: 'string' },
    lore: { type: 'string' },
    element: { type: 'string', enum: ELEMENTS },
    shape: { type: 'string', enum: SHAPES },
    proportions: { type: 'string', enum: ['normal', 'tall', 'wide'] },
    colors: { type: 'object', additionalProperties: false, required: ['body', 'accent'], properties: { body: { type: 'string' }, accent: { type: 'string' } } },
    eyes: { type: 'string', enum: ['dot', 'happy', 'wink', 'big'] },
    mouth: { type: 'string', enum: ['smile', 'open', 'fang', 'o'] },
    limbStyle: { type: 'string', enum: ['stick', 'stub'] },
    pose: { type: 'string', enum: ['cheer', 'wave', 'rest'] },
    parts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['type', 'color'], properties: { type: { type: 'string', enum: PART_TYPES }, color: { type: 'string' } } } },
    move1: MOVE,
    move2: MOVE,
    traits: { type: 'object', additionalProperties: false, required: ['hard', 'sharp', 'fast', 'big', 'soft'], properties: { hard: { type: 'number' }, sharp: { type: 'number' }, fast: { type: 'number' }, big: { type: 'number' }, soft: { type: 'number' } } },
  },
};

/** @param {string} [dropPrompt] */
export function genomeInstructions(dropPrompt = 'anything') {
  return `You turn a real-world photo into a cute low-poly kawaii monster for a daily photo game.
Look at the MAIN object in the photo. The monster must be instantly recognizable as that object.
- object: short description of the main object.
- shape: the body silhouette closest to the object.
  cylinder = mugs, cups, cans, bottles, jars, candles, trash cans. box = phones, laptops, tablets, books, boxes, toasters, speakers, keyboards, shoes, bags.
  bean = bananas, chili peppers, carrots, cucumbers, hot dogs, croissants and other long curved things.
  strawberry = strawberries, raspberries, hearts, pointy-bottom fruit. drop = liquids, water drops, flames, onions, garlic, teardrop shapes.
  egg = eggs, avocados, potatoes, rubber ducks, birds, plush toys, round animals, computer mice. cactus = cacti, tall rounded plants, pickles. blob = everything else round.
- proportions: tall for bottles, phones, cans, vases, thin standing things; wide for laptops, keyboards, sofas, cars, flat wide things; normal otherwise.
- colors.body / colors.accent: the object's OWN dominant colors as hex (#rrggbb), true to the photo and slightly brighter. Ignore the background, the table, hands and shadows.
- parts: 1 to 3 features that make the object recognizable, most distinctive first. Menu:
  handle (mugs, cups, kettles, bags, suitcases), coffee (visible drink surface in an open cup), steam (hot drinks and hot food), straw (iced drinks, boba, juice boxes),
  cap (bottle caps, pen caps, jar lids), stem (apples, cherries, pears, bananas, chilis), leafCrown (pineapples, strawberries, carrots, potted plants), flower (flowers, flowering plants),
  seeds (strawberries, kiwis, sesame buns), spots (mushrooms, ladybugs, cookies, pizza toppings, dice, cows), spikes (cacti, hedgehogs, studs, sharp things),
  screen (phones, laptops, tablets, monitors, TVs, consoles, calculators: the face appears on the screen), headphones (headphones, earmuffs), beak (ducks, birds, chicks, penguins),
  ears (cats, bears, bunnies, plush animals), horns (bulls, devils, spicy things), antenna (radios, robots, gadgets, insects), wings (birds, insects, planes, anything that flies), tail (animals, cables, plugs).
  Give each part a hex color taken from the photo.
- eyes: dot (calm, cute), happy (cheerful), wink (cheeky), big (curious, tiny things). mouth: smile, open (excited), fang (tough, spicy, sharp), o (surprised). Match the object's personality and vary them.
- limbStyle: stick for slim, light, fast or electronic objects; stub for round, heavy or soft objects. pose: cheer (energetic), wave (friendly), rest (lazy or heavy).
- name: a punny 1-2 word monster name mixing the object and a monster word (e.g. "Mugzilla", "Bananaconda"). Vary the monster word. lore: one short funny sentence about its origin.
- element: fire (red, hot, spicy), water (blue, liquid, glass, drinks), plant (green, natural, fruit, veggies), metal (electronics, metal, hard tools), fluff (soft, fabric, plush), spirit (old, strange, sentimental).
- traits: numbers from 0 to 1 for hard, sharp, fast, big, soft, judged from the real object.
- move1 (basic attack) and move2 (special attack): two unique attacks that only THIS object could have. name: punchy, 1 to 3 words, a pun on what the object does (mug: "Espresso Splash" and "Handle Hook"; banana: "Peel Slip" and "Potassium Beam"; laptop: "Ctrl Alt Delete" and "Blue Screen").
  kind: melee (hits, bites, slaps at close range), shot (throws or spits one projectile), beam (laser, ray or stream in a long line), burst (explosion, splash or shockwave around itself), dash (charges or leaps at the target). move1 and move2 must have different kinds. Use the full variety: shot, beam and dash are as welcome as melee and burst; let the name decide (a "Beam" or "Ray" is a beam, a "Splash" or "Pop" is a burst, a "Spit" or "Toss" is a shot, a "Slide" or "Rush" is a dash).
  element: usually the monster's own element; the special may use another fitting element.
- safe: false if the photo mainly shows a human person or face, nudity, weapons, drugs or anything inappropriate; otherwise true.
- matchesPrompt: 0 to 1, how well the object fits today's drop task: "${dropPrompt}".`;
}

// KI-Antwort (GENOME_SCHEMA) -> Genom für buildMonster(). seed: Zahl, z. B. hashString(storageId)
/** @param {any} ai @param {number} seed @returns {any} */
export function genomeFromAI(ai, seed) {
  return {
    name: ai.name, seed, element: ai.element, lore: ai.lore, object: ai.object, traits: ai.traits,
    body: { shape: ai.shape, color: ai.colors?.body, proportions: ai.proportions || 'normal' },
    face: { eyes: ai.eyes, mouth: ai.mouth },
    limbs: { style: ai.limbStyle, pose: ai.pose },
    parts: (ai.parts || []).slice(0, 3),
    moves: [ai.move1, ai.move2].filter(Boolean),
  };
}
