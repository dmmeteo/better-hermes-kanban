import { useEffect, useMemo, useState } from 'react';
import { Archive, ArrowLeft, Check, Pencil, Plus, Save, Star } from 'lucide-react';
import type { Board } from '@/lib/types';
import { kanbanApi } from '@/lib/kanbanApi';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export type BoardSettingsMode = 'list' | 'create' | 'edit';

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
  icon: string;
  color: string;
  defaultWorkdir: string;
};

const emptyBoardForm: BoardFormState = {
  slug: '',
  name: '',
  description: '',
  icon: '',
  color: '',
  defaultWorkdir: '',
};

function boardToForm(board?: Board): BoardFormState {
  if (!board) return emptyBoardForm;
  return {
    slug: board.id,
    name: board.name || board.id,
    description: board.description || '',
    icon: board.icon || '',
    color: board.color || '',
    defaultWorkdir: '',
  };
}

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
  const [selectedBoardId, setSelectedBoardId] = useState(activeBoard.id);
  const [boardForm, setBoardForm] = useState<BoardFormState>(boardToForm(activeBoard));
  const [boardSaving, setBoardSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId) || activeBoard,
    [activeBoard, boards, selectedBoardId]
  );

  useEffect(() => {
    if (!open) return;
    setBoardMode(mode);
    setConfirmArchive(false);
    if (mode === 'create') {
      setBoardForm(emptyBoardForm);
      return;
    }
    setSelectedBoardId(activeBoard.id);
    setBoardForm(boardToForm(activeBoard));
  }, [activeBoard, mode, open]);

  const refreshBoards = async (preferredBoardId?: string) => {
    if (onBoardsRefresh) await onBoardsRefresh(preferredBoardId);
  };

  const openCreateBoard = () => {
    setBoardMode('create');
    setConfirmArchive(false);
    setBoardForm(emptyBoardForm);
  };

  const openEditBoard = (board: Board) => {
    setSelectedBoardId(board.id);
    setBoardMode('edit');
    setConfirmArchive(false);
    setBoardForm(boardToForm(board));
  };

  const saveBoard = async () => {
    const slug = boardForm.slug.trim().toLowerCase();
    const name = boardForm.name.trim();
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
      const payload = {
        name,
        description: boardForm.description.trim(),
        icon: boardForm.icon.trim(),
        color: boardForm.color.trim(),
        defaultWorkdir: boardForm.defaultWorkdir.trim(),
      };
      const next = boardMode === 'create'
        ? await kanbanApi.createBoard({ slug, ...payload })
        : await kanbanApi.updateBoard(selectedBoard.id, payload);
      await refreshBoards(next.id);
      setSelectedBoardId(next.id);
      setBoardForm(boardToForm(next));
      setBoardMode('edit');
      toast.success(boardMode === 'create' ? `Created ${next.name}` : `Updated ${next.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save board');
    } finally {
      setBoardSaving(false);
    }
  };

  const archiveBoard = async () => {
    setBoardSaving(true);
    try {
      await kanbanApi.deleteBoard(selectedBoard.id);
      await refreshBoards();
      setBoardMode('list');
      setConfirmArchive(false);
      toast.success(`Archived ${selectedBoard.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to archive board');
    } finally {
      setBoardSaving(false);
    }
  };

  const showForm = boardMode === 'create' || boardMode === 'edit';
  const title = boardMode === 'create' ? 'New board' : boardMode === 'edit' ? 'Edit board' : 'Settings';

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        data-testid="settings-drawer"
        className="w-[92vw] gap-0 border-border bg-background p-0 sm:max-w-[420px]"
      >
        <SheetHeader className="border-b border-border/50 px-4 py-4">
          <div className="flex items-start gap-3 pr-8">
            {showForm && (
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
              <SheetTitle className="text-base">{title}</SheetTitle>
              <SheetDescription className="text-xs">
                {showForm ? 'Only basic board fields live here.' : 'Boards and app-level entry points, without extra dispatcher noise.'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!showForm ? (
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
                      <div
                        key={board.id}
                        className={cn(
                          'group flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors',
                          isActive ? 'border-primary/30 bg-primary/10' : 'border-border/60 bg-card/30 hover:bg-accent/40'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onBoardChange(board)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <Star size={14} className={board.isDefault ? 'shrink-0 fill-amber-400 text-amber-400' : 'shrink-0 text-muted-foreground'} />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{board.name}</span>
                          <span className="text-xs text-muted-foreground">{board.taskCount}</span>
                          {isActive && <Check size={14} className="text-primary" />}
                        </button>
                        <button
                          type="button"
                          aria-label={`Edit ${board.name}`}
                          onClick={() => openEditBoard(board)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Pencil size={13} />
                        </button>
                      </div>
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
                  {boardMode === 'create' && (
                    <label className="space-y-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Slug</span>
                      <input
                        value={boardForm.slug}
                        onChange={(event) => setBoardForm((current) => ({ ...current, slug: event.target.value }))}
                        placeholder="my-board"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
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
                      className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Icon</span>
                      <input
                        value={boardForm.icon}
                        onChange={(event) => setBoardForm((current) => ({ ...current, icon: event.target.value }))}
                        placeholder="kanban"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Color</span>
                      <input
                        value={boardForm.color}
                        onChange={(event) => setBoardForm((current) => ({ ...current, color: event.target.value }))}
                        placeholder="#7C5CFF"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <label className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Default workdir</span>
                    <input
                      value={boardForm.defaultWorkdir}
                      onChange={(event) => setBoardForm((current) => ({ ...current, defaultWorkdir: event.target.value }))}
                      placeholder="/home/me/projects/..."
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
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
                  {boardSaving ? 'Saving…' : 'Save board'}
                </button>
                {boardMode === 'edit' && !confirmArchive && (
                  <button
                    type="button"
                    onClick={() => setConfirmArchive(true)}
                    disabled={boardSaving}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-xs font-medium text-destructive disabled:opacity-60"
                  >
                    <Archive size={13} />
                    Archive…
                  </button>
                )}
              </div>

              {boardMode === 'edit' && confirmArchive && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs">
                  <p className="mb-3 font-medium text-destructive">Archive “{selectedBoard.name}”?</p>
                  <div className="flex gap-2">
                    <button onClick={archiveBoard} disabled={boardSaving} className="rounded-md bg-destructive px-2.5 py-1.5 text-destructive-foreground">Confirm archive</button>
                    <button onClick={() => setConfirmArchive(false)} className="rounded-md border border-border px-2.5 py-1.5">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
