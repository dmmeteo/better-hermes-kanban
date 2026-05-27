import type { Task } from './types';

const HUMAN_WAITING_PATTERNS = [
  'waiting for user',
  'waiting on user',
  'needs confirmation',
  'need confirmation',
  'awaiting confirmation',
  'awaiting decision',
  'needs decision',
  'need decision',
  'please choose',
  'please confirm',
  'waiting: decision',
  'waiting: confirmation',
];

function includesHumanWaitingText(task: Task): boolean {
  const text = [
    task.title,
    task.description,
    task.latestSummary,
    task.waitingReason,
    task.lastQuestion?.text,
    ...task.comments.map((comment) => comment.text),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return HUMAN_WAITING_PATTERNS.some((pattern) => text.includes(pattern));
}

export function needsHumanAttention(task: Task): boolean {
  if (task.waitingOn === 'user' || task.needsHumanInput) return true;
  if (task.waitingOn === 'agent' || task.waitingOn === 'external') return false;

  return task.status === 'blocked' && includesHumanWaitingText(task);
}

export function getNeedsMeTasks(tasks: Task[]): Task[] {
  return tasks
    .filter(needsHumanAttention)
    .sort((a, b) => {
      const priorityScore = { p0: 0, p1: 1, p2: 2, p3: 3 } as const;
      const priorityDelta = priorityScore[a.priority] - priorityScore[b.priority];
      if (priorityDelta !== 0) return priorityDelta;
      return new Date(b.waitingSince || b.updatedAt).getTime() - new Date(a.waitingSince || a.updatedAt).getTime();
    });
}

export function getWaitingReason(task: Task): string {
  if (task.waitingReason) return task.waitingReason;
  if (task.lastQuestion?.text) return task.lastQuestion.text;
  if (task.status === 'blocked') return 'Waiting for your answer';
  return 'Needs your input';
}
