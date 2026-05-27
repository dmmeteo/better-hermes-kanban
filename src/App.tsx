import { useState, useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Toaster, toast } from 'sonner';
import type { Task, Board, BotProfile, CreateTaskData, TaskStatus, UpdateTaskData } from '@/lib/types';
import { kanbanApi } from '@/lib/kanbanApi';
import { TopBar, type TaskDetailPresentation } from '@/components/layout/TopBar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { DesktopFooterBar } from '@/components/layout/DesktopFooterBar';
import { BoardView } from '@/components/board/BoardView';
import { TaskDetailSheet } from '@/components/task/TaskDetailSheet';
import { TaskDetailModal } from '@/components/task/TaskDetailModal';
import { TaskDetailPage } from '@/components/task/TaskDetailPage';
import { TaskQuickCapture } from '@/components/task/TaskQuickCapture';
import { BoardsSettingsPanel } from '@/components/settings/BoardsSettingsPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import './App.css';

function taskPath(taskId: string) {
  return `/tasks/${encodeURIComponent(taskId)}`;
}

function boardPath(boardId?: string | null) {
  return boardId ? `/boards/${encodeURIComponent(boardId)}` : '/';
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [isBoardSettingsOpen, setIsBoardSettingsOpen] = useState(false);
  const [detailPresentation, setDetailPresentation] = useState<TaskDetailPresentation>(() => {
    const saved = window.localStorage.getItem('bhk.taskDetailPresentation');
    return saved === 'modal' || saved === 'page' ? saved : 'drawer';
  });
  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'live' | 'fallback'>('live');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [assignees, setAssignees] = useState<BotProfile[]>([]);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load board data';
      setLoadError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadTaskPageData = useCallback(async (taskId: string) => {
    try {
      setIsLoading(true);
      const [boardsResult, directTask] = await Promise.all([
        kanbanApi.getBoards(),
        kanbanApi.getTask(taskId),
      ]);
      const taskBoardId = directTask?.boardId || boardIdFromUrl;
      const boardData = await kanbanApi.getBoard(taskBoardId);
      const mergedTasks = directTask
        ? boardData.tasks.some((task) => task.id === directTask.id)
          ? boardData.tasks.map((task) => (task.id === directTask.id ? { ...task, ...directTask } : task))
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
    if (legacyBoardIdFromUrl && !routeTaskId && !boardIdFromPath) {
      navigate(boardPath(legacyBoardIdFromUrl), { replace: true });
      return;
    }
    if (routeTaskId) {
      loadTaskPageData(routeTaskId);
      return;
    }
    loadBoardData(boardIdFromUrl);
  }, [boardIdFromPath, boardIdFromUrl, legacyBoardIdFromUrl, loadBoardData, loadTaskPageData, navigate, routeTaskId]);

  useEffect(() => {
    window.localStorage.setItem('bhk.taskDetailPresentation', detailPresentation);
  }, [detailPresentation]);

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
    const appSuffix = 'BHK';
    if (selectedTask) {
      document.title = `🪽 ${selectedTask.id} · ${selectedTask.title} — ${appSuffix}`;
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
  }, [activeBoard, boards, routeTaskId, selectedTask]);

  const handleTaskClick = useCallback((task: Task) => {
    if (detailPresentation === 'page') {
      navigate(taskPath(task.id));
      return;
    }
    setSelectedTaskId(task.id);
  }, [detailPresentation, navigate]);

  const handleCloseDetail = useCallback(() => {
    if (isTaskPage) {
      navigate(boardPath(activeBoard?.id));
      return;
    }
    setSelectedTaskId(null);
  }, [activeBoard, isTaskPage, navigate]);

  const handleDetailPresentationChange = useCallback((presentation: TaskDetailPresentation) => {
    setDetailPresentation(presentation);
    if (presentation === 'page' && selectedTask) {
      navigate(taskPath(selectedTask.id));
      return;
    }
    if (isTaskPage && routeTaskId && presentation !== 'page') {
      navigate(boardPath(activeBoard?.id));
      setSelectedTaskId(routeTaskId);
    }
  }, [activeBoard, isTaskPage, navigate, routeTaskId, selectedTask]);

  const updateSelectedTask = useCallback(
    async (patch: UpdateTaskData) => {
      if (!selectedTask || !activeBoard) return;
      if (patch.status === 'running') {
        toast.error('Running status is dispatcher-owned and cannot be set manually');
        return;
      }
      if (patch.status && !window.confirm(`Apply status change to ${patch.status} for ${selectedTask.id}?`)) {
        return;
      }
      try {
        setUpdatingTaskId(selectedTask.id);
        const updated = await kanbanApi.updateTask(selectedTask.id, patch, activeBoard.id);
        setTasks((current) => current.map((task) => (task.id === updated.id ? { ...task, ...updated } : task)));
        toast.success('Task updated');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to update task';
        toast.error(message);
        throw error;
      } finally {
        setUpdatingTaskId(null);
      }
    },
    [activeBoard, selectedTask]
  );

  const handleStatusChange = useCallback(
    async (status: TaskStatus) => {
      await updateSelectedTask({ status });
    },
    [updateSelectedTask]
  );

  const handleBlock = useCallback(async () => {
    toast.info('Read-only mode: task actions are disabled in this MVP');
  }, []);

  const handleReclaim = useCallback(async () => {
    toast.info('Read-only mode: task actions are disabled in this MVP');
  }, []);

  const handleDecompose = useCallback(async () => {
    toast.info('Read-only mode: task actions are disabled in this MVP');
  }, []);

  const handleDelete = useCallback(async () => {
    toast.info('Read-only mode: task deletion is disabled in this MVP');
  }, []);

  const handleCreateTask = useCallback(
    async (data: CreateTaskData) => {
      if (!activeBoard) return;
      if (data.status === 'running' || data.status === 'done' || data.status === 'review') {
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
        setTasks((current) => [created, ...current]);
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
    [activeBoard]
  );

  const handleAddComment = useCallback(
    async () => {
      toast.info('Read-only mode: comments are disabled in this MVP');
    },
    []
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
        activeBoard={activeBoard}
        onBoardChange={handleBoardChange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
        onOpenSettings={() => setIsBoardSettingsOpen(true)}
        detailPresentation={activeDetailPresentation}
        onDetailPresentationChange={handleDetailPresentationChange}
        isTaskPage={isTaskPage}
        onNavigateToBoard={handleCloseDetail}
      />

      {(dataSource === 'fallback' || loadError) && (
        <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          {loadError || 'Showing offline demo data.'}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full">
          {activeDetailPresentation === 'page' && (selectedTask || routeTaskId) ? (
            <TaskDetailPage
              task={selectedTask}
              taskId={selectedTask?.id || routeTaskId || ''}
              allTasks={tasks}
              activeBoard={activeBoard}
              onBack={handleCloseDetail}
              onStatusChange={handleStatusChange}
              onAddComment={handleAddComment}
              onBlock={handleBlock}
              onReclaim={handleReclaim}
              onDecompose={handleDecompose}
              onDelete={handleDelete}
              onUpdateTask={updateSelectedTask}
              isUpdating={!!selectedTask && updatingTaskId === selectedTask.id}
              isMobile={isMobile}
            />
          ) : (
            <BoardView
              tasks={tasks}
              boards={boards}
              activeBoard={activeBoard}
              onBoardChange={handleBoardChange}
              onTaskClick={handleTaskClick}
              onTasksChange={() => toast.info('Read-only mode: drag/drop updates are disabled in this MVP')}
              onAddTask={() => setIsQuickCaptureOpen(true)}
              searchQuery={searchQuery}
            />
          )}
        </div>
      </main>

      {/* Desktop Footer Bar */}
      {!isTaskPage && <DesktopFooterBar tasks={tasks} />}

      {/* Mobile Bottom Nav */}
      {!isTaskPage && (
        <MobileBottomNav
          activeTab="boards"
          onTabChange={(tab) => {
            if (tab === 'boards') {
              handleCloseDetail();
            } else if (tab === 'more') {
              setIsBoardSettingsOpen(true);
            } else {
              toast.info(`${tab} coming soon`);
            }
          }}
          onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
        />
      )}

      {/* Task Detail: selectable drawer, centered Jira-style modal, or standalone page */}
      {!isTaskPage && detailPresentation === 'drawer' ? (
        <TaskDetailSheet
          task={selectedTask}
          allTasks={tasks}
          open={!!selectedTaskId}
          onClose={handleCloseDetail}
          onStatusChange={handleStatusChange}
          onAddComment={handleAddComment}
          onBlock={handleBlock}
          onReclaim={handleReclaim}
          onDecompose={handleDecompose}
          onDelete={handleDelete}
          onUpdateTask={updateSelectedTask}
          isUpdating={!!selectedTask && updatingTaskId === selectedTask.id}
          isMobile={isMobile}
        />
      ) : !isTaskPage && detailPresentation === 'modal' ? (
        <TaskDetailModal
          task={selectedTask}
          allTasks={tasks}
          open={!!selectedTaskId}
          onClose={handleCloseDetail}
          onStatusChange={handleStatusChange}
          onAddComment={handleAddComment}
          onBlock={handleBlock}
          onReclaim={handleReclaim}
          onDecompose={handleDecompose}
          onDelete={handleDelete}
          onUpdateTask={updateSelectedTask}
          isUpdating={!!selectedTask && updatingTaskId === selectedTask.id}
          isMobile={isMobile}
        />
      ) : null}

      {/* Quick Capture */}
      <div className="md:hidden">
        <TaskQuickCapture
          open={isQuickCaptureOpen}
          onClose={() => setIsQuickCaptureOpen(false)}
          onCreate={handleCreateTask}
          assignees={assignees}
          isSubmitting={isCreatingTask}
          boardName={activeBoard.name || activeBoard.id}
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
        />
      </div>

      {/* Board Settings */}
      <div className="md:hidden">
        <BoardsSettingsPanel
          open={isBoardSettingsOpen}
          onClose={() => setIsBoardSettingsOpen(false)}
          boards={boards}
          activeBoard={activeBoard}
          onBoardChange={handleBoardChange}
          onBoardsRefresh={loadBoardData}
          isMobile
        />
      </div>
      <div className="hidden md:block">
        <BoardsSettingsPanel
          open={isBoardSettingsOpen}
          onClose={() => setIsBoardSettingsOpen(false)}
          boards={boards}
          activeBoard={activeBoard}
          onBoardChange={handleBoardChange}
          onBoardsRefresh={loadBoardData}
        />
      </div>
    </div>
  );
}

export default App;
