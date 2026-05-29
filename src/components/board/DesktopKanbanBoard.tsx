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
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { Task, TaskStatus } from '@/lib/types';
import type { BoardSettings } from '@/lib/boardSettings';
import { getOrderedStatuses, getStatusLabel } from '@/lib/boardSettings';
import { DROPPABLE_TASK_STATUSES, isStatusDropEnabled } from '@/lib/types';
import { KanbanColumn, ColumnDragPreview } from './KanbanColumn';
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
  onToggleCollapse?: (status: TaskStatus) => void;
  onReorderColumns?: (order: TaskStatus[]) => void;
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
  onToggleCollapse,
  onReorderColumns,
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
  const activeColumnStatus =
    activeId && activeId.startsWith('column:') ? (activeId.slice('column:'.length) as TaskStatus) : null;

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

    const activeData = active.data.current;
    const overData = over.data.current;
    const overId = over.id as string;

    // Column reordering: drag a column header onto another column. Persisted
    // per board via boardSettings.statusOrder (parent handler).
    if (activeData?.type === 'column') {
      const from = activeData.status as TaskStatus;
      const to =
        (overData?.type === 'column' ? (overData.status as TaskStatus) : undefined) ??
        (overData?.task?.status as TaskStatus | undefined) ??
        (overData?.status as TaskStatus | undefined);
      if (!to || from === to) return;
      const oldIndex = orderedStatuses.indexOf(from);
      const newIndex = orderedStatuses.indexOf(to);
      if (oldIndex === -1 || newIndex === -1) return;
      onReorderColumns?.(arrayMove(orderedStatuses, oldIndex, newIndex));
      return;
    }

    const activeTaskId = active.id as string;
    const activeTaskItem = tasks.find((t) => t.id === activeTaskId);
    if (!activeTaskItem) return;

    // Resolve the target status: a column droppable id, the column the card
    // was dropped on, or the column of the card we dropped on.
    const overStatus = DROPPABLE_TASK_STATUSES.find((s) => s === overId);
    const targetStatus =
      overStatus ??
      (overData?.status as TaskStatus | undefined) ??
      tasks.find((t) => t.id === overId)?.status;
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
        <SortableContext items={orderedStatuses.map((s) => `column:${s}`)} strategy={horizontalListSortingStrategy}>
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
              collapsed={boardSettings.collapsedColumns.includes(status)}
              onToggleCollapse={onToggleCollapse}
            />
          ))}
        </SortableContext>
      </div>

      <DragOverlay>
        {activeTask ? (
          <TaskCard task={activeTask} onClick={() => {}} isOverlay />
        ) : activeColumnStatus ? (
          <ColumnDragPreview
            status={activeColumnStatus}
            label={getStatusLabel(activeColumnStatus, boardSettings)}
            count={tasksByStatus[activeColumnStatus]?.length ?? 0}
            collapsed={boardSettings.collapsedColumns.includes(activeColumnStatus)}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
