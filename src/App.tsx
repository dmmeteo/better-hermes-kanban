import { useState, useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Toaster, toast } from 'sonner';
import type { Task, Board, BotProfile, CreateTaskData, LinkedTask, UpdateTaskData } from '@/lib/types';
import { isStatusCreateSelectable, isStatusSelectable } from '@/lib/types';
import { getBoardSettings, migrateLegacyDetailPresentation, saveBoardSettings, type BoardSettings } from '@/lib/boardSettings';
import { kanbanApi } from '@/lib/kanbanApi';
import { TopBar, type TaskDetailPresentation } from '@/components/layout/TopBar';
import { MobileCreateTaskFab } from '@/components/layout/MobileCreateTaskFab';
import { DesktopFooterBar } from '@/components/layout/DesktopFooterBar';
import { BoardView } from '@/components/board/BoardView';
import { NewBoardModal } from '@/components/board/NewBoardModal';
import { TaskDetailSheet } from '@/components/task/TaskDetailSheet';
import { TaskDetailModal } from '@/components/task/TaskDetailModal';
import { TaskDetailPage } from '@/components/task/TaskDetailPage';
import { TaskQuickCapture } from '@/components/task/TaskQuickCapture';
import { BoardsSettingsPanel, type BoardSettingsMode } from '@/components/settings/BoardsSettingsPanel';
import { TaskSearchPage } from '@/components/search/TaskSearchPage';
import { DataViewSearchAndFilter, type DataViewSearchFilters } from '@/components/search/DataViewSearchAndFilter';
import { useIsMobile } from '@/hooks/use-mobile';
import './App.css';

function taskPath(taskId: string) {
  return `/tasks/${encodeURIComponent(taskId)}`;
}

function boardPath(boardId?: string | null) {
  return boardId ? `/boards/${encodeURIComponent(boardId)}` : '/';
}

function searchPath(query: string, filters: DataViewSearchFilters = {}) {
  const params = new URLSearchParams();
  const trimmed = query.trim();
  if (trimmed) params.set('q', trimmed);
  (['board', 'status', 'assignee', 'priority'] as const).forEach((key) => {
    const value = filters[key]?.replace(/^!/, '');
    if (value) params.set(key, value);
  });
  return `/search${params.toString() ? `?${params.toString()}` : ''}`;
}

const EXACT_TASK_ID = /^t_[0-9a-f]{8}$/i;

function normalizeExactTaskId(value: string) {
  return value.trim().toLowerCase();
}

