export type TaskStatus =
  | 'triage'
  | 'todo'
  | 'scheduled'
  | 'ready'
  | 'running'
  | 'review'
  | 'blocked'
  | 'done'

export type SelectableTaskStatus = Exclude<TaskStatus, 'running'>

export interface Task {
  id: string
  title: string
  body: string
  status: TaskStatus
  assignee: string
  priority: number
}

export interface TaskComment {
  id: string
  body: string
  author: string
  createdAt?: number
}

export interface TaskEvent {
  id: string
  kind: string
  payload?: unknown
  createdAt?: number
  runId?: number
}

export interface TaskRun {
  id: number
  profile: string
  status: string
  outcome?: string
  summary?: string
  error?: string
  metadata?: unknown
  startedAt?: number
  endedAt?: number
}

export interface TaskLinks {
  parents: string[]
  children: string[]
  dependsOn: string[]
  blocks: string[]
}

export interface TaskDetail {
  task: Task
  comments: TaskComment[]
  events: TaskEvent[]
  links: TaskLinks
  runs: TaskRun[]
  diagnostics: Record<string, unknown>
  workerContext?: string
}

export interface StatusDefinition {
  value: TaskStatus
  label: string
  color: string
  description: string
  selectable: boolean
  dropEnabled: boolean
  readOnly: boolean
}
