# Project workflow

## Selective frontend restoration — 2026-10-31
- Latest user whitelist keeps server chat/about/history notice, temple immersive tags/experience/archive/mobile optimizations, active tour controls/map/location/navigation text/sync/recovery/pairing, server trip history/deletion, engineering/styles/assets. Restore all other frontend behavior to baseline 05398bb, including card add/remove, chat draft adoption, original preset wizard/filtering, personal route editing/planning, fixed ReportPage and PNG export. Keep JournalPage unchanged.
- Active entry is RoutePage with shared ServerTourControls, not ServerRoutePage/ServerPresetRoutePanel. ServerMemoryPage/PhotoStudioPage remain inactive history; no new photo development. Historical trip details use ServerTripRecord without model-summary/TXT controls.
- Minimal backend compatibility POST /api/v1/trips/from-selection recreates routes with the existing server road planner; never trust browser geometry. This connects restored personal-route UI to the retained authoritative trip, location and Xiaozhi tools.
- Continue only on codex/full-implementation-photo-r12. This round is source/local-preview work; production remains photo-r12 until a separate deployment. See docs/operations/frontend-selective-restoration.md.

## Current publication authorization — 2026-10-31
- Latest user instruction: publish ONLY to `codex/full-implementation-photo-r12`, not main. The initial main push completed before this correction arrived; it was reverted with a normal commit, restoring the exact original main tree. Further implementation changes belong on this branch. Do not push or merge implementation changes to main without new explicit authorization.
- User explicitly requested publishing the complete current frontend, backend and supporting implementation to WuJiaxuan1/ai-tour-guide-device. Commit/push and normal GitHub authentication are authorized for this task; historical no-push notes below are superseded for this publication.
- Keep photo-r12 behavior unchanged. Exclude credentials, personal photos, SQLite/runtime data, node_modules and generated builds. Preserve existing repository history, hardware and modeling files. Do not redeploy production as part of source publication.
- Canonical project is this directory; use its .local-work for temporary files. Old machine paths and release-specific deployment helper paths below are historical. README and docs/operations/current-release-setup.md describe reproducible setup.

## Current user decision and deployment — 2026-10-31 photo-r12
- User rejected the photo-layout result and explicitly requested restoring the original demo and NO further improvements to this module. Do not resume photo development without a new explicit user request.
- Production photo-r12 restores unchanged JournalPage at My Route > 专属手账 (local preview, fixed original card). PhotoStudioPage is inactive; new photo upload/generate POST endpoints return410; existing stored photos/read/download/delete remain, no user data deleted. Other modules/MCP preserved.
- Local62 backend +36 frontend/build, Linux62 backend,8 staging and8 public rollback checks passed. JS index-Dklwdpot.js, CSS index-CoXqW1vl.css. Read docs/operations/deployment-20261031-photo-r12.md. No Git push.


## Current update — 2026-10-31 photo-r11
- Production photo-r11, rollback photo-r10. Fixes valid 8192x5464 camera JPEG rejected by the old24MP cap. Cap now60MP with explicit dimensions error, bounded decoding/1600px processing;8MB byte limit unchanged.
- User original tested locally and outputs visually checked, personal image never included in source/assets. Synthetic same-size image passed server62 backend tests and15 staging/public checks; local62+36 tests/build passed. User phone retest pending.
- Read docs/operations/deployment-20261031-photo-r11.md. Current JS index-DwVh9WWD.js; keep shared data/pairing and latest cumulative patch. Fonts still photo-r10-assets.zip.


## Current update — 2026-10-31 photo-r10
- Production is 0.5.2-20261031-photo-r10, rollback memory-r9. Read docs/operations/deployment-20261031-photo-r10.md and architecture/backend/14-independent-photo-craft.md.
- User chose independent photo creation without a route. Real photo layout, card and transparent framed photo PNG, server gallery, retry/download/delete are deployed. No AI redrawing/subject removal/image provider is claimed. MCP pairing unchanged.
- 61 backend + 36 frontend checks and build passed; 61 Linux backend, 14 staging and 14 public API checks passed; 3 extra public upload-size checks passed after exact photo endpoint Nginx limit was set to 8m (others128k). Linux output visually checked. Browser page QA blocked by auto-review; phone acceptance pending.
- Memory-r9 user feedback still pending, immersive accepted. Live maple/activity deferred. No Git push. Handoff now also requires photo-r10-assets.zip for the server font and package lock/dependency changes.


