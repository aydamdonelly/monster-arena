# Snappymon design ("sticker sheet")

Designed in Paper (file "Snappymon", https://app.paper.design/file/01M7G9S5H366FFSVQ5X70JQ0KG). This folder is the source of truth for the app's look.

- `screens/*.jpeg`: the six screens at 2x. Look at these first.
- `jsx/*.jsx`: Paper's export of each screen as web JSX with inline styles. Use it for exact values (sizes, paddings, radii, colors). Translate to React Native `StyleSheet`; do not paste it.
- `renders/*.png`: transparent renders of real monsters. In the app the monster is always the live `MonsterView` (3D); the PNGs are only for mascots (Catch, Onboarding) and static previews.

## The idea in one paragraph

White ground, ink-black type and 2px outlines, hard offset shadows without blur, and exactly ONE chrome-yellow moment per screen (the primary action or the drop card). Monsters stand on mint "stage" blocks. Attacks, element chips and small badges are stickers: slightly tilted, outlined, with a hard shadow. Copy is short and a little cheeky.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| ground | `#FFFFFF` | every screen background |
| ink | `#111111` | text, 2px outlines, hard shadows, active tab, selected chip |
| muted | `#6B6B6B` | secondary text, inactive tabs |
| hairline | `#E6E6E6` | dividers, empty bar track in the roster |
| primary | `#FFD60A` | the one yellow moment per screen |
| stage | `#E8F1EC` | block behind a monster (must equal the MonsterView scene background) |
| fire / water / plant / metal / fluff / spirit | `#FF6B4A` / `#3D9DF3` / `#4CB867` / `#8C97A6` / `#E98BC4` / `#9A7BF0` | element chips, stat bar fill, element dot only |

Old elements from random test monsters map like this: leaf = plant, spark = `#F5C542`, rock = `#A08A6A`, normal = `#B0B6B3`.

Font: **Rubik** for everything (`@expo-google-fonts/rubik`: 500 Medium, 600 SemiBold, 700 Bold, 800 ExtraBold, 900 Black).

| Style | Size / line height | Weight | Extras |
| --- | --- | --- | --- |
| display (monster name, screen title, drop title) | 44 / 44 (drop title 46 / 44, timer 46 / 48) | 900 | letterSpacing -0.035em (about -1.5) |
| headline (hatching, onboarding) | 40 to 46 / 40 to 44 | 900 | same tight tracking |
| heading | 20 to 22 / 24 to 26 | 800 | |
| body | 16 / 22 | 500 | muted color for secondary lines |
| button label | 18 / 22 | 800 primary, 700 outline | |
| label | 13 / 16 | 600 | UPPERCASE, letterSpacing 0.08em (about 1) |
| tab label, tiny caps | 12 / 14 | 600 to 700 | UPPERCASE only, never lowercase at 12 |

Radii: chip and sticker 8 to 10, button and field 16, tile 20, drop card and arena view 24, stage 28, pill 999.
Spacing: screen side padding 20 for blocks and 24 for text lanes; gaps 4, 8, 12, 16, 20, 24.

## The hard shadow (important)

Web: `box-shadow: 4px 4px 0 #111` (cards 5px, small stickers 2 to 3px), never blurred.
React Native: do not use `elevation` or `shadowRadius`. Render a second view behind the element with the same size and radius, `backgroundColor: ink`, offset by the shadow distance to the right and down (wrapper with `paddingRight`/`paddingBottom` equal to the offset, shadow view absolutely positioned). Build this once as `<HardShadow offset={4} radius={16}>`.

## Components

- **Primary button**: height 56 to 58, primary fill, 2px ink border, radius 16, hard shadow 4, label 18/800 ink. One per screen at most.
- **Outline button**: same size, ground fill, 2px ink border, no shadow, label 18/700 (small variant: height 42, radius 12, label 15/700).
- **Sticker tag** (attack): padding 7/12/8, 2px ink border, radius 10, hard shadow 3, rotated -2deg (basic, ground fill) or +2deg (special, element color fill). Two lines: name 16/800, kind in 12 caps ("MELEE", "SPECIAL · BURST").
- **Element chip**: padding 4/10, element color fill, 2px ink border, radius 8, hard shadow 2, rotated -3 to -4deg, label 13/700 caps in ink.
- **Stat bar**: row = label lane (38 wide, 13 caps) + track (height 14, 2px ink border, radius 7, ground fill) + value lane (26 wide, 15/700, right aligned, tabular numbers). Fill uses the monster's element color and ends with a 2px ink edge. Width = value / 110.
- **Stage block**: stage color, radius 28 (tiles 20), no border; the monster is centered and slightly larger than the block feels it should be.
- **Polaroid** (born from): ground frame with 2px ink border, padding 4/4/10, radius 6, hard shadow 3, rotated -5deg, photo 44 square inside.
- **Tab bar**: 2px ink top border, three tabs (Catch, Arena, Collection), icon 26 + 12 caps label; active = ink plus a 22x4 ink bar under the label, inactive = muted. Keep the home indicator space.
- **Roster cell** (arena): ground fill, radius 8, name 12/700, 5px HP bar (green `#4CC38A`, yellow `#F5C542`, red `#FF5A4A` by HP).
- **Camera chips** (arena): pills, 12/700, active ink fill with white text, others ground fill.

## Screens and routes

| Screen | File | Route / state |
| --- | --- | --- |
| 01 Catch | `01-catch` | `app/(tabs)/index.tsx`. Yellow moment = drop card (`api.drops.current`). Big ink camera button with offset ring. "2 of 3 hatches left today" with three egg dots. Mascot render peeks from the right. |
| 02 Hatching | `02-hatching` | waiting state while `api.hatch.hatch` runs (about 5 s). Egg wobbles (rotate between -7 and +7deg), starburst is the yellow moment, the user's photo sits as a tilted polaroid, progress bar fills in ink. Rotate the quip line every 1.5 s ("Counting its teeth.", "Polishing the horns.", "Teaching it to wave."). |
| 03 Monster | `03-monster` | reveal after hatching and the detail screen (`/m/[id]` and collection detail). Stage holds `MonsterView`. Yellow moment = Share. |
| 04 Collection | `04-collection` | `app/(tabs)/collection.tsx`. Two columns, tile width (screen - 20 - 20 - 14) / 2. The newest tile carries the yellow "NEW" sticker. Last tile is the dashed "Snap something new" slot that opens the camera. Scrolls. |
| 05 Arena | `05-arena` | `app/(tabs)/arena.tsx`. Countdown, entrant count, the 16:10 arena view (live 3D arena from `monster-kit/arena.js`, roster on top, camera chips bottom right), yellow "Watch live", own monster row with "YOU" sticker, last royale result with "Watch replay". |
| 06 Onboarding | `06-onboarding` | first launch. Name field with hard shadow, source chips (selected = ink fill), yellow "Let's go", "skip" link. Calls `api.players.setProfile`. |

## Rules an implementer must not break

1. One yellow element per screen. If a second thing wants to be yellow, make it an outline button or an ink sticker.
2. No blurred shadows, no gradients, no gray card backgrounds. Depth comes only from 2px ink outlines and hard offset shadows.
3. Mint appears only behind monsters (stage blocks, thumbs, arena view). The MonsterView background stays `#E8F1EC` so it melts into the stage.
4. Element colors only on chips, the stat bar fill, the special attack sticker and the element dot. Text on element colors is ink, never white.
5. Type contrast does the hierarchy: 900 display next to 500 body and 13px caps labels. Nothing smaller than 12, and 12 only in caps.

## Round 2: flow

Same tokens and rules as above. New since round 1: monsters have black comic outlines (renders in `renders/` are the outlined versions, plus `golden-<name>.png` with a floating crown), the royale is at **5:00 PM**, and a first-time visitor is never stopped by a form.

The flow: land on **07** → tap the camera → **02** hatching → **08** reveal → "Watch it fight" (instant practice arena). The trainer name is asked on 08, after the hatch, as the way into the royale. At the daily limit the Catch tab shows **11**, which opens the **09** sheet. After a royale the Arena tab shows **10**. The projector runs **12**.

| Screen | File | Route / state |
| --- | --- | --- |
| 07 Landing | `07-landing` | first visit on `/` (no player name yet, no monsters). Replaces the onboarding wall: 06 Onboarding is no longer shown before the first hatch. No tab bar, no form. |
| 08 Reveal | `08-reveal` | right after hatching (replaces the plain 03 layout for the reveal moment; 03 stays the detail screen). Scrolls: stats and born-from sit below the fold. |
| 09 Golden Egg | `09-golden-egg` | bottom sheet over the dimmed Catch screen, opened from 11 (or when a 4th hatch is attempted). |
| 10 Royale result | `10-royale-result` | Arena tab once the royale is done. |
| 11 Limit | `11-limit` | Catch tab when 3 of 3 hatches are used. |
| 12 TV | `12-tv` | `/tv`, 1920 x 1080 for the projector, before the royale starts. |

### Copy, exactly

- **07 Landing**: wordmark `snappymon` · sticker `ROYALE TODAY 5 PM` · pitch `Snap anything.` / `Hatch a monster.` · under the button `No app. No signup. Five seconds.` · proof `1,204 monsters hatched today` (live count from the backend, with a small green dot).
- **08 Reveal**: sticker `IT HATCHED!` · element chip (e.g. `WATER`) · monster name · lore line · attack stickers (name plus `MELEE` / `SPECIAL · BURST`) · primary `Watch it fight` · outline `Text me the result` (speech-bubble icon) and `Share` · line `Name your trainer to enter the 5 PM royale` · field placeholder `Trainer name` · ink button `Enter` · below the fold `STATS` and `BORN FROM`.
- **09 Golden Egg**: stickers `+1 HATCH` and `CROWN INCLUDED` · title `Golden Egg` · price `$0.99` · lines `One more hatch today`, `Hatches golden, crown included`, `Same stats. Just fancier.` · primary `Crack one open · $0.99` · link `Maybe tomorrow`.
- **10 Royale result**: labels `ROYALE · TODAY 5:00 PM` and `16 FOUGHT` · title `<Champion>` / `wins.` · sticker `CHAMPION` · polaroid caption `BORN` · `trainer <name> · 5 knockouts` · `You finished #4 of 16` · quip `Mugzilla went down swinging.` · primary `Watch the replay` · outline `Share your monster` · quiet line `Next drop tomorrow, 9 AM`.
- **11 Limit**: drop card label `TODAY'S DROP`, title of the drop, sticker `3 OF 3` · three thumbs of today's hatches · `0 OF 3 HATCHES LEFT TODAY` with three empty egg dots · headline `That's three for today.` · sub `Come back tomorrow, or crack a Golden Egg.` · primary `Golden Egg · $0.99` (egg icon) · outline `Watch the arena`.
- **12 TV**: wordmark `snappymon` · title `SNAPPYMON ROYALE` · `148 monsters entered` · yellow block `STARTS IN` `12:44` · QR code, then `snap an object at` / `snappymon.com` / `to enter` · arena block with roster strip (`+144` for the rest).

### What an implementer must know

1. **Yellow moves, the rule stays**: on 07 the camera button itself is yellow (ink icon, ink hard-shadow circle offset by 10). On 01 Catch the drop card is yellow and the camera button is ink. On 11 the drop card turns into an outlined, non-yellow "done" card because the Golden Egg button is the yellow moment. On 12 the countdown block is the yellow moment.
2. **Gold is not a UI color.** It appears only through the golden render on 09 (and on golden monsters wherever they are shown). Buttons stay chrome yellow `#FFD60A`.
3. **Peeking monsters** (07) are absolutely positioned, partly outside the screen, tilted 9 to 16 degrees, at clearly different sizes (116 to 184). They must never cover the pitch, the button or the proof line. Use today's most recent real monsters if available, otherwise the bundled renders.
4. **Starburst stickers**: 14-point star polygons. Yellow with ink outline behind the egg (02), white with ink outline behind the fresh monster (08). On 08 the monster overlaps the stage edge slightly on purpose.
5. **Bottom sheet (09)**: ground fill, 2px ink top border, top radius 28, dim layer `rgba(17,17,17,0.55)` over the screen behind. The golden render stands on a small stage and its crown pokes out above the stage, staying below the grabber.
6. **Trainer name after the hatch**: on 08 the field and `Enter` are inline (field height 50, radius 14, 2px ink border; `Enter` is ink fill with white label). Entering a name calls `players.setProfile` and confirms the royale entry. Skipping must still let the user watch the practice fight.
7. **Buttons on 08**: one primary (`Watch it fight`, bolt icon), then the two outline buttons side by side at height 48 with 15px labels (`Text me the result` takes about 63 % of the row).
8. **TV sizes** (12): title 128/112 at weight 900 uppercase, timer 190/176, URL 66, roster names 22, outlines 4px, hard shadows 8 to 10px, outer padding 72 top and bottom, 96 left and right. The arena block is where the live `monster-kit/arena.js` view goes; the QR is a placeholder for a real code to `https://snappymon.com`.
9. Changed in round 1 screens: outlined renders everywhere (01 mascot, 03 stage, 04 tiles, 05 arena and thumb, 06 mascot), names updated to Duckzilla, Phone Phantom and Toadstooloom, and 05 Arena now says `TODAY 5:00 PM`.

## Round 3: egg first

The founder's rule: everybody snaps a photo, everybody gets an **egg**, and every egg hatches **in the arena at 5:00 PM sharp**, where the monsters fight. Nobody sees a monster before that. Keep the app this simple.

The flow:
1. Land on `snappymon.com` (**07**), tap the camera, snap anything.
2. The **02** hatching screen is now only the short upload wait. Then **13 Egg**: your egg with your photo on it and the countdown to 5 PM.
3. Until 5 PM: **14 Home** (Catch tab, up to three eggs a day, the daily task is always "Anything"), **15 Arena waiting** (all eggs, one countdown), **17 Collection** (eggs next to yesterday's monsters).
4. 5:00 PM: **16 Arena live**. All eggs appear in the 3D arena, hatch together and fight (free-for-all).
5. Afterwards: **18 Result** in the Arena tab, the monster sits in **17 Collection**, the fight is a replay.

| Screen | File | Route / state |
| --- | --- | --- |
| 13 Egg | `13-egg` | right after the snap, and whenever an egg is tapped (Home row, Collection, Arena grid). |
| 14 Home | `14-home` | Catch tab, `app/(tabs)/index.tsx`, returning player before 5 PM. Replaces 01 Catch (01 only got the new copy). |
| 15 Arena waiting | `15-arena-waiting` | Arena tab before 5 PM. |
| 16 Arena live | `16-arena-live` | the live royale at 5 PM and the frame for every replay. Full screen, no tab bar. |
| 17 Collection | `17-collection` | Collection tab. Replaces 04. |
| 18 Result | `18-result` | Arena tab after the royale. Replaces 10 (10's champion view shrinks to the strip at the bottom of 18). |
| retired | `08-reveal`, `10-royale-result`, `03-monster` as a reveal | there is no reveal after hatching and **no practice arena** anymore. 03 stays as the detail screen of a hatched monster. 06 Onboarding stays retired; the trainer name is asked inline on 13. |

Still valid: 07 Landing (new pitch), 09 Golden Egg (an extra **egg** beyond the three per day; it hatches golden at 5 PM), 11 Limit (wording should say eggs, see below), 12 TV (now shows eggs).

### Copy, exactly

- **07 Landing**: sticker `ROYALE TODAY 5 PM` · pitch `Snap anything.` / `Get an egg.` / `It hatches at 5 PM.` · `No app. No signup. Five seconds.` · proof `148 eggs waiting for 5 PM` (live count).
- **13 Egg**: sticker `YOUR EGG IS IN` · polaroid caption `YOUR SNAP` · headline `It hatches at 5 PM sharp.` · countdown `03:12:44` with `TO GO` · `Live in the royale. Come back to watch it hatch and fight.` · label `NAME YOUR TRAINER`, placeholder `Trainer name`, button `Enter` · primary `Text me when it hatches` (speech-bubble icon) · outline `Share`.
- **14 Home**: `TODAY'S DROP` · `royale in 03:12:44` · title `Anything` · `Snap it. Get an egg. It hatches at 5 PM.` · `2 OF 3 EGGS LEFT TODAY` · section `YOUR EGGS`, egg tiles with sticker `5 PM`, empty slot `1 more`.
- **15 Arena waiting**: title `Royale` · sticker `TODAY 5 PM SHARP` · yellow block `HATCHING IN` `03:12:44` · `148 eggs waiting` · `nobody knows what's inside` · the player's egg is marked `YOU` · `At 5:00 every egg hatches and they all fight. Last monster standing wins.`
- **16 Arena live**: sticker `LIVE` (red) · `5:00 PM · 16 EGGS` · banner `HATCHING…` (later `FIGHT!`, `FINAL TWO`, `<NAME> WINS!`) · caption `Your egg: <Name>` with sticker `YOU` · camera chips `Auto` `3D` `Top` `Follow`.
- **17 Collection**: title `Collection` · `3 MONSTERS · 1 EGG` · egg tile: sticker `HATCHES 5 PM`, name `Mystery egg`, countdown `03:12:44` · golden tile: sticker `GOLDEN` · empty slot `Snap something new`.
- **18 Result**: sticker `YOUR EGG HATCHED!` · `ROYALE · 5:00 PM` · element chip · monster name · attack stickers (`Stuffing Stampede` / `DASH`, `Capy Nap Wave` / `SPECIAL · BURST`) · `YOU FINISHED` `#4 of 16` · `2 knockouts` · primary `Watch the replay` · outline `Share` · strip `Champion: Voltgoblin` / `trainer Mia`.
- **09 Golden Egg**: stickers `+1 EGG`, `CROWN INCLUDED` · `Golden Egg` · `$0.99` · `One more egg today`, `Hatches golden, crown included`, `Same stats. Just fancier.` · `Crack one open · $0.99` · `Maybe tomorrow`.
- **11 Limit** (not redrawn, change the words when implementing): `0 OF 3 EGGS LEFT TODAY` · `That's three for today.` · `Come back tomorrow, or crack a Golden Egg.` · `Golden Egg · $0.99` · `Watch the arena`. The three thumbs show today's eggs, not monsters.
- **12 TV**: `SNAPPYMON ROYALE` · `148 eggs waiting` · `STARTS IN` `12:44` · QR plus `snap an object at` / `snappymon.com` / `to enter` · arena block: sticker `HATCHING AT 5 PM SHARP`, a ring of eggs, `Every egg hatches at once. Last monster standing wins.`

### The egg (new component)

- One SVG shape (path in `jsx/13-egg.jsx`, viewBox 212 x 262): fill = a very light tint, 5 speckles in a darker shade of the same hue, 2 to 3px ink outline, hard shadow = the same shape in ink offset by 9 units. Tilt it 3 to 8 degrees.
- Tint pairs used (fill / speckles): `#F4F2EB` / `#9B6545`, `#DCEBF7` / `#3D9DF3`, `#F9E1EE` / `#E98BC4`, `#FFE3D6` / `#FF6B4A`, `#DDF0DC` / `#4CB867`, `#E9E1FB` / `#9A7BF0`, `#E9ECEF` / `#8C97A6`. Derive the tint from the photo's dominant color (or hash the egg id) so every egg looks different. The tint must not reveal the element.
- The photo always travels with the egg as a small tilted polaroid stuck on its lower right (about 40 % of the egg's width, 2px ink border, hard shadow). This is how people recognize their own egg in the arena.
- Crack: a short zigzag at the top for "waiting", a zigzag across the middle for "about to hatch" (last minute and in the arena). On 13 the egg wobbles (rotate between -5 and +5 degrees) and two small arc marks sit beside it.
- A Golden Egg uses the same shape with fill `#FFE9A6`, speckles `#E0A800` and a small crown sticker; it is the only egg that may hint at what is special about it.

### What an implementer must know

1. **Never show a monster, its name, element, stats or attacks before 5 PM.** The hatch call may already create the monster on the server, but every client view of today's entry is the egg. Yesterday's monsters stay visible in Collection.
2. **One countdown, one time.** Every screen counts down to the same 5:00 PM (`royale in`, `HATCHING IN`, `TO GO`, the egg tile). Show hours, minutes and seconds with tabular numbers, and switch to `LIVE` at zero.
3. **Yellow moments**: 13 = the primary button, 14 = the drop card, 15 = the countdown block, 16 = the starburst behind a hatching monster, 17 = the `GOLDEN` sticker, 18 = `Watch the replay`.
4. **16 is a frame, not a mockup to rebuild in views**: the area between the roster strip and the caption is the live `monster-kit/arena.js` canvas (sky `#CFEAF0`, island, zone ring). Roster, `LIVE` sticker, banner, caption and camera chips are overlays. At 5 PM the eggs stand where the monsters will spawn, crack, and each monster pops out with a starburst and shell pieces.
5. **Trainer name** is asked inline on 13 (not before the snap). Without a name the egg still enters the royale as "anon".
6. **`Text me when it hatches`** is the reminder (iMessage). After opting in, the button becomes an outline state `We'll text you at 5 PM`.
7. **Tapping an egg** anywhere opens 13 for that egg. Tapping a hatched monster opens 03.
8. **New monsters**: the block-built renders are `renders/bp-*.png` (capybara plush, car, e-scooter, parking pay station, plus `bp-golden-*`). `bp-voltgoblin.png` is cropped at the frame edge, so use it only small or peeking.
9. Changed older screens in this round: 01 (drop title `Anything`, egg wording, capybara mascot), 07 (three-line pitch, bp monsters, egg proof line), 09 (golden capybara, `+1 EGG`, `One more egg today`), 12 (eggs instead of monsters, no roster).
