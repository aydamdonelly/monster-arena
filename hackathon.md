# Hackathon log

- **Project:** Snappymon
- **Event:** YC Consumer Mobile Hackathon
- **What it does:** Take a photo of any real object, it hatches into your own low-poly 3D monster with two unique attacks, and all of today's monsters fight it out in a battle royale.
- **Live app:** https://snappymon.com
- **Repo:** https://github.com/aydamdonelly/monster-arena
- **Frontend:** Vercel
- **Convex deployment:** https://superb-buzzard-616.convex.cloud
- **Components:** none
- **Convex features:** schema, indexes, queries, mutations, actions, internal functions, file storage, realtime queries
- **Auth:** none (anonymous device id)
- **AI models:** gpt-6-luna (OpenAI Responses API, `convex/hatch.ts`)
- **Started:** 2026-11-15T10:53:51-08:00
- **Last updated:** 2026-11-15T12:09:00-08:00

Times are Pacific time (PST, UTC-8). The repo was created at 10:01 PT with a
two-line README; all code below came after that.

## Log

### 2026-11-15 10:53 PT - 6994bd6
First monster generator: a genome turns into a low-poly monster built
procedurally in three.js, with a test page (`monster-kit/monster.js`,
`monster-kit/index.html`).

### 2026-11-15 11:14 PT - 14d6285
Photo to genome. A strict JSON schema with fixed menus (8 body shapes,
proportions, 19 part types, elements, two moves) for the OpenAI vision model,
plus a test script over real photos (`monster-kit/genome-spec.js`,
`scripts/genome-test.mjs`). Added a deterministic battle engine
(`monster-kit/battle.js`). Commits 96362b1, 14d6285.

### 2026-11-15 11:28 PT - 34cf4b9
Vertical 9:16 reel page for short videos, and JSDoc types so Convex can import
the kit (`monster-kit/reel.html`).

### 2026-11-15 11:28 PT - 62d4c73
Merged PR #1 (Capy): Expo SDK 58 app with Expo Router and Catch, Arena and
Collection tabs. Monsters render in 3D through an Expo DOM component that runs
monster-kit (`components/MonsterView.tsx`). Anonymous device identity. Convex
schema with `players`, `monsters`, `drops`, `battles`, `royales`, `events`
and indexes; queries and mutations for monsters and drops; Arena and Collection
read through realtime `useQuery`. Checked on a Revyl cloud iPhone 16.
Convex features: schema, indexes, queries, mutations (`convex/schema.ts`,
`convex/monsters.ts`, `convex/players.ts`, `convex/drops.ts`).

### 2026-11-15 11:33 PT - d67834b
Hatching backend. The photo goes to Convex file storage, the `hatch` action
sends it to the OpenAI vision model, validates the genome, and saves a monster
with two of its own attacks; unsafe or failed photos return a friendly error.
Player profile and photo URLs. Convex features: action, internal query and
mutation, file storage (`convex/hatch.ts`, `convex/monsters.ts`).

### 2026-11-15 11:35 PT - e6fe0c2
Web deploy script: Expo web export plus monster-kit under `/kit`, published to
Vercel at snappymon.com (`scripts/deploy-web.sh`).

### 2026-11-15 11:54 PT - 637268f
Battle royale. A deterministic all-against-all simulation and a 3D arena that
replays it (`monster-kit/royale-sim.js`, `monster-kit/arena.js`). On the
server, `royale` takes each player's newest monster of the day, runs heats and
a final above 20 entrants, and stores only seeds and results; the arena replays
the same seeded rounds. Convex features: mutations, queries
(`convex/royale.ts`, `convex/dev.ts`). Commits e276ab0, 637268f.

### 2026-11-15 11:57 PT - 64d7be0
Snappymon screen designs from Paper ("sticker sheet" look): six screens,
exported JSX and monster renders as the handoff for the app (`design/`). The
arena page can hide its camera buttons for recordings.
Commits b883c9b, 64d7be0.

### 2026-11-15 11:59 PT - 8e0efe0
Merged PR #2 (Capy): photo catch with camera or library, upload to Convex
storage, hatching egg animation, reveal with confetti and haptics, first-launch
onboarding, photo collection, and public share pages at `/m/[id]`. Checked on
the web at mobile size and on a Revyl cloud iPhone 16.

### 2026-11-15 12:02 PT - fff6d59
Dev overview numbers that leave out test players, fonts and icons served
correctly on Vercel, and an app-start event to measure returning players and
where they came from (`convex/dev.ts`, `scripts/deploy-web.sh`,
`lib/device.tsx`). Commits 1fdbd06, b23b066, fff6d59.

### 2026-11-15 12:09 PT - cce1a1c
Arena polish for video: frame-by-frame mode, UI scaling, optional photos, the
winner shown from the front at the end. A gold look for the Golden Egg
(`monster-kit/arena.js`, `monster-kit/monster.js`).
Commits 6c2ca8b, 76e19ce, cce1a1c.
