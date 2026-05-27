import { useEffect, useMemo, useState } from 'react';
import { Save, X } from 'lucide-react';
import type { Board, BotProfile, KanbanOrchestrationSettings } from '@/lib/types';
import { kanbanApi } from '@/lib/kanbanApi';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';

export type BoardSettingsMode = 'settings' | 'list' | 'create';

interface BoardsSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  mode?: BoardSettingsMode;
  boards: Board[];
  activeBoard: Board;
  onBoardChange: (board: Board) => void;
  onBoardsRefresh?: (preferredBoardId?: string) => Promise<void>;
  assignees?: BotProfile[];
}

type OrchestrationFormState = {
  orchestratorProfile: string;
  defaultAssignee: string;
  autoDecompose: boolean;
  autoPromoteChildren: boolean;
};

const emptyOrchestrationForm: OrchestrationFormState = {
  orchestratorProfile: '',
  defaultAssignee: '',
  autoDecompose: true,
  autoPromoteChildren: true,
};

function settingsToForm(settings: KanbanOrchestrationSettings | null): OrchestrationFormState {
  if (!settings) return emptyOrchestrationForm;
  return {
    orchestratorProfile: settings.orchestratorProfile || '',
    defaultAssignee: settings.defaultAssignee || '',
    autoDecompose: settings.autoDecompose,
    autoPromoteChildren: settings.autoPromoteChildren,
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

export function BoardsSettingsPanel({
  open,
  onClose,
  mode = 'settings',
  activeBoard,
  assignees = [],
}: BoardsSettingsPanelProps) {
  const [panelMode, setPanelMode] = useState<BoardSettingsMode>(mode);
  const [settings, setSettings] = useState<KanbanOrchestrationSettings | null>(null);
  const [form, setForm] = useState<OrchestrationFormState>(emptyOrchestrationForm);
  const [profiles, setProfiles] = useState<BotProfile[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const profileOptions = useMemo(() => mergeOptions(profiles, assignees), [assignees, profiles]);

  useEffect(() => {
    if (!open) return;
    setPanelMode(mode === 'create' ? 'create' : 'settings');
  }, [mode, open]);

  useEffect(() => {
    if (!open || panelMode !== 'settings') return;
    let cancelled = false;
    setSettingsLoading(true);
    Promise.all([
      kanbanApi.getOrchestration(),
      kanbanApi.getProfiles().catch(() => []),
    ])
      .then(([nextSettings, nextProfiles]) => {
        if (cancelled) return;
        setSettings(nextSettings);
        setForm(settingsToForm(nextSettings));
        setProfiles(nextProfiles);
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
  }, [open, panelMode]);

  const saveSettings = async () => {
    setSettingsSaving(true);
    try {
      const next = await kanbanApi.updateOrchestration({
        orchestratorProfile: form.orchestratorProfile || '',
        defaultAssignee: form.defaultAssignee || '',
        autoDecompose: form.autoDecompose,
        autoPromoteChildren: form.autoPromoteChildren,
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

  const showCreateShim = panelMode === 'create';

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        data-testid="settings-drawer"
        className="w-[92vw] gap-0 border-border bg-background p-0 sm:max-w-[460px]"
      >
        <SheetHeader className="border-b border-border/50 px-4 py-4">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div>
              <SheetTitle className="text-base">{showCreateShim ? 'New board' : 'Settings'}</SheetTitle>
              <SheetDescription className="text-xs">
                {showCreateShim
                  ? 'New board creation lives in the board selector. Use the selector to continue.'
                  : `Active board settings for ${activeBoard.name || activeBoard.id}.`}
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

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {showCreateShim ? (
            <div data-testid="new-board-modal" className="rounded-xl border border-border/60 bg-card/30 p-4 text-sm text-muted-foreground">
              Open the board selector and choose “New board” to create a board.
            </div>
          ) : (
            <div className="space-y-4">
              <section className="rounded-xl border border-border/60 bg-card/30 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active board</div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Name</span>
                    <span data-testid="settings-board-name" className="min-w-0 truncate font-medium">{activeBoard.name || activeBoard.id}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Slug</span>
                    <span data-testid="settings-board-slug" className="font-mono text-xs">{activeBoard.id}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Description</span>
                    <span data-testid="settings-board-description" className="max-w-[240px] text-right text-xs">{activeBoard.description || 'No description'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Tasks</span>
                    <span data-testid="settings-board-task-count">{activeBoard.taskCount}</span>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-border/60 bg-card/30 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Orchestration</div>
                {settingsLoading ? (
                  <p className="mt-3 text-xs text-muted-foreground">Loading settings…</p>
                ) : (
                  <div className="mt-3 grid gap-3">
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
                    <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm">
                      <span>Auto-decompose triage tasks</span>
                      <input
                        type="checkbox"
                        data-testid="settings-auto-decompose"
                        checked={form.autoDecompose}
                        onChange={(event) => setForm((current) => ({ ...current, autoDecompose: event.target.checked }))}
                        className="h-4 w-4 accent-primary"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm">
                      <span>Auto-promote children</span>
                      <input
                        type="checkbox"
                        data-testid="settings-auto-promote-children"
                        checked={form.autoPromoteChildren}
                        onChange={(event) => setForm((current) => ({ ...current, autoPromoteChildren: event.target.checked }))}
                        className="h-4 w-4 accent-primary"
                      />
                    </label>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-border/60 bg-card/30 p-3 text-xs">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Resolved runtime helpers</div>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Resolved orchestrator</span><span data-testid="settings-resolved-orchestrator-profile">{settings?.resolvedOrchestratorProfile || 'default'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Resolved assignee</span><span data-testid="settings-resolved-default-assignee">{settings?.resolvedDefaultAssignee || 'default'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Active profile</span><span data-testid="settings-active-profile">{settings?.activeProfile || 'default'}</span></div>
                </div>
              </section>

              <section className="rounded-xl border border-border/60 bg-card/30 p-3 text-xs">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Advanced dispatcher limits</div>
                <p className="mt-1 text-[11px] text-muted-foreground">Read-only until backend save support exists.</p>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Max in progress</span><span data-testid="settings-advanced-max-in-progress">{formatSettingValue(settings?.advanced.maxInProgress ?? null)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Max spawn</span><span data-testid="settings-advanced-max-spawn">{formatSettingValue(settings?.advanced.maxSpawn ?? null)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Dispatch interval</span><span data-testid="settings-advanced-dispatch-interval">{formatSettingValue(settings?.advanced.dispatchIntervalSeconds ?? null)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Failure limit</span><span data-testid="settings-advanced-failure-limit">{formatSettingValue(settings?.advanced.failureLimit ?? null)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Stale timeout</span><span data-testid="settings-advanced-stale-timeout">{formatSettingValue(settings?.advanced.dispatchStaleTimeoutSeconds ?? null)}</span></div>
                </div>
              </section>
            </div>
          )}
        </div>

        {!showCreateShim && (
          <div className="flex items-center justify-end gap-2 border-t border-border/50 px-4 py-3">
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
              disabled={settingsLoading || settingsSaving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
              <Save size={13} />
              {settingsSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
