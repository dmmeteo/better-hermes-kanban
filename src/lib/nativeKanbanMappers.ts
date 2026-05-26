import { tasks as staticTasks } from '../data/mockTasks'
import { isTaskStatus } from './status'
import type {
  NativeKanbanBoardResponse,
  NativeKanbanBoardSummary,
  NativeKanbanTask,
  NativeKanbanTaskDetailResponse,
  NativeKanbanTaskLogResponse,
} from './nativeKanbanTypes'
import type { Task, TaskComment, TaskDetail, TaskEvent, TaskLinks, TaskRun, TaskStatus } from './types'

export interface BoardSummary {
  slug: string
  name: string
  description?: string
  isCurrent: boolean
  total: number
  counts: Partial<Record<TaskStatus, number>>
}

export interface BoardSnapshot {
  tasks: Task[]
  source: 'native' | 'static'
  board?: string
}

const DEFAULT_BOARD: BoardSummary = {
  slug: 'static',
  name: 'Static snapshot',
  description: 'Local fallback data bundled with the UI.',
  isCurrent: true,
  total: staticTasks.length,
  counts: staticTasks.reduce<Partial<Record<TaskStatus, number>>>((acc, task) => {
    acc[task.status] = (acc[task.status] ?? 0) + 1
    return acc
  }, {}),
}

export function staticBoardSummary(): BoardSummary[] {
  return [DEFAULT_BOARD]
}

export function staticBoardSnapshot(): BoardSnapshot {
  return { tasks: staticTasks, source: 'static', board: DEFAULT_BOARD.slug }
}

export function mapNativeBoards(boards: NativeKanbanBoardSummary[], current?: string | null): BoardSummary[] {
  return boards.map((board) => ({
    slug: board.slug,
    name: board.name || board.slug,
    description: board.description ?? undefined,
    isCurrent: Boolean(board.is_current ?? (current ? board.slug === current : false)),
    total: board.total ?? sumCounts(board.counts),
    counts: mapStatusCounts(board.counts),
  }))
}

export function mapNativeBoard(response: NativeKanbanBoardResponse, board?: string): BoardSnapshot {
  const tasks = response.columns.flatMap((column) => column.tasks.map((task) => mapNativeTask(task, column.name)))
  return { tasks, source: 'native', board }
}

export function mapNativeTaskDetail(response: NativeKanbanTaskDetailResponse): TaskDetail {
  const links = response.links ?? {}
  return {
    task: mapNativeTask(response.task, response.task.status),
    comments: (response.comments ?? []).map(mapNativeComment),
    events: (response.events ?? []).map(mapNativeEvent),
    links: {
      parents: links.parents ?? response.parents ?? [],
      children: links.children ?? response.children ?? [],
      dependsOn: links.depends_on ?? [],
      blocks: links.blocks ?? [],
    },
    runs: (response.runs ?? []).map(mapNativeRun),
    diagnostics: response.diagnostics ?? {},
    workerContext: response.diagnostics?.worker_context ?? response.worker_context ?? undefined,
  }
}

export function mapNativeTaskLog(response: NativeKanbanTaskLogResponse): string {
  if (Array.isArray(response.lines)) return response.lines.join('\n')
  if (Array.isArray(response.log)) return response.log.join('\n')
  return response.log ?? [response.stdout, response.stderr].filter(Boolean).join('\n')
}

function mapNativeTask(task: NativeKanbanTask, fallbackStatus: string): Task {
  return {
    id: task.id,
    title: task.title,
    body: task.body || task.latest_summary || task.result || 'No description yet.',
    status: normalizeStatus(task.status, fallbackStatus),
    assignee: task.assignee || 'unassigned',
    priority: task.priority ?? 0,
  }
}

function mapNativeComment(comment: import('./nativeKanbanTypes').NativeKanbanComment, index: number): TaskComment {
  return {
    id: String(comment.id ?? index),
    body: comment.body || '',
    author: comment.author || comment.profile || 'unknown',
    createdAt: comment.created_at ?? undefined,
  }
}

function mapNativeEvent(event: import('./nativeKanbanTypes').NativeKanbanEvent, index: number): TaskEvent {
  return {
    id: String(event.id ?? index),
    kind: event.kind,
    payload: event.payload,
    createdAt: event.created_at ?? undefined,
    runId: event.run_id ?? undefined,
  }
}

function mapNativeRun(run: import('./nativeKanbanTypes').NativeKanbanRun): TaskRun {
  return {
    id: run.id,
    profile: run.profile || 'unknown',
    status: run.status || 'unknown',
    outcome: run.outcome ?? undefined,
    summary: run.summary ?? undefined,
    error: run.error ?? undefined,
    metadata: run.metadata,
    startedAt: run.started_at ?? undefined,
    endedAt: run.ended_at ?? undefined,
  }
}

export const emptyTaskLinks: TaskLinks = { parents: [], children: [], dependsOn: [], blocks: [] }

function normalizeStatus(status: string, fallbackStatus: string): TaskStatus {
  if (isTaskStatus(status)) return status
  if (isTaskStatus(fallbackStatus)) return fallbackStatus
  return 'todo'
}

function mapStatusCounts(counts?: Record<string, number>): Partial<Record<TaskStatus, number>> {
  if (!counts) return {}
  return Object.fromEntries(Object.entries(counts).filter(([status]) => isTaskStatus(status))) as Partial<Record<TaskStatus, number>>
}

function sumCounts(counts?: Record<string, number>): number {
  if (!counts) return 0
  return Object.values(counts).reduce((sum, value) => sum + value, 0)
}
