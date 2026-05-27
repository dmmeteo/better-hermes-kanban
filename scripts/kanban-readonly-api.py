#!/usr/bin/env python3
"""Better Hermes Kanban API bridge.

Serves the subset of /api/plugins/kanban used by the standalone BHK SPA
without depending on the ephemeral Hermes dashboard session token.

Endpoints:
- GET /healthz
- GET /api/plugins/kanban/boards
- GET /api/plugins/kanban/board?board=<slug>
- GET /api/plugins/kanban/profiles
- GET /api/plugins/kanban/assignees
- GET /api/plugins/kanban/orchestration
- GET /api/plugins/kanban/search?q=<query>&board=<slug|all>&status=<status>&assignee=<profile>&priority=<p0|p1|p2|p3>&has_warnings=<bool>&has_links=<bool>&limit=<n>&offset=<n>&sort=<relevance|updated|priority>
- GET /api/plugins/kanban/tasks/<id>?board=<slug>
- GET /api/plugins/kanban/tasks/<id>/logs?board=<slug>&tail_bytes=<n>
- PUT /api/plugins/kanban/orchestration
- PATCH /api/plugins/kanban/tasks/<id>?board=<slug>

The data source is the Hermes Kanban CLI/SQLite board layer. This is a
local-only bridge intended to be reverse-proxied by nginx from the BHK static
container. It implements only guarded low-risk task updates.
"""
from __future__ import annotations

import json
import subprocess
import sys
import time
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HERMES_REPO = Path("/home/me/.hermes/hermes-agent")
if str(HERMES_REPO) not in sys.path:
    sys.path.insert(0, str(HERMES_REPO))

from hermes_cli import kanban_db
from hermes_cli.config import load_config, save_config

HOST = "172.17.0.1"
PORT = 9120
HERMES = "/home/me/.hermes/hermes-agent/venv/bin/hermes"
ALLOWED_UPDATE_FIELDS = {"status", "assignee", "priority", "title", "body"}
ALLOWED_STATUSES = {"triage", "todo", "scheduled", "ready", "blocked", "done"}
ALLOWED_CREATE_FIELDS = {
    "title",
    "body",
    "description",
    "assignee",
    "priority",
    "status",
    "parents",
    "parent_ids",
    "workspace_kind",
    "workspace_path",
}
ALLOWED_WORKSPACE_KINDS = {"scratch", "dir", "worktree"}
BOARD_UPDATE_FIELDS = {"name", "description", "icon", "color", "default_workdir"}
BOARD_SEGMENT_RE = re.compile(r"^/api/plugins/kanban/boards/([^/]+)(?:/(switch))?$")
SAFE_ORCHESTRATION_FIELDS = {
    "orchestrator_profile",
    "default_assignee",
    "auto_decompose",
    "auto_promote_children",
}
READONLY_ORCHESTRATION_FIELDS = {
    "max_in_progress",
    "max_spawn",
    "dispatch_interval_seconds",
    "failure_limit",
    "dispatch_stale_timeout_seconds",
}


def run_json(args: list[str]) -> object:
    out = subprocess.check_output(args, text=True, stderr=subprocess.STDOUT, timeout=20)
    return json.loads(out)



def resolve_board(slug: str | None) -> str | None:
    if not slug:
        return None
    board = kanban_db._normalize_board_slug(slug)
    if board and board != kanban_db.DEFAULT_BOARD and not kanban_db.board_exists(board):
        raise ValueError(f"board {board!r} does not exist")
    return board


def task_to_dict(task: object, board: str | None) -> dict:
    data = task.__dict__.copy() if hasattr(task, "__dict__") else dict(task)
    if board:
        data.setdefault("board", board)
    return data


def priority_from_payload(value: object, default: int = 50) -> int:
    if value is None or value == "":
        return default
    if isinstance(value, str):
        raw = value.strip().lower()
        if raw in {"p0", "critical"}:
            return 100
        if raw in {"p1", "high"}:
            return 90
        if raw in {"p2", "medium"}:
            return 50
        if raw in {"p3", "low"}:
            return 10
    try:
        priority = int(value)
    except (TypeError, ValueError):
        raise ValueError("priority must be P0/P1/P2/P3 or a numeric value")
    if priority < 0 or priority > 1000:
        raise ValueError("priority must be between 0 and 1000")
    return priority


