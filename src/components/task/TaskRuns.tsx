import { Play, CheckCircle, XCircle } from 'lucide-react';
import type { TaskRun } from '@/lib/types';
import { formatDate } from '@/lib/utils';

interface TaskRunsProps {
  runs: TaskRun[];
}

export function TaskRuns({ runs }: TaskRunsProps) {
  if (runs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-xs">
        No runs yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {runs.map((run, index) => (
        <div
          key={run.id}
          className="rounded-lg border border-border bg-card p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {run.status === 'started' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-400">
                  <Play size={12} />
                  In progress
                </span>
              )}
              {run.status === 'completed' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                  <CheckCircle size={12} />
                  Completed
                </span>
              )}
              {run.status === 'failed' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400">
                  <XCircle size={12} />
                  Failed
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">#{runs.length - index}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {formatDate(run.startedAt)}
            </span>
          </div>

          {run.output && (
            <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-border/50 pt-2">
              {run.output}
            </p>
          )}

          {run.completedAt && (
            <span className="text-[10px] text-muted-foreground">
              Duration: {Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 60000)}m
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
