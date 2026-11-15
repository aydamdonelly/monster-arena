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
