#!/usr/bin/env python3
"""Better Hermes Kanban API bridge.

Serves the subset of /api/plugins/kanban used by the standalone BHK SPA
without depending on the ephemeral Hermes dashboard session token.

Endpoints:
- GET /healthz
- GET /api/plugins/kanban/boards
- GET /api/plugins/kanban/board?board=<slug>
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

HOST = "172.17.0.1"
PORT = 9120
HERMES = "/home/me/.hermes/hermes-agent/venv/bin/hermes"
ALLOWED_UPDATE_FIELDS = {"status", "assignee", "priority", "title", "body"}
ALLOWED_STATUSES = {"triage", "todo", "scheduled", "ready", "blocked", "done"}
BOARD_UPDATE_FIELDS = {"name", "description", "icon", "color", "default_workdir"}
BOARD_SEGMENT_RE = re.compile(r"^/api/plugins/kanban/boards/([^/]+)(?:/(switch))?$")


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
            self.send_json(404, {"detail": "Not found"})
        except json.JSONDecodeError:
            self.send_json(400, {"detail": "Invalid JSON body"})
        except ValueError as exc:
            self.send_json(400, {"detail": str(exc)})
        except Exception as exc:
            self.send_json(500, {"detail": f"BHK update API error: {exc}"})

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
