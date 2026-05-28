import type { TaskStatus } from '@/lib/types';
import type { BoardSettings } from '@/lib/boardSettings';
import { getOrderedStatuses, getStatusLabel } from '@/lib/boardSettings';
import { STATUS_COLORS, isStatusReadOnly } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Lock } from 'lucide-react';

interface StatusTabsProps {
  activeStatus: TaskStatus;
  onStatusChange: (status: TaskStatus) => void;
  counts: Record<string, number>;
  boardSettings: BoardSettings;
}

export function StatusTabs({ activeStatus, onStatusChange, counts, boardSettings }: StatusTabsProps) {
  const orderedStatuses = getOrderedStatuses(boardSettings);
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-2">
      {orderedStatuses.map((status) => {
        const count = counts[status] || 0;
        const isActive = activeStatus === status;
        const color = STATUS_COLORS[status];
        const isReadOnlyStatus = isStatusReadOnly(status);

        return (
          <button
            key={status}
            onClick={() => onStatusChange(status)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap transition-all duration-150',
              'border shrink-0',
              isActive
                ? 'text-white border-transparent'
                : 'text-muted-foreground border-border bg-card hover:bg-accent'
            )}
            style={
              isActive
                ? { backgroundColor: color, borderColor: color }
                : {}
            }
          >
            {isReadOnlyStatus && <Lock size={10} />}
            {getStatusLabel(status, boardSettings)}
            {count > 0 && (
              <span
                className={cn(
                  'ml-0.5 min-w-[18px] text-center rounded-full text-[10px] px-1 py-0',
                  isActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
