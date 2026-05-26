export interface NativeKanbanBoardSummary {
  slug: string
  name?: string | null
  description?: string | null
  icon?: string | null
  color?: string | null
  archived?: boolean
  created_at?: number | null
  updated_at?: number | null
  is_current?: boolean
  counts?: Record<string, number>
  total?: number
}

export interface NativeKanbanBoardsResponse {
  boards: NativeKanbanBoardSummary[]
  current?: string | null
}

export interface NativeKanbanTask {
  id: string
  title: string
  body?: string | null
  status: string
  assignee?: string | null
  priority?: number | null
  tenant?: string | null
  created_at?: number | null
  started_at?: number | null
  completed_at?: number | null
  result?: string | null
  current_run_id?: number | null
  latest_summary?: string | null
  link_counts?: {
    parents: number
    children: number
  }
  comment_count?: number
  progress?: {
    done: number
    total: number
  } | null
}

export interface NativeKanbanColumn {
  name: string
  tasks: NativeKanbanTask[]
}

export interface NativeKanbanBoardResponse {
  columns: NativeKanbanColumn[]
  tenants?: string[]
  assignees?: string[]
  latest_event_id?: number
  now?: number
}

export interface NativeKanbanComment {
  id?: number | string
  body?: string | null
  author?: string | null
  profile?: string | null
  created_at?: number | null
}

export interface NativeKanbanEvent {
  id?: number | string
  kind: string
  payload?: unknown
  created_at?: number | null
  run_id?: number | null
}

export interface NativeKanbanRun {
  id: number
  profile?: string | null
  status?: string | null
  outcome?: string | null
  summary?: string | null
  error?: string | null
  metadata?: unknown
  started_at?: number | null
  ended_at?: number | null
}

export interface NativeKanbanLinks {
  parents?: string[]
  children?: string[]
  depends_on?: string[]
  blocks?: string[]
}

export interface NativeKanbanDiagnostics {
  worker_context?: string | null
  [key: string]: unknown
}

export interface NativeKanbanTaskDetailResponse {
  task: NativeKanbanTask
  comments?: NativeKanbanComment[]
  events?: NativeKanbanEvent[]
  links?: NativeKanbanLinks
  parents?: string[]
  children?: string[]
  runs?: NativeKanbanRun[]
  diagnostics?: NativeKanbanDiagnostics | null
  worker_context?: string | null
}

export interface NativeKanbanTaskLogResponse {
  task_id?: string
  run_id?: number | null
  log?: string | string[] | null
  lines?: string[]
  stdout?: string | null
  stderr?: string | null
}
