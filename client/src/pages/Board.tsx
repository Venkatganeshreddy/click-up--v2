import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { useAuth } from '../context/AuthContext';
import { spacesApi, tasksApi } from '../services/api';
import type { Task, TaskStatus, CreateTaskInput, UpdateTaskInput } from '../types';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';
import Column from '../components/Column';
import { ArrowLeft, Plus } from 'lucide-react';

const COLUMNS: { id: TaskStatus; title: string; color: string }[] = [
  { id: 'To Do', title: 'To Do', color: '#6b7280' },
  { id: 'In Progress', title: 'In Progress', color: '#3b82f6' },
  { id: 'Review', title: 'Review', color: '#f59e0b' },
  { id: 'Done', title: 'Done', color: '#22c55e' }
];

export default function Board() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const queryClient = useQueryClient();
  const { canEdit } = useAuth();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForStatus, setCreateForStatus] = useState<TaskStatus>('To Do');
  const [showEmptyColumns, setShowEmptyColumns] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const { data: space } = useQuery({
    queryKey: ['space', spaceId],
    queryFn: async () => {
      const spaces = await spacesApi.getAll();
      return spaces.find(s => s.id === spaceId);
    },
    enabled: !!spaceId
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', spaceId],
    queryFn: () => tasksApi.getBySpace(spaceId!),
    enabled: !!spaceId
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateTaskInput) => tasksApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', spaceId] });
      setShowCreateModal(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) =>
      tasksApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', spaceId] });
      setSelectedTask(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: tasksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', spaceId] });
      setSelectedTask(null);
    }
  });

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      'To Do': [],
      'In Progress': [],
      'Review': [],
      'Done': []
    };
    tasks.forEach((task) => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });
    Object.keys(grouped).forEach((status) => {
      grouped[status as TaskStatus].sort((a, b) => a.position - b.position);
    });
    return grouped;
  }, [tasks]);

  const handleDragStart = (event: DragStartEvent) => {
    if (!canEdit) return;
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (!canEdit) return;
    const { active, over } = event;
    if (!over) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    const overId = over.id as string;
    const isOverColumn = COLUMNS.some((c) => c.id === overId);

    if (isOverColumn && activeTask.status !== overId) {
      queryClient.setQueryData(['tasks', spaceId], (old: Task[] | undefined) => {
        if (!old) return old;
        return old.map((t) =>
          t.id === activeTask.id ? { ...t, status: overId as TaskStatus } : t
        );
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!canEdit || !over) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    const overId = over.id as string;
    const isOverColumn = COLUMNS.some((c) => c.id === overId);
    const newStatus = isOverColumn ? (overId as TaskStatus) : activeTask.status;

    const tasksInColumn = tasksByStatus[newStatus].filter((t) => t.id !== activeTask.id);
    let newPosition = 0;

    if (!isOverColumn) {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) {
        const overIndex = tasksInColumn.findIndex((t) => t.id === overTask.id);
        newPosition = overIndex >= 0 ? overIndex : tasksInColumn.length;
      }
    } else {
      newPosition = tasksInColumn.length;
    }

    if (activeTask.status !== newStatus || activeTask.position !== newPosition) {
      await updateMutation.mutateAsync({
        id: activeTask.id,
        input: { status: newStatus, position: newPosition }
      });
    }
  };

  const handleOpenCreateModal = (status: TaskStatus) => {
    setCreateForStatus(status);
    setShowCreateModal(true);
  };

  const handleCreateTask = (data: CreateTaskInput | UpdateTaskInput) => {
    if (!spaceId) return;
    createMutation.mutate({
      ...(data as CreateTaskInput),
      space_id: spaceId,
      status: createForStatus
    });
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white dark:bg-[#14151a] border-b border-gray-200 dark:border-[#1f2229] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/workspace"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{space?.name || 'Loading...'}</h1>
              {space?.description && (
                <p className="text-sm text-gray-500 dark:text-slate-400">{space.description}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowEmptyColumns(!showEmptyColumns)}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            {showEmptyColumns ? 'Hide' : 'Show'} empty columns
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto bg-gray-100 dark:bg-[#14151a] p-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-6 h-full min-w-max">
              {COLUMNS.filter(column => showEmptyColumns || tasksByStatus[column.id].length > 0).map((column) => (
                <div key={column.id} className="w-80 flex flex-col">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: column.color }}
                      />
                      <h2 className="font-semibold text-gray-700 dark:text-slate-300">{column.title}</h2>
                      <span className="text-sm text-gray-400">
                        {tasksByStatus[column.id].length}
                      </span>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => handleOpenCreateModal(column.id)}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-colors"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                  <Column id={column.id}>
                    <SortableContext
                      items={tasksByStatus[column.id].map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="flex flex-col gap-3 min-h-[200px]">
                        {tasksByStatus[column.id].map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onClick={() => setSelectedTask(task)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </Column>
                </div>
              ))}
            </div>

            <DragOverlay>
              {activeTask && <TaskCard task={activeTask} isDragging />}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Create Task Modal */}
      {showCreateModal && canEdit && (
        <TaskModal
          mode="create"
          initialStatus={createForStatus}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateTask}
          isLoading={createMutation.isPending}
        />
      )}

      {/* Edit Task Modal */}
      {selectedTask && (
        <TaskModal
          mode={canEdit ? "edit" : "edit"}
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onSubmit={(data) =>
            canEdit ? updateMutation.mutate({ id: selectedTask.id, input: data }) : undefined
          }
          onDelete={canEdit ? () => {
            if (confirm('Are you sure you want to delete this task?')) {
              deleteMutation.mutate(selectedTask.id);
            }
          } : undefined}
          isLoading={updateMutation.isPending}
        />
      )}
    </div>
  );
}
