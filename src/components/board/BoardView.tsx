import type { Task, TaskStatus } from '@/lib/types';
import type { BoardSettings } from '@/lib/boardSettings';
import { MobileStatusBoard } from './MobileStatusBoard';
import { DesktopKanbanBoard } from './DesktopKanbanBoard';

interface BoardViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onTasksChange: (tasks: Task[]) => void;
  onAddTask: (status: TaskStatus) => void;
  searchQuery: string;
  boardSettings: BoardSettings;
}

export function BoardView({
  tasks,
  onTaskClick,
  onTasksChange,
  onAddTask,
  searchQuery,
  boardSettings,
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
            onTasksChange={onTasksChange}
            onAddTask={onAddTask}
            searchQuery={searchQuery}
            boardSettings={boardSettings}
            readOnly
          />
        </div>
      </div>
    </>
  );
}
