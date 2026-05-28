import { useState } from 'react';
import {
  ChevronLeft,
  MoreHorizontal,
  MessageSquare,
  Link2,
  Activity,
  Clock,
  Paperclip,
  ChevronRight,
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

  // Desktop tabs
  const desktopTabs = [
    { key: 'details', label: 'Details' },
    { key: 'activity', label: `Activity ${task.activity.length}` },
    { key: 'runs', label: `Runs ${task.runs.length}` },
    { key: 'comments', label: `Comments ${task.commentCount}` },
  ];

  return (
    <div className={cn('h-full flex flex-col', isMobile ? 'bg-background' : '')}>
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border/50">
        {isMobile && onBack && (
          <button onClick={onBack} className="p-1 -ml-1 rounded-lg hover:bg-accent transition-colors">
            <ChevronLeft size={20} />
          </button>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">
            {task.id}
          </span>
        </div>
        <div className="flex-1" />
        <StatusBadge status={task.status} />
        <button className="p-1.5 rounded-lg hover:bg-accent transition-colors">
          <MoreHorizontal size={16} className="text-muted-foreground" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 space-y-5">
          {/* Title */}
          <div className="space-y-1">
            <div className="flex items-start gap-2">
              <h2 className="text-lg font-bold leading-tight flex-1">{task.title}</h2>
              <PriorityBadge priority={task.priority} />
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div className="rounded-xl border border-border/60 bg-card/50 p-3.5">
              <MarkdownText value={task.description} />
            </div>
          )}

          {/* Meta grid */}
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
                {mobileSections.map((section) => (
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
                      <div className="px-3 py-2 ml-6">
                        {section.key === 'comments' && (
                          <TaskComments comments={task.comments} onAddComment={onAddComment} />
                        )}
                        {section.key === 'activity' && <TaskActivity activity={task.activity} />}
                        {section.key === 'runs' && <TaskRuns runs={task.runs} />}
                        {section.key === 'links' && <TaskLinks linkedTasks={task.linkedTasks} />}
                        {section.key === 'diagnostics' && (
                          <TaskDiagnostics diagnostics={task.diagnostics} />
                        )}
                        {section.key === 'attachments' && (
                          <TaskAttachmentsPlanned attachments={task.plannedAttachments} />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <TaskUpdatePanel task={task} onUpdate={onUpdateTask} isSaving={isUpdating} />

              {/* Actions */}
              <TaskActions
                task={task}
                allTasks={allTasks}
                onStatusChange={onStatusChange}
                onBlock={onBlock}
                onReclaim={onReclaim}
                onDecompose={onDecompose}
                onDelete={onDelete}
              />
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
                    {tab.label}
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
                {activeTab === 'details' && (
                  <div className="space-y-4">
                    {/* Dependency gating */}
                    {readyDisabled && unfinishedParents.length > 0 && (
                      <WarningBanner
                        message={`Ready disabled: ${unfinishedParents.length} parent task${unfinishedParents.length > 1 ? 's' : ''} not done`}
                      />
                    )}

                    <TaskUpdatePanel task={task} onUpdate={onUpdateTask} isSaving={isUpdating} />

                    {/* Linked tasks */}
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                        Linked tasks
                      </h4>
                      <TaskLinks linkedTasks={task.linkedTasks} />
                    </div>

                    {/* Diagnostics */}
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                        Diagnostics
                      </h4>
                      <TaskDiagnostics diagnostics={task.diagnostics} />
                    </div>

                    {/* Attachments */}
                    <div>
                      <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                        Planned attachments
                      </h4>
                      <TaskAttachmentsPlanned attachments={task.plannedAttachments} />
                    </div>
                  </div>
                )}

                {activeTab === 'activity' && <TaskActivity activity={task.activity} />}
                {activeTab === 'runs' && <TaskRuns runs={task.runs} />}
                {activeTab === 'comments' && (
                  <TaskComments comments={task.comments} onAddComment={onAddComment} />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Desktop: Bottom action bar */}
      {!isMobile && (
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