def create_task(payload: dict, slug: str | None) -> dict:
    unknown = sorted(set(payload) - ALLOWED_CREATE_FIELDS)
    if unknown:
        raise ValueError(f"Unsupported create field(s): {', '.join(unknown)}")
    board = resolve_board(slug)
    title = str(payload.get("title") or "").strip()
    if not title:
        raise ValueError("title is required")
    if len(title) > 240:
        raise ValueError("title must be 240 characters or less")
    body = str(payload.get("body", payload.get("description", "")) or "").strip()
    if len(body) > 20000:
        raise ValueError("body must be 20000 characters or less")
    assignee = str(payload.get("assignee") or "").strip() or None
    if assignee and not profile_exists(assignee):
        raise ValueError(f"profile {assignee!r} does not exist")
    status = str(payload.get("status") or "triage").strip().lower()
    if status not in {"triage", "todo", "scheduled", "ready", "blocked"}:
        raise ValueError("status must be one of triage, todo, scheduled, ready, blocked")
    workspace_kind = str(payload.get("workspace_kind") or "scratch").strip().lower()
    if workspace_kind not in ALLOWED_WORKSPACE_KINDS:
        raise ValueError("workspace_kind must be one of scratch, dir, worktree")
    workspace_path = str(payload.get("workspace_path") or "").strip() or None
    if workspace_path and not Path(workspace_path).is_absolute():
        raise ValueError("workspace_path must be absolute when provided")
    parents_raw = payload.get("parents", payload.get("parent_ids", []))
    if parents_raw is None:
        parents: list[str] = []
    elif isinstance(parents_raw, list):
        parents = [str(parent).strip() for parent in parents_raw if str(parent).strip()]
    else:
        raise ValueError("parents must be a list of task ids")

    kanban_db.init_db(board=board)
    conn = kanban_db.connect(board=board)
    try:
        task_id = kanban_db.create_task(
            conn,
            title=title,
            body=body,
            assignee=assignee,
            created_by="bhk",
            workspace_kind=workspace_kind,
            workspace_path=workspace_path,
            priority=priority_from_payload(payload.get("priority"), 50),
            parents=parents,
            triage=status == "triage",
            initial_status="blocked" if status == "blocked" else "running",
            board=board,
        )
        if status == "scheduled":
            kanban_db.schedule_task(conn, task_id, reason="Scheduled from BHK guarded create")
        elif status in {"todo", "ready"}:
            set_status_direct(conn, task_id, status)
        task = kanban_db.get_task(conn, task_id)
        return {"task": task_to_dict(task, board)}
    finally:
        conn.close()


def update_task(task_id: str, payload: dict, slug: str | None) -> dict:
    unknown = sorted(set(payload) - ALLOWED_UPDATE_FIELDS)
    if unknown:
        raise ValueError(f"Unsupported update field(s): {', '.join(unknown)}")
    board = resolve_board(slug)
    kanban_db.init_db(board=board)
    conn = kanban_db.connect(board=board)
    try:
        task = kanban_db.get_task(conn, task_id)
        if task is None:
            return {"_status": 404, "detail": f"task {task_id} not found"}
        if payload.get("status") == "running":
            return {"_status": 400, "detail": "Cannot set status to 'running' directly; use dispatcher/claim"}
        if "status" in payload and payload["status"] not in ALLOWED_STATUSES:
            return {"_status": 400, "detail": f"unsupported status: {payload['status']}"}

        if "assignee" in payload:
            try:
                ok = kanban_db.assign_task(conn, task_id, payload.get("assignee") or None)
            except RuntimeError as exc:
                return {"_status": 409, "detail": str(exc)}
            if not ok:
                return {"_status": 404, "detail": "task not found"}

        if "status" in payload:
            status = payload["status"]
            if status == "done":
                ok = kanban_db.complete_task(conn, task_id, result=None, summary=None, metadata=None)
            elif status == "blocked":
                ok = kanban_db.block_task(conn, task_id, reason="Blocked from BHK guarded update")
            elif status == "scheduled":
                ok = kanban_db.schedule_task(conn, task_id, reason="Scheduled from BHK guarded update")
            elif status == "ready":
                current = kanban_db.get_task(conn, task_id)
                ok = kanban_db.unblock_task(conn, task_id) if current and current.status in ("blocked", "scheduled") else set_status_direct(conn, task_id, "ready")
            else:
                ok = set_status_direct(conn, task_id, status)
            if not ok:
                return {"_status": 409, "detail": f"status transition to {status!r} not valid from current state"}

        if "priority" in payload:
            with kanban_db.write_txn(conn):
                conn.execute("UPDATE tasks SET priority = ? WHERE id = ?", (int(payload["priority"]), task_id))
                conn.execute(
                    "INSERT INTO task_events (task_id, kind, payload, created_at) VALUES (?, 'reprioritized', ?, ?)",
                    (task_id, json.dumps({"priority": int(payload["priority"])}), int(time.time())),
                )

        if "title" in payload or "body" in payload:
            with kanban_db.write_txn(conn):
                sets: list[str] = []
                vals: list[object] = []
                if "title" in payload:
                    title = str(payload["title"]).strip()
                    if not title:
                        return {"_status": 400, "detail": "title cannot be empty"}
                    sets.append("title = ?")
                    vals.append(title)
                if "body" in payload:
                    sets.append("body = ?")
                    vals.append(str(payload.get("body") or ""))
                vals.append(task_id)
                conn.execute(f"UPDATE tasks SET {', '.join(sets)} WHERE id = ?", vals)
                conn.execute("INSERT INTO task_events (task_id, kind, payload, created_at) VALUES (?, 'edited', NULL, ?)", (task_id, int(time.time())))

        updated = kanban_db.get_task(conn, task_id)
        return {"task": task_to_dict(updated, board)}
    finally:
        conn.close()


