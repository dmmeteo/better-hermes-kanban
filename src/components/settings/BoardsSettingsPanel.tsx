import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Star, Bot, ChevronRight, Radio, Plug, Sliders, Stethoscope, Save, Lock, Pencil, Archive } from 'lucide-react';
import type { Board, BotProfile, KanbanOrchestrationSettings } from '@/lib/types';
import { BOT_PROFILES } from '@/lib/types';
import { kanbanApi } from '@/lib/kanbanApi';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface BoardsSettingsPanelProps {
  open?: boolean;
  onBack?: () => void;
  boards: Board[];
  activeBoard: Board;
  onBoardChange: (board: Board) => void;
  onBoardsRefresh?: (preferredBoardId?: string) => Promise<void>;
}

type FormState = {
  orchestratorProfile: string;
  defaultAssignee: string;
  autoDecompose: boolean;
  autoPromoteChildren: boolean;
};

type BoardFormState = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  defaultWorkdir: string;
};

const emptyForm: FormState = {
  orchestratorProfile: '',
  defaultAssignee: '',
  autoDecompose: true,
  autoPromoteChildren: true,
};

const emptyBoardForm: BoardFormState = {
  slug: '',
  name: '',
  description: '',
  icon: '',
  color: '',
  defaultWorkdir: '',
};

