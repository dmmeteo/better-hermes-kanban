import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Lock, ChevronsRightLeft, ChevronsLeftRight } from 'lucide-react';
import type { Task, TaskStatus } from '@/lib/types';
import { STATUS_COLORS, isStatusDropEnabled, isStatusReadOnly } from '@/lib/types';
import { TaskCard, TaskCardView, TASK_CARD_BASE_CLASS } from './TaskCard';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddTask?: (status: TaskStatus) => void;
  readOnly?: boolean;
  statusLabel?: string;
  onRenameStatus?: (status: TaskStatus, label: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: (status: TaskStatus) => void;
}

export function KanbanColumn({ status, tasks, onTaskClick, onAddTask, readOnly = false, statusLabel, onRenameStatus, collapsed = false, onToggleCollapse }: KanbanColumnProps) {
  const isReadOnlyStatus = isStatusReadOnly(status);
  const isDropDisabled = !isStatusDropEnabled(status);
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    disabled: isDropDisabled || readOnly,
    data: { status },
  });

  // Column reordering — drag the column by its header. Separate id-space
  // (`column:`) so it never collides with the body droppable (id = status).
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `column:${status}`, data: { type: 'column', status } });

  // The lifted clone is rendered in the board's DragOverlay (free to float
  // anywhere, like a task card); the in-place node becomes a placeholder that
  // dnd-kit slides to the drop slot.
  const sortableStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const color = STATUS_COLORS[status];
  const label = statusLabel || status;

  // While this column is the one being dragged, leave a translucent placeholder
  // (the "shadow" that tracks where the column will land).
  if (isDragging) {
    return (
      <div
        ref={setSortableRef}
        style={sortableStyle}
        className={cn(
          'flex-shrink-0 h-full min-h-0 rounded-xl border-2 border-dashed border-border/40 bg-muted/10',
          collapsed ? 'w-11' : 'w-[300px]',
        )}
        data-testid={`column-placeholder-${status}`}
      />
    );
  }

  if (collapsed) {
    return (
      <div
        ref={setSortableRef}
        style={sortableStyle}
        {...attributes}
        {...listeners}
        className="flex-shrink-0 w-11 h-full min-h-0 flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm py-2.5 cursor-default active:cursor-grabbing"
        data-testid={`column-collapsed-${status}`}
      >
        <button
          type="button"
          onClick={() => onToggleCollapse?.(status)}
          title="Expand column"
          aria-label={`Expand ${label} column`}
          data-testid={`column-expand-${status}`}
          className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground"
        >
          <ChevronsLeftRight size={14} />
        </button>
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[11px] text-muted-foreground font-medium">{tasks.length}</span>
        <span
          className="mt-1 text-[11px] font-bold uppercase tracking-wider [writing-mode:vertical-rl]"
          style={{ color }}
        >
          {label}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={setSortableRef}
      className={cn(
        'flex-shrink-0 w-[300px] h-full min-h-0 flex flex-col rounded-xl border',
        'bg-card/50 backdrop-blur-sm',
        'transition-colors duration-200',
        isOver && !isDropDisabled && 'border-dashed',
        isOver && isDropDisabled && 'border-red-500/50',
        !isOver && 'border-border/50'
      )}
      style={{ ...sortableStyle, ...(isOver && !isDropDisabled ? { borderColor: `${color}60` } : {}) }}
    >
      {/* Column Header — drag handle for reordering columns */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-between px-3 py-2.5 border-b border-border/50 cursor-default active:cursor-grabbing"
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: color }}
          />
          <ColumnTitle
            status={status}
            label={label}
            color={color}
            onRename={onRenameStatus}
          />
          <span className="text-[11px] text-muted-foreground font-medium">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onToggleCollapse && (
            <button
              type="button"
              onClick={() => onToggleCollapse(status)}
              title="Collapse column"
              aria-label={`Collapse ${label} column`}
              data-testid={`column-collapse-${status}`}
              className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground"
            >
              <ChevronsRightLeft size={14} />
            </button>
          )}
          {!isReadOnlyStatus && !readOnly && (
            <button
              onClick={() => onAddTask?.(status)}
              className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground"
            >
              <Plus size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Column Body */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2',
          isDropDisabled && 'relative'
        )}
      >
        {/* Dispatcher-owned status overlay */}
        {isDropDisabled && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-b-xl bg-red-500/5 pointer-events-none">
            <Lock size={20} className="text-red-400/60 mb-1" />
            <span className="text-[11px] text-red-400/60 font-medium">Drop disabled</span>
          </div>
        )}

        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-2">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={onTaskClick}
                readOnly={readOnly}
              />
            ))}
          </div>
        </SortableContext>

        {/* Empty state */}
        {tasks.length === 0 && !isReadOnlyStatus && !readOnly && (
          <button
            onClick={() => onAddTask?.(status)}
            className="w-full py-6 rounded-lg border border-dashed border-border/50 text-muted-foreground text-xs hover:border-border hover:bg-accent/50 transition-colors"
          >
            + Add task
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Presentational clone shown in the board's DragOverlay while a column is
 * being dragged — lets the column float freely under the cursor (like a task
 * card) with a slight tilt, instead of sliding only along the row.
 */
export function ColumnDragPreview({
  status,
  label,
  tasks,
  collapsed = false,
}: {
  status: TaskStatus;
  label: string;
  tasks: Task[];
  collapsed?: boolean;
}) {
  const color = STATUS_COLORS[status];
  if (collapsed) {
    return (
      <div className="w-11 h-80 flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-card py-2.5 shadow-2xl rotate-[2deg]">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[11px] text-muted-foreground font-medium">{tasks.length}</span>
        <span className="mt-1 text-[11px] font-bold uppercase tracking-wider [writing-mode:vertical-rl]" style={{ color }}>
          {label}
        </span>
      </div>
    );
  }
  return (
    <div className="flex max-h-[70vh] w-[300px] flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl rotate-[2deg]">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
        <span className="text-[11px] text-muted-foreground font-medium">{tasks.length}</span>
      </div>
      <div className="flex flex-col gap-2 overflow-hidden p-2">
        {tasks.map((task) => (
          <div key={task.id} className={TASK_CARD_BASE_CLASS}>
            <TaskCardView task={task} />
          </div>
        ))}
      </div>
    </div>
  );
}

interface ColumnTitleProps {
  status: TaskStatus;
  label: string;
  color: string;
  onRename?: (status: TaskStatus, label: string) => void;
}

/**
 * Trello-style inline-editable column title. Click to edit, Enter/blur commits,
 * Escape cancels. Renaming is a display-only alias (independent of drag read-only),
 * so it stays available even while the board is read-only for drag/drop.
 */
function ColumnTitle({ status, label, color, onRename }: ColumnTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cancelingRef = useRef(false);

  useEffect(() => {
    if (editing && inputRef.current) {
      const el = inputRef.current;
      el.focus();
      const len = el.value.length;
      try {
        el.setSelectionRange(len, len);
      } catch {
        // ignore inputs that don't support selection range
      }
    }
  }, [editing]);

  const titleClass = 'text-[11px] font-bold uppercase tracking-wider';

  if (!onRename) {
    return <span className={titleClass} style={{ color }}>{label}</span>;
  }

  const beginEdit = () => {
    setDraft(label);
    cancelingRef.current = false;
    setEditing(true);
  };

  const finish = () => {
    if (cancelingRef.current) {
      cancelingRef.current = false;
      setEditing(false);
      return;
    }
    const trimmed = draft.trim();
    if (trimmed && trimmed !== label) onRename(status, trimmed);
    setEditing(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelingRef.current = true;
      inputRef.current?.blur();
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={finish}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={`Rename ${label} column`}
        data-testid={`column-title-input-${status}`}
        className={cn(titleClass, 'w-[140px] rounded bg-background/80 px-1 py-0.5 outline-none ring-1 ring-border focus:ring-2')}
        style={{ color }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={beginEdit}
      onPointerDown={(e) => e.stopPropagation()}
      title="Rename column"
      data-testid={`column-title-${status}`}
      className={cn(titleClass, 'rounded px-1 py-0.5 -mx-1 text-left transition-colors hover:bg-accent/50 cursor-text')}
      style={{ color }}
    >
      {label}
    </button>
  );
}
