import type { TaskDiagnostic } from '@/lib/types';
import { cn } from '@/lib/utils';

interface TaskDiagnosticsProps {
  diagnostics: TaskDiagnostic[];
  warningCount?: number;
}

export function TaskDiagnostics({ diagnostics, warningCount = 0 }: TaskDiagnosticsProps) {
  if (diagnostics.length === 0) {
    if (warningCount > 0) {
      return (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-500/85">
          {warningCount} warning{warningCount === 1 ? '' : 's'} flagged. No detailed diagnostics are attached yet.
        </div>
      );
    }

    return (
      <div className="text-center py-4 text-muted-foreground text-xs">
        No diagnostics
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {diagnostics.map((d) => (
        <div
          key={d.id}
          className="rounded-lg border border-border bg-card p-2.5 space-y-1"
        >
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {d.name}
          </span>
          <div className="text-lg font-bold text-foreground leading-tight">
            {d.value}
          </div>
          {d.change && (
            <span
              className={cn(
                'text-[10px] font-medium',
                d.changeType === 'positive' && 'text-emerald-400',
                d.changeType === 'negative' && 'text-red-400',
                d.changeType === 'neutral' && 'text-muted-foreground'
              )}
            >
              {d.change}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
