import { Search, Plus, ChevronDown, Settings, Feather, PanelRightOpen, SquareStack, FileText, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Board } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type TaskDetailPresentation = 'drawer' | 'modal' | 'page';

interface TopBarProps {
  boards: Board[];
  activeBoard: Board;
  onBoardChange: (board: Board) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit?: (query?: string) => void;
  onOpenQuickCapture: () => void;
  onOpenSettings: () => void;
  detailPresentation: TaskDetailPresentation;
  onDetailPresentationChange: (presentation: TaskDetailPresentation) => void;
  isTaskPage?: boolean;
  isTaskSearchPage?: boolean;
  onNavigateToBoard?: () => void;
}

export function TopBar({
  boards,
  activeBoard,
  onBoardChange,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onOpenQuickCapture,
  onOpenSettings,
  detailPresentation,
  onDetailPresentationChange,
  isTaskPage = false,
  isTaskSearchPage = false,
  onNavigateToBoard,
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
          <button
            type="button"
            aria-label="Search all tasks"
            title="Search all tasks"
            data-testid="mobile-global-search-button"
            onClick={() => onSearchSubmit?.()}
            className="p-2 rounded-lg hover:bg-accent"
          >
            <Search size={18} className={cn(isTaskSearchPage ? 'text-foreground' : 'text-muted-foreground')} />
          </button>
          <button
            type="button"
            aria-label="Open settings"
            data-testid="mobile-settings-button"
            onClick={onOpenSettings}
            className="p-2 rounded-lg hover:bg-accent"
          >
            <Settings size={18} className="text-muted-foreground" />
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

          {isTaskPage ? (
            <button
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-secondary text-xs font-medium hover:bg-accent transition-colors"
              onClick={onNavigateToBoard}
              data-testid="task-page-board-link"
            >
              <ArrowLeft size={14} className="text-muted-foreground" />
              <span className="text-muted-foreground">Board</span>
              <span>{activeBoard.name}</span>
            </button>
          ) : (
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
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={isTaskSearchPage ? 'Find task id, title, comment...' : 'Search all tasks…'}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSearchSubmit?.(searchQuery);
                }
              }}
              className="w-64 h-8 pl-8 text-xs bg-secondary border-border"
              data-testid="topbar-global-search"
              aria-label="Search all tasks"
              title="Global search: press Enter to open /tasks"
            />
          </div>
          {!isTaskPage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl p-0"
                data-testid="task-detail-presentation-trigger"
                aria-label={`Task detail view: ${detailPresentation}`}
                title={`Task detail view: ${detailPresentation}`}
              >
                {detailPresentation === 'modal' ? <SquareStack size={17} /> : detailPresentation === 'page' ? <FileText size={17} /> : <PanelRightOpen size={17} />}
                <span className="sr-only">Task detail view: {detailPresentation}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Task detail presentation
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={detailPresentation}
                onValueChange={(value) => onDetailPresentationChange(value as TaskDetailPresentation)}
              >
                <DropdownMenuRadioItem value="drawer" className="text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span>Side drawer</span>
                    <span className="text-[11px] text-muted-foreground">Current half-screen detail panel</span>
                  </div>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="modal" className="text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span>Jira-style modal</span>
                    <span className="text-[11px] text-muted-foreground">Centered overlay with keyboard close/focus trap</span>
                  </div>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="page" className="text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span>Standalone page</span>
                    <span className="text-[11px] text-muted-foreground">Full content canvas for comparing a task page layout</span>
                  </div>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
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
