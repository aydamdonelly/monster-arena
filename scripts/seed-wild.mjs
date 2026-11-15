// Wilde Monster anlegen (füllen die Arena auf, wenn zu wenige Eier da sind). Nutzung: node scripts/seed-wild.mjs
// Ausgewählt aus den Testläufen; ohne Foto, ohne die Beispiel-Objekte des Gründers (Capybara, Auto, Roller, Parkautomat).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const PICK = ['Rubber_duck', 'Pizza', 'Cactus', 'Bubble_tea', 'Amanita_muscaria', 'Cavendish_banana', 'Guitar', 'Mug', 'Candle', 'Headphones', 'Watch', 'Sneakers', 'Houseplant', 'Bicycle', 'Umbrella', 'Book', 'Water_bottle', 'Chair'];
const all = ['test-genomes.json', 'test-genomes-2.json'].flatMap((f) => JSON.parse(fs.readFileSync(path.join(root, 'monster-kit', f), 'utf8')));
const rows = [];
for (const title of PICK) {
  const hit = all.find((r) => r.title === title);
  if (hit) rows.push({ title, genome: hit.genome });
}
const out = execFileSync('npx', ['convex', 'run', 'dev:seedWild', JSON.stringify({ rows })], { cwd: root, encoding: 'utf8' });
console.log(`${rows.length} ausgewählt, neu angelegt: ${out.trim()}`);
