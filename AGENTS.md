# Project workflow

## Project and versions

- Edit the canonical project in place; do not create a GitHub publication mirror.
- Read docs/project/交付版本说明-20261102.md for the published source baseline and acceptance status. Local workspaces may remain on an earlier branch; verify HEAD before making functional claims.
- Preserve the latest integrated frontend, backend, MCP, firmware, Android and scenic interaction. Do not replace them with older local copies.
- On 2026-11-02 the project owner confirmed physical joint acceptance complete. Historical handoffs describe earlier states; do not invent the commit identity of any unuploaded acceptance fixes.
- Versions stay with their module; version-specific handoffs stay with the version. Small collections remain flat. Authored filenames use hyphens, YYYYMMDD dates and suffix versions; modeling v01-v05 denotes integer editions.
- Existing historical directories and release identifiers retain their context. Preserve tool-required filenames, binary package integrity and licenses.

## Publication and local data

- The user authorized publishing the reviewed project deliverables and four demonstration videos on 2026-11-02, with meaningful commit and release notes. Later unrelated publication requires its own authorization.
- Preserve local modifications, untracked work and nested Git histories. Never accidentally stage a nested repository as a gitlink.
- Local cleanup reports, move/delete/duplicate inventories, conversation records and operation/hash ledgers remain local. Do not link public indexes to unpublished files.
- .env.local, private keys, signing material, server private files, visitor data and caches remain outside Git. Preserve ignore coverage when moving files; publish .env.example only.
- Compare every archive member before deleting duplicates. Keep independently usable manufacturing/release packages intact.
- Project intermediates belong in .local-work. Do not clean shared runtimes, original attachments, chat history or synced sources.

## Integration and operations

- Uploading source or media does not authorize deployment, hardware flashing or changing repository visibility/access.
- Follow docs/project/第二次筹备会纪要-20261029.md for route strategy; preserve supplied route data and the team's scenic interaction.
- Never start a competing MCP bridge on the same token. Keep server secrets and shared runtime data outside releases; a current symlink is not an independent release.
- Before SSH work activate the local tools/skills/ssh-operation-logging/SKILL.md. Use the existing original wujiaxuan identity; never regenerate a rejected key or ask for a passphrase in chat. Machine-specific identity metadata stays local.
- Use targeted checks appropriate to changes. Historical build and acceptance receipts are evidence of their original run, not new test results.
