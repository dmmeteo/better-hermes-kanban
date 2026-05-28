import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { GitBranch, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import type { LinkedTask, Task, TaskStatus, UpdateTaskData } from '@/lib/types';
import {
  NATIVE_STATUS_ORDER,
  STATUS_DESCRIPTIONS,
  isStatusReadOnly,
  isStatusSelectable,
} from '@/lib/types';
import { MarkdownText } from '@/components/shared/MarkdownText';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { WarningBanner } from '@/components/shared/WarningBanner';
import { InlineEditField } from '@/components/shared/InlineEditField';
import { InlineSelectField, type InlineSelectOption } from '@/components/shared/InlineSelectField';
import { Button } from '@/components/ui/button';
import type { BoardSettings } from '@/lib/boardSettings';
import { getStatusLabel } from '@/lib/boardSettings';
import { getUnfinishedParents, isReadyDisabled, cn } from '@/lib/utils';
import {
  TaskCommentsPanel,
  TaskRunHistoryPanel,
  TaskWorkerLogsPanel,
} from './TaskDetailSections';
import { TaskLinkedTasksTab } from './TaskLinkedTasksTab';
import { TaskNotifyMenu } from './TaskNotifyMenu';

type Layout = 'page' | 'overlay' | 'mobile';

interface TaskStatusControlProps {
  task: Task;
  onUpdateTask: (patch: UpdateTaskData) => Promise<void> | void;
  onSpecify: () => Promise<void>;
  onDecompose: () => Promise<void>;
  className?: string;
  align?: 'start' | 'end' | 'center';
  boardSettings?: BoardSettings;
}

export function TaskStatusControl({
  task,
  onUpdateTask,
  onSpecify,
  onDecompose,
  className,
  align = 'end',
  boardSettings,
}: TaskStatusControlProps) {
  const statusOptions: InlineSelectOption<TaskStatus>[] = useMemo(
    () =>
      NATIVE_STATUS_ORDER.map((status) => ({
        value: status,
        key: status,
        label: <StatusBadge status={status} label={getStatusLabel(status, boardSettings)} />,
        description: STATUS_DESCRIPTIONS[status],
        disabled: !isStatusSelectable(status),
      })),
    [boardSettings],
  );

  const statusFieldDisabled = isStatusReadOnly(task.status);
  const showTriageActions = task.status === 'triage';

  const handleStatus = async (next: TaskStatus) => {
    await onUpdateTask({ status: next });
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} data-testid="task-status-control">
      {showTriageActions && (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-[11px]"
            onClick={() =>
              void toast.promise(onSpecify(), {
                loading: 'Marking ready…',
                success: 'Specified',
                error: 'Specify failed',
              })
            }
            data-testid="task-action-specify"
          >
            <ListChecks size={12} /> Specify
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-[11px]"
            onClick={() =>
              void toast.promise(onDecompose(), {
                loading: 'Decomposing…',
                success: 'Decompose started',
                error: 'Decompose failed',
              })
            }
            data-testid="task-action-decompose"
          >
            <GitBranch size={12} /> Decompose
          </Button>
        </>
      )}
      <InlineSelectField
        value={task.status}
        options={statusOptions}
        onChange={handleStatus}
        disabled={statusFieldDisabled}
        disabledReason={statusFieldDisabled ? 'Dispatcher-owned status; cannot edit manually.' : undefined}
        renderTrigger={(opt) => {
          const s = (opt?.value as TaskStatus) ?? task.status;
          return <StatusBadge status={s} label={getStatusLabel(s, boardSettings)} />;
        }}
        ariaLabel="Edit status"
        dataTestId="task-status-field"
        className="px-1"
        align={align}
      />
    </div>
  );
}

interface TaskDetailBodyProps {
  task: Task;
  allTasks: Task[];
  layout: Layout;
  onUpdateTask: (patch: UpdateTaskData) => Promise<void> | void;
  onLinkTask: (targetTaskId: string, relation: 'parent' | 'child') => Promise<void> | void;
  onUnlinkTask: (link: LinkedTask) => Promise<void>;
  onSpecify: () => Promise<void>;
  onDecompose: () => Promise<void>;
  onToggleNotify?: (channel: 'telegram' | 'discord', subscribed: boolean) => Promise<void>;
  subscribedChannels?: { telegram: boolean; discord: boolean };
  headerExtra?: ReactNode;
  boardSettings?: BoardSettings;
}

