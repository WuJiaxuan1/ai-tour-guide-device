# Prototype Instructions

## Project decisions

- The user selected OpenUI Trip Planner's visual direction and rejected TripStar's appearance.
- Build a real mobile-friendly website that visitors open in their own browser, with desktop responsiveness. Do not wrap the production page in a simulated phone frame.
- Use original application code; do not assume the public reference repository grants reuse permission.
- Keep the airy white layout, serif display typography, rounded cards and soft pink composer action.
- Backend has not been provided. Keep local curated content distinct from live service in About; avoid development-status badges in the main visitor flow; keep the adapter isolated for the team's future API. Never report the live agent or public deployment as working before verification.
- Keep private keys, model credentials and secrets outside browser code and Git.

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## 2026-10-29 visitor-facing refinements

- Use the generated transparent mascot asset; preserve the original concept image.
- Bundle Noto Serif SC Variable for display text and Noto Sans SC Variable for body text so phones and computers use the same font files.
- The user requested removing all Chinese demo wording from the visitor UI. Do not imply live AI is connected when it is not; disclose the local content boundary in About.
- Focus suggestions on couples. Use organizer-provided photos and factual stories; do not invent romantic folklore.
- The requested navigation direction is a real map with numbered markers and a bottom place sheet, inspired by Promptrip and styled consistently with the current app. The user selected AMap (Web JS API 2.0), with team-backend walking route calculation; do not treat the static illustration as routed navigation.

## Full guide update — 2026-10-29
- Maintain all organizer point groups and theme coverage in src/content/places.json; preserve photo provenance outside visitor UI. Gallery contains all 41 unique ZIP photos; keep source archive unchanged.
- Temple is third in the default list; other religious entries remain at the end. Do not distort physical walking routes to enforce content-list order.
- Use actual bundled audio files and media events for narration. Keep action widths stable through play/pause/loading/error states.
- Weather is a compact expandable strip on Explore, using real district data and report times, never fabricated conditions.
- Hardware handoff P7-test07 uses Android phone GPS and a local QMAP map-chunk channel. Do not repeat the earlier unsupported external-GPS assumption or claim web-to-watch route sync exists.
- Root .env.local owns credentials. Only the public browser Key may be returned by /api/config; never expose securityJsCode or the Web service Key.
