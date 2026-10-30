# Visitor guide 0.3.0 — 2026-10-30

Implementation is in the canonical frontend/ and backend/ directories. No Git commit or push was made. Package version is 0.3.0; Git history remains the source of revisions, without v1/v2 copies of the whole frontend.

## Implemented

- Existing white, local Noto serif/sans fonts, transparent mascot and rose action style retained. Neutral visitor wording; no party-size or pace assumptions.
- Concrete navigable destinations only: 25 scenic entries and 34 independent facility entries, with a scenic entry also exposed under relevant facility tags. Removed 12 unresolved scenic entries and the generic panorama entry. Original organizer images and WAVs remain on disk.
- Official miniapp map guide was accessible. Visible parking, visitor-center, dining and toilet names/addresses were transcribed to official-miniapp-nodes-20261030.json. Matched records and unresolved names are listed in catalog-reconciliation-20261030.json. Unresolved names do not generate approximate POIs.
- Empty facility categories hidden. POI identity deduplicated with category tags retained. Dining added. Up to five imported AMap photos per POI; original organizer galleries retained; illustrated fallback remains labelled.
- Explore has a search field, category map preview, expandable map and place selection. Opt-in browser GPS converts WGS84 to GCJ02. Straight-line distances sort the current filtered results. Without location, default content order remains.
- Routes use a vertical photo timeline, manual up/down controls, start-gate choices for theme suggestions, available-time comparison, optional return, stay times and estimated arrival times. Settings collapse on short screens. Route lists scroll locally, with the page fixed to the viewport.
- Manual and fixed-first exact shortest ordering use AMap road distances. Provider legs expose walking distance/time; stairs/slope indicators only appear when provider walk_type explicitly supplies them. Ten-minute bounded road cache avoids repeat requests during local restarts. Straight-line distance is never used as a road substitute.
- Starting a trip locks route edits; visits are manually confirmed, and finishing opens a local report. Reports retain up to 20 previous trips. Photos are resized, stored in IndexedDB, reopen after refresh and can be deleted. Text report download identifies planned distance versus actual visits.
- Chat recommendations include clickable map cards; explicit route requests can offer a route draft that requires confirmation before replacing selected stops. Freeform agent service is still disconnected.
- Spring Bridge has an observation/story child dialog; it uses existing guide text and does not invent a historical plot.
- Team upload and device-sync adapters validate responses and distinguish queued from received. They are not active services.

## Remaining approved requirements and dependencies

- Public HTTPS deployment completed at https://43.160.252.245/ (the earlier :2500 address remains available) after the user unlocked the original wujiaxuan identity. The extra Codex identity was deleted at the user's request. The team opened IPv4 TCP 443, and the standard HTTPS address was externally verified. See ../operations/deployment-20261030.md.
- Real iOS Safari, Android Chrome and WeChat tests over deployed HTTPS remain necessary. Browser tests use Edge mobile viewports and simulated GPS; this does not establish real-phone GPS accuracy.
- Voice replacement stays deferred. Existing WAVs retained; no new paid speech service has been enabled. Facility narration requires actual audio content or the agreed speech service.
- Watch pairing, authenticated transport, route acknowledgements, progress synchronization and route revision ownership require the team backend/Android bridge. Adapters alone are not completed watch integration.
- Photo cloud upload, upload retries, server-generated stickers, cross-device report sharing and identity/storage retention require team service contracts. Current photos/reports are browser-local.
- Suggested routes are editorial themes with real destination IDs, calculated when selected; no official-route or difficulty certification. Budget is compared with walking plus chosen stay time; it does not solve a budget-constrained sightseeing optimization problem. Multi-constraint recommendations and precomputed route matrices remain follow-up work.
- Weather still uses district reports and forecast timestamps; it is not a mountain microclimate sensor. Unmatched miniapp names remain in the audit, not visitor empty-state messages.

## Validation

Frontend automated checks, backend road/optimizer checks and production/Sites packaging pass. Browser checks cover 390x844, 375x550, and 844x390: no whole-page scrolling for welcome/routes, no horizontal overflow, clickable chat maps, real AMap road planning and shortest ordering, manual visit report, photo persistence/delete and GPS conversion/sorting using a simulated park location. No browser page errors were observed. QA screenshots are in frontend/qa/v0.3-*.png.

## Previous requirements retained

0.2.0 report remains in visitor-update-20261029.md and all original material remains under project-files/. Later decisions supersede the old requirement to keep unmatched cards or show empty facility categories. No earlier Git commits or fabricated historical versions were created for this release.
