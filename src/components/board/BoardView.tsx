import type { Task, TaskStatus } from '@/lib/types';
import type { BoardSettings } from '@/lib/boardSettings';
import { MobileStatusBoard } from './MobileStatusBoard';
import { DesktopKanbanBoard } from './DesktopKanbanBoard';

interface BoardViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onMoveTask: (taskId: string, toStatus: TaskStatus) => void | Promise<void>;
  onAddTask: (status: TaskStatus) => void;
  searchQuery: string;
  boardSettings: BoardSettings;
  onRenameStatus?: (status: TaskStatus, label: string) => void;
  onToggleCollapse?: (status: TaskStatus) => void;
}

export function BoardView({
  tasks,
  onTaskClick,
  onMoveTask,
  onAddTask,
  searchQuery,
  boardSettings,
  onRenameStatus,
  onToggleCollapse,
}: BoardViewProps) {
  return (
    <>
      <div className="md:hidden h-full">
        <MobileStatusBoard
          tasks={tasks}
          onTaskClick={onTaskClick}
          searchQuery={searchQuery}
          boardSettings={boardSettings}
        />
      </div>
      <div className="hidden md:flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1">
          <DesktopKanbanBoard
            tasks={tasks}
            onTaskClick={onTaskClick}
            onMoveTask={onMoveTask}
            onAddTask={onAddTask}
            searchQuery={searchQuery}
            boardSettings={boardSettings}
            onRenameStatus={onRenameStatus}
            onToggleCollapse={onToggleCollapse}
          />
        </div>
      </div>
    </>
  );
}
