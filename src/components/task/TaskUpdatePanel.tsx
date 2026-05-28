import { useEffect, useState } from 'react';
import type { Priority, Task, TaskStatus, UpdateTaskData } from '@/lib/types';
import { PRIORITY_LABELS, SELECTABLE_TASK_STATUSES, STATUS_LABELS, isStatusReadOnly } from '@/lib/types';

const STATUS_OPTIONS: TaskStatus[] = SELECTABLE_TASK_STATUSES;
const PRIORITY_OPTIONS: Priority[] = ['p0', 'p1', 'p2', 'p3'];

function getInitialStatus(status: TaskStatus): TaskStatus {
  return isStatusReadOnly(status) ? 'ready' : status;
}

interface TaskUpdatePanelProps {
  task: Task;
  isSaving?: boolean;
  onUpdate: (patch: UpdateTaskData) => Promise<void> | void;
  showTitleField?: boolean;
}

export function TaskUpdatePanel({ task, isSaving = false, onUpdate, showTitleField = true }: TaskUpdatePanelProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [assignee, setAssignee] = useState(task.assignee || '');
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [status, setStatus] = useState<TaskStatus>(getInitialStatus(task.status));

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description);
    setAssignee(task.assignee || '');
    setPriority(task.priority);
    setStatus(getInitialStatus(task.status));
  }, [task]);

  const updateDetails = () => {
    const patch: UpdateTaskData = {};
    if (showTitleField && title.trim() !== task.title) patch.title = title.trim();
    if (description !== task.description) patch.description = description;
    if ((assignee.trim() || null) !== task.assignee) patch.assignee = assignee.trim() || null;
    if (priority !== task.priority) patch.priority = priority;
    if (Object.keys(patch).length) onUpdate(patch);
  };

  const updateStatus = () => {
    if (status !== task.status) onUpdate({ status });
  };

  const detailsChanged = (showTitleField && title.trim() !== task.title) || description !== task.description || (assignee.trim() || null) !== task.assignee || priority !== task.priority;
  const statusDisabledReason = task.status === 'running'
    ? 'Running tasks are claimed by workers; BHK cannot manually set running or move an active claim.'
    : task.status === 'done'
      ? 'Done is terminal; only metadata/title/body edits are safe here.'
      : '';

  return (
    <div className="rounded-lg border border-border bg-card/70 p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Guarded update</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">Low-risk fields only. Running status is disabled.</p>
        </div>
      </div>

      {showTitleField && (
        <div className="space-y-2">
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
          />
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Body</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full resize-y bg-background border border-border rounded-lg px-3 py-2 text-xs leading-relaxed focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Assignee</label>
          <input
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            placeholder="unassigned"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
          >
            {PRIORITY_OPTIONS.map((value) => <option key={value} value={value}>{PRIORITY_LABELS[value]}</option>)}
          </select>
        </div>
      </div>

      <button
        onClick={updateDetails}
        disabled={!detailsChanged || (showTitleField && !title.trim()) || isSaving}
        className="w-full px-3 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
      >
        Save fields
      </button>

      <div className="border-t border-border/60 pt-3 space-y-2">
        <label className="block text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status</label>
        <div className="flex gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            disabled={Boolean(statusDisabledReason) || isSaving}
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
          >
            {STATUS_OPTIONS.map((value) => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
          </select>
          <button
            onClick={updateStatus}
            disabled={Boolean(statusDisabledReason) || status === task.status || isSaving}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-card border border-border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Apply
          </button>
        </div>
        {statusDisabledReason && <p className="text-[11px] text-amber-200">{statusDisabledReason}</p>}
      </div>
    </div>
  );
}
