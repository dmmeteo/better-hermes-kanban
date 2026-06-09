import type { Board, LinkedTask, Priority, Task, TaskActivity, TaskRun, TaskStatus, TaskWorkerLog } from './types';
import { NATIVE_STATUS_ORDER } from './types';

// Real statuses a task may carry. `archived` is a UI-only column, not a status,
// so it is intentionally excluded here.
const ALL_STATUSES: TaskStatus[] = [...NATIVE_STATUS_ORDER];

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => asString(item)).filter(Boolean) : [];
}

function toIso(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 10_000_000_000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  return new Date().toISOString();
}

function normalizeStatus(value: unknown): TaskStatus {
  const status = asString(value, 'todo').toLowerCase() as TaskStatus;
  return ALL_STATUSES.includes(status) ? status : 'todo';
}

function normalizePriority(value: unknown): Priority {
  const raw = asString(value, '').toLowerCase();
  if (raw === 'p0' || raw === '0' || raw === '120' || raw === 'critical') return 'p0';
  if (raw === 'p1' || raw === '1' || raw === 'high') return 'p1';
  if (raw === 'p3' || raw === '3' || raw === 'low') return 'p3';
  const numeric = asNumber(value, NaN);
  if (Number.isFinite(numeric)) {
    if (numeric >= 100) return 'p0';
    if (numeric >= 50) return 'p1';
    if (numeric <= 10) return 'p3';
  }
  return 'p2';
}

export function mapNativeBoard(raw: unknown, index = 0): Board {
  const item = isObject(raw) ? raw : {};
  const slug = asString(item.slug ?? item.id ?? item.name, `board-${index + 1}`);
  const counts = isObject(item.counts)
    ? Object.fromEntries(Object.entries(item.counts).map(([key, value]) => [key, asNumber(value)]))
    : undefined;
  return {
    id: slug,
    name: asString(item.name ?? item.title ?? item.slug ?? item.id, slug),
    taskCount: asNumber(item.task_count ?? item.taskCount ?? item.count ?? item.total, counts ? Object.values(counts).reduce((sum, count) => sum + count, 0) : 0),
    isDefault: Boolean(item.is_default ?? item.isDefault ?? item.default ?? item.is_current ?? item.isCurrent ?? index === 0),
    description: asString(item.description, ''),
    icon: asString(item.icon, ''),
    color: asString(item.color, ''),
    archived: Boolean(item.archived),
    counts,
    isCurrent: Boolean(item.is_current ?? item.isCurrent),
  };
}

function normalizeActivity(raw: unknown): TaskActivity[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const event = isObject(item) ? item : {};
    const rawType = asString(event.type ?? event.kind, 'run').replace(/-/g, '_');
    const type = (
      rawType === 'status_change' || rawType === 'assignment' || rawType === 'comment' || rawType === 'run' ||
      rawType === 'block' || rawType === 'reclaim' || rawType === 'specify' || rawType === 'decompose'
    ) ? rawType : 'run';
    return {
      id: asString(event.id ?? event.event_id, `a-${index}`),
      type,
      description: asString(event.description ?? event.kind ?? event.message ?? event.payload, 'Activity'),
      createdAt: toIso(event.created_at ?? event.createdAt ?? event.timestamp),
      metadata: isObject(event.payload) ? event.payload : undefined,
    };
  });
}

function normalizeRuns(raw: unknown): TaskRun[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const run = isObject(item) ? item : {};
    const status = asString(run.status ?? run.outcome, 'started').toLowerCase();
    const ended = run.ended_at ?? run.completedAt;
    return {
      id: asString(run.id ?? run.run_id, `run-${index}`),
      status: status === 'completed' || status === 'done' || status === 'succeeded' || (ended && status !== 'failed' && status !== 'crashed' && status !== 'error') ? 'completed' : status === 'failed' || status === 'crashed' || status === 'error' ? 'failed' : 'started',
      startedAt: toIso(run.started_at ?? run.startedAt),
      completedAt: ended ? toIso(ended) : undefined,
      output: asString(run.summary ?? run.result ?? run.error, ''),
    };
  });
}

function normalizeLinks(raw: unknown): LinkedTask[] {
  if (!isObject(raw)) return [];
  const parents = Array.isArray(raw.parents) ? raw.parents.filter((x): x is string => typeof x === 'string') : [];
  const children = Array.isArray(raw.children) ? raw.children.filter((x): x is string => typeof x === 'string') : [];
  const make = (taskId: string, relation: 'parent' | 'child'): LinkedTask => ({
    id: `link-${relation}-${taskId}`,
    taskId,
    title: taskId,
    status: normalizeStatus(null),
    relation,
    boardId: '',
  });
  return [
    ...parents.map((id) => make(id, 'parent')),
    ...children.map((id) => make(id, 'child')),
  ].filter((link) => link.taskId);
}

function normalizeWorkerLog(raw: unknown, taskId: string, boardId: string): TaskWorkerLog | null {
  if (!isObject(raw)) return null;
  const text = asString(raw.text ?? raw.content ?? raw.tail, '');
  const path = asString(raw.path, '');
  const sizeBytes = asNumber(raw.size_bytes ?? raw.sizeBytes, text.length);
  if (!text && sizeBytes <= 0 && !path) return null;
  return {
    taskId: asString(raw.task_id ?? raw.taskId, taskId),
    boardId: asString(raw.board ?? raw.board_id ?? raw.boardId, boardId),
    text,
    sizeBytes,
    truncated: Boolean(raw.truncated),
    path: path || undefined,
    refreshedAt: toIso(raw.refreshed_at ?? raw.refreshedAt ?? raw.read_at),
  };
}

