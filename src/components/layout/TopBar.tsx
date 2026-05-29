import { Plus, ChevronDown, Settings, Feather } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import type { Board, BotProfile } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DataViewSearchAndFilter, type DataViewSearchFilters } from '@/components/search/DataViewSearchAndFilter';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type TaskDetailPresentation = 'drawer' | 'modal' | 'page';

interface TopBarProps {
  boards: Board[];
  assignees: BotProfile[];
  activeBoard: Board;
  onBoardChange: (board: Board) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchFilters?: DataViewSearchFilters;
  onSearchFiltersChange?: (filters: DataViewSearchFilters) => void;
  onSearchSubmit?: (query?: string, filters?: DataViewSearchFilters) => void;
  onOpenQuickCapture: () => void;
  onOpenSettings: () => void;
  onOpenNewBoard: () => void;
  isTaskPage?: boolean;
  isTaskSearchPage?: boolean;
  logoHomeHref: string;
}

export function TopBar({
  boards,
  assignees,
  activeBoard,
  onBoardChange,
  searchQuery,
  onSearchChange,
  searchFilters = {},
  onSearchFiltersChange,
  onSearchSubmit,
  onOpenQuickCapture,
  onOpenSettings,
  onOpenNewBoard,
  isTaskPage = false,
  isTaskSearchPage = false,
  logoHomeHref,
}: TopBarProps) {
  return (
    <header className="relative z-50 shrink-0 border-b border-border/50 bg-card/80 backdrop-blur-sm">
      {/* Mobile header */}
      <div className="md:hidden flex items-center gap-2 h-12 px-4">
        <Link
          to={logoHomeHref}
          aria-label={`Go to ${activeBoard.name || activeBoard.id} board`}
          title={`Go to ${activeBoard.name || activeBoard.id} board`}
          data-testid="app-logo-home-link"
          className="flex min-w-0 shrink-0 items-center gap-2 rounded-lg transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Feather size={20} style={{ color: '#7C5CFF' }} />
          <span className="font-bold text-sm">Hermes</span>
        </Link>
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
          {!isTaskPage && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    data-testid="mobile-board-selector-trigger"
                    className="flex min-w-0 max-w-[180px] flex-1 items-center gap-1.5 rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                  >
                    <span className="truncate">{activeBoard.name}</span>
                    <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {boards.map((board) => (
                    <DropdownMenuItem
                      key={board.id}
                      onClick={() => onBoardChange(board)}
                      className={cn(board.id === activeBoard.id && 'bg-accent')}
                    >
                      <span className="flex-1 truncate">{board.name}</span>
                      <span className="text-muted-foreground text-xs">{board.taskCount}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onOpenNewBoard} data-testid="mobile-board-dropdown-new-board">
                    <Plus size={14} className="mr-2" />
                    New board
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                type="button"
                aria-label="Open settings"
                title="Open settings"
                data-testid="mobile-settings-button"
                onClick={onOpenSettings}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Settings size={17} />
              </button>
            </>
          )}
          <Button
            type="button"
            size="sm"
            className="h-8 shrink-0 gap-1.5 text-xs font-semibold"
            style={{ backgroundColor: '#7C5CFF' }}
            onClick={onOpenQuickCapture}
            data-testid="mobile-create-task"
          >
            <Plus size={14} />
            Create
          </Button>
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden h-14 grid-cols-[1fr_minmax(0,640px)_1fr] items-center gap-4 px-6 md:grid">
        <Link
          to={logoHomeHref}
          aria-label={`Go to ${activeBoard.name || activeBoard.id} board`}
          title={`Go to ${activeBoard.name || activeBoard.id} board`}
          data-testid="app-logo-home-link"
          className="flex w-fit items-center gap-2.5 rounded-xl transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Feather size={24} style={{ color: '#7C5CFF' }} />
          <span className="font-bold text-sm leading-tight">Hermes</span>
        </Link>

        <DataViewSearchAndFilter
          query={searchQuery}
          filters={searchFilters}
          boards={boards}
          assignees={assignees}
          onQueryChange={onSearchChange}
          onFiltersChange={onSearchFiltersChange || (() => undefined)}
          onSubmit={(query, filters) => onSearchSubmit?.(query, filters)}
          placeholder={isTaskSearchPage ? 'Find task id, title, comment…' : 'Search all tasks…'}
          className="w-full"
          testId="topbar-global-search"
        />

        <div className="flex items-center justify-end gap-3">
          {!isTaskPage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex max-w-[260px] items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-medium transition-colors hover:bg-accent" data-testid="board-selector-trigger">
                  <span className="text-muted-foreground">Board</span>
                  <span className="truncate">{activeBoard.name}</span>
                  <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {boards.map((board) => (
                  <DropdownMenuItem
                    key={board.id}
                    onClick={() => onBoardChange(board)}
                    className={cn(board.id === activeBoard.id && 'bg-accent')}
                  >
                    <span className="flex-1 truncate">{board.name}</span>
                    <span className="text-muted-foreground text-xs">{board.taskCount}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onOpenNewBoard} data-testid="board-dropdown-new-board">
                  <Plus size={14} className="mr-2" />
                  New board
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!isTaskPage && (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl p-0"
              data-testid="desktop-settings-button"
              aria-label="Settings"
              title="Settings"
              onClick={onOpenSettings}
            >
              <Settings size={17} />
              <span className="sr-only">Settings</span>
            </Button>
          )}

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
