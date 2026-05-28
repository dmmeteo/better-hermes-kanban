import { X } from 'lucide-react';
import type { Board, BotProfile, LinkedTask, Task, UpdateTaskData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { TaskDetailBody, TaskDetailTabs, TaskStatusControl } from './TaskDetailBody';
import { TaskDetailSidebar } from './TaskDetailSidebar';
import { TaskBreadcrumbs } from './TaskDetailSections';

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
        className="flex h-[min(86dvh,880px)] max-w-none flex-col gap-3 overflow-y-auto border-border/70 bg-background p-4 shadow-2xl sm:max-w-none md:w-[min(92vw,1120px)] md:rounded-2xl md:border md:p-5 md:shadow-[0_24px_90px_rgba(0,0,0,0.55)] max-md:top-0 max-md:left-0 max-md:h-dvh max-md:w-screen max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:border-0"
      >
        <DialogTitle className="sr-only">Task detail: {task.title}</DialogTitle>
        <header className="flex items-center justify-between gap-3" data-testid="task-modal-header">
          <TaskBreadcrumbs task={task} activeBoard={activeBoard} className="flex-1" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onClose}
            aria-label="Close"
            data-testid="task-modal-close"
          >
            <X size={16} />
          </Button>
        </header>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[auto_1fr]">
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <TaskDetailBody
              task={task}
              allTasks={allTasks}
              layout={isMobile ? 'mobile' : 'overlay'}
              onUpdateTask={onUpdateTask}
              onLinkTask={onLinkTask}
              onUnlinkTask={onUnlinkTask}
              onSpecify={onSpecify}
              onDecompose={onDecompose}
            />
          </div>
          <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <div className="mb-3 hidden lg:flex lg:justify-start" data-testid="task-modal-status-row">
              <TaskStatusControl
                task={task}
                onUpdateTask={onUpdateTask}
                onSpecify={onSpecify}
                onDecompose={onDecompose}
                align="start"
              />
            </div>
            <TaskDetailSidebar
              task={task}
              assignees={assignees}
              onUpdate={onUpdateTask}
              onNotify={onNotify}
            />
          </div>
          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <TaskDetailTabs task={task} onAddComment={onAddComment} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
