# BHK task search: MVP product/design spec

Task: `t_0238f80b`
Date: 2026-05-27
Owner: designer
Scope: refine Better Hermes Kanban search beyond current board-only filter and Cmd/Ctrl+F task-id workaround.

## Recommendation

Build a dedicated Tasks/Search experience, not a heavier Kanban-board filter. Keep the existing top-bar board search as a lightweight in-board filter, but add a global search entry that routes to `/tasks?q=...` with a list-first result layout. Exact task-id lookup should be the fastest path: if the query matches `t_[0-9a-f]{8}` exactly and one task is found, open the task detail directly; if board context is unknown, resolve it via the search API and preserve the board slug in the URL.

This keeps BHK product-led: the board remains a work-state view, while search becomes a task-finding/recovery view optimized for scanning, provenance, and opening details.

## Current baseline observed

- `src/components/layout/TopBar.tsx`: desktop has a `Search tasks...` input wired to board-local `searchQuery`; mobile only has an inert search icon.
- `src/App.tsx`: only board route `/` and task route `/tasks/:id` exist; selected task is looked up from the currently loaded board task array.
- `src/components/board/TaskCard.tsx`: task IDs are now rendered as real text, enabling the current Cmd/Ctrl+F workaround.
- `scripts/kanban-readonly-api.py`: bridge supports boards, single board payload, profiles/assignees/orchestration, and guarded task mutations, but no cross-board search endpoint yet.

## MVP search coverage

Search must cover:

1. Task id: exact and partial, highest ranking.
2. Title: primary fuzzy/substring match.
3. Body/description: secondary match with snippet.
4. Latest summary/result: secondary match with snippet.
5. Comments: secondary match with `comment by <author>` snippet.
6. Assignee: filter and query match.
7. Status: filter and query match for status words.
8. Board: filter and result metadata.
9. Links: only as metadata/count in MVP; do not full-text search linked task bodies yet.

MVP should not index full run logs/events beyond latest summary/error snippets. Those are noisy and can make results feel like a generic observability table.

## IA / navigation

Recommended IA:

- `/tasks`: dedicated task finder page.
- `/tasks?q=<query>`: search result state.
- `/tasks/<taskId>?board=<slug>`: existing detail page pattern, enhanced to load by id if current board data does not contain the task.
- Top-bar desktop search becomes a compact global entry. Pressing Enter navigates to `/tasks?q=...`; typing can still show a small local popover later.
- Mobile search icon opens the same task finder as a full-screen sheet or navigates to `/tasks`.
- Command palette is later, not MVP. It can reuse the same API after `/tasks` proves useful.

Why not only command palette: exact lookup needs a shareable, debuggable URL and a result surface for no-match/multiple-match cases. A command palette can be an accelerator on top, not the canonical IA.

## Exact task-id behavior

Pattern:

1. User enters `t_ae86dc88` in top-bar search, `/tasks`, or mobile search.
2. Query is trimmed and lowercased for matching; display preserves original text.
3. If it exactly matches `^t_[0-9a-f]{8}$`:
   - call `GET /api/plugins/kanban/search?q=t_ae86dc88&limit=20`;
   - if exactly one exact-id result exists, navigate immediately to `/tasks/t_ae86dc88?board=<result.boardId>` and show a small toast/status line: `Opened exact task match`;
   - if no result, stay on `/tasks?q=t_ae86dc88` and show a focused not-found state with suggestions: check archived board, refresh, copy id;
   - if multiple boards somehow contain same id, show a compact disambiguation list grouped by board.
4. On `/tasks/<id>`, if the task is not in loaded board state, call a backend lookup/search by id before rendering `Task not found`.

Important: exact id should not leave the user staring at a filtered board column. It should open the task detail or a clear result/not-found state.

## Result layout

Use an editorial list, not a dense admin table.

Desktop layout:

- Left rail/filter panel, 240-280px wide:
  - board selector: All boards + current board shortcut;
  - status chips;
  - assignee filter;
  - toggles: Has warnings, Has links;
  - sort selector.
- Main results column:
  - search header with large input, result count, freshness timestamp;
  - result cards in a single vertical list, max width about 880px;
  - sticky top metadata row optional, not a table header.
- Right side optional later: selected task preview. Not MVP if it delays shipping.

Mobile layout:

- Full-screen `/tasks` page with input at top and filter chips horizontally scrollable.
- Results are stacked cards with strong title, ID, board/status row, assignee, matched snippet.
- Filters open as a bottom sheet; default visible chips: Board, Status, Assignee.
- Tapping result opens existing task detail page; back returns to same search URL and scroll position if possible.

Result item content:

- Top row: status color dot + status label, priority, board name, task id in mono text.
- Title: 1-2 lines, primary visual weight.
- Match snippet: body/comment/summary excerpt with subtle highlight for matched terms.
- Meta row: assignee avatar/name, comment count, link count, warning count, updated/created time.
- Optional relationship hint: `Parent: ...` / `2 children` when links exist.
- CTA affordance: whole card opens detail; visible `Open` link on keyboard focus.

Do not render a spreadsheet. Avoid columns like an admin DB browser; BHK should feel like a mission-control task notebook.

## MVP filters and sorting

MVP filters:

- Board: All boards, current board, specific board.
- Status: multi-select status chips.
- Assignee: single/multi-select from existing profiles/assignees.
- Priority: P0/P1/P2/P3 chips.
- Has warnings: boolean.
- Has links: boolean.

MVP sort:

- Relevance (default when query exists).
- Updated/newest first (default when query is empty).
- Priority high first.

Later filters/sorts:

- Created date range / updated date range.
- Blocked age / running age.
- Parent/child relation type.
- Has comments / no comments.
- Created by.
- Workspace kind/path.
- Run outcome and failure reason.
- Archived boards toggle.

