import type { Task } from '../lib/types'

export const tasks: Task[] = [
  {
    id: 't_046628d2',
    title: 'Normalize Better Hermes Kanban status model',
    body: 'Add review to the native status model and make running visible but read-only.',
    status: 'running',
    assignee: 'developer',
    priority: 90,
  },
  {
    id: 't_review001',
    title: 'Check mobile review handoff',
    body: 'Review column appears in desktop board and mobile tabs.',
    status: 'review',
    assignee: 'reviewer',
    priority: 75,
  },
  {
    id: 't_ready001',
    title: 'Wire native board client',
    body: 'Use /api/plugins/kanban after status normalization lands.',
    status: 'ready',
    assignee: 'developer',
    priority: 70,
  },
  {
    id: 't_blocked1',
    title: 'Confirm guarded mutation copy',
    body: 'Needs a UX choice before enabling destructive actions.',
    status: 'blocked',
    assignee: 'designer',
    priority: 50,
  },
]
