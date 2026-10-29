# Visitor guide update — 2026-10-29

Frontend/backend package version: 0.2.0. No Git commit, push or server deployment was performed by this update.

- 38 original scenic/story entries retained; 26 have a selected AMap navigation POI.
- 21 service entries: 9 toilets, 8 parking-related POIs, 2 entry/ticket offices and 2 other visitor/ticket services. Entry/ticket offices also appear under visitor services.
- No reliable dedicated accessible-toilet, drinking/rest, medical or mother/baby POI was found in this import; categories show a clear empty state. No facility is invented.
- All 41 unique organizer photos retained. 109 AMap photos used; at most five imported AMap photos per node. Some original organizer galleries contain more than five images and remain intact.
- Missing images use the built-in-imagegen Qixia landscape illustration, labelled as illustration. Final file is frontend/public/assets/qixia-illustration.png; generation prompt saved in frontend/design-assets/qixia-illustration-prompt.txt.
- All 38 narration WAVs unchanged; voice replacement deferred to team discussion.
- Welcome document height equals viewport at 375x550 and 390x844. Map document height stays 550 at 375x550. Expanded route list clientHeight 181, scrollHeight 407, overflow-y auto.
- Collapsed small-screen card area revised after screenshot QA: clientHeight 124, scrollHeight 124, first card height 108.83, no clipped card. Native AMap attribution stays visible above the sheet.
- Frontend 16 tests and backend 5 tests pass; Vite/Sites build passes.
- Real AMap route validation: mirror-lake → palace → temple = 1001 m; optimized mirror-lake → temple → palace = 665 m, saving 336 m. Peach Lake route and toilet-to-temple route also return real geometry. Return-to-start tested.

Node inventory and unmatched list: navigation-nodes-20261029.md and navigation-catalog-audit.json. QA screenshots: frontend/qa/mobile-welcome-20261029.png, mobile-route-20261029.png, mobile-facilities-20261029.png.