def set_status_direct(conn, task_id: str, status: str) -> bool:
    with kanban_db.write_txn(conn):
        cur = conn.execute("UPDATE tasks SET status = ? WHERE id = ? AND status != 'running'", (status, task_id))
        if cur.rowcount <= 0:
            return False
        conn.execute(
            "INSERT INTO task_events (task_id, kind, payload, created_at) VALUES (?, 'status_changed', ?, ?)",
            (task_id, json.dumps({"status": status, "source": "bhk"}), int(time.time())),
        )
    return True

def board_list() -> dict:
    boards = run_json([HERMES, "kanban", "boards", "list", "--json"])
    return {"boards": boards}


def create_board(payload: dict) -> dict:
    slug = str(payload.get("slug") or "").strip()
    if not slug:
        raise ValueError("board slug is required")
    board = kanban_db.create_board(
        slug,
        name=payload.get("name"),
        description=payload.get("description"),
        icon=payload.get("icon"),
        color=payload.get("color"),
        default_workdir=payload.get("default_workdir"),
    )
    return {"board": board}


def update_board(slug: str, payload: dict) -> dict:
    unknown = sorted(set(payload) - BOARD_UPDATE_FIELDS)
    if unknown:
        raise ValueError(f"Unsupported board field(s): {', '.join(unknown)}")
    board = resolve_board(slug)
    if not board or not kanban_db.board_exists(board):
        return {"_status": 404, "detail": f"board {slug!r} not found"}
    updated = kanban_db.write_board_metadata(
        board,
        name=payload.get("name") if "name" in payload else None,
        description=payload.get("description") if "description" in payload else None,
        icon=payload.get("icon") if "icon" in payload else None,
        color=payload.get("color") if "color" in payload else None,
        default_workdir=payload.get("default_workdir") if "default_workdir" in payload else None,
    )
    return {"board": updated}


def remove_board(slug: str, *, hard_delete: bool = False) -> dict:
    return {"result": kanban_db.remove_board(slug, archive=not hard_delete)}


def list_profiles() -> dict:
    try:
        profiles = kanban_db.list_profiles_on_disk()
    except Exception:
        profiles = []
    return {
        "profiles": [
            {"id": name, "name": name, "icon": "bot", "source": "profile"}
            for name in profiles
        ]
    }


def list_assignees(slug: str | None = None) -> dict:
    board = resolve_board(slug)
    kanban_db.init_db(board=board)
    conn = kanban_db.connect(board=board)
    try:
        return {"assignees": kanban_db.known_assignees(conn)}
    finally:
        conn.close()


def profile_exists(name: str) -> bool:
    return not name or name in set(kanban_db.list_profiles_on_disk())


def orchestration_payload() -> dict:
    cfg = load_config() or {}
    kanban_cfg = cfg.get("kanban") if isinstance(cfg, dict) else {}
    if not isinstance(kanban_cfg, dict):
        kanban_cfg = {}

    explicit_orch = str(kanban_cfg.get("orchestrator_profile") or "").strip()
    explicit_default = str(kanban_cfg.get("default_assignee") or "").strip()
    profiles = set(kanban_db.list_profiles_on_disk())
    active_default = "developer" if "developer" in profiles else "default"
    resolved_orch = explicit_orch if explicit_orch in profiles else active_default
    resolved_default = explicit_default if explicit_default in profiles else active_default

    advanced = {key: kanban_cfg.get(key) for key in READONLY_ORCHESTRATION_FIELDS}
    return {
        "orchestrator_profile": explicit_orch,
        "default_assignee": explicit_default,
        "auto_decompose": bool(kanban_cfg.get("auto_decompose", True)),
        "auto_promote_children": bool(kanban_cfg.get("auto_promote_children", True)),
        "resolved_orchestrator_profile": resolved_orch,
        "resolved_default_assignee": resolved_default,
        "active_profile": active_default,
        "advanced": advanced,
        "explicit": {key: key in kanban_cfg for key in (SAFE_ORCHESTRATION_FIELDS | READONLY_ORCHESTRATION_FIELDS)},
    }


