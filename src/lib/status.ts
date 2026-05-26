import type { SelectableTaskStatus, StatusDefinition, TaskStatus } from './types'

export const STATUS_DEFINITIONS: Record<TaskStatus, StatusDefinition> = {
  triage: {
    value: 'triage',
    label: 'Triage',
    color: '#a78bfa',
    description: 'Needs clarification before it can enter the queue.',
    selectable: true,
    dropEnabled: true,
    readOnly: false,
  },
  todo: {
    value: 'todo',
    label: 'Todo',
    color: '#60a5fa',
    description: 'Accepted backlog item, not ready to dispatch yet.',
    selectable: true,
    dropEnabled: true,
    readOnly: false,
  },
  scheduled: {
    value: 'scheduled',
    label: 'Scheduled',
    color: '#38bdf8',
    description: 'Waiting for a future schedule.',
    selectable: true,
    dropEnabled: true,
    readOnly: false,
  },
  ready: {
    value: 'ready',
    label: 'Ready',
    color: '#34d399',
    description: 'Ready for a worker to claim.',
    selectable: true,
    dropEnabled: true,
    readOnly: false,
  },
  running: {
    value: 'running',
    label: 'Running',
    color: '#f59e0b',
    description: 'Claimed by a worker. Visible for monitoring only; dispatch owns this state.',
    selectable: false,
    dropEnabled: false,
    readOnly: true,
  },
  review: {
    value: 'review',
    label: 'Review',
    color: '#fb7185',
    description: 'Work is done enough for human review before completion.',
    selectable: true,
    dropEnabled: true,
    readOnly: false,
  },
  blocked: {
    value: 'blocked',
    label: 'Blocked',
    color: '#ef4444',
    description: 'Waiting on a human decision, credential, or external dependency.',
    selectable: true,
    dropEnabled: true,
    readOnly: false,
  },
  done: {
    value: 'done',
    label: 'Done',
    color: '#94a3b8',
    description: 'Terminal completed state.',
    selectable: true,
    dropEnabled: true,
    readOnly: false,
  },
}

export const TASK_STATUS_ORDER = [
  'triage',
  'todo',
  'scheduled',
  'ready',
  'running',
  'review',
  'blocked',
  'done',
] as const satisfies readonly TaskStatus[]

export function isTaskStatus(value: string): value is TaskStatus {
  return TASK_STATUS_ORDER.some((status) => status === value)
}

export const SELECTABLE_TASK_STATUSES = TASK_STATUS_ORDER.filter(
  (status): status is SelectableTaskStatus => STATUS_DEFINITIONS[status].selectable,
)

export const BOARD_DROP_STATUSES = TASK_STATUS_ORDER.filter(
  (status) => STATUS_DEFINITIONS[status].dropEnabled,
)

export function canSelectStatus(status: TaskStatus): status is SelectableTaskStatus {
  return STATUS_DEFINITIONS[status].selectable
}

export function canDropIntoStatus(status: TaskStatus): boolean {
  return STATUS_DEFINITIONS[status].dropEnabled
}

export function statusTransitionReason(status: TaskStatus): string | undefined {
  if (status === 'running') {
    return 'Running is dispatcher-owned and cannot be selected or used as a drop target.'
  }

  return undefined
}
