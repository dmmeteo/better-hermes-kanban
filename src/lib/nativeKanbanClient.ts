import {
  mapNativeBoard,
  mapNativeBoards,
  mapNativeTaskDetail,
  mapNativeTaskLog,
  staticBoardSnapshot,
  staticBoardSummary,
} from './nativeKanbanMappers'
import type { BoardSnapshot, BoardSummary } from './nativeKanbanMappers'
import type { NativeKanbanBoardResponse, NativeKanbanBoardsResponse, NativeKanbanTaskDetailResponse, NativeKanbanTaskLogResponse } from './nativeKanbanTypes'
import type { TaskDetail } from './types'

const NATIVE_KANBAN_API_BASE = '/api/plugins/kanban'

export async function getBoards(): Promise<BoardSummary[]> {
  try {
    const response = await getJson<NativeKanbanBoardsResponse>('/boards')
    return mapNativeBoards(response.boards, response.current)
  } catch (error) {
    console.warn('Falling back to static kanban boards snapshot', error)
    return staticBoardSummary()
  }
}

export async function getBoard(board?: string): Promise<BoardSnapshot> {
  try {
    const search = new URLSearchParams()
    if (board) search.set('board', board)
    const path = `/board${search.size ? `?${search.toString()}` : ''}`
    const response = await getJson<NativeKanbanBoardResponse>(path)
    return mapNativeBoard(response, board)
  } catch (error) {
    console.warn('Falling back to static kanban board snapshot', error)
    return staticBoardSnapshot()
  }
}

export async function getTaskDetail(taskId: string): Promise<TaskDetail> {
  const response = await getJson<NativeKanbanTaskDetailResponse>(`/tasks/${encodeURIComponent(taskId)}`)
  return mapNativeTaskDetail(response)
}

export async function getTaskLog(taskId: string): Promise<string> {
  const response = await getJson<NativeKanbanTaskLogResponse>(`/tasks/${encodeURIComponent(taskId)}/log`)
  return mapNativeTaskLog(response)
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${NATIVE_KANBAN_API_BASE}${path}`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Kanban API ${response.status}: ${response.statusText}`)
  }

  return (await response.json()) as T
}
