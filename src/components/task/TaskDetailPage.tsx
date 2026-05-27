import { ArrowLeft, ExternalLink, PanelRightOpen } from 'lucide-react';
import type { Board, Task, TaskStatus, UpdateTaskData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { cn } from '@/lib/utils';
import { TaskDetail } from './TaskDetail';

interface TaskDetailPageProps {
  task: Task | null;
  taskId: string;
  allTasks: Task[];
  activeBoard: Board;
  onBack: () => void;
  onOpenDrawer: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onAddComment: (text: string) => void;
  onBlock: () => void;
  onReclaim: () => void;
  onDecompose: () => void;
  onDelete: () => void;
  onUpdateTask: (patch: UpdateTaskData) => Promise<void> | void;
  isUpdating?: boolean;
  isMobile?: boolean;
}

export function TaskDetailPage({
  task,
  taskId,
  allTasks,
  activeBoard,
  onBack,
  onOpenDrawer,
  onStatusChange,
  onAddComment,
  onBlock,
  onReclaim,
  onDecompose,
  onDelete,
  onUpdateTask,
  isUpdating = false,
  isMobile = false,
}: TaskDetailPageProps) {
  const nearbyTasks = allTasks
    .filter((candidate) => candidate.id !== taskId)
    .slice(0, 8);

  if (!task) {
    return (
      <section className="h-full overflow-y-auto bg-background" data-testid="task-detail-page-empty">
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="rounded-full border border-border/70 bg-card/60 p-4 text-muted-foreground">
            <ExternalLink size={24} />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Task page</p>
            <h1 className="text-2xl font-bold">Task {taskId} is not on this board</h1>
            <p className="max-w-md text-sm text-muted-foreground">
              Switch board or return to the board context. Direct links keep the selected board in the URL so you can recover navigation state.
            </p>
          </div>
          <Button onClick={onBack} className="gap-2">
            <ArrowLeft size={16} />
            Back to board
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="h-full overflow-y-auto bg-background" data-testid="task-detail-page">
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-4 px-3 py-3 md:px-6 md:py-5">
        <div className="rounded-2xl border border-border/70 bg-card/75 px-3 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.22)] md:px-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <Button variant="outline" size="sm" className="h-9 shrink-0 gap-2" onClick={onBack} data-testid="task-page-back">
                <ArrowLeft size={15} />
                <span className="hidden sm:inline">Board</span>
              </Button>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-mono rounded bg-secondary px-2 py-0.5">{task.id}</span>
                  <span>on {activeBoard.name || activeBoard.id}</span>
                  <span className="hidden md:inline">Direct-link task page</span>
                </div>
                <h1 className="line-clamp-2 text-lg font-bold leading-tight md:text-2xl">{task.title}</h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onOpenDrawer} data-testid="task-page-open-drawer">
                <PanelRightOpen size={14} />
                Drawer variant
              </Button>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-h-[70vh] overflow-hidden rounded-2xl border border-border/70 bg-card/45 shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
            <TaskDetail
              task={task}
              allTasks={allTasks}
              isMobile={isMobile}
              onBack={onBack}
              onStatusChange={onStatusChange}
              onAddComment={onAddComment}
              onBlock={onBlock}
              onReclaim={onReclaim}
              onDecompose={onDecompose}
              onDelete={onDelete}
              onUpdateTask={onUpdateTask}
              isUpdating={isUpdating}
            />
          </div>

          <aside className="hidden rounded-2xl border border-border/70 bg-card/45 p-3 lg:block">
            <div className="mb-3 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Board context</p>
              <p className="text-sm font-semibold">{activeBoard.name || activeBoard.id}</p>
              <p className="text-xs text-muted-foreground">Task page keeps context without hiding the board route.</p>
            </div>
            <div className="space-y-2">
              {nearbyTasks.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/70 p-3 text-xs text-muted-foreground">No sibling tasks loaded.</p>
              ) : (
                nearbyTasks.map((candidate) => (
                  <div
                    key={candidate.id}
                    className={cn(
                      'rounded-xl border border-border/60 bg-background/45 p-2.5 text-xs transition-colors hover:border-primary/40'
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">{candidate.id}</span>
                      <StatusBadge status={candidate.status} />
                    </div>
                    <p className="line-clamp-2 font-medium leading-snug">{candidate.title}</p>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
