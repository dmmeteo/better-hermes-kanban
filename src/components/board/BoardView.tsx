import type { Task, TaskStatus, Board } from '@/lib/types';
import { MobileStatusBoard } from './MobileStatusBoard';
import { DesktopKanbanBoard } from './DesktopKanbanBoard';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

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
  boardFilterQuery: string;
  onBoardFilterChange: (query: string) => void;
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
  boardFilterQuery,
  onBoardFilterChange,
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
          searchQuery={boardFilterQuery}
          onSearchChange={onBoardFilterChange}
        />
      </div>
      <div className="hidden md:flex h-full min-h-0 flex-col">
        <div className="shrink-0 px-4 pt-3">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/55 bg-card/45 px-3 py-2">
            <div>
              <p className="text-xs font-semibold text-foreground">Filter this board</p>
              <p className="text-[11px] text-muted-foreground">Narrows the visible cards on {activeBoard.name || activeBoard.id}; top search opens global /tasks.</p>
            </div>
            <div className="relative w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Filter this board"
                placeholder="Title, task id, assignee…"
                value={boardFilterQuery}
                onChange={(event) => onBoardFilterChange(event.target.value)}
                className="h-8 pl-8 text-xs bg-secondary border-border"
                data-testid="board-local-filter"
              />
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <DesktopKanbanBoard
            tasks={tasks}
            onTaskClick={onTaskClick}
            onTasksChange={onTasksChange}
            onAddTask={onAddTask}
            searchQuery={boardFilterQuery}
            readOnly
          />
        </div>
      </div>
    </>
  );
}
