import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, ArrowRight, Clock3, Link2, MessageSquare, Search, ShieldAlert, User } from 'lucide-react';
import { toast } from 'sonner';
import type { Board, BotProfile, TaskSearchResult } from '@/lib/types';
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/types';
import { kanbanApi } from '@/lib/kanbanApi';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getSearchParamValue, type DataViewSearchFilters } from '@/components/search/DataViewSearchAndFilter';

const EXACT_TASK_ID = /^t_[0-9a-f]{8}$/i;

type TaskSearchPageProps = {
  boards: Board[];
  assignees: BotProfile[];
  locationSearch: string;
  query: string;
  filters: DataViewSearchFilters;
  onQueryChange: (query: string) => void;
  onFiltersChange: (filters: DataViewSearchFilters) => void;
  onOpenTask: (taskId: string, boardId?: string) => void;
};

type SearchState = 'first-use' | 'loading' | 'ready' | 'no-results' | 'exact-id-not-found' | 'exact-id-ambiguous' | 'error';

function formatRelative(value?: string | null) {
  if (!value) return 'updated recently';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 'updated recently';
  const diff = Date.now() - time;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return 'updated now';
  if (diff < hour) return `updated ${Math.max(1, Math.round(diff / minute))}m ago`;
  if (diff < day) return `updated ${Math.round(diff / hour)}h ago`;
  return `updated ${Math.round(diff / day)}d ago`;
}

function filterValue(params: URLSearchParams, key: string) {
  return params.get(key) || '';
}

