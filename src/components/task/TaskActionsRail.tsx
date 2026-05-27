import { useState } from 'react';
import type { ElementType } from 'react';
import {
  Archive,
  Calendar,
  CheckCircle,
  ChevronDown,
  GitBranch,
  ListChecks,
  MoreHorizontal,
  Octagon,
  RotateCcw,
  Send,
  UserCog,
  X,
} from 'lucide-react';
import type { Board, Task, TaskStatus } from '@/lib/types';
import { BotAvatar } from '@/components/shared/BotAvatar';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { WarningBanner } from '@/components/shared/WarningBanner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getUnfinishedParents, isReadyDisabled } from '@/lib/utils';
import { toast } from 'sonner';

interface TaskActionsRailProps {
  task: Task;
  allTasks: Task[];
  activeBoard: Board;
  onStatusChange: (status: TaskStatus) => void;
  onBlock: () => void;
  onReclaim: () => void;
  onDecompose: () => void;
  onDelete: () => void;
}

type ActionTone = 'primary' | 'danger' | 'quiet' | 'success' | 'purple';

interface ActionButtonProps {
  icon: ElementType;
  label: string;
  onClick: () => void;
  tone?: ActionTone;
  disabled?: boolean;
  title?: string;
  className?: string;
}

function actionClasses(tone: ActionTone = 'quiet') {
  switch (tone) {
    case 'primary':
      return 'border-emerald-500/30 bg-emerald-500/12 text-emerald-400 hover:bg-emerald-500/18';
    case 'danger':
      return 'border-red-500/30 bg-red-500/12 text-red-400 hover:bg-red-500/18';
    case 'success':
      return 'border-green-500/30 bg-green-500/12 text-green-400 hover:bg-green-500/18';
    case 'purple':
      return 'border-violet-500/30 bg-violet-500/12 text-violet-300 hover:bg-violet-500/18';
    default:
      return 'border-border bg-card/70 text-muted-foreground hover:bg-accent hover:text-foreground';
  }
}

function ActionButton({ icon: Icon, label, onClick, tone = 'quiet', disabled = false, title, className }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all active:scale-[0.98]',
        actionClasses(tone),
        disabled && 'cursor-not-allowed opacity-45 hover:bg-card/70 hover:text-muted-foreground',
        className
      )}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  );
}

function getTaskActionState(task: Task, allTasks: Task[]) {
  const readyDisabled = task.status === 'ready' ? isReadyDisabled(task, allTasks) : false;
  const unfinishedParents = readyDisabled ? getUnfinishedParents(task, allTasks) : [];
  const isRunning = task.status === 'running';

  return {
    readyDisabled,
    unfinishedParents,
    showReady: task.status !== 'ready' && task.status !== 'running' && task.status !== 'done',
    showBlock: task.status !== 'blocked' && task.status !== 'done' && task.status !== 'running',
    showSchedule: task.status === 'todo' || task.status === 'triage',
    showReclaim: isRunning,
    showSpecify: task.status === 'triage' || task.status === 'todo',
    showDone: task.status === 'review',
    primaryLabel: task.status === 'running' ? 'Running' : task.status === 'done' ? 'Done' : 'Ready / Send',
  };
}

function useConfirmDelete(onDelete: () => void) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const confirmDelete = (
    <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-200">
      <p className="font-semibold">Delete this task?</p>
      <p className="mt-1 text-red-200/70">This action is intentionally separated from daily workflow controls.</p>
      <div className="mt-3 flex gap-2">
        <Button variant="destructive" size="sm" className="h-8 flex-1 text-xs" onClick={onDelete}>
          Delete
        </Button>
        <Button variant="outline" size="sm" className="h-8 flex-1 text-xs" onClick={() => setShowConfirmDelete(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );

  return { showConfirmDelete, setShowConfirmDelete, confirmDelete };
}

function TaskActionSet({
  task,
  allTasks,
  onStatusChange,
  onBlock,
  onReclaim,
  onDecompose,
  onDelete,
  compact = false,
}: Omit<TaskActionsRailProps, 'activeBoard'> & { compact?: boolean }) {
  const state = getTaskActionState(task, allTasks);
  const { showConfirmDelete, setShowConfirmDelete, confirmDelete } = useConfirmDelete(onDelete);

  return (
    <div className="space-y-3">
      {state.readyDisabled && state.unfinishedParents.length > 0 && (
        <WarningBanner message={`Ready disabled: ${state.unfinishedParents.length} parent task${state.unfinishedParents.length > 1 ? 's' : ''} not done`} />
      )}

      <div className={cn('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-1')}>
        {state.showReady && (
          <ActionButton
            icon={Send}
            label="Ready / Send"
            tone="primary"
            disabled={state.readyDisabled}
            onClick={() => onStatusChange('ready')}
          />
        )}
        {state.showBlock && <ActionButton icon={Octagon} label="Block" tone="danger" onClick={onBlock} />}
        {task.status !== 'done' && <ActionButton icon={UserCog} label="Reassign" onClick={() => toast.info('Reassign coming soon')} />}
        {state.showReclaim && <ActionButton icon={RotateCcw} label="Reclaim" onClick={onReclaim} />}
        {state.showSchedule && <ActionButton icon={Calendar} label="Schedule" tone="purple" onClick={() => onStatusChange('scheduled')} />}
        {state.showSpecify && <ActionButton icon={ListChecks} label="Specify" onClick={() => toast.info('Specify requirements coming soon')} />}
        {task.status !== 'done' && <ActionButton icon={GitBranch} label="Decompose" onClick={onDecompose} />}
        {state.showDone && <ActionButton icon={CheckCircle} label="Done" tone="success" onClick={() => onStatusChange('done')} />}
      </div>

      {task.status === 'done' && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200/80">
          This task is done. Destructive controls are tucked below.
        </div>
      )}

      <div className="rounded-xl border border-border/60 bg-background/35 p-2">
        <button
          type="button"
          onClick={() => setShowConfirmDelete((value) => !value)}
          className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          <span className="flex items-center gap-2">
            <Archive size={14} />
            Archive / Delete
          </span>
          <ChevronDown size={14} className={cn('transition-transform', showConfirmDelete && 'rotate-180')} />
        </button>
        {showConfirmDelete && <div className="mt-2">{confirmDelete}</div>}
      </div>
    </div>
  );
}

