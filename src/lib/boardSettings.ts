import type { TaskStatus } from './types';
import { STATUS_LABELS, STATUS_ORDER, SELECTABLE_TASK_STATUSES } from './types';
import type { TaskDetailPresentation } from '@/components/layout/TopBar';

export type BoardStatusLabels = Partial<Record<TaskStatus, string>>;

export interface BoardSettings {
  statusOrder: TaskStatus[];
  statusLabels: BoardStatusLabels;
  detailPresentation: TaskDetailPresentation;
}

type StoredBoardSettings = Partial<BoardSettings>;
type StoredSettingsMap = Record<string, StoredBoardSettings | undefined>;

export const BOARD_SETTINGS_STORAGE_KEY = 'bhk.boardSettings.v1';
export const LEGACY_DETAIL_PRESENTATION_KEY = 'bhk.taskDetailPresentation';

const PRESENTATIONS: TaskDetailPresentation[] = ['drawer', 'modal', 'page'];
const DEFAULT_STATUS_LABELS: BoardStatusLabels = {
  ...STATUS_LABELS,
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
};

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (STATUS_ORDER as string[]).includes(value);
}

function normalizeStatusOrder(value: unknown): TaskStatus[] {
  if (!Array.isArray(value)) return [...STATUS_ORDER];
  const ordered = value.filter(isTaskStatus);
  const missing = STATUS_ORDER.filter((status) => !ordered.includes(status));
  return [...ordered, ...missing];
}

function normalizeStatusLabels(value: unknown): BoardStatusLabels {
  if (!value || typeof value !== 'object') return { ...DEFAULT_STATUS_LABELS };
  const labels: BoardStatusLabels = { ...DEFAULT_STATUS_LABELS };
  for (const status of STATUS_ORDER) {
    const label = (value as Record<string, unknown>)[status];
    if (typeof label === 'string' && label.trim()) labels[status] = label.trim();
  }
  return labels;
}

function normalizePresentation(value: unknown): TaskDetailPresentation {
  return PRESENTATIONS.includes(value as TaskDetailPresentation) ? (value as TaskDetailPresentation) : 'drawer';
}

function readSettingsMap(): StoredSettingsMap {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BOARD_SETTINGS_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeSettingsMap(settings: StoredSettingsMap) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BOARD_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function defaultSettings(): BoardSettings {
  return {
    statusOrder: [...STATUS_ORDER],
    statusLabels: { ...DEFAULT_STATUS_LABELS },
    detailPresentation: 'drawer',
  };
}

export function getBoardSettings(boardId?: string | null): BoardSettings {
  const defaults = defaultSettings();
  if (!boardId) return defaults;
  const stored = readSettingsMap()[boardId] || {};
  return {
    statusOrder: normalizeStatusOrder(stored.statusOrder),
    statusLabels: normalizeStatusLabels(stored.statusLabels),
    detailPresentation: normalizePresentation(stored.detailPresentation),
  };
}

export function saveBoardSettings(boardId: string | null | undefined, patch: Partial<BoardSettings>): BoardSettings {
  const next = {
    ...getBoardSettings(boardId),
    ...patch,
    statusOrder: patch.statusOrder ? normalizeStatusOrder(patch.statusOrder) : getBoardSettings(boardId).statusOrder,
    statusLabels: patch.statusLabels ? normalizeStatusLabels(patch.statusLabels) : getBoardSettings(boardId).statusLabels,
    detailPresentation: patch.detailPresentation ? normalizePresentation(patch.detailPresentation) : getBoardSettings(boardId).detailPresentation,
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

export function getStatusLabel(status: TaskStatus, settings?: BoardSettings): string {
  return settings?.statusLabels?.[status] || DEFAULT_STATUS_LABELS[status] || STATUS_LABELS[status] || status;
}

export function getStatusOptions(settings?: BoardSettings, statuses: TaskStatus[] = SELECTABLE_TASK_STATUSES) {
  return getOrderedStatuses(settings)
    .filter((status) => statuses.includes(status))
    .map((value) => ({ value, label: getStatusLabel(value, settings) }));
}
