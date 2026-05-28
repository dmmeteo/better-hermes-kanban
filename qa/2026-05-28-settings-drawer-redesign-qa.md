# Settings drawer redesign visual/browser QA — t_f78a1e71

Date: 2026-05-28
Branch under QA: `agent/t_f78a1e71-settings-drawer-qa` based on integration commit `fd1b295` (`agent/t_d7bb08cf-settings-integration`).
Target: local production build served through a same-origin QA proxy at `http://127.0.0.1:8123`, proxying `/api/plugins/kanban/*` to the live bridge `http://172.17.0.1:9120`.

## Build / service checks

- `npm ci`: passed; npm reported existing dependency audit items (`3 moderate`, `6 high`) but no install failure.
- `npm run build`: passed (`tsc -b && vite build`).
- Live bridge health: `GET http://127.0.0.1:8123/healthz` returned `{"ok": true}`.
- API-backed board load: passed; no offline/demo-data banner.

## References compared

- Original Hermes settings screenshot: `/home/me/.hermes/profiles/developer/cache/screenshots/browser_screenshot_45a49e7c6b554166be19586dde45681f.png`
- Accepted BHK board chrome baseline: `/home/me/.hermes/profiles/developer/cache/screenshots/browser_screenshot_c3280e83b1454bbb838b6d0e8c9e601d.png`
- Settings contract: `qa/2026-05-28-active-board-settings-drawer-contract.md`

Comparison result: the old centered `Board settings` modal with board list/tabs was not recreated. The new Settings surface is a right-side active-board drawer on desktop, fullscreen sheet on mobile, with board creation kept in a separate `New board` modal.

## Screenshots / evidence

- Desktop settings drawer: `/home/me/projects/better-hermes-kanban-wt-t_f78a1e71/qa/screenshots/settings-desktop-drawer.png`
- Desktop `+ New board` modal separation: `/home/me/projects/better-hermes-kanban-wt-t_f78a1e71/qa/screenshots/desktop-new-board-modal-not-settings.png`
- Mobile fullscreen settings drawer: `/home/me/projects/better-hermes-kanban-wt-t_f78a1e71/qa/screenshots/settings-mobile-fullscreen.png`
- Raw CDP run output: `/tmp/bhk_settings_qa_result.json`

## Pass/fail table

| Area | Result | Evidence / notes |
| --- | --- | --- |
| Desktop build loads live board | PASS | Board `better-hermes-kanban` loaded from bridge; no offline fallback banner. |
| Gear opens Settings drawer | PASS | Desktop `desktop-settings-button` opens `settings-drawer`; mobile `mobile-settings-button` opens same drawer. |
| Desktop drawer direction/visual fit | PASS | Right-side 460px drawer, dimmed board behind it, aligned with accepted dark BHK chrome. |
| Field coverage vs original/contract | PASS | Active board name/slug/description/tasks; editable orchestrator/default assignee/auto-decompose/auto-promote; resolved helper rows; advanced dispatcher limits all present. |
| Advanced fields read-only | PASS | Advanced dispatcher limits render as text rows, not inputs/selects/buttons. |
| Outside click closes drawer | PASS | Desktop outside click dismissed the drawer. |
| Close without Save does not mutate | PASS | Toggled `auto_decompose` locally, closed drawer, API stayed `false` before/after. |
| Explicit Save updates settings | PASS | Browser flow toggled `Auto-promote children` true → false, clicked Save, API returned `auto_promote_children: false`; settings were restored to `true` after QA. |
| `+ New board` opens modal, not Settings | PASS | Board selector `+ New board` opened `new-board-modal`; `settings-drawer` was absent. Screenshot confirms centered New board modal. |
| Settings drawer never creates boards | PASS | Opening `+ New board` produced no `POST /api/plugins/kanban/boards`; no board was created because Create was not submitted. |
| Mobile fullscreen behavior | PASS | 390×844 viewport: drawer bounds `{x:0,y:0,w:390,h:844}`, sticky footer visible, no horizontal clipping. |
| Mobile swipe/close behavior | PASS | Right-swipe closed the fullscreen drawer; explicit close button also closed it. |
| `/settings` compatibility shim | FAIL (minor) | Direct `/settings` opens drawer and avoids standalone settings page, but replaces URL to `/` instead of resolved board route `/boards/better-hermes-kanban`. Follow-up created: `t_37e7b437`. |

## Console / API errors

- Browser console: no JS console messages or uncaught exceptions during CDP run and manual Save check.
- API/network: no `>=400` responses captured for `/api/plugins/kanban/*` during QA.
- Save PUT payload was limited to supported fields only: `orchestrator_profile`, `default_assignee`, `auto_decompose`, `auto_promote_children`.
- Board creation safety: no `POST /api/plugins/kanban/boards` occurred when opening the New board modal.

## Visual notes

- Desktop: drawer feels consistent with accepted BHK dark control-room chrome; the board remains visible but clearly de-emphasized behind the drawer. Content hierarchy is practical and not over-decorated.
- Mobile: fullscreen sheet is the right choice; fields are readable at 390px and the Save/Cancel footer remains reachable. The Advanced section begins below the fold but scroll behavior is acceptable.
- New board modal: visually distinct from Settings; good separation of creation vs settings responsibilities.

## Follow-up tasks

Created:
- `t_37e7b437` — Fix `/settings` compatibility shim route target.

No critical interaction failure found. Build, drawer open/close, explicit Save, no-save close, New board separation, no accidental board creation, and mobile fullscreen/swipe all pass.
