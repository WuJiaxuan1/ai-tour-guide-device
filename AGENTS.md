# Project workflow

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
