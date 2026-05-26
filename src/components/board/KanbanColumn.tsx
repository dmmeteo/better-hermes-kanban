import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Lock } from 'lucide-react';
import type { Task, TaskStatus } from '@/lib/types';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/types';
import { TaskCard } from './TaskCard';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onAddTask?: (status: TaskStatus) => void;
}

export function KanbanColumn({ status, tasks, onTaskClick, onAddTask }: KanbanColumnProps) {
  const isRunning = status === 'running';
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    disabled: isRunning,
    data: { status },
  });

  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];

  return (
    <div
      className={cn(
        'flex-shrink-0 w-[300px] flex flex-col rounded-xl border',
        'bg-card/50 backdrop-blur-sm',
        'transition-colors duration-200',
        isOver && !isRunning && 'border-dashed',
        isOver && isRunning && 'border-red-500/50',
        !isOver && 'border-border/50'
      )}
      style={isOver && !isRunning ? { borderColor: `${color}60` } : {}}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color }}
          >
            {label}
          </span>
          <span className="text-[11px] text-muted-foreground font-medium">
            {tasks.length}
          </span>
          {isRunning && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Lock size={10} />
              read-only
            </span>
          )}
        </div>
        {!isRunning && (
          <button
            onClick={() => onAddTask?.(status)}
            className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Column Body */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 p-2 min-h-[120px]',
          isRunning && 'relative'
        )}
      >
        {/* Running overlay */}
        {isRunning && (
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
              />
            ))}
          </div>
        </SortableContext>

        {/* Empty state */}
        {tasks.length === 0 && !isRunning && (
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