function mergeTaskUpdate(existing: Task, updated: Task): Task {
  return {
    ...existing,
    ...updated,
    comments: updated.comments.length > 0 ? updated.comments : existing.comments,
    commentCount: updated.comments.length > 0 ? updated.commentCount : Math.max(existing.commentCount, updated.commentCount),
    activity: updated.activity.length > 0 ? updated.activity : existing.activity,
    runs: updated.runs.length > 0 ? updated.runs : existing.runs,
    workerLog: updated.workerLog ?? existing.workerLog,
    linkedTasks: updated.linkedTasks.length > 0 ? updated.linkedTasks : existing.linkedTasks,
    linkCount: updated.linkedTasks.length > 0 ? updated.linkCount : Math.max(existing.linkCount, updated.linkCount),
    diagnostics: updated.diagnostics.length > 0 ? updated.diagnostics : existing.diagnostics,
    warningCount: updated.diagnostics.length > 0 ? updated.warningCount : Math.max(existing.warningCount, updated.warningCount),
    latestSummary: updated.latestSummary ?? existing.latestSummary,
    summaryUpdatedAt: updated.summaryUpdatedAt ?? existing.summaryUpdatedAt,
  };
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilters, setSearchFilters] = useState<DataViewSearchFilters>({});
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewBoardOpen, setIsNewBoardOpen] = useState(false);
  const [settingsMode, setSettingsMode] = useState<BoardSettingsMode>('settings');
  const [boardSettings, setBoardSettings] = useState<BoardSettings>(() => getBoardSettings(null));
  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'live' | 'fallback'>('live');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, setUpdatingTaskId] = useState<string | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [assignees, setAssignees] = useState<BotProfile[]>([]);
  const [homeChannels, setHomeChannels] = useState<{ telegram: boolean; discord: boolean }>({ telegram: false, discord: false });
  const isMobile = useIsMobile();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const legacyBoardIdFromUrl = searchParams.get('board') || undefined;
  const boardIdFromPath = useMemo(() => {
    const match = location.pathname.match(/^\/boards\/([^/]+)\/?$/);
    return match?.[1] ? decodeURIComponent(match[1]) : undefined;
  }, [location.pathname]);
  const boardIdFromUrl = boardIdFromPath || legacyBoardIdFromUrl;
  const routeTaskId = useMemo(() => {
    const match = location.pathname.match(/^\/tasks\/([^/]+)\/?$/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }, [location.pathname]);
  const isTaskPage = !!routeTaskId;
  const isSettingsPage = location.pathname === '/settings' || location.pathname === '/settings/';
  const isTaskSearchPage = location.pathname === '/tasks' || location.pathname === '/tasks/' || location.pathname === '/search' || location.pathname === '/search/';
  const detailPresentation = boardSettings.detailPresentation;
  const activeDetailPresentation: TaskDetailPresentation = isTaskPage ? 'page' : detailPresentation;

  const loadBoardData = useCallback(async (preferredBoardId?: string) => {
    try {
      setIsLoading(true);
      const boardsResult = await kanbanApi.getBoards();
      const preferredBoard =
        (preferredBoardId ? boardsResult.boards.find((board) => board.id === preferredBoardId) : null) ||
        boardsResult.boards.find((board) => board.id === 'better-hermes-kanban') ||
        boardsResult.boards.find((board) => board.isDefault) ||
        boardsResult.boards[0];
      const boardData = await kanbanApi.getBoard(preferredBoard?.id);
      setTasks(boardData.tasks);
      setBoards(boardsResult.boards);
      setActiveBoard(boardData.board);
      setDataSource(boardData.source === 'fallback' || boardsResult.source === 'fallback' ? 'fallback' : 'live');
      setLoadError(boardData.source === 'fallback' || boardsResult.source === 'fallback' ? 'Live Kanban API unavailable; showing offline demo data.' : null);
      try {
        const assigneeResult = await kanbanApi.getAssignees(preferredBoard?.id);
        setAssignees(assigneeResult);
      } catch {
        setAssignees([]);
      }
      return boardData.board;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load board data';
      setLoadError(message);
      toast.error(message);
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadTaskPageData = useCallback(async (taskId: string) => {
    try {
      setIsLoading(true);
      const lookupBoardId = boardIdFromUrl;
      const [boardsResult, directTask] = await Promise.all([
        kanbanApi.getBoards(),
        kanbanApi.getTask(taskId, lookupBoardId),
      ]);
      const taskBoardId = directTask?.boardId || boardIdFromUrl;
      const boardData = await kanbanApi.getBoard(taskBoardId);
      const mergedTasks = directTask
        ? boardData.tasks.some((task) => task.id === directTask.id)
          ? boardData.tasks.map((task) => (task.id === directTask.id ? mergeTaskUpdate(task, directTask) : task))
          : [directTask, ...boardData.tasks]
        : boardData.tasks;
      setTasks(mergedTasks);
      setBoards(boardsResult.boards);
      setActiveBoard(boardData.board);
      setSelectedTaskId(taskId);
      setDataSource(boardData.source === 'fallback' || boardsResult.source === 'fallback' ? 'fallback' : 'live');
      setLoadError(boardData.source === 'fallback' || boardsResult.source === 'fallback' ? 'Live Kanban API unavailable; showing offline demo data.' : null);
      try {
        setAssignees(await kanbanApi.getAssignees(taskBoardId));
      } catch {
        setAssignees([]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : `Task ${taskId} not found`;
      setLoadError(message);
      toast.error(message);
      await loadBoardData(boardIdFromUrl);
      setSelectedTaskId(taskId);
    } finally {
      setIsLoading(false);
    }
  }, [boardIdFromUrl, loadBoardData]);

  // Load route data
  useEffect(() => {
    if (isSettingsPage) {
      setSettingsMode('settings');
      setIsNewBoardOpen(false);
      setIsSettingsOpen(true);
      let cancelled = false;
      loadBoardData(boardIdFromUrl).then((resolvedBoard) => {
        if (cancelled || !resolvedBoard) return;
        navigate(boardPath(resolvedBoard.id), { replace: true });
      });
      return () => {
        cancelled = true;
      };
    }
    if (isTaskSearchPage) {
      loadBoardData(boardIdFromUrl);
      return;
    }
    if (legacyBoardIdFromUrl && !routeTaskId && !boardIdFromPath) {
      navigate(boardPath(legacyBoardIdFromUrl), { replace: true });
      return;
    }
    if (routeTaskId) {
      loadTaskPageData(routeTaskId);
      return;
    }
    loadBoardData(boardIdFromUrl);
  }, [boardIdFromPath, boardIdFromUrl, isSettingsPage, isTaskSearchPage, legacyBoardIdFromUrl, loadBoardData, loadTaskPageData, navigate, routeTaskId]);

  useEffect(() => {
    setBoardSettings(migrateLegacyDetailPresentation(activeBoard?.id));
  }, [activeBoard?.id]);

  useEffect(() => {
    if (routeTaskId) {
      setSelectedTaskId(routeTaskId);
    } else if (detailPresentation === 'page') {
      setSelectedTaskId(null);
    }
  }, [detailPresentation, routeTaskId]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  useEffect(() => {
    if (!selectedTaskId || isTaskPage) return;
    let cancelled = false;
    kanbanApi.getTask(selectedTaskId)
      .then((detailTask) => {
        if (cancelled || !detailTask) return;
        setTasks((current) => current.map((task) => (task.id === detailTask.id ? mergeTaskUpdate(task, detailTask) : task)));
      })
      .catch(() => {
        // Board cards can still open from list data; detail hydration is best-effort for overlay tabs.
      });
    return () => {
      cancelled = true;
    };
  }, [isTaskPage, selectedTaskId]);

  useEffect(() => {
    if (!selectedTaskId || !activeBoard) {
      setHomeChannels({ telegram: false, discord: false });
      return;
    }
    let cancelled = false;
    kanbanApi.getHomeChannels(selectedTaskId, activeBoard.id).then((state) => {
      if (!cancelled) setHomeChannels(state);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedTaskId, activeBoard]);

  useEffect(() => {
    const appSuffix = 'BHK';
    if (selectedTask) {
      document.title = `🪽 ${selectedTask.id} · ${selectedTask.title} — ${appSuffix}`;
      return;
    }
    if (isTaskSearchPage) {
      document.title = `🪽 Task search — ${appSuffix}`;
      return;
    }
    if (routeTaskId) {
      document.title = `🪽 ${routeTaskId} — ${appSuffix}`;
      return;
    }
    if (activeBoard) {
      const board = boards.find((item) => item.id === activeBoard.id) || activeBoard;
      const count = board.taskCount === 1 ? '1 task' : `${board.taskCount} tasks`;
      document.title = `🪽 ${board.name || board.id} · ${count} — ${appSuffix}`;
      return;
    }
    document.title = `🪽 ${appSuffix}`;
  }, [activeBoard, boards, isTaskSearchPage, routeTaskId, selectedTask]);

  const handleTaskClick = useCallback((task: Task) => {
    if (detailPresentation === 'page') {
      navigate(taskPath(task.id));
      return;
    }
    setSelectedTaskId(task.id);
  }, [detailPresentation, navigate]);

  const handleOpenSearchTask = useCallback((taskId: string) => {
    navigate(taskPath(taskId));
  }, [navigate]);

  const handleGlobalSearch = useCallback(async (query?: string, filters: DataViewSearchFilters = searchFilters) => {
    const trimmed = (query ?? searchQuery).trim();
    const exactTaskId = normalizeExactTaskId(trimmed);
    if (EXACT_TASK_ID.test(exactTaskId)) {
      try {
        const response = await kanbanApi.searchTasks({ q: exactTaskId, limit: 20, sort: 'relevance' });
        const exactMatches = response.results.filter((result) => result.id.toLowerCase() === exactTaskId);
        if (exactMatches.length === 1) {
          const match = exactMatches[0];
          toast.success('Opened exact task match');
          navigate(taskPath(match.id));
          return;
        }
      } catch {
        // Fall through to the shareable search page where the bridge error is shown in context.
      }
    }
    navigate(searchPath(trimmed, filters));
  }, [navigate, searchFilters, searchQuery]);

  const handleSearchFiltersChange = useCallback((nextFilters: DataViewSearchFilters) => {
    setSearchFilters(nextFilters);
    if (isTaskSearchPage) {
      navigate(searchPath(searchQuery, nextFilters), { replace: true });
    }
  }, [isTaskSearchPage, navigate, searchQuery]);

  const handleCloseDetail = useCallback(() => {
    if (isTaskPage) {
      navigate(boardPath(activeBoard?.id));
      return;
    }
    setSelectedTaskId(null);
  }, [activeBoard, isTaskPage, navigate]);

  const handleDetailPresentationChange = useCallback((presentation: TaskDetailPresentation) => {
    setBoardSettings(saveBoardSettings(activeBoard?.id, { detailPresentation: presentation }));
    if (presentation === 'page' && selectedTask) {
      navigate(taskPath(selectedTask.id));
      return;
    }
    if (isTaskPage && routeTaskId && presentation !== 'page') {
      navigate(boardPath(activeBoard?.id));
      setSelectedTaskId(routeTaskId);
    }
  }, [activeBoard, isTaskPage, navigate, routeTaskId, selectedTask]);

  const refetchActiveBoard = useCallback(async (board: Board) => {
    const data = await kanbanApi.getBoard(board.id);
    setTasks(data.tasks);
    setActiveBoard(data.board);
    setDataSource(data.source);
    setLoadError(data.source === 'fallback' ? 'Live Kanban API unavailable; showing offline demo data.' : null);
  }, []);

  const updateSelectedTask = useCallback(
    async (patch: UpdateTaskData) => {
      if (!selectedTask || !activeBoard) return;
      if (patch.status && !isStatusSelectable(patch.status)) {
        toast.error('Running status is dispatcher-owned and cannot be set manually');
        return;
      }
      const taskId = selectedTask.id;
      const snapshot = tasks;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                ...(patch.title !== undefined ? { title: patch.title } : {}),
                ...(patch.description !== undefined ? { description: patch.description } : {}),
                ...(patch.status !== undefined ? { status: patch.status } : {}),
                ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
                ...(patch.assignee !== undefined ? { assignee: patch.assignee } : {}),
              }
            : t,
        ),
      );
      try {
        setUpdatingTaskId(taskId);
        await kanbanApi.updateTask(taskId, patch, activeBoard.id);
        await refetchActiveBoard(activeBoard);
      } catch (error) {
        setTasks(snapshot);
        const message = error instanceof Error ? error.message : 'Failed to update task';
        toast.error(message);
        throw error;
      } finally {
        setUpdatingTaskId(null);
      }
    },
    [activeBoard, refetchActiveBoard, selectedTask, tasks]
  );

  const handleNotify = useCallback(
    async (channel: 'telegram' | 'discord') => {
      if (!selectedTask || !activeBoard) return;
      const result = await kanbanApi.notifyTask(selectedTask.id, channel, activeBoard.id);
      if (!result.ok) {
        throw new Error(result.message || `Failed to notify ${channel}`);
      }
      const next = await kanbanApi.getHomeChannels(selectedTask.id, activeBoard.id);
      setHomeChannels(next);
    },
    [activeBoard, selectedTask],
  );

  const handleSpecify = useCallback(async () => {
    if (!selectedTask || !activeBoard) return;
    try {
      setUpdatingTaskId(selectedTask.id);
      await kanbanApi.specifyTask(selectedTask.id, activeBoard.id);
      await refetchActiveBoard(activeBoard);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to specify task';
      toast.error(message);
      throw error;
    } finally {
      setUpdatingTaskId(null);
    }
  }, [activeBoard, refetchActiveBoard, selectedTask]);

  const handleDecompose = useCallback(async () => {
    if (!selectedTask || !activeBoard) return;
    try {
      setUpdatingTaskId(selectedTask.id);
      await kanbanApi.decomposeTask(selectedTask.id, activeBoard.id);
      await refetchActiveBoard(activeBoard);
      toast.success('Task action applied');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to run task action';
      toast.error(message);
      throw error;
    } finally {
      setUpdatingTaskId(null);
    }
  }, [activeBoard, refetchActiveBoard, selectedTask]);

  const handleCreateTask = useCallback(
    async (data: CreateTaskData) => {
      if (!activeBoard) return;
      if (!isStatusCreateSelectable(data.status)) {
        toast.error('Choose a safe starting status: triage, todo, scheduled, ready, or blocked');
        return;
      }
      if (data.workspacePath && !data.workspacePath.startsWith('/')) {
        toast.error('Workspace path must be absolute');
        return;
      }
      if (!window.confirm(`Create this task on board ${activeBoard.name || activeBoard.id}?`)) {
        return;
      }
      try {
        setIsCreatingTask(true);
        const created = await kanbanApi.createTask(data, activeBoard.id);
        await refetchActiveBoard(activeBoard);
        setIsQuickCaptureOpen(false);
        toast.success(`Task ${created.id} created`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create task';
        toast.error(message);
        throw error;
      } finally {
        setIsCreatingTask(false);
      }
    },
    [activeBoard, refetchActiveBoard]
  );

  const handleLinkTask = useCallback(
    async (targetTaskId: string, relation: 'parent' | 'child') => {
      if (!selectedTask || !activeBoard) return;
      if (targetTaskId.toLowerCase() === selectedTask.id.toLowerCase()) {
        toast.error('Cannot link a task to itself');
        return;
      }
      const duplicate = selectedTask.linkedTasks.some((link) => link.relation === relation && link.taskId.toLowerCase() === targetTaskId.toLowerCase());
      if (duplicate) {
        toast.error('That task is already linked in this group');
        return;
      }
      try {
        setUpdatingTaskId(selectedTask.id);
        await kanbanApi.linkTask(selectedTask.id, targetTaskId, relation, activeBoard.id);
        await refetchActiveBoard(activeBoard);
        toast.success(`Linked ${targetTaskId}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to link task';
        toast.error(message);
        throw error;
      } finally {
        setUpdatingTaskId(null);
      }
    },
    [activeBoard, refetchActiveBoard, selectedTask]
  );

  const handleUnlinkTask = useCallback(
    async (link: LinkedTask) => {
      if (!selectedTask || !activeBoard) return;
      const parentId = link.relation === 'parent' ? link.taskId : selectedTask.id;
      const childId = link.relation === 'parent' ? selectedTask.id : link.taskId;
      const result = await kanbanApi.unlinkTask(parentId, childId, activeBoard.id);
      if (!result.ok) {
        throw new Error(result.message || 'Failed to unlink');
      }
      await refetchActiveBoard(activeBoard);
    },
    [activeBoard, refetchActiveBoard, selectedTask],
  );

  const handleAddComment = useCallback(
    async (text: string) => {
      if (!selectedTask || !activeBoard) return;
      try {
        setUpdatingTaskId(selectedTask.id);
        await kanbanApi.addComment(selectedTask.id, text, activeBoard.id);
        await refetchActiveBoard(activeBoard);
        toast.success('Comment added');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add comment';
        toast.error(message);
        throw error;
      } finally {
        setUpdatingTaskId(null);
      }
    },
    [activeBoard, refetchActiveBoard, selectedTask]
  );

  const handleBoardChange = useCallback(
    async (board: Board) => {
      try {
        setIsLoading(true);
        const data = await kanbanApi.getBoard(board.id);
        setTasks(data.tasks);
        setActiveBoard(data.board);
        setDataSource(data.source);
        setLoadError(data.source === 'fallback' ? 'Live Kanban API unavailable; showing offline demo data.' : null);
        navigate(boardPath(board.id));
        setSelectedTaskId(null);
        try {
          setAssignees(await kanbanApi.getAssignees(board.id));
        } catch {
          setAssignees([]);
        }
      } catch {
        toast.error('Failed to switch board');
      } finally {
        setIsLoading(false);
      }
    },
    [navigate]
  );

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading Hermes Kanban...</span>
        </div>
      </div>
    );
  }

  if (!activeBoard) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <span className="text-sm text-muted-foreground">No board available</span>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-background overflow-hidden">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#141824',
            border: '1px solid #252D3D',
            color: '#E8ECF1',
          },
        }}
      />

      {/* Top Bar */}
      <TopBar
          boards={boards}
          assignees={assignees}
          activeBoard={activeBoard}
          onBoardChange={handleBoardChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchFilters={searchFilters}
          onSearchFiltersChange={handleSearchFiltersChange}
          onSearchSubmit={handleGlobalSearch}
          onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
          onOpenSettings={() => { setIsNewBoardOpen(false); setSettingsMode('settings'); setIsSettingsOpen(true); }}
          onOpenNewBoard={() => { setIsSettingsOpen(false); setIsNewBoardOpen(true); }}
          detailPresentation={activeDetailPresentation}
          onDetailPresentationChange={handleDetailPresentationChange}
          isTaskPage={isTaskPage}
          isTaskSearchPage={isTaskSearchPage}
          logoHomeHref={boardPath(activeBoard.id)}
        />

      <div className="relative z-40 shrink-0 border-b border-border/50 bg-card/80 px-4 py-2 md:hidden">
        <DataViewSearchAndFilter
          query={searchQuery}
          filters={searchFilters}
          boards={boards}
          assignees={assignees}
          onQueryChange={setSearchQuery}
          onFiltersChange={setSearchFilters}
          onSubmit={(query, filters) => handleGlobalSearch(query, filters)}
          placeholder={isTaskSearchPage ? 'Find task id, title, comment…' : 'Search this board…'}
          testId="mobile-topbar-search"
        />
      </div>

      {(dataSource === 'fallback' || loadError) && (
        <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          {loadError || 'Showing offline demo data.'}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full">
          {isTaskSearchPage ? (
            <TaskSearchPage
              boards={boards}
              assignees={assignees}
              locationSearch={location.search}
              query={searchQuery}
              filters={searchFilters}
              activeBoard={activeBoard}
              onQueryChange={setSearchQuery}
              onFiltersChange={setSearchFilters}
              onOpenTask={handleOpenSearchTask}
            />
          ) : activeDetailPresentation === 'page' && (selectedTask || routeTaskId) ? (
            <TaskDetailPage
              task={selectedTask}
              taskId={selectedTask?.id || routeTaskId || ''}
              allTasks={tasks}
              activeBoard={activeBoard}
              assignees={assignees}
              onBack={handleCloseDetail}
              onAddComment={handleAddComment}
              onUpdateTask={updateSelectedTask}
              onLinkTask={handleLinkTask}
              onUnlinkTask={handleUnlinkTask}
              onNotify={handleNotify}
              subscribedChannels={homeChannels}
              onSpecify={handleSpecify}
              onDecompose={handleDecompose}
            />
          ) : (
            <BoardView
              tasks={tasks}
              onTaskClick={handleTaskClick}
              onTasksChange={() => toast.info('Read-only mode: drag/drop updates are disabled in this MVP')}
              onAddTask={() => setIsQuickCaptureOpen(true)}
              searchQuery={searchQuery}
              boardSettings={boardSettings}
            />
          )}
        </div>
      </main>

      {/* Desktop Footer Bar */}
      {!isTaskPage && !isTaskSearchPage && <DesktopFooterBar tasks={tasks} />}

      {/* Mobile Create FAB */}
      {!isTaskPage && !isTaskSearchPage && (
        <MobileCreateTaskFab onOpenQuickCapture={() => setIsQuickCaptureOpen(true)} />
      )}

      {/* Task Detail: selectable drawer, centered Jira-style modal, or standalone page */}
      {!isTaskPage && !isTaskSearchPage && detailPresentation === 'drawer' ? (
        <TaskDetailSheet
          task={selectedTask}
          allTasks={tasks}
          activeBoard={activeBoard ?? undefined}
          assignees={assignees}
          open={!!selectedTaskId}
          onClose={handleCloseDetail}
          onAddComment={handleAddComment}
          onUpdateTask={updateSelectedTask}
          onLinkTask={handleLinkTask}
          onUnlinkTask={handleUnlinkTask}
          onNotify={handleNotify}
          subscribedChannels={homeChannels}
          onSpecify={handleSpecify}
          onDecompose={handleDecompose}
          isMobile={isMobile}
        />
      ) : !isTaskPage && !isTaskSearchPage && detailPresentation === 'modal' ? (
        <TaskDetailModal
          task={selectedTask}
          allTasks={tasks}
          activeBoard={activeBoard ?? undefined}
          assignees={assignees}
          open={!!selectedTaskId}
          onClose={handleCloseDetail}
          onAddComment={handleAddComment}
          onUpdateTask={updateSelectedTask}
          onLinkTask={handleLinkTask}
          onUnlinkTask={handleUnlinkTask}
          onNotify={handleNotify}
          subscribedChannels={homeChannels}
          onSpecify={handleSpecify}
          onDecompose={handleDecompose}
          isMobile={isMobile}
        />
      ) : null}

      <BoardsSettingsPanel
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        mode={settingsMode}
        boards={boards}
        activeBoard={activeBoard}
        onBoardChange={handleBoardChange}
        onBoardsRefresh={async (preferredBoardId) => { await loadBoardData(preferredBoardId); }}
        assignees={assignees}
      />

      <NewBoardModal
        open={isNewBoardOpen}
        boards={boards}
        onClose={() => setIsNewBoardOpen(false)}
        onCreated={async (board) => {
          await loadBoardData(board.id);
          navigate(boardPath(board.id));
        }}
      />

      {/* Quick Capture */}
      <div className="md:hidden">
        <TaskQuickCapture
          open={isQuickCaptureOpen}
          onClose={() => setIsQuickCaptureOpen(false)}
          onCreate={handleCreateTask}
          assignees={assignees}
          isSubmitting={isCreatingTask}
          boardName={activeBoard.name || activeBoard.id}
          boardSettings={boardSettings}
          isMobile
        />
      </div>
      <div className="hidden md:block">
        <TaskQuickCapture
          open={isQuickCaptureOpen}
          onClose={() => setIsQuickCaptureOpen(false)}
          onCreate={handleCreateTask}
          assignees={assignees}
          isSubmitting={isCreatingTask}
          boardName={activeBoard.name || activeBoard.id}
          boardSettings={boardSettings}
        />
      </div>

    </div>
  );
}

export default App;
