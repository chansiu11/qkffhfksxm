# OCI Seoul deployment preparation

Status: templates only; no OCI resource has been provisioned.

Use an authorized OCI account in the South Korea Central (Seoul) home region.
Confirm Always Free eligibility and capacity in the console. Do not upgrade to
a paid account or provision paid resources as part of this migration.

Requirements:
- ARM64 Linux VM with a supported Node.js LTS release.
- A public DNS name pointing to the VM and working TLS.
- A dedicated unprivileged webgame system user and the repository at
  /opt/webgame, readable by that user.
- The included systemd unit and Caddy reverse-proxy template, configured by
  the server administrator. Confirm Node's executable path before installing.
- Expose HTTPS (and HTTP for certificate issuance if required); keep the
  Node backend bound to loopback. Restrict administrative access.

Validation before changing the public frontend:
1. Confirm the service is running and HTTPS /health returns ok.
2. Confirm WSS /ws works from https://chansiu11.github.io.
3. Test room creation, joining, reconnect, and measure network RTT from Korea.
4. Only then update GAME_SERVER_URL in config.js and its script cache version
   in index.html. Do not split an existing room between different servers.
5. Keep Render as a rollback option until the new endpoint is validated.
   Reverting the frontend endpoint returns new connections to Render.

The existing Render setup and default frontend URL are unchanged.
Room state is in memory; existing sessions cannot be transferred live.
Never commit SSH keys, OCI API keys, account credentials or payment details.
