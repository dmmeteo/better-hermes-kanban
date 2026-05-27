import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Plus, Save } from 'lucide-react';
import type { Board } from '@/lib/types';
import { kanbanApi } from '@/lib/kanbanApi';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export type BoardSettingsMode = 'list' | 'create';

interface BoardsSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  mode?: BoardSettingsMode;
  boards: Board[];
  activeBoard: Board;
  onBoardChange: (board: Board) => void;
  onBoardsRefresh?: (preferredBoardId?: string) => Promise<void>;
}

type BoardFormState = {
  slug: string;
  name: string;
  description: string;
};

const emptyBoardForm: BoardFormState = {
  slug: '',
  name: '',
  description: '',
};

export function BoardsSettingsPanel({
  open,
  onClose,
  mode = 'list',
  boards,
  activeBoard,
  onBoardChange,
  onBoardsRefresh,
}: BoardsSettingsPanelProps) {
  const [boardMode, setBoardMode] = useState<BoardSettingsMode>(mode);
  const [boardForm, setBoardForm] = useState<BoardFormState>(emptyBoardForm);
  const [boardSaving, setBoardSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBoardMode(mode);
    setBoardForm(emptyBoardForm);
  }, [mode, open]);

  const refreshBoards = async (preferredBoardId?: string) => {
    if (onBoardsRefresh) await onBoardsRefresh(preferredBoardId);
  };

  const openCreateBoard = () => {
    setBoardMode('create');
    setBoardForm(emptyBoardForm);
  };

  const saveBoard = async () => {
    const slug = boardForm.slug.trim().toLowerCase();
    const name = boardForm.name.trim();
    const description = boardForm.description.trim();

    if (!slug) {
      toast.error('Board slug is required');
      return;
    }
    if (!name) {
      toast.error('Board name is required');
      return;
    }

    setBoardSaving(true);
    try {
      const next = await kanbanApi.createBoard({ slug, name, description });
      await refreshBoards(next.id);
      setBoardMode('list');
      setBoardForm(emptyBoardForm);
      toast.success(`Created ${next.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create board');
    } finally {
      setBoardSaving(false);
    }
  };

  const showCreateForm = boardMode === 'create';

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        data-testid="settings-drawer"
        className="w-[92vw] gap-0 border-border bg-background p-0 sm:max-w-[420px]"
      >
        <SheetHeader className="border-b border-border/50 px-4 py-4">
          <div className="flex items-start gap-3 pr-8">
            {showCreateForm && (
              <button
                type="button"
                aria-label="Back to boards"
                onClick={() => setBoardMode('list')}
                className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card hover:bg-accent"
              >
                <ArrowLeft size={15} />
              </button>
            )}
            <div>
              <SheetTitle className="text-base">{showCreateForm ? 'New board' : 'Settings'}</SheetTitle>
              <SheetDescription className="text-xs">
                {showCreateForm ? 'Create a board with only the required basics.' : 'Switch boards or create a new one.'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!showCreateForm ? (
            <div className="space-y-4">
              <section className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Boards</h3>
                  <span className="text-[10px] text-muted-foreground">{boards.length}</span>
                </div>
                <div className="space-y-1">
                  {boards.map((board) => {
                    const isActive = board.id === activeBoard.id;
                    return (
                      <button
                        key={board.id}
                        type="button"
                        onClick={() => onBoardChange(board)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors',
                          isActive ? 'border-primary/30 bg-primary/10' : 'border-border/60 bg-card/30 hover:bg-accent/40'
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{board.name}</span>
                        <span className="text-xs text-muted-foreground">{board.taskCount}</span>
                        {isActive && <Check size={14} className="text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </section>

              <button
                type="button"
                data-testid="settings-new-board-button"
                onClick={openCreateBoard}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/10 px-3 py-3 text-sm font-medium text-primary hover:bg-primary/15"
              >
                <Plus size={15} />
                New board
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-card/30 p-3">
                <div className="grid gap-3">
                  <label className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Slug</span>
                    <input
                      value={boardForm.slug}
                      onChange={(event) => setBoardForm((current) => ({ ...current, slug: event.target.value }))}
                      placeholder="my-board"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Name</span>
                    <input
                      value={boardForm.name}
                      onChange={(event) => setBoardForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Board name"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Description</span>
                    <textarea
                      value={boardForm.description}
                      onChange={(event) => setBoardForm((current) => ({ ...current, description: event.target.value }))}
                      rows={3}
                      placeholder="Optional"
                      className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              </div>

              <button
                type="button"
                onClick={saveBoard}
                disabled={boardSaving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
              >
                <Save size={13} />
                {boardSaving ? 'Creating…' : 'Create board'}
              </button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
