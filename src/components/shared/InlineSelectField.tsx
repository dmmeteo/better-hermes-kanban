import { useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface InlineSelectOption<T> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  key?: string;
}

export interface InlineSelectFieldProps<T> {
  value: T;
  options: InlineSelectOption<T>[];
  onChange: (next: T) => Promise<void> | void;
  renderTrigger: (current: InlineSelectOption<T> | undefined, state: { open: boolean; saving: boolean }) => ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  align?: 'start' | 'end' | 'center';
  className?: string;
  contentClassName?: string;
  ariaLabel?: string;
  dataTestId?: string;
}

function isSameValue<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  return false;
}

export function InlineSelectField<T>({
  value,
  options,
  onChange,
  renderTrigger,
  disabled,
  disabledReason,
  align = 'start',
  className,
  contentClassName,
  ariaLabel,
  dataTestId,
}: InlineSelectFieldProps<T>) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const current = options.find((opt) => isSameValue(opt.value, value));

  const handleSelect = async (option: InlineSelectOption<T>) => {
    if (option.disabled || isSameValue(option.value, value)) return;
    setSaving(true);
    try {
      await onChange(option.value);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const triggerEl = (
    <button
      type="button"
      disabled={disabled || saving}
      aria-label={ariaLabel}
      data-testid={dataTestId}
      className={cn(
        'group inline-flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left transition-colors',
        !disabled && 'hover:bg-accent/40',
        disabled && 'cursor-not-allowed opacity-70',
        className,
      )}
    >
      <span className="min-w-0 flex-1 truncate">{renderTrigger(current, { open, saving })}</span>
      {!disabled && (
        <ChevronDown size={14} className="shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" aria-hidden />
      )}
    </button>
  );

  if (disabled) {
    if (!disabledReason) return triggerEl;
    return (
      <Tooltip>
        <TooltipTrigger asChild>{triggerEl}</TooltipTrigger>
        <TooltipContent>{disabledReason}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{triggerEl}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={cn('min-w-[12rem]', contentClassName)}>
        {options.map((option) => {
          const selected = isSameValue(option.value, value);
          return (
            <DropdownMenuItem
              key={option.key ?? String(option.value)}
              disabled={option.disabled}
              onSelect={(e) => {
                e.preventDefault();
                void handleSelect(option);
              }}
              className="flex items-start gap-2"
            >
              <span className="mt-[2px] w-4 shrink-0">
                {selected ? <Check size={14} className="text-primary" /> : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">{option.label}</span>
                {option.description && (
                  <span className="truncate text-xs text-muted-foreground">{option.description}</span>
                )}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
