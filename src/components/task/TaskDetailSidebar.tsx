import { useMemo, useState } from 'react';
import { Bell, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import type { BotProfile, Priority, Task, UpdateTaskData } from '@/lib/types';
import { PRIORITY_LABELS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { BotAvatar } from '@/components/shared/BotAvatar';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { InlineSelectField, type InlineSelectOption } from '@/components/shared/InlineSelectField';
import { TaskActivity } from './TaskActivity';

type WorkspaceKind = 'scratch' | 'dir' | 'worktree';

interface TaskDetailSidebarProps {
  task: Task;
  assignees: BotProfile[];
  onUpdate: (patch: UpdateTaskData) => Promise<void>;
  onNotify: (channel: 'telegram' | 'discord') => Promise<void>;
  className?: string;
}

const PRIORITIES: Priority[] = ['p0', 'p1', 'p2', 'p3'];

const WORKSPACE_KIND_LABELS: Record<WorkspaceKind, string> = {
  scratch: 'Scratch',
  dir: 'Directory',
  worktree: 'Git worktree',
};

export function TaskDetailSidebar({
  task,
  assignees,
  onUpdate,
  onNotify,
  className,
}: TaskDetailSidebarProps) {
  const [eventsOpen, setEventsOpen] = useState(false);

  const assigneeOptions: InlineSelectOption<string | null>[] = useMemo(() => {
    const unassigned: InlineSelectOption<string | null> = {
      value: null,
      key: '__unassigned',
      label: <span className="text-muted-foreground">Unassigned</span>,
    };
    const profiles = assignees.map<InlineSelectOption<string | null>>((profile) => ({
      value: profile.name,
      key: profile.id || profile.name,
      label: profile.name,
      description:
        profile.taskCount != null ? `${profile.taskCount} task${profile.taskCount === 1 ? '' : 's'}` : undefined,
    }));
    return [unassigned, ...profiles];
  }, [assignees]);

  const priorityOptions: InlineSelectOption<Priority>[] = useMemo(
    () =>
      PRIORITIES.map((priority) => ({
        value: priority,
        key: priority,
        label: (
          <span className="inline-flex items-center gap-2">
            <PriorityBadge priority={priority} /> {PRIORITY_LABELS[priority]}
          </span>
        ),
      })),
    [],
  );

  const workspaceKind: WorkspaceKind | null = task.workspaceKind ?? null;

  const handleAssignee = async (next: string | null) => {
    await onUpdate({ assignee: next });
  };
  const handlePriority = async (next: Priority) => {
    await onUpdate({ priority: next });
  };
  const handleNotify = async (channel: 'telegram' | 'discord') => {
    await toast.promise(onNotify(channel), {
      loading: `Sending ${channel} notification…`,
      success: `Notified ${channel}`,
      error: `Failed to notify ${channel}`,
    });
  };

  return (
    <aside
      className={`flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/30 p-3 ${className ?? ''}`}
      data-testid="task-detail-sidebar"
    >
      <SidebarRow label="Assignee">
        <InlineSelectField
          value={task.assignee}
          options={assigneeOptions}
          onChange={handleAssignee}
          renderTrigger={(opt) =>
            opt && opt.value ? <BotAvatar name={String(opt.value)} /> : <BotAvatar name={null} />
          }
          ariaLabel="Edit assignee"
          dataTestId="task-assignee-field"
        />
      </SidebarRow>

      <SidebarRow label="Priority">
        <InlineSelectField
          value={task.priority}
          options={priorityOptions}
          onChange={handlePriority}
          renderTrigger={(opt) => (
            <span className="inline-flex items-center gap-2">
              <PriorityBadge priority={(opt?.value as Priority) ?? task.priority} />
              <span className="text-xs text-muted-foreground">
                {PRIORITY_LABELS[(opt?.value as Priority) ?? task.priority]}
              </span>
            </span>
          )}
          ariaLabel="Edit priority"
          dataTestId="task-priority-field"
        />
      </SidebarRow>

      <Separator />

      <SidebarRow label="Workspace">
        <div className="flex flex-col gap-1 px-2 py-1" data-testid="task-workspace-readonly">
          <span className="text-sm text-foreground/90">
            {workspaceKind ? WORKSPACE_KIND_LABELS[workspaceKind] : <span className="text-muted-foreground">—</span>}
          </span>
          {task.workspacePath && (
            <span className="truncate font-mono text-[11px] text-muted-foreground" title={task.workspacePath}>
              {task.workspacePath}
            </span>
          )}
          <span className="pt-0.5 text-[10px] text-muted-foreground/80">
            Set at task creation; not editable here.
          </span>
        </div>
      </SidebarRow>

      <Separator />

      <SidebarRow label="Notify channels" icon={<Bell size={12} />}>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleNotify('telegram')}
            data-testid="task-notify-telegram"
          >
            Telegram
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleNotify('discord')}
            data-testid="task-notify-discord"
          >
            Discord
          </Button>
        </div>
      </SidebarRow>

      <Separator />

      <div className="flex flex-col gap-2" data-testid="task-events-section">
        <button
          type="button"
          onClick={() => setEventsOpen((v) => !v)}
          aria-expanded={eventsOpen}
          className="flex items-center justify-between gap-2 px-1 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <span>Events ({task.activity.length})</span>
          <ChevronDown
            size={14}
            className={`transition-transform ${eventsOpen ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        {eventsOpen && (
          <div className="px-1" data-testid="task-events-list">
            <TaskActivity activity={task.activity} />
          </div>
        )}
      </div>
    </aside>
  );
}

function SidebarRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}
