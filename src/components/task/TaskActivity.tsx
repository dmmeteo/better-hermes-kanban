import {
  GitCommit,
  UserCog,
  MessageSquare,
  Play,
  Octagon,
  RotateCcw,
  ListChecks,
  GitBranch,
} from 'lucide-react';
import type { TaskActivity as TaskActivityType } from '@/lib/types';
import { formatDate } from '@/lib/utils';

interface TaskActivityProps {
  activity: TaskActivityType[];
}

const activityIcons: Record<string, React.ElementType> = {
  status_change: GitCommit,
  assignment: UserCog,
  comment: MessageSquare,
  run: Play,
  block: Octagon,
  reclaim: RotateCcw,
  specify: ListChecks,
  decompose: GitBranch,
};

const activityColors: Record<string, string> = {
  status_change: '#7C5CFF',
  assignment: '#3B82F6',
  comment: '#10B981',
  run: '#0EA5E9',
  block: '#EF4444',
  reclaim: '#F59E0B',
  specify: '#8B5CF6',
  decompose: '#EC4899',
};

export function TaskActivity({ activity }: TaskActivityProps) {
  if (activity.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-xs">
        No activity yet
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Timeline line */}
      <div className="absolute left-[9px] top-2 bottom-2 w-[2px] bg-border/50" />

      {activity.map((item) => {
        const Icon = activityIcons[item.type] || GitCommit;
        const color = activityColors[item.type] || '#6B7280';

        return (
          <div key={item.id} className="flex gap-3 py-2 relative">
            {/* Dot */}
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 mt-0.5"
              style={{ backgroundColor: `${color}20` }}
            >
              <Icon size={10} style={{ color }} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground leading-relaxed">{item.description}</p>
              <span className="text-[10px] text-muted-foreground">{formatDate(item.createdAt)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
