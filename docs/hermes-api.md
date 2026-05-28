# Hermes Kanban Plugin — API canonical contract

This is a digest of the **canonical** kanban plugin API as shipped in
[`NousResearch/hermes-agent`](https://github.com/NousResearch/hermes-agent)
(MIT, public) at `plugins/kanban/dashboard/plugin_api.py`.

`bhk.dmmeteo.dev` and `her.dmmeteo.dev` are two deploys of the same Hermes
Agent talking to the same kanban database. `her` runs the current canonical
plugin; `bhk` is one version behind and ships a smaller route subset with a
non-canonical `GET /tasks/{id}` shape (links inlined into `task.links`).
**This frontend targets the canonical contract** — when behaviour diverges,
the canonical one (her) is the source of truth.

Mount prefix everywhere below: **`/api/plugins/kanban`**.

Auth:
- `bhk.dmmeteo.dev` — HTTP Basic.
- `her.dmmeteo.dev` — Basic **and** `hermes_session` cookie + `x-hermes-session-token` header (perimeter+app auth).
- `localhost` (future) — no auth.

## Route inventory

| Method | Path | Notes |
|---|---|---|
| `GET` | `/board` | Board listing. Returns `{columns, assignees, tenants, latest_event_id, now}`; each task in a column carries `link_counts: {parents, children}` but **not** the link lists themselves. |
| `GET` | `/tasks/{task_id}` | Full detail envelope: `{task, comments[], events[], links: {parents:[ids], children:[ids]}, runs[]}`. **Links are top-level, ID-only**, not nested in `task`. Enrich titles/statuses client-side from the board store. |
| `POST` | `/tasks` | Body: `{title, body?, assignee?, tenant?, priority=0, workspace_kind="scratch", workspace_path?, parents=[], triage=false, idempotency_key?, max_runtime_seconds?, skills?}`. |
| `PATCH` | `/tasks/{task_id}` | Partial update; body is `UpdateTaskBody` (any of `status`, `title`, `body`, `assignee`, `priority`, …). |
| `DELETE` | `/tasks/{task_id}` | Soft archive unless `?delete=true`. |
| `POST` | `/tasks/{task_id}/comments` | Body: `{body: string}`. |
| `POST` | `/links` | Add parent→child link. Body: `{parent_id, child_id}`. |
| `DELETE` | `/links` | **Unlink** by pair, **not** by id. Query: `parent_id`, `child_id`, `board`. |
| `POST` | `/tasks/bulk` | Bulk update — body `BulkTaskBody`. |
| `GET` | `/diagnostics` | Diagnostics list across board. |
| `GET` | `/workers/active` | Currently-running workers. |
| `GET` | `/runs/{run_id}` | Single run detail. |
| `GET` | `/runs/{run_id}/inspect` | Run output / artifacts inspector. |
| `POST` | `/tasks/{task_id}/reclaim` | Forcibly reset claim/lock on a task. |
| `POST` | `/tasks/{task_id}/specify` | Mark a triage task ready. |
| `POST` | `/tasks/{task_id}/reassign` | Reassign to a different profile. |
| `GET` | `/config` | Server-side configuration snapshot (use to detect deploy version / capabilities). |
| `GET` | `/home-channels` | Notify-channel state. Query: `task_id`, `board`. Response: `{home_channels: [{platform, chat_id, thread_id, name, subscribed}, …]}`. |
| `POST` | `/tasks/{task_id}/home-subscribe/{platform}` | **Subscribe** (empty body). |
| `DELETE` | `/tasks/{task_id}/home-subscribe/{platform}` | **Unsubscribe** (empty body) — same path as subscribe, different verb. |
| `GET` | `/stats` | Aggregate stats for a board. |
| `GET` | `/assignees` | List of assignable profiles. |
| `GET` | `/tasks/{task_id}/log` | Worker stdout/stderr tail. |

Query param `board` is supported (and usually required) by every task-scoped
route; an omitted `board` falls through to the "current" board on the server.

## Frontend wiring

`src/lib/kanbanApi.ts`:

- `normalizeLinks(raw, byId?)` — accepts the canonical `{parents, children}`
  object; uses an optional `byId: Map<id, Task>` to hydrate `title` / `status`
  / `boardId` for each linked task. Frontend currently enriches at the
  `App.tsx:selectedTask` memo so the mapper itself can stay free of state.
- `taskFromEnvelope(payload, boardId, byId?)` — pulls `payload.task` and the
  top-level `payload.links` and feeds both into `normalizeTask`. Use for any
  endpoint that returns the full detail envelope.
- `subscribeTask(taskId, channel, boardId)` — `POST .../home-subscribe/{channel}`.
- `unsubscribeTask(taskId, channel, boardId)` — `DELETE .../home-subscribe/{channel}`.
- `getHomeChannels(taskId, boardId)` — `GET /home-channels`. Parses
  `home_channels[*].{platform, subscribed}`.

If you reach for a route that's not yet wired, prefer adding it as a thin
wrapper in `kanbanApi.ts` (matching the patterns above) rather than calling
fetch in components.
