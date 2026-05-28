import type { BoardSettings } from '@/lib/boardSettings';
import type { Task, TaskStatus, UpdateTaskData } from '@/lib/types';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { TaskDetail } from './TaskDetail';

interface TaskDetailModalProps {
  task: Task | null;
  allTasks: Task[];
  open: boolean;
  onClose: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onAddComment: (text: string) => void;
  onBlock: () => void;
  onReclaim: () => void;
  onDecompose: () => void;
  onDelete: () => void;
  onUpdateTask: (patch: UpdateTaskData) => Promise<void> | void;
  onLinkTask: (targetTaskId: string, relation: 'parent' | 'child') => Promise<void> | void;
  isUpdating?: boolean;
  isMobile?: boolean;
  boardSettings: BoardSettings;
}

export function TaskDetailModal({
  task,
  allTasks,
  open,
  onClose,
  onStatusChange,
  onAddComment,
  onBlock,
  onReclaim,
  onDecompose,
  onDelete,
  onUpdateTask,
  onLinkTask,
  isUpdating = false,
  isMobile = false,
  boardSettings,
}: TaskDetailModalProps) {
  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        data-testid="task-detail-modal"
        aria-describedby={undefined}
        showCloseButton={false}
        className="flex h-[min(86dvh,880px)] max-w-none flex-col gap-0 overflow-hidden border-border/70 bg-background p-0 shadow-2xl sm:max-w-none md:w-[min(92vw,1120px)] md:rounded-2xl md:border md:shadow-[0_24px_90px_rgba(0,0,0,0.55)] max-md:top-0 max-md:left-0 max-md:h-dvh max-md:w-screen max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:border-0"
      >
        <DialogTitle className="sr-only">Task detail: {task.title}</DialogTitle>
        <TaskDetail
          task={task}
          allTasks={allTasks}
          isMobile={isMobile}
          onBack={onClose}
          onStatusChange={onStatusChange}
          onAddComment={onAddComment}
          onBlock={onBlock}
          onReclaim={onReclaim}
          onDecompose={onDecompose}
          onDelete={onDelete}
          onUpdateTask={onUpdateTask}
          onLinkTask={onLinkTask}
          isUpdating={isUpdating}
          boardSettings={boardSettings}
          showCloseButton
        />
      </DialogContent>
    </Dialog>
  );
}
