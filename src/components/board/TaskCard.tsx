import { MessageSquare, Link2, AlertTriangle, Lock, GripVertical } from 'lucide-react';
import type { Task } from '@/lib/types';
import { STATUS_COLORS } from '@/lib/types';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { BotAvatar } from '@/components/shared/BotAvatar';
import { cn } from '@/lib/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
  isOverlay?: boolean;
  readOnly?: boolean;
}

export function TaskCard({ task, onClick, isOverlay = false, readOnly = false }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { task },
    disabled: task.status === 'running',
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const statusColor = STATUS_COLORS[task.status];
  const isRunning = task.status === 'running';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(!readOnly ? attributes : {})}
      {...(!readOnly ? listeners : {})}
      onClick={() => !isDragging && onClick(task)}
      className={cn(
        'relative bg-secondary/80 text-card-foreground border border-border/80 rounded-lg p-3.5',
        readOnly ? 'cursor-pointer' : 'cursor-grab',
        readOnly ? 'active:cursor-pointer' : 'active:cursor-grabbing active:scale-[0.98]',
        'flex flex-col gap-2',
        'transition-all duration-150',
        'hover:border-border hover:-translate-y-0.5 hover:shadow-lg',
        isDragging && 'opacity-40',
        isOverlay && 'opacity-85 rotate-[2deg] shadow-2xl cursor-grabbing',
        isRunning && 'running-card cursor-default',
        'task-slide-in'
      )}
    >
      {/* Status indicator line */}
      <div
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full"
        style={{ backgroundColor: statusColor }}
      />

      {/* Top row: Priority + counts */}
      <div className="flex items-center justify-between pl-1">
        <div className="flex items-center gap-2">
          <PriorityBadge priority={task.priority} />
          {isRunning && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-400">
              <Lock size={10} />
              running
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span
            className="font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground/35 select-text"
            title={`Task ID: ${task.id}`}
          >
            {task.id}
          </span>
          {task.commentCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px]">
              <MessageSquare size={12} />
              {task.commentCount}
            </span>
          )}
          {task.linkCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px]">
              <Link2 size={12} />
              {task.linkCount}
            </span>
          )}
          {!isOverlay && !readOnly && (
            <GripVertical size={14} className="text-muted-foreground/40 cursor-grab" />
          )}
        </div>
      </div>

      {/* Title */}
      <h4 className="text-sm font-semibold text-[#F4F7FB] leading-snug pl-1 line-clamp-2">
        {task.title}
      </h4>

      {/* Assignee */}
      <div className="pl-1">
        <BotAvatar name={task.assignee} size="sm" className="text-muted-foreground/90" />
      </div>

      {/* Summary preview */}
      {task.latestSummary && (
        <p className="text-[11px] text-muted-foreground/90 leading-relaxed pl-1 line-clamp-2">
          {task.latestSummary}
        </p>
      )}

      {/* Warning indicator */}
      {task.warningCount > 0 && (
        <div className="flex items-center gap-1 pl-1">
          <AlertTriangle size={12} className="text-amber-500" />
          <span className="text-[10px] text-amber-500 font-medium">{task.warningCount} warning</span>
        </div>
      )}
    </div>
  );
}
