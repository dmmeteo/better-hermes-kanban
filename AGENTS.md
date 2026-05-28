# Better Hermes Kanban agent rules

## Non-negotiable git workflow

- Do **not** make substantial edits in this shared checkout.
- Before any code/docs change, inspect:
  - `git status --short`
  - `git branch --show-current`
  - `git worktree list`
- Use one task-scoped worktree per implementation/QA task:
  - branch: `agent/<task-id-or-short-slug>` or `work/<short-slug>`
  - worktree: sibling directory such as `../better-hermes-kanban-wt-<slug>`
- Keep each task as focused commits. Do not leave uncommitted work in the shared checkout.
- If the shared checkout is dirty, assume those changes belong to another worker unless the user explicitly tells you to curate/commit them.
- Never overwrite unrelated dirty files. Re-read files from the active worktree immediately before patching.
- Run `git diff --check` before every commit.
- Report branch, worktree path, commit hash, and verification in the final handoff.

## Product/design constraints

- Preserve the accepted BHK desktop kanban layout unless the user explicitly asks to change it.
- Mobile-first does not mean desktop can become a stretched mobile layout.
- Keep BHK simple and board/task-oriented; avoid heavy cloud-console patterns.
- Stable `data-testid` hooks are expected for new interactive UI used in browser QA.

## Verification defaults

- Run `npm run build` for frontend changes.
- Run focused browser QA for layout/interaction changes when practical.
- `npm run lint` currently has pre-existing repo-wide issues; note whether failures are unrelated or introduced.