## Empty, loading, and error states

Empty first-use state:

- Title: `Find any Kanban task`
- Copy: `Search by task id, title, body, summary, comment, assignee, or status.`
- Example chips: `t_ae86dc88`, `blocked`, `designer`, `review-required`.

No results:

- If exact ID: `No task found for t_ae86dc88` with actions `Refresh index`, `Search all boards`, `Copy query`.
- If general query: show query, active filters, and a one-click `Clear filters` action.

Loading:

- Keep input active; show skeleton result cards with muted BHK surfaces.
- For exact ID, use a smaller `Looking up task id...` state to feel instant.

Error:

- Distinguish bridge/auth error from no results.
- Copy: `Search bridge unavailable; board data may still be visible.`
- Actions: `Retry`, `Open current board`, optional technical detail collapsible.

Freshness:

- Show `Updated <time>` or `Live bridge` in small muted text.
- If using client-side cache, show `Searching loaded board only` warning until global API exists.

## Backend / API needs

MVP API direction:

- Add BHK-owned bridge endpoint, not Hermes dashboard token calls:
  - `GET /api/plugins/kanban/search?q=&board=&status=&assignee=&priority=&has_warnings=&has_links=&limit=&cursor=&sort=`
  - response: `{ results, total, nextCursor, source, indexedAt }`
- Add exact lookup path via same endpoint or thin endpoint:
  - `GET /api/plugins/kanban/tasks/<id>?board=<slug optional>`
- Search should query server-side Kanban SQLite/board layer across allowed boards.
- Result payload should be lightweight: enough for list item plus a `task` object for exact-open when available. Full comments/body can be snippet-only in result; detail page fetches full task.

Client-side temporary slice:

- Before global API lands, `/tasks` may search only loaded board data, but UI must explicitly label this as `Current board only`.
- Do not pretend board-local search is global.
- Exact ID on loaded board can route immediately; if not found, show `Global search bridge needed` rather than false no-result.

Performance notes:

- Limit default results to 50; paginate with cursor or offset.
- Debounce text search by 200-300ms; exact ID lookup can fire immediately on Enter.
- For SQLite MVP, simple `LIKE` across normalized fields is acceptable; later move to FTS5 if needed.
- Cap searched comment/snippet content to avoid returning huge markdown bodies.

Permissions/auth risks:

- Browser must call only BHK `/api/plugins/kanban/*` bridge endpoints on the same origin.
- Do not copy `window.__HERMES_SESSION_TOKEN__` from Hermes dashboard.
- Respect board visibility/source if multi-board permissions are added later; do not leak cross-tenant data in global search.

## Visual/product guardrails

- Keep dark BHK/Kimi control-room aesthetic: glassy card surfaces, purple accent, status color as small signifier, compact but readable text.
- Search should feel like a task command center, not a database admin table.
- Do not overload MVP with saved searches, SQL-like filters, or advanced boolean syntax.
- Keep exact ID lookup calm and instant; it is an operator recovery workflow.
- Keep board workflow intact. Do not replace the Kanban board with list view.

## Implementation task plan

Dependency order:

1. Backend bridge search endpoint.
   - Add `GET /api/plugins/kanban/search` and optional `GET /api/plugins/kanban/tasks/<id>` to `scripts/kanban-readonly-api.py`.
   - Query tasks across selected/all boards, include board slug/name, status, priority, assignee, snippets, comment/link/warning counts.
   - Add response normalization in `src/lib/kanbanApi.ts` and types in `src/lib/types.ts`.

2. Dedicated `/tasks` search page shell.
   - Add route handling in `App.tsx` without disturbing existing board and task detail routes.
   - Build `TaskSearchPage` with desktop list + filter rail and mobile stacked list + filter sheet.
   - Include loading/empty/error/freshness states.

3. Exact task-id open flow.
   - In top-bar search Enter and `/tasks` input, detect exact task IDs.
   - If one exact result, navigate to `/tasks/<id>?board=<boardId>`.
   - Enhance task detail page load so direct task links can resolve tasks not already in the current board array.

4. Mobile search entry and top-bar IA cleanup.
   - Wire mobile search icon to `/tasks` or full-screen search sheet.
   - Desktop top-bar input becomes global search entry; if board-local filter is still needed, move it into board view as `Filter this board`.

5. Search QA and visual acceptance.
   - Verify desktop 1440px and mobile 390px.
   - Verify exact ID found, exact ID not found, general query, filtered query, bridge error, current-board-only fallback.
   - Confirm no direct calls to `her.dmmeteo.dev` dashboard APIs and no session-token dependency.

## Acceptance criteria for MVP build

- Exact `t_xxxxxxxx` search opens the task detail directly when a single match exists.
- `/tasks?q=...` gives shareable list results with board/status/assignee/priority metadata.
- Mobile has a usable search experience, not just an inert icon.
- Empty/no-result/error states are specific and non-generic.
- Board-local search/filter remains available or is intentionally replaced by a clearly labeled current-board filter.
- API calls go through BHK bridge only.
- Large bodies/comments are snippeted; UI does not freeze on long task specs.
- The existing approved board UI is visually preserved.

## Later advanced search backlog

- Command palette (`Cmd/Ctrl+K`) with top 5 results and actions.
- Saved searches: `Blocked P0`, `My running tasks`, `Review-required`.
- FTS5 ranking/highlighting across body/comments/summaries.
- Date range filters and stale-task smart filters.
- Cross-board duplicate/disambiguation UX.
- Keyboard result navigation (`↑/↓`, Enter, Esc).
- Search analytics/failure telemetry for common no-result queries.
