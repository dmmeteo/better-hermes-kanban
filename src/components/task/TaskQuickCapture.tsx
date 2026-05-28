import { useMemo, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type {
  Board,
  BotProfile,
  CreateTaskData,
  Priority,
  Task,
  TaskStatus,
} from '@/lib/types';
import type { BoardSettings } from '@/lib/boardSettings';
import { getStatusOptions } from '@/lib/boardSettings';
import { BOT_PROFILES, CREATE_TASK_STATUSES, PRIORITY_LABELS } from '@/lib/types';
import { kanbanApi } from '@/lib/kanbanApi';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InlineSelectField, type InlineSelectOption } from '@/components/shared/InlineSelectField';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { BotAvatar } from '@/components/shared/BotAvatar';
import { LinkedTaskSearch, type LinkedTaskCandidate } from './LinkedTaskSearch';
import { toast } from 'sonner';

const PRIORITIES: Priority[] = ['p0', 'p1', 'p2', 'p3'];

interface TaskQuickCaptureProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: CreateTaskData, boardId: string) => void | Promise<void>;
  boards: Board[];
  activeBoard: Board;
  /** Loaded tasks of the active board, used as parent-search candidates. */
  boardTasks: Task[];
  /** Pre-selected status (e.g. when opened from a column's "+"). */
  initialStatus?: TaskStatus;
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
  boardTasks,
  initialStatus,
  assignees = BOT_PROFILES,
  isSubmitting = false,
  boardSettings,
}: Omit<TaskQuickCaptureProps, 'open'>) {
  const [selectedBoardId, setSelectedBoardId] = useState(activeBoard.id);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('p2');
  const [assignee, setAssignee] = useState<string | null>(null);
  const [status, setStatus] = useState<TaskStatus>(initialStatus ?? 'triage');
  const [workspaceKind, setWorkspaceKind] = useState<CreateTaskData['workspaceKind']>('scratch');
  const [workspacePath, setWorkspacePath] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [parent, setParent] = useState<LinkedTaskCandidate | null>(null);
  // Tasks of a non-active board, lazily fetched when the board is switched
  // (the active board's tasks come in via the boardTasks prop).
  const [extraTasks, setExtraTasks] = useState<Task[] | null>(null);

  const parentCandidates: LinkedTaskCandidate[] =
    selectedBoardId === activeBoard.id ? boardTasks : extraTasks ?? [];

  const loadCandidates = async (boardId: string) => {
    if (boardId === activeBoard.id) {
      setExtraTasks(null);
      return;
    }
    try {
      const result = await kanbanApi.getBoard(boardId);
      setExtraTasks(result.tasks);
    } catch {
      setExtraTasks([]);
    }
  };

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId) ?? activeBoard,
    [boards, selectedBoardId, activeBoard],
  );

  const boardOptions: InlineSelectOption<string>[] = useMemo(
    () =>
      boards.map((board) => ({
        value: board.id,
        key: board.id,
        label: board.name || board.id,
        description: board.taskCount != null ? `${board.taskCount}` : undefined,
      })),
    [boards],
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
    const skills = skillsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    await onCreate(
      {
        title: title.trim(),
        description: description.trim(),
        priority,
        assignee,
        status,
        parentIds: parent ? [parent.id] : [],
        skills: skills.length ? skills : undefined,
        workspaceKind,
        workspacePath: workspacePath.trim() || undefined,
      },
      selectedBoardId,
    );
  };

  return (
    <>
      {/* Header */}
      <header className="flex items-center justify-between gap-3" data-testid="create-task-header">
        <h2 className="text-sm font-semibold">Create task</h2>
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
        {/* Board */}
        <FieldRow label="Board">
          <InlineSelectField
            value={selectedBoardId}
            options={boardOptions}
            onChange={(next) => {
              setSelectedBoardId(next);
              setParent(null); // parent is board-scoped
              void loadCandidates(next);
            }}
            renderTrigger={() => (
              <span className="text-sm">{selectedBoard.name || selectedBoard.id}</span>
            )}
            ariaLabel="Select board"
            dataTestId="create-task-board"
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
          {parent ? (
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
                onClick={() => setParent(null)}
                aria-label="Remove parent"
                data-testid="create-task-parent-clear"
              >
                <X size={14} />
              </Button>
            </div>
          ) : (
            <LinkedTaskSearch
              boardId={selectedBoardId}
              localTasks={parentCandidates}
              placeholder="Search task id or title on this board…"
              testIdSuffix="parent"
              onSelect={(result) => setParent(result)}
            />
          )}
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

        {/* Skills */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Skills (optional, comma-separated)</label>
          <input
            type="text"
            value={skillsInput}
            onChange={(e) => setSkillsInput(e.target.value)}
            placeholder="translation, github-code-review…"
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm transition-all placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            data-testid="create-task-skills"
          />
        </div>

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

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="rounded-lg">{children}</div>
    </div>
  );
}
