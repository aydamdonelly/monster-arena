# Snappymon

Snap a photo of anything and you get an egg. At 6 PM Pacific every egg hatches live in a 3D arena and the monsters fight a free-for-all royale. Afterwards your monster lives in your collection and the fight stays as a replay.

Built at the YC Consumer Mobile Hackathon on 2026-11-15. Build log: [hackathon.md](hackathon.md).

## Try it

- Open **https://snappymon.com** on your phone (web export of the same Expo app) and snap something.
- The royale runs at **6 PM Pacific every day**. If the app is open then, or you open it within 15 minutes, it takes you straight to the live fight.

> **Numbers from launch day: to be filled in after the 6 PM royale.**

## Rules

- One free egg per royale. A second egg only as a Golden Egg for $1 (see Whop below).
- An egg laid after 6 PM waits for the next day's royale.
- One arena holds up to 32 monsters. Only above 32 are there heats of 16 and a final.
- With fewer than 8 eggs, wild house monsters fill the arena up to 8. They fight with 65 percent health and attack, so a real egg usually wins.

## How it works

1. **Photo to egg.** The app uploads the photo to Convex file storage and calls `eggs.lay`. You get an egg right away ([convex/eggs.ts](convex/eggs.ts)).
2. **Hidden monster.** In the background a scheduled Convex action sends the photo to an OpenAI vision model (`gpt-6.1-sol`, falling back to `gpt-6-luna`). It returns a strict JSON genome: name, element, two attacks, and a low-poly blueprint of the object built from 8 to 24 primitives ([monster-kit/genome-spec.js](monster-kit/genome-spec.js)). The monster stays hidden in the egg.
3. **Hatch and royale at 6 PM.** A Convex cron runs the royale ([convex/crons.ts](convex/crons.ts)). The server runs the deterministic simulation ([monster-kit/royale-sim.js](monster-kit/royale-sim.js)) and stores only the seed, the entrant ids and the result ([convex/royale.ts](convex/royale.ts)). Every client re-simulates the same fight from seed + entrants and draws it in 3D ([monster-kit/arena.js](monster-kit/arena.js)), so every phone and the `/tv` projector show the same fight.
4. **Collection and replay.** Afterwards the monster is in your collection, and the Arena tab shows your placement and replays your round.

```mermaid
flowchart LR
  P[Photo] --> E[Egg<br/>eggs.lay]
  E -->|scheduled action| V[Vision model]
  V -->|genome + blueprint| DB[(Convex)]
  C[6 PM cron] --> R[royale.run<br/>seed + entrant ids]
  R --> DB
  DB -->|realtime query| A[Every client re-simulates<br/>and renders in 3D]
  A --> Col[Collection + replay]
```

For live demos after 6 PM there is a key-protected demo mode: a demo device's egg gets a **Hatch now** button and fights wild monsters right away (#14).

## Stack

- **Expo SDK 58** with Expo Router, for iOS, Android and web from one codebase.
- **Expo DOM components** (`'use dom'`) run **three.js** inside the native app for the monsters and the arena ([components/MonsterView.tsx](components/MonsterView.tsx), [components/ArenaView.tsx](components/ArenaView.tsx), [monster-kit/](monster-kit/)).
- **Convex** for the database, file storage, server functions, scheduling, crons and HTTP webhooks ([convex/](convex/)).
- **Vercel** hosts the web export at snappymon.com ([scripts/deploy-web.sh](scripts/deploy-web.sh)). Screen designs were made in Paper ([design/](design/)).

## Built with the hackathon stack

**Capy.** Each feature was built in its own Capy thread, which opened the pull request: #1 scaffold (MONS-1), #2 photo catch (MONS-2), #3 first docs (MONS-6), #4 design pass (MONS-4), #5 Arena tab and `/tv` (MONS-3), #7 egg-first flow plus #10 rehearsal mode, #11 6 PM takeover, #13 after-the-royale fixes and #14 demo mode (all MONS-7), #8 and #15 Revyl (MONS-5), #12 Golden Egg client and sandbox test (MONS-9), #6 Keiki (MONS-8), #9 and this PR (MONS-10). Commits on `main` that did not come through a pull request (monster-kit, most of the Convex backend including the Whop backend, the deploy script, the design handoff) were written with Claude Code.

**Revyl.** The Revyl GitHub App is installed and `.revyl/config.yaml` is on `main` (#8). For every pull request Revyl builds the iOS app as a Release simulator build and posts a proof of changes from a cloud iPhone. Test players use a "QA" name so proofs don't count as real users. The verdicts so far are honest about their limits: on #8 the proof was [Inconclusive, confidence 1/5](https://github.com/aydamdonelly/monster-arena/pull/8#issuecomment-6902033918) (the app launched to its first screen, but a config change isn't visible in the app). On #13 it was [Partial coverage, confidence 2/5](https://github.com/aydamdonelly/monster-arena/pull/13#issuecomment-6902487031): "No defects found in the exercised changes", the `/tv` address was verified on the phone, and the wide-screen layouts and royale-time states stayed unverified. #15, which lets proofs lay an egg on the cloud iPhone, is open.

**Convex.** The database (players, monsters/eggs, royales, events, and a `counters` table so pages that need one number don't scan tables), file storage for photos plus small thumbnails for lists and the arena, and the monster generation as a scheduled action with up to 8 retries and growing waits. A cron restarts stuck eggs every 3 minutes, and another runs the royale at 6 PM Pacific. `eggs.lay` has a flood limit (more than 150 eggs across all players in 10 minutes and it stops taking eggs for a moment, since each egg costs a model call). Rehearsal royales (`?test=1`) and demo royales use only test players' eggs plus wild monsters and never touch real eggs. The `/analytics` page reads the key-protected `stats.overview` query ([convex/stats.ts](convex/stats.ts)). The Whop webhook is an HTTP action in [convex/http.ts](convex/http.ts).

**Whop.** The Golden Egg is a second egg for the same royale for $1, which is Whop's minimum price ($1.00). The checkout is a Convex action ([convex/whop.ts](convex/whop.ts)) and the `/whop` webhook credits the egg ([convex/http.ts](convex/http.ts)). Both are on `main`, and the client is #12. **It runs in Whop's sandbox today, so no real money is charged.** The Capy thread for #12 verified a full sandbox test purchase end to end: payment, the webhook credited the egg within seconds, and the snap after it laid a golden egg.

**Keiki.** iMessage as a back channel: "Text me when it hatches" opens Messages with a link code to Keiki's shared number, Keiki tool webhooks link the phone to the player, and Convex sends a royale reminder and afterwards each player's placement with a replay link. This is [#6](https://github.com/aydamdonelly/monster-arena/pull/6) and still open, so it is not live.

## Run locally

```bash
npm install
npx convex dev    # creates or links a Convex deployment and writes .env.local
npx expo start
```

Environment variables (names only):

- App: `EXPO_PUBLIC_CONVEX_URL` (required), `EXPO_PUBLIC_WEB_URL` (optional, base URL for share links)
- Convex: `OPENAI_API_KEY` (monster generation), `ADMIN_KEY` (admin page, starting a royale), `STATS_KEY` (analytics page), `DEMO_KEY` (demo mode), `WHOP_API_KEY`, `WHOP_WEBHOOK_SECRET`, `WHOP_ENVIRONMENT` (`sandbox` or `production`)
- Web deploy only: `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
