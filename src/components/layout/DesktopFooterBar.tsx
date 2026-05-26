import { Lock, RefreshCw } from 'lucide-react';
import type { Task } from '@/lib/types';
import { STATUS_COLORS, STATUS_ORDER } from '@/lib/types';

interface DesktopFooterBarProps {
  tasks: Task[];
}

export function DesktopFooterBar({ tasks }: DesktopFooterBarProps) {
  const counts: Record<string, number> = {};
  tasks.forEach((t) => {
    counts[t.status] = (counts[t.status] || 0) + 1;
  });

  return (
    <footer className="hidden md:flex items-center justify-between h-10 px-6 bg-card/80 border-t border-border/50 text-xs">
      <div className="flex items-center gap-4">
        <span className="text-muted-foreground">
          Total tasks <span className="text-foreground font-semibold ml-1">{tasks.length}</span>
        </span>
        <div className="flex items-center gap-2">
          {STATUS_ORDER.map((status) => {
            const count = counts[status] || 0;
            if (count === 0) return null;
            return (
              <span
                key={status}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{
                  backgroundColor: `${STATUS_COLORS[status]}15`,
                  color: STATUS_COLORS[status],
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[status] }}
                />
                {count}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 text-muted-foreground">
        <Lock size={12} />
        <span>Running is locked (read-only)</span>
      </div>

      <div className="flex items-center gap-3 text-muted-foreground">
        <span>Auto-refresh: on</span>
        <span>Last updated: 09:41:32</span>
        <button className="p-1 rounded hover:bg-accent transition-colors">
          <RefreshCw size={12} />
        </button>
      </div>
    </footer>
  );
}
