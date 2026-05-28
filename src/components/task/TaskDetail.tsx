import { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronLeft, ChevronRight, Clock, Link2, MessageSquare, Paperclip } from 'lucide-react';
import type { Task, TaskStatus, UpdateTaskData } from '@/lib/types';
import { WarningBanner } from '@/components/shared/WarningBanner';
import { TaskActions } from './TaskActions';
import { TaskAttachmentsPlanned } from './TaskAttachmentsPlanned';
import { TaskUpdatePanel } from './TaskUpdatePanel';
import { getUnfinishedParents, isReadyDisabled } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  CompactSection,
  LatestSummaryPanel,
  TaskCommentsPanel,
  TaskDescriptionMarkdown,
  TaskDetailHeader,
  TaskMetaPanel,
  TaskRunHistoryPanel,
  TaskWorkerLogsPanel,
} from './TaskDetailSections';
import { TaskLinkedTasksTab } from './TaskLinkedTasksTab';

interface TaskDetailProps {
  task: Task;
  allTasks: Task[];
  isMobile?: boolean;
  onBack?: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onAddComment: (text: string) => void;
  onBlock: () => void;
  onReclaim: () => void;
  onDecompose: () => void;
  onDelete: () => void;
  onUpdateTask: (patch: UpdateTaskData) => Promise<void> | void;
  onLinkTask: (targetTaskId: string, relation: 'parent' | 'child') => Promise<void> | void;
  isUpdating?: boolean;
  showCloseButton?: boolean;
  chrome?: 'panel' | 'page';
  showUpdatePanel?: boolean;
  showInlineActions?: boolean;
  showDescription?: boolean;
}

