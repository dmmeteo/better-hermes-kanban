import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { BotProfile, Board, Task, UpdateTaskData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { TaskDetailBody } from './TaskDetailBody';
import { TaskDetailSidebar } from './TaskDetailSidebar';

interface TaskDetailPageProps {
  task: Task | null;
  taskId: string;
  allTasks: Task[];
  activeBoard: Board;
  assignees: BotProfile[];
  onBack: () => void;
  onAddComment: (text: string) => void;
  onUpdateTask: (patch: UpdateTaskData) => Promise<void>;
  onLinkTask: (targetTaskId: string, relation: 'parent' | 'child') => Promise<void> | void;
  onNotify: (channel: 'telegram' | 'discord') => Promise<void>;
  onSpecify: () => Promise<void>;
  onDecompose: () => Promise<void>;
}

export function TaskDetailPage({
  task,
  taskId,
  allTasks,
  activeBoard,
  assignees,
  onBack,
  onAddComment,
  onUpdateTask,
  onLinkTask,
  onNotify,
  onSpecify,
  onDecompose,
}: TaskDetailPageProps) {
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
              Switch board or return to the board context. Direct task links resolve their board from task data, without a board query parameter.
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
      <div className="mx-auto grid w-full max-w-7xl gap-4 px-3 py-3 md:px-6 md:py-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <TaskDetailBody
          task={task}
          allTasks={allTasks}
          activeBoard={activeBoard}
          layout="page"
          onUpdateTask={onUpdateTask}
          onAddComment={onAddComment}
          onLinkTask={onLinkTask}
        />

        <div className="lg:sticky lg:top-3 lg:self-start">
          <TaskDetailSidebar
            task={task}
            assignees={assignees}
            onUpdate={onUpdateTask}
            onNotify={onNotify}
            onSpecify={onSpecify}
            onDecompose={onDecompose}
          />
        </div>
      </div>
    </section>
  );
}
