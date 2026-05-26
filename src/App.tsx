import { useState, useCallback, useEffect, useMemo } from 'react';
import { Toaster, toast } from 'sonner';
import type { Task, Board, TaskStatus, Priority } from '@/lib/types';
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

  // Load initial data
  useEffect(() => {
    async function load() {
      try {
        const [boardData, boardsData] = await Promise.all([
          kanbanApi.getBoard(),
          kanbanApi.getBoards(),
        ]);
        setTasks(boardData.tasks);
        setBoards(boardsData);
        setActiveBoard(boardData.board);
      } catch {
        toast.error('Failed to load board data');
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
    async (newStatus: TaskStatus) => {
      if (!selectedTaskId) return;
      try {
        const updated = await kanbanApi.updateTask(selectedTaskId, { status: newStatus });
        setTasks((prev) => prev.map((t) => (t.id === selectedTaskId ? updated : t)));
        toast.success(`Status changed to ${newStatus}`);
      } catch {
        toast.error('Failed to update status');
      }
    },
    [selectedTaskId]
  );

  const handleBlock = useCallback(async () => {
    if (!selectedTaskId) return;
    try {
      const updated = await kanbanApi.blockTask(selectedTaskId, 'Blocked by user');
      setTasks((prev) => prev.map((t) => (t.id === selectedTaskId ? updated : t)));
      toast.success('Task blocked');
    } catch {
      toast.error('Failed to block task');
    }
  }, [selectedTaskId]);

  const handleReclaim = useCallback(async () => {
    if (!selectedTaskId) return;
    try {
      const updated = await kanbanApi.reclaimTask(selectedTaskId);
      setTasks((prev) => prev.map((t) => (t.id === selectedTaskId ? updated : t)));
      toast.success('Task reclaimed');
    } catch {
      toast.error('Failed to reclaim task');
    }
  }, [selectedTaskId]);

  const handleDecompose = useCallback(async () => {
    if (!selectedTaskId) return;
    try {
      const subtasks = await kanbanApi.decomposeTask(selectedTaskId);
      setTasks((prev) => [...prev, ...subtasks]);
      toast.success(`Created ${subtasks.length} subtasks`);
    } catch {
      toast.error('Failed to decompose task');
    }
  }, [selectedTaskId]);

  const handleDelete = useCallback(async () => {
    if (!selectedTaskId) return;
    try {
      await kanbanApi.deleteTask(selectedTaskId);
      setTasks((prev) => prev.filter((t) => t.id !== selectedTaskId));
      handleCloseDetail();
      toast.success('Task deleted');
    } catch {
      toast.error('Failed to delete task');
    }
  }, [selectedTaskId, handleCloseDetail]);

  const handleCreateTask = useCallback(
    async (data: {
      title: string;
      description: string;
      priority: Priority;
      assignee: string | null;
      status: TaskStatus;
    }) => {
      try {
        const newTask = await kanbanApi.createTask({
          title: data.title,
          description: data.description,
          priority: data.priority,
          assignee: data.assignee,
          status: data.status,
        });
        setTasks((prev) => [...prev, newTask]);
        setIsQuickCaptureOpen(false);
        toast.success('Task created');
      } catch {
        toast.error('Failed to create task');
      }
    },
    []
  );

  const handleAddComment = useCallback(
    async (text: string) => {
      if (!selectedTaskId) return;
      try {
        await kanbanApi.addComment(selectedTaskId, text);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === selectedTaskId
              ? {
                  ...t,
                  commentCount: t.commentCount + 1,
                  comments: [
                    ...t.comments,
                    {
                      id: `c-${Date.now()}`,
                      author: 'user',
                      text,
                      createdAt: new Date().toISOString(),
                    },
                  ],
                }
              : t
          )
        );
      } catch {
        toast.error('Failed to add comment');
      }
    },
    [selectedTaskId]
  );

  const handleBoardChange = useCallback(
    async (board: Board) => {
      try {
        setIsLoading(true);
        const data = await kanbanApi.getBoard(board.id);
        setTasks(data.tasks);
        setActiveBoard(data.board);
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
        onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
        onOpenSettings={() => setIsBoardSettingsOpen(true)}
      />

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
              onTasksChange={setTasks}
              onAddTask={() => {
                setIsQuickCaptureOpen(true);
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
        onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
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