export function TaskDetailBody({
  task,
  allTasks,
  layout,
  onUpdateTask,
  onLinkTask,
  onUnlinkTask,
  onSpecify,
  onDecompose,
  onToggleNotify,
  subscribedChannels,
  headerExtra,
  boardSettings,
}: TaskDetailBodyProps) {
  const readyDisabled = isReadyDisabled(task, allTasks);
  const unfinishedParents = readyDisabled ? getUnfinishedParents(task, allTasks) : [];

  const handleSaveTitle = async (next: string) => {
    await onUpdateTask({ title: next.trim() });
  };
  const handleSaveDescription = async (next: string) => {
    await onUpdateTask({ description: next });
  };

  return (
    <div className={cn('flex min-h-0 min-w-0 flex-col gap-4', layout === 'mobile' && 'gap-3')} data-testid="task-detail-body">
      <header className="flex flex-col gap-2" data-testid="task-title-row">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <InlineEditField
              value={task.title}
              onSave={handleSaveTitle}
              ariaLabel="Edit task title"
              dataTestId="task-title-field"
              inputClassName="text-base font-semibold"
              displayClassName="text-base font-semibold leading-tight break-words"
              validate={(v) => (v.trim() ? null : 'Title is required')}
              placeholder="Untitled task"
            />
          </div>
          {headerExtra}
        </div>
        {/* Status + Notify render under the title up to lg (status left, notify right).
            On lg+ the same row renders above the sidebar — see Page/Sheet/Modal. */}
        <div className="flex items-center justify-between gap-2 lg:hidden">
          <TaskStatusControl
            task={task}
            onUpdateTask={onUpdateTask}
            onSpecify={onSpecify}
            onDecompose={onDecompose}
            align="start"
            boardSettings={boardSettings}
          />
          {onToggleNotify && (
            <TaskNotifyMenu
              subscribed={subscribedChannels ?? { telegram: false, discord: false }}
              onToggle={onToggleNotify}
            />
          )}
        </div>
      </header>

      {readyDisabled && unfinishedParents.length > 0 && (
        <WarningBanner
          message={`Ready disabled: ${unfinishedParents.length} parent task${unfinishedParents.length > 1 ? 's' : ''} not done`}
        />
      )}

      <section data-testid="task-description-section" className="flex flex-col gap-1.5">
        <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Description</p>
        <InlineEditField
          value={task.description}
          onSave={handleSaveDescription}
          as="textarea"
          ariaLabel="Edit task description"
          dataTestId="task-description-field"
          inputClassName="!min-h-0 leading-relaxed"
          renderDisplay={(v) => <MarkdownText className="text-sm leading-relaxed" value={v} />}
          emptyDisplay={<span className="text-sm text-muted-foreground">— add a description —</span>}
        />
      </section>

      <section data-testid="task-linked-section">
        <TaskLinkedTasksTab task={task} onLinkTask={onLinkTask} onUnlinkTask={onUnlinkTask} />
      </section>
    </div>
  );
}

type TabKey = 'comments' | 'logs' | 'runs';

interface TaskDetailTabsProps {
  task: Task;
  onAddComment: (text: string) => void;
  className?: string;
}

export function TaskDetailTabs({ task, onAddComment, className }: TaskDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('comments');

  const tabs = useMemo(
    () =>
      [
        { key: 'comments', label: 'Comments', count: task.commentCount },
        { key: 'logs', label: 'Worker log', count: task.diagnostics.length + task.warningCount },
        { key: 'runs', label: 'Run history', count: task.runs.length },
      ] satisfies { key: TabKey; label: string; count: number }[],
    [task.commentCount, task.diagnostics.length, task.runs.length, task.warningCount],
  );

  useEffect(() => {
    if (!tabs.some((tab) => tab.key === activeTab)) setActiveTab('comments');
  }, [tabs, activeTab]);

  return (
    <section className={cn('flex min-w-0 flex-col', className)} data-testid="task-detail-tabs-section">
      <div className="flex items-center gap-0 overflow-x-auto border-b border-border/50" data-testid="task-detail-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'relative shrink-0 px-3 py-2 text-xs font-medium transition-colors',
              activeTab === tab.key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
            data-testid={`task-detail-tab-${tab.key}`}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{tab.count}</span>
            )}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full" style={{ backgroundColor: '#7C5CFF' }} />
            )}
          </button>
        ))}
      </div>
      <div className="min-h-[240px] pt-3" data-testid="task-detail-tab-panel">
        {activeTab === 'comments' && <TaskCommentsPanel task={task} onAddComment={onAddComment} />}
        {activeTab === 'logs' && <TaskWorkerLogsPanel task={task} />}
        {activeTab === 'runs' && <TaskRunHistoryPanel task={task} />}
      </div>
    </section>
  );
}
