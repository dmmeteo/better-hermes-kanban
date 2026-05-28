import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import type { LinkedTask, Task, TaskSearchResult } from '@/lib/types';
import { kanbanApi } from '@/lib/kanbanApi';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

type LinkRelation = 'parent' | 'child';

interface TaskLinkedTasksTabProps {
  task: Task;
  onLinkTask: (targetTaskId: string, relation: LinkRelation) => Promise<void> | void;
  onUnlinkTask: (link: LinkedTask) => Promise<void>;
}

export function TaskLinkedTasksTab({ task, onLinkTask, onUnlinkTask }: TaskLinkedTasksTabProps) {
  const parents = useMemo(() => task.linkedTasks.filter((link) => link.relation === 'parent'), [task.linkedTasks]);
  const children = useMemo(() => task.linkedTasks.filter((link) => link.relation === 'child'), [task.linkedTasks]);
  const [pendingUnlink, setPendingUnlink] = useState<LinkedTask | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  const confirmUnlink = async () => {
    if (!pendingUnlink) return;
    setUnlinking(true);
    try {
      await onUnlinkTask(pendingUnlink);
      toast.success(`Removed link to ${pendingUnlink.taskId}`);
      setPendingUnlink(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove link';
      toast.error(message);
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <section className="space-y-5" data-testid="task-linked-tasks-tab">
      <LinkedTaskGroup
        task={task}
        title="Parents"
        helpText="Selected task becomes a parent of this task."
        relation="parent"
        links={parents}
        onLinkTask={onLinkTask}
        onRequestUnlink={setPendingUnlink}
      />
      <LinkedTaskGroup
        task={task}
        title="Children"
        helpText="Selected task becomes a child of this task."
        relation="child"
        links={children}
        onLinkTask={onLinkTask}
        onRequestUnlink={setPendingUnlink}
      />

      <AlertDialog open={!!pendingUnlink} onOpenChange={(open) => !open && !unlinking && setPendingUnlink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove the link to {pendingUnlink?.taskId}?</AlertDialogTitle>
            <AlertDialogDescription>
              You can add it again later if you need to.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlinking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmUnlink();
              }}
              disabled={unlinking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {unlinking ? 'Removing…' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function LinkedTaskGroup({
  task,
  title,
  helpText,
  relation,
  links,
  onLinkTask,
  onRequestUnlink,
}: {
  task: Task;
  title: string;
  helpText: string;
  relation: LinkRelation;
  links: LinkedTask[];
  onLinkTask: TaskLinkedTasksTabProps['onLinkTask'];
  onRequestUnlink: (link: LinkedTask) => void;
}) {
  const [adding, setAdding] = useState(false);
  const existingIds = new Set(links.map((link) => link.taskId.toLowerCase()));
  const hasLinks = links.length > 0;

  return (
    <div className="space-y-2" data-testid={`linked-tasks-${relation}-group`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {relation === 'parent' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          <span className="truncate">{title}</span>
          {!hasLinks && (
            <span className="rounded-full bg-secondary/60 px-1.5 py-0.5 text-[10px] tracking-normal text-muted-foreground">none</span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-[11px]"
          onClick={() => setAdding((v) => !v)}
          data-testid={`linked-tasks-add-${relation}`}
        >
          <Plus size={12} /> {adding ? 'cancel' : 'add'}
        </Button>
      </div>

      {hasLinks && (
        <ul className="flex flex-col" data-testid={`linked-tasks-${relation}-list`}>
          {links.map((link) => (
            <LinkedTaskRow key={link.id} link={link} onRequestUnlink={onRequestUnlink} />
          ))}
        </ul>
      )}

      {adding && (
        <AddLinkedTaskSearch
          task={task}
          relation={relation}
          existingIds={existingIds}
          onLinkTask={onLinkTask}
          onDone={() => setAdding(false)}
        />
      )}

      {!hasLinks && !adding && (
        <p className="px-1 text-[11px] text-muted-foreground/80">{helpText}</p>
      )}
    </div>
  );
}

function LinkedTaskRow({ link, onRequestUnlink }: { link: LinkedTask; onRequestUnlink: (link: LinkedTask) => void }) {
  return (
    <li
      className="group flex items-center gap-2 border-b border-border/30 py-2 transition-colors last:border-b-0 hover:bg-accent/30"
      data-testid="linked-task-row"
    >
      <a
        href={`/tasks/${encodeURIComponent(link.taskId)}`}
        className="flex min-w-0 flex-1 items-center gap-2 truncate text-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="rounded bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {link.taskId}
        </span>
        <span className="min-w-0 flex-1 truncate">{link.title}</span>
      </a>
      <StatusBadge status={link.status} size="sm" />
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRequestUnlink(link);
        }}
        className={cn(
          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-destructive/15 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100',
        )}
        aria-label={`Remove link to ${link.taskId}`}
        title={`Remove link to ${link.taskId}`}
        data-testid="linked-task-unlink"
      >
        <X size={14} />
      </button>
    </li>
  );
}

function AddLinkedTaskSearch({
  task,
  relation,
  existingIds,
  onLinkTask,
  onDone,
}: {
  task: Task;
  relation: LinkRelation;
  existingIds: Set<string>;
  onLinkTask: TaskLinkedTasksTabProps['onLinkTask'];
  onDone: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TaskSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLinkingId, setIsLinkingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const runSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setMessage('Type a task id, title, or body text to search.');
      return;
    }
    setIsSearching(true);
    setMessage(null);
    try {
      const response = await kanbanApi.searchTasks({
        q: trimmed,
        board: task.boardId || undefined,
        limit: 8,
        sort: 'relevance',
      });
      setResults(response.results);
      if (response.results.length === 0) setMessage('No matching tasks found by id, title, or body.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const selectResult = async (result: TaskSearchResult) => {
    const id = result.id;
    if (id.toLowerCase() === task.id.toLowerCase()) {
      setMessage('Cannot link a task to itself.');
      return;
    }
    if (existingIds.has(id.toLowerCase())) {
      setMessage(`${id} is already linked in this group.`);
      return;
    }
    setIsLinkingId(id);
    setMessage(null);
    try {
      await onLinkTask(id, relation);
      setQuery('');
      setResults([]);
      onDone();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Link failed');
    } finally {
      setIsLinkingId(null);
    }
  };

  return (
    <div className="space-y-2 pt-1" data-testid={`linked-tasks-search-${relation}`}>
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && runSearch()}
          placeholder="Search task id, title, or body…"
          data-testid={`linked-tasks-search-input-${relation}`}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={runSearch}
          disabled={isSearching}
          data-testid={`linked-tasks-search-submit-${relation}`}
        >
          {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        </Button>
      </div>
      {message && (
        <p className="text-xs text-muted-foreground" data-testid="linked-tasks-search-message">
          {message}
        </p>
      )}
      {results.length > 0 && (
        <ul className="flex flex-col">
          {results.map((result) => {
            const self = result.id.toLowerCase() === task.id.toLowerCase();
            const duplicate = existingIds.has(result.id.toLowerCase());
            return (
              <li key={`${result.boardId}-${result.id}`}>
                <button
                  type="button"
                  onClick={() => selectResult(result)}
                  disabled={self || duplicate || isLinkingId === result.id}
                  className="flex w-full items-center gap-2 border-b border-border/30 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-accent/30 disabled:cursor-not-allowed disabled:opacity-60"
                  data-testid="linked-tasks-search-result"
                >
                  <span className="rounded bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {result.id}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{result.title}</span>
                  <StatusBadge status={result.status} size="sm" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
