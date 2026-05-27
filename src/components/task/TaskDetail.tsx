import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ChevronLeft,
  MoreHorizontal,
  MessageSquare,
  Link2,
  Activity,
  Clock,
  Paperclip,
  ChevronRight,
  X,
} from 'lucide-react';
import type { Task, TaskStatus, UpdateTaskData } from '@/lib/types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { BotAvatar } from '@/components/shared/BotAvatar';
import { WarningBanner } from '@/components/shared/WarningBanner';
import { MarkdownText } from '@/components/shared/MarkdownText';
import { TaskActions } from './TaskActions';
import { TaskComments } from './TaskComments';
import { TaskActivity } from './TaskActivity';
import { TaskRuns } from './TaskRuns';
import { TaskLinks } from './TaskLinks';
import { TaskDiagnostics } from './TaskDiagnostics';
import { TaskAttachmentsPlanned } from './TaskAttachmentsPlanned';
import { TaskUpdatePanel } from './TaskUpdatePanel';
import { isReadyDisabled, getUnfinishedParents, timeAgo } from '@/lib/utils';
import { cn } from '@/lib/utils';

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
  isUpdating = false,
  showCloseButton = false,
  chrome = 'panel',
  showUpdatePanel = true,
  showInlineActions = true,
  showDescription = true,
}: TaskDetailProps) {
  const [activeTab, setActiveTab] = useState('details');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    comments: false,
    activity: false,
    runs: false,
    links: false,
    diagnostics: false,
    attachments: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const readyDisabled = isReadyDisabled(task, allTasks);
  const unfinishedParents = readyDisabled ? getUnfinishedParents(task, allTasks) : [];
  const taskHref = `/tasks/${encodeURIComponent(task.id)}`;
  const showPanelChrome = chrome === 'panel';
  const hasLinkedTasks = task.linkedTasks.length > 0;
  const hasDiagnostics = task.diagnostics.length > 0 || task.warningCount > 0;
  const hasPlannedAttachments = task.plannedAttachments.length > 0;

  // Mobile sections
  const mobileSections = [
    {
      key: 'comments',
      label: 'Comments',
      icon: MessageSquare,
      count: task.commentCount,
    },
    {
      key: 'activity',
      label: 'Events / Activity',
      icon: Activity,
      count: task.activity.length,
    },
    {
      key: 'runs',
      label: 'Runs / History',
      icon: Clock,
      count: task.runs.length,
    },
    {
      key: 'links',
      label: 'Linked tasks',
      icon: Link2,
      count: task.linkedTasks.length,
    },
    {
      key: 'diagnostics',
      label: 'Diagnostics & warnings',
      icon: Activity,
      count: task.diagnostics.length + task.warningCount,
    },
    {
      key: 'attachments',
      label: 'Attachments (planned)',
      icon: Paperclip,
      count: task.plannedAttachments.length,
    },
  ];
  const visibleMobileSections = mobileSections.filter((section) => {
    if (section.key === 'links') return hasLinkedTasks;
    if (section.key === 'diagnostics') return hasDiagnostics;
    if (section.key === 'attachments') return hasPlannedAttachments;
    return true;
  });

  const hasDetailsContent = showUpdatePanel || readyDisabled || hasLinkedTasks || hasDiagnostics || hasPlannedAttachments;
  const desktopTabs = useMemo(
    () => [
      ...(hasDetailsContent ? [{ key: 'details', label: 'Details', count: null }] : []),
      { key: 'activity', label: 'Activity', count: task.activity.length },
      { key: 'runs', label: 'Runs', count: task.runs.length },
      { key: 'comments', label: 'Comments', count: task.commentCount },
    ],
    [hasDetailsContent, task.activity.length, task.commentCount, task.runs.length]
  );
  const selectedTab = desktopTabs.some((tab) => tab.key === activeTab) ? activeTab : desktopTabs[0]?.key;

  useEffect(() => {
    if (!desktopTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(desktopTabs[0]?.key || 'comments');
    }
  }, [activeTab, desktopTabs]);

  return (
    <div className={cn('flex h-full min-h-0 flex-col', isMobile ? 'bg-background' : '')}>
      {/* Header */}
      {showPanelChrome && (
        <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border/50">
          {isMobile && onBack && (
            <button onClick={onBack} className="p-1 -ml-1 rounded-lg hover:bg-accent transition-colors" aria-label="Back to board">
              <ChevronLeft size={20} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <a
              href={taskHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded transition-colors hover:text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Open task ${task.id} in a new tab`}
              data-testid="task-detail-id-link"
            >
              {task.id}
            </a>
          </div>
          <div className="flex-1" />
          <StatusBadge status={task.status} />
          <button className="p-1.5 rounded-lg hover:bg-accent transition-colors" aria-label="More task actions">
            <MoreHorizontal size={16} className="text-muted-foreground" />
          </button>
          {showCloseButton && onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors"
              aria-label="Close task detail"
              data-testid="task-detail-close"
            >
              <X size={16} className="text-muted-foreground" />
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 py-4 space-y-5">
          {showPanelChrome && (
            <>
              {/* Title */}
              <div className="space-y-1">
                <div className="flex items-start gap-2">
                  <h2 className="text-lg font-bold leading-tight flex-1">{task.title}</h2>
                  <PriorityBadge priority={task.priority} />
                </div>
              </div>
            </>
          )}

          {/* Description */}
          {showDescription && task.description && (
            <div className="rounded-xl border border-border/60 bg-card/50 p-3.5">
              <MarkdownText value={task.description} />
            </div>
          )}

          {/* Meta grid */}
          {showPanelChrome && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Status
                </label>
                <div className="flex items-center gap-2">
                  <StatusBadge status={task.status} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Priority
                </label>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={task.priority} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Assignee / Profile
                </label>
                <BotAvatar name={task.assignee} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Comments
                </label>
                <span className="text-sm">{task.commentCount}</span>
              </div>
            </div>
          )}

          {/* Latest summary */}
          {task.latestSummary && (
            <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Latest summary
                </span>
                {task.summaryUpdatedAt && (
                  <span className="text-[10px] text-muted-foreground">
                    {timeAgo(task.summaryUpdatedAt)}
                  </span>
                )}
              </div>
              <MarkdownText value={task.latestSummary} compact className="text-xs text-foreground" />
            </div>
          )}

          {/* MOBILE: Expandable sections */}
          {isMobile && (
            <>
              {/* Dependency warning */}
              {readyDisabled && unfinishedParents.length > 0 && (
                <WarningBanner
                  message={`Ready disabled: ${unfinishedParents.length} parent task${unfinishedParents.length > 1 ? 's' : ''} not done`}
                />
              )}

              {/* Expandable list */}
              <div className="space-y-1">
                {visibleMobileSections.map((section) => (
                  <div key={section.key}>
                    <button
                      onClick={() => toggleSection(section.key)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <section.icon size={16} className="text-muted-foreground" />
                        <span className="text-xs font-medium">{section.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">{section.count}</span>
                        <ChevronRight
                          size={14}
                          className={cn(
                            'text-muted-foreground transition-transform',
                            expandedSections[section.key] && 'rotate-90'
                          )}
                        />
                      </div>
                    </button>
                    {expandedSections[section.key] && (
                      <div className="px-3 py-2 ml-6 rounded-lg bg-background/35">
                        {section.key === 'comments' && (
                          <TaskComments comments={task.comments} onAddComment={onAddComment} />
                        )}
                        {section.key === 'activity' && <TaskActivity activity={task.activity} />}
                        {section.key === 'runs' && <TaskRuns runs={task.runs} />}
                        {section.key === 'links' && <TaskLinks linkedTasks={task.linkedTasks} />}
                        {section.key === 'diagnostics' && (
                          <TaskDiagnostics diagnostics={task.diagnostics} warningCount={task.warningCount} />
                        )}
                        {section.key === 'attachments' && (
                          <TaskAttachmentsPlanned attachments={task.plannedAttachments} />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {showUpdatePanel && (
                <TaskUpdatePanel
                  task={task}
                  onUpdate={onUpdateTask}
                  isSaving={isUpdating}
                  showTitleField={showPanelChrome}
                />
              )}

              {/* Actions */}
              {showInlineActions && (
                <TaskActions
                  task={task}
                  allTasks={allTasks}
                  onStatusChange={onStatusChange}
                  onBlock={onBlock}
                  onReclaim={onReclaim}
                  onDecompose={onDecompose}
                  onDelete={onDelete}
                />
              )}
            </>
          )}

          {/* DESKTOP: Tabs */}
          {!isMobile && (
            <>
              {/* Tab bar */}
              <div className="flex items-center gap-0 border-b border-border/50">
                {desktopTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'px-3 py-2 text-xs font-medium transition-colors relative',
                      activeTab === tab.key
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span>{tab.label}</span>
                    {typeof tab.count === 'number' && tab.count > 0 && (
                      <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {tab.count}
                      </span>
                    )}
                    {activeTab === tab.key && (
                      <div
                        className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                        style={{ backgroundColor: '#7C5CFF' }}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="pt-2">
                {selectedTab === 'details' && (
                  <div className="space-y-4">
                    {/* Dependency gating */}
                    {readyDisabled && unfinishedParents.length > 0 && (
                      <WarningBanner
                        message={`Ready disabled: ${unfinishedParents.length} parent task${unfinishedParents.length > 1 ? 's' : ''} not done`}
                      />
                    )}

                    {showUpdatePanel && (
                      <TaskUpdatePanel
                        task={task}
                        onUpdate={onUpdateTask}
                        isSaving={isUpdating}
                        showTitleField={showPanelChrome}
                      />
                    )}

                    {hasLinkedTasks && (
                      <CompactSection title="Linked tasks" count={task.linkedTasks.length}>
                        <TaskLinks linkedTasks={task.linkedTasks} />
                      </CompactSection>
                    )}

                    {hasDiagnostics && (
                      <CompactSection title="Diagnostics" count={task.diagnostics.length + task.warningCount}>
                        <TaskDiagnostics diagnostics={task.diagnostics} warningCount={task.warningCount} />
                      </CompactSection>
                    )}

                    {hasPlannedAttachments && (
                      <CompactSection title="Planned attachments" count={task.plannedAttachments.length}>
                        <TaskAttachmentsPlanned attachments={task.plannedAttachments} />
                      </CompactSection>
                    )}
                  </div>
                )}

                {selectedTab === 'activity' && <TaskActivity activity={task.activity} />}
                {selectedTab === 'runs' && <TaskRuns runs={task.runs} />}
                {selectedTab === 'comments' && (
                  <TaskComments comments={task.comments} onAddComment={onAddComment} />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Desktop: Bottom action bar */}
      {!isMobile && showInlineActions && (
        <div className="shrink-0 border-t border-border/50 p-3 space-y-2">
          <TaskActions
            task={task}
            allTasks={allTasks}
            onStatusChange={onStatusChange}
            onBlock={onBlock}
            onReclaim={onReclaim}
            onDecompose={onDecompose}
            onDelete={onDelete}
          />
        </div>
      )}
    </div>
  );
}

function CompactSection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border/60 bg-background/35 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h4>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}
