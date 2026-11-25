# Northflank deployment (optional)
Deployment preparation only. No remote service has been created.

- Use the free Developer Sandbox on Northflank Cloud, not BYOC or a paid plan.
- Choose Asia Northeast (asia-northeast) if the free account permits it.
- Link the GitHub repository and main branch in a combined service.
- Build with Dockerfile at deploy/northflank/Dockerfile; build context: repository root.
- One instance only (room state is in memory); choose an eligible free compute size.
- Public HTTP port: 10000; HTTPS and WebSocket through the platform ingress.
- Environment: NODE_ENV=production, PORT=10000, BIND_HOST=0.0.0.0,
  ALLOWED_ORIGINS=https://chansiu11.github.io
- Health path: /health.

Before switching the public site, verify HTTPS /health, WebSocket /ws, room
creation and joining, reconnect behavior, and actual RTT from Korea.
Only after verification change GAME_SERVER_URL in config.js and bump its
cache version in index.html. Keep the existing Render service for rollback.
Do not connect billing or upgrade the account without explicit authorization.
