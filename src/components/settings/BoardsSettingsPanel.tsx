import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Save } from 'lucide-react';
import type { Board } from '@/lib/types';
import { kanbanApi } from '@/lib/kanbanApi';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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

function boardToForm(board: Board): BoardFormState {
  return {
    slug: board.id,
    name: board.name || board.id,
    description: board.description || '',
  };
}

export function BoardsSettingsPanel({
  open,
  onClose,
  mode = 'list',
  activeBoard,
  onBoardsRefresh,
}: BoardsSettingsPanelProps) {
  const [boardMode, setBoardMode] = useState<BoardSettingsMode>(mode);
  const [boardForm, setBoardForm] = useState<BoardFormState>(boardToForm(activeBoard));
  const [boardSaving, setBoardSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBoardMode(mode);
    setBoardForm(mode === 'create' ? emptyBoardForm : boardToForm(activeBoard));
  }, [activeBoard, mode, open]);

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

    if (boardMode === 'create' && !slug) {
      toast.error('Board slug is required');
      return;
    }
    if (!name) {
      toast.error('Board name is required');
      return;
    }

    setBoardSaving(true);
    try {
      const next = boardMode === 'create'
        ? await kanbanApi.createBoard({ slug, name, description })
        : await kanbanApi.updateBoard(activeBoard.id, { name, description });
      await refreshBoards(next.id);
      setBoardMode('list');
      setBoardForm(boardToForm(next));
      toast.success(boardMode === 'create' ? `Created ${next.name}` : `Updated ${next.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save board');
    } finally {
      setBoardSaving(false);
    }
  };

  const showCreateForm = boardMode === 'create';
  const title = showCreateForm ? 'New board' : 'Board settings';

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
                aria-label="Back to current board settings"
                onClick={() => {
                  setBoardMode('list');
                  setBoardForm(boardToForm(activeBoard));
                }}
                className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card hover:bg-accent"
              >
                <ArrowLeft size={15} />
              </button>
            )}
            <div>
              <SheetTitle className="text-base">{title}</SheetTitle>
              <SheetDescription className="text-xs">
                {showCreateForm
                  ? 'Create a board with only the required basics.'
                  : `Settings for ${activeBoard.name || activeBoard.id}. Board switching lives in the selector.`}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-4">
            {!showCreateForm && (
              <div className="rounded-xl border border-border/60 bg-card/30 p-3 text-xs text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span>Current board</span>
                  <span className="font-mono">{activeBoard.id}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span>Tasks</span>
                  <span>{activeBoard.taskCount}</span>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border/60 bg-card/30 p-3">
              <div className="grid gap-3">
                {showCreateForm ? (
                  <label className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Slug</span>
                    <input
                      value={boardForm.slug}
                      onChange={(event) => setBoardForm((current) => ({ ...current, slug: event.target.value }))}
                      placeholder="my-board"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                ) : (
                  <label className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Slug</span>
                    <input
                      value={boardForm.slug}
                      readOnly
                      className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground"
                    />
                  </label>
                )}
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

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={saveBoard}
                disabled={boardSaving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
              >
                <Save size={13} />
                {boardSaving ? 'Saving…' : showCreateForm ? 'Create board' : 'Save board'}
              </button>
              {!showCreateForm && (
                <button
                  type="button"
                  data-testid="settings-new-board-button"
                  onClick={openCreateBoard}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent"
                >
                  <Plus size={13} />
                  New board
                </button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
