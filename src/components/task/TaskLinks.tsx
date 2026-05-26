import { Link2, ArrowUp, ArrowDown } from 'lucide-react';
import type { LinkedTask } from '@/lib/types';
import { StatusBadge } from '@/components/shared/StatusBadge';

interface TaskLinksProps {
  linkedTasks: LinkedTask[];
}

export function TaskLinks({ linkedTasks }: TaskLinksProps) {
  const parents = linkedTasks.filter((l) => l.relation === 'parent');
  const children = linkedTasks.filter((l) => l.relation === 'child');

  if (linkedTasks.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-xs">
        <Link2 size={20} className="mx-auto mb-2 opacity-40" />
        No linked tasks
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {parents.length > 0 && (
        <div>
          <h5 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1">
            <ArrowUp size={10} />
            Dependencies (parents)
          </h5>
          <div className="space-y-1.5">
            {parents.map((link) => (
              <LinkItem key={link.id} link={link} />
            ))}
          </div>
        </div>
      )}

      {children.length > 0 && (
        <div>
          <h5 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-1">
            <ArrowDown size={10} />
            Dependents (children)
          </h5>
          <div className="space-y-1.5">
            {children.map((link) => (
              <LinkItem key={link.id} link={link} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LinkItem({ link }: { link: LinkedTask }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-md bg-card border border-border/50 hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[10px] text-muted-foreground font-mono shrink-0">{link.taskId}</span>
        <span className="text-xs truncate">{link.title}</span>
      </div>
      <StatusBadge status={link.status} size="sm" />
    </div>
  );
}
