import { useState, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { Task, TaskStatus } from '@/lib/types';
import type { BoardSettings } from '@/lib/boardSettings';
import { getOrderedStatuses, getStatusLabel } from '@/lib/boardSettings';
import { DROPPABLE_TASK_STATUSES, isStatusDropEnabled } from '@/lib/types';
import { KanbanColumn } from './KanbanColumn';
import { TaskCard } from './TaskCard';
import { toast } from 'sonner';

interface DesktopKanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onMoveTask: (taskId: string, toStatus: TaskStatus) => void | Promise<void>;
  onAddTask: (status: TaskStatus) => void;
  searchQuery: string;
  readOnly?: boolean;
  boardSettings: BoardSettings;
  onRenameStatus?: (status: TaskStatus, label: string) => void;
}

export function DesktopKanbanBoard({
  tasks,
  onTaskClick,
  onMoveTask,
  onAddTask,
  searchQuery,
  readOnly = false,
  boardSettings,
  onRenameStatus,
}: DesktopKanbanBoardProps) {
  const orderedStatuses = useMemo(() => getOrderedStatuses(boardSettings), [boardSettings]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const q = searchQuery.toLowerCase();
    return tasks.filter(
      (t) =>
      t.id.toLowerCase().includes(q) ||
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      (t.assignee && t.assignee.toLowerCase().includes(q))
    );
  }, [tasks, searchQuery]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    orderedStatuses.forEach((status) => {
      grouped[status] = filteredTasks.filter((t) => t.status === status);
    });
    return grouped;
  }, [filteredTasks, orderedStatuses]);

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    if (readOnly) return;
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    if (readOnly) {
      setActiveId(null);
      return;
    }
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeTaskId = active.id as string;
    const overId = over.id as string;

    const activeTaskItem = tasks.find((t) => t.id === activeTaskId);
    if (!activeTaskItem) return;

    // Resolve the target status: a column droppable id, or the column of the
    // card we dropped on.
    const overStatus = DROPPABLE_TASK_STATUSES.find((s) => s === overId);
    const targetStatus = overStatus ?? tasks.find((t) => t.id === overId)?.status;
    if (!targetStatus) return;

    // Dropping inside the same column is a no-op: ordering is not persisted
    // (the backend has no position/rank field yet).
    if (targetStatus === activeTaskItem.status) return;

    if (!isStatusDropEnabled(targetStatus)) {
      toast.error('Cannot drop into Running — status is read-only');
      return;
    }

    // Cross-column move = status change. Persistence + optimistic update +
    // success/error toasts are handled by the parent (App.handleMoveTask).
    void onMoveTask(activeTaskId, targetStatus);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full min-h-0 gap-3 overflow-x-auto overflow-y-hidden custom-scrollbar px-4 pt-3 pb-4 items-stretch">
        {orderedStatuses.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status] || []}
            onTaskClick={onTaskClick}
            onAddTask={onAddTask}
            readOnly={readOnly}
            statusLabel={getStatusLabel(status, boardSettings)}
            onRenameStatus={onRenameStatus}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <TaskCard task={activeTask} onClick={() => {}} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
