# Deployment — 2026-10-30

Public URL: https://43.160.252.245/

Compatibility URL: https://43.160.252.245:2500/

The frontend 0.3.0 and AMap/weather/walking service are deployed in the assigned user's home directory, with a protected environment file outside public assets. Nginx and the application are enabled for automatic startup. A valid IP-address certificate is installed. HTTP port 80 redirects to the HTTPS address above, while the ACME challenge path remains available for renewal.

The cloud firewall CSV supplied by the team allows IPv4 ports 2500–2510 and 80, but its 443 rule only covers IPv6. Direct external probes found IPv4 80 reachable and 443 timing out. HTTPS on available port 2500 has passed external browser acceptance. To remove the port from the public URL later, the cloud administrator must add IPv4 TCP 443 from 0.0.0.0/0; then adjust HTTP redirects and regenerate the QR code. No cloud-console credentials were requested or used.

Verified over public HTTPS: valid TLS, secure browser context, actual AMap display and a 3-stop walking route, live district weather, WAV byte ranges (206), and private environment-file requests returning 404. Only the public browser map Key is returned by /api/config. Real visitor-phone GPS permissions still need a phone test.

Short-lived certificate renewal uses the existing root ACME schedule, a dedicated webroot challenge path and a Nginx reload hook. The challenge path was checked locally. Future CA renewal itself has not been forced or claimed as tested.

Logs and private connection settings stay in ignored .local-work/operations/. No Git commit/push occurred. Main source remains in the original F-drive project. Later frontend changes are built and deployed to this same server; users continue using the same URL.

Team AI, watch synchronization, cloud photo upload and voice-provider replacement are still pending as described in the 0.3.0 requirement report. Deployment does not add these missing services.

## Standard HTTPS port verified

On 2026-10-30, after the team updated the Lighthouse firewall, external requests to port 443 returned HTTP 200 for both / and /api/health with valid TLS. The visitor QR code now points to https://43.160.252.245/. Port 2500 remains available for existing shared links. The existing plain-HTTP redirect may still lead to the compatible 2500 URL; no SSH configuration change was needed for the working standard HTTPS address.

## Updated firewall export

The team supplied project-files/team/server/firewallRules_2026-10-30 14_09_29.csv. Compared with the October 28 export, it adds exactly one rule: IPv4 0.0.0.0/0, TCP 443, allow. No previous rules were removed. This confirms the rule needed for the externally verified standard HTTPS URL. Both original exports are preserved unchanged.

## Frontend and knowledge 0.4.0

Release `0.4.0-20261030T082053Z` is now active at the same public URL. The original wujiaxuan key was used, shared credentials remained in place, and the previous release is retained for rollback. Staging and active service checks passed before public browser acceptance. Knowledge chat/catalog, secure context, AMap, simulated GPS conversion/distance display, mobile header/route sizing, sticky map and PNG report saving passed. Actual phone GPS permissions still need a user check.

Private audit receipt: `.local-work/operations/verification-v04.json`; operation captures were hash-checked. No Git commit/push was made.
