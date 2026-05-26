import { useState } from 'react';
import {
  Send,
  Octagon,
  Calendar,
  Eye,
  CheckCircle,
  UserCog,
  RotateCcw,
  ListChecks,
  GitBranch,
  Archive,
} from 'lucide-react';
import type { Task, TaskStatus } from '@/lib/types';
import { isReadyDisabled, getUnfinishedParents } from '@/lib/utils';
import { WarningBanner } from '@/components/shared/WarningBanner';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TaskActionsProps {
  task: Task;
  allTasks: Task[];
  onStatusChange: (status: TaskStatus) => void;
  onBlock: () => void;
  onReclaim: () => void;
  onDecompose: () => void;
  onDelete: () => void;
}

export function TaskActions({
  task,
  allTasks,
  onStatusChange,
  onBlock,
  onReclaim,
  onDecompose,
  onDelete,
}: TaskActionsProps) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const readyDisabled = task.status === 'ready' ? isReadyDisabled(task, allTasks) : false;
  const unfinishedParents = readyDisabled ? getUnfinishedParents(task, allTasks) : [];
  const isRunning = task.status === 'running';

  // Build action rows: 2 columns x N rows layout
  // Row 1: Ready/Send (colored) | Block (colored)
  // Row 2: Reassign | Schedule
  // Row 3: Specify | Decompose
  // Row 4: Archive/Delete | Review or Done

  const showReady = task.status !== 'ready' && task.status !== 'running' && task.status !== 'done';
  const showBlock = task.status !== 'blocked' && task.status !== 'done' && task.status !== 'running';
  const showSchedule = task.status === 'todo' || task.status === 'triage';
  const showReview = task.status === 'ready' || task.status === 'running';
  const showDone = task.status === 'review' || task.status === 'running';
  const showReclaim = isRunning;
  const showSpecify = task.status === 'triage' || task.status === 'todo';
  const showDecompose = task.status !== 'done';

  return (
    <div className="space-y-3">
      {/* Dependency gating warning */}
      {readyDisabled && unfinishedParents.length > 0 && (
        <WarningBanner
          message={`Ready disabled: ${unfinishedParents.length} parent task${unfinishedParents.length > 1 ? 's' : ''} not done`}
        />
      )}

      {/* Action grid - 2 columns matching reference */}
      <div className="grid grid-cols-2 gap-2">
        {/* Row 1 */}
        {showReady && (
          <button
            onClick={readyDisabled ? undefined : () => onStatusChange('ready')}
            disabled={readyDisabled}
            className={cn(
              'flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-xs font-semibold transition-all active:scale-95',
              readyDisabled && 'opacity-40 cursor-not-allowed'
            )}
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#10B981',
              border: '1px solid rgba(16, 185, 129, 0.30)',
            }}
          >
            <Send size={14} />
            Ready / Send
          </button>
        )}
        {!showReady && <div />}

        {showBlock && (
          <button
            onClick={onBlock}
            className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-xs font-semibold transition-all active:scale-95"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#EF4444',
              border: '1px solid rgba(239, 68, 68, 0.30)',
            }}
          >
            <Octagon size={14} />
            Block
          </button>
        )}
        {!showBlock && showReady && <div />}

        {/* Row 2 */}
        <button
          onClick={() => toast.info('Reassign coming soon')}
          className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-xs font-medium text-muted-foreground bg-card border border-border hover:bg-accent transition-all active:scale-95"
        >
          <UserCog size={14} />
          Reassign
        </button>

        {showReclaim ? (
          <button
            onClick={onReclaim}
            className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-xs font-medium text-muted-foreground bg-card border border-border hover:bg-accent transition-all active:scale-95"
          >
            <RotateCcw size={14} />
            Reclaim
          </button>
        ) : showSchedule ? (
          <button
            onClick={() => onStatusChange('scheduled')}
            className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-xs font-semibold transition-all active:scale-95"
            style={{
              backgroundColor: 'rgba(139, 92, 246, 0.12)',
              color: '#8B5CF6',
              border: '1px solid rgba(139, 92, 246, 0.30)',
            }}
          >
            <Calendar size={14} />
            Schedule
          </button>
        ) : (
          <button
            onClick={() => toast.info('Reassign coming soon')}
            className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-xs font-medium text-muted-foreground bg-card border border-border hover:bg-accent transition-all active:scale-95"
          >
            <UserCog size={14} />
            Reassign
          </button>
        )}

        {/* Row 3 */}
        {showSpecify && (
          <button
            onClick={() => toast.info('Specify requirements coming soon')}
            className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-xs font-medium text-muted-foreground bg-card border border-border hover:bg-accent transition-all active:scale-95"
          >
            <ListChecks size={14} />
            Specify
          </button>
        )}
        {!showSpecify && (
          <button
            onClick={onDecompose}
            className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-xs font-medium text-muted-foreground bg-card border border-border hover:bg-accent transition-all active:scale-95"
          >
            <GitBranch size={14} />
            Decompose
          </button>
        )}

        {showDecompose && !showSpecify ? (
          <button
            onClick={onDecompose}
            className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-xs font-medium text-muted-foreground bg-card border border-border hover:bg-accent transition-all active:scale-95"
          >
            <GitBranch size={14} />
            Decompose
          </button>
        ) : showReview ? (
          <button
            onClick={() => toast.info('Review is a UI-only column and is not supported by the Hermes update API yet')}
            className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-xs font-semibold opacity-60 cursor-not-allowed"
            title="Review is UI-only; use a native Hermes status instead."
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              color: '#F59E0B',
              border: '1px solid rgba(245, 158, 11, 0.30)',
            }}
          >
            <Eye size={14} />
            Review
          </button>
        ) : (
          <button
            onClick={onDecompose}
            className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-xs font-medium text-muted-foreground bg-card border border-border hover:bg-accent transition-all active:scale-95"
          >
            <GitBranch size={14} />
            Decompose
          </button>
        )}

        {/* Row 4 */}
        <button
          onClick={() => setShowConfirmDelete(true)}
          className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-xs font-medium text-muted-foreground bg-card border border-border hover:bg-accent transition-all active:scale-95"
        >
          <Archive size={14} />
          Archive / Delete
        </button>

        {showDone ? (
          <button
            onClick={() => onStatusChange('done')}
            className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-xs font-semibold transition-all active:scale-95"
            style={{
              backgroundColor: 'rgba(34, 197, 94, 0.12)',
              color: '#22C55E',
              border: '1px solid rgba(34, 197, 94, 0.30)',
            }}
          >
            <CheckCircle size={14} />
            Done
          </button>
        ) : (
          <div />
        )}
      </div>

      {/* Delete confirmation */}
      {showConfirmDelete && (
        <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 space-y-2">
          <p className="text-xs text-destructive font-medium">
            Are you sure you want to delete this task?
          </p>
          <div className="flex gap-2">
            <button
              onClick={onDelete}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => setShowConfirmDelete(false)}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-card border border-border hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
