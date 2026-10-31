# Project workflow

## Git publication authorized — 2026-10-31
- The user explicitly requested committing and pushing the completed MCP work to GitHub with a descriptive commit message. This supersedes the earlier no-commit/no-push restriction for this MCP publication only. Publish the reviewed MCP source, tests, environment example, deployment notes and handoff; preserve unrelated untracked hardware, history and local files.
- The MCP publication follows baseline b9ff2ac on release/frontend-0.5.1. Earlier statements that this MCP increment exists only locally describe the pre-publication state. Deployment and acceptance boundaries remain in docs/operations/mcp-deployment-20261031.md.

## Server MCP deployed — 2026-10-31
- Latest MCP state: docs/operations/mcp-deployment-20261031.md. qixia-mcp.service is enabled and runs from the real independent release 0.5.1-20261031-mcp1, calling 127.0.0.1:18787. Website current remains 0.5.0-20261031-r2. Computer shutdown no longer stops server MCP.
- Five tools discovered; 31 local backend tests and 8 server MCP tests passed. At 12:04:17 Asia/Hong_Kong explain_current_place succeeded; user confirmed normal Mingjing Lake audio. Later explain/search calls succeeded too. Two observed WSS disconnects recovered in about 5 seconds each; root cause remains unverified. This is one confirmed voice use case, not navigation/ACK/memory acceptance.
- Runtime fixes cover field mapping, explicit unsupported filters, complete paginated replies, full-envelope byte budget, environment precedence, validation, safe audit and supervisor recovery. The older undeployed/local-only statements below are historical. No Git commit/push in this deployment.
- MCP unit uses a fixed independent release path; do not duplicate a current symlink with cp -a and treat it as a new directory. Never start a competing local bridge on the same token. Private server env remains outside releases and source handoffs.

## Backend / MCP handoff — 2026-10-31 end of session
- Continue from docs/handoffs/backend-mcp-handoff-20261031.md. Latest observed local HEAD is b9ff2ac on release/frontend-0.5.1; older HEAD statements below are historical. This session makes no commits/pushes.
- Local Xiaozhi WSS is online and five tools were discovered (user screenshot), but StopWatch is elsewhere; business tool calls and voice acceptance are not verified. Server MCP is not deployed. Shutting down this PC stops its MCP only, not the existing server website.
- Before deploying MCP, address handoff section 4: entryGate/gate mismatch and ignored filters, result byte limits/nested payloads/duplicate structured output, child API-base configuration propagation, validation/recovery and truthful audit/source semantics. Tool discovery and the prior 25 backend tests do not establish full acceptance.
- Preserve agreed six-stage implementation order in the handoff. Private .env.local and SSH identities never enter the source handoff archive; teammates need the baseline project plus reviewed incremental files.

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
