# Better Hermes Kanban — agent rules

This file is the single source of truth for **all** AI assistants working in this
repo (Claude Code, Codex, Cursor, pi.dev, etc.). `CLAUDE.md` is a thin shim that
re-exports this file via `@AGENTS.md`.

## Local setup

1. `cp .env.example .env.local`
2. Pick one of two auth modes (both talk to the same kanban database):
   - **Basic Auth against bhk.dmmeteo.dev (default).** Fill
     `HERMES_BASIC_USER` / `HERMES_BASIC_PASS` and leave `HERMES_API_URL` as
     `https://bhk.dmmeteo.dev`. Good for quick boot; some newer
     dashboard-level routes (`/home-subscribe/{channel}`,
     `/home-channels`) are not exposed by this host yet, so notify channels
     will return 404 until the bhk deploy gets parity.
   - **Dashboard session auth against her.dmmeteo.dev.** Set
     `HERMES_API_URL=https://her.dmmeteo.dev` and fill
     `HERMES_SESSION_COOKIE` (value of the `hermes_session` cookie) +
     `HERMES_SESSION_TOKEN` (value of the `x-hermes-session-token` request
     header). Grab both from a logged-in DevTools session on her.dmmeteo.dev.
     When both are set they take precedence over Basic Auth. her exposes the
     full route set (notify channels, home-channels, unlink, etc.). Tokens
     are short-lived — refresh from DevTools when requests start 401-ing.
3. `npm install`
4. `npm run dev` — Vite serves on `http://localhost:3000`. Requests to `/api/**`
   are reverse-proxied to `HERMES_API_URL` and the proxy attaches the auth
   header from `.env.local`, so creds never leave the dev process.

bhk and her point at the same kanban service / database; her exposes the full
dashboard-level route set while bhk only ships the kanban plugin. If a
route 404s on bhk but you saw it work in the her network log, switch to
session auth as in step 2.

## Non-negotiable git workflow

- Do **not** make substantial edits in this shared checkout.
- Before any code/docs change, inspect:
  - `git status --short`
  - `git branch --show-current`
  - `git worktree list`
- Use one task-scoped worktree per implementation/QA task:
  - branch: `work/<short-slug>`
  - worktree: sibling directory such as `../better-hermes-kanban-wt-<slug>`
- Keep each task as focused commits. Do not leave uncommitted work in the shared
  checkout.
- If the shared checkout is dirty, assume those changes belong to another worker
  unless the user explicitly tells you to curate/commit them.
- Never overwrite unrelated dirty files. Re-read files from the active worktree
  immediately before patching.
- Run `git diff --check` before every commit.
- Report branch, worktree path, commit hash, and verification in the final
  handoff.

The repository now has a single canonical branch `main`. Historical `agent/*`,
`recovery/*`, `integration/*`, `feat/*` and `master` branches were removed.
Backup tags `backup/pre-main-cleanup-*` capture the previous state if anything
needs to be recovered.

## Product / design constraints

- Preserve the accepted BHK desktop kanban layout unless the user explicitly
  asks to change it.
- Mobile-first does not mean desktop can become a stretched mobile layout.
- Keep BHK simple and board/task-oriented; avoid heavy cloud-console patterns.
- Stable `data-testid` hooks are expected for new interactive UI used in
  browser QA.

## shadcn/ui workflow

We follow the **native shadcn workflow**: we only commit components we actually
use. Currently committed:

```
button  dialog  dropdown-menu  input  label  popover
separator  sheet  skeleton  textarea  toggle  tooltip
```

To add a new shadcn component when you need it:

```bash
npm run ui:add -- <component>
# e.g.
npm run ui:add -- card badge alert
```

The CLI uses `components.json` (style `new-york`, base color `slate`, alias
`@/components/ui`). After adding, commit the generated files together with the
code that uses them. Do not bulk-import the entire shadcn catalog.

If a component falls out of use, delete it.

## API layer

- `src/lib/nativeKanbanClient.ts` — typed fetch client against
  `/api/plugins/kanban/*`. Uses `credentials: 'include'` so production (where
  the frontend and the API share an origin) works without manual auth.
- `src/lib/nativeKanbanTypes.ts` / `nativeKanbanMappers.ts` — DTOs and
  DTO→domain mappers.
- `src/lib/kanbanApi.ts` — façade used by the UI. Keep the surface stable; if
  the backend contract changes, adjust the mappers, not the UI.

## Verification defaults

- `npm run build` for any frontend change.
- Run focused browser QA for layout/interaction changes when practical
  (`http://localhost:3000` with `.env.local` filled in).
- `npm run lint` currently has pre-existing repo-wide issues; note whether
  failures are unrelated or introduced.
