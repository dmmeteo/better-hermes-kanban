import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Task } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isReadyDisabled(task: Task, allTasks: Task[]): boolean {
  if (task.parentIds.length === 0) return false;
  return task.parentIds.some((parentId) => {
    const parent = allTasks.find((t) => t.id === parentId);
    return !parent || parent.status !== 'done';
  });
}

export function getUnfinishedParents(task: Task, allTasks: Task[]): Task[] {
  return task.parentIds
    .map((pid) => allTasks.find((t) => t.id === pid))
    .filter((p): p is Task => !!p && p.status !== 'done');
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
