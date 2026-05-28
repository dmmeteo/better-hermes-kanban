import { useEffect, useRef, useState, type ReactNode, type KeyboardEvent } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export interface InlineEditFieldProps {
  value: string;
  onSave: (next: string) => Promise<void> | void;
  as?: 'input' | 'textarea';
  placeholder?: string;
  validate?: (value: string) => string | null;
  renderDisplay?: (value: string) => ReactNode;
  emptyDisplay?: ReactNode;
  disabled?: boolean;
  className?: string;
  displayClassName?: string;
  inputClassName?: string;
  textareaRows?: number;
  ariaLabel?: string;
  dataTestId?: string;
}

export function InlineEditField({
  value,
  onSave,
  as = 'input',
  placeholder,
  validate,
  renderDisplay,
  emptyDisplay,
  disabled,
  className,
  displayClassName,
  inputClassName,
  textareaRows = 6,
  ariaLabel,
  dataTestId,
}: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [editing, value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if ('select' in inputRef.current) inputRef.current.select();
    }
  }, [editing]);

  const beginEdit = () => {
    if (disabled || saving) return;
    setDraft(value);
    setError(null);
    setEditing(true);
  };

  const cancel = () => {
    setDraft(value);
    setError(null);
    setEditing(false);
  };

  const commit = async () => {
    if (saving) return;
    const trimmed = draft;
    const validationError = validate ? validate(trimmed) : null;
    if (validationError) {
      setError(validationError);
      return;
    }
    if (trimmed === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancel();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      void commit();
      return;
    }
    if (as === 'input' && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      void commit();
    }
  };

  if (!editing) {
    const hasValue = value.trim().length > 0;
    return (
      <button
        type="button"
        onClick={beginEdit}
        disabled={disabled}
        aria-label={ariaLabel || 'Edit field'}
        data-testid={dataTestId}
        className={cn(
          'group block w-full rounded-md px-2 py-1 text-left transition-colors',
          !disabled && 'cursor-text hover:bg-accent/40',
          disabled && 'cursor-not-allowed opacity-70',
          className,
        )}
      >
        <span className={cn('block', displayClassName)}>
          {hasValue
            ? renderDisplay
              ? renderDisplay(value)
              : value
            : emptyDisplay ?? <span className="text-muted-foreground">{placeholder || 'Click to edit'}</span>}
        </span>
      </button>
    );
  }

  const sharedFieldProps = {
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onKeyDown,
    placeholder,
    disabled: saving,
    'aria-invalid': Boolean(error) || undefined,
    'aria-label': ariaLabel,
    'data-testid': dataTestId,
  };

  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      {as === 'textarea' ? (
        <Textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          rows={textareaRows}
          className={cn('w-full', inputClassName)}
          {...sharedFieldProps}
        />
      ) : (
        <Input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          className={cn('w-full', inputClassName)}
          {...sharedFieldProps}
        />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={cancel}
          disabled={saving}
          data-testid={dataTestId ? `${dataTestId}-cancel` : undefined}
        >
          <X size={14} /> Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => void commit()}
          disabled={saving}
          data-testid={dataTestId ? `${dataTestId}-save` : undefined}
        >
          <Check size={14} /> {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
