import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { AlertTriangle, ArrowRight, Check, Clock3, Link2, ListFilter, MessageSquare, PlusCircle, Search, ShieldAlert, User, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Board, BotProfile, Priority, TaskSearchResult } from '@/lib/types';
import { STATUS_COLORS, STATUS_LABELS, STATUS_ORDER } from '@/lib/types';
import { kanbanApi } from '@/lib/kanbanApi';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { getSearchParamValue, type DataViewSearchFilters } from '@/components/search/DataViewSearchAndFilter';

const EXACT_TASK_ID = /^t_[0-9a-f]{8}$/i;

type TaskSearchPageProps = {
  boards: Board[];
  assignees: BotProfile[];
  locationSearch: string;
  query: string;
  filters: DataViewSearchFilters;
  activeBoard: Board;
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

type SearchFilterField = {
  id: 'board' | 'status' | 'assignee' | 'priority';
  label: string;
  description?: string;
  values: Array<{ label: string; value: string }>;
};

type SearchFilterToken = {
  id: string;
  field: SearchFilterField['id'];
  label: string;
  value: string;
};

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

function FilterTokenPill({ token, onRemove }: { token: SearchFilterToken; onRemove: (field: SearchFilterField['id']) => void }) {
  return (
    <span className="inline-flex h-7 max-w-[min(15rem,52vw)] shrink-0 items-center overflow-hidden rounded-lg border border-border/70 bg-secondary/80 text-xs text-muted-foreground">
      <span className="truncate px-2 font-medium">{token.label}</span>
      <span className="min-w-0 truncate border-l border-border/70 bg-[#7C5CFF]/15 px-2 text-[#C9BEFF]">{token.value}</span>
      <button type="button" className="inline-flex h-7 w-7 shrink-0 items-center justify-center hover:text-foreground" aria-label={`Remove ${token.label}`} onClick={() => onRemove(token.field)}>
        <X size={13} />
      </button>
    </span>
  );
}

function TokenSearchAndFilter({
  query,
  tokens,
  fields,
  selectedFieldId,
  onQueryChange,
  onSubmit,
  onSelectField,
  onSelectValue,
  onRemoveToken,
  onClearAll,
}: {
  query: string;
  tokens: SearchFilterToken[];
  fields: SearchFilterField[];
  selectedFieldId?: SearchFilterField['id'];
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  onSelectField: (fieldId: SearchFilterField['id']) => void;
  onSelectValue: (fieldId: SearchFilterField['id'], value: string) => void;
  onRemoveToken: (fieldId: SearchFilterField['id']) => void;
  onClearAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const activeField = fields.find((field) => field.id === selectedFieldId);
  const hasValue = query.trim() || tokens.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setOpen(false);
            onSubmit();
          }}
          className="rounded-2xl border border-border/75 bg-card/70 p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] backdrop-blur"
          data-testid="task-token-search-filter"
        >
          <div className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl bg-background/45 px-2.5 transition focus-within:bg-background/70 focus-within:ring-2 focus-within:ring-[#7C5CFF]/35">
            <Search size={17} className="shrink-0 text-muted-foreground" />
            <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tokens.map((token) => <FilterTokenPill key={token.id} token={token} onRemove={onRemoveToken} />)}
              <input
                value={query}
                onChange={(event) => {
                  onQueryChange(event.target.value);
                  if (event.target.value.trim()) setOpen(false);
                }}
                onFocus={() => {
                  if (!query.trim()) setOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setOpen(false);
                }}
                placeholder={tokens.length ? 'Add search term or filter' : 'Search and filter tasks'}
                className="h-8 min-w-[8rem] flex-[1_1_11rem] border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground sm:min-w-[16rem]"
                aria-label="Search and filter tasks"
                role="combobox"
                aria-expanded={open}
                data-testid="task-search-input"
                autoFocus
              />
            </div>
            {hasValue ? (
              <button type="button" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Clear search and filters" onClick={onClearAll}>
                <X size={16} />
              </button>
            ) : null}
            <Button type="submit" className="h-8 shrink-0 rounded-xl bg-[#7C5CFF] px-3 text-xs font-semibold">Search</Button>
          </div>
        </form>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-[calc(100vw-2rem)] max-w-[560px] rounded-2xl border-border/80 bg-card/95 p-1.5 shadow-[0_22px_80px_rgba(0,0,0,0.35)] backdrop-blur" onOpenAutoFocus={(event) => event.preventDefault()}>
        {activeField ? (
          <div className="p-1" role="listbox" aria-label={`${activeField.label} values`}>
            <div className="mb-1 flex items-center gap-2 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <ListFilter size={14} />
              <span>{activeField.label} is</span>
            </div>
            {activeField.values.map((item) => (
              <button key={item.value || 'all'} type="button" className="flex min-h-10 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground" onClick={() => { onSelectValue(activeField.id, item.value); setOpen(false); }} role="option">
                <span>{item.label}</span>
                <Check size={15} className={cn('text-[#B8A7FF]', tokens.some((token) => token.field === activeField.id && token.value === item.label) ? 'opacity-100' : 'opacity-0')} />
              </button>
            ))}
            <button type="button" className="mt-1 flex min-h-9 w-full items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground hover:bg-accent" onClick={() => onSelectField(activeField.id)}>
              <ArrowRight size={14} className="rotate-180" /> Back to filters
            </button>
          </div>
        ) : (
          <div className="max-h-[380px] overflow-y-auto p-1" role="listbox" aria-label="Available filter fields">
            <div className="px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Filter by field</div>
            {fields.map((field) => (
              <button key={field.id} type="button" className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]/35" onClick={() => onSelectField(field.id)} role="option">
                <span>
                  <span className="block text-sm text-foreground">{field.label}</span>
                  {field.description ? <span className="block text-xs text-muted-foreground">{field.description}</span> : null}
                </span>
                <PlusCircle size={16} className="text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
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

export function TaskSearchPage({ locationSearch, query, filters, activeBoard, onQueryChange, onFiltersChange, onOpenTask }: TaskSearchPageProps) {
  const urlParams = useMemo(() => new URLSearchParams(locationSearch), [locationSearch]);
  const [submittedQuery, setSubmittedQuery] = useState(filterValue(urlParams, 'q'));
  const [selectedFieldId, setSelectedFieldId] = useState<SearchFilterField['id']>();
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
    window.history.replaceState(null, '', `/search${params.toString() ? `?${params.toString()}` : ''}`);
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

  const updateFilter = (key: 'board' | 'status' | 'assignee' | 'priority', value: string) => {
    const currentValue = key === 'board' ? board : key === 'status' ? status : key === 'assignee' ? assignee : priority;
    const nextValue = value === currentValue ? '' : value;
    onFiltersChange({ ...filters, [key]: nextValue || undefined });
    syncUrl({ [key]: nextValue });
  };

  const clearFilters = () => {
    onFiltersChange({});
    syncUrl({ board: '', status: '', assignee: '', priority: '' });
  };

  const filterFields = useMemo<SearchFilterField[]>(() => [
    {
      id: 'board',
      label: 'Board',
      description: 'All, current, or a specific board',
      values: [
        { label: 'All boards', value: '' },
        { label: `Current · ${activeBoard.name}`, value: activeBoard.id },
        ...boards.map((item) => ({ label: item.name, value: item.id })),
      ],
    },
    { id: 'status', label: 'Status', values: STATUS_ORDER.map((item) => ({ label: STATUS_LABELS[item], value: item })) },
    { id: 'assignee', label: 'Assignee', values: assignees.map((item) => ({ label: item.name || item.id, value: item.name || item.id })) },
    { id: 'priority', label: 'Priority', values: (['p0', 'p1', 'p2', 'p3'] as Priority[]).map((item) => ({ label: item.toUpperCase(), value: item })) },
  ], [activeBoard.id, activeBoard.name, assignees, boards]);

  const activeTokens = useMemo<SearchFilterToken[]>(() => {
    const boardLabel = board ? filterFields[0]?.values.find((item) => item.value === board)?.label.replace(/^Current · /, '') || board : '';
    const assigneeLabel = assignee ? filterFields[2]?.values.find((item) => item.value === assignee)?.label || assignee : '';
    return [
      board ? { id: `board:${board}`, field: 'board' as const, label: 'Board', value: boardLabel } : null,
      status ? { id: `status:${status}`, field: 'status' as const, label: 'Status', value: STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status } : null,
      assignee ? { id: `assignee:${assignee}`, field: 'assignee' as const, label: 'Assignee', value: assigneeLabel } : null,
      priority ? { id: `priority:${priority}`, field: 'priority' as const, label: 'Priority', value: priority.toUpperCase() } : null,
    ].filter(Boolean) as SearchFilterToken[];
  }, [assignee, board, filterFields, priority, status]);

  const resultCountLabel = state === 'first-use' ? 'Ready' : state === 'loading' ? 'Searching…' : `${total} result${total === 1 ? '' : 's'}`;
  const freshness = source === 'fallback' ? 'Current-board-only fallback' : indexedAt ? formatRelative(indexedAt) : 'Live bridge';
  const scopeLabel = `${board ? activeTokens.find((token) => token.field === 'board')?.value || board : 'All boards'} · ${resultCountLabel} · ${freshness}`;

  return (
    <section className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(124,92,255,0.12),transparent_32%),linear-gradient(180deg,rgba(12,15,24,0.96),rgba(8,10,16,1))]" data-testid="task-search-page">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-4 px-4 py-4 md:px-6 md:py-6">
        <TokenSearchAndFilter
          query={query}
          tokens={activeTokens}
          fields={filterFields}
          selectedFieldId={selectedFieldId}
          onQueryChange={onQueryChange}
          onSubmit={() => submit()}
          onSelectField={(fieldId) => setSelectedFieldId((current) => current === fieldId ? undefined : fieldId)}
          onSelectValue={(fieldId, value) => {
            updateFilter(fieldId, value);
            setSelectedFieldId(undefined);
          }}
          onRemoveToken={(fieldId) => updateFilter(fieldId, '')}
          onClearAll={() => {
            onQueryChange('');
            setSubmittedQuery('');
            clearFilters();
            syncUrl({ q: '', board: '', status: '', assignee: '', priority: '' });
          }}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
          <p>{scopeLabel}</p>
          {activeTokens.length ? (
            <button type="button" className="hover:text-foreground" onClick={clearFilters}>Clear filters</button>
          ) : null}
        </div>

        <div className="space-y-3">
          {state === 'loading' && [0, 1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-2xl border border-border/60 bg-card/45" />)}
          {state === 'first-use' && (
            <div className="rounded-3xl border border-dashed border-[#7C5CFF]/30 bg-card/45 p-6 text-center">
              <Search className="mx-auto mb-3 text-[#B8A7FF]" size={28} />
              <h2 className="text-lg font-semibold">Start with a search term or filter token</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">Search by task id, title, body, summary, comment, assignee, or status. Exact task ids still open directly.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
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
    </section>
  );
}
