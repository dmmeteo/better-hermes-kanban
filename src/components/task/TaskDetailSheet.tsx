import type { Task } from '@/lib/types';
import { TaskDetail } from './TaskDetail';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import type { TaskStatus, UpdateTaskData } from '@/lib/types';

interface TaskDetailSheetProps {
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
  isUpdating?: boolean;
}

export function TaskDetailSheet({
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
  isUpdating = false,
}: TaskDetailSheetProps) {
  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:w-[480px] p-0 border-l border-border bg-background"
      >
        <TaskDetail
          task={task}
          allTasks={allTasks}
          onStatusChange={onStatusChange}
          onAddComment={onAddComment}
          onBlock={onBlock}
          onReclaim={onReclaim}
          onDecompose={onDecompose}
          onDelete={onDelete}
          onUpdateTask={onUpdateTask}
          isUpdating={isUpdating}
        />
      </SheetContent>
    </Sheet>
  );
}
