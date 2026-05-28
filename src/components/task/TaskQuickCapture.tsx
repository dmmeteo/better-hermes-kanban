import { useMemo, useState } from 'react';
import { ChevronDown, Loader2, Search, X } from 'lucide-react';
import type {
  Board,
  BotProfile,
  CreateTaskData,
  Priority,
  TaskSearchResult,
  TaskStatus,
} from '@/lib/types';
import type { BoardSettings } from '@/lib/boardSettings';
import { getStatusOptions } from '@/lib/boardSettings';
import { BOT_PROFILES, CREATE_TASK_STATUSES, PRIORITY_LABELS } from '@/lib/types';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InlineSelectField, type InlineSelectOption } from '@/components/shared/InlineSelectField';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { BotAvatar } from '@/components/shared/BotAvatar';
import { kanbanApi } from '@/lib/kanbanApi';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PRIORITIES: Priority[] = ['p0', 'p1', 'p2', 'p3'];

interface TaskQuickCaptureProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: CreateTaskData, boardId: string) => void | Promise<void>;
  boards: Board[];
  activeBoard: Board;
  assignees?: BotProfile[];
  isSubmitting?: boolean;
  boardSettings: BoardSettings;
}

export function TaskQuickCapture({ open, onClose, ...rest }: TaskQuickCaptureProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        data-testid="create-task-modal"
        aria-describedby={undefined}
        showCloseButton={false}
        className="flex h-[min(86dvh,840px)] max-w-none flex-col gap-3 overflow-y-auto border-border/70 bg-background p-4 shadow-2xl sm:max-w-none md:w-[min(92vw,640px)] md:rounded-2xl md:border md:p-5 md:shadow-[0_24px_90px_rgba(0,0,0,0.55)] max-md:top-0 max-md:left-0 max-md:h-dvh max-md:w-screen max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:border-0"
      >
        <DialogTitle className="sr-only">Create task</DialogTitle>
        {/* Mounted only while open (Radix unmounts content on close), so the
            form state resets to defaults on every open without an effect. */}
        <CreateTaskForm onClose={onClose} {...rest} />
      </DialogContent>
    </Dialog>
  );
}

