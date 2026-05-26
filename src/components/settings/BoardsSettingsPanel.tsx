import { useEffect, useMemo, useState } from 'react';
import { X, Plus, Star, Bot, ChevronRight, Radio, Plug, Sliders, Stethoscope, Save, Lock } from 'lucide-react';
import type { Board, BotProfile, KanbanOrchestrationSettings } from '@/lib/types';
import { BOT_PROFILES } from '@/lib/types';
import { kanbanApi } from '@/lib/kanbanApi';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface BoardsSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  boards: Board[];
  activeBoard: Board;
  onBoardChange: (board: Board) => void;
  onBoardsRefresh?: (preferredBoardId?: string) => Promise<void>;
  isMobile?: boolean;
}

type FormState = {
  orchestratorProfile: string;
  defaultAssignee: string;
  autoDecompose: boolean;
  autoPromoteChildren: boolean;
};

const emptyForm: FormState = {
  orchestratorProfile: '',
  defaultAssignee: '',
  autoDecompose: true,
  autoPromoteChildren: true,
};

function toForm(settings: KanbanOrchestrationSettings | null): FormState {
  if (!settings) return emptyForm;
  return {
    orchestratorProfile: settings.orchestratorProfile,
    defaultAssignee: settings.defaultAssignee,
    autoDecompose: settings.autoDecompose,
    autoPromoteChildren: settings.autoPromoteChildren,
  };
}

function profileLabel(value: string, fallback: string) {
  return value || `Use resolved (${fallback || 'default'})`;
}

function SettingRow({ label, value, explicit }: { label: string; value: string | number | null; explicit?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2 text-right">
        <span className="text-xs font-medium">{value ?? 'unset'}</span>
        <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wide', explicit ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
          {explicit ? 'explicit' : 'resolved'}
        </span>
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-left hover:bg-accent/50"
    >
      <span className="text-xs font-medium">{label}</span>
      <span className={cn('h-5 w-9 rounded-full p-0.5 transition-colors', checked ? 'bg-primary' : 'bg-muted')}>
        <span className={cn('block h-4 w-4 rounded-full bg-background transition-transform', checked && 'translate-x-4')} />
      </span>
    </button>
  );
}

