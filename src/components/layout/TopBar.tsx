import { Search, Filter, Plus, ChevronDown, Settings, Feather } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Board } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TopBarProps {
  boards: Board[];
  activeBoard: Board;
  onBoardChange: (board: Board) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenQuickCapture: () => void;
  onOpenSettings: () => void;
}

export function TopBar({
  boards,
  activeBoard,
  onBoardChange,
  searchQuery,
  onSearchChange,
  onOpenQuickCapture,
  onOpenSettings,
}: TopBarProps) {
  return (
    <header className="shrink-0 border-b border-border/50 bg-card/80 backdrop-blur-sm">
      {/* Mobile header */}
      <div className="md:hidden flex items-center justify-between h-12 px-4">
        <div className="flex items-center gap-2">
          <Feather size={20} style={{ color: '#7C5CFF' }} />
          <span className="font-bold text-sm">Hermes</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg hover:bg-accent">
            <Search size={18} className="text-muted-foreground" />
          </button>
          <button className="p-2 rounded-lg hover:bg-accent">
            <Filter size={18} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden md:flex items-center justify-between h-14 px-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <Feather size={24} style={{ color: '#7C5CFF' }} />
            <div className="flex flex-col">
              <span className="font-bold text-sm leading-tight">Hermes</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground leading-tight">
                Kanban Control Room
              </span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-secondary text-xs font-medium hover:bg-accent transition-colors">
                <span className="text-muted-foreground">Board</span>
                <span>{activeBoard.name}</span>
                <ChevronDown size={14} className="text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {boards.map((board) => (
                <DropdownMenuItem
                  key={board.id}
                  onClick={() => onBoardChange(board)}
                  className={cn(board.id === activeBoard.id && 'bg-accent')}
                >
                  <span className="flex-1">{board.name}</span>
                  <span className="text-muted-foreground text-xs">{board.taskCount}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-64 h-8 pl-8 text-xs bg-secondary border-border"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={onOpenSettings}
          >
            <Settings size={14} />
            <span>Board settings</span>
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5 font-semibold"
            style={{ backgroundColor: '#7C5CFF' }}
            onClick={onOpenQuickCapture}
          >
            <Plus size={14} />
            Create task
          </Button>
        </div>
      </div>
    </header>
  );
}
