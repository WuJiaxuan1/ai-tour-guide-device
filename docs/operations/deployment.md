# Deployment and iteration

This project has a React/Vite browser application and a small Node service for protected AMap calls, weather and road planning. It already includes backend code. A frontend-only static host cannot replace these same-origin API and AMap security-proxy routes.

## Runtime layout

Use the assigned Linux user's home directory, for example ~/apps/ai-tour-guide-device/, without moving the received hardware or modeling folders there. Runtime requires backend/src/, backend/data/navigation-nodes.json, backend/package.json, frontend/src/content/{places,facilities}.json, and the compiled frontend/dist/client/. The backend resolves these paths relative to its own location. Node 22 or newer is required.

Keep .env.local outside public static files, readable only by the app user. Never copy keys into frontend source or logs. Run backend/src/server.mjs bound to loopback and expose it through the team's HTTPS reverse proxy. Both /api/ and /_AMapService/ must reach the Node service. Preserve WAV range support. Inspect existing listeners, reverse-proxy configuration and certificate access before selecting a port or changing a shared service.

## SSH workflow

Activate the team-provided ssh-operation-logging skill before any SSH/SCP operation. Private scripts, separate byte-exact stdout/stderr and operation records belong in the ignored local operations directory, never the public repository. Preserve strict host-key checking using the verified host record. A trusted host fingerprint does not establish that a user public key is authorized.

## Release workflow

1. Build frontend in the canonical project and run appropriate tests.
2. Stage only runtime files as one temporary transfer archive if needed, excluding .env, Git metadata, organizer archives, logs, node_modules, modeling and hardware builds. Do not create a GitHub publication mirror.
3. Transfer through the logged SSH workflow; provision credentials separately with restricted permissions.
4. Run the new version on an available loopback port and check health, configuration redaction, weather, road geometry, static files and audio ranges.
5. Have the server's existing reverse proxy expose the application through valid HTTPS. Root-owned certificate paths need permission arrangements by the administrator; do not grant broad access to certificate private keys.
6. Validate from an external phone, including location permission and native AMap attribution, before handing out a QR code.

Later edits use the same build-and-transfer process. Keep the prior working release until the new HTTPS route passes checks; rollback selects that release. Git upload and server deployment are separate operations.

Current deployment state and non-public connection details are kept in ignored local operations records. This document does not imply a working public URL.
