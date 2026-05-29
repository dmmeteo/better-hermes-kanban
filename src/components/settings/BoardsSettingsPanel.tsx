import { useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { FileText, PanelRightOpen, SquareStack, Wand2 } from 'lucide-react';
import type { Board, BotProfile, KanbanOrchestrationSettings, KanbanOrchestrationUpdate } from '@/lib/types';
import { kanbanApi } from '@/lib/kanbanApi';
import { NativeKanbanClientError } from '@/lib/nativeKanbanClient';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { InlineEditField } from '@/components/shared/InlineEditField';
import { InlineSelectField, type InlineSelectOption } from '@/components/shared/InlineSelectField';
import { MarkdownText } from '@/components/shared/MarkdownText';
import { cn } from '@/lib/utils';
import type { TaskDetailPresentation } from '@/components/layout/TopBar';
import { toast } from 'sonner';

export type BoardSettingsMode = 'settings' | 'list';

interface BoardsSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  mode?: BoardSettingsMode;
  boards: Board[];
  activeBoard: Board;
  onBoardChange: (board: Board) => void;
  onBoardsRefresh?: (preferredBoardId?: string) => Promise<void>;
  assignees?: BotProfile[];
  detailPresentation: TaskDetailPresentation;
  onDetailPresentationChange: (presentation: TaskDetailPresentation) => void;
}

const PRESENTATION_OPTIONS: {
  value: TaskDetailPresentation;
  label: string;
  hint: string;
  icon: typeof PanelRightOpen;
}[] = [
  { value: 'drawer', label: 'Side drawer', hint: 'Half-screen detail panel', icon: PanelRightOpen },
  { value: 'modal', label: 'Jira-style modal', hint: 'Centered overlay with focus trap', icon: SquareStack },
  { value: 'page', label: 'Standalone page', hint: 'Full content canvas', icon: FileText },
];

function formatSettingValue(value: number | null) {
  return value === null || value === undefined ? 'Not configured' : String(value);
}

function mergeOptions(...groups: BotProfile[][]) {
  const byId = new Map<string, BotProfile>();
  groups.flat().forEach((item) => {
    if (item.id) byId.set(item.id, item);
  });
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// Dashboard-level profile routes aren't exposed on every host (e.g. bhk); treat a
// 404 as "feature not available here" rather than a hard error.
function isUnavailable(error: unknown): boolean {
  return error instanceof NativeKanbanClientError && error.status === 404;
}

// Section label — matches the Task drawer (TaskDetailBody / TaskDetailSidebar).
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{children}</p>
  );
}