def update_orchestration(payload: dict) -> dict:
    unknown = sorted(set(payload) - SAFE_ORCHESTRATION_FIELDS)
    if unknown:
        raise ValueError(f"Unsupported orchestration field(s): {', '.join(unknown)}")
    cfg = load_config() or {}
    kanban_section = cfg.setdefault("kanban", {})
    if not isinstance(kanban_section, dict):
        kanban_section = {}
        cfg["kanban"] = kanban_section

    for key in ("orchestrator_profile", "default_assignee"):
        if key in payload:
            name = str(payload.get(key) or "").strip()
            if name and not profile_exists(name):
                return {"_status": 400, "detail": f"profile '{name}' does not exist"}
            kanban_section[key] = name
    for key in ("auto_decompose", "auto_promote_children"):
        if key in payload:
            kanban_section[key] = bool(payload[key])

    save_config(cfg)
    return orchestration_payload()


def switch_board(slug: str, payload: dict) -> dict:
    board = resolve_board(slug)
    if not board or not kanban_db.board_exists(board):
        return {"_status": 404, "detail": f"board {slug!r} not found"}
    persist = bool(payload.get("persist", True))
    if persist:
        kanban_db.set_current_board(board)
    meta = kanban_db.read_board_metadata(board)
    meta["is_current"] = persist or kanban_db.get_current_board() == board
    return {"board": meta}


def board_payload(slug: str | None) -> dict:
    cmd = [HERMES, "kanban"]
    if slug:
        cmd += ["--board", slug]
    cmd += ["list", "--json"]
    tasks = run_json(cmd)
    if not isinstance(tasks, list):
        tasks = []
    normalized = []
    for task in tasks:
        if isinstance(task, dict):
            item = dict(task)
            if slug:
                item.setdefault("board", slug)
            normalized.append(item)
    board_id = slug or "current"
    return {
        "board": {"slug": board_id, "name": board_id, "total": len(normalized), "task_count": len(normalized)},
        "tasks": normalized,
    }


def parse_bool(value: str | None) -> bool | None:
    if value is None or value == "":
        return None
    return value.strip().lower() in {"1", "true", "yes", "on"}


def limit_from_query(value: str | None, default: int = 50, maximum: int = 100) -> int:
    try:
        limit = int(value or default)
    except (TypeError, ValueError):
        return default
    return max(1, min(maximum, limit))


def offset_from_query(value: str | None) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def priority_matches(task_priority: object, wanted: str | None) -> bool:
    if not wanted:
        return True
    try:
        normalized = priority_from_payload(task_priority, 50)
    except ValueError:
        normalized = 50
    label = wanted.strip().lower()
    if label == "p0":
        return normalized >= 100
    if label == "p1":
        return 50 <= normalized < 100
    if label == "p2":
        return 11 <= normalized < 50
    if label == "p3":
        return normalized <= 10
    try:
        return normalized == int(label)
    except ValueError:
        return False


def truncate_text(value: object, max_chars: int = 260) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 1].rstrip() + "…"


def snippet_for(text: object, query: str, max_chars: int = 260) -> str:
    source = re.sub(r"\s+", " ", str(text or "")).strip()
    if not source:
        return ""
    if not query:
        return truncate_text(source, max_chars)
    pos = source.lower().find(query.lower())
    if pos < 0:
        return truncate_text(source, max_chars)
    half = max_chars // 2
    start = max(0, pos - half)
    end = min(len(source), start + max_chars)
    start = max(0, end - max_chars)
    prefix = "…" if start else ""
    suffix = "…" if end < len(source) else ""
    return prefix + source[start:end].strip() + suffix


def latest_run_summary(conn, task_id: str) -> tuple[str, int | None]:
    row = conn.execute(
        "SELECT summary, error, outcome, ended_at, started_at FROM task_runs WHERE task_id = ? ORDER BY COALESCE(ended_at, started_at, 0) DESC, id DESC LIMIT 1",
        (task_id,),
    ).fetchone()
    if not row:
        return "", None
    text = row["summary"] or row["error"] or row["outcome"] or ""
    return str(text or ""), row["ended_at"] or row["started_at"]


def task_comments(conn, task_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT id, author, body, created_at FROM task_comments WHERE task_id = ? ORDER BY created_at DESC LIMIT 50",
        (task_id,),
    ).fetchall()
    return [
        {
            "id": str(row["id"]),
            "author": row["author"] or "user",
            "body": row["body"] or "",
            "text": row["body"] or "",
            "created_at": row["created_at"],
        }
        for row in rows
    ]


def task_runs(conn, task_id: str) -> list[dict]:
    rows = conn.execute(
        """
        SELECT id, status, outcome, summary, error, started_at, ended_at
        FROM task_runs
        WHERE task_id = ?
        ORDER BY started_at DESC, id DESC
        LIMIT 20
        """,
        (task_id,),
    ).fetchall()
    return [
        {
            "id": str(row["id"]),
            "run_id": row["id"],
            "status": row["status"] or row["outcome"] or "started",
            "outcome": row["outcome"],
            "summary": row["summary"],
            "error": row["error"],
            "started_at": row["started_at"],
            "ended_at": row["ended_at"],
        }
        for row in rows
    ]


