# BHK search API contract for DataView tokens

Task: `t_74a91ec0`

This locks the bridge contract that the DataView-style search/filter control can serialize into URL tokens and hydrate back into API requests.

## Endpoint

`GET /api/plugins/kanban/search`

The standalone BHK app calls this endpoint on the BHK origin, proxied to the BHK bridge. It must not call `her.dmmeteo.dev` directly and must not send or depend on `X-Hermes-Session-Token`.

## Query params

| Param | Type | MVP behavior |
| --- | --- | --- |
| `q` | string | Free text across id, title, body, latest run summary, comments, assignee/status/board metadata. Exact `t_[0-9a-f]{8}` becomes an exact task-id lookup. |
| `board` | board slug or empty | Narrows to one board. Omit for cross-board search. `all` is treated as all boards. |
| `status` | one status string | Narrows to one native task status for MVP (`triage`, `todo`, `scheduled`, `ready`, `running`, `blocked`, `done`). Unknown status values currently return zero results if no rows match. |
| `assignee` | profile/assignee id/name | Exact case-insensitive assignee match. Unknown assignees return zero results. |
| `priority` | `P0`/`P1`/`P2`/`P3` or native numeric bucket | Optional priority filter. Current bridge accepts lowercase/uppercase token forms through normalization. |
| `limit` | integer | Page size. Current bridge clamps through `limit_from_query`; UI should send a practical value like `20`. |
| `offset` / `cursor` | integer string | Pagination offset. Response `nextCursor` is the next offset as a string. |
| `sort` | `relevance`, `updated`, `newest`, `priority` | Defaults to `relevance` when `q` is present, otherwise `updated`. |

Existing extra params (`has_warnings`, `has_links`) are supported by the bridge but are not required for the DataView MVP token contract.

## Response shape

```json
{
  "results": [
    {
      "id": "t_74a91ec0",
      "title": "API: lock BHK search query/filter contract for DataView tokens",
      "body": "truncated body preview",
      "snippet": "match-oriented preview",
      "matchField": "id",
      "exact": true,
      "status": "running",
      "priority": 80,
      "assignee": "developer",
      "boardId": "better-hermes-kanban",
      "boardName": "Better Hermes Kanban",
      "commentCount": 0,
      "linkCount": 3,
      "warningCount": 0,
      "latestSummary": null,
      "createdAt": 1779914779,
      "updatedAt": 1779914824,
      "source": "sqlite",
      "indexedAt": 1779914925,
      "task": { "id": "t_74a91ec0", "board": "better-hermes-kanban", "board_id": "better-hermes-kanban" }
    }
  ],
  "total": 1,
  "nextCursor": null,
  "source": "sqlite",
  "indexedAt": 1779914925
}
```

Notes for UI implementers:

- Use `boardId` plus `id` for direct-open URLs, e.g. `/tasks/t_74a91ec0?board=better-hermes-kanban` or the app's equivalent task route state.
- `exact: true` with exactly one result is the fast path for exact task-id navigation.
- `task` is intentionally present for exact-id/direct-open use and includes enough task/detail metadata to render or hydrate the existing task detail flow.
- Normalize priority client-side through existing `normalizePriority`; bridge may return native numeric priorities.
- Treat empty `results` with `total: 0` as a normal empty state, not an error.

## DataView token mapping

Suggested URL/token serialization:

```ts
type SearchTokenState = {
  q?: string;
  board?: string;
  status?: string;
  assignee?: string;
  priority?: 'p0' | 'p1' | 'p2' | 'p3';
  limit?: number;
  sort?: 'relevance' | 'updated' | 'newest' | 'priority';
};
```

Serialize only non-empty values. Multiple `status` or `assignee` tokens are out of scope for MVP; if the control allows multiple visual tokens later, it should either block applying them or fan out in a later API task.

## Smoke examples verified on live bridge

```bash
curl -sS 'http://172.17.0.1:9120/api/plugins/kanban/search?q=t_74a91ec0&limit=1'
# returns one result with exact=true, boardId=better-hermes-kanban, task metadata included

curl -sS 'http://172.17.0.1:9120/api/plugins/kanban/search?board=better-hermes-kanban&status=definitely-not-a-status&limit=2'
# returns {"results": [], "total": 0, "nextCursor": null, "source": "sqlite", ...}

curl -sS 'http://172.17.0.1:9120/api/plugins/kanban/search?board=no-such-board&q=whatever&limit=2'
# returns HTTP 200 with {"results": [], "total": 0, "nextCursor": null, "source": "sqlite", ...}

curl -sS 'http://172.17.0.1:9120/healthz'
# returns {"ok": true}
```

Unknown `board` handling is intentionally search-endpoint-only. Exact task detail lookup (`/api/plugins/kanban/tasks/<id>?board=<slug>`) continues to use the stricter board resolution path.
