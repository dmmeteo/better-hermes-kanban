import type {
  Task,
  Board,
  BotProfile,
  CreateTaskData,
  TaskStatus,
  TaskComment,
} from './types';
import { mockTasks, boards, BOT_PROFILES, generateTaskId } from '@/data/mockTasks';

let tasks = [...mockTasks];

function delay(ms: number = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const kanbanApi = {
  // Board
  async getBoard(boardId?: string): Promise<{ tasks: Task[]; board: Board }> {
    await delay();
    const board = boards.find((b) => b.id === (boardId || 'board-1')) || boards[0];
    const boardTasks = tasks.filter((t) => t.boardId === board.id);
    return { tasks: boardTasks, board };
  },

  async getBoards(): Promise<Board[]> {
    await delay(200);
    return [...boards];
  },

  // Tasks
  async getTask(taskId: string): Promise<Task | null> {
    await delay();
    const task = tasks.find((t) => t.id === taskId);
    return task ? { ...task } : null;
  },

  async createTask(data: CreateTaskData): Promise<Task> {
    await delay(400);
    const newTask: Task = {
      id: generateTaskId(),
      title: data.title,
      description: data.description || '',
      status: data.status,
      priority: data.priority,
      assignee: data.assignee || null,
      boardId: 'board-1',
      parentIds: data.parentIds || [],
      commentCount: 0,
      linkCount: 0,
      latestSummary: null,
      summaryUpdatedAt: null,
      diagnostics: [],
      comments: [],
      activity: [
        {
          id: `a-${Date.now()}`,
          type: 'status_change',
          description: `Task created with status ${data.status}`,
          createdAt: new Date().toISOString(),
        },
      ],
      runs: [],
      linkedTasks: [],
      plannedAttachments: [],
      warningCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tasks = [...tasks, newTask];
    return { ...newTask };
  },

  async updateTask(taskId: string, data: Partial<Task>): Promise<Task> {
    await delay(300);
    const index = tasks.findIndex((t) => t.id === taskId);
    if (index === -1) throw new Error('Task not found');
    const updated = { ...tasks[index], ...data, updatedAt: new Date().toISOString() };
    if (data.status && data.status !== tasks[index].status) {
      updated.activity = [
        ...updated.activity,
        {
          id: `a-${Date.now()}`,
          type: 'status_change',
          description: `Status changed from ${tasks[index].status} to ${data.status}`,
          createdAt: new Date().toISOString(),
        },
      ];
    }
    tasks = tasks.map((t) => (t.id === taskId ? updated : t));
    return { ...updated };
  },

  async deleteTask(taskId: string): Promise<void> {
    await delay(300);
    tasks = tasks.filter((t) => t.id !== taskId);
  },

  // Comments
  async addComment(taskId: string, text: string): Promise<TaskComment> {
    await delay(300);
    const comment: TaskComment = {
      id: `c-${Date.now()}`,
      author: 'user',
      text,
      createdAt: new Date().toISOString(),
    };
    tasks = tasks.map((t) =>
      t.id === taskId
        ? { ...t, comments: [...t.comments, comment], commentCount: t.commentCount + 1 }
        : t
    );
    return comment;
  },

  // Actions
  async blockTask(taskId: string, reason: string): Promise<Task> {
    await delay(300);
    return this.updateTask(taskId, {
      status: 'blocked' as TaskStatus,
      activity: [
        ...tasks.find((t) => t.id === taskId)!.activity,
        {
          id: `a-${Date.now()}`,
          type: 'block' as const,
          description: `Blocked: ${reason}`,
          createdAt: new Date().toISOString(),
        },
      ],
    });
  },

  async reclaimTask(taskId: string): Promise<Task> {
    await delay(300);
    return this.updateTask(taskId, {
      status: 'todo' as TaskStatus,
      activity: [
        ...tasks.find((t) => t.id === taskId)!.activity,
        {
          id: `a-${Date.now()}`,
          type: 'reclaim' as const,
          description: 'Task reclaimed from Running',
          createdAt: new Date().toISOString(),
        },
      ],
    });
  },

  async specifyTask(taskId: string): Promise<Task> {
    await delay(300);
    return this.updateTask(taskId, {
      activity: [
        ...tasks.find((t) => t.id === taskId)!.activity,
        {
          id: `a-${Date.now()}`,
          type: 'specify' as const,
          description: 'Requirements specified',
          createdAt: new Date().toISOString(),
        },
      ],
    });
  },

  async decomposeTask(taskId: string): Promise<Task[]> {
    await delay(500);
    const parent = tasks.find((t) => t.id === taskId);
    if (!parent) throw new Error('Task not found');

    const subtasks: Task[] = [
      {
        ...parent,
        id: generateTaskId(),
        title: `${parent.title} - Part 1`,
        status: 'triage' as TaskStatus,
        parentIds: [taskId],
        activity: [
          {
            id: `a-${Date.now()}`,
            type: 'status_change' as const,
            description: `Created from decomposition of ${taskId}`,
            createdAt: new Date().toISOString(),
          },
        ],
        linkedTasks: [],
        comments: [],
        commentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        ...parent,
        id: generateTaskId(),
        title: `${parent.title} - Part 2`,
        status: 'triage' as TaskStatus,
        parentIds: [taskId],
        activity: [
          {
            id: `a-${Date.now() + 1}`,
            type: 'status_change' as const,
            description: `Created from decomposition of ${taskId}`,
            createdAt: new Date().toISOString(),
          },
        ],
        linkedTasks: [],
        comments: [],
        commentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    tasks = [...tasks, ...subtasks];
    return subtasks;
  },

  // Profiles
  async getProfiles(): Promise<BotProfile[]> {
    await delay(200);
    return [...BOT_PROFILES];
  },

  // Diagnostics
  async getDiagnostics(): Promise<{ taskCount: number; statusCounts: Record<string, number> }> {
    await delay(200);
    const statusCounts: Record<string, number> = {};
    tasks.forEach((t) => {
      statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
    });
    return { taskCount: tasks.length, statusCounts };
  },
};
