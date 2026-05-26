import type { TaskStatus } from '@/lib/types';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: TaskStatus;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusBadge({ status, showLabel = true, size = 'sm', className }: StatusBadgeProps) {
  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md font-semibold uppercase tracking-wider',
        size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
        className
      )}
      style={{
        backgroundColor: `${color}20`,
        color: color,
        border: `1px solid ${color}30`,
      }}
    >
      <span
        className="rounded-full"
        style={{
          width: size === 'sm' ? 6 : 8,
          height: size === 'sm' ? 6 : 8,
          backgroundColor: color,
        }}
      />
      {showLabel && label}
    </span>
  );
}
