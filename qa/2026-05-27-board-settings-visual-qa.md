# Board/profile settings visual QA — t_30fd2d82

Date: 2026-05-27

## Scope

Checked board/profile settings after board management/settings implementation.

Targets:
- Live public URL: https://bhk.dmmeteo.dev/ — blocked by Infra Basic Auth from this environment (`401 Unauthorized`).
- Live container direct URL: http://172.18.0.7/ — used for API-backed production build QA, bypassing external Basic Auth.
- Local Vite preview/dev URL: http://127.0.0.1:5173/ — used as fallback/offline UI check.

## Build / service result

- `pnpm build`: passed.
- Build warning: Vite chunk size warning for `dist/assets/index-CC2cmLyE.js` at 572.54 kB. This appears already tracked by existing board task `Follow-up: code-split Hermes Kanban SPA bundle warning`.
- Live bridge health: `http://172.17.0.1:9120/healthz` returned `{"ok": true}`.
- Live container API: `http://172.18.0.7/api/plugins/kanban/boards` returned real boards (`default`, `better-hermes-kanban`, `ladream`).

## Screens / evidence

- Desktop screenshot: `/tmp/bhk-qa/desktop-loaded2.png`
- Mobile screenshot: `/tmp/bhk-qa/mobile-loaded2.png`
- Browser desktop visual screenshot: `/home/me/.hermes/profiles/developer/cache/screenshots/browser_screenshot_c3280e83b1454bbb838b6d0e8c9e601d.png`
- Board settings modal screenshot captured by browser tool before vision timeout: `/home/me/.hermes/profiles/developer/cache/screenshots/browser_screenshot_45a49e7c6b554166be19586dde45681f.png`

## Desktop QA notes

URL: `http://172.18.0.7/`

Passed:
- Board switcher loads real boards and switching `better-hermes-kanban` → `ladream` updates the board/task list.
- Board settings modal opens and lists real boards with task counts.
- Settings/orchestration panel renders with orchestrator/default assignee selects, auto-decompose/auto-promote buttons, profiles/assignees list, and settings shortcuts.
- Task drawer still opens from task cards and retains the guarded update layout: title/body/assignee/priority/status fields, disabled save/apply until edits, linked tasks/diagnostics/planned attachments sections, and bottom actions.
- Browser console had no JS exceptions during tested navigations/interactions.

Issues:
1. Board settings → Settings shows a `Not found` toast while rendering the orchestration/settings panel. This suggests one settings endpoint/proxy is still missing or returning 404.
2. Board settings → New board only shows `Create board coming soon`; no create form appears.
3. Selecting a board inside Board settings does not expose edit metadata or archive/delete confirmation controls, so edit/archive/delete confirmation flows could not be completed.

Visual notes:
- Desktop board remains consistent with the accepted dark BHK design.
- Very wide boards rely on horizontal overflow; at 1440px this is acceptable but dense boards can hide later columns off-screen.

## Mobile QA notes

URL: `http://172.18.0.7/` with 390x844 viewport via headless Chrome.

Passed:
- Mobile header, board selector, status tabs, empty-state text, floating create button, and bottom navigation render cleanly.
- No obvious clipping in the initial mobile board view.
- Mobile design remains visually aligned with the accepted BHK dark/mobile-first baseline.

Limitations:
- Mobile interaction testing was screenshot-based through headless Chrome plus desktop browser interaction; the browser tool viewport itself remained desktop-sized.

## Console / network notes

- Browser console: no JS errors captured.
- Chrome headless logs include expected headless DBus warnings only; no app JS crash evidence.
- Public `https://bhk.dmmeteo.dev/` returned `401 Unauthorized` due Infra Basic Auth; direct container URL was used for live production build QA.
- Local Vite dev URL served SPA HTML for `/api/plugins/kanban/*` routes (no local Vite proxy), so it fell back to offline demo data and was not used as the API-backed source of truth.

## Follow-up tasks

Created:
- `t_0e4319b8` — QA follow-up: board settings API/actions incomplete after visual pass.

Existing related task observed on the board:
- Follow-up: code-split Hermes Kanban SPA bundle warning.
