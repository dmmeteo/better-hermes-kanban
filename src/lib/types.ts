export type TaskStatus =
  | 'triage'
  | 'todo'
  | 'scheduled'
  | 'ready'
  | 'running'
  | 'blocked'
  | 'review'
  | 'done';

export type Priority = 'p0' | 'p1' | 'p2' | 'p3';

export interface BotProfile {
  id: string;
  name: string;
  icon: string;
  source?: 'profile' | 'assignee' | 'mock';
  taskCount?: number;
  runningCount?: number;
}

export interface KanbanOrchestrationSettings {
  orchestratorProfile: string;
  defaultAssignee: string;
  autoDecompose: boolean;
  autoPromoteChildren: boolean;
  resolvedOrchestratorProfile: string;
  resolvedDefaultAssignee: string;
  activeProfile: string;
  advanced: {
    maxInProgress: number | null;
    maxSpawn: number | null;
    dispatchIntervalSeconds: number | null;
    failureLimit: number | null;
    dispatchStaleTimeoutSeconds: number | null;
  };
  explicit: Record<string, boolean>;
}

export interface KanbanOrchestrationUpdate {
  orchestratorProfile?: string;
  defaultAssignee?: string;
  autoDecompose?: boolean;
  autoPromoteChildren?: boolean;
}

export interface TaskComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface TaskActivity {
  id: string;
  type: 'status_change' | 'assignment' | 'comment' | 'run' | 'block' | 'reclaim' | 'specify' | 'decompose';
  description: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface TaskRun {
  id: string;
  status: 'started' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  output?: string;
}

export interface TaskWorkerLog {
  taskId: string;
  boardId: string;
  text: string;
  sizeBytes: number;
  truncated: boolean;
  path?: string;
  refreshedAt: string;
}

export interface TaskDiagnostic {
  id: string;
  name: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}

export interface LinkedTask {
  id: string;
  taskId: string;
  title: string;
  status: TaskStatus;
  relation: 'parent' | 'child';
  boardId?: string;
}

export interface PlannedAttachment {
  id: string;
  filename: string;
  size: string;
  type: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assignee: string | null;
  boardId: string;
  parentIds: string[];
  commentCount: number;
  linkCount: number;
  latestSummary: string | null;
  summaryUpdatedAt: string | null;
  diagnostics: TaskDiagnostic[];
  comments: TaskComment[];
  activity: TaskActivity[];
  runs: TaskRun[];
  workerLog: TaskWorkerLog | null;
  linkedTasks: LinkedTask[];
  plannedAttachments: PlannedAttachment[];
  warningCount: number;
  workspaceKind?: 'scratch' | 'dir' | 'worktree' | null;
  workspacePath?: string | null;
  createdBy?: string | null;
  skills?: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  id: string;
  name: string;
  taskCount: number;
  isDefault: boolean;
  description?: string;
  icon?: string;
  color?: string;
  archived?: boolean;
  counts?: Record<string, number>;
  isCurrent?: boolean;
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  priority?: Priority;
  assignee?: string | null;
  status?: TaskStatus;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  priority: Priority;
  assignee?: string | null;
  status: TaskStatus;
  parentIds?: string[];
  skills?: string[];
  workspaceKind?: 'scratch' | 'dir' | 'worktree';
  workspacePath?: string;
}

export interface TaskSearchParams {
  q?: string;
  board?: string;
  status?: TaskStatus | string;
  assignee?: string;
  priority?: Priority | string;
  hasWarnings?: boolean;
  hasLinks?: boolean;
  limit?: number;
  cursor?: string;
  offset?: number;
  sort?: 'relevance' | 'updated' | 'newest' | 'priority';
}

export interface TaskSearchResult {
  id: string;
  title: string;
  body: string;
  snippet: string;
  matchField: 'id' | 'title' | 'body' | 'summary' | 'comment' | 'metadata';
  exact: boolean;
  status: TaskStatus;
  priority: Priority;
  assignee: string | null;
  boardId: string;
  boardName: string;
  commentCount: number;
  linkCount: number;
  warningCount: number;
  latestSummary: string | null;
  createdAt: string;
  updatedAt: string;
  source: string;
  indexedAt: string;
  task?: Task;
}

export interface TaskSearchResponse {
  results: TaskSearchResult[];
  total: number;
  nextCursor: string | null;
  source: string;
  indexedAt: string;
}

export const STATUS_ORDER: TaskStatus[] = [
  'triage',
  'todo',
  'scheduled',
  'ready',
  'running',
  'blocked',
  'review',
  'done',
];

// Subset of statuses the kanban API accepts in PATCH/POST payloads.
// `review` is UI-only; the backend does not understand it.
export const NATIVE_STATUS_ORDER: TaskStatus[] = [
  'triage',
  'todo',
  'scheduled',
  'ready',
  'running',
  'blocked',
  'done',
];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  triage: 'Triage',
  todo: 'Todo',
  scheduled: 'Scheduled',
  ready: 'Ready',
  running: 'Running',
  blocked: 'Blocked',
  review: 'Review',
  done: 'Done',
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  triage: '#6B7280',
  todo: '#3B82F6',
  scheduled: '#8B5CF6',
  ready: '#10B981',
  running: '#0EA5E9',
  blocked: '#EF4444',
  review: '#F59E0B',
  done: '#22C55E',
};

