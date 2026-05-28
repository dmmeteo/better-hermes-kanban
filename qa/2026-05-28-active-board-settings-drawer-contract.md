# Active-board settings drawer contract — t_c7a7b677

Date: 2026-05-28
Scope: implementation contract only; no UI/code changes in this task.

## Decision

Settings must be a right-side active-board drawer, not the old centered `Board settings` modal/list from the screenshot and not a standalone `/settings` page.

The drawer is board-scoped context + global Kanban orchestration settings:
- Board switching stays in the board selector dropdown.
- `+ New board` stays in the board selector dropdown and opens the create-board flow/modal/sheet, not a board list inside settings.
- The settings drawer opens for the currently active board and shows read-only board identity plus the editable orchestration form.
- Save is explicit. Closing/backdrop click must not auto-save.

## Source inspection

Inspected:
- `scripts/kanban-readonly-api.py`
- `src/lib/kanbanApi.ts`
- `src/lib/types.ts`
- Original board settings screenshot: `/home/me/.hermes/profiles/developer/cache/screenshots/browser_screenshot_45a49e7c6b554166be19586dde45681f.png`
- Board baseline screenshot: `/home/me/.hermes/profiles/developer/cache/screenshots/browser_screenshot_c3280e83b1454bbb838b6d0e8c9e601d.png`

Original screenshot notes:
- The old UI is a centered `Board settings` modal over the board.
- It has `Boards` and `Settings` tabs.
- `Boards` tab lists boards (`API Reliability`, `Checkout Revamp`, `Data Platform`, `Customer Ops`, `Infra & Tools`) with star icons, task counts, chevrons, and a `+ New board` row.
- This modal pattern is superseded: do not recreate the board list inside settings.

## API endpoints for this slice

Read board list / board context:
- `GET /api/plugins/kanban/boards`
  - Returns `boards[]` with `slug`, `name`, `description`, `icon`, `color`, `default_workdir`, `archived`, `is_current`, `counts`, `total`.
- `GET /api/plugins/kanban/board?board=<slug>`
  - Returns current board payload and task list for the selected board.

Read/write orchestration:
- `GET /api/plugins/kanban/orchestration`
  - Returns editable orchestration values, resolved helper values, and `advanced` read-only values.
- `PUT /api/plugins/kanban/orchestration`
  - Accepts only safe orchestration fields:
    - `orchestrator_profile`
    - `default_assignee`
    - `auto_decompose`
    - `auto_promote_children`
  - Rejects unknown fields. Therefore advanced fields must not be sent from the drawer.

Profiles/assignees:
- `GET /api/plugins/kanban/profiles`
  - Profile options for `orchestrator_profile` and fallback/default pickers.
- `GET /api/plugins/kanban/assignees?board=<slug>`
  - Board-aware known assignees. Use as helpful options for `default_assignee` where available; keep profile list as fallback.

Board metadata write endpoints exist but are out of this settings-drawer slice:
- `POST /api/plugins/kanban/boards` supports board creation.
- `PATCH /api/plugins/kanban/boards/<slug>` supports `name`, `description`, `icon`, `color`, `default_workdir`.
- `DELETE /api/plugins/kanban/boards/<slug>` exists.

UX decision: do not expose board metadata editing, archive/delete, icon/color, or default workdir in the active-board settings drawer for this slice. Those controls belong to a later board-management slice with separate confirmation rules.

## Field mapping

### Active board context — read-only/resolved

These fields come from the active `Board` object normalized in `src/lib/kanbanApi.ts` / `src/lib/types.ts`.

| Drawer label | Source | UI state | Notes |
| --- | --- | --- | --- |
| Current board | `activeBoard.name` | Read-only text | Human title for the selected board. |
| Board slug | `activeBoard.id` / API `slug` | Read-only mono text | Must not be edited in this drawer. |
| Description | `activeBoard.description` | Read-only helper text | Optional. If empty, omit or show quiet `No description`. |
| Task count | `activeBoard.taskCount` / API `total` / `counts` sum | Read-only stat | Use active board count only; do not show all boards. |
| Current board marker | `activeBoard.isCurrent` / API `is_current` | Read-only badge if useful | This is global Hermes current-board state, not necessarily the UI-selected board after non-persistent navigation. Keep subtle. |

### Editable orchestration fields — save via PUT

These are supported by both `KanbanOrchestrationUpdate` and `PUT /api/plugins/kanban/orchestration`.

| Drawer label | Frontend type | API key | UI control | Save behavior |
| --- | --- | --- | --- | --- |
| Orchestrator profile | `orchestratorProfile?: string` | `orchestrator_profile` | Select/combobox from `/profiles` | Editable. Empty allowed; API resolves fallback. |
| Default assignee | `defaultAssignee?: string` | `default_assignee` | Select/combobox from `/assignees?board=<slug>` + profiles fallback | Editable. Empty allowed; API resolves fallback. |
| Auto-decompose triage tasks | `autoDecompose?: boolean` | `auto_decompose` | Switch | Editable. |
| Auto-promote children | `autoPromoteChildren?: boolean` | `auto_promote_children` | Switch | Editable. |

Save payload must include only fields that are dirty or all four safe fields. It must never include `advanced` or resolved helper values.

### Resolved/helper fields — read-only

These come from `GET /orchestration` and should explain what Hermes will actually use after fallback resolution.

