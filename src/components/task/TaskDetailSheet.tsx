import type { Board, BotProfile, LinkedTask, Task, UpdateTaskData } from '@/lib/types';
import type { BoardSettings } from '@/lib/boardSettings';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { TaskDetailBody, TaskDetailTabs, TaskStatusControl } from './TaskDetailBody';
import { TaskDetailSidebar } from './TaskDetailSidebar';
import { TaskBreadcrumbs } from './TaskDetailSections';
import { TaskNotifyMenu } from './TaskNotifyMenu';

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
  onToggleNotify: (channel: 'telegram' | 'discord', subscribed: boolean) => Promise<void>;
  subscribedChannels?: { telegram: boolean; discord: boolean };
  onSpecify: () => Promise<void>;
  onDecompose: () => Promise<void>;
  isMobile?: boolean;
  boardSettings?: BoardSettings;
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
  onToggleNotify,
  subscribedChannels,
  onSpecify,
  onDecompose,
  isMobile = false,
  boardSettings,
}: TaskDetailSheetProps) {
  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="!w-screen !max-w-none gap-3 overflow-y-auto border-l border-border bg-background p-4 md:!w-[65vw] md:!max-w-none md:p-5"
      >
        <SheetTitle className="sr-only">Task detail: {task.title}</SheetTitle>
        <SheetDescription className="sr-only">Read and update task {task.id}</SheetDescription>
        <div className="pr-8" data-testid="task-sheet-breadcrumbs">
          <TaskBreadcrumbs task={task} activeBoard={activeBoard} />
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[auto_1fr] xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
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
              onToggleNotify={onToggleNotify}
              subscribedChannels={subscribedChannels}
              boardSettings={boardSettings}
            />
          </div>
          <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <div className="mb-3 hidden lg:flex lg:items-center lg:justify-between lg:gap-2" data-testid="task-sheet-status-row">
              <TaskStatusControl
                task={task}
                onUpdateTask={onUpdateTask}
                onSpecify={onSpecify}
                onDecompose={onDecompose}
                align="start"
                boardSettings={boardSettings}
              />
              <TaskNotifyMenu
                subscribed={subscribedChannels ?? { telegram: false, discord: false }}
                onToggle={onToggleNotify}
              />
            </div>
            <TaskDetailSidebar
              task={task}
              assignees={assignees}
              onUpdate={onUpdateTask}
            />
          </div>
          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <TaskDetailTabs task={task} onAddComment={onAddComment} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
