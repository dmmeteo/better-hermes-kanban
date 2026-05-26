import type {
  Task,
  Board,
  BotProfile,
  KanbanOrchestrationSettings,
  KanbanOrchestrationUpdate,
  TaskStatus,
  TaskComment,
  Priority,
  TaskActivity,
  LinkedTask,
  TaskRun,
  UpdateTaskData,
} from './types';
import { mockTasks, boards as mockBoards, BOT_PROFILES } from '@/data/mockTasks';

const API_BASE = '/api/plugins/kanban';
const NATIVE_STATUSES: TaskStatus[] = [
  'triage',
  'todo',
  'scheduled',
  'ready',
  'running',
  'blocked',
  'done',
];
const UI_ONLY_STATUSES: TaskStatus[] = ['review'];
const ALL_STATUSES: TaskStatus[] = [...NATIVE_STATUSES, ...UI_ONLY_STATUSES];

type JsonObject = Record<string, unknown>;

export class KanbanApiError extends Error {
  status?: number;
  fallback?: boolean;

  constructor(message: string, options: { status?: number; fallback?: boolean } = {}) {
    super(message);
    this.name = 'KanbanApiError';
    this.status = options.status;
    this.fallback = options.fallback;
  }
}

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

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = asNumber(value, NaN);
  return Number.isFinite(number) ? number : null;
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

function priorityToNative(priority: Priority): number {
  if (priority === 'p0') return 100;
  if (priority === 'p1') return 90;
  if (priority === 'p3') return 10;
  return 50;
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
  return raw === 'p2' || raw === '2' || raw === 'medium' ? 'p2' : 'p2';
}

function normalizeBoard(raw: unknown, index = 0): Board {
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
    return {
      id: asString(event.id ?? event.event_id, `a-${index}`),
      type: 'run',
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
    const status = asString(run.status ?? run.outcome, 'started');
    return {
      id: asString(run.id ?? run.run_id, `run-${index}`),
      status: status === 'completed' || status === 'done' ? 'completed' : status === 'failed' || status === 'crashed' ? 'failed' : 'started',
      startedAt: toIso(run.started_at ?? run.startedAt),
      completedAt: run.ended_at || run.completedAt ? toIso(run.ended_at ?? run.completedAt) : undefined,
      output: asString(run.summary ?? run.result ?? run.error, ''),
    };
  });
}

function normalizeLinks(raw: unknown): LinkedTask[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index): LinkedTask => {
    const link = isObject(item) ? item : {};
    const status = normalizeStatus(link.status);
    const relation: 'parent' | 'child' = asString(link.relation) === 'child' ? 'child' : 'parent';
    return {
      id: asString(link.id, `link-${index}`),
      taskId: asString(link.task_id ?? link.taskId ?? link.id, ''),
      title: asString(link.title, 'Linked task'),
      status,
      relation,
    };
  }).filter((link) => link.taskId);
}

function normalizeProfile(raw: unknown, index = 0): BotProfile {
  const item = isObject(raw) ? raw : {};
  const name = asString(item.name ?? item.id ?? item.assignee, `profile-${index + 1}`);
  return {
    id: name,
    name,
    icon: asString(item.icon, 'bot'),
    source: asString(item.source, 'profile') as BotProfile['source'],
    taskCount: asNullableNumber(item.task_count ?? item.taskCount) ?? undefined,
    runningCount: asNullableNumber(item.running_count ?? item.runningCount) ?? undefined,
  };
}

function normalizeOrchestration(raw: unknown): KanbanOrchestrationSettings {
  const item = isObject(raw) ? raw : {};
  const advanced = isObject(item.advanced) ? item.advanced : item;
  const explicit = isObject(item.explicit) ? item.explicit : {};
  return {
    orchestratorProfile: asString(item.orchestrator_profile ?? item.orchestratorProfile),
    defaultAssignee: asString(item.default_assignee ?? item.defaultAssignee),
    autoDecompose: Boolean(item.auto_decompose ?? item.autoDecompose ?? true),
    autoPromoteChildren: Boolean(item.auto_promote_children ?? item.autoPromoteChildren ?? true),
    resolvedOrchestratorProfile: asString(item.resolved_orchestrator_profile ?? item.resolvedOrchestratorProfile),
    resolvedDefaultAssignee: asString(item.resolved_default_assignee ?? item.resolvedDefaultAssignee),
    activeProfile: asString(item.active_profile ?? item.activeProfile, 'default'),
    advanced: {
      maxInProgress: asNullableNumber(advanced.max_in_progress ?? advanced.maxInProgress),
      maxSpawn: asNullableNumber(advanced.max_spawn ?? advanced.maxSpawn),
      dispatchIntervalSeconds: asNullableNumber(advanced.dispatch_interval_seconds ?? advanced.dispatchIntervalSeconds),
      failureLimit: asNullableNumber(advanced.failure_limit ?? advanced.failureLimit),
      dispatchStaleTimeoutSeconds: asNullableNumber(advanced.dispatch_stale_timeout_seconds ?? advanced.dispatchStaleTimeoutSeconds),
    },
    explicit: Object.fromEntries(Object.entries(explicit).map(([key, value]) => [key, Boolean(value)])),
  };
}

