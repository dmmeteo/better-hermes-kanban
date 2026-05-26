import type { Priority } from '@/lib/types';
import { PRIORITY_COLORS } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const color = PRIORITY_COLORS[priority];
  const label = priority.toUpperCase();

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded font-bold text-[11px] px-1.5 py-0.5 min-w-[28px]',
        className
      )}
      style={{
        backgroundColor: `${color}18`,
        color: color,
        border: `1px solid ${color}30`,
      }}
    >
      {label}
    </span>
  );
}