export function TaskDetail({
  task,
  allTasks,
  isMobile = false,
  onBack,
  onStatusChange,
  onAddComment,
  onBlock,
  onReclaim,
  onDecompose,
  onDelete,
  onUpdateTask,
  onLinkTask,
  isUpdating = false,
  showCloseButton = false,
  chrome = 'panel',
  showUpdatePanel = true,
  showInlineActions = true,
  showDescription = true,
}: TaskDetailProps) {
  const [activeTab, setActiveTab] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    comments: false,
    activity: false,
    runs: false,
    links: false,
    logs: false,
    attachments: false,
  });

  const toggleSection = (key: string) => setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const readyDisabled = isReadyDisabled(task, allTasks);
  const unfinishedParents = readyDisabled ? getUnfinishedParents(task, allTasks) : [];
  const showPanelChrome = chrome === 'panel';
  const hasDiagnostics = task.diagnostics.length > 0 || task.warningCount > 0;
  const hasPlannedAttachments = task.plannedAttachments.length > 0;

  const hasLinkedTasks = task.linkedTasks.length > 0;

  const mobileSections = [
    { key: 'links', label: 'Linked tasks', icon: Link2, count: task.linkedTasks.length },
    { key: 'comments', label: 'Comments', icon: MessageSquare, count: task.commentCount },
    { key: 'logs', label: 'Worker log', icon: Activity, count: task.diagnostics.length + task.warningCount },
    { key: 'runs', label: 'Run history', icon: Clock, count: task.runs.length },
    { key: 'attachments', label: 'Attachments (planned)', icon: Paperclip, count: task.plannedAttachments.length },
  ];
  const visibleMobileSections = mobileSections.filter((section) => {
    if (section.key === 'links') return hasLinkedTasks;
    if (section.key === 'logs') return hasDiagnostics;
    if (section.key === 'attachments') return hasPlannedAttachments;
    return true;
  });

  const desktopTabs = useMemo(
    () => [
      ...(hasLinkedTasks ? [{ key: 'links', label: 'Linked tasks', count: task.linkedTasks.length }] : []),
      { key: 'comments', label: 'Comments', count: task.commentCount },
      ...(hasDiagnostics ? [{ key: 'logs', label: 'Worker log', count: task.diagnostics.length + task.warningCount }] : []),
      ...(task.runs.length > 0 ? [{ key: 'runs', label: 'Run history', count: task.runs.length }] : []),
      ...(!hasLinkedTasks ? [{ key: 'links', label: 'Link tasks', count: 0 }] : []),
    ],
    [hasDiagnostics, hasLinkedTasks, task.commentCount, task.diagnostics.length, task.linkedTasks.length, task.runs.length, task.warningCount]
  );
  const selectedTab = desktopTabs.some((tab) => tab.key === activeTab) ? activeTab : desktopTabs[0]?.key;

  useEffect(() => {
    if (!desktopTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(desktopTabs[0]?.key || 'comments');
    }
  }, [activeTab, desktopTabs]);

  return (
    <div className={cn('flex h-full min-h-0 flex-col', isMobile ? 'bg-background' : '')}>
      {showPanelChrome && (
        <div className="shrink-0 border-b border-border/50 px-4 py-3">
          <div className="flex items-start gap-3">
            {isMobile && onBack && (
              <button onClick={onBack} className="mt-0.5 -ml-1 rounded-lg p-1 transition-colors hover:bg-accent" aria-label="Back to board">
                <ChevronLeft size={20} />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <TaskDetailHeader
                task={task}
                onBack={undefined}
                onClose={onBack}
                showCloseButton={showCloseButton}
                showBackButton={false}
                compact
              />
            </div>
          </div>
        </div>
      )}

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-5 px-4 py-4">
          {showDescription && task.description && (
            <div className="rounded-xl border border-border/60 bg-card/50 p-3.5" data-testid="task-description-card">
              <TaskDescriptionMarkdown value={task.description} />
            </div>
          )}

          {showPanelChrome && <TaskMetaPanel task={task} />}
          <LatestSummaryPanel task={task} />

          {isMobile && (
            <>
              {readyDisabled && unfinishedParents.length > 0 && (
                <WarningBanner message={`Ready disabled: ${unfinishedParents.length} parent task${unfinishedParents.length > 1 ? 's' : ''} not done`} />
              )}

              <div className="space-y-1">
                {visibleMobileSections.map((section) => (
                  <div key={section.key}>
                    <button onClick={() => toggleSection(section.key)} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/50">
                      <div className="flex items-center gap-2.5">
                        <section.icon size={16} className="text-muted-foreground" />
                        <span className="text-xs font-medium">{section.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">{section.count}</span>
                        <ChevronRight size={14} className={cn('text-muted-foreground transition-transform', expandedSections[section.key] && 'rotate-90')} />
                      </div>
                    </button>
                    {expandedSections[section.key] && (
                      <div className="ml-6 rounded-lg bg-background/35 px-3 py-2">
                        {section.key === 'links' && <TaskLinkedTasksTab task={task} onLinkTask={onLinkTask} />}
                        {section.key === 'comments' && <TaskCommentsPanel task={task} onAddComment={onAddComment} />}
                        {section.key === 'logs' && <TaskWorkerLogsPanel task={task} />}
                        {section.key === 'runs' && <TaskRunHistoryPanel task={task} />}
                        {section.key === 'attachments' && <TaskAttachmentsPlanned attachments={task.plannedAttachments} />}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {showUpdatePanel && <TaskUpdatePanel task={task} onUpdate={onUpdateTask} isSaving={isUpdating} showTitleField={showPanelChrome} />}

              {showInlineActions && (
                <TaskActions task={task} allTasks={allTasks} onStatusChange={onStatusChange} onBlock={onBlock} onReclaim={onReclaim} onDecompose={onDecompose} onDelete={onDelete} />
              )}
            </>
          )}

          {!isMobile && (
            <>
              <div className="flex items-center gap-0 border-b border-border/50">
                {desktopTabs.map((tab) => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={cn('relative px-3 py-2 text-xs font-medium transition-colors', activeTab === tab.key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                    <span>{tab.label}</span>
                    {typeof tab.count === 'number' && tab.count > 0 && <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{tab.count}</span>}
                    {activeTab === tab.key && <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full" style={{ backgroundColor: '#7C5CFF' }} />}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                {selectedTab === 'links' && <TaskLinkedTasksTab task={task} onLinkTask={onLinkTask} />}
                {selectedTab === 'comments' && <TaskCommentsPanel task={task} onAddComment={onAddComment} />}
                {selectedTab === 'logs' && (
                  <div className="space-y-4">
                    {readyDisabled && unfinishedParents.length > 0 && <WarningBanner message={`Ready disabled: ${unfinishedParents.length} parent task${unfinishedParents.length > 1 ? 's' : ''} not done`} />}
                    {showUpdatePanel && <TaskUpdatePanel task={task} onUpdate={onUpdateTask} isSaving={isUpdating} showTitleField={showPanelChrome} />}
                    <TaskWorkerLogsPanel task={task} />
                    {hasPlannedAttachments && (
                      <CompactSection title="Planned attachments" count={task.plannedAttachments.length} data-testid="task-attachments-compact">
                        <TaskAttachmentsPlanned attachments={task.plannedAttachments} />
                      </CompactSection>
                    )}
                  </div>
                )}
                {selectedTab === 'runs' && <TaskRunHistoryPanel task={task} />}
              </div>
            </>
          )}
        </div>
      </div>

      {!isMobile && showInlineActions && (
        <div className="shrink-0 border-t border-border/50 p-2 [&_button]:!rounded-md [&_button]:!px-2.5 [&_button]:!py-2 [&_button]:!text-[11px] [&_svg]:!h-3.5 [&_svg]:!w-3.5">
          <TaskActions task={task} allTasks={allTasks} onStatusChange={onStatusChange} onBlock={onBlock} onReclaim={onReclaim} onDecompose={onDecompose} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}