def activity_type(kind: str) -> str:
    raw = (kind or "").lower()
    if "comment" in raw:
        return "comment"
    if "assign" in raw:
        return "assignment"
    if "block" in raw:
        return "block"
    if "reclaim" in raw:
        return "reclaim"
    if "specify" in raw:
        return "specify"
    if "decompose" in raw:
        return "decompose"
    if "status" in raw or "complete" in raw or "ready" in raw or "schedule" in raw:
        return "status_change"
    return "run"


def task_activity(conn, task_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT id, kind, payload, created_at FROM task_events WHERE task_id = ? ORDER BY created_at DESC, id DESC LIMIT 50",
        (task_id,),
    ).fetchall()
    activity: list[dict] = []
    for row in rows:
        payload = row["payload"]
        description = row["kind"] or "Activity"
        metadata = None
        if payload:
            try:
                metadata = json.loads(payload)
                if isinstance(metadata, dict):
                    detail = metadata.get("reason") or metadata.get("status") or metadata.get("assignee") or metadata.get("summary")
                    if detail:
                        description = f"{description}: {detail}"
                else:
                    metadata = {"value": metadata}
            except json.JSONDecodeError:
                metadata = {"value": payload}
                description = f"{description}: {payload}"
        activity.append({
            "id": str(row["id"]),
            "type": activity_type(row["kind"]),
            "description": description.replace("_", " "),
            "created_at": row["created_at"],
            "payload": metadata,
        })
    return activity


def task_counts(conn, task_id: str) -> tuple[int, int, int]:
    comment_count = conn.execute("SELECT COUNT(*) AS count FROM task_comments WHERE task_id = ?", (task_id,)).fetchone()["count"]
    link_count = conn.execute("SELECT COUNT(*) AS count FROM task_links WHERE parent_id = ? OR child_id = ?", (task_id, task_id)).fetchone()["count"]
    warning_count = conn.execute(
        "SELECT COUNT(*) AS count FROM task_events WHERE task_id = ? AND (kind LIKE '%warn%' OR payload LIKE '%warning%' OR payload LIKE '%review-required%')",
        (task_id,),
    ).fetchone()["count"]
    return int(comment_count or 0), int(link_count or 0), int(warning_count or 0)


def linked_tasks(conn, task_id: str, board: str) -> list[dict]:
    """Return compact parent/child task records for the BHK detail UI."""
    rows = conn.execute(
        """
        SELECT
            links.parent_id,
            links.child_id,
            tasks.id AS task_id,
            tasks.title,
            tasks.status,
            tasks.priority,
            tasks.assignee
        FROM task_links AS links
        JOIN tasks
            ON tasks.id = CASE
                WHEN lower(links.parent_id) = lower(?) THEN links.child_id
                ELSE links.parent_id
            END
        WHERE lower(links.parent_id) = lower(?) OR lower(links.child_id) = lower(?)
        ORDER BY
            CASE WHEN lower(links.parent_id) = lower(?) THEN 1 ELSE 0 END,
            tasks.created_at ASC,
            tasks.id ASC
        """,
        (task_id, task_id, task_id, task_id),
    ).fetchall()
    links: list[dict] = []
    for index, row in enumerate(rows):
        relation = "child" if str(row["parent_id"]).lower() == task_id.lower() else "parent"
        related_task_id = str(row["task_id"])
        links.append({
            "id": f"link-{index}-{row['parent_id']}-{row['child_id']}",
            "task_id": related_task_id,
            "taskId": related_task_id,
            "title": row["title"] or related_task_id,
            "status": row["status"] or "todo",
            "priority": row["priority"],
            "assignee": row["assignee"],
            "relation": relation,
            "board": board,
            "board_id": board,
        })
    return links



def task_worker_log_payload(task_id: str, slug: str | None = None, tail_bytes: int = 65536) -> dict:
    """Return the per-task worker terminal log as a separate refreshable DTO.

    This keeps comments, run rows, event rows, and raw worker stdout/stderr as
    distinct streams for the BHK detail layout. Missing/GC'd logs intentionally
    return an empty text payload so panels render an empty state instead of an
    API error.
    """
    board = resolve_board(slug)
    path = kanban_db.worker_log_path(task_id, board=board)
    text = kanban_db.read_worker_log(task_id, tail_bytes=tail_bytes, board=board)
    size = path.stat().st_size if path.exists() else 0
    return {
        "worker_log": {
            "task_id": task_id,
            "board": board or kanban_db.get_current_board(),
            "text": text or "",
            "size_bytes": size,
            "truncated": bool(size and tail_bytes and size > tail_bytes),
            "path": str(path) if path.exists() else None,
            "refreshed_at": int(time.time()),
        }
    }