function boardToForm(board?: Board): BoardFormState {
  if (!board) return emptyBoardForm;
  return {
    slug: board.id,
    name: board.name || board.id,
    description: board.description || '',
    icon: board.icon || '',
    color: board.color || '',
    defaultWorkdir: '',
  };
}

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
  open = true,
  onBack,
  boards,
  activeBoard,
  onBoardChange,
  onBoardsRefresh,
}: BoardsSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'boards' | 'settings'>('boards');
  const [profiles, setProfiles] = useState<BotProfile[]>(BOT_PROFILES);
  const [assignees, setAssignees] = useState<BotProfile[]>([]);
  const [orchestration, setOrchestration] = useState<KanbanOrchestrationSettings | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [boardMode, setBoardMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedBoardId, setSelectedBoardId] = useState(activeBoard.id);
  const [boardForm, setBoardForm] = useState<BoardFormState>(emptyBoardForm);
  const [boardSaving, setBoardSaving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedBoard = boards.find((board) => board.id === selectedBoardId) || activeBoard;

  useEffect(() => {
    if (!open) return;
    setSelectedBoardId(activeBoard.id);
    if (boardMode === 'list') setBoardForm(boardToForm(activeBoard));
  }, [activeBoard, boardMode, open]);

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

  const refreshBoards = async (preferredBoardId?: string) => {
    if (onBoardsRefresh) await onBoardsRefresh(preferredBoardId);
  };

  const openCreateBoard = () => {
    setBoardMode('create');
    setConfirmArchive(false);
    setBoardForm(emptyBoardForm);
  };

  const openEditBoard = (board: Board) => {
    setSelectedBoardId(board.id);
    setBoardMode('edit');
    setConfirmArchive(false);
    setBoardForm(boardToForm(board));
  };

  const saveBoard = async () => {
    const slug = boardForm.slug.trim().toLowerCase();
    const name = boardForm.name.trim();
    if (boardMode === 'create' && !slug) {
      toast.error('Board slug is required');
      return;
    }
    if (!name) {
      toast.error('Board name is required');
      return;
    }
    setBoardSaving(true);
    try {
      const payload = {
        name,
        description: boardForm.description.trim(),
        icon: boardForm.icon.trim(),
        color: boardForm.color.trim(),
        defaultWorkdir: boardForm.defaultWorkdir.trim(),
      };
      const next = boardMode === 'create'
        ? await kanbanApi.createBoard({ slug, ...payload })
        : await kanbanApi.updateBoard(selectedBoard.id, payload);
      await refreshBoards(next.id);
      setSelectedBoardId(next.id);
      setBoardForm(boardToForm(next));
      setBoardMode('edit');
      toast.success(boardMode === 'create' ? `Created ${next.name}` : `Updated ${next.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save board');
    } finally {
      setBoardSaving(false);
    }
  };

  const archiveBoard = async () => {
    setBoardSaving(true);
    try {
      await kanbanApi.deleteBoard(selectedBoard.id);
      await refreshBoards();
      setBoardMode('list');
      setConfirmArchive(false);
      toast.success(`Archived ${selectedBoard.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to archive board');
    } finally {
      setBoardSaving(false);
    }
  };

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
          {boardMode !== 'list' && (
            <div className="mb-3 space-y-3 rounded-xl border border-border/50 bg-card/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold">{boardMode === 'create' ? 'Create board' : 'Edit board metadata'}</h4>
                  <p className="text-[11px] text-muted-foreground">Guarded API-backed board management. Archive requires confirmation.</p>
                </div>
                <button onClick={() => setBoardMode('list')} className="rounded-lg px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent">Back</button>
              </div>
              <div className="grid gap-2">
                {boardMode === 'create' && (
                  <label className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Slug</span>
                    <input value={boardForm.slug} onChange={(event) => setBoardForm((current) => ({ ...current, slug: event.target.value }))} placeholder="my-board" className="w-full rounded-lg border border-border bg-background px-2 py-2 text-xs" />
                  </label>
                )}
                <label className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Name</span>
                  <input value={boardForm.name} onChange={(event) => setBoardForm((current) => ({ ...current, name: event.target.value }))} placeholder="Board name" className="w-full rounded-lg border border-border bg-background px-2 py-2 text-xs" />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Description</span>
                  <textarea value={boardForm.description} onChange={(event) => setBoardForm((current) => ({ ...current, description: event.target.value }))} rows={2} className="w-full rounded-lg border border-border bg-background px-2 py-2 text-xs" />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Icon</span>
                    <input value={boardForm.icon} onChange={(event) => setBoardForm((current) => ({ ...current, icon: event.target.value }))} placeholder="kanban" className="w-full rounded-lg border border-border bg-background px-2 py-2 text-xs" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Color</span>
                    <input value={boardForm.color} onChange={(event) => setBoardForm((current) => ({ ...current, color: event.target.value }))} placeholder="#7C5CFF" className="w-full rounded-lg border border-border bg-background px-2 py-2 text-xs" />
                  </label>
                </div>
                <label className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Default workdir</span>
                  <input value={boardForm.defaultWorkdir} onChange={(event) => setBoardForm((current) => ({ ...current, defaultWorkdir: event.target.value }))} placeholder="/home/me/projects/..." className="w-full rounded-lg border border-border bg-background px-2 py-2 text-xs" />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={saveBoard} disabled={boardSaving} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground disabled:opacity-60"><Save size={12} />{boardSaving ? 'Saving…' : 'Save board'}</button>
                {boardMode === 'edit' && !confirmArchive && <button onClick={() => setConfirmArchive(true)} disabled={boardSaving} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-2.5 py-1.5 text-[11px] font-medium text-destructive"><Archive size={12} />Archive…</button>}
              </div>
              {boardMode === 'edit' && confirmArchive && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-[11px]">
                  <p className="mb-2 font-medium text-destructive">Archive “{selectedBoard.name}”? Tasks remain in the board database, but the board is hidden from normal lists.</p>
                  <div className="flex gap-2"><button onClick={archiveBoard} disabled={boardSaving} className="rounded-md bg-destructive px-2 py-1 text-destructive-foreground">Confirm archive</button><button onClick={() => setConfirmArchive(false)} className="rounded-md border border-border px-2 py-1">Cancel</button></div>
                </div>
              )}
            </div>
          )}
          {boards.map((board) => (
            <button
              key={board.id}
              onClick={() => {
                onBoardChange(board);
                openEditBoard(board);
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
                <Pencil size={14} className="text-muted-foreground" />
              </div>
            </button>
          ))}
          <button
            onClick={openCreateBoard}
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

  return (
    <section className="h-full overflow-y-auto bg-background" data-testid="settings-page">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-4 px-4 py-4 md:px-6 md:py-6">
        <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                aria-label="Back to board"
                data-testid="settings-back-button"
                onClick={onBack}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card hover:bg-accent"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Hermes Kanban</p>
              <h1 className="text-lg font-semibold md:text-2xl">Settings</h1>
            </div>
          </div>
          <div className="hidden rounded-full border border-border/50 px-3 py-1 text-xs text-muted-foreground md:block">
            {activeBoard.name || activeBoard.id}
          </div>
        </div>

        <div className="max-w-3xl pb-8">{content}</div>
      </div>
    </section>
  );
}
