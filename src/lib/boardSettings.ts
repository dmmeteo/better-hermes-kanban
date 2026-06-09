import type { TaskStatus } from './types';
import { STATUS_LABELS, NATIVE_STATUS_ORDER, SELECTABLE_TASK_STATUSES } from './types';
import type { TaskDetailPresentation } from '@/components/layout/TopBar';

export type BoardStatusLabels = Partial<Record<TaskStatus, string>>;

export interface BoardSettings {
  /** Column order — real API statuses only (NATIVE_STATUS_ORDER); never the UI-only `archived`. */
  statusOrder: TaskStatus[];
  /** Sparse map of user-renamed labels. Absent key = original STATUS_LABELS name. */
  statusLabels: BoardStatusLabels;
  /** Statuses whose column is collapsed on the desktop board. */
  collapsedColumns: TaskStatus[];
  detailPresentation: TaskDetailPresentation;
  /** When true, render a dedicated read-only `Archived` column and fetch archived tasks. */
  showArchived: boolean;
}

type StoredBoardSettings = Partial<BoardSettings>;
type StoredSettingsMap = Record<string, StoredBoardSettings | undefined>;

export const BOARD_SETTINGS_STORAGE_KEY = 'bhk.boardSettings.v2';
const LEGACY_BOARD_SETTINGS_STORAGE_KEY = 'bhk.boardSettings.v1';
export const LEGACY_DETAIL_PRESENTATION_KEY = 'bhk.taskDetailPresentation';
const SELECTED_BOARD_KEY = 'bhk.kanban.selectedBoard';

export function getSelectedBoardSlug(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(SELECTED_BOARD_KEY);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

export function setSelectedBoardSlug(slug: string | null | undefined): void {
  if (typeof window === 'undefined') return;
  try {
    if (slug) window.localStorage.setItem(SELECTED_BOARD_KEY, slug);
    else window.localStorage.removeItem(SELECTED_BOARD_KEY);
  } catch {
    // private mode / disabled storage — silently ignore
  }
}

const PRESENTATIONS: TaskDetailPresentation[] = ['drawer', 'modal', 'page'];

// Labels that earlier builds auto-injected as defaults. The v1→v2 migration strips
// these so columns fall back to their original status names unless the user renamed them.
const LEGACY_DEFAULT_STATUS_LABELS: BoardStatusLabels = {
  scheduled: 'Backlog',
  running: 'In progress',
  blocked: 'Suspended',
};

export const STATUS_HELPER_COPY: Record<TaskStatus, string> = {
  triage: 'Needs refinement or decomposition before it is ready for the queue.',
  scheduled: 'Parked for later / not now.',
  todo: 'Understood and refined, but not execution-ready yet.',
  ready: 'Can start now; prerequisites are satisfied.',
  running: 'A worker is actively processing it.',
  review: 'Waiting for human or orchestrator approval.',
  blocked: 'Paused and needs external action or unblock.',
  done: 'Complete.',
  archived: 'Archived and hidden from the active board unless shown.',
};

function isNativeStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (NATIVE_STATUS_ORDER as string[]).includes(value);
}

// Columns mirror real API statuses only: keep stored native statuses, drop any
// non-native value, and insert any missing native status at its canonical
// NATIVE_STATUS_ORDER index (so e.g. `review` lands between `blocked` and `done`
// for boards saved before it became a real column, rather than tacked onto the end).
function normalizeStatusOrder(value: unknown): TaskStatus[] {
  if (!Array.isArray(value)) return [...NATIVE_STATUS_ORDER];
  const ordered = value.filter(isNativeStatus);
  for (let i = 0; i < NATIVE_STATUS_ORDER.length; i++) {
    const status = NATIVE_STATUS_ORDER[i];
    if (!ordered.includes(status)) {
      ordered.splice(i, 0, status);
    }
  }
  return ordered;
}

// Sparse: keep only genuine renames (non-empty and different from the original name).
function normalizeStatusLabels(value: unknown): BoardStatusLabels {
  if (!value || typeof value !== 'object') return {};
  const labels: BoardStatusLabels = {};
  for (const status of NATIVE_STATUS_ORDER) {
    const label = (value as Record<string, unknown>)[status];
    if (typeof label === 'string' && label.trim() && label.trim() !== STATUS_LABELS[status]) {
      labels[status] = label.trim();
    }
  }
  return labels;
}

function normalizeCollapsed(value: unknown): TaskStatus[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isNativeStatus);
}

function normalizePresentation(value: unknown): TaskDetailPresentation {
  return PRESENTATIONS.includes(value as TaskDetailPresentation) ? (value as TaskDetailPresentation) : 'drawer';
}

function normalizeShowArchived(value: unknown): boolean {
  return Boolean(value);
}

function parseMap(raw: string | null): StoredSettingsMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

