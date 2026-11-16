# Ember Yard — a three.js tactical FPS

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/pranatakripto95/ember-yard-fps-02/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/pranatakripto95/ember-yard-fps-02/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

An entry in [make.fun's "Make the best three.js tactical FPS" bounty](https://make.fun/bounty/threejs-fps-02) ($1,000 in USDC).

A round-based tactical shooter in the Counter-Strike style, with an
original map, art and names. You are Vanguard, attacking with two bot
teammates (Ash, Bram) against four Rustjackal defenders (Rook, Vex, Kite,
Dusk) in a 36×28 m dusk container yard with three lanes and two bomb
sites (A west, B east).

## How to play

Serve `game/` with any static server (`node serve.ts`, then open
http://localhost:8080) and click to play — desktop Chrome, single-player
against bots, no network.

- **WASD** move, **mouse** look, **click** fire, **right mouse** aim
- **1 / 2** rifle / pistol, **R** reload, **G** smoke grenade
- **E** hold to plant the charge at a site (3 s); enemies defuse in 4 s
- **B** buy menu (12 s buy phase), **Ctrl / C** crouch
- First to 5 rounds wins. Rounds end by elimination, plant + 35 s
  detonation, defuse, or the 100 s timer.

## Economy

$800 start; $300 round win, $150 loss, $100 per kill, $300 plant.
Buy rifle/pistol ammo, armour (+50), smoke grenades and field kits.

## Gunplay

Hitscan rifle (30 rnd, automatic, 34 body damage) and pistol (12 rnd,
semi-auto, 28 body damage), 2.5× headshots against torso/head hitboxes,
recoil, heat and spread that punish firing on the move. Crouching and
aiming tighten spread; stopping to aim pays. The crosshair opens as
spread grows, impact sparks mark where shots land, and every shot,
hit, kill, reload, plant and round result has a synthesised WebAudio
sound — no audio files, no network.

## The yard at dusk

A gradient sky dome, a low sun over the west wall and a rooftop skyline
replace the flat black sky, and big A / B markers float above the two
sites so the objective reads from spawn. An eliminated player
spectates a living Vanguard teammate, and a banner names each round's
winner in play.

## Bots

Bots walk waypoint routes through the lanes, hold the sites, react to
gunfire (they investigate the shooter's position), and walk to a planted
charge to defuse it. Bot behaviour is seeded per match, so replays vary.
Balance is sim-verified: the 2-v-4 bot-only baseline wins 32.6% of
rounds, so with an average player Vanguard is competitive.

## Files

- `game/index.html` — page + HUD
- `game/src/main.js` — boot, fixed 60 Hz sim loop, shooting, screenshots
- `game/src/player.js` — movement, crouch, health/armour
- `game/src/weapon.js` — rifle/pistol, spread, recoil, buy items
- `game/src/bots.js` — bot AI, sight, bursts, routes
- `game/src/match.js` — rounds, economy, plant/defuse, score
- `game/src/hud.js`, `input.js`, `effects.js`, `grenade.js`, `palette.js`
- `game/src/audio.js` — synthesised WebAudio sounds (shots, hits,
  reloads, plants, round stings); no audio files
- `game/src/world.js` — the yard, colliders, dusk lighting, sky dome,
  sun, skyline and site markers

three.js 0.187.0 is vendored under `game/vendor/three/`.
Screenshots in `screenshots/` are real renders of this game, taken in a
headless browser with `?shot=start|play|end&seed=1`.
