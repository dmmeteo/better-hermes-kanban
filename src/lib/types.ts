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
  linkedTasks: LinkedTask[];
  plannedAttachments: PlannedAttachment[];
  warningCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  id: string;
  name: string;
  taskCount: number;
  isDefault: boolean;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  priority: Priority;
  assignee?: string | null;
  status: TaskStatus;
  parentIds?: string[];
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