## Current update — 2026-10-31 18:40 CST
- Production now memory-r9 (r8 backend plus final legacy-export frontend fix). Direct rollback memory-r8; pre-memory fallback immersive-r7. Read docs/operations/deployment-20261031-memory-r8.md.
- Item 4 travel memory is implemented/deployed: explicit note interests, channel/pause counts, immersive choices, snapshot/stale summary, pending-job coalescing, full text export and history. 92 local checks; 56 server checks; 14 staging/public real-model checks on unchanged r8 backend; final r9 4 staging/public read-only checks. User device acceptance pending for memory only.
- User confirmed item 3 immersive-r7 actual tests passed. Next item after memory acceptance is photos, with no image provider; no independent proactive speech or dynamic info work authorized by inference.
- Shared data/pairing preserved, no Git push. Existing cumulative patch and immersive-r7-assets.zip remain the handoff pair.


## User acceptance and next item — 2026-10-31
- User confirmed immersive-r7 real-device tests passed, including mobile performance and query-time hints. Do not continue listing this round as awaiting user acceptance.
- Original ordered plan item 4 is now active: validate/improve travel memory, actual visits/time, voice notes, web interactions, immersive choices, text download and history reopening. Photo creation is item 5 (no image provider yet); live maple/activity remains deferred.

## Current update — 2026-10-31 18:18 CST
- Production is immersive-r7, stable fallback immersive-r6. Read docs/operations/deployment-20261031-immersive-r7.md. 87 local checks, 53 server checks, staging/public each 15 passed. Shared data/pairing preserved, no Git push.
- User reported mobile lag; mobile backgrounds, staged image loading, reduced full-screen effects and immediate post-commit response are implemented; real-phone performance acceptance pending.
- User prefers query-time hints: fresh temple proximity adds a short hint to location/next-stop answers even after web dismissal; completed experience suppresses it. navigation-context.immersive_hint and guidance carry the hint for MCP. No device-push capability claimed.
- Latest handoff assets are immersive-r7-assets.zip; retain r6 as historical.


## Current update — 2026-10-31 17:49 CST
- Website/backend is `0.5.2-20261031-immersive-r6`; stable fallback navigation-r5. Shared data and mcp-r2 preserved; no Git commit/push. Read docs/operations/deployment-20261031-immersive-r6.md.
- User supplied immersive-demo and authorized web-first integration while device firmware is unknown. Team temple story is integrated; only temple scenic cards and routes containing temple have pills. Active/fresh proximity prompts once per trip; choices/completion persist. Original input preserved.
- 83 local tests/build, 52 server tests and 12 staging plus 12 public API checks passed. Real browser visual/hold/audio checks were blocked by computer-use URL verification; no workaround used. User phone/device acceptance pending.
- Proactive device speech remains not_connected. Query-triggered travel answers can mention pending experience. See docs/architecture/backend/12-immersive-device-delivery.md; do not equate MCP tools with a TTS push channel.
- Source handoff includes cumulative text patch AND immersive-r6-assets.zip under workspace docs/artifacts; shared module and public HTML/JS/CSS/WebP/WAV must survive UI merging. Do not overwrite teammate changes.

## Current session update — 2026-10-31 14:54 CST
- User authorized deployment and continued frontend logic changes. Production current is now `0.5.2-20261031-trip-r1`; see `docs/operations/deployment-20261031-trip-r1.md` before touching the server. Preserve old release and shared/travel-data.
- This workspace uses the user-authorized encrypted Codex SSH identity and pinned host keys via workspace-root scripts; older Macaroon/wujiaxuan/F-drive entries below refer to another machine and are historical.
- UI remains under active development. Preserve the new /api/v1 adapters and authoritative server trip state when merging layout work. No Git commit/push was made.
- Xiaozhi platform discovered five new tools; physical voice verification is pending. The new webpage supports an 8-digit code issued by qixia_pairing_code. Image provider and proactive speech remain unconnected.
- Subsequent user confirmation on 2026-10-31: physical voice pairing succeeded and Xiaozhi's next stop matched the website. Mark only pairing and next-stop query as physically verified; other voice/location operations and long-term stability remain unverified.

