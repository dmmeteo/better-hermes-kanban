import type { Board, BotProfile, LinkedTask, Task, UpdateTaskData } from '@/lib/types';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { TaskDetailBody } from './TaskDetailBody';
import { TaskDetailSidebar } from './TaskDetailSidebar';

interface TaskDetailModalProps {
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
  onSpecify: () => Promise<void>;
  onDecompose: () => Promise<void>;
  isMobile?: boolean;
}

export function TaskDetailModal({
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
  onSpecify,
  onDecompose,
  isMobile = false,
}: TaskDetailModalProps) {
  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        data-testid="task-detail-modal"
        aria-describedby={undefined}
        showCloseButton={false}
        className="flex h-[min(86dvh,880px)] max-w-none flex-col gap-0 overflow-y-auto border-border/70 bg-background p-4 shadow-2xl sm:max-w-none md:w-[min(92vw,1120px)] md:rounded-2xl md:border md:p-5 md:shadow-[0_24px_90px_rgba(0,0,0,0.55)] max-md:top-0 max-md:left-0 max-md:h-dvh max-md:w-screen max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:border-0"
      >
        <DialogTitle className="sr-only">Task detail: {task.title}</DialogTitle>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <TaskDetailBody
            task={task}
            allTasks={allTasks}
            activeBoard={activeBoard}
            layout={isMobile ? 'mobile' : 'overlay'}
            onUpdateTask={onUpdateTask}
            onAddComment={onAddComment}
            onLinkTask={onLinkTask}
            onUnlinkTask={onUnlinkTask}
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
      </DialogContent>
    </Dialog>
  );
}
