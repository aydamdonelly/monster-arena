# Hackathon log

- **Project:** Snappymon
- **Event:** YC Consumer Mobile Hackathon
- **What it does:** Snap a photo of anything to get an egg; at 6 PM Pacific every egg hatches live in a 3D arena and the monsters fight a free-for-all royale, then live in your collection with a replay of the fight.
- **Live app:** https://snappymon.com
- **Repo:** https://github.com/aydamdonelly/snappymon
- **Frontend:** Vercel
- **Convex deployment:** https://superb-buzzard-616.convex.cloud
- **Components:** none
- **Convex features:** schema, indexes, queries, mutations, actions, internal functions, file storage, scheduled functions, crons, HTTP actions, realtime queries
- **Auth:** none (anonymous device id)
- **AI models:** gpt-6.1-sol with gpt-6-luna as fallback (OpenAI Responses API, `convex/eggs.ts`)
- **Started:** 2026-11-15T10:53:51-08:00
- **Last updated:** 2026-11-15T14:59:34-08:00

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
  `.revyl/config.yaml`.
- **14:03** `af73c79` on branch `whop-golden-egg`: Whop checkout action and
  `/whop` webhook for the Golden Egg, priced at $1 because that is Whop's
  minimum.

## Last stretch: payments, takeover, demo mode

- **14:12** `91eda3d` Whop backend merged into `main` so every deploy has it.
- **14:14** PR #8 merged. Revyl now builds the iOS app for every PR and posts a
  proof of changes. On #8 itself the verdict was Inconclusive (1/5): the app
  launched, but a config change can't be seen in the app.
- **14:16** PR #10 merged (Capy, MONS-7): rehearsal mode (`?test=1`),
  next-royale countdown, lint clean, layout polish.
- **14:20** `4a6d7a1` Wild fill-up monsters fight with 65 percent health and
  attack, so a real egg usually wins.
- **14:21** PR #9 merged (Capy, MONS-10): egg-first README and build log.
- **14:25** PR #11 merged (Capy, MONS-7): the 5 PM takeover. If the app is
  open, or opened within 15 minutes, it jumps into the live royale.
- **14:25** The Capy thread for #12 (MONS-9) reports a full sandbox purchase
  worked end to end: payment, webhook credit, golden egg.
- **14:28** PR #12 merged (Capy, MONS-9): Golden Egg client with the Whop
  checkout, running in Whop's sandbox.
- **14:40** `5725203` Analytics count sales only with real money; sandbox
  purchases are listed separately.
- **14:43** `66be5a9` One shared arena up to 32 monsters; heats only above 32.
- **14:47** `a5a5f5c` Demo royale backend (`royale.demoEnter`,
  `royale.demo`): a test device's egg hatches on demand against wild monsters.
- **14:49** PR #13 merged (Capy, MONS-7): after-the-royale fixes for home,
  arena and `/tv`. Revyl proof: Partial coverage (2/5), no defects found in
  what it could reach.
- **14:54** `cef88c0` Monsters can only be created through `eggs.lay`, plus
  a flood limit of 150 eggs in 10 minutes.
- **14:58** PR #14 merged (Capy, MONS-7): demo mode with a Hatch now button for
  live demos.
- **14:59** PR #15 opened (Capy, MONS-5): Revyl proofs can lay an egg on the
  cloud iPhone. Open.
- **15:22** `ec81d3e` The royale start waits up to 45 seconds for eggs laid in
  the last minutes; one shared arena up to 24 monsters, heats above that;
  monster names get more variety.
- **15:32** PR #17 merged (Capy, MONS-7): result buttons fit, demo copy,
  simulator flag, today and tomorrow wording.
- **15:36** Royale moved from 5 PM to 6 PM Pacific to collect more eggs. The
  time and the fight speed now come from the server (`convex/schedule.ts`,
  `royale.clock`), so web and app follow a change without a new build. Fights
  play at double speed: 20 to 30 seconds instead of a minute, same result.
- **15:47** PR #18 merged (Capy, MONS-7): Profile tab with stats, royale
  history and replays of earlier royales. PR #19 merged (Capy): the name input
  stays above the iOS keyboard.
- **15:55** TestFlight build 2: Snappymon egg icon, Profile tab, keyboard fix.
- **16:08** `b453e66` Hatching is now a fast cut from egg to egg: each monster
  from the front with the photo it was born from above it, the player's own
  egg last. A fight plays in about 20 seconds (`fightSpeed`), same result.
- **16:10** `2bc4f1f` Sample history for a demo account (`dev:seedSample`):
  four earlier royales against house monsters so a launch-day demo can show
  the daily loop. They are marked "Sample" in the profile, never show up in
  public views and never count in the analytics. The stage demo
  (`royale.demo`) now fights the monsters of the latest real royale.
- **16:13** `95f59bb` Analytics show how many real visitors reached the
  checkout; the founder's own devices no longer count as visitors.
- **16:17** `c71fad4` As soon as today's royale has run, everything counts
  toward the next one: an egg laid a minute later says "tomorrow".
- **16:50** PR #21 merged (Capy): admin start button, tomorrow's theme
  ("Something in your kitchen"), countdown notifications every 3 minutes.
- **16:57** `aee7d3e` The admin fight is a private fight for the founder's
  device only: his newest egg against ready real eggs, read only. The real
  royale stays untouched and runs on schedule.
- **17:08** `0c7b33b` The founder can reset his own day; finished monster
  pictures are rendered outside the app and stored (`snapUrl`), because the
  hidden renderer in the iPhone app returned no pictures.
- **17:16** PR #22 merged (Capy): profile with pictures and hierarchy, monster
  pictures never blank.
- **17:21** The sample royales of the demo account are no longer labelled on
  screen (founder's wish for his recording) and no longer include a win. They
  stay flagged `sample: true` in the data and are disclosed here and in the
  README.
- **17:27** Arena: the hatching can be skipped in replays, clearer camera
  buttons, tap a monster or its name to follow it.
- **Still open:** PR #6 (Keiki, dropped for today), PR #15, PR #20.

## Launch day

**Numbers from launch day: to be filled in after the 6 PM royale.**
