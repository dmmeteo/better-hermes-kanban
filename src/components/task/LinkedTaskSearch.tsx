import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import type { TaskSearchResult } from '@/lib/types';
import { kanbanApi } from '@/lib/kanbanApi';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface LinkedTaskSearchProps {
  /** Restrict the search to a single board. */
  boardId?: string;
  /** Called when a (non-disabled) result is picked. May be async. */
  onSelect: (result: TaskSearchResult) => void | Promise<void>;
  /** Return a reason string to disable a result, or null to allow it. */
  isDisabled?: (result: TaskSearchResult) => string | null;
  placeholder?: string;
  /** Suffix for data-testid hooks so multiple instances stay distinguishable. */
  testIdSuffix?: string;
}

/**
 * Presentational task search used both by the task-detail linked-tasks tab and
 * the create-task modal. It knows how to search and render results; what to do
 * with a picked result is up to the caller via `onSelect`.
 */
export function LinkedTaskSearch({
  boardId,
  onSelect,
  isDisabled,
  placeholder = 'Search task id, title, or body…',
  testIdSuffix = '',
}: LinkedTaskSearchProps) {
  const suffix = testIdSuffix ? `-${testIdSuffix}` : '';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TaskSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
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
        board: boardId || undefined,
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

  const pick = async (result: TaskSearchResult) => {
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
      setResults([]);
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
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void runSearch();
            }
          }}
          placeholder={placeholder}
          data-testid={`linked-task-search-input${suffix}`}
        />
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
      </div>
      {message && (
        <p className="text-xs text-muted-foreground" data-testid="linked-task-search-message">
          {message}
        </p>
      )}
      {results.length > 0 && (
        <ul className="flex flex-col">
          {results.map((result) => {
            const reason = isDisabled?.(result);
            return (
              <li key={`${result.boardId}-${result.id}`}>
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