// One-time v1→v2: strip auto-injected legacy default labels so they revert to
// original names, while keeping real user renames.
function migrateV1ToV2(): StoredSettingsMap {
  const v1 = parseMap(window.localStorage.getItem(LEGACY_BOARD_SETTINGS_STORAGE_KEY));
  const migrated: StoredSettingsMap = {};
  for (const [boardId, stored] of Object.entries(v1)) {
    if (!stored) continue;
    let nextLabels: BoardStatusLabels | undefined;
    const labels = stored.statusLabels;
    if (labels && typeof labels === 'object') {
      nextLabels = {};
      for (const status of NATIVE_STATUS_ORDER) {
        const v = (labels as Record<string, unknown>)[status];
        if (
          typeof v === 'string' &&
          v.trim() &&
          v.trim() !== STATUS_LABELS[status] &&
          v.trim() !== LEGACY_DEFAULT_STATUS_LABELS[status]
        ) {
          nextLabels[status] = v.trim();
        }
      }
    }
    migrated[boardId] = { ...stored, statusLabels: nextLabels };
  }
  return migrated;
}

function readSettingsMap(): StoredSettingsMap {
  if (typeof window === 'undefined') return {};
  const rawV2 = window.localStorage.getItem(BOARD_SETTINGS_STORAGE_KEY);
  if (rawV2 != null) return parseMap(rawV2);
  // No v2 yet: lazily migrate from v1 (if present) and persist.
  const migrated = migrateV1ToV2();
  if (window.localStorage.getItem(LEGACY_BOARD_SETTINGS_STORAGE_KEY) != null) {
    try {
      window.localStorage.setItem(BOARD_SETTINGS_STORAGE_KEY, JSON.stringify(migrated));
    } catch {
      // ignore quota / serialization issues
    }
  }
  return migrated;
}

function writeSettingsMap(settings: StoredSettingsMap) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BOARD_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function defaultSettings(): BoardSettings {
  return {
    statusOrder: [...NATIVE_STATUS_ORDER],
    statusLabels: {},
    collapsedColumns: [],
    detailPresentation: 'drawer',
    showArchived: false,
  };
}

export function getBoardSettings(boardId?: string | null): BoardSettings {
  const defaults = defaultSettings();
  if (!boardId) return defaults;
  const stored = readSettingsMap()[boardId] || {};
  return {
    statusOrder: normalizeStatusOrder(stored.statusOrder),
    statusLabels: normalizeStatusLabels(stored.statusLabels),
    collapsedColumns: normalizeCollapsed(stored.collapsedColumns),
    detailPresentation: normalizePresentation(stored.detailPresentation),
    showArchived: normalizeShowArchived(stored.showArchived),
  };
}

export function saveBoardSettings(boardId: string | null | undefined, patch: Partial<BoardSettings>): BoardSettings {
  const current = getBoardSettings(boardId);
  const next: BoardSettings = {
    ...current,
    ...patch,
    statusOrder: patch.statusOrder ? normalizeStatusOrder(patch.statusOrder) : current.statusOrder,
    statusLabels: patch.statusLabels ? normalizeStatusLabels(patch.statusLabels) : current.statusLabels,
    collapsedColumns: patch.collapsedColumns ? normalizeCollapsed(patch.collapsedColumns) : current.collapsedColumns,
    detailPresentation: patch.detailPresentation ? normalizePresentation(patch.detailPresentation) : current.detailPresentation,
    showArchived: patch.showArchived !== undefined ? normalizeShowArchived(patch.showArchived) : current.showArchived,
  };
  if (boardId) {
    const settings = readSettingsMap();
    settings[boardId] = next;
    writeSettingsMap(settings);
  }
  return next;
}

export function migrateLegacyDetailPresentation(boardId?: string | null): BoardSettings {
  if (typeof window === 'undefined' || !boardId) return getBoardSettings(boardId);
  const current = readSettingsMap()[boardId];
  if (current?.detailPresentation) return getBoardSettings(boardId);
  const legacy = window.localStorage.getItem(LEGACY_DETAIL_PRESENTATION_KEY);
  if (legacy === 'modal' || legacy === 'page' || legacy === 'drawer') {
    return saveBoardSettings(boardId, { detailPresentation: legacy });
  }
  return getBoardSettings(boardId);
}

export function getOrderedStatuses(settings?: BoardSettings): TaskStatus[] {
  return normalizeStatusOrder(settings?.statusOrder);
}

// Columns to render on the board: the native status columns plus a trailing
// UI-only `archived` column when the board setting is enabled. Kept separate
// from getOrderedStatuses so `archived` never leaks into status dropdowns.
export function getBoardColumns(settings?: BoardSettings): TaskStatus[] {
  const columns = getOrderedStatuses(settings);
  return settings?.showArchived ? [...columns, 'archived'] : columns;
}

export function getStatusLabel(status: TaskStatus, settings?: BoardSettings): string {
  return settings?.statusLabels?.[status] || STATUS_LABELS[status] || status;
}

export function getStatusOptions(settings?: BoardSettings, statuses: TaskStatus[] = SELECTABLE_TASK_STATUSES) {
  return getOrderedStatuses(settings)
    .filter((status) => statuses.includes(status))
    .map((value) => ({ value, label: getStatusLabel(value, settings) }));
}
