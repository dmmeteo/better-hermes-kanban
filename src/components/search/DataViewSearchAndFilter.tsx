import { useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import type { Board, BotProfile, Priority, TaskStatus } from '@/lib/types';
import { PRIORITY_LABELS, STATUS_LABELS, STATUS_ORDER } from '@/lib/types';
import { cn } from '@/lib/utils';

type FilterKey = 'board' | 'status' | 'assignee' | 'priority';
type Operator = 'is' | 'is_not';

export type DataViewSearchFilters = Partial<Record<FilterKey, string>>;

export type DataViewSearchAndFilterProps = {
  query: string;
  filters: DataViewSearchFilters;
  boards: Board[];
  assignees: BotProfile[];
  onQueryChange: (query: string) => void;
  onFiltersChange: (filters: DataViewSearchFilters) => void;
  onSubmit?: (query: string, filters: DataViewSearchFilters) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  density?: 'header' | 'page';
  testId?: string;
};

const FIELD_LABELS: Record<FilterKey, string> = {
  board: 'Board',
  status: 'Status',
  assignee: 'Assignee',
  priority: 'Priority',
};

const PRIORITIES: Priority[] = ['p0', 'p1', 'p2', 'p3'];

function isNegativeToken(value?: string) {
  return !!value?.startsWith('!');
}

function tokenValue(value?: string) {
  return value?.replace(/^!/, '') || '';
}

function serializeToken(operator: Operator, value: string) {
  return operator === 'is_not' ? `!${value}` : value;
}

function tokenOperator(value?: string): Operator {
  return isNegativeToken(value) ? 'is_not' : 'is';
}

function valueLabel(key: FilterKey, value: string, boards: Board[], assignees: BotProfile[]) {
  const clean = tokenValue(value);
  if (!clean) return '';
  if (key === 'board') return boards.find((board) => board.id === clean)?.name || clean;
  if (key === 'status') return STATUS_LABELS[clean as TaskStatus] || clean;
  if (key === 'priority') return PRIORITY_LABELS[clean as Priority] || clean.toUpperCase();
  if (key === 'assignee') return assignees.find((item) => item.name === clean || item.id === clean)?.name || clean;
  return clean;
}

export function getSearchParamValue(value?: string) {
  return tokenValue(value);
}

export function DataViewSearchAndFilter({
  query,
  filters,
  boards,
  assignees,
  onQueryChange,
  onFiltersChange,
  onSubmit,
  placeholder = 'Search tasks…',
  className,
  autoFocus,
  density = 'header',
  testId = 'data-view-search-filter',
}: DataViewSearchAndFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeField, setActiveField] = useState<FilterKey | null>(null);
  const [operator, setOperator] = useState<Operator>('is');
  const inputRef = useRef<HTMLInputElement>(null);

  const activeTokens = (Object.entries(filters) as [FilterKey, string | undefined][]).filter(([, value]) => !!value);

  const fieldOptions = useMemo(
    () => [
      { key: 'board' as const, hint: 'Scope to a Kanban board' },
      { key: 'status' as const, hint: 'Filter lifecycle state' },
      { key: 'assignee' as const, hint: 'Profile handling the work' },
      { key: 'priority' as const, hint: 'P0 through P3' },
    ],
    []
  );

  const valueOptions = useMemo(() => {
    if (activeField === 'board') return boards.map((board) => ({ value: board.id, label: board.name || board.id, meta: `${board.taskCount} tasks` }));
    if (activeField === 'status') return STATUS_ORDER.map((status) => ({ value: status, label: STATUS_LABELS[status], meta: status }));
    if (activeField === 'priority') return PRIORITIES.map((priority) => ({ value: priority, label: PRIORITY_LABELS[priority], meta: priority.toUpperCase() }));
    if (activeField === 'assignee') return assignees.map((item) => ({ value: item.name || item.id, label: item.name || item.id, meta: item.taskCount != null ? `${item.taskCount} tasks` : item.source || 'profile' }));
    return [];
  }, [activeField, assignees, boards]);

  const setFilter = (key: FilterKey, value: string, nextOperator = operator) => {
    onFiltersChange({ ...filters, [key]: serializeToken(nextOperator, value) });
    setIsOpen(false);
    setActiveField(null);
    inputRef.current?.focus();
  };

  const removeFilter = (key: FilterKey) => {
    const next = { ...filters };
    delete next[key];
    onFiltersChange(next);
  };

  const clearAll = () => {
    onQueryChange('');
    onFiltersChange({});
    onSubmit?.('', {});
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onSubmit?.(query.trim(), filters);
      setIsOpen(false);
      return;
    }
    if (event.key === 'Escape') {
      setIsOpen(false);
      setActiveField(null);
      inputRef.current?.blur();
    }
  };

  const panelId = `${testId}-panel`;

  return (
    <div className={cn('relative min-w-0', className)} data-testid={testId}>
      <div
        className={cn(
          'group flex min-w-0 items-center gap-2 rounded-xl border border-border bg-secondary/95 px-2 text-xs shadow-[0_12px_36px_rgba(0,0,0,0.18)] transition-colors focus-within:border-[#7C5CFF]/70 focus-within:ring-2 focus-within:ring-[#7C5CFF]/20',
          density === 'page' ? 'min-h-12 rounded-2xl bg-background/70 px-3' : 'min-h-9'
        )}
      >
        <Search size={density === 'page' ? 17 : 14} className="shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-testid={`${testId}-tokens`}>
          {activeTokens.map(([key, value]) => (
            <span
              key={key}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#7C5CFF]/35 bg-[#7C5CFF]/12 px-2 py-1 text-[11px] font-medium text-[#DED6FF]"
              data-testid={`${testId}-token-${key}`}
            >
              <span className="text-[#B8A7FF]">{FIELD_LABELS[key]}</span>
              <span className="text-muted-foreground">{tokenOperator(value) === 'is_not' ? 'is not' : 'is'}</span>
              <span>{valueLabel(key, value || '', boards, assignees)}</span>
              <button type="button" onClick={() => removeFilter(key)} className="rounded-full p-0.5 hover:bg-white/10" aria-label={`Remove ${FIELD_LABELS[key]} filter`} data-testid={`${testId}-remove-${key}`}>
                <X size={11} />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onFocus={() => {
              setIsOpen(true);
              setActiveField(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder={activeTokens.length ? 'Add text…' : placeholder}
            className="h-7 min-w-[150px] flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
            aria-label="Search and filter tasks"
            aria-expanded={isOpen}
            aria-controls={panelId}
            autoFocus={autoFocus}
            data-testid={`${testId}-input`}
          />
        </div>
        {(query || activeTokens.length > 0) && (
          <button type="button" onClick={clearAll} className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Clear search and filters" data-testid={`${testId}-clear`}>
            <X size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setIsOpen((current) => !current);
            setActiveField(null);
            inputRef.current?.focus();
          }}
          className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Open filter picker"
          data-testid={`${testId}-toggle`}
        >
          <ChevronDown size={14} className={cn(isOpen && 'rotate-180')} />
        </button>
      </div>

      {isOpen && (
        <div id={panelId} className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur" data-testid={`${testId}-picker`}>
          {!activeField ? (
            <div className="p-2" data-testid={`${testId}-field-picker`}>
              <div className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Choose filter field</div>
              {fieldOptions.map((field) => (
                <button
                  key={field.key}
                  type="button"
                  onClick={() => {
                    setActiveField(field.key);
                    setOperator(tokenOperator(filters[field.key]));
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
                  data-testid={`${testId}-field-${field.key}`}
                >
                  <span className="font-medium">{FIELD_LABELS[field.key]}</span>
                  <span className="truncate text-muted-foreground">{field.hint}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-2" data-testid={`${testId}-value-picker-${activeField}`}>
              <div className="mb-2 flex items-center justify-between gap-2 px-2 pt-1">
                <button type="button" onClick={() => setActiveField(null)} className="text-[11px] text-muted-foreground hover:text-foreground">← Fields</button>
                <div className="flex rounded-lg border border-border bg-secondary p-0.5" data-testid={`${testId}-operator-${activeField}`}>
                  {(['is', 'is_not'] as Operator[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setOperator(item)}
                      className={cn('rounded-md px-2 py-1 text-[11px]', operator === item ? 'bg-[#7C5CFF] text-white' : 'text-muted-foreground hover:text-foreground')}
                      data-testid={`${testId}-operator-${activeField}-${item}`}
                    >
                      {item === 'is_not' ? 'is not' : 'is'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {valueOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilter(activeField, option.value)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
                    data-testid={`${testId}-value-${activeField}-${option.value}`}
                  >
                    <span className="truncate font-medium">{option.label}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{option.meta}</span>
                  </button>
                ))}
                {valueOptions.length === 0 && <div className="px-3 py-4 text-xs text-muted-foreground">No values available.</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