function SearchChip({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-[#7C5CFF]/70 bg-[#7C5CFF]/15 text-white shadow-[0_0_20px_rgba(124,92,255,0.15)]'
          : 'border-border/70 bg-card/60 text-muted-foreground hover:border-[#7C5CFF]/50 hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

function ResultCard({ result, onOpen }: { result: TaskSearchResult; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full rounded-2xl border border-border/70 bg-card/70 p-4 text-left shadow-[0_18px_60px_rgba(0,0,0,0.18)] outline-none transition-all hover:border-[#7C5CFF]/45 hover:bg-card focus-visible:border-[#7C5CFF] focus-visible:ring-2 focus-visible:ring-[#7C5CFF]/40"
      data-testid={`task-search-result-${result.id}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <span className="flex items-center gap-1.5 normal-case tracking-normal">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[result.status] }} />
          {STATUS_LABELS[result.status]}
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-foreground">{result.priority.toUpperCase()}</span>
        <span className="rounded-full bg-[#7C5CFF]/10 px-2 py-0.5 text-[10px] text-[#B8A7FF]">{result.boardName || result.boardId}</span>
      </div>
      <div className="mt-3 font-mono text-xs text-muted-foreground">{result.id}</div>
      <div className="mt-1 flex items-start justify-between gap-3">
        <h2 className="line-clamp-2 text-base font-semibold leading-snug text-foreground md:text-lg">{result.title}</h2>
        <span className="hidden items-center gap-1 rounded-full border border-border/70 px-2 py-1 text-xs text-muted-foreground opacity-0 transition-opacity group-focus-visible:opacity-100 group-hover:opacity-100 md:flex">
          Open <ArrowRight size={13} />
        </span>
      </div>
      <p className="mt-3 line-clamp-3 rounded-xl border border-border/50 bg-background/35 px-3 py-2 text-sm leading-relaxed text-muted-foreground">
        {result.snippet || result.latestSummary || result.body || 'No snippet returned for this match.'}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><User size={13} />{result.assignee || 'unassigned'}</span>
        <span className="flex items-center gap-1.5"><MessageSquare size={13} />{result.commentCount}</span>
        <span className="flex items-center gap-1.5"><Link2 size={13} />{result.linkCount}</span>
        <span className="flex items-center gap-1.5"><ShieldAlert size={13} />{result.warningCount}</span>
        <span className="flex items-center gap-1.5"><Clock3 size={13} />{formatRelative(result.updatedAt)}</span>
      </div>
    </button>
  );
}

export function TaskSearchPage({ boards, locationSearch, query, filters, onQueryChange, onFiltersChange, onOpenTask }: TaskSearchPageProps) {
  const urlParams = useMemo(() => new URLSearchParams(locationSearch), [locationSearch]);
  const [submittedQuery, setSubmittedQuery] = useState(filterValue(urlParams, 'q'));
  const [results, setResults] = useState<TaskSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [indexedAt, setIndexedAt] = useState<string | null>(null);
  const [source, setSource] = useState('live');
  const [state, setState] = useState<SearchState>(submittedQuery ? 'loading' : 'first-use');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const nextQuery = filterValue(urlParams, 'q');
    const nextFilters = {
      board: filterValue(urlParams, 'board'),
      status: filterValue(urlParams, 'status'),
      assignee: filterValue(urlParams, 'assignee'),
      priority: filterValue(urlParams, 'priority'),
    };
    queueMicrotask(() => {
      onQueryChange(nextQuery);
      setSubmittedQuery(nextQuery);
      onFiltersChange(nextFilters);
    });
  }, [onFiltersChange, onQueryChange, urlParams]);

  const board = filters.board || '';
  const status = filters.status || '';
  const assignee = filters.assignee || '';
  const priority = filters.priority || '';

  const syncUrl = (next: { q?: string; board?: string; status?: string; assignee?: string; priority?: string }) => {
    const params = new URLSearchParams();
    const q = next.q ?? submittedQuery;
    const b = next.board ?? board;
    const s = next.status ?? status;
    const a = next.assignee ?? assignee;
    const p = next.priority ?? priority;
    if (q) params.set('q', q);
    if (b) params.set('board', getSearchParamValue(b));
    if (s) params.set('status', getSearchParamValue(s));
    if (a) params.set('assignee', getSearchParamValue(a));
    if (p) params.set('priority', getSearchParamValue(p));
    window.history.replaceState(null, '', `/tasks${params.toString() ? `?${params.toString()}` : ''}`);
  };

  useEffect(() => {
    let cancelled = false;
    if (!submittedQuery && !board && !status && !assignee && !priority) {
      queueMicrotask(() => {
        if (cancelled) return;
        setState('first-use');
        setResults([]);
        setTotal(0);
      });
      return;
    }
    queueMicrotask(() => {
      if (cancelled) return;
      setState('loading');
      setError(null);
    });
    kanbanApi.searchTasks({
      q: submittedQuery,
      board: getSearchParamValue(board) || undefined,
      status: getSearchParamValue(status) || undefined,
      assignee: getSearchParamValue(assignee) || undefined,
      priority: getSearchParamValue(priority) || undefined,
      limit: 50,
      sort: submittedQuery ? 'relevance' : 'updated',
    })
      .then((response) => {
        if (cancelled) return;
        setResults(response.results);
        setTotal(response.total);
        setIndexedAt(response.indexedAt);
        setSource(response.source);
        const exactTaskId = submittedQuery.trim().toLowerCase();
        const exactMatches = EXACT_TASK_ID.test(exactTaskId)
          ? response.results.filter((result) => result.id.toLowerCase() === exactTaskId)
          : [];
        if (exactMatches.length === 1) {
          toast.success('Opened exact task match');
          onOpenTask(exactMatches[0].id, exactMatches[0].boardId);
          return;
        }
        if (EXACT_TASK_ID.test(exactTaskId) && exactMatches.length > 1) {
          setResults(exactMatches);
          setTotal(exactMatches.length);
          setState('exact-id-ambiguous');
        } else if (response.results.length === 0 && EXACT_TASK_ID.test(exactTaskId)) {
          setState('exact-id-not-found');
        } else {
          setState(response.results.length ? 'ready' : 'no-results');
        }
      })
      .catch((searchError) => {
        if (cancelled) return;
        setResults([]);
        setTotal(0);
        setError(searchError instanceof Error ? searchError.message : 'Search bridge unavailable');
        setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [assignee, board, onOpenTask, priority, status, submittedQuery]);

  const submit = () => {
    const nextQuery = query.trim();
    setSubmittedQuery(nextQuery);
    syncUrl({ q: nextQuery });
  };

  const clearFilters = () => {
    onFiltersChange({});
    syncUrl({ board: '', status: '', assignee: '', priority: '' });
  };

  const resultCountLabel = state === 'first-use' ? 'Ready' : state === 'loading' ? 'Searching…' : `${total} result${total === 1 ? '' : 's'}`;
  const freshness = source === 'fallback' ? 'Current-board-only fallback' : indexedAt ? formatRelative(indexedAt) : 'Live bridge';
  const scopeLabel = board ? boards.find((item) => item.id === getSearchParamValue(board))?.name || getSearchParamValue(board) : 'All boards';

  return (
    <section className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(124,92,255,0.16),transparent_34%),linear-gradient(180deg,rgba(12,15,24,0.96),rgba(8,10,16,1))]" data-testid="task-search-page">
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-5 px-4 py-4 md:px-6 md:py-6">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/55 px-4 py-3 text-xs text-muted-foreground">
          <span>{scopeLabel} · {resultCountLabel} · {freshness}</span>
        </div>

        <div className="flex-1">
          <div className="space-y-3">
            {state === 'loading' && [0, 1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-2xl border border-border/60 bg-card/45" />)}
            {state === 'first-use' && (
              <div className="rounded-3xl border border-dashed border-[#7C5CFF]/35 bg-card/45 p-8 text-center">
                <Search className="mx-auto mb-4 text-[#B8A7FF]" size={34} />
                <h2 className="text-xl font-semibold">Start with the header search</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">Search by task id, title, body, summary, comment, assignee, or status.</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {['t_ae86dc88', 'blocked', 'designer', 'review-required'].map((example) => <SearchChip key={example} onClick={() => { onQueryChange(example); setSubmittedQuery(example); syncUrl({ q: example }); }}>{example}</SearchChip>)}
                </div>
              </div>
            )}
            {state === 'error' && (
              <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6">
                <div className="flex items-center gap-2 font-semibold text-amber-100"><AlertTriangle size={18} />Search bridge unavailable; board data may still be visible.</div>
                <p className="mt-2 text-sm text-amber-100/75">{error}</p>
                <Button onClick={() => submit()} className="mt-4 bg-[#7C5CFF]">Retry</Button>
              </div>
            )}
            {(state === 'no-results' || state === 'exact-id-not-found') && (
              <div className="rounded-3xl border border-border/70 bg-card/55 p-8 text-center">
                <h2 className="text-xl font-semibold">{state === 'exact-id-not-found' ? `No task found for ${submittedQuery}` : 'No matching tasks'}</h2>
                <p className="mt-2 text-sm text-muted-foreground">Try clearing filters, refreshing the index, or checking an archived board.</p>
                <Button variant="outline" onClick={clearFilters} className="mt-4">Clear filters</Button>
              </div>
            )}
            {state === 'exact-id-ambiguous' && (
              <div className="rounded-3xl border border-[#7C5CFF]/35 bg-[#7C5CFF]/10 p-5">
                <h2 className="text-base font-semibold">Multiple exact task matches</h2>
                <p className="mt-1 text-sm text-muted-foreground">Choose the board copy to open for {submittedQuery}.</p>
              </div>
            )}
            {(state === 'ready' || state === 'exact-id-ambiguous') && results.map((result) => (
              <ResultCard key={`${result.boardId}-${result.id}`} result={result} onOpen={() => onOpenTask(result.id, result.boardId)} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
