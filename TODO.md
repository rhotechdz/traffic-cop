# Traffic Cop — Improvement TODO

Scope: make the browser prototype feel good and be genuinely addictive.
Porting/Android packaging is intentionally excluded — see the bottom section.

## Game feel ("juice")
- [x] Ease car acceleration/braking instead of instant stop/go — cars should decelerate into the stop line, not snap to a halt
- [x] Pulse/flash animation on the traffic light when it switches, instead of an instant color swap
- [x] Small camera shake on a near-miss, bigger shake + brief slow-mo on collision/game over
- [x] Particle burst (a handful of small cubes/sprites is enough) when a car clears the intersection successfully
- [x] Floating "+1" score popup at the point where a car despawns
- [x] Subtle idle motion so the scene never looks frozen while waiting for the next spawn (light bob, flag flutter, whatever's cheap)

## Audio
- [ ] Ambient low city/traffic hum loop
- [ ] Police whistle sound on light switch — fits the theme and doubles as clear feedback
- [ ] Rising-pitch "ding" per point, pitch climbs slightly with streak length
- [ ] Crash sound + short audio duck on game over
- [ ] Mute toggle in the HUD — cheap, and matters a lot to anyone playing with sound off by default

## Visual polish (cheap wins first)
- [ ] Add a directional-light shadow map — biggest visual upgrade for the least effort in Three.js
- [ ] Replace the flat sky color with a gradient or simple horizon glow
- [ ] Randomize each car's color slightly within its direction's palette so spawns don't look cloned
- [ ] Crosswalk stripes at the intersection — ties into the "police officer" theme
- [ ] Simple low-poly skyline/building silhouettes around the edges for depth (pure backdrop, no collision needed)
- [ ] Slightly more detailed car shape (roof block + tinted windshield) instead of a plain box — still just a few extra primitives

## Addictive mechanics
- [ ] Combo/streak multiplier for consecutive clean passes with no near-miss
- [ ] Near-miss bonus — reward tight, skillful timing instead of only rewarding overcaution
- [ ] Difficulty ramp: spawn rate increases with score, and/or cars start spawning in bursts
- [ ] Local high-score persistence — plain `localStorage` is fine here 
- [ ] Milestone flourish every N cars passed (25/50/100) — a beat, a color flash, something
- [ ] Occasional "priority vehicle" (ambulance) that must be let through immediately regardless of the current light — adds tension and a reason to react, not just manage a rhythm
- [ ] Consider a second fail-state: gridlock (queue length past a threshold on any approach), not just collision — rewards proactive light management over pure reflexes

## UI/UX
- [ ] Title/start screen instead of dropping straight into gameplay
- [ ] 3-car tutorial beat on first launch: highlight the lights, prompt a tap
- [ ] Pause (spacebar or a pause icon)
- [ ] Game-over screen shows current run vs. best score, maybe a rank/title ("Rookie" → "Veteran")
- [ ] Sound on/off setting persisted alongside high score

## Balance / tuning
- [ ] Playtest the current 1–2.5s spawn interval across a full run — confirm it actually ramps into "hard," not just "busy"
- [ ] Check whether the all-red clearance window (added for the collision fix) feels fair under heavy traffic or overly punishing
- [ ] Tune near-miss/combo thresholds once they exist, so skill is rewarded without trivializing the collision risk

## Kenney asset integration
- [x] Car Kit and City Kit (Roads) already downloaded and in place — do not re-download or fetch from a CDN, use the local files at `public/assets/models/cars/` and `public/assets/models/roads/`
- [x] Swap the box-geometry cars for GLB models from `public/assets/models/cars/`, one variant per direction for visual distinction
- [ ] Use `public/assets/models/cars/ambulance.glb` for the priority-vehicle mechanic (see Addictive mechanics section)
- [x] Check each model's scale and forward-axis against our unit system before wiring it in — our cars are currently width 1.6 / length 3, and forward direction needs to line up with the sign/axis convention in `simulation.js`'s `DIRECTION_INFO`, or cars will drive sideways
- [x] Load models with `GLTFLoader` from root-relative paths, e.g. `loader.load('/assets/models/cars/sedan.glb', ...)` — the `Textures/` folder next to each pack's GLBs must stay exactly where it is, the models reference it by relative path
- [ ] Defer the `public/assets/models/roads/` swap until gameplay is locked — our road geometry is tied directly to `LANE_OFFSET`/`INTERSECTION_HALF` in `simulation.js`, so swapping it means re-aligning tile sizes to match, more work than the payoff right now
- [x] Add a credits line somewhere (README or in-game) — CC0 means attribution isn't required, but Kenney explicitly appreciates it

---

## Later — explicitly deferred (porting/deployment)
- [ ] Capacitor wrap for Android
- [ ] Touch target sizing/hit-area tuning for phone screens
- [ ] App icon, splash screen, store listing assets
- [ ] Performance pass on real Android hardware
- [ ] Play Store metadata, signing config, privacy policy
