# Visitor guide 0.4.0 — 2026-10-30

Changes are in the canonical frontend/ and backend/. No project mirror or Git commit/push was created. The user's approved implementation prioritizes the supplied knowledge package. Planning precedence remains the second meeting minutes, then later explicit user decisions.

## Implemented

- Team knowledge package: twelve POI narratives/explanations, alias registry, preference profiles and FAQ rules. The default chat endpoint is now `/api/knowledge/chat`. This is bounded deterministic retrieval, not a newly connected generative model. The existing service adapter can later point to the team's text agent.
- `backend/src/knowledge.mjs` reads the supplied data in place. `backend/scripts/sync-knowledge.mjs` builds the public projection before the frontend build. Internal source paths, verification backlogs and maintenance action fields are excluded from that projection.
- Verified the new bell-tower POI with AMap: `B001912JBJ`, GCJ02 `[118.957481,32.151692]`. `bell-drum-tower` denotes the adjacent building group, while navigation ends at the bell tower. No ambiguous restroom was added.
- Existing facility catalog stays canonical; unresolved knowledge facility IDs do not create speculative new nodes. Existing original organizer photos/audio and knowledge source files are unchanged.
- Mobile single-row 56px header, matching Explore/chat title spacing, slimmer category pills, stable selected-state feedback. Existing white/serif/rose style and bundled fonts retained.
- Explore's category map stays at viewport top after its header scrolls away, can collapse, starts with unnumbered dots, groups nearby points without changing their coordinates, and highlights the dominant visible card with a named pin. Facilities use the same map behavior.
- Browser GPS is requested on entering Explore/My Route. Same-origin `/api/location/convert` converts WGS84 to GCJ02 using the configured server-side AMap key; the previous failing SDK callback is no longer on the location path. Location errors distinguish insecure context, denied permission and timeout. Cards show straight-line distance. Filtered ordering uses a stable location anchor, refreshed deliberately rather than jumping on each GPS sample.
- Route page has one locate action, fixed entrance/exit selectors, toggle-to-remove selection, consistent facility selected state, a shortcut/custom stay-time dialog, and no arbitrary eight-place selection cap.
- Fixed report lives under My Route and the header menu. `frontend/src/content/report-template.json` owns all fixed metrics/stops/text. Current placeholders are 3,200 m / 180 minutes / five stops. PNG export includes photos and uses the same configuration. These are planned template values, not tracked GPS mileage. Old visit records and browser-local photos remain accessible.

## Deployment status

0.4.0 is deployed at https://43.160.252.245/ using the existing jxwu application and shared server-side AMap configuration. The original wujiaxuan key was unlocked through the local masked prompt; no password was persisted or new identity created. The release archive hash was checked before extraction, staging knowledge endpoints passed, then the existing systemd service switched to the new release. 0.3.0 remains on the server for rollback.

Public HTTPS browser acceptance passed: 56px single-row header, viewport-bound welcome/routes, knowledge-grounded reply, actual AMap rendering, same-origin GPS conversion with a simulated location, one blue user dot, straight-line card distances, sticky category map, two endpoint selectors, one locate action and PNG report download. No browser errors. This does not replace a real-phone GPS permission/accuracy test. Private operation streams/hashes were re-read and verified; the deployment receipt is `.local-work/operations/verification-v04.json`.

## Route strategy and pending data

- Team final preset routes, distance/time matrix and road geometry are still outstanding. The candidate `10_route_time_presets.json` is retained as source material and is not activated.
- No new live shortest-route algorithm was expanded. The old AMap compatibility endpoint still accepts at most eight distinct nodes, including gates. Larger selections are preserved and show a clear unavailable-connection message. Removing the product selection cap does not assert that this older endpoint has unlimited capacity.
- Knowledge recommendations select POIs from the preference/timing rules and expose dwell time separately. Walking/total time remain null without actual road data; no time is invented from straight-line distance. Meal, rest, contingency and exit reserve will be combined with the team's finalized preset values.
- The incoming architecture/harness folder contains design documents, not runnable backend modules. Authentication, team generative agent, MCP/watch ACK/progress, independent sticker generation and cloud storage remain integration work. Existing narration audio is unchanged pending the team's voice choice.
- Next continuation: remind the user to supply finalized preset route data and the completed scenic interactive easter egg. Voice choice remains marked for the team discussion.

## Validation

- 33 automated checks passed for content/audio, map contracts, provider failure, knowledge projection/aliases, dynamic-information boundaries, valid-coordinate facility ranking, preferences, cancellation, selection above eight, road ordering and Sites packaging.
- Edge browser QA at 390x844, 375x550, 844x390 and 1366x900 covers header layout, spacing, sticky/collapsible maps, visible-card highlighting, toggle selection, facility selected state, eleven route stops, entrance/exit selectors, stay-time saving, knowledge chat, report PNG download and browser errors.
- Simulated browser GPS successfully reached the actual AMap coordinate conversion endpoint and displayed a blue location dot and card distances. This verifies the software path; real iOS/Android/WeChat permission and signal behavior still needs acceptance on a phone.
- Private screenshots/results are under ignored `.local-work/`, not committed publication copies. Build outputs are under ignored frontend/dist/.
