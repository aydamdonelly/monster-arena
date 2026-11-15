# Hackathon log

- **Project:** Snappymon
- **Event:** YC Consumer Mobile Hackathon
- **What it does:** Snap a photo of anything to get an egg; at 5 PM Pacific every egg hatches live in a 3D arena and the monsters fight a free-for-all royale, then live in your collection with a replay of the fight.
- **Live app:** https://snappymon.com
- **Repo:** https://github.com/aydamdonelly/monster-arena
- **Frontend:** Vercel
- **Convex deployment:** https://superb-buzzard-616.convex.cloud
- **Components:** none
- **Convex features:** schema, indexes, queries, mutations, actions, internal functions, file storage, scheduled functions, crons, realtime queries (HTTP actions in open PRs #6 and Whop)
- **Auth:** none (anonymous device id)
- **AI models:** gpt-6.1-sol with gpt-6-luna as fallback (OpenAI Responses API, `convex/eggs.ts`)
- **Started:** 2026-11-15T10:53:51-08:00
- **Last updated:** 2026-11-15T14:03:00-08:00

All times are Pacific on 2026-11-15. Commit times are author times from
`git log`; PR times are GitHub's opened and merged times. Hacking started at
10:30; the repo itself was created at 10:01 with an empty README.

## Morning: photo to monster

- **10:53** `6994bd6` First monster generator: a genome becomes a low-poly
  three.js monster (`monster-kit/monster.js`).
- **11:11-11:14** `96362b1`, `14d6285` Photo to genome with a strict JSON
  schema for the vision model, and a deterministic battle engine.
- **11:28** PR #1 merged (Capy, MONS-1): Expo SDK 58 + Expo Router app, three
  tabs, monsters in 3D through an Expo DOM component, Convex schema. Checked on a
  Revyl cloud iPhone.
- **11:33** `d67834b` Hatch backend: photo to Convex file storage, vision
  model, monster with two attacks.
- **11:35** `e6fe0c2` Web deploy to Vercel at snappymon.com.
- **11:51-11:54** `e276ab0`, `637268f` Free-for-all royale in 3D. The server
  stores only seeds and results; the arena replays the same fight.
- **11:59** PR #2 merged (Capy, MONS-2): photo catch, hatching animation,
  onboarding, collection, public `/m/[id]` share pages.

## Midday: look and arena

- **12:02-12:14** App-start events for analytics, video recording mode for the
  arena, gold look and backend core for the Golden Egg (no payment yet).
- **12:15** PR #3 merged (Capy, MONS-6): first build log and README.
- **12:19** PR #4 merged (Capy, MONS-4): sticker-sheet design pass.
- **12:29** PR #5 merged (Capy, MONS-3): Arena tab, practice arena, royale
  replays and the `/tv` projector view.
- **12:30-12:49** Battle tuning, royale moved to 5 PM, portrait director
  camera, projectiles shaped like the attacker, 12 new parts.

## 12:50: pivot to egg-first

Instead of seeing the monster right after the photo, you now get an egg and the
monster hatches only in the 5 PM royale. That gives the model time for a slower,
better build.

- **12:51** PR #6 opened (Capy, MONS-8): Keiki iMessage back channel. Still open.
- **12:59** `a2df5b9` First egg screens (landing, egg screen, limit, Golden
  Egg sheet).
- **13:02** `ad1b61a` Blueprint models: the model builds each object from 8
  to 24 primitives instead of picking from a fixed menu.
- **13:07** `92ee251` Eggs backend: the photo becomes an egg at once and the
  monster is generated hidden in the background.
- **13:09-13:18** Eggs stand in a ring and hatch one by one before the fight;
  admin page to review eggs; round 3 designs from Paper.
- **13:29** `6cab401` Royale hardened: wild monsters fill up the arena, test
  (rehearsal) runs, only ids stored, at most one live royale a day; patient
  retries for egg generation plus a cleanup cron.
- **13:33** PR #7 merged (Capy, MONS-7): the egg-first flow is on `main`
  (merge commit `93ad8bf` authored 13:29).

## Afternoon: rules, payments, proof, messages

- **13:46** `e247617` One egg per royale; a second only as a Golden Egg.
  Royale fixed at 5 PM Pacific. Analytics page at `/analytics`. Counters and
  thumbnails to keep queries small.
- **13:48** `dd79f92` Home shows the countdown to hatching after you lay an
  egg; analytics shows at least three hours of history.
- **13:53** `b35ed03` Bundle id `com.snappymon.app` and signing team for a
  device build.
- **13:58** PR #8 opened (Capy, MONS-5): Revyl proof of changes via
  `.revyl/config.yaml`. Open.
- **14:03** `af73c79` on branch `whop-golden-egg` (Capy, MONS-9): draft Whop
  checkout action and `/whop` webhook for the $1 Golden Egg. No PR yet.
- **In progress:** the Whop Golden Egg PR and a rehearsal-mode PR.
