// Test 2: Foto -> Monster-Genom über die OpenAI Responses API.
// Nutzung: node scripts/genome-test.mjs [Wikipedia-Titel ...]  (Key aus $OPENAI_API_KEY oder ~/.config/yc-hack/secrets.env)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GENOME_SCHEMA, genomeInstructions } from '../monster-kit/genome-spec.js';

const MODEL = process.env.GENOME_MODEL || 'gpt-6-luna';
const DROP_PROMPT = process.env.DROP_PROMPT || 'something red';

function apiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const f = path.join(os.homedir(), '.config/yc-hack/secrets.env');
  const line = fs.readFileSync(f, 'utf8').split('\n').find((l) => l.startsWith('OPENAI_API_KEY='));
  return line.slice('OPENAI_API_KEY='.length).replace(/^'|'$/g, '');
}

export async function genomeFromImage(imageUrl, key = apiKey(), dropPrompt = DROP_PROMPT) {
  const t0 = Date.now();
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      input: [{ role: 'user', content: [{ type: 'input_text', text: genomeInstructions(dropPrompt) }, { type: 'input_image', image_url: imageUrl }] }],
      text: { format: { type: 'json_schema', name: 'monster_genome', schema: GENOME_SCHEMA, strict: true } },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body.error || body).slice(0, 300)}`);
  const text = body.output_text ?? body.output?.flatMap((o) => o.content || []).find((c) => c.type === 'output_text')?.text;
  return { genome: JSON.parse(text), ms: Date.now() - t0 };
}

// --- Testlauf mit Bildern aus Wikipedia: typische Hackathon-Objekte ---
const DEFAULT_TITLES = ['Laptop', 'Smartphone', 'Water_bottle', 'Cavendish_banana', 'Apple', 'Rubber_duck', 'Headphones', 'Bubble_tea', 'Sneakers', 'Amanita_muscaria', 'Pizza', 'Computer_mouse', 'Beverage_can', 'Mug', 'Cactus'];
async function wikiImage(title) {
  const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, { headers: { 'User-Agent': 'monster-kit-test/0.1' } });
  const j = await r.json();
  return j.thumbnail?.source || j.originalimage?.source;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const key = apiKey();
  const titles = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_TITLES;
  const results = await Promise.all(titles.map(async (title) => {
    try {
      const image = await wikiImage(title);
      const { genome, ms } = await genomeFromImage(image, key);
      console.log(`${title.padEnd(17)} ${String(ms).padStart(5)} ms  ${genome.name} · ${genome.shape}/${genome.proportions} · ${genome.colors.body} · parts=${genome.parts.map((p) => p.type).join('+')} · ${genome.eyes}/${genome.mouth}/${genome.limbStyle} · safe=${genome.safe}`);
      return { title, image, ms, genome };
    } catch (e) {
      console.log(`${title.padEnd(17)} FEHLER ${String(e.message).slice(0, 160)}`);
      return null;
    }
  }));
  const out = path.join(path.dirname(new URL(import.meta.url).pathname), '../monster-kit/test-genomes.json');
  fs.writeFileSync(out, JSON.stringify(results.filter(Boolean), null, 2));
  console.log(`-> ${out}`);
}
