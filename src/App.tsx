import { useState, useCallback, useEffect, useMemo } from 'react';
import { Toaster, toast } from 'sonner';
import type { Task, Board } from '@/lib/types';
import { kanbanApi } from '@/lib/kanbanApi';
import { TopBar } from '@/components/layout/TopBar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { DesktopFooterBar } from '@/components/layout/DesktopFooterBar';
import { BoardView } from '@/components/board/BoardView';
import { TaskDetail } from '@/components/task/TaskDetail';
import { TaskDetailSheet } from '@/components/task/TaskDetailSheet';
import { TaskQuickCapture } from '@/components/task/TaskQuickCapture';
import { BoardsSettingsPanel } from '@/components/settings/BoardsSettingsPanel';
import './App.css';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [isBoardSettingsOpen, setIsBoardSettingsOpen] = useState(false);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'live' | 'fallback'>('live');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    async function load() {
      try {
        const boardsResult = await kanbanApi.getBoards();
        const preferredBoard =
          boardsResult.boards.find((board) => board.id === 'better-hermes-kanban') ||
          boardsResult.boards.find((board) => board.isDefault) ||
          boardsResult.boards[0];
        const boardData = await kanbanApi.getBoard(preferredBoard?.id);
        setTasks(boardData.tasks);
        setBoards(boardsResult.boards);
        setActiveBoard(boardData.board);
        setDataSource(boardData.source === 'fallback' || boardsResult.source === 'fallback' ? 'fallback' : 'live');
        setLoadError(boardData.source === 'fallback' || boardsResult.source === 'fallback' ? 'Live Kanban API unavailable; showing offline demo data.' : null);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load board data';
        setLoadError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTaskId(task.id);
    // Only open mobile full-screen detail on small screens
    if (window.innerWidth < 768) {
      setIsMobileDetailOpen(true);
    }
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedTaskId(null);
    setIsMobileDetailOpen(false);
  }, []);

  const handleStatusChange = useCallback(
    async () => {
      toast.info('Read-only mode: task status changes are disabled in this MVP');
    },
    []
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
    async () => {
      toast.info('Read-only mode: task creation is disabled in this MVP');
    },
    []
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
        setSelectedTaskId(null);
      } catch {
        toast.error('Failed to switch board');
      } finally {
        setIsLoading(false);
      }
    },
    []
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
        onOpenQuickCapture={() => toast.info('Read-only mode: task creation is disabled in this MVP')}
        onOpenSettings={() => setIsBoardSettingsOpen(true)}
      />

      {(dataSource === 'fallback' || loadError) && (
        <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          {loadError || 'Showing offline demo data.'}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {/* Mobile detail view */}
        {isMobileDetailOpen && selectedTask ? (
          <div className="md:hidden h-full">
            <TaskDetail
              task={selectedTask}
              allTasks={tasks}
              isMobile
              onBack={handleCloseDetail}
              onStatusChange={handleStatusChange}
              onAddComment={handleAddComment}
              onBlock={handleBlock}
              onReclaim={handleReclaim}
              onDecompose={handleDecompose}
              onDelete={handleDelete}
            />
          </div>
        ) : (
          /* Board view */
          <div className="h-full">
            <BoardView
              tasks={tasks}
              boards={boards}
              activeBoard={activeBoard}
              onBoardChange={handleBoardChange}
              onTaskClick={handleTaskClick}
              onTasksChange={() => toast.info('Read-only mode: drag/drop updates are disabled in this MVP')}
              onAddTask={() => {
                toast.info('Read-only mode: task creation is disabled in this MVP');
              }}
              searchQuery={searchQuery}
            />
          </div>
        )}
      </main>

      {/* Desktop Footer Bar */}
      <DesktopFooterBar tasks={tasks} />

      {/* Mobile Bottom Nav */}
      <MobileBottomNav
        activeTab="boards"
        onTabChange={(tab) => {
          if (tab === 'boards') {
            handleCloseDetail();
          } else {
            toast.info(`${tab} coming soon`);
          }
        }}
        onOpenQuickCapture={() => toast.info('Read-only mode: task creation is disabled in this MVP')}
      />

      {/* Desktop Task Detail Sheet */}
      <div className="hidden md:block">
        <TaskDetailSheet
          task={selectedTask}
          allTasks={tasks}
          open={!!selectedTaskId && !isMobileDetailOpen}
          onClose={handleCloseDetail}
          onStatusChange={handleStatusChange}
          onAddComment={handleAddComment}
          onBlock={handleBlock}
          onReclaim={handleReclaim}
          onDecompose={handleDecompose}
          onDelete={handleDelete}
        />
      </div>

      {/* Quick Capture */}
      <div className="md:hidden">
        <TaskQuickCapture
          open={isQuickCaptureOpen}
          onClose={() => setIsQuickCaptureOpen(false)}
          onCreate={handleCreateTask}
          isMobile
        />
      </div>
      <div className="hidden md:block">
        <TaskQuickCapture
          open={isQuickCaptureOpen}
          onClose={() => setIsQuickCaptureOpen(false)}
          onCreate={handleCreateTask}
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
        />
      </div>
    </div>
  );
}

export default App;
