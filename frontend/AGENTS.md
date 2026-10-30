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
- Use neutral visitor wording without specifying party size. Use organizer-provided photos and factual stories; do not invent romantic folklore.
- The requested navigation direction is a real map with numbered markers and a bottom place sheet, inspired by Promptrip and styled consistently with the current app. The user selected AMap (Web JS API 2.0), with team-backend walking route calculation; do not treat the static illustration as routed navigation.

## Full guide update — 2026-10-29
- Show only concrete destinations with a matched Qixia AMap POI; preserve all original organizer photos and source archives even when their old destination card is removed. Keep photo provenance outside visitor UI.
- Temple is third in the default list; other religious entries remain at the end. Do not distort physical walking routes to enforce content-list order.
- Use actual bundled audio files and media events for narration. Keep action widths stable through play/pause/loading/error states.
- Weather is a compact expandable strip on Explore, using real district data and report times, never fabricated conditions.
- Hardware handoff P7-test07 uses Android phone GPS and a local QMAP map-chunk channel. Do not repeat the earlier unsupported external-GPS assumption or claim web-to-watch route sync exists.
- Root .env.local owns credentials. Only the public browser Key may be returned by /api/config; never expose securityJsCode or the Web service Key.

## Approved mobile layout and navigation update — 2026-10-29
- Preserve the existing visual direction. Welcome and map occupy the available viewport; only expanded route lists scroll locally. Explore and active conversations may scroll. Hide horizontal category scrollbars without disabling scrolling.
- Explore separates stories from facilities. Use AMap POI coordinates in the Qixia scenic area; do not require field-verified entrance positions. Never substitute points outside the scenic area for unmatched names.
- Import at most five AMap photos per node; preserve all organizer photos. Use one clearly illustrated Qixia placeholder for missing photos, labelled as illustration. Missing photos are no longer a reason to remove a place.
- Keep the native AMap attribution visible in the map; no enlarged branding or debug labels.
- Offer manual ordering and exact shortest walking-distance ordering with the first stop fixed and optional return. Use real road distances, never straight-line substitutes.
- Use neutral visitor copy without assumptions about their pace.
- TTS replacement is deferred until the user's team meeting; keep all current narration audio unchanged.

## Approved implementation — 2026-10-30
- Keep TripTrace-inspired vertical itinerary structure within our existing white/serif/rose style. Do not introduce its branding or multi-day travel-account features.
- Hide empty facility categories; deduplicate destination identity by POI ID while keeping category tags.
- Phone location is opt-in; convert browser WGS84 to GCJ02 before displaying on AMap or comparing distances. Say straight-line distance; never substitute it for road routes.
- Route page has local list scrolling, short-screen controls collapse after planning. Arrival times are estimates, checked visits are manual, planned route distance is not actual tracked mileage.
- Official miniapp visible names/addresses were transcribed; ambiguous matches remain in maintainer audit, not visitor cards. Per-node AMap imports remain limited to five photos.
- Tour reports/photos are browser-local. Team upload/device adapters are inactive until authenticated backend services are supplied. Do not claim cloud upload, device ACK, photo stickers or public deployment are available.
- Preserve audio unchanged while the team chooses its voice provider. No automated commits or pushes.

## 0.4.0 implementation decisions — 2026-10-30
- User authorized the approved refinements and prioritized knowledge ingestion. Default chat is bounded `/api/knowledge/chat`, sourced from backend/knowledge/qixia-kb-mvp-v1; no free-generation model is claimed.
- Mobile header is one row; Explore header scrolls away while its collapsible category map sticks at top. Initial dots have no numbering; close points group without falsifying coordinates; visible cards highlight the matching POI.
- Auto-request GPS on Explore/Route entry with explicit permission handling. Convert browser WGS84 via same-origin backend before AMap/distance use. Keep a single route locate action and stable sorted lists.
- Place selection toggles both ways, facilities share state, gates belong at itinerary endpoints, and selection has no eight-item cap. Retain legacy endpoint capacity honestly pending formal preset data.
- User's meeting strategy supersedes the earlier live shortest-path requirement: finalized presets/matrix are still pending. Candidate routes in the incoming knowledge pack are not finalized and must not be enabled silently.
- New report uses fixed configuration metrics and exports a photo/text PNG. Keep old local visit/photo records accessible. Paid TTS, stickers, generative agent and watch sync remain unconnected.
- Keep source files in place, write change descriptions, do not make Git commits/pushes for the user.
