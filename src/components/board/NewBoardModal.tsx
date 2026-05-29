import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { Board } from '@/lib/types';
import { kanbanApi } from '@/lib/kanbanApi';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface NewBoardModalProps {
  open: boolean;
  boards: Board[];
  onClose: () => void;
  onCreated: (board: Board) => void | Promise<void>;
}

function slugifyBoardName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function readableCreateError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Failed to create board';
  const lower = message.toLowerCase();
  if (lower.includes('duplicate') || lower.includes('exists') || lower.includes('unique')) {
    return 'A board with this name or generated slug already exists. Try a more specific name.';
  }
  if (lower.includes('invalid') || lower.includes('slug') || lower.includes('name')) {
    return message || 'Use a clearer board name with letters or numbers.';
  }
  return message;
}

export function NewBoardModal({ open, boards, onClose, onCreated }: NewBoardModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const generatedSlug = useMemo(() => slugifyBoardName(name), [name]);

  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setError(null);
    setIsSubmitting(false);
  }, [open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Board name is required.');
      return;
    }
    if (!generatedSlug) {
      setError('Use a board name with at least one letter or number.');
      return;
    }
    if (boards.some((board) => board.id === generatedSlug || board.name.trim().toLowerCase() === trimmedName.toLowerCase())) {
      setError('A board with this name or generated slug already exists. Try a more specific name.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const created = await kanbanApi.createBoard({
        slug: generatedSlug,
        name: trimmedName,
        description: description.trim() || undefined,
      });
      await kanbanApi.switchBoard(created.id, { persist: true }).catch(() => created);
      await onCreated(created);
      onClose();
    } catch (submitError) {
      setError(readableCreateError(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent showCloseButton={false} data-testid="new-board-modal" className="max-w-md border-border bg-card p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4 text-left">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle>New board</DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                Name the workspace. The technical slug is generated automatically.
              </DialogDescription>
            </div>
            <button
              type="button"
              aria-label="Close new board dialog"
              onClick={onClose}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background hover:bg-accent"
            >
              <X size={15} />
            </button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">Board name</span>
            <Input
              data-testid="new-board-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Launch planning"
              autoFocus
            />
            <span className="block text-[11px] text-muted-foreground">
              Generated slug: <span className="font-mono text-foreground">{generatedSlug || '—'}</span>
            </span>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium">Description</span>
            <Textarea
              data-testid="new-board-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What belongs on this board?"
              className="min-h-24"
            />
          </label>

          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button data-testid="new-board-create" type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Creating…' : 'Create board'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
