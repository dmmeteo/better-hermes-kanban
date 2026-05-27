import { MessageSquare, ExternalLink, Inbox, Clock3 } from 'lucide-react';
import type { Board, Task } from '@/lib/types';
import { PRIORITY_LABELS, PRIORITY_COLORS } from '@/lib/types';
import { getWaitingReason } from '@/lib/attention';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';

interface NeedsMeDrawerProps {
  open: boolean;
  tasks: Task[];
  activeBoard: Board;
  onClose: () => void;
  onOpenTask: (task: Task) => void;
  onReplyTask: (task: Task) => void;
  isMobile?: boolean;
}

function relativeTime(value?: string | null): string {
  if (!value) return 'recently';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'recently';

  const diffMs = Date.now() - timestamp;
  const minutes = Math.max(1, Math.floor(diffMs / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NeedsMeDrawer({
  open,
  tasks,
  activeBoard,
  onClose,
  onOpenTask,
  onReplyTask,
  isMobile = false,
}: NeedsMeDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        data-testid={isMobile ? 'mobile-needs-me-drawer' : 'desktop-needs-me-drawer'}
        className="!w-screen !max-w-none gap-0 overflow-hidden border-l border-border bg-background p-0 sm:!w-[420px] sm:!max-w-[420px]"
      >
        <SheetTitle className="sr-only">Needs me</SheetTitle>
        <SheetDescription className="sr-only">
          Tasks on {activeBoard.name || activeBoard.id} waiting for your answer
        </SheetDescription>

        <div className="flex h-full flex-col">
          <header className="border-b border-border/60 px-5 py-4">
            <div className="flex items-start gap-3 pr-8">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Inbox size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold leading-tight">Needs me</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tasks.length === 1 ? '1 task is' : `${tasks.length} tasks are`} waiting for your answer
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border/70 bg-card/70 px-3 py-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Current board</div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="truncate text-sm font-medium">{activeBoard.name || activeBoard.id}</span>
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                  {activeBoard.taskCount} tasks
                </span>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {tasks.length === 0 ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/30 px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                  <Inbox size={22} />
                </div>
                <h3 className="mt-4 text-sm font-semibold">Nothing needs you right now.</h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Agents are working or this board is clear. Blocked tasks only appear here when they explicitly wait for you.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <article
                    key={task.id}
                    data-testid="needs-me-task-card"
                    className="rounded-2xl border border-border/70 bg-card/80 p-3 shadow-sm transition-colors hover:border-primary/35"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              backgroundColor: `${PRIORITY_COLORS[task.priority]}18`,
                              color: PRIORITY_COLORS[task.priority],
                            }}
                          >
                            {PRIORITY_LABELS[task.priority]}
                          </span>
                          <span className="text-[11px] font-medium text-muted-foreground">{task.id}</span>
                        </div>
                        <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-foreground">
                          {task.title}
                        </h3>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock3 size={12} />
                        <span>{relativeTime(task.waitingSince || task.updatedAt)}</span>
                      </div>
                    </div>

                    <p className="mt-3 line-clamp-3 rounded-xl bg-secondary/55 px-3 py-2 text-xs leading-5 text-muted-foreground">
                      <span className="font-medium text-foreground/80">Waiting:</span> {getWaitingReason(task)}
                    </p>

                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 flex-1 text-xs"
                        style={{ backgroundColor: '#7C5CFF' }}
                        onClick={() => onReplyTask(task)}
                      >
                        <MessageSquare size={14} />
                        Reply
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 flex-1 text-xs"
                        onClick={() => onOpenTask(task)}
                      >
                        <ExternalLink size={14} />
                        Open
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
