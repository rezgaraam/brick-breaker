# Plan: 100 levels + sound

## 1. 100 levels (procedural, not hand-written)

Hand-writing 100 maps is the wrong tool; generate them deterministically from the level number so
level 37 is always the same and `test.js` can validate all 100.

1. **Seeded RNG**: `rng(seed)` (mulberry32, 4 lines). Seed = level index.
2. **Templates** (each a `(rows, difficulty, rng) -> string[]`, ~5-10 lines apiece):
   - `field` with 1-3 canals (already exists), canal width 4 -> 3 as difficulty rises.
   - solid block with random 2x2+ holes punched out.
   - stripes / checker of `1` and `2` with steel columns.
   - two fields stacked, or a field with an inner steel room reachable only via a second canal.
   - the existing 8 hand-drawn maps, scaled, sprinkled in as "set pieces".
3. **Difficulty curve** from index `i`: rows 28 -> 64, share of `2` bricks 0 -> 40%, steel density up,
   ball `SPEED` +1px/s per level. One function `difficulty(i)` returns those numbers.
4. `LEVELS = Array.from({length:100}, (_, i) => TEMPLATES[i % TEMPLATES.length](i))`.
   `test.js` already loops over `LEVELS`; it will reject any template that seals bricks off.
5. **Level select**: a 10x10 grid of numbers on the canvas (state `menu`), tap to play an unlocked level.
   Store `localStorage.bb_stars` as a JSON object `{level: stars}`; unlocked = highest key + 1.
   This replaces `bb_level`.
6. Check: `node test.js` passes for all 100; headless-render levels 1, 50, 100 and look at them.

Skip: a level editor, server-side anything, per-level hand tuning.

## 2. Sound (synthesized, zero asset files)

Keep WebAudio, replace the single `beep()` with a small `SFX` table so each event has a distinct sound.

1. `SFX = { paddle, hit, break, steel, power, bad, lose, win }`, each a function building 1-2
   oscillators (type, start/end frequency ramp, duration) and for `break` a short white-noise burst
   (`AudioBuffer` of random samples through a bandpass). ~25 lines total.
2. Pitch `break` up with combo count (bricks broken since last paddle hit); reset on paddle hit.
   This is the "satisfying" part of dense grids.
3. Throttle: at most one `hit`/`break` sound per 30ms, or 20 balls in a field will clip.
4. **Music** (optional, last): a 16-step sequencer on `setInterval`-free scheduling
   (`ac.currentTime` lookahead), one square bass + one triangle arp, two patterns, ~30 lines.
5. **Mute**: `M` key and a speaker glyph in the HUD corner, persisted as `localStorage.bb_mute`.
6. `AudioContext` is created on the first `tap()` (autoplay policy); keep it that way.
7. Check: `test.js` already stubs `AudioContext` as undefined and `beep` swallows errors; keep every
   SFX call inside that same try/catch so headless runs stay silent and green.

Skip: sample files, Howler/Tone.js, a volume slider.

## Order

Levels first (they change the data model and the menu), then sound (independent of levels).
Commit after each numbered section that leaves `node test.js` green.
