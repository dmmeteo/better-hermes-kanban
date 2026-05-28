import type { Board, BotProfile, LinkedTask, Task, UpdateTaskData } from '@/lib/types';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { TaskDetailBody, TaskDetailTabs } from './TaskDetailBody';
import { TaskDetailSidebar } from './TaskDetailSidebar';
import { TaskBreadcrumbs } from './TaskDetailSections';

interface TaskDetailSheetProps {
  task: Task | null;
  allTasks: Task[];
  activeBoard?: Board;
  assignees: BotProfile[];
  open: boolean;
  onClose: () => void;
  onAddComment: (text: string) => void;
  onUpdateTask: (patch: UpdateTaskData) => Promise<void>;
  onLinkTask: (targetTaskId: string, relation: 'parent' | 'child') => Promise<void> | void;
  onUnlinkTask: (link: LinkedTask) => Promise<void>;
  onNotify: (channel: 'telegram' | 'discord') => Promise<void>;
  subscribedChannels?: { telegram: boolean; discord: boolean };
  onSpecify: () => Promise<void>;
  onDecompose: () => Promise<void>;
  isMobile?: boolean;
}

export function TaskDetailSheet({
  task,
  allTasks,
  activeBoard,
  assignees,
  open,
  onClose,
  onAddComment,
  onUpdateTask,
  onLinkTask,
  onUnlinkTask,
  onNotify,
  subscribedChannels,
  onSpecify,
  onDecompose,
  isMobile = false,
}: TaskDetailSheetProps) {
  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="!w-screen !max-w-none gap-3 overflow-y-auto border-l border-border bg-background p-4 md:!w-[clamp(460px,48vw,620px)] md:!max-w-none md:p-5"
      >
        <SheetTitle className="sr-only">Task detail: {task.title}</SheetTitle>
        <SheetDescription className="sr-only">Read and update task {task.id}</SheetDescription>
        <div className="pr-8" data-testid="task-sheet-breadcrumbs">
          <TaskBreadcrumbs task={task} activeBoard={activeBoard} />
        </div>
        {/* Single-column tablet view: the drawer is narrow, so content stacks
            (body → sidebar → tabs) instead of splitting into the 2-column desktop grid. */}
        <div className="flex flex-col gap-4">
          <TaskDetailBody
            task={task}
            allTasks={allTasks}
            layout={isMobile ? 'mobile' : 'tablet'}
            onUpdateTask={onUpdateTask}
            onLinkTask={onLinkTask}
            onUnlinkTask={onUnlinkTask}
            onSpecify={onSpecify}
            onDecompose={onDecompose}
            onNotify={onNotify}
            subscribedChannels={subscribedChannels}
          />
          <TaskDetailSidebar
            task={task}
            assignees={assignees}
            onUpdate={onUpdateTask}
          />
          <TaskDetailTabs task={task} onAddComment={onAddComment} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
