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
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { Task, TaskStatus } from '@/lib/types';
import type { BoardSettings } from '@/lib/boardSettings';
import { getBoardColumns, getOrderedStatuses, getStatusLabel } from '@/lib/boardSettings';
import { isStatusDropEnabled } from '@/lib/types';
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
  // Reorderable native status columns (drives column drag/reorder + persistence).
  const orderedStatuses = useMemo(() => getOrderedStatuses(boardSettings), [boardSettings]);
  // All rendered columns: native statuses + a trailing read-only `archived` column
  // when enabled. Drives grouping/containers/rendering but NOT column reordering.
  const columns = useMemo(() => getBoardColumns(boardSettings), [boardSettings]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Working copy of the per-column task-id lists, live only while a task is
  // being dragged (null otherwise → render straight from props). Seeded on
  // drag start, cleared on drag end/cancel; the refetch reconciles afterwards.
  const [cloneContainers, setCloneContainers] = useState<Record<string, string[]> | null>(null);

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
    columns.forEach((status) => {
      grouped[status] =
        status === 'archived'
          ? filteredTasks.filter((t) => t.archived)
          : filteredTasks.filter((t) => !t.archived && t.status === status);
    });
    return grouped;
  }, [filteredTasks, columns]);

  // id → task lookup over the (search-filtered) set, stable across a drag.
  const taskById = useMemo(() => {
    const m = new Map<string, Task>();
    filteredTasks.forEach((t) => m.set(t.id, t));
    return m;
  }, [filteredTasks]);

  // Grouping straight from props (used when no task drag is in progress).
  const baseContainers = useMemo(() => {
    const m: Record<string, string[]> = {};
    columns.forEach((s) => {
      m[s] = (tasksByStatus[s] ?? []).map((t) => t.id);
    });
    return m;
  }, [tasksByStatus, columns]);

  // What the columns actually render: the live working copy if dragging a task,
  // otherwise the prop-derived grouping.
  const renderContainers = cloneContainers ?? baseContainers;

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;
  const activeColumnStatus =
    activeId && activeId.startsWith('column:') ? (activeId.slice('column:'.length) as TaskStatus) : null;

  // The column that currently holds the dragged task → gets the drop highlight.
  const activeDropContainer =
    cloneContainers && activeId && !activeColumnStatus
      ? columns.find((s) => cloneContainers[s].includes(activeId)) ?? null
      : null;

  function handleDragStart(event: DragStartEvent) {
    if (readOnly) return;
    setActiveId(event.active.id as string);
    // Column drags don't use the task working copy.
    if (event.active.data.current?.type === 'column') return;
    setCloneContainers(
      Object.fromEntries(columns.map((s) => [s, [...(baseContainers[s] ?? [])]]))
    );
  }

  // While dragging a task over a *different* column, move its id into that
  // column's working list so verticalListSortingStrategy opens the gap and the
  // dimmed in-place card becomes the drop "shadow". Same-column hover is a
  // no-op (reorder isn't persisted), and drop-disabled columns never accept it.
  function handleDragOver(event: DragOverEvent) {
    if (readOnly) return;
    const { active, over } = event;
    if (!over) return;
    if (active.data.current?.type === 'column') return;

    const activeTaskId = active.id as string;
    const overId = over.id as string;

    setCloneContainers((prev) => {
      if (!prev) return prev;
      const from = columns.find((s) => prev[s].includes(activeTaskId));
      if (!from) return prev;
      // Tasks in the read-only `archived` column cannot be moved (no unarchive yet).
      if (from === 'archived') return prev;
      const to = columns.includes(overId as TaskStatus)
        ? (overId as TaskStatus)
        : columns.find((s) => prev[s].includes(overId));
      if (!to || !isStatusDropEnabled(to) || from === to) return prev;

      const fromItems = prev[from];
      const toItems = prev[to];
      const overIsColumn = columns.includes(overId as TaskStatus);
      const overIndex = overIsColumn ? -1 : toItems.indexOf(overId);
      const newIndex = overIndex >= 0 ? overIndex : toItems.length;

      return {
        ...prev,
        [from]: fromItems.filter((id) => id !== activeTaskId),
        [to]: [...toItems.slice(0, newIndex), activeTaskId, ...toItems.slice(newIndex)],
      };
    });
  }

  function handleDragCancel() {
    setActiveId(null);
    setCloneContainers(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (readOnly) {
      setActiveId(null);
      setCloneContainers(null);
      return;
    }

    const activeData = active.data.current;

    // Column reordering: drag a column header onto another column. Persisted
    // per board via boardSettings.statusOrder (parent handler).
    if (activeData?.type === 'column') {
      setActiveId(null);
      if (!over) return;
      const overData = over.data.current;
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

    // Task move: the working copy already represents where the card landed.
    const activeTaskId = active.id as string;
    const snapshot = cloneContainers;
    setActiveId(null);
    setCloneContainers(null);
    if (!snapshot) return;

    const sourceTask = tasks.find((t) => t.id === activeTaskId);
    const sourceStatus = sourceTask?.status;
    // Archived tasks are read-only on the board (no unarchive transition yet).
    if (sourceTask?.archived) return;
    const targetStatus = columns.find((s) => snapshot[s].includes(activeTaskId));
    if (!sourceStatus || !targetStatus || targetStatus === sourceStatus) return;
    // `archived` is a UI-only column, never a real status target.
    if (targetStatus === 'archived' || !isStatusDropEnabled(targetStatus)) {
      if (targetStatus === 'running') toast.error('Cannot drop into Running — status is read-only');
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
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex h-full min-h-0 gap-3 overflow-x-auto overflow-y-hidden custom-scrollbar px-4 pt-3 pb-4 items-stretch">
        <SortableContext items={columns.map((s) => `column:${s}`)} strategy={horizontalListSortingStrategy}>
          {columns.map((status) => {
            const isArchived = status === 'archived';
            return (
              <KanbanColumn
                key={status}
                status={status}
                tasks={(renderContainers[status] ?? []).map((id) => taskById.get(id)).filter(Boolean) as Task[]}
                onTaskClick={onTaskClick}
                onAddTask={onAddTask}
                readOnly={readOnly}
                reorderable={!isArchived}
                statusLabel={getStatusLabel(status, boardSettings)}
                onRenameStatus={isArchived ? undefined : onRenameStatus}
                collapsed={boardSettings.collapsedColumns.includes(status)}
                onToggleCollapse={isArchived ? undefined : onToggleCollapse}
                isActiveDropTarget={activeDropContainer === status}
              />
            );
          })}
        </SortableContext>
      </div>

      <DragOverlay>
        {activeTask ? (
          <TaskCard task={activeTask} onClick={() => {}} isOverlay />
        ) : activeColumnStatus ? (
          <ColumnDragPreview
            status={activeColumnStatus}
            label={getStatusLabel(activeColumnStatus, boardSettings)}
            tasks={tasksByStatus[activeColumnStatus] ?? []}
            collapsed={boardSettings.collapsedColumns.includes(activeColumnStatus)}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