export function TaskActionsRail({ task, allTasks, activeBoard, onStatusChange, onBlock, onReclaim, onDecompose, onDelete }: TaskActionsRailProps) {
  return (
    <aside className="hidden rounded-2xl border border-border/70 bg-card/45 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.16)] lg:block" data-testid="task-actions-rail">
      <div className="sticky top-4 space-y-4">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Task actions</p>
          <p className="text-sm font-semibold">Actions</p>
          <p className="text-xs text-muted-foreground">Only available workflow controls are shown here.</p>
        </div>

        <TaskActionSet
          task={task}
          allTasks={allTasks}
          onStatusChange={onStatusChange}
          onBlock={onBlock}
          onReclaim={onReclaim}
          onDecompose={onDecompose}
          onDelete={onDelete}
        />

        <div className="rounded-2xl border border-border/60 bg-background/35 p-3">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Task meta</p>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={task.status} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Priority</span>
              <PriorityBadge priority={task.priority} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Assignee</span>
              <BotAvatar name={task.assignee} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Board</span>
              <a href={`/?board=${encodeURIComponent(activeBoard.id)}`} className="max-w-[150px] truncate rounded bg-secondary px-2 py-1 font-medium hover:bg-accent hover:text-foreground">
                {activeBoard.name || activeBoard.id}
              </a>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function MobileTaskActionBar({ task, allTasks, activeBoard, onStatusChange, onBlock, onReclaim, onDecompose, onDelete }: TaskActionsRailProps) {
  const [open, setOpen] = useState(false);
  const state = getTaskActionState(task, allTasks);
  const primaryDisabled = task.status === 'done' || task.status === 'running' || state.readyDisabled;
  const primaryAction = () => {
    onStatusChange('ready');
  };

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/90 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur-xl lg:hidden" data-testid="mobile-task-action-bar">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Button className="h-11 flex-1 gap-2" disabled={primaryDisabled} onClick={primaryAction}>
            {task.status === 'running' ? <CheckCircle size={16} /> : <Send size={16} />}
            {state.primaryLabel}
          </Button>
          <Button variant="outline" className="h-11 gap-2" onClick={() => setOpen(true)}>
            <MoreHorizontal size={16} />
            More
          </Button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Task actions">
          <button type="button" className="absolute inset-0 bg-background/75 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Close task actions" />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border border-border/70 bg-card p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-24px_80px_rgba(0,0,0,0.4)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Task actions</p>
                <h2 className="mt-1 text-base font-semibold">{task.id}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{activeBoard.name || activeBoard.id}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setOpen(false)} aria-label="Close task actions">
                <X size={16} />
              </Button>
            </div>
            <TaskActionSet
              task={task}
              allTasks={allTasks}
              onStatusChange={onStatusChange}
              onBlock={onBlock}
              onReclaim={onReclaim}
              onDecompose={onDecompose}
              onDelete={onDelete}
              compact
            />
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-border/60 bg-background/35 p-3 text-xs">
              <div><span className="text-muted-foreground">Status</span><div className="mt-1"><StatusBadge status={task.status} /></div></div>
              <div><span className="text-muted-foreground">Priority</span><div className="mt-1"><PriorityBadge priority={task.priority} /></div></div>
              <div><span className="text-muted-foreground">Assignee</span><div className="mt-1"><BotAvatar name={task.assignee} /></div></div>
              <div><span className="text-muted-foreground">Board</span><div className="mt-1 truncate font-medium">{activeBoard.name || activeBoard.id}</div></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
