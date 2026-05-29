import { useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { FileText, PanelRightOpen, Save, SquareStack, Wand2, X } from 'lucide-react';
import type { Board, BotProfile, KanbanOrchestrationSettings } from '@/lib/types';
import { kanbanApi } from '@/lib/kanbanApi';
import { NativeKanbanClientError } from '@/lib/nativeKanbanClient';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { InlineEditField } from '@/components/shared/InlineEditField';
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

type OrchestrationFormState = {
  orchestratorProfile: string;
  defaultAssignee: string;
  autoDecompose: boolean;
};

const emptyOrchestrationForm: OrchestrationFormState = {
  orchestratorProfile: '',
  defaultAssignee: '',
  autoDecompose: true,
};

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

function settingsToForm(settings: KanbanOrchestrationSettings | null): OrchestrationFormState {
  if (!settings) return emptyOrchestrationForm;
  return {
    orchestratorProfile: settings.orchestratorProfile || '',
    defaultAssignee: settings.defaultAssignee || '',
    autoDecompose: settings.autoDecompose,
  };
}

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

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-card/40 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function BoardsSettingsPanel({
  open,
  onClose,
  mode = 'settings',
  activeBoard,
  onBoardsRefresh,
  assignees = [],
  detailPresentation,
  onDetailPresentationChange,
}: BoardsSettingsPanelProps) {
  const [panelMode, setPanelMode] = useState<BoardSettingsMode>(mode);
  const [settings, setSettings] = useState<KanbanOrchestrationSettings | null>(null);
  const [form, setForm] = useState<OrchestrationFormState>(emptyOrchestrationForm);
  const [profiles, setProfiles] = useState<BotProfile[]>([]);
  const [boardAssignees, setBoardAssignees] = useState<BotProfile[]>(assignees);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [describing, setDescribing] = useState<string | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const profileOptions = useMemo(() => mergeOptions(profiles, boardAssignees, assignees), [assignees, boardAssignees, profiles]);
  const settingsDirty = useMemo(() => {
    const baseline = settingsToForm(settings);
    return (
      form.orchestratorProfile !== baseline.orchestratorProfile ||
      form.defaultAssignee !== baseline.defaultAssignee ||
      form.autoDecompose !== baseline.autoDecompose
    );
  }, [form, settings]);

  useEffect(() => {
    if (!open) return;
    setPanelMode(mode === 'list' ? 'list' : 'settings');
  }, [mode, open]);

  useEffect(() => {
    if (!open || panelMode !== 'settings') return;
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
        setForm(settingsToForm(nextSettings));
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
  }, [activeBoard.id, assignees, open, panelMode]);

  const saveSettings = async () => {
    if (!settingsDirty) return;
    setSettingsSaving(true);
    try {
      const next = await kanbanApi.updateOrchestration({
        orchestratorProfile: form.orchestratorProfile || '',
        defaultAssignee: form.defaultAssignee || '',
        autoDecompose: form.autoDecompose,
      });
      setSettings(next);
      setForm(settingsToForm(next));
      toast.success('Kanban settings saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setSettingsSaving(false);
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
        current.map((profile) =>
          profile.id === name ? { ...profile, description: saved, descriptionAuto: false } : profile,
        ),
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
        current.map((profile) =>
          profile.id === name ? { ...profile, description, descriptionAuto: true } : profile,
        ),
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
        showCloseButton={false}
        data-testid="settings-drawer"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="inset-0 h-[100dvh] w-screen max-w-none gap-0 overflow-hidden border-0 bg-background p-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[460px] sm:max-w-[460px] sm:border-l"
      >
        <SheetHeader className="border-b border-border/50 px-4 py-4">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div>
              <SheetTitle className="text-base">Settings</SheetTitle>
              <SheetDescription className="text-xs">
                Board &amp; orchestration settings for {activeBoard.name || activeBoard.id}.
              </SheetDescription>
            </div>
            <button
              type="button"
              data-testid="settings-close-button"
              aria-label="Close settings"
              onClick={onClose}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card hover:bg-accent"
            >
              <X size={15} />
            </button>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overscroll-contain overflow-y-auto px-4 py-4">
          {/* Active board — name & description are inline-editable */}
          <Section title="Active board">
            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Name</span>
                <InlineEditField
                  value={activeBoard.name || ''}
                  onSave={(next) => saveBoardField({ name: next })}
                  ariaLabel="Edit board name"
                  dataTestId="settings-board-name"
                  inputClassName="text-sm font-medium"
                  displayClassName="text-sm font-medium"
                  validate={(v) => (v.trim() ? null : 'Name is required')}
                  placeholder="Board name"
                />
                <span data-testid="settings-board-slug" className="block font-mono text-[11px] text-muted-foreground">
                  {activeBoard.id}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Description</span>
                <InlineEditField
                  value={activeBoard.description || ''}
                  onSave={(next) => saveBoardField({ description: next })}
                  as="textarea"
                  ariaLabel="Edit board description"
                  dataTestId="settings-board-description"
                  inputClassName="!min-h-0 text-sm leading-relaxed"
                  renderDisplay={(v) => <MarkdownText className="text-sm leading-relaxed" value={v} />}
                  emptyDisplay={<span className="text-sm text-muted-foreground">— add a description —</span>}
                />
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">Tasks</span>
                <span data-testid="settings-board-task-count" className="font-medium">{activeBoard.taskCount}</span>
              </div>
            </div>
          </Section>

          {/* Orchestration — 3 fields, saved via the footer Save button */}
          <Section title="Orchestration">
            {settingsLoading ? (
              <p className="text-xs text-muted-foreground">Loading settings…</p>
            ) : (
              <div className="grid gap-3">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Orchestrator profile</span>
                  <select
                    data-testid="settings-orchestrator-profile"
                    value={form.orchestratorProfile}
                    onChange={(event) => setForm((current) => ({ ...current, orchestratorProfile: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Use resolved default</option>
                    {profileOptions.map((profile) => (
                      <option key={profile.id} value={profile.id}>{profile.name}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium">Default assignee</span>
                  <select
                    data-testid="settings-default-assignee"
                    value={form.defaultAssignee}
                    onChange={(event) => setForm((current) => ({ ...current, defaultAssignee: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Use resolved default</option>
                    {profileOptions.map((profile) => (
                      <option key={profile.id} value={profile.id}>{profile.name}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span className="space-y-0.5">
                    <span className="block font-medium">Auto-decompose triage tasks</span>
                    <span className="block text-xs text-muted-foreground">The dispatcher decomposes new triage tasks automatically.</span>
                  </span>
                  <input
                    type="checkbox"
                    data-testid="settings-auto-decompose"
                    checked={form.autoDecompose}
                    onChange={(event) => setForm((current) => ({ ...current, autoDecompose: event.target.checked }))}
                    className="h-4 w-4 shrink-0 accent-primary"
                  />
                </label>
              </div>
            )}
          </Section>

          {/* Profile descriptions — guide the orchestrator's routing */}
          <Section
            title="Profile descriptions"
            description="Descriptions guide the orchestrator's routing. Edit and save, or use the wand to auto-generate."
          >
            {profiles.length === 0 ? (
              <p className="text-xs text-muted-foreground">No profiles available.</p>
            ) : (
              <div className="space-y-3" data-testid="settings-profile-descriptions">
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
          </Section>

          {/* Task detail presentation — moved out of the header; per-board preference */}
          <Section title="Task detail presentation" description="How a task opens on this board.">
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
          </Section>

          {/* Resolved runtime helpers — read-only effective values */}
          <Section title="Resolved runtime helpers" description="Effective values after fallbacks are applied.">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Resolved orchestrator</span><span data-testid="settings-resolved-orchestrator-profile" className="font-medium">{settings?.resolvedOrchestratorProfile || 'default'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Resolved assignee</span><span data-testid="settings-resolved-default-assignee" className="font-medium">{settings?.resolvedDefaultAssignee || 'default'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Active profile</span><span data-testid="settings-active-profile" className="font-medium">{settings?.activeProfile || 'default'}</span></div>
            </div>
          </Section>

          {/* Advanced dispatcher limits — read-only until backend save support exists */}
          <Section title="Advanced dispatcher limits" description="Read-only until backend save support exists.">
            <div className="space-y-2 text-xs">
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Max in progress</span><span data-testid="settings-advanced-max-in-progress">{formatSettingValue(settings?.advanced.maxInProgress ?? null)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Max spawn</span><span data-testid="settings-advanced-max-spawn">{formatSettingValue(settings?.advanced.maxSpawn ?? null)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Dispatch interval</span><span data-testid="settings-advanced-dispatch-interval">{formatSettingValue(settings?.advanced.dispatchIntervalSeconds ?? null)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Failure limit</span><span data-testid="settings-advanced-failure-limit">{formatSettingValue(settings?.advanced.failureLimit ?? null)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Stale timeout</span><span data-testid="settings-advanced-stale-timeout">{formatSettingValue(settings?.advanced.dispatchStaleTimeoutSeconds ?? null)}</span></div>
            </div>
          </Section>
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 border-t border-border/50 bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            data-testid="settings-cancel-button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="settings-save-button"
            onClick={saveSettings}
            disabled={settingsLoading || settingsSaving || !settingsDirty}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
          >
            <Save size={13} />
            {settingsSaving ? 'Saving…' : settingsDirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
