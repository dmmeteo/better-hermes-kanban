import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Board, Task, UpdateTaskData } from '@/lib/types';
import { MarkdownText } from '@/components/shared/MarkdownText';
import { WarningBanner } from '@/components/shared/WarningBanner';
import { InlineEditField } from '@/components/shared/InlineEditField';
import { getUnfinishedParents, isReadyDisabled, cn } from '@/lib/utils';
import {
  TaskBreadcrumbs,
  TaskCommentsPanel,
  TaskRunHistoryPanel,
  TaskWorkerLogsPanel,
} from './TaskDetailSections';
import { TaskLinkedTasksTab } from './TaskLinkedTasksTab';

type Layout = 'page' | 'overlay' | 'mobile';

interface TaskDetailBodyProps {
  task: Task;
  allTasks: Task[];
  activeBoard?: Board;
  layout: Layout;
  onUpdateTask: (patch: UpdateTaskData) => Promise<void> | void;
  onAddComment: (text: string) => void;
  onLinkTask: (targetTaskId: string, relation: 'parent' | 'child') => Promise<void> | void;
  headerExtra?: ReactNode;
}

type TabKey = 'links' | 'comments' | 'logs' | 'runs';

export function TaskDetailBody({
  task,
  allTasks,
  activeBoard,
  layout,
  onUpdateTask,
  onAddComment,
  onLinkTask,
  headerExtra,
}: TaskDetailBodyProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('links');

  const tabs = useMemo(
    () =>
      [
        { key: 'links', label: 'Linked tasks', count: task.linkedTasks.length },
        { key: 'comments', label: 'Comments', count: task.commentCount },
        { key: 'logs', label: 'Worker log', count: task.diagnostics.length + task.warningCount },
        { key: 'runs', label: 'Run history', count: task.runs.length },
      ] satisfies { key: TabKey; label: string; count: number }[],
    [task.commentCount, task.diagnostics.length, task.linkedTasks.length, task.runs.length, task.warningCount],
  );

  useEffect(() => {
    if (!tabs.some((tab) => tab.key === activeTab)) setActiveTab('links');
  }, [tabs, activeTab]);

  const readyDisabled = isReadyDisabled(task, allTasks);
  const unfinishedParents = readyDisabled ? getUnfinishedParents(task, allTasks) : [];

  const handleSaveTitle = async (next: string) => {
    await onUpdateTask({ title: next.trim() });
  };
  const handleSaveDescription = async (next: string) => {
    await onUpdateTask({ description: next });
  };

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-4', layout === 'mobile' && 'gap-3')} data-testid="task-detail-body">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <TaskBreadcrumbs
            task={task}
            activeBoard={activeBoard}
            className="flex-1"
          />
          {headerExtra}
        </div>
        <InlineEditField
          value={task.title}
          onSave={handleSaveTitle}
          ariaLabel="Edit task title"
          dataTestId="task-title-field"
          inputClassName="text-base font-semibold"
          displayClassName="text-base font-semibold leading-tight"
          validate={(v) => (v.trim() ? null : 'Title is required')}
          placeholder="Untitled task"
        />
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

      <section data-testid="task-detail-tabs-section" className="flex min-h-0 flex-1 flex-col">
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
          {activeTab === 'links' && <TaskLinkedTasksTab task={task} onLinkTask={onLinkTask} />}
          {activeTab === 'comments' && <TaskCommentsPanel task={task} onAddComment={onAddComment} />}
          {activeTab === 'logs' && <TaskWorkerLogsPanel task={task} />}
          {activeTab === 'runs' && <TaskRunHistoryPanel task={task} />}
        </div>
      </section>
    </div>
  );
}
