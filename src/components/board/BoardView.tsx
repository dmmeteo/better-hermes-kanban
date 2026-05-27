import type { Task, TaskStatus } from '@/lib/types';
import { MobileStatusBoard } from './MobileStatusBoard';
import { DesktopKanbanBoard } from './DesktopKanbanBoard';

interface BoardViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onTasksChange: (tasks: Task[]) => void;
  onAddTask: (status: TaskStatus) => void;
  searchQuery: string;
}

export function BoardView({
  tasks,
  onTaskClick,
  onTasksChange,
  onAddTask,
  searchQuery,
}: BoardViewProps) {
  return (
    <>
      <div className="md:hidden h-full">
        <MobileStatusBoard
          tasks={tasks}
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