// Label/value row — mirrors SidebarRow in TaskDetailSidebar.tsx.
function SettingsRow({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid items-center gap-3', className)} data-testid={`settings-row-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <span className="flex items-center pt-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function BoardsSettingsPanel({
  open,
  onClose,
  activeBoard,
  onBoardsRefresh,
  assignees = [],
  detailPresentation,
  onDetailPresentationChange,
}: BoardsSettingsPanelProps) {
  const [settings, setSettings] = useState<KanbanOrchestrationSettings | null>(null);
  const [profiles, setProfiles] = useState<BotProfile[]>([]);
  const [boardAssignees, setBoardAssignees] = useState<BotProfile[]>(assignees);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [describing, setDescribing] = useState<string | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const profileOptions = useMemo(() => mergeOptions(profiles, boardAssignees, assignees), [assignees, boardAssignees, profiles]);

  const selectOptions = useMemo<InlineSelectOption<string>[]>(
    () => [
      { value: '', key: '__resolved', label: <span className="text-muted-foreground">Use resolved default</span> },
      ...profileOptions.map((profile) => ({ value: profile.id, key: profile.id, label: profile.name })),
    ],
    [profileOptions],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSettingsLoading(true);
    Promise.all([
      kanbanApi.getOrchestration(),
      kanbanApi.getProfiles().catch(() => []),
      kanbanApi.getAssignees(activeBoard.id).catch(() => assignees),
    ])
      .then(([nextSettings, nextProfiles, nextAssignees]) => {
        if (cancelled) return;
        setSettings(nextSettings);
        setProfiles(nextProfiles);
        setBoardAssignees(nextAssignees);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : 'Failed to load settings');
      })
      .finally(() => {
        if (!cancelled) setSettingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeBoard.id, assignees, open]);

  // Orchestration fields save immediately (like the Task drawer's inline fields).
  const patchOrchestration = async (patch: KanbanOrchestrationUpdate, label: string) => {
    try {
      const next = await kanbanApi.updateOrchestration(patch);
      setSettings(next);
      toast.success(label);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
    }
  };

  const saveBoardField = async (patch: { name?: string; description?: string }) => {
    try {
      await kanbanApi.updateBoard(activeBoard.id, patch);
      await onBoardsRefresh?.(activeBoard.id);
      toast.success('Board updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update board');
      throw error;
    }
  };

  const saveProfileDescription = async (name: string, description: string) => {
    try {
      const saved = await kanbanApi.updateProfileDescription(name, description);
      setProfiles((current) =>
        current.map((profile) => (profile.id === name ? { ...profile, description: saved, descriptionAuto: false } : profile)),
      );
      toast.success('Profile description saved');
    } catch (error) {
      if (isUnavailable(error)) {
        toast.error('Profile descriptions are not available on this host');
        return;
      }
      toast.error(error instanceof Error ? error.message : 'Failed to save description');
      throw error;
    }
  };

  const autoDescribe = async (name: string) => {
    setDescribing(name);
    try {
      const { description } = await kanbanApi.autoDescribeProfile(name, true);
      setProfiles((current) =>
        current.map((profile) => (profile.id === name ? { ...profile, description, descriptionAuto: true } : profile)),
      );
      toast.success('Generated a description');
    } catch (error) {
      if (isUnavailable(error)) {
        toast.error('Auto-generate is not available on this host');
        return;
      }
      toast.error(error instanceof Error ? error.message : 'Failed to generate description');
    } finally {
      setDescribing(null);
    }
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    swipeStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (!swipeStart.current) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - swipeStart.current.x;
    const deltaY = touch.clientY - swipeStart.current.y;
    swipeStart.current = null;
    if (deltaX > 80 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      onClose();
    }
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        data-testid="settings-drawer"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="!w-screen !max-w-none gap-3 overflow-y-auto border-l border-border bg-background p-4 md:!w-[40vw] md:!min-w-[360px] md:!max-w-none md:p-5"
      >
        <div className="flex flex-col gap-1 pr-8">
          <SheetTitle className="text-base">Settings</SheetTitle>
          <SheetDescription className="text-xs">
            Board &amp; orchestration settings for {activeBoard.name || activeBoard.id}.
          </SheetDescription>
        </div>

        <div className="flex flex-col gap-4">
          {/* Active board — name & description are inline-editable */}
          <section className="flex flex-col gap-2" data-testid="settings-active-board">
            <SectionLabel>Active board</SectionLabel>
            <InlineEditField
              value={activeBoard.name || ''}
              onSave={(next) => saveBoardField({ name: next })}
              ariaLabel="Edit board name"
              dataTestId="settings-board-name"
              inputClassName="text-base font-semibold"
              displayClassName="text-base font-semibold leading-tight break-words"
              validate={(v) => (v.trim() ? null : 'Name is required')}
              placeholder="Board name"
            />
            <div className="px-1 text-[11px] text-muted-foreground">
              <span data-testid="settings-board-slug" className="font-mono">{activeBoard.id}</span>
              <span> · </span>
              <span data-testid="settings-board-task-count">{activeBoard.taskCount} tasks</span>
            </div>
            <div className="mt-1 flex flex-col gap-1.5">
              <SectionLabel>Description</SectionLabel>
              <InlineEditField
                value={activeBoard.description || ''}
                onSave={(next) => saveBoardField({ description: next })}
                as="textarea"
                ariaLabel="Edit board description"
                dataTestId="settings-board-description"
                inputClassName="!min-h-0 leading-relaxed"
                renderDisplay={(v) => <MarkdownText className="text-sm leading-relaxed" value={v} />}
                emptyDisplay={<span className="text-sm text-muted-foreground">— add a description —</span>}
              />
            </div>
          </section>

          <Separator />

          {/* Orchestration — inline fields, each saves immediately */}
          <section className="flex flex-col gap-3" data-testid="settings-orchestration">
            <SectionLabel>Orchestration</SectionLabel>
            {settingsLoading ? (
              <p className="px-1 text-xs text-muted-foreground">Loading settings…</p>
            ) : (
              <div className="flex flex-col gap-2">
                <SettingsRow label="Orchestrator" className="grid-cols-[110px_minmax(0,1fr)]">
                  <InlineSelectField
                    value={settings?.orchestratorProfile || ''}
                    options={selectOptions}
                    onChange={(next) => patchOrchestration({ orchestratorProfile: next }, 'Orchestrator profile updated')}
                    renderTrigger={(current) => <span className="text-sm">{current ? current.label : 'Use resolved default'}</span>}
                    ariaLabel="Edit orchestrator profile"
                    dataTestId="settings-orchestrator-profile"
                  />
                </SettingsRow>
                <SettingsRow label="Assignee" className="grid-cols-[110px_minmax(0,1fr)]">
                  <InlineSelectField
                    value={settings?.defaultAssignee || ''}
                    options={selectOptions}
                    onChange={(next) => patchOrchestration({ defaultAssignee: next }, 'Default assignee updated')}
                    renderTrigger={(current) => <span className="text-sm">{current ? current.label : 'Use resolved default'}</span>}
                    ariaLabel="Edit default assignee"
                    dataTestId="settings-default-assignee"
                  />
                </SettingsRow>
                <SettingsRow label="Auto-decompose" className="grid-cols-[110px_minmax(0,1fr)]">
                  <label className="flex items-center gap-2 px-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      data-testid="settings-auto-decompose"
                      checked={settings?.autoDecompose ?? true}
                      onChange={(event) => patchOrchestration({ autoDecompose: event.target.checked }, 'Auto-decompose updated')}
                      className="h-4 w-4 shrink-0 accent-primary"
                    />
                    <span className="text-xs text-muted-foreground">Decompose new triage tasks automatically</span>
                  </label>
                </SettingsRow>
              </div>
            )}
          </section>

          <Separator />

          {/* Profile descriptions — guide the orchestrator's routing */}
          <section className="flex flex-col gap-2" data-testid="settings-profile-descriptions-section">
            <SectionLabel>Profile descriptions</SectionLabel>
            <p className="px-1 text-[11px] text-muted-foreground">
              Descriptions guide the orchestrator's routing. Edit and save, or use the wand to auto-generate.
            </p>
            {profiles.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">No profiles available.</p>
            ) : (
              <div className="flex flex-col gap-3" data-testid="settings-profile-descriptions">
                {profiles.map((profile) => (
                  <div key={profile.id} className="rounded-lg border border-border/60 bg-background/40 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium">{profile.name}</span>
                        {profile.isDefault ? (
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">default</span>
                        ) : null}
                        {profile.descriptionAuto ? (
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">auto-generated</span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        aria-label={`Auto-generate description for ${profile.name}`}
                        title="Auto-generate description"
                        data-testid={`settings-profile-auto-${profile.id}`}
                        onClick={() => autoDescribe(profile.id)}
                        disabled={describing === profile.id}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-card hover:bg-accent disabled:opacity-50"
                      >
                        <Wand2 size={14} className={cn(describing === profile.id && 'animate-pulse')} />
                      </button>
                    </div>
                    <InlineEditField
                      value={profile.description || ''}
                      onSave={(next) => saveProfileDescription(profile.id, next)}
                      as="textarea"
                      ariaLabel={`Edit description for ${profile.name}`}
                      dataTestId={`settings-profile-description-${profile.id}`}
                      inputClassName="!min-h-0 text-sm leading-relaxed"
                      textareaRows={3}
                      emptyDisplay={<span className="text-sm text-muted-foreground">What is this profile good at?</span>}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          <Separator />

          {/* Task detail presentation — per-board preference */}
          <section className="flex flex-col gap-2" data-testid="settings-detail-presentation-section">
            <SectionLabel>Task detail presentation</SectionLabel>
            <div className="grid gap-2" data-testid="settings-detail-presentation">
              {PRESENTATION_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = detailPresentation === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    data-testid={`settings-detail-presentation-${option.value}`}
                    aria-pressed={active}
                    onClick={() => onDetailPresentationChange(option.value)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                      active ? 'border-primary bg-primary/10' : 'border-border/60 bg-background/40 hover:bg-accent',
                    )}
                  >
                    <Icon size={16} className="shrink-0 text-muted-foreground" />
                    <span className="space-y-0.5">
                      <span className="block font-medium">{option.label}</span>
                      <span className="block text-xs text-muted-foreground">{option.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <Separator />

          {/* Read-only runtime info — grouped like the Task drawer sidebar card */}
          <aside className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/30 p-3" data-testid="settings-runtime-info">
            <div className="flex flex-col gap-2">
              <SectionLabel>Resolved runtime helpers</SectionLabel>
              <SettingsRow label="Orchestrator" className="grid-cols-[140px_minmax(0,1fr)]">
                <span data-testid="settings-resolved-orchestrator-profile" className="text-sm">{settings?.resolvedOrchestratorProfile || 'default'}</span>
              </SettingsRow>
              <SettingsRow label="Assignee" className="grid-cols-[140px_minmax(0,1fr)]">
                <span data-testid="settings-resolved-default-assignee" className="text-sm">{settings?.resolvedDefaultAssignee || 'default'}</span>
              </SettingsRow>
              <SettingsRow label="Active profile" className="grid-cols-[140px_minmax(0,1fr)]">
                <span data-testid="settings-active-profile" className="text-sm">{settings?.activeProfile || 'default'}</span>
              </SettingsRow>
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <SectionLabel>Advanced dispatcher limits</SectionLabel>
              <p className="px-1 text-[11px] text-muted-foreground">Read-only until backend save support exists.</p>
              <SettingsRow label="Max in progress" className="grid-cols-[140px_minmax(0,1fr)]">
                <span data-testid="settings-advanced-max-in-progress" className="text-sm">{formatSettingValue(settings?.advanced.maxInProgress ?? null)}</span>
              </SettingsRow>
              <SettingsRow label="Max spawn" className="grid-cols-[140px_minmax(0,1fr)]">
                <span data-testid="settings-advanced-max-spawn" className="text-sm">{formatSettingValue(settings?.advanced.maxSpawn ?? null)}</span>
              </SettingsRow>
              <SettingsRow label="Dispatch interval" className="grid-cols-[140px_minmax(0,1fr)]">
                <span data-testid="settings-advanced-dispatch-interval" className="text-sm">{formatSettingValue(settings?.advanced.dispatchIntervalSeconds ?? null)}</span>
              </SettingsRow>
              <SettingsRow label="Failure limit" className="grid-cols-[140px_minmax(0,1fr)]">
                <span data-testid="settings-advanced-failure-limit" className="text-sm">{formatSettingValue(settings?.advanced.failureLimit ?? null)}</span>
              </SettingsRow>
              <SettingsRow label="Stale timeout" className="grid-cols-[140px_minmax(0,1fr)]">
                <span data-testid="settings-advanced-stale-timeout" className="text-sm">{formatSettingValue(settings?.advanced.dispatchStaleTimeoutSeconds ?? null)}</span>
              </SettingsRow>
            </div>
          </aside>
        </div>
      </SheetContent>
    </Sheet>
  );
}
