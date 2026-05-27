import { useState, useMemo } from 'react';
import type { Task, TaskStatus, Board } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/types';
import { StatusTabs } from './StatusTabs';
import { TaskCard } from './TaskCard';
import { ChevronDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface MobileStatusBoardProps {
  tasks: Task[];
  boards: Board[];
  activeBoard: Board;
  onBoardChange: (board: Board) => void;
  onTaskClick: (task: Task) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function MobileStatusBoard({
  tasks,
  boards,
  activeBoard,
  onBoardChange,
  onTaskClick,
  searchQuery,
  onSearchChange,
}: MobileStatusBoardProps) {
  const [activeStatus, setActiveStatus] = useState<TaskStatus>('triage');
  const [showBoardDropdown, setShowBoardDropdown] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    tasks.forEach((t) => {
      c[t.status] = (c[t.status] || 0) + 1;
    });
    return c;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let result = tasks.filter((t) => t.status === activeStatus);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          (t.assignee && t.assignee.toLowerCase().includes(q))
      );
    }
    return result;
  }, [tasks, activeStatus, searchQuery]);

  return (
    <div className="flex flex-col h-full">
      {/* Header section */}
      <div className="px-4 pt-3 pb-2">
        {/* Board selector */}
        <button
          onClick={() => setShowBoardDropdown(!showBoardDropdown)}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border border-border bg-card text-left"
        >
          <span className="text-xs text-muted-foreground">{activeBoard.id}</span>
          <span className="text-sm font-medium flex-1">{activeBoard.name}</span>
          <ChevronDown size={16} className="text-muted-foreground" />
        </button>

        {showBoardDropdown && (
          <div className="mt-1 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
            {boards.map((board) => (
              <button
                key={board.id}
                onClick={() => {
                  onBoardChange(board);
                  setShowBoardDropdown(false);
                }}
                className="flex items-center justify-between w-full px-3 py-2.5 text-left hover:bg-accent transition-colors"
              >
                <span className="text-sm">{board.name}</span>
                <span className="text-xs text-muted-foreground">{board.taskCount} tasks</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-2 rounded-lg border border-border/60 bg-card/60 p-2">
          <label className="mb-1 block text-[11px] font-semibold text-muted-foreground" htmlFor="mobile-board-local-filter">
            Filter this board
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="mobile-board-local-filter"
              aria-label="Filter this board"
              placeholder="Title, task id, assignee…"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              className="h-9 pl-8 text-xs bg-secondary border-border"
              data-testid="mobile-board-local-filter"
            />
          </div>
        </div>
      </div>

      {/* Status tabs */}
      <StatusTabs
        activeStatus={activeStatus}
        onStatusChange={setActiveStatus}
        counts={counts}
      />

      {/* Task count + sort */}
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-xs text-muted-foreground">
          {STATUS_LABELS[activeStatus]} · {filteredTasks.length} tasks{searchQuery.trim() ? ' · filtered board' : ''}
        </span>
        <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Sort: Priority
        </button>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-4 pb-20 space-y-2.5">
        {filteredTasks.map((task) => (
          <TaskCard key={task.id} task={task} onClick={onTaskClick} />
        ))}
        {filteredTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <span className="text-sm">No tasks in {STATUS_LABELS[activeStatus]}</span>
          </div>
        )}
      </div>
    </div>
  );
}
