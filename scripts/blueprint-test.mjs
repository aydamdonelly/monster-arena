// Test: lokale Fotos -> Genom mit frei gebautem Modell (Blueprint).
// Nutzung: GENOME_MODEL=gpt-6.1-sol OUT=test-blueprints.json node scripts/blueprint-test.mjs foto1.jpg foto2.jpg ...
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GENOME_SCHEMA, genomeInstructions } from '../monster-kit/genome-spec.js';

const MODEL = process.env.GENOME_MODEL || 'gpt-6-luna';
function apiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  const line = fs.readFileSync(path.join(os.homedir(), '.config/yc-hack/secrets.env'), 'utf8').split('\n').find((l) => l.startsWith('OPENAI_API_KEY='));
  return line.slice('OPENAI_API_KEY='.length).replace(/^'|'$/g, '');
}
const key = apiKey();
const files = process.argv.slice(2);
const results = await Promise.all(files.map(async (file) => {
  const t0 = Date.now();
  try {
    const url = `data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}`;
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, input: [{ role: 'user', content: [{ type: 'input_text', text: genomeInstructions('anything') }, { type: 'input_image', image_url: url }] }], text: { format: { type: 'json_schema', name: 'monster_genome', schema: GENOME_SCHEMA, strict: true } } }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body.error || body).slice(0, 300)}`);
    const text = body.output_text ?? body.output?.flatMap((o) => o.content || []).find((c) => c.type === 'output_text')?.text;
    const genome = JSON.parse(text); const ms = Date.now() - t0;
    console.log(`${path.basename(file).padEnd(16)} ${String(ms).padStart(6)} ms  ${genome.name} · ${genome.object.slice(0, 40)} · ${genome.blueprint.parts.length} Teile · ${genome.move1.name} / ${genome.move2.name}`);
    return { title: `${path.basename(file)} (${MODEL})`, image: '', ms, genome };
  } catch (e) { console.log(`${path.basename(file).padEnd(16)} FEHLER ${String(e.message).slice(0, 200)}`); return null; }
}));
const out = path.join(path.dirname(new URL(import.meta.url).pathname), '../monster-kit/', process.env.OUT || 'test-blueprints.json');
fs.writeFileSync(out, JSON.stringify(results.filter(Boolean), null, 1));
console.log(`-> ${out}`);
