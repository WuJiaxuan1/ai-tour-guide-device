# Prototype Instructions

## Local route refinements — 2026-11-01
- Adopt autumn-preview-v2 visual palette only: cream #fffaf0, paper cards #fffdf7, maple red #a84333, wheat selection #f5e4bc, brown text #40362d, dashed dividers and scrapbook imagery. Preserve current feature placement, live maps, visible search, timeline and all handlers; the reference preview is not a replacement implementation. Style-only integration lives in autumn-theme.css.
- Use a shared left-side route timeline for official details, planned personal routes and active tours. Keep green start/orange end icons and occurrence IDs for repeated stops. Planned personal routes show actual order immediately with editing collapsed; progress reflects explicit visited/skipped/next-stop server states, never inferred GPS arrival.
- Completing a tour opens History after successful completion; label the action 结束游览并查看历史行程. Use 枫叶精灵 for all visitor-facing device names, including pairing instructions and exported records; internal API identifiers stay unchanged.
- Move shuttle services to Explore > 游客服务 > 接驳车; My Route has only official/custom tabs and History as its sole heading-side action. Each historical trip has two feature cards: 游览报告 and 专属手账, replacing 查看行程记录.
- Reports opened from history use that trip's authoritative snapshot, not the fixed sample. Preserve fixed report styling/PNG export and sample fallback. Journal keeps existing local photo/fixed-card behavior and shows selected trip context; do not claim historical photo persistence or real image generation. Reading history must not switch current tour or device binding.
- Personal-route UI should avoid repeating location/unavailable-estimate messages below stops. Show one location/pause notice and distinct available guidance in a next-stop card; keep action hierarchy clear.
- Xiaozhi pairing uses a styled two-step card, labelled eight-digit field and inline pending/error/success states. Show success only after a real successful response, never confuse it with device online status. Do not change pairing APIs or connect production devices during UI checks.
- User requires official recommendations to omit stops without known coordinates. Preserve raw source evidence outside the visitor route; runtime routes remove these stops.
- Entrance and exit are selected separately from west/south gates; same-gate round trips are explicitly allowed. Route planning and persisted trips must retain both selected endpoints.
- Use the AMap ticket-office anchors in backend/data/routes/gates.v1.json, with clear provenance; do not describe them as surveyed entrance boundaries.
- My Route map uses Explore's unnumbered dot markers. Use a green arrow for start and orange flag for end; separate overlapping round-trip icons without moving coordinates.
- This change is local on integration/local-web-debug-20261101; no publication/deployment is implied. See docs/operations/local-route-gates-20261101.md.

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

## 0.5.0 implementation — 2026-10-30
- My Route now has official presets, custom selections and directional shuttles. Eight source sequences are browseable, but navigation remains disabled without verified roads/exit data. Keep unknown filter combinations distinct from explicitly empty results.
- Client and backend share pure preset/matrix rules in shared/routes.mjs. Preserve repeated stopId occurrences; only legacy records use place id for visits/photos.
- Preserve white/serif/rose design. The new route workspace scrolls inside main-route; do not reintroduce old absolute bottom-sheet padding over it.
- Keep image originals; predev/build generate ignored responsive derivatives. Font core subsets retain full on-demand fallback. Rebuild before deploying, and test actual currentSrc/cache behavior.
- Xiaozhi is the chosen future text provider but its web transport is not connected. Current multi-turn support is bounded rules, not an LLM or cross-device memory. Handset/watch still require Android and lack route ACKs.

## Local watch navigation — 2026-11-01
- The route page now includes WatchNavigationCard with server map state and trip-scoped configuration download. This does not replace the voice pairing UI or imply that the watch has physically displayed the map.
- Keep explicit waiting-location/preparing/paused/ready/ACK states; no fabricated GPS or routing success. See docs/operations/watch-navigation-p9-cloud01.md.

## Unified connection card — 2026-11-01 P9-cloud02
- Supersedes the cloud01 WatchNavigationCard/download workflow. Only existing 连接我的枫叶精灵 remains, with one voice-issued 8-digit code for voice and map. GET pair-device restores actual binding after refresh; watch state appears within its success card.
- Show received only after matching server ACK, not simply after pairing. Preserve explicit pending/error/expired/legacy voice-only states. No visitor JSON export, server URL or secret-token inputs. See docs/operations/watch-navigation-p9-cloud02.md.
