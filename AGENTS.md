# AGENTS.md

How work gets done on Silent Bearing III. Everyone, human or AI, reads this page and the same rules apply to all.

## Who does what

- **Director (the repository owner).** Sets direction, decides between options, approves and merges pull requests, and decides when to release.
- **Claude: primary developer and architect.** Designs and builds features on branches and opens pull requests. Each pull request says what changed, why, and how it was checked.
- **Codex / ChatGPT: independent reviewer.** Reviews and tests pull requests and reports on GitHub, as review comments or issues, not in chat. The reviewer is a different model from the one that wrote the change.
- **GitHub.** Holds the code, issues, pull requests, CI and the Pages site. Decisions and findings live there, so nobody has to relay messages between agents.

## Rules for every change

1. Work on a branch and open a pull request. Nothing is pushed straight to `main`.
2. CI must be green: `npm run typecheck`, `npm test` and `npm run build`.
3. **The simulation is deterministic.** Code under `src/sim` advances on the fixed step (`DT`). All chance comes from the world's seeded generator, `w.rng`. It never calls `Math.random()`, `Date.now()` or `performance.now()`. The same seed replays the same battle (`tests/determinism.test.ts`). Rendering, sound and UI may use real time.
4. **No binary assets in the game.** Ship art, coastlines, effects and sound are generated in code. The world map is vector data from the `world-atlas` package. The only images in the repository are README screenshots under `docs/`.
5. **Saves keep working.** Campaigns are saved in `localStorage` under `sb3:campaign:<nation>`, and each save records `SAVE_VERSION`. A change to `CampaignState` must still load old saves, or it must bump `SAVE_VERSION` and add a migration in `loadCampaign`.
6. **Missions are validated.** `npm test` checks every mission's classes, aircraft, zones, tags and start positions, then plays each one to the end with the AI on both sides. When a pull request changes a mission or the battle rules, report the autoplay outcomes before and after. `tests/debug.test.ts` traces a single battle.
7. **Performance.** The largest battles (Midway, Samar, Surigao Strait, Convoy ONS 5) must stay smooth at 16× speed. Avoid allocating in per-step loops. Land checks read the precomputed terrain grid, and sightings are batched, both for speed.
8. **History.** Dates, ships, classes and names follow the historical record. Briefings and "What really happened" are short and factual.
9. **Visible changes come with screenshots.** `node tools/play.mjs <url> tools/flows/campaign.mjs` plays through a campaign battle in a headless Chrome and saves screenshots. `screens.mjs` covers the other screens, and `readme.mjs` regenerates the README images. Both need the dev server.

## Where things are

| Path | What |
| --- | --- |
| `src/core` | maths, seeded RNG, noise |
| `src/data` | ship classes, weapons, aircraft, nations, the war map timeline, the four campaigns |
| `src/sim` | the battle: world, sensors and fog of war, gunnery and torpedoes, aircraft, AI, objectives |
| `src/render` | canvas renderer, camera, ship drawings, effects |
| `src/ui` | the app shell, the screens and the battle HUD |
| `src/campaign` | campaign state, prestige, repairs, settings |
| `src/audio` | synthesised sound |
| `tests` | data validation, autoplay of every mission, determinism |
| `tools` | headless-browser screenshots and UI flows |

## Review checklist

- [ ] CI is green and the description says how the change was tested.
- [ ] Nothing in `src/sim` uses real time or unseeded randomness.
- [ ] Old saves still load, or `SAVE_VERSION` is bumped with a migration.
- [ ] Mission autoplay outcomes are reported for any change to missions or battle rules.
- [ ] No new binary files outside `docs/`.
- [ ] Screenshots are attached for UI changes.
