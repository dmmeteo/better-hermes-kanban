# Static nginx deployment

Better Hermes Kanban (BHK) is a Vite SPA that can be built into static files and served by nginx. The browser app may call a local BHK-owned Kanban bridge for `/api/plugins/kanban/*`; keep that bridge behind the same reverse-proxy auth boundary as the SPA.

## Build

From the repository root:

```bash
pnpm install
pnpm build
```

The deployable static bundle is written to `dist/`.

Do not commit secrets, `.env` files, htpasswd files, dashboard session tokens, or production-only endpoint values. Reverse-proxy credentials should be supplied by the platform (for example a Traefik middleware or a mounted nginx `auth_basic_user_file`).

## nginx static server

The checked-in `nginx.conf` is the deploy sample used by `compose.deploy.yml`:

```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  location = /healthz {
    add_header Content-Type text/plain;
    return 200 'ok\n';
  }

  location /api/plugins/kanban/ {
    proxy_pass http://172.17.0.1:9120/api/plugins/kanban/;
    proxy_http_version 1.1;
    proxy_set_header Host 172.17.0.1;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    add_header Cache-Control "no-store";
  }

  location /assets/ {
    try_files $uri =404;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  location / {
    try_files $uri $uri/ /index.html;
    add_header Cache-Control "no-store";
  }
}
```

Key behavior:

- `/assets/*` serves fingerprinted Vite assets with `immutable` caching.
- `/` and deep links such as `/tasks/t_123` fall back to `index.html` for SPA routing and are not cached.
- `/healthz` returns `ok` from nginx so the static container has a simple health target.
- `/api/plugins/kanban/*` is proxied to the local read-only bridge, if that service is running.

## Basic auth boundary

Prefer putting Basic Auth in front of the whole BHK origin at the outer reverse proxy. The current `compose.deploy.yml` uses Traefik label `traefik.http.routers.better-hermes-kanban.middlewares: infra-auth@docker`, so both the SPA and proxied API share the same auth boundary.

If deploying without Traefik, enable nginx Basic Auth at `server` or `location /` scope and mount the htpasswd file as a secret/read-only volume. Example shape only; do not commit the real htpasswd file:

```nginx
auth_basic "BHK";
auth_basic_user_file /etc/nginx/secrets/bhk.htpasswd;
```

## Optional BFF / Kanban bridge

The SPA should not call the Hermes dashboard directly or depend on `X-Hermes-Session-Token`. Dashboard plugin APIs are protected by a dashboard-session token that rotates and belongs to the Hermes dashboard HTML.

When BFF/bridge access is needed:

1. Run a BHK-owned local service such as `scripts/kanban-readonly-api.py` on an internal-only bind address or host-only port.
2. Let nginx proxy only the BHK API prefix to that service, for example `/api/plugins/kanban/* -> http://172.17.0.1:9120/api/plugins/kanban/*`.
3. Keep browser access behind Basic Auth at the same outer boundary as the SPA.
4. Keep the bridge local/internal; do not expose the raw bridge port publicly.

For a purely static/offline deployment with no bridge, remove or disable the `/api/plugins/kanban/` location and the app will show its configured fallback/error state when live Kanban data is unavailable.

## Docker Compose sample

`compose.deploy.yml` mounts `dist/` read-only into `nginx:alpine` and attaches the container to the shared `proxy` network:

```bash
pnpm build
docker compose -f compose.deploy.yml up -d
curl -fsS https://bhk.dmmeteo.dev/healthz
```

Do not run destructive Docker commands such as volume deletion without explicit approval.

## Smoke checks

After building, run the local static bundle smoke:

```bash
pnpm smoke:static
```

The smoke script checks that:

- `dist/index.html` exists and points at built JS/CSS assets.
- Referenced built assets exist under `dist/`.
- `nginx.conf` contains SPA fallback, immutable asset caching, and `/healthz`.
- If `BHK_STATIC_URL` is set, `/` and a deep task route return the SPA index from a running static preview.
- If `BHK_HEALTH_URL` is set, that endpoint returns HTTP 2xx.

Examples:

```bash
pnpm build
pnpm smoke:static
BHK_STATIC_URL=http://127.0.0.1:4173 pnpm smoke:static
BHK_HEALTH_URL=http://127.0.0.1:8080/healthz pnpm smoke:static
```
