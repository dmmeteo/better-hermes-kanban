import type {
  NativeKanbanAssigneesResponseDto,
  NativeKanbanBoardResponseDto,
  NativeKanbanBoardsResponseDto,
  NativeKanbanOrchestrationResponseDto,
  NativeKanbanOrchestrationUpdateDto,
  NativeKanbanProfileDescribeAutoBody,
  NativeKanbanProfileDescribeBody,
  NativeKanbanProfileDescribeResponseDto,
  NativeKanbanProfilesResponseDto,
} from './nativeKanbanTypes';

const NATIVE_KANBAN_API_BASE = '/api/plugins/kanban';

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

export class NativeKanbanClientError extends Error {
  status?: number;

  constructor(message: string, options: { status?: number } = {}) {
    super(message);
    this.name = 'NativeKanbanClientError';
    this.status = options.status;
  }
}

async function requestNativeKanbanJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${NATIVE_KANBAN_API_BASE}${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (isObject(body)) message = asString(body.detail ?? body.error ?? body.message, message);
    } catch {
      // Keep the HTTP status text if the error body is not JSON.
    }
    throw new NativeKanbanClientError(message, { status: response.status });
  }

  return response.json() as Promise<T>;
}

export const nativeKanbanClient = {
  getBoards(): Promise<NativeKanbanBoardsResponseDto | unknown[]> {
    return requestNativeKanbanJson<NativeKanbanBoardsResponseDto | unknown[]>('/boards');
  },

  getBoard(
    boardId?: string,
    options?: { includeArchived?: boolean },
  ): Promise<NativeKanbanBoardResponseDto | unknown[]> {
    const params = new URLSearchParams();
    if (boardId) params.set('board', boardId);
    if (options?.includeArchived) params.set('include_archived', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    return requestNativeKanbanJson<NativeKanbanBoardResponseDto | unknown[]>(`/board${query}`);
  },

  getProfiles(): Promise<NativeKanbanProfilesResponseDto | unknown[]> {
    return requestNativeKanbanJson<NativeKanbanProfilesResponseDto | unknown[]>('/profiles');
  },

  updateProfileDescription(
    name: string,
    body: NativeKanbanProfileDescribeBody,
  ): Promise<NativeKanbanProfileDescribeResponseDto> {
    return requestNativeKanbanJson<NativeKanbanProfileDescribeResponseDto>(
      `/profiles/${encodeURIComponent(name)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
  },

  autoDescribeProfile(
    name: string,
    body: NativeKanbanProfileDescribeAutoBody,
  ): Promise<NativeKanbanProfileDescribeResponseDto> {
    return requestNativeKanbanJson<NativeKanbanProfileDescribeResponseDto>(
      `/profiles/${encodeURIComponent(name)}/describe-auto`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
  },

  getAssignees(boardId?: string): Promise<NativeKanbanAssigneesResponseDto | unknown[]> {
    const query = boardId ? `?board=${encodeURIComponent(boardId)}` : '';
    return requestNativeKanbanJson<NativeKanbanAssigneesResponseDto | unknown[]>(`/assignees${query}`);
  },

  getOrchestration(): Promise<NativeKanbanOrchestrationResponseDto> {
    return requestNativeKanbanJson<NativeKanbanOrchestrationResponseDto>('/orchestration');
  },

  updateOrchestration(input: NativeKanbanOrchestrationUpdateDto): Promise<NativeKanbanOrchestrationResponseDto> {
    return requestNativeKanbanJson<NativeKanbanOrchestrationResponseDto>('/orchestration', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  },
};