function normalizeTask(raw: unknown, boardId: string): Task {
  const item = isObject(raw) ? raw : {};
  const id = asString(item.id ?? item.task_id ?? item.taskId, `task-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const body = asString(item.body ?? item.description ?? item.summary ?? item.result, '');
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
        return {
          id: asString(d.id, `d-${index}`),
          name: asString(d.name ?? d.key, 'diagnostic'),
          value: asString(d.value ?? d.message ?? d.status, ''),
        };
      })
    : [];

  const latestSummary = asString(
    item.latest_summary ?? item.latestSummary ?? item.summary ?? item.result,
    ''
  ) || null;

  return {
    id,
    title: asString(item.title, id),
    description: body,
    status: normalizeStatus(item.status),
    priority: normalizePriority(item.priority),
    assignee: asString(item.assignee ?? item.profile ?? item.worker, '') || null,
    boardId: asString(item.board ?? item.board_id ?? item.boardId, boardId),
    parentIds: asStringArray(item.parents ?? item.parent_ids ?? item.parentIds),
    commentCount: asNumber(item.comment_count ?? item.commentCount, comments.length),
    linkCount: asNumber(item.link_count ?? item.linkCount, asStringArray(item.parents ?? item.parent_ids).length),
    latestSummary,
    summaryUpdatedAt: item.summary_updated_at || item.summaryUpdatedAt ? toIso(item.summary_updated_at ?? item.summaryUpdatedAt) : null,
    diagnostics,
    comments,
    activity: normalizeActivity(item.events ?? item.activity),
    runs: normalizeRuns(item.runs),
    linkedTasks: normalizeLinks(item.links ?? item.linkedTasks),
    plannedAttachments: [],
    warningCount: asNumber(item.warning_count ?? item.warningCount ?? item.warnings, diagnostics.length),
    createdAt: toIso(item.created_at ?? item.createdAt),
    updatedAt: toIso(item.updated_at ?? item.updatedAt ?? item.started_at ?? item.completed_at),
  };
}

function flattenTasksFromBoard(payload: unknown): unknown[] {
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

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (isObject(body)) message = asString(body.detail ?? body.error ?? body.message, message);
    } catch {
      // leave status text as message
    }
    throw new KanbanApiError(message, { status: response.status });
  }

  return response.json() as Promise<T>;
}

function boardFromPayload(payload: unknown, fallbackBoardId?: string): Board {
  if (isObject(payload) && isObject(payload.board)) return normalizeBoard(payload.board);
  const id = fallbackBoardId || (isObject(payload) ? asString(payload.board_slug ?? payload.board ?? payload.slug, 'current') : 'current');
  return { id, name: id, taskCount: flattenTasksFromBoard(payload).length, isDefault: true };
}

export const kanbanApi = {
  async getBoard(boardId?: string): Promise<{ tasks: Task[]; board: Board; source: 'live' | 'fallback' }> {
    const query = boardId ? `?board=${encodeURIComponent(boardId)}` : '';
    try {
      const payload = await requestJson<unknown>(`/board${query}`);
      const board = boardFromPayload(payload, boardId);
      const tasks = flattenTasksFromBoard(payload).map((task) => normalizeTask(task, board.id));
      return { tasks, board: { ...board, taskCount: tasks.length }, source: 'live' };
    } catch (error) {
      const board = mockBoards.find((b) => b.id === boardId) || mockBoards[0];
      const tasks = mockTasks.filter((task) => task.boardId === board.id);
      const message = error instanceof Error ? error.message : 'Failed to load live Kanban API';
      const fallbackError = new KanbanApiError(`${message}; showing offline demo data`, {
        status: error instanceof KanbanApiError ? error.status : undefined,
        fallback: true,
      });
      console.warn(fallbackError.message);
      return { tasks, board, source: 'fallback' };
    }
  },

  async getBoards(): Promise<{ boards: Board[]; source: 'live' | 'fallback' }> {
    try {
      const payload = await requestJson<unknown>('/boards');
      const rawBoards = Array.isArray(payload)
        ? payload
        : isObject(payload) && Array.isArray(payload.boards)
          ? payload.boards
          : [];
      const boards = rawBoards.map(normalizeBoard);
      return { boards, source: 'live' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load live boards';
      console.warn(`${message}; showing offline demo boards`);
      return { boards: [...mockBoards], source: 'fallback' };
    }
  },

  async getTask(taskId: string): Promise<Task | null> {
    const payload = await requestJson<unknown>(`/tasks/${encodeURIComponent(taskId)}`);
    const rawTask = isObject(payload) && payload.task ? payload.task : payload;
    return normalizeTask(rawTask, 'current');
  },

  async createBoard(input: { slug: string; name?: string; description?: string; icon?: string; color?: string; defaultWorkdir?: string }): Promise<Board> {
    const response = await requestJson<unknown>('/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: input.slug,
        name: input.name,
        description: input.description,
        icon: input.icon,
        color: input.color,
        default_workdir: input.defaultWorkdir,
      }),
    });
    return normalizeBoard(isObject(response) && response.board ? response.board : response);
  },

  async updateBoard(boardId: string, input: { name?: string; description?: string; icon?: string; color?: string; defaultWorkdir?: string }): Promise<Board> {
    const response = await requestJson<unknown>(`/boards/${encodeURIComponent(boardId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        icon: input.icon,
        color: input.color,
        default_workdir: input.defaultWorkdir,
      }),
    });
    return normalizeBoard(isObject(response) && response.board ? response.board : response);
  },

  async deleteBoard(boardId: string, options: { hardDelete?: boolean } = {}): Promise<void> {
    const query = options.hardDelete ? '?delete=true' : '';
    await requestJson<unknown>(`/boards/${encodeURIComponent(boardId)}${query}`, { method: 'DELETE' });
  },

  async switchBoard(boardId: string, options: { persist?: boolean } = {}): Promise<Board> {
    const response = await requestJson<unknown>(`/boards/${encodeURIComponent(boardId)}/switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persist: options.persist ?? true }),
    });
    return normalizeBoard(isObject(response) && response.board ? response.board : response, 0);
  },

  async createTask(): Promise<Task> {
    throw new KanbanApiError('Read-only mode: task creation is disabled in this MVP');
  },

  async updateTask(taskId: string, data: UpdateTaskData, boardId?: string): Promise<Task> {
    const query = boardId ? `?board=${encodeURIComponent(boardId)}` : '';
    const payload: Record<string, unknown> = {};
    if (data.status !== undefined) payload.status = data.status;
    if (data.assignee !== undefined) payload.assignee = data.assignee || '';
    if (data.priority !== undefined) payload.priority = priorityToNative(data.priority);
    if (data.title !== undefined) payload.title = data.title;
    if (data.description !== undefined) payload.body = data.description;

    const response = await requestJson<unknown>(`/tasks/${encodeURIComponent(taskId)}${query}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const rawTask = isObject(response) && response.task ? response.task : response;
    return normalizeTask(rawTask, boardId || 'current');
  },

  async deleteTask(): Promise<void> {
    throw new KanbanApiError('Read-only mode: task deletion is disabled in this MVP');
  },

  async addComment(): Promise<TaskComment> {
    throw new KanbanApiError('Read-only mode: comments are disabled in this MVP');
  },

  async blockTask(): Promise<Task> {
    throw new KanbanApiError('Read-only mode: task actions are disabled in this MVP');
  },

  async reclaimTask(): Promise<Task> {
    throw new KanbanApiError('Read-only mode: task actions are disabled in this MVP');
  },

  async specifyTask(): Promise<Task> {
    throw new KanbanApiError('Read-only mode: task actions are disabled in this MVP');
  },

  async decomposeTask(): Promise<Task[]> {
    throw new KanbanApiError('Read-only mode: task actions are disabled in this MVP');
  },

  async getProfiles(): Promise<BotProfile[]> {
    try {
      const payload = await requestJson<unknown>('/profiles');
      const rawProfiles = Array.isArray(payload)
        ? payload
        : isObject(payload) && Array.isArray(payload.profiles)
          ? payload.profiles
          : [];
      const profiles = rawProfiles.map(normalizeProfile);
      return profiles.length ? profiles : [...BOT_PROFILES];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load profiles';
      console.warn(`${message}; showing offline demo profiles`);
      return [...BOT_PROFILES];
    }
  },

  async getAssignees(): Promise<BotProfile[]> {
    try {
      const payload = await requestJson<unknown>('/assignees');
      const rawAssignees = Array.isArray(payload)
        ? payload
        : isObject(payload) && Array.isArray(payload.assignees)
          ? payload.assignees
          : [];
      return rawAssignees.map((assignee, index) => ({ ...normalizeProfile(assignee, index), source: 'assignee' }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load assignees';
      console.warn(`${message}; showing profile list only`);
      return [];
    }
  },

  async getOrchestration(): Promise<KanbanOrchestrationSettings> {
    const payload = await requestJson<unknown>('/orchestration');
    return normalizeOrchestration(payload);
  },

  async updateOrchestration(input: KanbanOrchestrationUpdate): Promise<KanbanOrchestrationSettings> {
    const response = await requestJson<unknown>('/orchestration', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orchestrator_profile: input.orchestratorProfile,
        default_assignee: input.defaultAssignee,
        auto_decompose: input.autoDecompose,
        auto_promote_children: input.autoPromoteChildren,
      }),
    });
    return normalizeOrchestration(response);
  },

  async getDiagnostics(): Promise<{ taskCount: number; statusCounts: Record<string, number> }> {
    const board = await this.getBoard();
    const statusCounts: Record<string, number> = {};
    board.tasks.forEach((task) => {
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
    });
    return { taskCount: board.tasks.length, statusCounts };
  },
};