export const STATUS_DESCRIPTIONS: Record<TaskStatus, string> = {
  triage: 'Needs grooming before execution.',
  todo: 'Concrete work that is not ready to dispatch yet.',
  scheduled: 'Parked for later; hidden from near-term execution.',
  ready: 'All prerequisites are met and the dispatcher can claim it.',
  running: 'Dispatcher-owned active worker claim; visible but read-only.',
  blocked: 'Needs human input or an external unblock before continuing.',
  review: 'Implementation is waiting for review before it can be marked done.',
  done: 'Terminal completed work.',
};

export type StatusRule = {
  selectable: boolean;
  createSelectable: boolean;
  dropEnabled: boolean;
  readOnly: boolean;
};

export const STATUS_RULES: Record<TaskStatus, StatusRule> = {
  triage: { selectable: true, createSelectable: true, dropEnabled: true, readOnly: false },
  todo: { selectable: true, createSelectable: true, dropEnabled: true, readOnly: false },
  scheduled: { selectable: true, createSelectable: true, dropEnabled: true, readOnly: false },
  ready: { selectable: true, createSelectable: true, dropEnabled: true, readOnly: false },
  running: { selectable: false, createSelectable: false, dropEnabled: false, readOnly: true },
  blocked: { selectable: true, createSelectable: true, dropEnabled: true, readOnly: false },
  review: { selectable: true, createSelectable: false, dropEnabled: true, readOnly: false },
  done: { selectable: true, createSelectable: false, dropEnabled: true, readOnly: false },
};

export const SELECTABLE_TASK_STATUSES = STATUS_ORDER.filter((status) => STATUS_RULES[status].selectable);
export const CREATE_TASK_STATUSES = STATUS_ORDER.filter((status) => STATUS_RULES[status].createSelectable);
export const DROPPABLE_TASK_STATUSES = STATUS_ORDER.filter((status) => STATUS_RULES[status].dropEnabled);

export function isStatusSelectable(status: TaskStatus): boolean {
  return STATUS_RULES[status].selectable;
}

export function isStatusCreateSelectable(status: TaskStatus): boolean {
  return STATUS_RULES[status].createSelectable;
}

export function isStatusDropEnabled(status: TaskStatus): boolean {
  return STATUS_RULES[status].dropEnabled;
}

export function isStatusReadOnly(status: TaskStatus): boolean {
  return STATUS_RULES[status].readOnly;
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  p0: 'P0 - Critical',
  p1: 'P1 - High',
  p2: 'P2 - Medium',
  p3: 'P3 - Low',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  p0: '#DC2626',
  p1: '#EA580C',
  p2: '#2563EB',
  p3: '#6B7280',
};

export const BOT_PROFILES: BotProfile[] = [
  { id: 'log-analyzer', name: 'log-analyzer', icon: 'bot' },
  { id: 'web-agent', name: 'web-agent', icon: 'bot' },
  { id: 'code-agent', name: 'code-agent', icon: 'bot' },
  { id: 'deployer', name: 'deployer', icon: 'bot' },
  { id: 'report-bot', name: 'report-bot', icon: 'bot' },
  { id: 'crm-sync', name: 'crm-sync', icon: 'bot' },
  { id: 'dba-agent', name: 'dba-agent', icon: 'bot' },
  { id: 'security-bot', name: 'security-bot', icon: 'bot' },
];