export function mapNativeTask(raw: unknown, boardId: string): Task {
  const item = isObject(raw) ? raw : {};
  const id = asString(item.id ?? item.task_id ?? item.taskId, `task-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const comments = Array.isArray(item.comments)
    ? item.comments.map((comment, index) => {
        const c = isObject(comment) ? comment : {};
        return {
          id: asString(c.id, `c-${index}`),
          author: asString(c.author ?? c.profile ?? c.created_by, 'user'),
          text: asString(c.text ?? c.body ?? c.message, ''),
          createdAt: toIso(c.created_at ?? c.createdAt),
        };
      })
    : [];
  const diagnostics = Array.isArray(item.diagnostics)
    ? item.diagnostics.map((diag, index) => {
        const d = isObject(diag) ? diag : {};
        return { id: asString(d.id, `d-${index}`), name: asString(d.name ?? d.key, 'diagnostic'), value: asString(d.value ?? d.message ?? d.status, '') };
      })
    : [];
  const latestSummary = asString(item.latest_summary ?? item.latestSummary ?? item.summary ?? item.result, '') || null;
  const resolvedBoardId = asString(item.board ?? item.board_id ?? item.boardId, boardId);
  const rawWorkspaceKind = asString(item.workspace_kind ?? item.workspaceKind, '').toLowerCase();
  const workspaceKind: Task['workspaceKind'] =
    rawWorkspaceKind === 'scratch' || rawWorkspaceKind === 'dir' || rawWorkspaceKind === 'worktree'
      ? rawWorkspaceKind
      : null;
  const workspacePath = asString(item.workspace_path ?? item.workspacePath, '') || null;
  const createdBy = asString(item.created_by ?? item.createdBy, '') || null;
  const rawSkills = item.skills ?? item.skill_set;
  const skills: string[] | null = Array.isArray(rawSkills)
    ? rawSkills.map((s) => asString(s, '')).filter(Boolean)
    : typeof rawSkills === 'string' && rawSkills.trim()
      ? [rawSkills.trim()]
      : null;
  return {
    id,
    title: asString(item.title, id),
    description: asString(item.body ?? item.description ?? item.summary ?? item.result, ''),
    status: normalizeStatus(item.status),
    priority: normalizePriority(item.priority),
    assignee: asString(item.assignee ?? item.profile ?? item.worker, '') || null,
    boardId: resolvedBoardId,
    parentIds: asStringArray(item.parents ?? item.parent_ids ?? item.parentIds),
    commentCount: asNumber(item.comment_count ?? item.commentCount, comments.length),
    linkCount: asNumber(item.link_count ?? item.linkCount, asStringArray(item.parents ?? item.parent_ids).length),
    latestSummary,
    summaryUpdatedAt: item.summary_updated_at || item.summaryUpdatedAt ? toIso(item.summary_updated_at ?? item.summaryUpdatedAt) : null,
    diagnostics,
    comments,
    activity: normalizeActivity(item.events ?? item.activity),
    runs: normalizeRuns(item.runs),
    workerLog: normalizeWorkerLog(item.worker_log ?? item.workerLog ?? item.logs, id, resolvedBoardId),
    linkedTasks: normalizeLinks(item.links ?? item.linkedTasks),
    plannedAttachments: [],
    warningCount: asNumber(item.warning_count ?? item.warningCount ?? item.warnings, diagnostics.length),
    workspaceKind,
    workspacePath,
    createdBy,
    skills: skills && skills.length > 0 ? skills : null,
    archived: Boolean(item.archived ?? item.is_archived ?? item.isArchived),
    createdAt: toIso(item.created_at ?? item.createdAt),
    updatedAt: toIso(item.updated_at ?? item.updatedAt ?? item.started_at ?? item.completed_at),
  };
}

export function nativeBoardsFromPayload(payload: unknown): Board[] {
  const rawBoards = Array.isArray(payload)
    ? payload
    : isObject(payload) && Array.isArray(payload.boards)
      ? payload.boards
      : [];
  return rawBoards.map(mapNativeBoard);
}

export function nativeTasksFromBoardPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isObject(payload)) return [];
  if (Array.isArray(payload.tasks)) return payload.tasks;
  if (Array.isArray(payload.cards)) return payload.cards;

  const columns = payload.columns;
  if (Array.isArray(columns)) {
    return columns.flatMap((column) => {
      if (!isObject(column)) return [];
      const status = column.status ?? column.id ?? column.name;
      const cards = Array.isArray(column.tasks) ? column.tasks : Array.isArray(column.cards) ? column.cards : [];
      return cards.map((card) => (isObject(card) ? { ...card, status: card.status ?? status } : card));
    });
  }
  if (isObject(columns)) {
    return Object.entries(columns).flatMap(([status, value]) => {
      const cards = Array.isArray(value) ? value : isObject(value) && Array.isArray(value.tasks) ? value.tasks : [];
      return cards.map((card) => (isObject(card) ? { ...card, status: card.status ?? status } : card));
    });
  }
  return [];
}

export function nativeBoardFromPayload(payload: unknown, fallbackBoardId?: string): Board {
  if (isObject(payload) && isObject(payload.board)) return mapNativeBoard(payload.board);
  const id = fallbackBoardId || (isObject(payload) ? asString(payload.board_slug ?? payload.board ?? payload.slug, 'current') : 'current');
  return { id, name: id, taskCount: nativeTasksFromBoardPayload(payload).length, isDefault: true };
}
