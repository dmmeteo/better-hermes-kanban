import { useState, type ReactNode } from 'react';
import { ArrowLeft, ExternalLink, MoreHorizontal, RefreshCcw, X } from 'lucide-react';
import type { Board, Task } from '@/lib/types';
import { kanbanApi } from '@/lib/kanbanApi';
import { BotAvatar } from '@/components/shared/BotAvatar';
import { MarkdownText } from '@/components/shared/MarkdownText';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { cn, timeAgo } from '@/lib/utils';
import { TaskActivity } from './TaskActivity';
import { TaskComments } from './TaskComments';
import { TaskDiagnostics } from './TaskDiagnostics';
import { TaskLinks } from './TaskLinks';
import { TaskRuns } from './TaskRuns';

interface TaskBreadcrumbsProps {
  task: Task;
  activeBoard?: Board;
  onBack?: () => void;
  backLabel?: string;
  newTab?: boolean;
  className?: string;
  idTestId?: string;
}

export function TaskBreadcrumbs({
  task,
  activeBoard,
  onBack,
  backLabel = 'Board',
  newTab = false,
  className,
  idTestId = 'task-detail-id-link',
}: TaskBreadcrumbsProps) {
  const taskHref = `/tasks/${encodeURIComponent(task.id)}`;

  return (
    <div className={cn('flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground', className)}>
      {onBack && (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={onBack}
          data-testid="task-page-back"
        >
          <ArrowLeft size={14} />
          {backLabel}
        </Button>
      )}
      {onBack && <span className="text-border">/</span>}
      <a
        href={taskHref}
        target={newTab ? '_blank' : undefined}
        rel={newTab ? 'noopener noreferrer' : undefined}
        className="rounded bg-secondary/80 px-2 py-0.5 font-mono transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={newTab ? `Open task ${task.id} in a new tab` : `Open task ${task.id}`}
        data-testid={idTestId}
      >
        {task.id}
      </a>
      {activeBoard && <span>on {activeBoard.name || activeBoard.id}</span>}
    </div>
  );
}