function CreateTaskForm({
  onClose,
  onCreate,
  boards,
  activeBoard,
  assignees = BOT_PROFILES,
  isSubmitting = false,
  boardSettings,
}: Omit<TaskQuickCaptureProps, 'open'>) {
  const [selectedBoardId, setSelectedBoardId] = useState(activeBoard.id);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('p2');
  const [assignee, setAssignee] = useState<string | null>(null);
  const [status, setStatus] = useState<TaskStatus>('triage');
  const [workspaceKind, setWorkspaceKind] = useState<CreateTaskData['workspaceKind']>('scratch');
  const [workspacePath, setWorkspacePath] = useState('');
  const [parent, setParent] = useState<TaskSearchResult | null>(null);

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId) ?? activeBoard,
    [boards, selectedBoardId, activeBoard],
  );

  const statusOptions: InlineSelectOption<TaskStatus>[] = useMemo(
    () =>
      getStatusOptions(boardSettings, CREATE_TASK_STATUSES).map((option) => ({
        value: option.value,
        key: option.value,
        label: <StatusBadge status={option.value} />,
      })),
    [boardSettings],
  );

  const priorityOptions: InlineSelectOption<Priority>[] = useMemo(
    () =>
      PRIORITIES.map((value) => ({
        value,
        key: value,
        label: (
          <span className="inline-flex items-center gap-2">
            <PriorityBadge priority={value} /> {PRIORITY_LABELS[value]}
          </span>
        ),
      })),
    [],
  );

  const assigneeOptions: InlineSelectOption<string | null>[] = useMemo(() => {
    const unassigned: InlineSelectOption<string | null> = {
      value: null,
      key: '__unassigned',
      label: <span className="text-muted-foreground">Auto / no assignee</span>,
    };
    const profiles = assignees.map<InlineSelectOption<string | null>>((profile) => ({
      value: profile.name,
      key: profile.id || profile.name,
      label: profile.name,
      description:
        profile.taskCount != null ? `${profile.taskCount} task${profile.taskCount === 1 ? '' : 's'}` : undefined,
    }));
    return [unassigned, ...profiles];
  }, [assignees]);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (workspacePath.trim() && !workspacePath.trim().startsWith('/')) {
      toast.error('Workspace path must be absolute');
      return;
    }
    await onCreate(
      {
        title: title.trim(),
        description: description.trim(),
        priority,
        assignee,
        status,
        parentIds: parent ? [parent.id] : [],
        workspaceKind,
        workspacePath: workspacePath.trim() || undefined,
      },
      selectedBoardId,
    );
  };

  return (
    <>
      {/* Header: board selector instead of breadcrumbs */}
      <header className="flex items-center justify-between gap-3" data-testid="create-task-header">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Create on
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex max-w-[260px] items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                data-testid="create-task-board-selector"
              >
                <span className="truncate">{selectedBoard.name || selectedBoard.id}</span>
                <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {boards.map((board) => (
                <DropdownMenuItem
                  key={board.id}
                  onSelect={() => setSelectedBoardId(board.id)}
                  className={cn(board.id === selectedBoardId && 'bg-accent')}
                >
                  <span className="flex-1 truncate">{board.name || board.id}</span>
                  <span className="text-xs text-muted-foreground">{board.taskCount}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onClose}
          aria-label="Close"
          data-testid="create-task-close"
        >
          <X size={16} />
        </Button>
      </header>

      {/* Single-column body */}
      <div className="flex flex-col gap-4">
        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-base font-semibold transition-all placeholder:text-base placeholder:font-normal placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            autoFocus
            data-testid="create-task-title"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add context or link..."
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2.5 text-sm transition-all placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            data-testid="create-task-description"
          />
        </div>

        {/* Parent */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Parent (optional)</label>
          <ParentTaskPicker
            boardId={selectedBoardId}
            parent={parent}
            onSelect={setParent}
            onClear={() => setParent(null)}
          />
        </div>

        {/* Assignee */}
        <FieldRow label="Assignee / Profile">
          <InlineSelectField
            value={assignee}
            options={assigneeOptions}
            onChange={(next) => setAssignee(next)}
            renderTrigger={(opt) =>
              opt && opt.value ? (
                <BotAvatar name={String(opt.value)} />
              ) : (
                <span className="text-sm text-muted-foreground">Auto / no assignee</span>
              )
            }
            ariaLabel="Select assignee"
            dataTestId="create-task-assignee"
            className="border border-border bg-card"
          />
        </FieldRow>

        {/* Priority */}
        <FieldRow label="Priority">
          <InlineSelectField
            value={priority}
            options={priorityOptions}
            onChange={(next) => setPriority(next)}
            renderTrigger={(opt) => (
              <span className="inline-flex items-center gap-2">
                <PriorityBadge priority={(opt?.value as Priority) ?? priority} />
                <span className="text-xs text-muted-foreground">
                  {PRIORITY_LABELS[(opt?.value as Priority) ?? priority]}
                </span>
              </span>
            )}
            ariaLabel="Select priority"
            dataTestId="create-task-priority"
            className="border border-border bg-card"
          />
        </FieldRow>

        {/* Status */}
        <FieldRow label="Status">
          <InlineSelectField
            value={status}
            options={statusOptions}
            onChange={(next) => setStatus(next)}
            renderTrigger={() => <StatusBadge status={status} />}
            ariaLabel="Select status"
            dataTestId="create-task-status"
            className="border border-border bg-card"
          />
        </FieldRow>

        {/* Workspace + Path */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr]">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Workspace</label>
            <select
              value={workspaceKind}
              onChange={(event) => setWorkspaceKind(event.target.value as CreateTaskData['workspaceKind'])}
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              data-testid="create-task-workspace-kind"
            >
              <option value="scratch">Scratch</option>
              <option value="dir">Shared dir</option>
              <option value="worktree">Worktree</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Path (optional)</label>
            <input
              type="text"
              value={workspacePath}
              onChange={(event) => setWorkspacePath(event.target.value)}
              placeholder="/absolute/path or board default"
              className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm transition-all placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              data-testid="create-task-workspace-path"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-auto flex items-center justify-end gap-2 border-t border-border/50 pt-4">
        <Button type="button" variant="ghost" onClick={onClose} data-testid="create-task-cancel">
          Cancel
        </Button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={!title.trim() || isSubmitting}
          className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ backgroundColor: '#7C5CFF' }}
          data-testid="create-task-submit"
        >
          {isSubmitting ? 'Creating...' : 'Create task'}
        </button>
      </footer>
    </>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="rounded-lg">{children}</div>
    </div>
  );
}

function ParentTaskPicker({
  boardId,
  parent,
  onSelect,
  onClear,
}: {
  boardId: string;
  parent: TaskSearchResult | null;
  onSelect: (task: TaskSearchResult) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TaskSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const runSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setMessage('Type a task id, title, or body text to search.');
      return;
    }
    setIsSearching(true);
    setMessage(null);
    try {
      const response = await kanbanApi.searchTasks({
        q: trimmed,
        board: boardId || undefined,
        limit: 8,
        sort: 'relevance',
      });
      setResults(response.results);
      if (response.results.length === 0) setMessage('No matching tasks found by id, title, or body.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const select = (result: TaskSearchResult) => {
    onSelect(result);
    setQuery('');
    setResults([]);
    setMessage(null);
  };

  if (parent) {
    return (
      <div
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
        data-testid="create-task-parent-selected"
      >
        <span className="rounded bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {parent.id}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{parent.title}</span>
        <StatusBadge status={parent.status} size="sm" showLabel={false} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onClear}
          aria-label="Remove parent"
          data-testid="create-task-parent-clear"
        >
          <X size={14} />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="create-task-parent-search">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void runSearch();
            }
          }}
          placeholder="Search task id, title, or body…"
          data-testid="create-task-parent-input"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={runSearch}
          disabled={isSearching}
          data-testid="create-task-parent-submit"
        >
          {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        </Button>
      </div>
      {message && (
        <p className="text-xs text-muted-foreground" data-testid="create-task-parent-message">
          {message}
        </p>
      )}
      {results.length > 0 && (
        <ul className="flex flex-col rounded-lg border border-border bg-card">
          {results.map((result) => (
            <li key={`${result.boardId}-${result.id}`}>
              <button
                type="button"
                onClick={() => select(result)}
                className="flex w-full items-center gap-2 border-b border-border/30 px-3 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-accent/30"
                data-testid="create-task-parent-result"
              >
                <span className="rounded bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {result.id}
                </span>
                <span className="min-w-0 flex-1 truncate">{result.title}</span>
                <StatusBadge status={result.status} size="sm" showLabel={false} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
