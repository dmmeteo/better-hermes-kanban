import { useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import type { TaskStatus } from '@/lib/types';
import { kanbanApi } from '@/lib/kanbanApi';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Minimal shape both Task and TaskSearchResult satisfy. */
export interface LinkedTaskCandidate {
  id: string;
  title: string;
  status: TaskStatus;
  boardId?: string;
}

export interface LinkedTaskSearchProps {
  /** Restrict the server search to a single board. */
  boardId?: string;
  /**
   * When provided, the component filters this list client-side (no network) —
   * used where the server `/search` endpoint is unavailable but the board's
   * tasks are already loaded. When omitted, it falls back to server search.
   */
  localTasks?: LinkedTaskCandidate[];
  /** Called when a (non-disabled) result is picked. May be async. */
  onSelect: (result: LinkedTaskCandidate) => void | Promise<void>;
  /** Return a reason string to disable a result, or null to allow it. */
  isDisabled?: (result: LinkedTaskCandidate) => string | null;
  placeholder?: string;
  /** Suffix for data-testid hooks so multiple instances stay distinguishable. */
  testIdSuffix?: string;
}

/**
 * Presentational task search used by the task-detail linked-tasks tab (server
 * search) and the create-task modal (client-side over loaded board tasks). It
 * knows how to find and render results; what to do with a picked result is up
 * to the caller via `onSelect`.
 */
export function LinkedTaskSearch({
  boardId,
  localTasks,
  onSelect,
  isDisabled,
  placeholder = 'Search task id, title, or body…',
  testIdSuffix = '',
}: LinkedTaskSearchProps) {
  const isLocal = !!localTasks;
  const suffix = testIdSuffix ? `-${testIdSuffix}` : '';
  const [query, setQuery] = useState('');
  const [serverResults, setServerResults] = useState<LinkedTaskCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const localResults = useMemo(() => {
    if (!isLocal) return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (localTasks ?? [])
      .filter((task) => task.id.toLowerCase().includes(q) || task.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [isLocal, localTasks, query]);

  const results = isLocal ? localResults : serverResults;
  const showEmpty = isLocal && query.trim().length > 0 && localResults.length === 0;

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
        board: boardId || undefined,
        limit: 8,
        sort: 'relevance',
      });
      setServerResults(response.results);
      if (response.results.length === 0) setMessage('No matching tasks found by id, title, or body.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const pick = async (result: LinkedTaskCandidate) => {
    const reason = isDisabled?.(result);
    if (reason) {
      setMessage(reason);
      return;
    }
    setSelectingId(result.id);
    setMessage(null);
    try {
      await onSelect(result);
      setQuery('');
      setServerResults([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to select task');
    } finally {
      setSelectingId(null);
    }
  };

  return (
    <div className="space-y-2 pt-1" data-testid={`linked-task-search${suffix}`}>
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (message) setMessage(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !isLocal) {
              event.preventDefault();
              void runSearch();
            }
          }}
          placeholder={placeholder}
          data-testid={`linked-task-search-input${suffix}`}
        />
        {!isLocal && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={runSearch}
            disabled={isSearching}
            data-testid={`linked-task-search-submit${suffix}`}
          >
            {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          </Button>
        )}
      </div>
      {(message || showEmpty) && (
        <p className="text-xs text-muted-foreground" data-testid="linked-task-search-message">
          {message ?? 'No matching tasks on this board.'}
        </p>
      )}
      {results.length > 0 && (
        <ul className="flex flex-col">
          {results.map((result) => {
            const reason = isDisabled?.(result);
            return (
              <li key={`${result.boardId ?? ''}-${result.id}`}>
                <button
                  type="button"
                  onClick={() => pick(result)}
                  disabled={!!reason || selectingId === result.id}
                  className="flex w-full items-center gap-2 border-b border-border/30 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-accent/30 disabled:cursor-not-allowed disabled:opacity-60"
                  data-testid="linked-task-search-result"
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