def board_choices(slug: str | None) -> list[dict]:
    if slug and slug.lower() not in {"all", "*"}:
        board = resolve_board(slug)
        meta = kanban_db.read_board_metadata(board or kanban_db.DEFAULT_BOARD)
        return [meta]
    return kanban_db.list_boards(include_archived=False)


def task_detail_payload(task_id: str, slug: str | None = None) -> dict:
    exact = search_tasks({"q": [task_id], "board": [slug]} if slug else {"q": [task_id]}, exact_task_id=task_id, limit_override=1)
    if not exact["results"]:
        return {"_status": 404, "detail": f"task {task_id} not found"}
    task = exact["results"][0]["task"]
    task["worker_log"] = task_worker_log_payload(task_id, task.get("board") or slug)["worker_log"]
    return {"task": task}


def empty_search_response(now: int | None = None) -> dict:
    return {
        "results": [],
        "total": 0,
        "nextCursor": None,
        "source": "sqlite",
        "indexedAt": now or int(time.time()),
    }


def search_tasks(
    qs: dict[str, list[str]],
    *,
    exact_task_id: str | None = None,
    limit_override: int | None = None,
    empty_on_unknown_board: bool = False,
) -> dict:
    query = (qs.get("q") or [""])[0].strip()
    board_filter = (qs.get("board") or [None])[0]
    status_filter = (qs.get("status") or [""])[0].strip().lower()
    assignee_filter = (qs.get("assignee") or [""])[0].strip().lower()
    priority_filter = (qs.get("priority") or [""])[0].strip().lower()
    has_warnings = parse_bool((qs.get("has_warnings") or [None])[0])
    has_links = parse_bool((qs.get("has_links") or [None])[0])
    sort = ((qs.get("sort") or [""])[0] or ("relevance" if query else "updated")).strip().lower()
    limit = limit_override or limit_from_query((qs.get("limit") or [None])[0])
    offset = offset_from_query((qs.get("offset") or qs.get("cursor") or [None])[0])
    exact_re = re.compile(r"^t_[0-9a-f]{8}$", re.IGNORECASE)
    exact_id = exact_task_id or (query if exact_re.match(query) else None)
    now = int(time.time())
    results: list[dict] = []
    seen_sources: set[tuple[str, str]] = set()

    try:
        boards = board_choices(board_filter)
    except ValueError:
        if empty_on_unknown_board:
            return empty_search_response(now)
        raise

    for board_meta in boards:
        board = board_meta.get("slug") or board_meta.get("id") or kanban_db.DEFAULT_BOARD
        db_identity = str(board_meta.get("db_path") or board)
        try:
            kanban_db.init_db(board=board)
            conn = kanban_db.connect(board=board)
        except Exception:
            continue
        try:
            if exact_id:
                rows = conn.execute("SELECT * FROM tasks WHERE lower(id) = lower(?)", (exact_id,)).fetchall()
            else:
                rows = conn.execute("SELECT * FROM tasks").fetchall()
            for row in rows:
                task_id = row["id"]
                source_key = (db_identity, task_id)
                if source_key in seen_sources:
                    continue
                seen_sources.add(source_key)
                comments = task_comments(conn, task_id)
                runs = task_runs(conn, task_id) if exact_id else []
                events = task_activity(conn, task_id) if exact_id else []
                latest_summary, summary_updated_at = latest_run_summary(conn, task_id)
                comment_count, link_count, warning_count = task_counts(conn, task_id)
                links = linked_tasks(conn, task_id, board) if exact_id or link_count else []
                if status_filter and row["status"].lower() != status_filter:
                    continue
                if assignee_filter and (row["assignee"] or "").lower() != assignee_filter:
                    continue
                if not priority_matches(row["priority"], priority_filter):
                    continue
                if has_warnings is not None and (warning_count > 0) != has_warnings:
                    continue
                if has_links is not None and (link_count > 0) != has_links:
                    continue

                searchable_comments = " ".join(str(comment["body"] or "") for comment in comments)
                fields = {
                    "id": task_id,
                    "title": row["title"] or "",
                    "body": row["body"] or "",
                    "summary": latest_summary,
                    "comments": searchable_comments,
                    "assignee": row["assignee"] or "",
                    "status": row["status"] or "",
                    "board": f"{board} {board_meta.get('name') or ''} {board_meta.get('description') or ''}",
                }
                if query:
                    haystack = " ".join(fields.values()).lower()
                    if query.lower() not in haystack:
                        continue
                score = 0
                match_field = "title"
                if query:
                    q = query.lower()
                    if task_id.lower() == q:
                        score += 1000
                        match_field = "id"
                    elif q in task_id.lower():
                        score += 600
                        match_field = "id"
                    elif q in fields["title"].lower():
                        score += 300
                        match_field = "title"
                    elif q in fields["body"].lower():
                        score += 120
                        match_field = "body"
                    elif q in fields["summary"].lower():
                        score += 100
                        match_field = "summary"
                    elif q in fields["comments"].lower():
                        score += 80
                        match_field = "comment"
                    elif q in fields["assignee"].lower() or q in fields["status"].lower() or q in fields["board"].lower():
                        score += 50
                        match_field = "metadata"
                updated_at = row["completed_at"] or row["started_at"] or summary_updated_at or row["created_at"]
                if match_field == "comment":
                    matching_comment = next((comment for comment in comments if query.lower() in str(comment["body"] or "").lower()), comments[0] if comments else None)
                    snippet = f"comment by {matching_comment['author']}: {snippet_for(matching_comment['body'], query)}" if matching_comment else ""
                elif match_field == "summary":
                    snippet = snippet_for(latest_summary, query)
                elif match_field == "body":
                    snippet = snippet_for(row["body"], query)
                elif match_field == "metadata":
                    snippet = truncate_text(f"{row['status']} · {row['assignee'] or 'unassigned'} · {board_meta.get('name') or board}")
                else:
                    snippet = snippet_for(row["body"] or latest_summary or row["title"], query)
                task = task_to_dict(dict(row), board)
                task.update({
                    "board": board,
                    "board_id": board,
                    "description": row["body"] or "",
                    "latest_summary": latest_summary or None,
                    "summary_updated_at": summary_updated_at,
                    "comment_count": comment_count,
                    "comments": comments,
                    "activity": events,
                    "events": events,
                    "runs": runs,
                    "link_count": link_count,
                    "links": links,
                    "linkedTasks": links,
                    "warning_count": warning_count,
                    "updated_at": updated_at,
                })
                results.append({
                    "id": task_id,
                    "title": row["title"],
                    "body": truncate_text(row["body"], 320),
                    "snippet": snippet,
                    "matchField": match_field,
                    "exact": bool(exact_id and task_id.lower() == exact_id.lower()),
                    "status": row["status"],
                    "priority": row["priority"],
                    "assignee": row["assignee"],
                    "boardId": board,
                    "boardName": board_meta.get("name") or board,
                    "commentCount": comment_count,
                    "linkCount": link_count,
                    "warningCount": warning_count,
                    "latestSummary": latest_summary or None,
                    "createdAt": row["created_at"],
                    "updatedAt": updated_at,
                    "source": "sqlite",
                    "indexedAt": now,
                    "score": score,
                    "task": task,
                })
        finally:
            conn.close()
    if sort == "priority":
        results.sort(key=lambda r: (int(r.get("priority") or 0), int(r.get("updatedAt") or 0)), reverse=True)
    elif sort in {"updated", "newest"}:
        results.sort(key=lambda r: int(r.get("updatedAt") or 0), reverse=True)
    else:
        results.sort(key=lambda r: (int(r.get("score") or 0), int(r.get("updatedAt") or 0)), reverse=True)
    total = len(results)
    page = results[offset : offset + limit]
    for item in page:
        item.pop("score", None)
    next_offset = offset + limit if offset + limit < total else None
    return {
        "results": page,
        "total": total,
        "nextCursor": str(next_offset) if next_offset is not None else None,
        "source": "sqlite",
        "indexedAt": now,
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "BHKReadonlyKanban/1.0"

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stderr.write("%s - - [%s] %s\n" % (self.client_address[0], self.log_date_time_string(), fmt % args))

    def send_json(self, status: int, payload: object) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0:
            return {}
        body = self.rfile.read(length).decode("utf-8")
        payload = json.loads(body or "{}")
        if not isinstance(payload, dict):
            raise ValueError("JSON body must be an object")
        return payload

    def do_POST(self) -> None:  # noqa: N802 - stdlib callback name
        parsed = urlparse(self.path)
        try:
            if parsed.path == "/api/plugins/kanban/boards":
                self.send_json(201, create_board(self.read_json_body()))
                return
            if parsed.path == "/api/plugins/kanban/tasks":
                qs = parse_qs(parsed.query)
                result = create_task(self.read_json_body(), (qs.get("board") or [None])[0])
                status = int(result.pop("_status", 201))
                self.send_json(status, result)
                return
            match = BOARD_SEGMENT_RE.match(parsed.path)
            if match and match.group(2) == "switch":
                result = switch_board(match.group(1), self.read_json_body())
                status = int(result.pop("_status", 200))
                self.send_json(status, result)
                return
            self.send_json(404, {"detail": "Not found"})
        except json.JSONDecodeError:
            self.send_json(400, {"detail": "Invalid JSON body"})
        except ValueError as exc:
            self.send_json(400, {"detail": str(exc)})
        except Exception as exc:
            self.send_json(500, {"detail": f"BHK board API error: {exc}"})

    def do_PUT(self) -> None:  # noqa: N802 - stdlib callback name
        parsed = urlparse(self.path)
        try:
            if parsed.path == "/api/plugins/kanban/orchestration":
                result = update_orchestration(self.read_json_body())
                status = int(result.pop("_status", 200))
                self.send_json(status, result)
                return
            self.send_json(404, {"detail": "Not found"})
        except json.JSONDecodeError:
            self.send_json(400, {"detail": "Invalid JSON body"})
        except ValueError as exc:
            self.send_json(400, {"detail": str(exc)})
        except Exception as exc:
            self.send_json(500, {"detail": f"BHK orchestration API error: {exc}"})

    def do_PATCH(self) -> None:  # noqa: N802 - stdlib callback name
        parsed = urlparse(self.path)
        try:
            prefix = "/api/plugins/kanban/tasks/"
            if parsed.path.startswith(prefix):
                task_id = parsed.path[len(prefix):]
                qs = parse_qs(parsed.query)
                result = update_task(task_id, self.read_json_body(), (qs.get("board") or [None])[0])
                status = int(result.pop("_status", 200))
                self.send_json(status, result)
                return
            match = BOARD_SEGMENT_RE.match(parsed.path)
            if match and not match.group(2):
                result = update_board(match.group(1), self.read_json_body())
                status = int(result.pop("_status", 200))
                self.send_json(status, result)
                return
            self.send_json(404, {"detail": "Not found"})
        except json.JSONDecodeError:
            self.send_json(400, {"detail": "Invalid JSON body"})
        except ValueError as exc:
            self.send_json(400, {"detail": str(exc)})
        except Exception as exc:
            self.send_json(500, {"detail": f"BHK update API error: {exc}"})

    def do_DELETE(self) -> None:  # noqa: N802 - stdlib callback name
        parsed = urlparse(self.path)
        try:
            match = BOARD_SEGMENT_RE.match(parsed.path)
            if match and not match.group(2):
                qs = parse_qs(parsed.query)
                hard_delete = (qs.get("delete") or [""])[0].lower() in {"1", "true", "yes"}
                self.send_json(200, remove_board(match.group(1), hard_delete=hard_delete))
                return
            self.send_json(404, {"detail": "Not found"})
        except ValueError as exc:
            self.send_json(400, {"detail": str(exc)})
        except Exception as exc:
            self.send_json(500, {"detail": f"BHK delete API error: {exc}"})

    def do_GET(self) -> None:  # noqa: N802 - stdlib callback name
        parsed = urlparse(self.path)
        try:
            if parsed.path == "/healthz":
                self.send_json(200, {"ok": True})
                return
            if parsed.path == "/api/plugins/kanban/boards":
                self.send_json(200, board_list())
                return
            if parsed.path == "/api/plugins/kanban/board":
                qs = parse_qs(parsed.query)
                slug = (qs.get("board") or [None])[0]
                self.send_json(200, board_payload(slug))
                return
            if parsed.path == "/api/plugins/kanban/profiles":
                self.send_json(200, list_profiles())
                return
            if parsed.path == "/api/plugins/kanban/assignees":
                qs = parse_qs(parsed.query)
                slug = (qs.get("board") or [None])[0]
                self.send_json(200, list_assignees(slug))
                return
            if parsed.path == "/api/plugins/kanban/orchestration":
                self.send_json(200, orchestration_payload())
                return
            if parsed.path == "/api/plugins/kanban/search":
                self.send_json(200, search_tasks(parse_qs(parsed.query), empty_on_unknown_board=True))
                return
            prefix = "/api/plugins/kanban/tasks/"
            if parsed.path.startswith(prefix):
                qs = parse_qs(parsed.query)
                task_path = parsed.path[len(prefix):]
                if task_path.endswith("/logs"):
                    task_id = task_path[:-len("/logs")]
                    result = task_worker_log_payload(
                        task_id,
                        (qs.get("board") or [None])[0],
                        limit_from_query((qs.get("tail_bytes") or [None])[0], default=65536, maximum=524288),
                    )
                else:
                    result = task_detail_payload(task_path, (qs.get("board") or [None])[0])
                status = int(result.pop("_status", 200))
                self.send_json(status, result)
                return
            self.send_json(404, {"detail": "Not found"})
        except subprocess.CalledProcessError as exc:
            self.send_json(502, {"detail": "Hermes Kanban command failed", "output": exc.output[-1000:]})
        except subprocess.TimeoutExpired:
            self.send_json(504, {"detail": "Hermes Kanban command timed out"})
        except Exception as exc:  # defensive boundary for nginx/browser callers
            self.send_json(500, {"detail": f"BHK read-only API error: {exc}"})


def main() -> None:
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"BHK read-only Kanban API listening on http://{HOST}:{PORT}", flush=True)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