export function BoardsSettingsPanel({
  open,
  onClose,
  boards,
  activeBoard,
  onBoardChange,
  isMobile = false,
}: BoardsSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'boards' | 'settings'>('boards');
  const [profiles, setProfiles] = useState<BotProfile[]>(BOT_PROFILES);
  const [assignees, setAssignees] = useState<BotProfile[]>([]);
  const [orchestration, setOrchestration] = useState<KanbanOrchestrationSettings | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || activeTab !== 'settings') return;
    let cancelled = false;
    setLoadingSettings(true);
    Promise.all([kanbanApi.getProfiles(), kanbanApi.getAssignees(), kanbanApi.getOrchestration()])
      .then(([nextProfiles, nextAssignees, nextOrchestration]) => {
        if (cancelled) return;
        setProfiles(nextProfiles);
        setAssignees(nextAssignees);
        setOrchestration(nextOrchestration);
        setForm(toForm(nextOrchestration));
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : 'Failed to load Kanban settings'))
      .finally(() => !cancelled && setLoadingSettings(false));
    return () => {
      cancelled = true;
    };
  }, [open, activeTab]);

  const profileOptions = useMemo(() => {
    const byName = new Map<string, BotProfile>();
    [...profiles, ...assignees].forEach((profile) => byName.set(profile.name, profile));
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [profiles, assignees]);

  const saveSettings = async () => {
    const allowed = new Set(profileOptions.map((profile) => profile.name));
    for (const [label, value] of [
      ['orchestrator profile', form.orchestratorProfile],
      ['default assignee', form.defaultAssignee],
    ] as const) {
      if (value && !allowed.has(value)) {
        toast.error(`Unknown ${label}: ${value}`);
        return;
      }
    }

    setSaving(true);
    try {
      const next = await kanbanApi.updateOrchestration(form);
      setOrchestration(next);
      setForm(toForm(next));
      toast.success('Kanban orchestration settings saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const settingsSections = [
    { id: 'routing', label: 'Routing rules', icon: Radio, active: true },
    { id: 'profiles', label: 'Profiles / Bots', icon: Bot, active: true },
    { id: 'preferences', label: 'Advanced dispatcher config', icon: Sliders, active: true },
    { id: 'integrations', label: 'Integrations', icon: Plug, active: false },
    { id: 'diagnostics', label: 'Diagnostics', icon: Stethoscope, active: false },
  ];

  const content = (
    <div className="space-y-4">
      <div className="flex items-center gap-0 border-b border-border/50">
        {(['boards', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-3 py-2 text-xs font-medium capitalize transition-colors relative',
              activeTab === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab}
            {activeTab === tab && <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      {activeTab === 'boards' && (
        <div className="space-y-1">
          {boards.map((board) => (
            <button
              key={board.id}
              onClick={() => {
                onBoardChange(board);
                toast.success(`Switched to ${board.name}`);
              }}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors',
                board.id === activeBoard.id ? 'bg-accent' : 'hover:bg-accent/50'
              )}
            >
              <div className="flex items-center gap-2">
                <Star size={14} className={board.isDefault ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'} />
                <span className="text-sm">{board.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{board.taskCount}</span>
                <ChevronRight size={14} className="text-muted-foreground" />
              </div>
            </button>
          ))}
          <button
            onClick={() => toast.info('Create board coming soon')}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-accent/50 transition-colors mt-2"
          >
            <Plus size={14} />
            <span className="text-sm">New board</span>
          </button>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-card/40 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-semibold">Kanban orchestration</h4>
                <p className="text-[11px] text-muted-foreground">Safe API-backed fields only. Hermes config outside Kanban is not editable here.</p>
              </div>
              <button
                onClick={saveSettings}
                disabled={saving || loadingSettings}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground disabled:opacity-60"
              >
                <Save size={12} />
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>

            <div className="space-y-2">
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Orchestrator profile</span>
                <select
                  value={form.orchestratorProfile}
                  onChange={(event) => setForm((current) => ({ ...current, orchestratorProfile: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-2 py-2 text-xs"
                >
                  <option value="">{profileLabel('', orchestration?.resolvedOrchestratorProfile || '')}</option>
                  {profileOptions.map((profile) => <option key={profile.name} value={profile.name}>{profile.name}</option>)}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Default assignee</span>
                <select
                  value={form.defaultAssignee}
                  onChange={(event) => setForm((current) => ({ ...current, defaultAssignee: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-2 py-2 text-xs"
                >
                  <option value="">{profileLabel('', orchestration?.resolvedDefaultAssignee || '')}</option>
                  {profileOptions.map((profile) => <option key={profile.name} value={profile.name}>{profile.name}</option>)}
                </select>
              </label>
              <ToggleRow label="Auto decompose new tasks" checked={form.autoDecompose} onChange={(autoDecompose) => setForm((current) => ({ ...current, autoDecompose }))} />
              <ToggleRow label="Auto promote children" checked={form.autoPromoteChildren} onChange={(autoPromoteChildren) => setForm((current) => ({ ...current, autoPromoteChildren }))} />
            </div>

            {orchestration && (
              <div className="mt-3 grid gap-2">
                <SettingRow label="Resolved orchestrator" value={orchestration.resolvedOrchestratorProfile} explicit={orchestration.explicit.orchestrator_profile} />
                <SettingRow label="Resolved default assignee" value={orchestration.resolvedDefaultAssignee} explicit={orchestration.explicit.default_assignee} />
              </div>
            )}
          </div>

          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 px-1">Profiles / assignees</h4>
            <div className="space-y-1">
              {profileOptions.map((bot) => (
                <div key={bot.name} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(124, 92, 255, 0.15)' }}>
                      <Bot size={12} style={{ color: '#7C5CFF' }} />
                    </div>
                    <span className="text-sm">{bot.name}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{bot.taskCount ?? 0} tasks</span>
                </div>
              ))}
            </div>
          </div>

          {orchestration && (
            <details className="rounded-xl border border-border/50 bg-card/30 p-3">
              <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
                <Lock size={12} /> Advanced dispatcher config (read-only)
              </summary>
              <div className="mt-3 space-y-2">
                <SettingRow label="Simultaneous in-progress cap" value={orchestration.advanced.maxInProgress} explicit={orchestration.explicit.max_in_progress} />
                <SettingRow label="Live worker cap" value={orchestration.advanced.maxSpawn} explicit={orchestration.explicit.max_spawn} />
                <SettingRow label="Dispatch interval" value={orchestration.advanced.dispatchIntervalSeconds} explicit={orchestration.explicit.dispatch_interval_seconds} />
                <SettingRow label="Failure limit" value={orchestration.advanced.failureLimit} explicit={orchestration.explicit.failure_limit} />
                <SettingRow label="Stale timeout" value={orchestration.advanced.dispatchStaleTimeoutSeconds} explicit={orchestration.explicit.dispatch_stale_timeout_seconds} />
                <p className="pt-1 text-[11px] text-muted-foreground">Concurrency values are shown from the API but not saved by this panel yet; only safe orchestration routing fields are written.</p>
              </div>
            </details>
          )}

          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 px-1">Settings</h4>
            <div className="space-y-1">
              {settingsSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => !section.active && toast.info(`${section.label} coming soon`)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <section.icon size={14} className="text-muted-foreground" />
                    <span className="text-sm">{section.label}</span>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <SheetContent side="bottom" className="h-[85vh] p-0 bg-background border-t border-border rounded-t-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <span className="text-sm font-semibold">Hermes</span>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent transition-colors">
              <X size={18} />
            </button>
          </div>
          <div className="px-4 py-4 overflow-y-auto h-[calc(85vh-60px)]">{content}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[420px] p-0 bg-background border border-border max-h-[85vh] overflow-y-auto">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base">Board settings</DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-6">{content}</div>
      </DialogContent>
    </Dialog>
  );
}
