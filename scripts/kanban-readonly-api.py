#!/usr/bin/env python3
"""Read-only Better Hermes Kanban API bridge.

Serves the subset of /api/plugins/kanban used by the standalone BHK SPA
without depending on the ephemeral Hermes dashboard session token.

Endpoints:
- GET /healthz
- GET /api/plugins/kanban/boards
- GET /api/plugins/kanban/board?board=<slug>

The data source is the Hermes Kanban CLI/SQLite board layer. This is a
local-only bridge intended to be reverse-proxied by nginx from the BHK static
container. It deliberately implements no mutations.
"""
from __future__ import annotations

import json
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

HOST = "172.17.0.1"
PORT = 9120
HERMES = "/home/me/.hermes/hermes-agent/venv/bin/hermes"


def run_json(args: list[str]) -> object:
    out = subprocess.check_output(args, text=True, stderr=subprocess.STDOUT, timeout=20)
    return json.loads(out)


def board_list() -> dict:
    boards = run_json([HERMES, "kanban", "boards", "list", "--json"])
    return {"boards": boards}


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