interface TaskDetailHeaderProps {
  task: Task;
  activeBoard?: Board;
  onBack?: () => void;
  onClose?: () => void;
  showCloseButton?: boolean;
  showBackButton?: boolean;
  showActionButton?: boolean;
  titleSlot?: ReactNode;
  actionsSlot?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function TaskDetailHeader({
  task,
  activeBoard,
  onBack,
  onClose,
  showCloseButton = false,
  showBackButton = true,
  showActionButton = true,
  titleSlot,
  actionsSlot,
  className,
  compact = false,
}: TaskDetailHeaderProps) {
  return (
    <div className={cn(compact ? 'space-y-3' : 'flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between', className)} data-testid="task-detail-header">
      <div className="min-w-0 flex-1 space-y-3">
        <TaskBreadcrumbs
          task={task}
          activeBoard={activeBoard}
          onBack={showBackButton ? onBack : undefined}
          newTab={!activeBoard}
          idTestId={activeBoard ? 'task-page-id-link' : 'task-detail-id-link'}
        />
        {titleSlot ?? <h1 className={cn('font-bold leading-tight tracking-[-0.02em]', compact ? 'text-lg' : 'max-w-4xl text-2xl md:text-3xl')}>{task.title}</h1>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        {!compact && <BotAvatar name={task.assignee} />}
        {actionsSlot}
        {showActionButton && <TaskActionDropdown />}
        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors hover:bg-accent"
            aria-label="Close task detail"
            data-testid="task-detail-close"
          >
            <X size={16} className="text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}

export function TaskDescriptionMarkdown({ value, editingSlot, emptySlot, className }: { value?: string; editingSlot?: ReactNode; emptySlot?: ReactNode; className?: string }) {
  if (editingSlot) return <>{editingSlot}</>;
  if (!value) return <>{emptySlot ?? null}</>;
  return <MarkdownText value={value} className={cn('text-sm leading-relaxed', className)} />;
}

export function LinkedTasksCompact({ task }: { task: Task }) {
  if (task.linkedTasks.length === 0) return null;
  return (
    <CompactSection title="Linked tasks" count={task.linkedTasks.length} data-testid="task-linked-tasks-compact">
      <TaskLinks linkedTasks={task.linkedTasks} />
    </CompactSection>
  );
}

export function TaskCommentsPanel({ task, onAddComment }: { task: Task; onAddComment: (text: string) => void }) {
  return (
    <section data-testid="task-comments-panel">
      <TaskComments comments={task.comments} onAddComment={onAddComment} />
    </section>
  );
}

export function TaskWorkerLogsPanel({ task }: { task: Task }) {
  const [workerLog, setWorkerLog] = useState(task.workerLog);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshLog = async () => {
    setIsRefreshing(true);
    try {
      setWorkerLog(await kanbanApi.getTaskWorkerLog(task.id, task.boardId));
    } finally {
      setIsRefreshing(false);
    }
  };
  const logText = workerLog?.text?.trim();

  return (
    <section className="space-y-3" data-testid="task-worker-logs-panel">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Worker logs</p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-wait disabled:opacity-60"
          data-testid="task-worker-logs-refresh"
          onClick={refreshLog}
          disabled={isRefreshing}
        >
          <RefreshCcw size={12} className={isRefreshing ? 'animate-spin' : undefined} />
          Refresh
        </button>
      </div>
      {logText ? (
        <pre className="custom-scrollbar max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background/70 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground" data-testid="task-worker-log-text">
          {logText}
        </pre>
      ) : (
        <div className="rounded-xl border border-dashed border-border/70 p-3 text-xs text-muted-foreground" data-testid="task-worker-log-empty">
          No worker log captured yet.
        </div>
      )}
      {task.diagnostics.length > 0 || task.warningCount > 0 ? <TaskDiagnostics diagnostics={task.diagnostics} warningCount={task.warningCount} /> : null}
    </section>
  );
}

export function TaskRunHistoryPanel({ task }: { task: Task }) {
  return <TaskRuns runs={task.runs} />;
}

export function TaskEventsPanel({ task }: { task: Task }) {
  return <TaskActivity activity={task.activity} />;
}

export function TaskMetaPanel({ task, activeBoard }: { task: Task; activeBoard?: Board }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-background/35 p-3" data-testid="task-meta-panel">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Task meta</p>
      <div className="space-y-3 text-xs">
        <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Status</span><StatusBadge status={task.status} /></div>
        <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Priority</span><PriorityBadge priority={task.priority} /></div>
        <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Assignee</span><BotAvatar name={task.assignee} /></div>
        <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Comments</span><span>{task.commentCount}</span></div>
        {activeBoard && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Board</span>
            <a href={`/?board=${encodeURIComponent(activeBoard.id)}`} className="max-w-[150px] truncate rounded bg-secondary px-2 py-1 font-medium hover:bg-accent hover:text-foreground">
              {activeBoard.name || activeBoard.id}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

export function TaskActionDropdown() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" data-testid="task-action-dropdown">
      <button
        type="button"
        className="rounded-lg p-1.5 transition-colors hover:bg-accent"
        aria-label="More task actions"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        data-testid="task-action-dropdown-trigger"
      >
        <MoreHorizontal size={16} className="text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-border bg-card p-2 text-xs shadow-xl" data-testid="task-action-dropdown-menu">
          <p className="px-2 py-1.5 text-muted-foreground">Actions live in the guarded action rail.</p>
        </div>
      )}
    </div>
  );
}

export function LatestSummaryPanel({ task }: { task: Task }) {
  if (!task.latestSummary) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-1.5" data-testid="task-latest-summary-panel">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Latest summary</span>
        {task.summaryUpdatedAt && <span className="text-[10px] text-muted-foreground">{timeAgo(task.summaryUpdatedAt)}</span>}
      </div>
      <MarkdownText value={task.latestSummary} compact className="text-xs text-foreground" />
    </div>
  );
}

export function CompactSection({ title, count, children, 'data-testid': testId }: { title: string; count: number; children: ReactNode; 'data-testid'?: string }) {
  return (
    <section className="rounded-xl border border-border/60 bg-background/35 p-3" data-testid={testId}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{count}</span>
      </div>
      {children}
    </section>
  );
}

export function OpenTaskInNewTabLink({ task }: { task: Task }) {
  return (
    <a
      href={`/tasks/${encodeURIComponent(task.id)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      aria-label={`Open task ${task.id} in a new tab`}
      data-testid="task-open-new-tab-id-link"
    >
      {task.id}
      <ExternalLink size={11} />
    </a>
  );
}