- Edit the canonical project in place. Do not create a separate GitHub publication copy or mirror the full project for routine edits.
- The user wants to learn GitHub uploading personally. Provide file selection and step-by-step instructions; do not push, publish, create remote commits, or run authentication on their behalf unless they explicitly request that action later.
- Put project-specific temporary output under this project's .local-work/ on F drive. Avoid writing project intermediates to the C-drive chat workspace.
- Preserve useful missing versions under the existing modeling/frontend/docs organization, check bytes before removing duplicate working files, and remove disposable intermediates when finished.
- Codex shared runtime caches, original user attachments, chat history and synced sources are separate from project working files; do not delete or relocate them as routine project cleanup.

## SSH identity decision — 2026-10-30
- Use the original wujiaxuan key at C:/Users/Macaroon/.ssh/ai-tour-guide_ed25519 for this project. The user rejected and requested deletion of the separately generated Codex identity; do not regenerate or select it.
- Activate project-files/team/server/ssh-operation-logging/SKILL.md for SSH work. Private connection settings and pinned host metadata are in .local-work/operations/active-identity.json, ignored by Git.
- RSA host identity was matched against both user-supplied randomart diagrams. Existing wujiaxuan public key was accepted by the server; an encrypted private key still requires local unlocking. Do not ask the user to paste its passphrase into chat or logs.

## Next continuation reminders — 2026-10-30
- At the next continuation of this project, remind the user to supply the finalized preset routes (including point IDs, entrance/exit, road geometry, distance/time matrix and fixed report metrics) and the completed scenic interactive easter egg. The user requested next-conversation reminders, not a timed automation.
- All route-planning strategy follows docs/meetings/南客松第二次会议纪要.md. Preset route definitions are still being decided by the team. Do not independently finalize new routes or continue expanding the live route optimizer while waiting.
- Scenic interactive easter egg is being developed elsewhere by the team. Do not replace it with another implementation; await the finished page and integration details.
- Voice-provider replacement, independent photo-to-sticker service, generative text-agent integration and watch navigation acknowledgements remain unresolved; bounded local knowledge integration is implemented in 0.4.0; public deployment and IPv4 HTTPS 443 are resolved.
- The user accepts the proposed mobile header, sticky category map, card/map highlighting, GPS repair and neutral-copy directions, and explicitly authorized implementation after the planning discussion, prioritizing the supplied knowledge base.
- The next report should use fixed configuration metrics until the user supplies preset-route values. It belongs under My Route as a separate report view, while photo-to-sticker remains independent of trips.
- Added planning requests: toggle selected stops off consistently across cards/detail/chat/facilities; fixed entrance/exit selectors; facility selected-state feedback; improved stay-duration picker; remove the arbitrary 8-place product-selection limit while coordinating route service capacity with the preset engine.
- Root 11_后端接入说明.md is a reference proposal with older live-routing/2-to-8-place assumptions, conflicting with the meeting strategy. Do not treat those assumptions as user overrides. Review its POI ID mapping and time-budget details during the later team integration.

## Latest handoff and unresolved integration findings — 2026-10-30
- Read docs/handoffs/project-handoff-20261030-v0.4.0.md when continuing in a new chat. It covers the full frontend timeline, current knowledge limitations, backend/watch contracts and user-run Git Bash upload steps.
- The website is deployed as 0.4.0, but its source changes remain uncommitted locally. Do not mistake deployment for Git publication.
- Cold public mobile loading measured about 3.43 MB/30 resources, a 10.73s photo, uncompressed JS/CSS and no explicit static cache policy; the 2.9MB illustrated fallback is especially heavy. Performance is diagnosed, not optimized yet. Do not treat offscreen lazy images as failed requests.
- stopwatch-nav/firmware contains its own .git and uncommitted/custom untracked navigation code. Do not stage it as a gitlink and claim the outer repository contains complete hardware sources. Preserve its history/work before a separately agreed monorepo/submodule integration.

