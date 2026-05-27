export type NativeKanbanStatus =
  | 'triage'
  | 'todo'
  | 'scheduled'
  | 'ready'
  | 'running'
  | 'blocked'
  | 'done';

export interface NativeKanbanBoardDto {
  id?: string;
  slug?: string;
  name?: string;
  title?: string;
  task_count?: number;
  taskCount?: number;
  count?: number;
  total?: number;
  counts?: Record<string, number>;
  is_default?: boolean;
  isDefault?: boolean;
  default?: boolean;
  is_current?: boolean;
  isCurrent?: boolean;
  description?: string;
  icon?: string;
  color?: string;
  archived?: boolean;
}

export interface NativeKanbanTaskDto {
  id?: string;
  task_id?: string;
  taskId?: string;
  title?: string;
  body?: string;
  description?: string;
  summary?: string;
  result?: string;
  status?: NativeKanbanStatus | string;
  priority?: number | string;
  assignee?: string | null;
  profile?: string;
  worker?: string;
  board?: string;
  board_id?: string;
  boardId?: string;
  parents?: string[];
  parent_ids?: string[];
  parentIds?: string[];
  comment_count?: number;
  commentCount?: number;
  link_count?: number;
  linkCount?: number;
  latest_summary?: string | null;
  latestSummary?: string | null;
  summary_updated_at?: string | number | null;
  summaryUpdatedAt?: string | number | null;
  warning_count?: number;
  warningCount?: number;
  warnings?: number;
  created_at?: string | number;
  createdAt?: string | number;
  updated_at?: string | number;
  updatedAt?: string | number;
  started_at?: string | number;
  completed_at?: string | number;
  comments?: unknown[];
  diagnostics?: unknown[];
  events?: unknown[];
  activity?: unknown[];
  runs?: unknown[];
  worker_log?: unknown;
  workerLog?: unknown;
  logs?: unknown;
  links?: unknown[];
  linkedTasks?: unknown[];
}

export interface NativeKanbanColumnDto {
  id?: string;
  name?: string;
  status?: string;
  tasks?: NativeKanbanTaskDto[];
  cards?: NativeKanbanTaskDto[];
}

export interface NativeKanbanBoardsResponseDto {
  boards?: NativeKanbanBoardDto[];
}

export interface NativeKanbanBoardResponseDto {
  board?: string | NativeKanbanBoardDto;
  board_slug?: string;
  slug?: string;
  tasks?: NativeKanbanTaskDto[];
  cards?: NativeKanbanTaskDto[];
  columns?: NativeKanbanColumnDto[] | Record<string, NativeKanbanTaskDto[] | { tasks?: NativeKanbanTaskDto[]; cards?: NativeKanbanTaskDto[] }>;
}
