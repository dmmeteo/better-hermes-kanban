import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Edit3, ExternalLink, Loader2, Save, X } from 'lucide-react';
import type { Board, Task, TaskStatus, UpdateTaskData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { BotAvatar } from '@/components/shared/BotAvatar';
import { MarkdownText } from '@/components/shared/MarkdownText';
import { TaskDetail } from './TaskDetail';
import { MobileTaskActionBar, TaskActionsRail } from './TaskActionsRail';

function TaskDetailPageBody({ value }: { value: string }) {
  return <MarkdownText value={value} className="text-sm leading-relaxed" />;
}

interface TaskDetailPageProps {
  task: Task | null;
  taskId: string;
  allTasks: Task[];
  activeBoard: Board;
  onBack: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onAddComment: (text: string) => void;
  onBlock: () => void;
  onReclaim: () => void;
  onDecompose: () => void;
  onDelete: () => void;
  onUpdateTask: (patch: UpdateTaskData) => Promise<void> | void;
  isUpdating?: boolean;
  isMobile?: boolean;
}

export function TaskDetailPage({
  task,
  taskId,
  allTasks,
  activeBoard,
  onBack,
  onStatusChange,
  onAddComment,
  onBlock,
  onReclaim,
  onDecompose,
  onDelete,
  onUpdateTask,
  isUpdating = false,
  isMobile = false,
}: TaskDetailPageProps) {
  const [isEditingDocument, setIsEditingDocument] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task?.title || '');
  const [draftDescription, setDraftDescription] = useState(task?.description || '');

  useEffect(() => {
    if (!isEditingDocument) {
      setDraftTitle(task?.title || '');
      setDraftDescription(task?.description || '');
    }
  }, [isEditingDocument, task]);

  const trimmedTitle = draftTitle.trim();
  const isDirty = useMemo(() => {
    if (!task) return false;
    return trimmedTitle !== task.title || draftDescription !== task.description;
  }, [draftDescription, task, trimmedTitle]);
  const canSave = Boolean(task && isDirty && trimmedTitle && !isUpdating);

  const startEditing = () => {
    if (!task) return;
    setDraftTitle(task.title);
    setDraftDescription(task.description);
    setIsEditingDocument(true);
  };

  const cancelEditing = () => {
    setDraftTitle(task?.title || '');
    setDraftDescription(task?.description || '');
    setIsEditingDocument(false);
  };

  const saveDocumentFields = async () => {
    if (!task || !canSave) return;
    const patch: UpdateTaskData = {};
    if (trimmedTitle !== task.title) patch.title = trimmedTitle;
    if (draftDescription !== task.description) patch.description = draftDescription;
    try {
      await onUpdateTask(patch);
      setIsEditingDocument(false);
    } catch {
      // Parent update handler owns the error toast and keeps the previous task in local state.
    }
  };

  if (!task) {
    return (
      <section className="h-full overflow-y-auto bg-background" data-testid="task-detail-page-empty">
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="rounded-full border border-border/70 bg-card/60 p-4 text-muted-foreground">
            <ExternalLink size={24} />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Task page</p>
            <h1 className="text-2xl font-bold">Task {taskId} is not on this board</h1>
            <p className="max-w-md text-sm text-muted-foreground">
              Switch board or return to the board context. Direct task links resolve their board from task data, without a board query parameter.
            </p>
          </div>
          <Button onClick={onBack} className="gap-2">
            <ArrowLeft size={16} />
            Back to board
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="h-full overflow-y-auto bg-background" data-testid="task-detail-page">
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-4 px-3 pb-24 pt-3 md:px-6 md:py-5 lg:pb-5">
        <div className="rounded-2xl border border-border/70 bg-card/70 px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)] md:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <Button variant="ghost" size="sm" className="-ml-2 h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={onBack} data-testid="task-page-back">
                  <ArrowLeft size={14} />
                  Board
                </Button>
                <span className="text-border">/</span>
                <a
                  href={`/tasks/${encodeURIComponent(task.id)}`}
                  className="font-mono rounded bg-secondary/80 px-2 py-0.5 transition-colors hover:text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid="task-page-id-link"
                >
                  {task.id}
                </a>
                <span>on {activeBoard.name || activeBoard.id}</span>
              </div>
              <div data-testid="task-page-title-slot">
                {isEditingDocument ? (
                  <input
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    className="w-full rounded-xl border border-border bg-background/70 px-3 py-2 text-2xl font-bold leading-tight outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 md:text-3xl"
                    aria-label="Task title"
                    data-testid="task-page-title-input"
                  />
                ) : (
                  <h1 className="max-w-4xl text-2xl font-bold leading-tight tracking-[-0.02em] md:text-3xl">{task.title}</h1>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
              <BotAvatar name={task.assignee} />
              {isEditingDocument ? (
                <>
                  <Button variant="outline" size="sm" className="h-8 gap-2" onClick={cancelEditing} disabled={isUpdating} data-testid="task-page-edit-cancel">
                    <X size={14} />
                    Cancel
                  </Button>
                  <Button size="sm" className="h-8 gap-2" onClick={saveDocumentFields} disabled={!canSave} data-testid="task-page-edit-save">
                    {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" className="h-8 gap-2" onClick={startEditing} data-testid="task-page-edit">
                  <Edit3 size={14} />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid min-h-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-4">
            <div className="rounded-2xl border border-border/70 bg-card/45 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.12)]" data-testid="task-page-body-card">
              {isEditingDocument ? (
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Body</label>
                  <textarea
                    value={draftDescription}
                    onChange={(event) => setDraftDescription(event.target.value)}
                    rows={10}
                    className="custom-scrollbar w-full resize-y rounded-xl border border-border bg-background/75 px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                    placeholder="Describe this task… Markdown is supported."
                    aria-label="Task body"
                    data-testid="task-page-body-input"
                  />
                  <p className="text-[11px] text-muted-foreground">Markdown-friendly body edit. Save is enabled after a valid change.</p>
                </div>
              ) : task.description ? (
                <TaskDetailPageBody value={task.description} />
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                  No body yet. Use Edit to add a task description.
                </div>
              )}
            </div>

            <div className="min-h-0 self-start overflow-hidden rounded-2xl border border-border/70 bg-card/40 shadow-[0_18px_60px_rgba(0,0,0,0.14)]">
              <TaskDetail
                task={task}
                allTasks={allTasks}
                isMobile={isMobile}
                onBack={onBack}
                onStatusChange={onStatusChange}
                onAddComment={onAddComment}
                onBlock={onBlock}
                onReclaim={onReclaim}
                onDecompose={onDecompose}
                onDelete={onDelete}
                onUpdateTask={onUpdateTask}
                isUpdating={isUpdating}
                chrome="page"
                showDescription={false}
                showUpdatePanel={false}
                showInlineActions={false}
              />
            </div>
          </div>

          <TaskActionsRail
            task={task}
            allTasks={allTasks}
            activeBoard={activeBoard}
            onStatusChange={onStatusChange}
            onBlock={onBlock}
            onReclaim={onReclaim}
            onDecompose={onDecompose}
            onDelete={onDelete}
          />
        </div>
      </div>
      <MobileTaskActionBar
        task={task}
        allTasks={allTasks}
        activeBoard={activeBoard}
        onStatusChange={onStatusChange}
        onBlock={onBlock}
        onReclaim={onReclaim}
        onDecompose={onDecompose}
        onDelete={onDelete}
      />
    </section>
  );
}
