import type { Board, BotProfile, Task, UpdateTaskData } from '@/lib/types';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { TaskDetailBody } from './TaskDetailBody';
import { TaskDetailSidebar } from './TaskDetailSidebar';

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
  onNotify: (channel: 'telegram' | 'discord') => Promise<void>;
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
  onNotify,
  onSpecify,
  onDecompose,
  isMobile = false,
}: TaskDetailSheetProps) {
  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="!w-screen !max-w-none gap-0 overflow-y-auto border-l border-border bg-background p-4 md:!w-[65vw] md:!max-w-none md:p-5"
      >
        <SheetTitle className="sr-only">Task detail: {task.title}</SheetTitle>
        <SheetDescription className="sr-only">Read and update task {task.id}</SheetDescription>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <TaskDetailBody
            task={task}
            allTasks={allTasks}
            activeBoard={activeBoard}
            layout={isMobile ? 'mobile' : 'overlay'}
            onUpdateTask={onUpdateTask}
            onAddComment={onAddComment}
            onLinkTask={onLinkTask}
          />
          <TaskDetailSidebar
            task={task}
            assignees={assignees}
            onUpdate={onUpdateTask}
            onNotify={onNotify}
            onSpecify={onSpecify}
            onDecompose={onDecompose}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
