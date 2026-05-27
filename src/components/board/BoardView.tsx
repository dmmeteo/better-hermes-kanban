import type { Task, TaskStatus, Board } from '@/lib/types';
import { MobileStatusBoard } from './MobileStatusBoard';
import { DesktopKanbanBoard } from './DesktopKanbanBoard';

interface BoardViewProps {
  tasks: Task[];
  boards: Board[];
  activeBoard: Board;
  onBoardChange: (board: Board) => void;
  onTaskClick: (task: Task) => void;
  onOpenSettings: () => void;
  onOpenNewBoard: () => void;
  onTasksChange: (tasks: Task[]) => void;
  onAddTask: (status: TaskStatus) => void;
  searchQuery: string;
}

export function BoardView({
  tasks,
  boards,
  activeBoard,
  onBoardChange,
  onTaskClick,
  onOpenSettings,
  onOpenNewBoard,
  onTasksChange,
  onAddTask,
  searchQuery,
}: BoardViewProps) {
  return (
    <>
      <div className="md:hidden h-full">
        <MobileStatusBoard
          tasks={tasks}
          boards={boards}
          activeBoard={activeBoard}
          onBoardChange={onBoardChange}
          onOpenSettings={onOpenSettings}
          onOpenNewBoard={onOpenNewBoard}
          onTaskClick={onTaskClick}
          searchQuery={searchQuery}
        />
      </div>
      <div className="hidden md:flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1">
          <DesktopKanbanBoard
            tasks={tasks}
            onTaskClick={onTaskClick}
            onTasksChange={onTasksChange}
            onAddTask={onAddTask}
            searchQuery={searchQuery}
            readOnly
          />
        </div>
      </div>
    </>
  );
}