## 0.5.0 continuation corrections — 2026-10-30
- The older uncommitted-0.4 statement is historical: current HEAD is 91317a5, the user's 0.4.0 release commit. This task makes no commits/pushes. Preserve unrelated untracked hardware and history.
- Official source documents were moved byte-identically to docs/requirements/official-routes/official-shuttle-and-routes-v1.0.md and official-route-filter-matrix-v1.0.csv; original root copies were removed with user approval.
- Eight documented route sequences and eleven observed filter combinations are now ingested. They are browseable, not navigation-ready: verified road geometry/matrix and some place mappings remain missing. Preserve R05 count discrepancy and R06 missing return.
- User intends to reuse Xiaozhi. Do not choose another model provider or claim the web text transport is connected. Bounded multi-turn retrieval uses client history/context, not a shared unauthenticated server session store.
- Responsive images are generated by frontend predev/build and ignored by Git; never delete original source photos. Font first-screen subsets are checked in with full on-demand fallback; regeneration is explicit.
- Continue from docs/handoffs/project-handoff-20261030-v0.5.0.md for validation, deployment and remaining contracts.

## Latest deployment — 2026-10-31
- The user's latest working-tree frontend and road service are deployed as `0.5.0-20261031-r2`; see docs/operations/deployment-20261031.md. Previous release `0.5.0-20261030-r1` is retained. Package version remains 0.5.0; identify this deployment by release ID/assets.
- R02 has saved real road geometry; personal selections request real walking roads. Earlier statements that all routes lack geometry describe the older snapshot. Six official names remain without confirmed coordinates; preserve explicit failures and R05/R06 discrepancies.
- Build, 49 automated tests, staging verification, 18 public browser UI checks and 8 public live-service checks passed. GPS was simulated, not a real-phone acceptance test. Xiaozhi remains disconnected; journal is a local fixed-card experience.
- No Git commit/push was made; HEAD remains 91317a5. Original SSH identity used, temporary deployment agents closed. Private receipt: .local-work/operations/verification-20261031-r2.json.

## Current update — 2026-10-31 16:07 CST
- Website deployed as 0.5.2-20261031-history-r2; see docs/operations/deployment-20261031-history-r2.md. MCP stays mcp-r2, shared data preserved.
- User confirmed physical arrival-state sync, Mingjing Lake guide, and voice note reflected in memory. Field GPS/ETA, proactive voice and image generation remain unverified/unconnected.
- History/record deletion is implemented; preserve ServerHistoryPage and deletion API during UI edits. No Git commit/push.

## Current update — 2026-10-31 16:30 CST
- Website/backend now 0.5.2-20261031-location-r3; see docs/operations/deployment-20261031-location-r3.md. Preserved shared data and MCP mcp-r2. No Git commit/push.
- Real AMap reverse geocoding is connected; navigation-context location.address and the active route page expose a guarded approximate address. Freshness/accuracy checks still apply; field/device acceptance pending.

## User decisions after location-r3
- User confirmed all supplied location physical tests passed; next authorized item is navigation Q&A.
- Defer live maple/activity sourcing and Q&A. Await teammate immersive page; do not replace it. No server image provider yet; photo-card processing must not be claimed as AI sticker redrawing.

## Current update — 2026-10-31 17:12 CST
- Website/backend now 0.5.2-20261031-navigation-r5. Read docs/operations/deployment-20261031-navigation-r5.md; r4 was rolled back after clock-skew failure, do not use r4 as rollback target. Stable fallback is location-r3.
- Navigation guidance is shared by web/chat/MCP context. Pause/resume/new-fix lifecycle, completed next_stop=null, off-route streak and remaining metrics are implemented. 79 local checks; 51 server checks and 10 staging/public checks passed. Device navigation acceptance pending.
