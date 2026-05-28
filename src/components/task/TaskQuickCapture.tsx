import { useState } from 'react';
import { Bot, ChevronDown } from 'lucide-react';
import type { BotProfile, CreateTaskData, Priority, TaskStatus } from '@/lib/types';
import type { BoardSettings } from '@/lib/boardSettings';
import { getStatusOptions } from '@/lib/boardSettings';
import { BOT_PROFILES, CREATE_TASK_STATUSES, STATUS_COLORS } from '@/lib/types';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TaskQuickCaptureProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: CreateTaskData) => void | Promise<void>;
  assignees?: BotProfile[];
  isSubmitting?: boolean;
  boardName?: string;
  isMobile?: boolean;
  boardSettings: BoardSettings;
}

const priorityOptions: { value: Priority; label: string; color: string }[] = [
  { value: 'p0', label: 'P0 - Critical', color: '#DC2626' },
  { value: 'p1', label: 'P1 - High', color: '#EA580C' },
  { value: 'p2', label: 'P2 - Medium', color: '#2563EB' },
  { value: 'p3', label: 'P3 - Low', color: '#6B7280' },
];

export function TaskQuickCapture({ open, onClose, onCreate, assignees = BOT_PROFILES, isSubmitting = false, boardName, isMobile = false, boardSettings }: TaskQuickCaptureProps) {
  const statusOptions: { value: TaskStatus; label: string; color: string }[] = getStatusOptions(boardSettings, CREATE_TASK_STATUSES).map((option) => ({
    ...option,
    color: STATUS_COLORS[option.value],
  }));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('p2');
  const [assignee, setAssignee] = useState<string>('');
  const [status, setStatus] = useState<TaskStatus>('triage');
  const [workspaceKind, setWorkspaceKind] = useState<CreateTaskData['workspaceKind']>('scratch');
  const [workspacePath, setWorkspacePath] = useState('');
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (workspacePath.trim() && !workspacePath.trim().startsWith('/')) {
      toast.error('Workspace path must be absolute');
      return;
    }
    await onCreate({
      title: title.trim(),
      description: description.trim(),
      priority,
      assignee: assignee || null,
      status,
      workspaceKind,
      workspacePath: workspacePath.trim() || undefined,
    });
    // Reset form
    setTitle('');
    setDescription('');
    setPriority('p2');
    setAssignee('');
    setStatus('triage');
    setWorkspaceKind('scratch');
    setWorkspacePath('');
  };

  const formContent = (
    <div className="space-y-4">
      {boardName && (
        <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-muted-foreground">
          Creating on real board: <span className="text-foreground">{boardName}</span>
        </div>
      )}
      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/50"
          autoFocus
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add context or link..."
          rows={3}
          className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all resize-none placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Assignee */}
      <div className="space-y-1.5 relative">
        <label className="text-xs font-medium text-muted-foreground">Assignee / Profile</label>
        <button
          onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
          className="w-full flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2.5 text-sm hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Bot size={14} className="text-primary" />
            <span>{assignee ? `Bot: ${assignee}` : 'Auto / no assignee'}</span>
          </div>
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>
        {showAssigneeDropdown && (
          <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
            <button
              onClick={() => { setAssignee(''); setShowAssigneeDropdown(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <span className="text-muted-foreground">Auto / no assignee</span>
            </button>
            {assignees.map((bot) => (
              <button
                key={bot.id}
                onClick={() => { setAssignee(bot.name); setShowAssigneeDropdown(false); }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors',
                  assignee === bot.name && 'bg-accent'
                )}
              >
                <Bot size={14} className="text-primary" />
                <span>Bot: {bot.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Priority */}
      <div className="space-y-1.5 relative">
        <label className="text-xs font-medium text-muted-foreground">Priority</label>
        <button
          onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
          className="w-full flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2.5 text-sm hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: priorityOptions.find((p) => p.value === priority)?.color }}
            />
            <span>{priorityOptions.find((p) => p.value === priority)?.label}</span>
          </div>
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>
        {showPriorityDropdown && (
          <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
            {priorityOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => { setPriority(option.value); setShowPriorityDropdown(false); }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors',
                  priority === option.value && 'bg-accent'
                )}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: option.color }} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Workspace */}
      <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Workspace</label>
          <select
            value={workspaceKind}
            onChange={(event) => setWorkspaceKind(event.target.value as CreateTaskData['workspaceKind'])}
            className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
          >
            <option value="scratch">Scratch</option>
            <option value="dir">Shared dir</option>
            <option value="worktree">Worktree</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Path (optional)</label>
          <input
            type="text"
            value={workspacePath}
            onChange={(event) => setWorkspacePath(event.target.value)}
            placeholder="/absolute/path or board default"
            className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      {/* Status */}
      <div className="space-y-1.5 relative">
        <label className="text-xs font-medium text-muted-foreground">Status</label>
        <button
          onClick={() => setShowStatusDropdown(!showStatusDropdown)}
          className="w-full flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2.5 text-sm hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: statusOptions.find((s) => s.value === status)?.color }}
            />
            <span>{statusOptions.find((s) => s.value === status)?.label}</span>
          </div>
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>
        {showStatusDropdown && (
          <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => { setStatus(option.value); setShowStatusDropdown(false); }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors',
                  status === option.value && 'bg-accent'
                )}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: option.color }} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create button */}
      <button
        onClick={handleCreate}
        disabled={!title.trim() || isSubmitting}
        className="w-full py-3 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ backgroundColor: '#7C5CFF' }}
      >
        {isSubmitting ? 'Creating...' : 'Create task'}
      </button>
    </div>
  );

  // Mobile: Sheet
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <SheetContent side="bottom" className="h-[90vh] p-0 bg-background border-t border-border rounded-t-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <span className="text-sm font-semibold">Quick capture</span>
            <div className="w-12" />
          </div>
          <div className="px-4 py-4 overflow-y-auto h-[calc(90vh-60px)]">
            {formContent}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Dialog
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[480px] p-0 bg-background border border-border">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base">Quick capture</DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-6">
          {formContent}
        </div>
      </DialogContent>
    </Dialog>
  );
}
