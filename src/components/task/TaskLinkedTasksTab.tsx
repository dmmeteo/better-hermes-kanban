import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Link2, Loader2, Plus, Search } from 'lucide-react';
import type { LinkedTask, Task, TaskSearchResult } from '@/lib/types';
import { kanbanApi } from '@/lib/kanbanApi';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type LinkRelation = 'parent' | 'child';

interface TaskLinkedTasksTabProps {
  task: Task;
  onLinkTask: (targetTaskId: string, relation: LinkRelation) => Promise<void> | void;
}

export function TaskLinkedTasksTab({ task, onLinkTask }: TaskLinkedTasksTabProps) {
  const parents = useMemo(() => task.linkedTasks.filter((link) => link.relation === 'parent'), [task.linkedTasks]);
  const children = useMemo(() => task.linkedTasks.filter((link) => link.relation === 'child'), [task.linkedTasks]);

  return (
    <section className="space-y-4" data-testid="task-linked-tasks-tab">
      <LinkedTaskGroup task={task} title="Dependencies / parents" helpText="Selected task becomes a parent of this task." relation="parent" links={parents} onLinkTask={onLinkTask} />
      <LinkedTaskGroup task={task} title="Dependents / children" helpText="Selected task becomes a child of this task." relation="child" links={children} onLinkTask={onLinkTask} />
    </section>
  );
}

function LinkedTaskGroup({ task, title, helpText, relation, links, onLinkTask }: { task: Task; title: string; helpText: string; relation: LinkRelation; links: LinkedTask[]; onLinkTask: TaskLinkedTasksTabProps['onLinkTask'] }) {
  const [open, setOpen] = useState(false);
  const existingIds = new Set(links.map((link) => link.taskId.toLowerCase()));

  return (
    <div className="rounded-2xl border border-border/60 bg-background/35 p-3" data-testid={`linked-tasks-${relation}-group`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {relation === 'parent' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
            {title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{helpText}</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setOpen((value) => !value)} data-testid={`linked-tasks-add-${relation}`}>
          <Plus size={14} /> add task
        </Button>
      </div>

      {links.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          {links.map((link) => <LinkedTaskRow key={link.id} link={link} />)}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
          <Link2 size={18} className="mx-auto mb-2 opacity-45" />
          No {relation === 'parent' ? 'dependencies' : 'dependents'} linked yet.
        </div>
      )}

      {open && <AddLinkedTaskSearch task={task} relation={relation} existingIds={existingIds} onLinkTask={onLinkTask} />}
    </div>
  );
}

function LinkedTaskRow({ link }: { link: LinkedTask }) {
  return (
    <a href={`/tasks/${encodeURIComponent(link.taskId)}${link.boardId ? `?board=${encodeURIComponent(link.boardId)}` : ''}`} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/70 p-2.5 transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="linked-task-row">
      <span className="min-w-0 text-sm">
        <span className="font-mono text-[11px] text-muted-foreground">[{link.taskId}]</span>{' '}
        <span className="truncate">{link.title}</span>
      </span>
      <StatusBadge status={link.status} size="sm" />
    </a>
  );
}

function AddLinkedTaskSearch({ task, relation, existingIds, onLinkTask }: { task: Task; relation: LinkRelation; existingIds: Set<string>; onLinkTask: TaskLinkedTasksTabProps['onLinkTask'] }) {
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
      const response = await kanbanApi.searchTasks({ q: trimmed, board: task.boardId || undefined, limit: 8, sort: 'relevance' });
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
      setMessage(`Linked ${id} as ${relation === 'parent' ? 'a dependency' : 'a dependent'}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Link failed');
    } finally {
      setIsLinkingId(null);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-border/60 bg-card/70 p-3" data-testid={`linked-tasks-search-${relation}`}>
      <div className="flex gap-2">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && runSearch()} placeholder="Search task id, title, or body…" data-testid={`linked-tasks-search-input-${relation}`} />
        <Button type="button" variant="secondary" onClick={runSearch} disabled={isSearching} data-testid={`linked-tasks-search-submit-${relation}`}>
          {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        </Button>
      </div>
      {message && <p className="mt-2 text-xs text-muted-foreground" data-testid="linked-tasks-search-message">{message}</p>}
      {results.length > 0 && (
        <div className="mt-3 space-y-2">
          {results.map((result) => {
            const self = result.id.toLowerCase() === task.id.toLowerCase();
            const duplicate = existingIds.has(result.id.toLowerCase());
            return (
              <button key={`${result.boardId}-${result.id}`} type="button" onClick={() => selectResult(result)} disabled={self || duplicate || isLinkingId === result.id} className={cn('w-full rounded-xl border border-border/60 bg-background/70 p-2.5 text-left text-sm transition-colors hover:bg-accent/60 disabled:cursor-not-allowed disabled:opacity-60')} data-testid="linked-tasks-search-result">
                <span className="flex items-center justify-between gap-2">
                  <span className="min-w-0"><span className="font-mono text-[11px] text-muted-foreground">[{result.id}]</span> {result.title}</span>
                  <StatusBadge status={result.status} size="sm" />
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{self ? 'Current task — cannot link to itself' : duplicate ? 'Already linked in this group' : result.snippet || result.body || 'Select to add this link'}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