| Drawer label | Source | UI state | Notes |
| --- | --- | --- | --- |
| Resolved orchestrator | `resolvedOrchestratorProfile` / API `resolved_orchestrator_profile` | Read-only helper under orchestrator select | Show when explicit value is empty or invalid/fallbacked. |
| Resolved default assignee | `resolvedDefaultAssignee` / API `resolved_default_assignee` | Read-only helper under default assignee select | Show when explicit value is empty or fallbacked. |
| Active profile fallback | `activeProfile` / API `active_profile` | Read-only small context row | Current bridge currently resolves to `developer` when present, else `default`. |
| Explicit flags | `explicit` | Read-only/debug optional | Do not make this primary UI. Can show subtle `explicit/default` chips if useful. |

### Advanced fields — read-only for now

`READONLY_ORCHESTRATION_FIELDS` in `scripts/kanban-readonly-api.py` are returned in `advanced`, but `PUT /orchestration` does not accept them. They must remain read-only until backend support is intentionally added.

| Drawer label | Frontend key | API key | UI state |
| --- | --- | --- | --- |
| Max in progress | `advanced.maxInProgress` | `max_in_progress` | Read-only |
| Max spawn | `advanced.maxSpawn` | `max_spawn` | Read-only |
| Dispatch interval | `advanced.dispatchIntervalSeconds` | `dispatch_interval_seconds` | Read-only |
| Failure limit | `advanced.failureLimit` | `failure_limit` | Read-only |
| Stale timeout | `advanced.dispatchStaleTimeoutSeconds` | `dispatch_stale_timeout_seconds` | Read-only |

Implementation rule: label the group `Advanced dispatcher limits` or similar and show `Read-only until backend save support exists`. Do not render editable inputs that look saveable.

## Active board assumptions

- The active board is the board currently selected in BHK state (`activeBoard`), loaded from `GET /boards` + `GET /board?board=<slug>`.
- Default board preference in current app code: requested route board, else `better-hermes-kanban`, else default/current, else first board.
- Settings must not include a board list or switch active board itself.
- On a board route (`/boards/<slug>`), settings uses that slug.
- On `/`, settings uses the resolved default/current BHK board after load.
- On `/tasks/<id>`, the standalone task page resolves the task board from task detail and should not expose board settings as a primary task-page control unless the global chrome remains visible.

## Route behavior

Current app route handling inspected in `src/App.tsx`:
- `/boards/<slug>` loads that board.
- Legacy `/?board=<slug>` redirects/replaces to `/boards/<slug>`.
- `/settings` and `/settings/` act as compatibility shims: open settings and `replace` back to the current board route.
- `/tasks/<id>` opens standalone task detail and may include `?board=<slug>` for lookup.

Contract for this slice:
- Keep `/settings` as a shim only. It should open the drawer and replace to the active board route; do not implement a standalone settings page.
- Opening settings from desktop/mobile gear must not change the route except for the `/settings` compatibility shim.
- Board selector dropdown remains the only board-switching surface.

## Drawer structure

Recommended content order:

```txt
Settings drawer
├── Header: Settings / active board name / close
├── Board context card (read-only)
│   ├── name
│   ├── slug
│   ├── description
│   └── task count
├── Orchestration form (editable)
│   ├── orchestrator profile select
│   ├── default assignee select
│   ├── auto-decompose switch
│   └── auto-promote switch
├── Resolved runtime helpers (read-only)
│   ├── resolved orchestrator
│   ├── resolved default assignee
│   └── active profile fallback
├── Advanced dispatcher limits (read-only)
│   ├── max in progress
│   ├── max spawn
│   ├── dispatch interval
│   ├── failure limit
│   └── stale timeout
└── Footer: Save / Cancel or close
```

Mobile:
- Drawer can be full-screen width.
- Keep Save sticky at bottom if content scrolls.
- Same fields and read-only/editable split.

## Required data-testid hooks

Settings open/close:
- `desktop-settings-button`
- `mobile-settings-button`
- `settings-drawer`
- `settings-close-button`

Board context:
- `settings-board-name`
- `settings-board-slug`
- `settings-board-description`
- `settings-board-task-count`

Editable orchestration:
- `settings-orchestrator-profile`
- `settings-default-assignee`
- `settings-auto-decompose`
- `settings-auto-promote-children`
- `settings-save-button`
- `settings-cancel-button`

Read-only helper/advanced:
- `settings-resolved-orchestrator-profile`
- `settings-resolved-default-assignee`
- `settings-active-profile`
- `settings-advanced-max-in-progress`
- `settings-advanced-max-spawn`
- `settings-advanced-dispatch-interval`
- `settings-advanced-failure-limit`
- `settings-advanced-stale-timeout`

Board selector/new board, outside drawer:
- `board-selector-trigger`
- `mobile-board-selector-trigger`
- `board-dropdown-new-board`
- `mobile-board-dropdown-new-board`
- `new-board-modal`
- `new-board-name`
- `new-board-description`
- `new-board-create`

## Acceptance criteria for downstream implementation

- Settings opens as one right-side `Sheet`/drawer from gear buttons; no centered board-list modal.
- Drawer shows only active-board context, not all boards.
- Editable fields are exactly the four safe orchestration fields supported by `PUT /orchestration`.
- Advanced fields render read-only and are not included in save payload.
- Save calls `kanbanApi.updateOrchestration()` / `PUT /api/plugins/kanban/orchestration` and refreshes the drawer state from the response.
- Save button is explicit and disabled while saving; close/cancel does not save.
- `/settings` remains a compatibility shim that opens the drawer and returns/replaces to current board route.
- Stable `data-testid` hooks above are present for browser QA.
- No board archive/delete, icon/color/default-workdir, or board list switching appears in the settings drawer.
