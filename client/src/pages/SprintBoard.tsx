import { useState, useMemo, useEffect, useRef, useCallback, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, ChevronRight, ChevronDown,
  X, User, Calendar,
  MoreHorizontal, Search, Filter,
  Circle, CheckCircle2, Flag,
  ListFilter, Tag,
  List as ListIcon, CheckSquare, Check,
  Eye, GripVertical, ChevronLeft, Zap, FileText, Link, Calculator, Sparkles,
  GitBranch, Clock, ArrowUpDown, EyeOff, Trash2, Edit2, Columns
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import {
  tasksApi, membersApi, customFieldsApi, sprintFoldersApi, sprintsApi, spacesApi, taskStatusesApi, spaceMembersApi,
  type Member, type CustomField, type CustomFieldValue, type TaskStatus as ApiTaskStatus
} from '../services/api';
import type { Space, Task, TaskStatus, TaskPriority, UpdateTaskInput, SprintFolder, Sprint } from '../types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '../context/AuthContext';
import TaskDetailPanel from '../components/TaskDetailPanel';
import TaskRowMenu from '../components/TaskRowMenu';
import CustomFieldPanel from '../components/CustomFieldPanel';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ===================== Constants =====================

const priorities: { value: TaskPriority; label: string; color: string; flagColor: string }[] = [
  { value: 'LOW', label: 'Low', color: '#9ca3af', flagColor: '#9ca3af' },
  { value: 'MEDIUM', label: 'Normal', color: '#9ca3af', flagColor: '#9ca3af' },
  { value: 'HIGH', label: 'High', color: '#f97316', flagColor: '#f97316' },
  { value: 'URGENT', label: 'Urgent', color: '#ef4444', flagColor: '#ef4444' }
];

const BASE_GROUP_BY_OPTIONS = [
  { value: 'status', label: 'Status', icon: Circle, field: 'status' },
  { value: 'priority', label: 'Priority', icon: Flag, field: 'priority' },
  { value: 'sprint', label: 'Sprint', icon: Zap, field: 'sprint' },
  { value: 'assignee', label: 'Assignee', icon: User, field: 'assignee' },
  { value: 'dueDate', label: 'Due date', icon: Calendar, field: 'due_date' },
  { value: 'none', label: 'None', icon: ListFilter, field: '' },
];

const BASE_FILTER_OPTIONS = [
  { id: 'status', label: 'Status', icon: Circle, field: 'status' },
  { id: 'priority', label: 'Priority', icon: Flag, field: 'priority' },
  { id: 'assignee', label: 'Assignee', icon: User, field: 'assignee' },
  { id: 'dueDate', label: 'Due date', icon: Calendar, field: 'due_date' },
  { id: 'sprint', label: 'Sprint', icon: Zap, field: 'sprint' },
  { id: 'points', label: 'Points', icon: Calculator, field: 'sprint_points' },
];

const CUSTOM_FIELD_ICON_MAP: Record<string, typeof Circle> = {
  dropdown: ListIcon, text: FileText, textarea: FileText, number: Calculator,
  date: Calendar, checkbox: CheckSquare, labels: Tag, people: User,
  email: FileText, phone: FileText, website: Link, url: Link,
  money: Calculator, rating: Sparkles, voting: Check, files: FileText,
};

interface StatusConfig {
  name: string;
  color: string;
  bgColor: string;
  id?: string;
  status_group?: 'active' | 'done' | 'closed';
  position?: number;
}

function categorizeStatus(status: StatusConfig): 'active' | 'done' | 'closed' {
  if (status.status_group) return status.status_group;
  const name = status.name.toUpperCase();
  if (/\b(DONE|COMPLETE|COMPLETED|FINISHED|RESOLVED)\b/.test(name)) return 'done';
  if (/\b(CLOSED|CANCELLED|CANCELED|ARCHIVED|REJECTED)\b/.test(name)) return 'closed';
  return 'active';
}

type BaseFieldKey = 'name' | 'assignee' | 'due_date' | 'priority' | 'status' | 'sprint_points' | 'sprint';

type SprintListViewSettings = {
  fields: Record<BaseFieldKey, boolean>;
  custom_fields: Record<string, boolean>;
  unified_column_order?: string[];
};

const DEFAULT_SETTINGS: SprintListViewSettings = {
  fields: {
    name: true, status: true, assignee: true, priority: true,
    due_date: true, sprint_points: true, sprint: true,
  },
  custom_fields: {},
  unified_column_order: ['name', 'status', 'assignee', 'priority', 'due_date', 'sprint_points', 'sprint'],
};

const BASE_FIELD_ITEMS: { key: BaseFieldKey; label: string; locked?: boolean }[] = [
  { key: 'name', label: 'Task Name', locked: true },
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'priority', label: 'Priority' },
  { key: 'due_date', label: 'Due date' },
  { key: 'sprint_points', label: 'Points' },
  { key: 'sprint', label: 'Sprint' },
];

const ASSIGNEE_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'
];

const COLOR_SWATCHES = [
  '#6b7280', '#3b82f6', '#8b5cf6', '#22c55e', '#ef4444',
  '#f97316', '#eab308', '#14b8a6', '#ec4899', '#06b6d4',
  '#a855f7', '#10b981', '#f43f5e', '#0ea5e9', '#84cc16',
  '#d946ef', '#6366f1', '#facc15', '#fb923c', '#64748b'
];

// ===================== Sub-Components =====================

function SortableTaskRow({ task, children }: { task: Task; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto' as any,
    position: 'relative' as const,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} className="group">
      <div className="flex items-center">
        <div
          {...listeners}
          className="flex items-center justify-center w-6 h-full cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
        </div>
        {children}
      </div>
    </div>
  );
}

function SortableColumnHeader({
  id, label, widthClass, isLocked, openMenuId, setOpenMenuId,
  onMoveStart, onMoveEnd, onHide, canMoveStart, canMoveEnd,
}: {
  id: string; label: string; widthClass: string; isLocked?: boolean;
  openMenuId: string | null; setOpenMenuId: (id: string | null) => void;
  onMoveStart: () => void; onMoveEnd: () => void; onHide: () => void;
  canMoveStart: boolean; canMoveEnd: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const isMenuOpen = openMenuId === id;

  return (
    <div ref={setNodeRef} style={style} className={`${widthClass} relative group`}>
      <div
        {...(isLocked ? {} : { ...attributes, ...listeners })}
        className={isLocked ? "flex items-center gap-1" : "flex items-center justify-center gap-0.5 cursor-grab active:cursor-grabbing"}
      >
        <span className="truncate text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</span>
        {!isLocked && (
          <button
            onClick={(e) => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : id); }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-400 dark:text-slate-500"
          >
            <MoreHorizontal className="w-3 h-3" />
          </button>
        )}
      </div>
      {isMenuOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 py-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => { onMoveStart(); setOpenMenuId(null); }} disabled={!canMoveStart}
            className={cn("w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-700", !canMoveStart && "opacity-50 cursor-not-allowed")}>
            <ChevronLeft className="w-3.5 h-3.5" /> Move to start
          </button>
          <button onClick={() => { onMoveEnd(); setOpenMenuId(null); }} disabled={!canMoveEnd}
            className={cn("w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-700", !canMoveEnd && "opacity-50 cursor-not-allowed")}>
            <ChevronRight className="w-3.5 h-3.5" /> Move to end
          </button>
          <button onClick={() => { onHide(); setOpenMenuId(null); }}
            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-700">
            <Eye className="w-3.5 h-3.5" /> Hide column
          </button>
        </div>
      )}
    </div>
  );
}

// ===================== Main Component =====================

export default function SprintBoard() {
  const queryClient = useQueryClient();
  const { member, canEdit, needsSpaceAccess } = useAuth();

  // DnD sensors
  const columnSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const taskDragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ---- State ----
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [selectedSprintIds, setSelectedSprintIds] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState('status');
  const [searchQuery, setSearchQuery] = useState('');
  const [showClosedTasks, setShowClosedTasks] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showGroupByDropdown, setShowGroupByDropdown] = useState(false);
  const [showFolderDropdown, setShowFolderDropdown] = useState(false);
  const [showSprintDropdown, setShowSprintDropdown] = useState(false);
  const [showViewPanel, setShowViewPanel] = useState(false);
  const [viewPanelStep, setViewPanelStep] = useState<'customize' | 'fields'>('customize');
  const [viewPanelSearch, setViewPanelSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [openColumnMenuId, setOpenColumnMenuId] = useState<string | null>(null);

  // Inline editing state
  const [openStatusDropdownId, setOpenStatusDropdownId] = useState<string | null>(null);
  const [openPriorityDropdownId, setOpenPriorityDropdownId] = useState<string | null>(null);
  const [openAssigneePickerId, setOpenAssigneePickerId] = useState<string | null>(null);
  const [openDatePickerId, setOpenDatePickerId] = useState<string | null>(null);
  const [editingSprintPointsId, setEditingSprintPointsId] = useState<string | null>(null);
  const [sprintPointsValue, setSprintPointsValue] = useState('');
  const [statusDropdownSearch, setStatusDropdownSearch] = useState('');
  const [statusDropdownTab, setStatusDropdownTab] = useState<'all' | 'active' | 'done' | 'closed'>('all');
  const [assigneeSearch, setAssigneeSearch] = useState('');

  // Inline add task
  const [inlineAddGroup, setInlineAddGroup] = useState<string | null>(null);
  const [inlineTaskName, setInlineTaskName] = useState('');

  // Filter state
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({ status: [], priority: [], assignee: [] });
  const [filterStartDate, setFilterStartDate] = useState<string | null>(null);
  const [filterEndDate, setFilterEndDate] = useState<string | null>(null);
  const [appliedFilterTypes, setAppliedFilterTypes] = useState<string[]>([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Task Statuses Modal state
  const [showTaskStatusesModal, setShowTaskStatusesModal] = useState(false);
  const [taskStatusesTarget, setTaskStatusesTarget] = useState<{
    type: 'space' | 'sprint';
    id: string;
    name: string;
    spaceId?: string;
    spaceName?: string;
  } | null>(null);
  const [taskStatusesInheritedFrom, setTaskStatusesInheritedFrom] = useState<{ type: 'space'; name: string } | null>(null);
  const [taskStatusesUseCustom, setTaskStatusesUseCustom] = useState(false);
  const [taskStatusesList, setTaskStatusesList] = useState<StatusConfig[]>([]);
  const [taskStatusesParentStatuses, setTaskStatusesParentStatuses] = useState<StatusConfig[]>([]);
  const [taskStatusesCustomStatuses, setTaskStatusesCustomStatuses] = useState<StatusConfig[]>([]);
  const [taskStatusesTemplate, setTaskStatusesTemplate] = useState<string>('custom');
  const [taskStatusesAddName, setTaskStatusesAddName] = useState('');
  const [taskStatusesAddColor, setTaskStatusesAddColor] = useState('#3b82f6');
  const [showTaskStatusesAddForm, setShowTaskStatusesAddForm] = useState(false);
  const [statusAddingToSection, setStatusAddingToSection] = useState<'active' | 'done' | 'closed'>('active');
  const [statusColorPickerIdx, setStatusColorPickerIdx] = useState<number | null>(null);
  const [statusMenuOpenIdx, setStatusMenuOpenIdx] = useState<number | null>(null);
  const [statusRenameIdx, setStatusRenameIdx] = useState<number | null>(null);
  const [taskStatusesOriginalNames, setTaskStatusesOriginalNames] = useState<string[]>([]);

  // Custom Field Panel state
  const [showCustomFieldPanel, setShowCustomFieldPanel] = useState(false);

  // Column settings
  const [settings, setSettings] = useState<SprintListViewSettings>(() => {
    try {
      const saved = localStorage.getItem('sprint-list-view-settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });

  // Date picker calendar state
  const [datePickerMonth, setDatePickerMonth] = useState(new Date());

  // Refs for click-outside
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const priorityDropdownRef = useRef<HTMLDivElement>(null);
  const assigneePickerRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const groupByRef = useRef<HTMLDivElement>(null);
  const folderDropdownRef = useRef<HTMLDivElement>(null);
  const sprintDropdownRef = useRef<HTMLDivElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // ---- Queries ----
  const { data: sprintFolders = [] } = useQuery({
    queryKey: ['sprint-folders'],
    queryFn: () => sprintFoldersApi.getAll(),
  });

  const { data: allSprints = [] } = useQuery({
    queryKey: ['all-sprints'],
    queryFn: () => sprintsApi.getAll(),
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.getAll(),
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => membersApi.getAll(),
  });

  const { data: spaces = [] } = useQuery({
    queryKey: ['spaces'],
    queryFn: () => spacesApi.getAll(),
  });

  // Fetch accessible spaces for guests/limited members
  const { data: memberSpaceAccess = [] } = useQuery({
    queryKey: ['memberSpaceAccess', member?.id],
    queryFn: () => member?.id ? spaceMembersApi.getByMember(member.id) : Promise.resolve([]),
    enabled: needsSpaceAccess && !!member?.id,
  });

  const accessibleSpaceIds = useMemo(() => {
    if (!needsSpaceAccess) return null;
    return new Set(memberSpaceAccess.map((sa: { space_id: string }) => sa.space_id));
  }, [needsSpaceAccess, memberSpaceAccess]);

  const { data: allCustomFields = [] } = useQuery({
    queryKey: ['custom-fields-all'],
    queryFn: () => customFieldsApi.getAll(),
  });

  // Determine relevant space IDs based on folder/sprint selection
  const contextSpaceIds = useMemo(() => {
    if (selectedSprintIds.length > 0) {
      // Space IDs from selected sprints
      const ids = new Set<string>();
      selectedSprintIds.forEach(sid => {
        const sprint = allSprints.find(s => s.id === sid);
        if (sprint) ids.add(sprint.space_id);
      });
      return [...ids];
    }
    if (selectedFolderId !== 'all') {
      const folder = sprintFolders.find(sf => sf.id === selectedFolderId);
      return folder ? [folder.space_id] : [];
    }
    // All space IDs from sprint folders
    return [...new Set(sprintFolders.map(sf => sf.space_id))];
  }, [selectedFolderId, selectedSprintIds, allSprints, sprintFolders]);

  // Fallback to all space IDs if no sprint folders exist yet
  const effectiveSpaceIds = useMemo(() => {
    return contextSpaceIds.length > 0 ? contextSpaceIds : [...new Set(spaces.map(s => s.id))];
  }, [contextSpaceIds, spaces]);

  // Fetch space-level statuses as fallback
  const { data: spaceTaskStatuses = [] } = useQuery({
    queryKey: ['task-statuses-spaces', effectiveSpaceIds],
    queryFn: async () => {
      if (effectiveSpaceIds.length === 0) return [];
      const results = await Promise.all(effectiveSpaceIds.map(id => taskStatusesApi.getBySpace(id).catch(() => [])));
      return results.flat();
    },
    enabled: effectiveSpaceIds.length > 0,
  });

  // Sprints filtered by selected folder (needed early for sprint-level status fetch)
  const visibleSprints = useMemo(() => {
    let sprints = selectedFolderId === 'all' ? allSprints : allSprints.filter(s => s.sprint_folder_id === selectedFolderId);
    // Filter for guests: only sprints in accessible spaces
    if (accessibleSpaceIds) {
      sprints = sprints.filter(s => accessibleSpaceIds.has(s.space_id));
    }
    return sprints;
  }, [allSprints, selectedFolderId, accessibleSpaceIds]);

  // Fetch sprint-level statuses for visible sprints (strict isolation - sprints have own statuses)
  const visibleSprintIds = useMemo(() => visibleSprints.map(s => s.id), [visibleSprints]);
  const { data: sprintTaskStatuses = [] } = useQuery({
    queryKey: ['task-statuses-sprints', visibleSprintIds],
    queryFn: async () => {
      if (visibleSprintIds.length === 0) return [];
      const results = await Promise.all(visibleSprintIds.map(id => taskStatusesApi.getBySprint(id).catch(() => [])));
      return results.flat();
    },
    enabled: visibleSprintIds.length > 0,
  });

  // Fetch custom field values for sprint tasks
  const sprintTaskIds = useMemo(() => allTasks.filter(t => t.sprint_id).map(t => t.id), [allTasks]);
  const { data: customFieldValues = [] } = useQuery({
    queryKey: ['custom-field-values-sprint', sprintTaskIds],
    queryFn: () => sprintTaskIds.length > 0 ? customFieldsApi.getValuesBatch(sprintTaskIds) : Promise.resolve([]),
    enabled: sprintTaskIds.length > 0,
  });

  // ---- Derived data ----
  const sprintMap = useMemo(() => {
    const map = new Map<string, Sprint>();
    allSprints.forEach(s => map.set(s.id, s));
    return map;
  }, [allSprints]);

  const sprintFolderMap = useMemo(() => {
    const map = new Map<string, SprintFolder>();
    sprintFolders.forEach(sf => map.set(sf.id, sf));
    return map;
  }, [sprintFolders]);

  // Filter sprint folders for guests (only folders in accessible spaces)
  const filteredSprintFolders = useMemo(() => {
    if (!accessibleSpaceIds) return sprintFolders;
    return sprintFolders.filter(sf => accessibleSpaceIds.has(sf.space_id));
  }, [sprintFolders, accessibleSpaceIds]);

  const spaceMap = useMemo(() => {
    const map = new Map<string, Space>();
    spaces.forEach(s => map.set(s.id, s));
    return map;
  }, [spaces]);

  // Helper: get display name for a sprint folder (Space → Folder)
  const getFolderDisplayName = useCallback((sf: SprintFolder) => {
    const space = spaceMap.get(sf.space_id);
    return space ? `${space.name} → ${sf.name}` : sf.name;
  }, [spaceMap]);

  // Helper: get display name for a sprint (with folder context)
  const getSprintDisplayName = useCallback((s: Sprint) => {
    const folder = sprintFolderMap.get(s.sprint_folder_id);
    const space = folder ? spaceMap.get(folder.space_id) : null;
    const prefix = space ? `${space.name} → ` : '';
    return { name: s.name, context: prefix };
  }, [sprintFolderMap, spaceMap]);

  // Sprint tasks (tasks with sprint_id, filtered by folder/sprint selection)
  const sprintTasks = useMemo(() => {
    let tasks = allTasks.filter(t => t.sprint_id != null);

    // Filter for guests: only tasks in accessible spaces
    if (accessibleSpaceIds) {
      tasks = tasks.filter(t => accessibleSpaceIds.has(t.space_id));
    }

    // Filter by selected folder
    if (selectedFolderId !== 'all') {
      const folderSprintIds = new Set(allSprints.filter(s => s.sprint_folder_id === selectedFolderId).map(s => s.id));
      tasks = tasks.filter(t => t.sprint_id && folderSprintIds.has(t.sprint_id));
    }

    // Filter by selected sprints
    if (selectedSprintIds.length > 0) {
      tasks = tasks.filter(t => t.sprint_id && selectedSprintIds.includes(t.sprint_id));
    }

    return tasks;
  }, [allTasks, allSprints, selectedFolderId, selectedSprintIds, accessibleSpaceIds]);

  // Statuses dynamically derived: sprint-level first, then space-level fallback, then task statuses
  const statuses: StatusConfig[] = useMemo(() => {
    const result: StatusConfig[] = [];
    const seen = new Set<string>();

    const addStatus = (s: { name: string; color: string; id?: string; status_group?: 'active' | 'done' | 'closed'; position?: number }) => {
      const key = s.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ name: s.name, color: s.color, bgColor: s.color, id: s.id, status_group: s.status_group, position: s.position });
      }
    };

    // Sprint-level statuses take priority (strict isolation)
    if (sprintTaskStatuses.length > 0) {
      [...sprintTaskStatuses]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .forEach(addStatus);
    }

    // Space-level statuses as fallback
    if (spaceTaskStatuses.length > 0) {
      [...spaceTaskStatuses]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .forEach(addStatus);
    }

    // Then add any statuses found in visible tasks that aren't in the configured lists
    sprintTasks.forEach(t => {
      if (t.status) addStatus({ name: t.status, color: '#6b7280' });
    });

    // Fallback defaults if nothing found
    if (result.length === 0) {
      return [
        { name: 'To Do', color: '#6b7280', bgColor: '#6b7280' },
        { name: 'In Progress', color: '#3b82f6', bgColor: '#3b82f6' },
        { name: 'Review', color: '#8b5cf6', bgColor: '#8b5cf6' },
        { name: 'Done', color: '#22c55e', bgColor: '#22c55e' },
      ];
    }
    return result;
  }, [sprintTaskStatuses, spaceTaskStatuses, sprintTasks]);

  // Check if the single selected sprint has custom statuses
  const selectedSingleSprint = selectedSprintIds.length === 1 ? sprintMap.get(selectedSprintIds[0]) : null;
  const sprintHasCustomStatuses = selectedSingleSprint && sprintTaskStatuses.some(s => s.sprint_id === selectedSingleSprint.id);
  const selectedSprintSpace = selectedSingleSprint ? spaceMap.get(selectedSingleSprint.space_id) : null;

  // Field value map: taskId -> fieldId -> value
  const fieldValueMap = useMemo(() => {
    const map: Record<string, Record<string, CustomFieldValue>> = {};
    customFieldValues.forEach(v => {
      if (!map[v.task_id]) map[v.task_id] = {};
      map[v.task_id][v.field_id] = v;
    });
    return map;
  }, [customFieldValues]);

  // Unique assignees (derived from currently visible sprint tasks - changes with folder/sprint)
  const uniqueAssignees = useMemo(() => {
    const set = new Set<string>();
    sprintTasks.forEach(t => {
      if (t.assignees?.length) t.assignees.forEach(a => set.add(a));
      else if (t.assignee_name) set.add(t.assignee_name);
    });
    return Array.from(set).sort();
  }, [sprintTasks]);

  // Unique priorities found in visible tasks (for filter highlighting)
  const uniquePriorities = useMemo(() => {
    return [...new Set(sprintTasks.map(t => t.priority))];
  }, [sprintTasks]);

  const visibleCustomFields = useMemo(() => {
    return allCustomFields.filter(f => settings.custom_fields[f.id]);
  }, [allCustomFields, settings.custom_fields]);

  // Unique values per custom field (for filters and grouping)
  const uniqueCfValues = useMemo(() => {
    const result: Record<string, string[]> = {};
    visibleCustomFields.forEach(cf => {
      const vals = new Set<string>();
      sprintTasks.forEach(t => {
        const fv = fieldValueMap[t.id]?.[cf.id];
        if (!fv) return;
        if (cf.type === 'dropdown' || cf.type === 'text') {
          if (fv.value_text) vals.add(fv.value_text);
        } else if (cf.type === 'labels' || cf.type === 'people') {
          const arr = fv.value_json;
          if (Array.isArray(arr)) arr.forEach((v: string) => vals.add(v));
          else if (fv.value_text) vals.add(fv.value_text);
        } else if (cf.type === 'checkbox') {
          vals.add('Yes');
          vals.add('No');
        }
      });
      result[cf.id] = Array.from(vals).sort();
    });
    return result;
  }, [visibleCustomFields, sprintTasks, fieldValueMap]);

  // Helper to get a task's custom field display value
  const getTaskCfValue = (taskId: string, fieldId: string, fieldType: string): string[] => {
    const fv = fieldValueMap[taskId]?.[fieldId];
    if (!fv) return [];
    if (fieldType === 'dropdown' || fieldType === 'text') return fv.value_text ? [fv.value_text] : [];
    if (fieldType === 'labels' || fieldType === 'people') {
      const arr = fv.value_json;
      if (Array.isArray(arr)) return arr;
      return fv.value_text ? [fv.value_text] : [];
    }
    if (fieldType === 'checkbox') return [fv.value_boolean ? 'Yes' : 'No'];
    return [];
  };

  // ---- Filters ----
  const filteredTasks = useMemo(() => {
    let filtered = [...sprintTasks];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => t.name.toLowerCase().includes(q));
    }

    // Status filter
    if ((activeFilters.status || []).length > 0) {
      filtered = filtered.filter(t => (activeFilters.status || []).includes(t.status));
    }

    // Priority filter
    if ((activeFilters.priority || []).length > 0) {
      filtered = filtered.filter(t => (activeFilters.priority || []).includes(t.priority));
    }

    // Assignee filter
    if ((activeFilters.assignee || []).length > 0) {
      filtered = filtered.filter(t => {
        if (t.assignees?.length) return t.assignees.some(a => (activeFilters.assignee || []).includes(a));
        return t.assignee_name ? (activeFilters.assignee || []).includes(t.assignee_name) : false;
      });
    }

    // Due date range
    if (filterStartDate || filterEndDate) {
      filtered = filtered.filter(t => {
        if (!t.due_date) return false;
        const d = new Date(t.due_date);
        d.setHours(0, 0, 0, 0);
        if (filterStartDate && filterEndDate) {
          const s = new Date(filterStartDate); s.setHours(0, 0, 0, 0);
          const e = new Date(filterEndDate); e.setHours(23, 59, 59, 999);
          return d >= s && d <= e;
        } else if (filterStartDate) {
          const s = new Date(filterStartDate); s.setHours(0, 0, 0, 0);
          return d >= s;
        } else if (filterEndDate) {
          const e = new Date(filterEndDate); e.setHours(23, 59, 59, 999);
          return d <= e;
        }
        return true;
      });
    }

    // Sprint filter
    if ((activeFilters.sprint || []).length > 0) {
      filtered = filtered.filter(t => {
        const sprintName = t.sprint_id ? (sprintMap.get(t.sprint_id)?.name || '') : '';
        return (activeFilters.sprint || []).includes(sprintName);
      });
    }

    // Points filter
    if ((activeFilters.points || []).length > 0) {
      filtered = filtered.filter(t => {
        const pts = t.sprint_points != null ? String(t.sprint_points) : 'No Points';
        return (activeFilters.points || []).includes(pts);
      });
    }

    // Custom field filters
    visibleCustomFields.forEach(cf => {
      const key = `cf_${cf.id}`;
      const filterVals = activeFilters[key];
      if (filterVals && filterVals.length > 0) {
        filtered = filtered.filter(t => {
          const taskVals = getTaskCfValue(t.id, cf.id, cf.type);
          return taskVals.some(v => filterVals.includes(v));
        });
      }
    });

    // Hide closed tasks
    if (!showClosedTasks) {
      filtered = filtered.filter(t =>
        t.status !== 'Done' && t.status !== 'Completed' && t.status !== 'Closed' && t.status !== 'Archived'
      );
    }

    return filtered;
  }, [sprintTasks, searchQuery, activeFilters, filterStartDate, filterEndDate, showClosedTasks, visibleCustomFields, fieldValueMap, sprintMap]);

  // ---- Group by ----
  const groupedTasks = useMemo(() => {
    const groups: Record<string, { name: string; color: string; tasks: Task[] }> = {};

    if (groupBy === 'status') {
      statuses.forEach(s => {
        groups[s.name] = { name: s.name, color: s.bgColor, tasks: filteredTasks.filter(t => t.status === s.name) };
      });
      const configured = new Set(statuses.map(s => s.name));
      filteredTasks.forEach(t => {
        if (t.status && !configured.has(t.status)) {
          if (!groups[t.status]) groups[t.status] = { name: t.status, color: '#6b7280', tasks: [] };
          groups[t.status].tasks.push(t);
        }
      });
      // Remove empty groups
      Object.keys(groups).forEach(k => { if (groups[k].tasks.length === 0) delete groups[k]; });
    } else if (groupBy === 'priority') {
      priorities.forEach(p => {
        groups[p.value] = { name: p.label, color: p.flagColor, tasks: filteredTasks.filter(t => t.priority === p.value) };
      });
    } else if (groupBy === 'sprint') {
      visibleSprints.forEach(s => {
        groups[s.id] = { name: s.name, color: '#6366f1', tasks: filteredTasks.filter(t => t.sprint_id === s.id) };
      });
      const noSprint = filteredTasks.filter(t => !t.sprint_id || !sprintMap.has(t.sprint_id));
      if (noSprint.length > 0) groups['no-sprint'] = { name: 'No Sprint', color: '#94a3b8', tasks: noSprint };
      Object.keys(groups).forEach(k => { if (groups[k].tasks.length === 0) delete groups[k]; });
    } else if (groupBy === 'assignee') {
      const byAssignee: Record<string, Task[]> = {};
      const unassigned: Task[] = [];
      filteredTasks.forEach(t => {
        if (t.assignees?.length) {
          t.assignees.forEach(a => { if (!byAssignee[a]) byAssignee[a] = []; byAssignee[a].push(t); });
        } else if (t.assignee_name) {
          if (!byAssignee[t.assignee_name]) byAssignee[t.assignee_name] = [];
          byAssignee[t.assignee_name].push(t);
        } else {
          unassigned.push(t);
        }
      });
      Object.keys(byAssignee).sort().forEach(name => {
        groups[name] = { name, color: '#6366f1', tasks: byAssignee[name] };
      });
      if (unassigned.length > 0) groups['Unassigned'] = { name: 'Unassigned', color: '#94a3b8', tasks: unassigned };
    } else if (groupBy === 'dueDate') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 7);
      groups['Overdue'] = { name: 'Overdue', color: '#ef4444', tasks: [] };
      groups['Today'] = { name: 'Today', color: '#f97316', tasks: [] };
      groups['Tomorrow'] = { name: 'Tomorrow', color: '#eab308', tasks: [] };
      groups['This Week'] = { name: 'This Week', color: '#22c55e', tasks: [] };
      groups['Later'] = { name: 'Later', color: '#3b82f6', tasks: [] };
      groups['No Date'] = { name: 'No Date', color: '#94a3b8', tasks: [] };
      filteredTasks.forEach(t => {
        if (!t.due_date) { groups['No Date'].tasks.push(t); return; }
        const d = new Date(t.due_date); d.setHours(0, 0, 0, 0);
        if (d < today) groups['Overdue'].tasks.push(t);
        else if (d.getTime() === today.getTime()) groups['Today'].tasks.push(t);
        else if (d.getTime() === tomorrow.getTime()) groups['Tomorrow'].tasks.push(t);
        else if (d < nextWeek) groups['This Week'].tasks.push(t);
        else groups['Later'].tasks.push(t);
      });
      Object.keys(groups).forEach(k => { if (groups[k].tasks.length === 0) delete groups[k]; });
    } else if (groupBy.startsWith('cf_')) {
      // Custom field grouping
      const cfId = groupBy.replace('cf_', '');
      const cf = visibleCustomFields.find(f => f.id === cfId);
      if (cf) {
        const byValue: Record<string, Task[]> = {};
        const noValue: Task[] = [];
        filteredTasks.forEach(t => {
          const vals = getTaskCfValue(t.id, cf.id, cf.type);
          if (vals.length === 0) {
            noValue.push(t);
          } else {
            vals.forEach(v => {
              if (!byValue[v]) byValue[v] = [];
              byValue[v].push(t);
            });
          }
        });
        // If dropdown with options, use option order and colors
        if (cf.type === 'dropdown' && cf.type_config?.options) {
          cf.type_config.options.forEach(opt => {
            if (byValue[opt.name]) {
              groups[opt.name] = { name: opt.name, color: opt.color || '#6366f1', tasks: byValue[opt.name] };
            }
          });
          // Add any values not in options
          Object.keys(byValue).forEach(v => {
            if (!groups[v]) groups[v] = { name: v, color: '#6b7280', tasks: byValue[v] };
          });
        } else {
          Object.keys(byValue).sort().forEach(v => {
            groups[v] = { name: v, color: '#6366f1', tasks: byValue[v] };
          });
        }
        if (noValue.length > 0) groups['No Value'] = { name: 'No Value', color: '#94a3b8', tasks: noValue };
      } else {
        groups['All Tasks'] = { name: 'All Tasks', color: '#6366f1', tasks: filteredTasks };
      }
    } else {
      groups['All Tasks'] = { name: 'All Tasks', color: '#6366f1', tasks: filteredTasks };
    }

    // Sort within groups by position
    Object.values(groups).forEach(g => g.tasks.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)));
    return groups;
  }, [filteredTasks, groupBy, statuses, visibleSprints, sprintMap, visibleCustomFields, fieldValueMap]);

  // ---- Column system ----
  const allColumnIds = useMemo(() => {
    if (settings.unified_column_order?.length) {
      return settings.unified_column_order.filter(id => {
        if (BASE_FIELD_ITEMS.some(f => f.key === id)) return settings.fields[id as BaseFieldKey] !== false;
        return settings.custom_fields[id] === true;
      });
    }
    const base = (Object.keys(settings.fields) as BaseFieldKey[]).filter(k => settings.fields[k]);
    const custom = Object.entries(settings.custom_fields).filter(([, v]) => v).map(([k]) => k);
    return [...base, ...custom];
  }, [settings]);

  // Dynamic Group By options based on visible columns + custom fields
  const GROUP_BY_OPTIONS = useMemo(() => {
    const visibleBaseFields = new Set(
      (Object.keys(settings.fields) as BaseFieldKey[]).filter(k => settings.fields[k])
    );
    // Always include 'none', and base options that have visible columns
    const options = BASE_GROUP_BY_OPTIONS.filter(o =>
      o.value === 'none' || !o.field || visibleBaseFields.has(o.field as BaseFieldKey)
    );
    // Add groupable custom fields (dropdown, labels, people, checkbox)
    visibleCustomFields.forEach(cf => {
      if (['dropdown', 'labels', 'people', 'checkbox'].includes(cf.type)) {
        const icon = CUSTOM_FIELD_ICON_MAP[cf.type] || ListFilter;
        options.splice(options.length - 1, 0, { value: `cf_${cf.id}`, label: cf.name, icon, field: cf.id });
      }
    });
    return options;
  }, [settings.fields, visibleCustomFields]);

  // Dynamic Filter options based on visible columns + custom fields
  const FILTER_OPTIONS = useMemo(() => {
    const visibleBaseFields = new Set(
      (Object.keys(settings.fields) as BaseFieldKey[]).filter(k => settings.fields[k])
    );
    const options = BASE_FILTER_OPTIONS.filter(o => !o.field || visibleBaseFields.has(o.field as BaseFieldKey));
    // Add all visible custom fields as filter options
    visibleCustomFields.forEach(cf => {
      const icon = CUSTOM_FIELD_ICON_MAP[cf.type] || ListFilter;
      options.push({ id: `cf_${cf.id}`, label: cf.name, icon, field: cf.id });
    });
    return options;
  }, [settings.fields, visibleCustomFields]);

  const filteredBaseFields = useMemo(() => {
    if (!viewPanelSearch.trim()) return BASE_FIELD_ITEMS;
    const q = viewPanelSearch.toLowerCase();
    return BASE_FIELD_ITEMS.filter(f => f.label.toLowerCase().includes(q));
  }, [viewPanelSearch]);

  const filteredCustomFieldsForPanel = useMemo(() => {
    if (!viewPanelSearch.trim()) return allCustomFields;
    const q = viewPanelSearch.toLowerCase();
    return allCustomFields.filter(f => f.name.toLowerCase().includes(q));
  }, [allCustomFields, viewPanelSearch]);

  const applySettings = useCallback((updates: Partial<SprintListViewSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      if (updates.fields) next.fields = { ...prev.fields, ...updates.fields };
      if (updates.custom_fields) next.custom_fields = { ...prev.custom_fields, ...updates.custom_fields };
      localStorage.setItem('sprint-list-view-settings', JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleColumn = useCallback((id: string) => {
    const isBase = BASE_FIELD_ITEMS.some(f => f.key === id);
    if (isBase) {
      const key = id as BaseFieldKey;
      if (key === 'name') return; // Can't hide name
      const newVal = !settings.fields[key];
      const newFields = { ...settings.fields, [key]: newVal };
      let newOrder = settings.unified_column_order ? [...settings.unified_column_order] : [...allColumnIds];
      if (newVal && !newOrder.includes(id)) newOrder.push(id);
      if (!newVal) newOrder = newOrder.filter(x => x !== id);
      applySettings({ fields: newFields, unified_column_order: newOrder });
    } else {
      const newVal = !settings.custom_fields[id];
      const newCF = { ...settings.custom_fields, [id]: newVal };
      let newOrder = settings.unified_column_order ? [...settings.unified_column_order] : [...allColumnIds];
      if (newVal && !newOrder.includes(id)) newOrder.push(id);
      if (!newVal) newOrder = newOrder.filter(x => x !== id);
      applySettings({ custom_fields: newCF, unified_column_order: newOrder });
    }
  }, [settings, allColumnIds, applySettings]);

  const moveColumn = useCallback((id: string, position: 'start' | 'end') => {
    const order = settings.unified_column_order ? [...settings.unified_column_order] : [...allColumnIds];
    const idx = order.indexOf(id);
    if (idx === -1) return;
    order.splice(idx, 1);
    if (position === 'start') {
      const nameIdx = order.indexOf('name');
      order.splice(nameIdx + 1, 0, id);
    } else {
      order.push(id);
    }
    applySettings({ unified_column_order: order });
  }, [settings.unified_column_order, allColumnIds, applySettings]);

  const handleColumnDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const order = settings.unified_column_order ? [...settings.unified_column_order] : [...allColumnIds];
    const oldIdx = order.indexOf(String(active.id));
    const newIdx = order.indexOf(String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    applySettings({ unified_column_order: arrayMove(order, oldIdx, newIdx) });
  }, [settings.unified_column_order, allColumnIds, applySettings]);

  // ---- Mutations ----
  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskInput }) => {
      if (!canEdit) return Promise.reject(new Error('Read-only access'));
      return tasksApi.update(id, data);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); },
    onError: () => { toast.error('Failed to update task'); },
  });

  const createTaskMutation = useMutation({
    mutationFn: (input: { name: string; space_id: string; sprint_id?: string; status?: string; priority?: TaskPriority }) => {
      if (!canEdit) return Promise.reject(new Error('Read-only access'));
      return tasksApi.create(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setInlineTaskName('');
      setInlineAddGroup(null);
      toast.success('Task created');
    },
    onError: () => { toast.error('Failed to create task'); },
  });

  const setFieldValueMutation = useMutation({
    mutationFn: ({ taskId, fieldId, value }: { taskId: string; fieldId: string; value: any }) => {
      if (!canEdit) return Promise.reject(new Error('Read-only access'));
      return customFieldsApi.setValue(taskId, fieldId, value);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['custom-field-values-sprint'] }); },
  });

  // ---- Task DnD ----
  const handleTaskDragEnd = useCallback((event: DragEndEvent, groupTasks: Task[]) => {
    if (!canEdit) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = groupTasks.findIndex(t => t.id === active.id);
    const newIdx = groupTasks.findIndex(t => t.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(groupTasks, oldIdx, newIdx);
    reordered.forEach((task, idx) => {
      if (task.position !== idx) tasksApi.update(task.id, { position: idx });
    });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }, [queryClient]);

  // ---- Inline add task ----
  const handleInlineAddTask = useCallback((groupKey: string) => {
    if (!canEdit) return;
    if (!inlineTaskName.trim()) return;
    // Find a space_id from existing sprint tasks or first space
    const firstSpace = spaces[0];
    if (!firstSpace) { toast.error('No space found'); return; }

    let sprintId: string | undefined;
    let status: string | undefined;

    if (groupBy === 'sprint' && groupKey !== 'no-sprint') {
      sprintId = groupKey;
    } else if (groupBy === 'status') {
      status = groupKey;
      // Pick first available sprint
      const firstSprint = visibleSprints[0];
      sprintId = selectedSprintIds[0] || firstSprint?.id;
    } else {
      const firstSprint = visibleSprints[0];
      sprintId = selectedSprintIds[0] || firstSprint?.id;
    }

    createTaskMutation.mutate({
      name: inlineTaskName.trim(),
      space_id: firstSpace.id,
      sprint_id: sprintId,
      status: status || 'To Do',
      priority: groupBy === 'priority' ? (groupKey as TaskPriority) : 'MEDIUM',
    });
  }, [inlineTaskName, spaces, groupBy, visibleSprints, selectedSprintIds, createTaskMutation]);

  // Reset filters when folder/sprint context changes (so filters stay relevant)
  useEffect(() => {
    setActiveFilters({ status: [], priority: [], assignee: [] });
    setFilterStartDate(null);
    setFilterEndDate(null);
  }, [selectedFolderId, selectedSprintIds.join(',')]);

  // Keep selectedTask in sync with latest query data
  useEffect(() => {
    if (selectedTask) {
      const updated = allTasks.find(t => t.id === selectedTask.id);
      if (updated && updated !== selectedTask) {
        setSelectedTask(updated);
      }
    }
  }, [allTasks, selectedTask]);

  // ---- Status templates ----
  const statusTemplates: Record<string, StatusConfig[]> = {
    simple: [
      { name: 'TO DO', color: '#6b7280', bgColor: '#6b7280', status_group: 'active' },
      { name: 'IN PROGRESS', color: '#3b82f6', bgColor: '#3b82f6', status_group: 'active' },
      { name: 'DONE', color: '#22c55e', bgColor: '#22c55e', status_group: 'done' }
    ],
    scrum: [
      { name: 'BACKLOG', color: '#6b7280', bgColor: '#6b7280', status_group: 'active' },
      { name: 'TO DO', color: '#3b82f6', bgColor: '#3b82f6', status_group: 'active' },
      { name: 'IN PROGRESS', color: '#f59e0b', bgColor: '#f59e0b', status_group: 'active' },
      { name: 'REVIEW', color: '#8b5cf6', bgColor: '#8b5cf6', status_group: 'active' },
      { name: 'DONE', color: '#22c55e', bgColor: '#22c55e', status_group: 'done' }
    ],
    kanban: [
      { name: 'BACKLOG', color: '#6b7280', bgColor: '#6b7280', status_group: 'active' },
      { name: 'READY', color: '#06b6d4', bgColor: '#06b6d4', status_group: 'active' },
      { name: 'IN PROGRESS', color: '#3b82f6', bgColor: '#3b82f6', status_group: 'active' },
      { name: 'DONE', color: '#22c55e', bgColor: '#22c55e', status_group: 'done' },
      { name: 'CLOSED', color: '#64748b', bgColor: '#64748b', status_group: 'closed' }
    ]
  };

  const applyStatusTemplate = (template: string) => {
    setTaskStatusesTemplate(template);
    if (template === 'custom') return;
    const t = statusTemplates[template];
    if (t) setTaskStatusesList(t.map(s => ({ ...s })));
  };

  const resetStatusModalState = () => {
    setTaskStatusesList([]);
    setTaskStatusesParentStatuses([]);
    setTaskStatusesCustomStatuses([]);
    setTaskStatusesTemplate('custom');
    setTaskStatusesAddName('');
    setTaskStatusesAddColor('#3b82f6');
    setShowTaskStatusesAddForm(false);
    setTaskStatusesTarget(null);
    setTaskStatusesInheritedFrom(null);
    setTaskStatusesUseCustom(true);
    setStatusAddingToSection('active');
    setStatusColorPickerIdx(null);
    setStatusMenuOpenIdx(null);
    setStatusRenameIdx(null);
    setTaskStatusesOriginalNames([]);
  };

  // Open task statuses modal for a sprint
  const openSprintTaskStatuses = async (sprint: Sprint) => {
    const parentSpace = spaces.find(s => s.id === sprint.space_id);
    setTaskStatusesTarget({
      type: 'sprint', id: sprint.id, name: sprint.name,
      spaceId: sprint.space_id, spaceName: parentSpace?.name || 'Space',
    });
    setTaskStatusesInheritedFrom({ type: 'space', name: parentSpace?.name || 'Space' });
    try {
      const sprintStatuses = await taskStatusesApi.getBySprint(sprint.id);
      const spaceStatuses = parentSpace ? await taskStatusesApi.getBySpace(parentSpace.id) : [];
      const parentMapped = spaceStatuses.map((s: ApiTaskStatus) => ({
        id: s.id, name: s.name, color: s.color, bgColor: s.color,
        status_group: s.status_group, position: s.position,
      }));
      const customMapped = sprintStatuses.map((s: ApiTaskStatus) => ({
        id: s.id, name: s.name, color: s.color, bgColor: s.color,
        status_group: s.status_group, position: s.position,
      }));
      setTaskStatusesParentStatuses(parentMapped);
      setTaskStatusesCustomStatuses(customMapped);
      if (sprintStatuses.length > 0) {
        setTaskStatusesUseCustom(true);
        setTaskStatusesList(customMapped);
        setTaskStatusesOriginalNames(customMapped.map(s => s.name));
      } else {
        setTaskStatusesUseCustom(false);
        setTaskStatusesList(parentMapped);
        setTaskStatusesOriginalNames(parentMapped.map(s => s.name));
      }
      setTaskStatusesTemplate('custom');
    } catch {
      setTaskStatusesList([]);
      setTaskStatusesParentStatuses([]);
      setTaskStatusesCustomStatuses([]);
      setTaskStatusesUseCustom(false);
      setTaskStatusesOriginalNames([]);
    }
    setShowTaskStatusesAddForm(false);
    setShowTaskStatusesModal(true);
  };

  // Open task statuses modal for a space
  const openSpaceTaskStatuses = async (space: Space) => {
    setTaskStatusesTarget({
      type: 'space', id: space.id, name: space.name,
      spaceId: space.id, spaceName: space.name,
    });
    setTaskStatusesInheritedFrom(null);
    setTaskStatusesUseCustom(true);
    try {
      const spaceStatuses = await taskStatusesApi.getBySpace(space.id);
      const mapped = spaceStatuses.map((s: ApiTaskStatus) => ({
        id: s.id, name: s.name, color: s.color, bgColor: s.color,
        status_group: s.status_group, position: s.position,
      }));
      setTaskStatusesList(mapped);
      setTaskStatusesOriginalNames(mapped.map(s => s.name));
    } catch {
      setTaskStatusesList([]);
      setTaskStatusesOriginalNames([]);
    }
    setShowTaskStatusesAddForm(false);
    setShowTaskStatusesModal(true);
  };

  // Apply task statuses changes
  const handleApplyTaskStatuses = async () => {
    if (!taskStatusesTarget) return;
    try {
      const scopeParam: Record<string, string> = {};
      if (taskStatusesTarget.type === 'space') scopeParam.space_id = taskStatusesTarget.id;
      else if (taskStatusesTarget.type === 'sprint') scopeParam.sprint_id = taskStatusesTarget.id;

      const statusesToSave = taskStatusesUseCustom ? taskStatusesList : [];

      // Detect renamed statuses and update tasks
      if (taskStatusesUseCustom && taskStatusesOriginalNames.length > 0) {
        for (let i = 0; i < taskStatusesOriginalNames.length; i++) {
          const oldName = taskStatusesOriginalNames[i];
          const newStatus = taskStatusesList[i];
          if (newStatus && newStatus.name !== oldName) {
            let query = supabase.from('lists').update({ status: newStatus.name }).eq('status', oldName);
            if (taskStatusesTarget.type === 'space') query = query.eq('space_id', taskStatusesTarget.id);
            else if (taskStatusesTarget.type === 'sprint') query = query.eq('sprint_id', taskStatusesTarget.id);
            await query;
          }
        }
      }

      await taskStatusesApi.bulkUpdate({
        statuses: statusesToSave.map((s, idx) => ({
          name: s.name, color: s.color,
          status_group: categorizeStatus(s), position: idx,
        })),
        ...scopeParam,
      });

      toast.success(`Statuses saved for ${taskStatusesTarget.type}: ${taskStatusesTarget.name}`);
      queryClient.invalidateQueries({ queryKey: ['task-statuses-spaces'] });
      queryClient.invalidateQueries({ queryKey: ['task-statuses-sprints'] });
      queryClient.invalidateQueries({ queryKey: ['task-statuses-space'] });
      queryClient.invalidateQueries({ queryKey: ['task-statuses-folder'] });
      queryClient.invalidateQueries({ queryKey: ['task-statuses-list'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowTaskStatusesModal(false);
      resetStatusModalState();
    } catch {
      toast.error('Failed to save statuses');
    }
  };

  const handleAddTaskStatus = () => {
    if (!taskStatusesAddName.trim()) return;
    setTaskStatusesList([...taskStatusesList, {
      name: taskStatusesAddName.trim().toUpperCase(),
      color: taskStatusesAddColor, bgColor: taskStatusesAddColor,
      status_group: statusAddingToSection, position: taskStatusesList.length,
    }]);
    setTaskStatusesAddName('');
    setTaskStatusesAddColor('#3b82f6');
    setShowTaskStatusesAddForm(false);
  };

  const handleRemoveTaskStatus = (index: number) => {
    setTaskStatusesList(taskStatusesList.filter((_, i) => i !== index));
  };

  // ---- Click outside handlers ----
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (openStatusDropdownId && statusDropdownRef.current && !statusDropdownRef.current.contains(target)) {
        setOpenStatusDropdownId(null); setStatusDropdownSearch(''); setStatusDropdownTab('all');
      }
      if (openPriorityDropdownId && priorityDropdownRef.current && !priorityDropdownRef.current.contains(target)) {
        setOpenPriorityDropdownId(null);
      }
      if (openAssigneePickerId && assigneePickerRef.current && !assigneePickerRef.current.contains(target)) {
        setOpenAssigneePickerId(null); setAssigneeSearch('');
      }
      if (openDatePickerId && datePickerRef.current && !datePickerRef.current.contains(target)) {
        setOpenDatePickerId(null);
      }
      if (showGroupByDropdown && groupByRef.current && !groupByRef.current.contains(target)) {
        setShowGroupByDropdown(false);
      }
      if (showFolderDropdown && folderDropdownRef.current && !folderDropdownRef.current.contains(target)) {
        setShowFolderDropdown(false);
      }
      if (showSprintDropdown && sprintDropdownRef.current && !sprintDropdownRef.current.contains(target)) {
        setShowSprintDropdown(false);
      }
      if (showFilterDropdown && filterDropdownRef.current && !filterDropdownRef.current.contains(target)) {
        setShowFilterDropdown(false);
      }
      if (openColumnMenuId) {
        const menu = document.querySelector('[data-column-menu]');
        const trigger = document.querySelector('[data-column-menu-trigger]');
        if (menu && !menu.contains(target) && trigger && !trigger.contains(target)) {
          setOpenColumnMenuId(null);
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openStatusDropdownId, openPriorityDropdownId, openAssigneePickerId, openDatePickerId, showGroupByDropdown, showFolderDropdown, showSprintDropdown, showFilterDropdown, openColumnMenuId]);

  // ---- Filter helpers ----
  const toggleFilter = useCallback((type: string, value: string) => {
    setActiveFilters(prev => {
      const arr = prev[type] || [];
      return { ...prev, [type]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    });
  }, []);

  const addFilterType = useCallback((type: string) => {
    if (!appliedFilterTypes.includes(type)) setAppliedFilterTypes(prev => [...prev, type]);
    setShowFilterDropdown(false);
  }, [appliedFilterTypes]);

  const removeFilterType = useCallback((type: string) => {
    setAppliedFilterTypes(prev => prev.filter(t => t !== type));
    if (type === 'dueDate') { setFilterStartDate(null); setFilterEndDate(null); }
    else setActiveFilters(prev => ({ ...prev, [type]: [] }));
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = Object.values(activeFilters).reduce((sum, arr) => sum + arr.length, 0);
    if (filterStartDate || filterEndDate) count++;
    return count;
  }, [activeFilters, filterStartDate, filterEndDate]);

  // ---- Helpers ----
  const getColumnWidth = (id: string) => {
    if (id === 'name') return 'flex-1 pl-2 min-w-[180px]';
    if (id === 'status') return 'w-28 text-center flex-shrink-0';
    if (id === 'assignee') return 'w-24 text-center flex-shrink-0';
    if (id === 'priority') return 'w-20 text-center flex-shrink-0';
    if (id === 'due_date') return 'w-24 text-center flex-shrink-0';
    if (id === 'sprint_points') return 'w-24 text-center flex-shrink-0';
    if (id === 'sprint') return 'w-36 text-center flex-shrink-0';
    return 'w-24 text-center flex-shrink-0';
  };

  const getColumnLabel = (id: string) => {
    const item = BASE_FIELD_ITEMS.find(f => f.key === id);
    if (item) return item.label;
    const cf = allCustomFields.find(f => f.id === id);
    return cf?.name || id;
  };

  const formatDate = (dateStr: string) => {
    try { return format(new Date(dateStr), 'MMM d'); } catch { return dateStr; }
  };

  const isOverdue = (dateStr: string | null) => {
    if (!dateStr) return false;
    const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return d < today;
  };

  const totalPoints = useMemo(() => {
    return filteredTasks.reduce((sum, t) => sum + (t.sprint_points || 0), 0);
  }, [filteredTasks]);

  // ---- Calendar helper for date pickers ----
  const renderCalendar = (month: Date, onSelect: (date: string) => void, selectedDate?: string | null) => {
    const year = month.getFullYear();
    const m = month.getMonth();
    const firstDay = new Date(year, m, 1).getDay();
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    const today = new Date(); today.setHours(0, 0, 0, 0);

    return (
      <div className="p-2">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => {
            const d = new Date(month);
            d.setMonth(d.getMonth() - 1);
            if (onSelect === handleDatePickerSelect) setDatePickerMonth(d);
            else setCalendarMonth(d);
          }} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium">{format(month, 'MMMM yyyy')}</span>
          <button onClick={() => {
            const d = new Date(month);
            d.setMonth(d.getMonth() + 1);
            if (onSelect === handleDatePickerSelect) setDatePickerMonth(d);
            else setCalendarMonth(d);
          }} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="text-[10px] text-gray-400 py-1">{d}</div>
          ))}
          {days.map((day, i) => {
            if (!day) return <div key={`e-${i}`} />;
            const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dateObj = new Date(year, m, day);
            const isToday = dateObj.getTime() === today.getTime();
            const isSelected = selectedDate && selectedDate.startsWith(dateStr);
            return (
              <button
                key={dateStr}
                onClick={() => onSelect(dateStr)}
                className={cn(
                  "w-7 h-7 text-xs rounded-full flex items-center justify-center transition-colors",
                  isSelected ? "bg-violet-600 text-white" : isToday ? "bg-violet-100 dark:bg-violet-900/30 text-violet-600" : "hover:bg-gray-100 dark:hover:bg-slate-700"
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const handleDatePickerSelect = useCallback((dateStr: string) => {
    if (!openDatePickerId) return;
    updateTaskMutation.mutate({ id: openDatePickerId, data: { due_date: dateStr } });
    setOpenDatePickerId(null);
  }, [openDatePickerId, updateTaskMutation]);

  // ---- Render cell ----
  const renderCell = (colId: string, task: Task) => {
    const sprint = task.sprint_id ? sprintMap.get(task.sprint_id) : null;
    const statusConfig = statuses.find(s => s.name === task.status);
    const statusColor = statusConfig?.color || '#6b7280';
    const priorityConfig = priorities.find(p => p.value === task.priority);

    if (colId === 'name') {
      return (
        <div className={getColumnWidth('name')}>
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedTask(task); }}
              className="text-sm text-gray-900 dark:text-white truncate hover:text-violet-600 dark:hover:text-violet-400 text-left"
            >
              {task.name}
            </button>
          </div>
        </div>
      );
    }

    if (colId === 'status') {
      return (
        <div className={`${getColumnWidth('status')} relative`} ref={openStatusDropdownId === task.id ? statusDropdownRef : undefined}>
          <button
            onClick={(e) => { e.stopPropagation(); if (!canEdit) return; setOpenStatusDropdownId(openStatusDropdownId === task.id ? null : task.id); setStatusDropdownSearch(''); setStatusDropdownTab('all'); }}
            className={`flex items-center gap-1.5 px-2 py-1 rounded mx-auto ${canEdit ? 'hover:bg-gray-100 dark:hover:bg-slate-700' : 'cursor-default'}`}
          >
            <Circle className="w-3 h-3 flex-shrink-0" style={{ color: statusColor }} fill={statusColor} />
            <span className="text-xs font-medium truncate max-w-[80px]">{task.status || 'No Status'}</span>
          </button>
          {openStatusDropdownId === task.id && (() => {
            const allStatuses = statuses;
            const filteredBySearch = allStatuses.filter(s => s.name.toLowerCase().includes(statusDropdownSearch.toLowerCase()));
            const filtered = statusDropdownTab === 'all' ? filteredBySearch : filteredBySearch.filter(s => categorizeStatus(s) === statusDropdownTab);
            return (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50" onClick={e => e.stopPropagation()}>
                <div className="px-3 py-2 border-b border-gray-200 dark:border-[#1f2229]">
                  <input type="text" value={statusDropdownSearch} onChange={e => setStatusDropdownSearch(e.target.value)}
                    placeholder="Search..." className="w-full px-2 py-1 text-xs bg-gray-100 dark:bg-[#1a1b24] border border-gray-200 dark:border-[#1f2229] rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none" autoFocus />
                </div>
                <div className="flex items-center gap-0.5 px-2 py-1 border-b border-gray-100 dark:border-[#1f2229]">
                  {(['all', 'active', 'done', 'closed'] as const).map(tab => (
                    <button key={tab} onClick={() => setStatusDropdownTab(tab)}
                      className={cn("px-2 py-0.5 text-[10px] font-medium rounded capitalize", statusDropdownTab === tab ? "bg-violet-500/15 text-violet-400" : "text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700")}>
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="py-1 max-h-48 overflow-y-auto">
                  {filtered.map(s => (
                    <button key={s.name} onClick={() => { updateTaskMutation.mutate({ id: task.id, data: { status: s.name } }); setOpenStatusDropdownId(null); }}
                      className={cn("w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-slate-700", task.status === s.name && "bg-gray-100 dark:bg-[#15161a]")}>
                      <Circle className="w-3 h-3" style={{ color: s.color }} fill={s.color} />
                      <span className="text-gray-900 dark:text-white text-xs">{s.name}</span>
                      {task.status === s.name && <Check className="w-3 h-3 ml-auto text-violet-400" />}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      );
    }

    if (colId === 'assignee') {
      const assignees = task.assignees?.length ? task.assignees : task.assignee_name ? [task.assignee_name] : [];
      return (
        <div className={`${getColumnWidth('assignee')} relative`} ref={openAssigneePickerId === task.id ? assigneePickerRef : undefined}>
          <button
            onClick={(e) => { e.stopPropagation(); if (!canEdit) return; setOpenAssigneePickerId(openAssigneePickerId === task.id ? null : task.id); setAssigneeSearch(''); }}
            className={`flex items-center justify-center mx-auto ${!canEdit ? 'cursor-default' : ''}`}
          >
            {assignees.length > 0 ? (
              <div className="flex -space-x-1.5">
                {assignees.slice(0, 3).map((name, idx) => {
                  const colorIdx = name.charCodeAt(0) % ASSIGNEE_COLORS.length;
                  return (
                    <Avatar key={idx} className="w-6 h-6 border-2 border-white dark:border-[#14151a]">
                      <AvatarFallback style={{ backgroundColor: ASSIGNEE_COLORS[colorIdx] }} className="text-white text-[9px] font-medium">
                        {name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                  );
                })}
                {assignees.length > 3 && <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-700 border-2 border-white dark:border-[#14151a] flex items-center justify-center text-[9px] font-medium">+{assignees.length - 3}</div>}
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full border border-dashed border-gray-300 dark:border-slate-600 flex items-center justify-center hover:border-violet-400 transition-colors">
                <User className="w-3 h-3 text-gray-400 dark:text-slate-500" />
              </div>
            )}
          </button>
          {openAssigneePickerId === task.id && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50" onClick={e => e.stopPropagation()}>
              <div className="px-3 py-2 border-b border-gray-200 dark:border-[#1f2229]">
                <input type="text" value={assigneeSearch} onChange={e => setAssigneeSearch(e.target.value)}
                  placeholder="Search members..." className="w-full px-2 py-1 text-xs bg-gray-100 dark:bg-[#1a1b24] border border-gray-200 dark:border-[#1f2229] rounded text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none" autoFocus />
              </div>
              <div className="py-1 max-h-48 overflow-y-auto">
                {members.filter(m => m.name.toLowerCase().includes(assigneeSearch.toLowerCase())).map(m => {
                  const isSelected = assignees.includes(m.name);
                  return (
                    <button key={m.id} onClick={() => {
                      const current = task.assignees || (task.assignee_name ? [task.assignee_name] : []);
                      const newAssignees = isSelected ? current.filter(a => a !== m.name) : [...current, m.name];
                      updateTaskMutation.mutate({ id: task.id, data: { assignees: newAssignees, assignee_name: newAssignees[0] || null } });
                    }}
                      className={cn("w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-slate-700", isSelected && "bg-violet-50 dark:bg-violet-900/10")}>
                      <Avatar className="w-5 h-5">
                        <AvatarFallback style={{ backgroundColor: ASSIGNEE_COLORS[m.name.charCodeAt(0) % ASSIGNEE_COLORS.length] }} className="text-white text-[8px]">
                          {m.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-gray-900 dark:text-white">{m.name}</span>
                      {isSelected && <Check className="w-3 h-3 ml-auto text-violet-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (colId === 'priority') {
      return (
        <div className={`${getColumnWidth('priority')} relative`} ref={openPriorityDropdownId === task.id ? priorityDropdownRef : undefined}>
          <button
            onClick={(e) => { e.stopPropagation(); if (!canEdit) return; setOpenPriorityDropdownId(openPriorityDropdownId === task.id ? null : task.id); }}
            className={`flex items-center gap-1 px-2 py-1 rounded mx-auto ${canEdit ? 'hover:bg-gray-100 dark:hover:bg-slate-700' : 'cursor-default'}`}
          >
            <Flag className="w-4 h-4" style={{ color: priorityConfig?.flagColor || '#9ca3af' }}
              fill={task.priority === 'URGENT' || task.priority === 'HIGH' ? priorityConfig?.flagColor : 'none'} />
            {task.priority === 'URGENT' && <span className="text-[10px] text-red-500 font-medium">Urgent</span>}
          </button>
          {openPriorityDropdownId === task.id && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50" onClick={e => e.stopPropagation()}>
              <div className="py-1">
                {priorities.map(p => (
                  <button key={p.value} onClick={() => { updateTaskMutation.mutate({ id: task.id, data: { priority: p.value } }); setOpenPriorityDropdownId(null); }}
                    className={cn("w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-slate-700", task.priority === p.value && "bg-gray-100 dark:bg-[#15161a]")}>
                    <Flag className="w-3.5 h-3.5" style={{ color: p.flagColor }} fill={p.value === 'URGENT' || p.value === 'HIGH' ? p.flagColor : 'none'} />
                    <span className="text-xs text-gray-900 dark:text-white">{p.label}</span>
                    {task.priority === p.value && <Check className="w-3 h-3 ml-auto text-violet-400" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (colId === 'due_date') {
      return (
        <div className={`${getColumnWidth('due_date')} relative`} ref={openDatePickerId === task.id ? datePickerRef : undefined}>
          <button
            onClick={(e) => { e.stopPropagation(); if (!canEdit) return; setOpenDatePickerId(openDatePickerId === task.id ? null : task.id); setDatePickerMonth(task.due_date ? new Date(task.due_date) : new Date()); }}
            className={`flex items-center gap-1 px-2 py-1 rounded mx-auto ${canEdit ? 'hover:bg-gray-100 dark:hover:bg-slate-700' : 'cursor-default'}`}
          >
            {task.due_date ? (
              <span className={cn("text-xs", isOverdue(task.due_date) && task.status !== 'Done' ? "text-red-400" : "text-gray-600 dark:text-slate-300")}>
                {formatDate(task.due_date)}
              </span>
            ) : (
              <Calendar className="w-4 h-4 text-gray-400 dark:text-slate-600" />
            )}
          </button>
          {openDatePickerId === task.id && (
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 w-56" onClick={e => e.stopPropagation()}>
              <div className="p-2 border-b border-gray-100 dark:border-[#1f2229] space-y-1">
                {[{ label: 'Today', offset: 0 }, { label: 'Tomorrow', offset: 1 }, { label: 'Next Week', offset: 7 }].map(opt => {
                  const d = new Date(); d.setDate(d.getDate() + opt.offset);
                  const dateStr = d.toISOString().split('T')[0];
                  return (
                    <button key={opt.label} onClick={() => { updateTaskMutation.mutate({ id: task.id, data: { due_date: dateStr } }); setOpenDatePickerId(null); }}
                      className="w-full text-left px-2 py-1 text-xs text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
                      {opt.label}
                    </button>
                  );
                })}
                {task.due_date && (
                  <button onClick={() => { updateTaskMutation.mutate({ id: task.id, data: { due_date: null } }); setOpenDatePickerId(null); }}
                    className="w-full text-left px-2 py-1 text-xs text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
                    Clear date
                  </button>
                )}
              </div>
              {renderCalendar(datePickerMonth, handleDatePickerSelect, task.due_date)}
            </div>
          )}
        </div>
      );
    }

    if (colId === 'sprint_points') {
      return (
        <div className={getColumnWidth('sprint_points')}>
          {editingSprintPointsId === task.id ? (
            <input type="number" value={sprintPointsValue}
              onChange={e => setSprintPointsValue(e.target.value)}
              onBlur={() => {
                const val = parseInt(sprintPointsValue);
                if (!isNaN(val) && val !== task.sprint_points) {
                  updateTaskMutation.mutate({ id: task.id, data: { sprint_points: val } });
                }
                setEditingSprintPointsId(null);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setEditingSprintPointsId(null);
              }}
              className="w-12 mx-auto text-center text-sm bg-transparent border border-violet-400 rounded px-1 py-0.5 text-gray-900 dark:text-white focus:outline-none"
              autoFocus />
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); if (!canEdit) return; setEditingSprintPointsId(task.id); setSprintPointsValue(String(task.sprint_points || '')); }}
              className={`text-sm text-teal-600 dark:text-teal-400 font-semibold rounded px-2 py-0.5 mx-auto block ${canEdit ? 'hover:bg-gray-100 dark:hover:bg-slate-700' : 'cursor-default'}`}
            >
              {task.sprint_points != null ? task.sprint_points : '—'}
            </button>
          )}
        </div>
      );
    }

    if (colId === 'sprint') {
      return (
        <div className={getColumnWidth('sprint')}>
          {sprint ? (
            <div className="text-xs text-gray-600 dark:text-slate-400 truncate px-1">
              <span className="font-medium text-gray-800 dark:text-slate-300">{sprint.name}</span>
              {sprint.start_date && sprint.end_date && (
                <span className="ml-1 text-[10px] text-gray-400 dark:text-slate-500">
                  {formatDate(sprint.start_date)} - {formatDate(sprint.end_date)}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-400 dark:text-slate-600">—</span>
          )}
        </div>
      );
    }

    // Custom field cell
    const field = allCustomFields.find(f => f.id === colId);
    if (!field) return <div className={getColumnWidth(colId)} />;
    const fv = fieldValueMap[task.id]?.[field.id];
    let displayValue = '—';
    if (field.type === 'dropdown') {
      const opt = field.type_config?.options?.find((o: any) => o.id === fv?.value_json);
      displayValue = opt?.name || '—';
    } else if (field.type === 'checkbox') {
      displayValue = fv?.value_boolean ? '✓' : '—';
    } else if (field.type === 'number' || field.type === 'money' || field.type === 'currency') {
      displayValue = fv?.value_number != null ? String(fv.value_number) : '—';
    } else if (field.type === 'date') {
      displayValue = fv?.value_date ? formatDate(fv.value_date) : '—';
    } else {
      displayValue = fv?.value_text || '—';
    }

    return (
      <div className={getColumnWidth(colId)}>
        <span className="text-xs text-gray-600 dark:text-slate-400 truncate">{displayValue}</span>
      </div>
    );
  };

  // ================ JSX ================

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-[#0f1014]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-[#1f2229] bg-white dark:bg-[#14151a]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Sprint Overview</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} across {visibleSprints.length} sprint{visibleSprints.length !== 1 ? 's' : ''}
              {totalPoints > 0 && <span className="ml-2 text-teal-600 dark:text-teal-400">{totalPoints} pts</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Sprint Folder Selector */}
            <div className="relative" ref={folderDropdownRef}>
              <button onClick={() => setShowFolderDropdown(!showFolderDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-[#1f2229] rounded-lg hover:bg-gray-200 dark:hover:bg-[#282a33] text-gray-700 dark:text-slate-300 max-w-[220px]">
                <Zap className="w-4 h-4 text-violet-500 flex-shrink-0" />
                <span className="truncate">
                  {selectedFolderId === 'all' ? 'All Folders' : (() => {
                    const sf = sprintFolderMap.get(selectedFolderId);
                    return sf ? getFolderDisplayName(sf) : 'All Folders';
                  })()}
                </span>
                <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
              </button>
              {showFolderDropdown && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 py-1">
                  <button onClick={() => { setSelectedFolderId('all'); setSelectedSprintIds([]); setShowFolderDropdown(false); }}
                    className={cn("w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center justify-between", selectedFolderId === 'all' && "bg-gray-100 dark:bg-[#15161a]")}>
                    <span>All Folders</span>
                    {selectedFolderId === 'all' && <Check className="w-3 h-3 text-violet-400 flex-shrink-0" />}
                  </button>
                  {filteredSprintFolders.map(sf => {
                    const space = spaceMap.get(sf.space_id);
                    return (
                      <button key={sf.id} onClick={() => { setSelectedFolderId(sf.id); setSelectedSprintIds([]); setShowFolderDropdown(false); }}
                        className={cn("w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center justify-between gap-2", selectedFolderId === sf.id && "bg-gray-100 dark:bg-[#15161a]")}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {space && (
                              <span className="text-xs font-bold text-gray-900 dark:text-white truncate">{space.name}</span>
                            )}
                            {space && <span className="text-[10px] text-gray-400 dark:text-slate-500">→</span>}
                            <span className="truncate font-medium text-gray-700 dark:text-slate-300">{sf.name}</span>
                          </div>
                        </div>
                        {selectedFolderId === sf.id && <Check className="w-3 h-3 text-violet-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sprint Multi-Select */}
            <div className="relative" ref={sprintDropdownRef}>
              <button onClick={() => setShowSprintDropdown(!showSprintDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-[#1f2229] rounded-lg hover:bg-gray-200 dark:hover:bg-[#282a33] text-gray-700 dark:text-slate-300 max-w-[200px]">
                <GitBranch className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className="truncate">
                  {selectedSprintIds.length === 0 ? 'All Sprints' : selectedSprintIds.length === 1
                    ? (sprintMap.get(selectedSprintIds[0])?.name || '1 Sprint')
                    : `${selectedSprintIds.length} Sprints`}
                </span>
                <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
              </button>
              {showSprintDropdown && (
                <div className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 py-1">
                  <button onClick={() => { setSelectedSprintIds([]); }}
                    className={cn("w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700", selectedSprintIds.length === 0 && "bg-gray-100 dark:bg-[#15161a]")}>
                    All Sprints
                  </button>
                  <div className="border-t border-gray-100 dark:border-[#1f2229] my-1" />
                  <div className="max-h-60 overflow-y-auto">
                    {visibleSprints.map(s => {
                      const isSelected = selectedSprintIds.includes(s.id);
                      const { context } = getSprintDisplayName(s);
                      return (
                        <button key={s.id} onClick={() => {
                          setSelectedSprintIds(prev => isSelected ? prev.filter(x => x !== s.id) : [...prev, s.id]);
                        }}
                          className={cn("w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2", isSelected && "bg-violet-50 dark:bg-violet-900/10")}>
                          <div className={cn("w-4 h-4 rounded border flex items-center justify-center flex-shrink-0", isSelected ? "bg-violet-600 border-violet-600" : "border-gray-300 dark:border-slate-600")}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              {context && <span className="text-[10px] text-gray-400 dark:text-slate-500">{context}</span>}
                              <span className="text-gray-900 dark:text-white truncate">{s.name}</span>
                            </div>
                          </div>
                          {s.start_date && (
                            <span className="text-[10px] text-gray-400 flex-shrink-0">
                              {formatDate(s.start_date)} - {s.end_date ? formatDate(s.end_date) : ''}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Add Task Button */}
            {canEdit && (
              <button
                onClick={() => {
                  const firstSprint = visibleSprints[0];
                  const firstSpace = spaces[0];
                  if (!firstSpace) { toast.error('Create a space first'); return; }
                  if (!firstSprint) { toast.error('Create a sprint first'); return; }
                  createTaskMutation.mutate({ name: 'New Task', space_id: firstSpace.id, sprint_id: firstSprint.id, status: 'To Do' });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Task
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-2 border-b border-gray-200 dark:border-[#1f2229] bg-white dark:bg-[#14151a] flex items-center gap-3">
        {/* Group By */}
        <div className="relative" ref={groupByRef}>
          <button onClick={() => setShowGroupByDropdown(!showGroupByDropdown)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-[#1f2229] rounded-lg">
            <ListFilter className="w-3.5 h-3.5" />
            Group: {GROUP_BY_OPTIONS.find(o => o.value === groupBy)?.label}
          </button>
          {showGroupByDropdown && (
            <div className="absolute left-0 top-full mt-1 w-44 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 py-1">
              {GROUP_BY_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => { setGroupBy(opt.value); setShowGroupByDropdown(false); }}
                  className={cn("w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-700", groupBy === opt.value && "bg-gray-100 dark:bg-[#15161a]")}>
                  <opt.icon className="w-3.5 h-3.5" />
                  {opt.label}
                  {groupBy === opt.value && <Check className="w-3 h-3 ml-auto text-violet-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filter */}
        <div className="relative">
          <button onClick={() => setShowFilters(!showFilters)}
            className={cn("flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg",
              activeFilterCount > 0 ? "text-violet-600 bg-violet-50 dark:bg-violet-900/20" : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-[#1f2229]")}>
            <Filter className="w-3.5 h-3.5" />
            Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 dark:bg-[#1f2229] border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-500" />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
        </div>

        {/* Customize view sidebar trigger */}
        <button onClick={() => { setShowViewPanel(true); setViewPanelStep('customize'); setViewPanelSearch(''); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-[#1f2229] rounded-lg">
          <Columns className="w-3.5 h-3.5" />
          Customize
        </button>

        {/* Hide closed tasks toggle */}
        <button onClick={() => setShowClosedTasks(!showClosedTasks)}
          className={cn("flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg",
            !showClosedTasks ? "text-violet-600 bg-violet-50 dark:bg-violet-900/20" : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-[#1f2229]")}>
          {showClosedTasks ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {showClosedTasks ? 'Showing closed' : 'Hiding closed'}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="px-6 py-3 border-b border-gray-200 dark:border-[#1f2229] bg-gray-50 dark:bg-[#0f1014]">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-gray-500 dark:text-slate-400">Filters:</span>
            {/* Add filter dropdown */}
            <div className="relative" ref={filterDropdownRef}>
              <button onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-[#1f2229] rounded border border-dashed border-gray-300 dark:border-slate-600">
                <Plus className="w-3 h-3" /> Add filter
              </button>
              {showFilterDropdown && (
                <div className="absolute left-0 top-full mt-1 w-44 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 py-1">
                  {FILTER_OPTIONS.filter(o => !appliedFilterTypes.includes(o.id)).map(opt => (
                    <button key={opt.id} onClick={() => addFilterType(opt.id)}
                      className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-700">
                      <opt.icon className="w-3.5 h-3.5" /> {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {activeFilterCount > 0 && (
              <button onClick={() => { setAppliedFilterTypes([]); setActiveFilters(prev => { const cleared: Record<string, string[]> = {}; Object.keys(prev).forEach(k => { cleared[k] = []; }); return cleared; }); setFilterStartDate(null); setFilterEndDate(null); }}
                className="text-xs text-red-400 hover:text-red-500 ml-auto">
                Clear all
              </button>
            )}
          </div>

          {appliedFilterTypes.length > 0 && (
            <div className="space-y-3">
              {appliedFilterTypes.map(type => (
                <div key={type} className="bg-white dark:bg-[#14151a] rounded-lg p-3 border border-gray-200 dark:border-[#1f2229]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700 dark:text-slate-300 capitalize">{type === 'dueDate' ? 'Due Date' : type}</span>
                    <button onClick={() => removeFilterType(type)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded">
                      <Trash2 className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>

                  {type === 'status' && (
                    <div className="flex flex-wrap gap-1">
                      {statuses.map(s => {
                        const count = sprintTasks.filter(t => t.status === s.name).length;
                        return (
                          <button key={s.name} onClick={() => toggleFilter('status', s.name)}
                            className={cn("px-2 py-1 text-xs rounded border",
                              (activeFilters.status || []).includes(s.name) ? "border-violet-500 bg-violet-500/20 text-gray-900 dark:text-white" : "border-gray-200 dark:border-[#1f2229] text-gray-500 dark:text-slate-400")}>
                            <span className="w-2 h-2 rounded-full inline-block mr-1" style={{ backgroundColor: s.color }} />
                            {s.name}
                            {count > 0 && <span className="ml-1 text-[10px] opacity-60">({count})</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {type === 'priority' && (
                    <div className="flex flex-wrap gap-1">
                      {priorities.map(p => {
                        const count = sprintTasks.filter(t => t.priority === p.value).length;
                        return (
                          <button key={p.value} onClick={() => toggleFilter('priority', p.value)}
                            className={cn("px-2 py-1 text-xs rounded border flex items-center gap-1",
                              (activeFilters.priority || []).includes(p.value) ? "border-violet-500 bg-violet-500/20 text-gray-900 dark:text-white" : "border-gray-200 dark:border-[#1f2229] text-gray-500 dark:text-slate-400")}>
                            <Flag className="w-3 h-3" style={{ color: p.flagColor }} /> {p.label}
                            {count > 0 && <span className="text-[10px] opacity-60">({count})</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {type === 'assignee' && (
                    <div className="flex flex-wrap gap-1">
                      {uniqueAssignees.map(name => {
                        const count = sprintTasks.filter(t => (t.assignees?.includes(name)) || t.assignee_name === name).length;
                        return (
                          <button key={name} onClick={() => toggleFilter('assignee', name)}
                            className={cn("px-2 py-1 text-xs rounded border",
                              (activeFilters.assignee || []).includes(name) ? "border-violet-500 bg-violet-500/20 text-gray-900 dark:text-white" : "border-gray-200 dark:border-[#1f2229] text-gray-500 dark:text-slate-400")}>
                            {name}
                            {count > 0 && <span className="ml-1 text-[10px] opacity-60">({count})</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {type === 'dueDate' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">From:</span>
                          <input type="date" value={filterStartDate || ''} onChange={e => setFilterStartDate(e.target.value || null)}
                            className="px-2 py-1 text-xs bg-gray-100 dark:bg-[#1a1b24] border border-gray-200 dark:border-[#1f2229] rounded text-gray-900 dark:text-white" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">To:</span>
                          <input type="date" value={filterEndDate || ''} onChange={e => setFilterEndDate(e.target.value || null)}
                            className="px-2 py-1 text-xs bg-gray-100 dark:bg-[#1a1b24] border border-gray-200 dark:border-[#1f2229] rounded text-gray-900 dark:text-white" />
                        </div>
                      </div>
                    </div>
                  )}

                  {type === 'sprint' && (
                    <div className="flex flex-wrap gap-1">
                      {visibleSprints.map(s => {
                        const count = sprintTasks.filter(t => t.sprint_id === s.id).length;
                        return (
                          <button key={s.id} onClick={() => toggleFilter('sprint', s.name)}
                            className={cn("px-2 py-1 text-xs rounded border",
                              (activeFilters.sprint || []).includes(s.name) ? "border-violet-500 bg-violet-500/20 text-gray-900 dark:text-white" : "border-gray-200 dark:border-[#1f2229] text-gray-500 dark:text-slate-400")}>
                            {s.name}
                            {count > 0 && <span className="ml-1 text-[10px] opacity-60">({count})</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {type === 'points' && (() => {
                    const pointValues = [...new Set(sprintTasks.map(t => t.sprint_points != null ? String(t.sprint_points) : 'No Points'))].sort((a, b) => {
                      if (a === 'No Points') return 1;
                      if (b === 'No Points') return -1;
                      return Number(a) - Number(b);
                    });
                    return (
                      <div className="flex flex-wrap gap-1">
                        {pointValues.map(v => {
                          const count = sprintTasks.filter(t => (t.sprint_points != null ? String(t.sprint_points) : 'No Points') === v).length;
                          return (
                            <button key={v} onClick={() => toggleFilter('points', v)}
                              className={cn("px-2 py-1 text-xs rounded border",
                                (activeFilters.points || []).includes(v) ? "border-violet-500 bg-violet-500/20 text-gray-900 dark:text-white" : "border-gray-200 dark:border-[#1f2229] text-gray-500 dark:text-slate-400")}>
                              {v === 'No Points' ? v : `${v} pts`}
                              {count > 0 && <span className="ml-1 text-[10px] opacity-60">({count})</span>}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Custom field filters */}
                  {type.startsWith('cf_') && (() => {
                    const cfId = type.replace('cf_', '');
                    const vals = uniqueCfValues[cfId] || [];
                    return (
                      <div className="flex flex-wrap gap-1">
                        {vals.map(v => {
                          const count = sprintTasks.filter(t => getTaskCfValue(t.id, cfId, visibleCustomFields.find(f => f.id === cfId)?.type || '').includes(v)).length;
                          return (
                            <button key={v} onClick={() => toggleFilter(type, v)}
                              className={cn("px-2 py-1 text-xs rounded border",
                                (activeFilters[type] || []).includes(v) ? "border-violet-500 bg-violet-500/20 text-gray-900 dark:text-white" : "border-gray-200 dark:border-[#1f2229] text-gray-500 dark:text-slate-400")}>
                              {v}
                              {count > 0 && <span className="ml-1 text-[10px] opacity-60">({count})</span>}
                            </button>
                          );
                        })}
                        {vals.length === 0 && <span className="text-xs text-gray-400">No values found</span>}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {/* Column Headers */}
        <DndContext sensors={columnSensors} collisionDetection={closestCenter} onDragEnd={handleColumnDragEnd}>
          <div className="sticky top-0 z-20 bg-white dark:bg-[#14151a] border-b border-gray-200 dark:border-[#1f2229]">
            <div className="flex items-center px-4 py-2">
              <div className="w-6 flex-shrink-0" /> {/* drag handle spacer */}
              <SortableContext items={allColumnIds} strategy={horizontalListSortingStrategy}>
                {allColumnIds.map((id, idx) => (
                  <SortableColumnHeader
                    key={id}
                    id={id}
                    label={getColumnLabel(id)}
                    widthClass={getColumnWidth(id)}
                    isLocked={id === 'name'}
                    openMenuId={openColumnMenuId}
                    setOpenMenuId={setOpenColumnMenuId}
                    onMoveStart={() => moveColumn(id, 'start')}
                    onMoveEnd={() => moveColumn(id, 'end')}
                    onHide={() => toggleColumn(id)}
                    canMoveStart={idx > 1}
                    canMoveEnd={idx < allColumnIds.length - 1}
                  />
                ))}
              </SortableContext>
              {/* Add Column Button — opens sidebar at fields step */}
              <button onClick={() => { setShowViewPanel(true); setViewPanelStep('fields'); setViewPanelSearch(''); }}
                className="w-10 flex items-center justify-center text-gray-400 dark:text-slate-500 hover:text-violet-400">
                <div className="w-6 h-6 rounded-full border border-dashed border-gray-300 dark:border-slate-600 flex items-center justify-center hover:border-violet-400 transition-colors">
                  <Plus className="w-3 h-3" />
                </div>
              </button>
              {/* Task menu spacer */}
              <div className="w-10 flex-shrink-0" />
            </div>
          </div>
        </DndContext>

        {/* Status Inheritance Banner - Sprint */}
        {selectedSingleSprint && (
          <div className={`mx-4 mb-4 px-4 py-2.5 rounded flex items-center justify-between ${
            sprintHasCustomStatuses
              ? 'bg-gray-100 dark:bg-[#1a1b23] border border-gray-200 dark:border-[#2a2b35]'
              : 'bg-gradient-to-r from-violet-600/10 to-teal-600/10 border border-violet-500/20 dark:border-violet-500/30'
          }`}>
            <div className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full ${sprintHasCustomStatuses ? 'bg-violet-400' : 'bg-teal-400 animate-pulse'}`} />
              {sprintHasCustomStatuses ? (
                <span className="text-gray-600 dark:text-slate-300">Custom statuses</span>
              ) : (
                <span className="text-gray-600 dark:text-slate-300">
                  Using statuses from <span className="font-medium text-violet-400">"{selectedSprintSpace?.name || 'Space'}"</span>
                </span>
              )}
            </div>
            {canEdit && (
              <button
                onClick={() => openSprintTaskStatuses(selectedSingleSprint)}
                className={`text-xs font-medium px-3 py-1 rounded transition-colors ${
                  sprintHasCustomStatuses
                    ? 'text-violet-400 hover:bg-violet-500/10'
                    : 'text-teal-400 bg-teal-500/10 hover:bg-teal-500/20'
                }`}
              >
                {sprintHasCustomStatuses ? 'Edit' : 'Edit Statuses'}
              </button>
            )}
          </div>
        )}

        {/* Task Groups */}
        <div className="pb-20">
          {Object.keys(groupedTasks).length === 0 ? (
            <div className="text-center py-20 text-gray-500 dark:text-slate-500">
              <Zap className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No sprint tasks found</p>
              <p className="text-sm mt-1">Add tasks to sprints to see them here</p>
            </div>
          ) : (
            Object.entries(groupedTasks).map(([key, group]) => {
              const isCollapsed = collapsedGroups[key];
              const groupPoints = group.tasks.reduce((s, t) => s + (t.sprint_points || 0), 0);

              return (
                <div key={key} className="border-b border-gray-100 dark:border-[#1a1b20]">
                  {/* Group Header */}
                  {groupBy !== 'none' && (
                    <button
                      onClick={() => setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }))}
                      className="flex items-center gap-2 w-full px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-[#111218] transition-colors"
                    >
                      {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{group.name}</span>
                      <span className="text-xs text-gray-400 dark:text-slate-500">({group.tasks.length})</span>
                      {groupPoints > 0 && (
                        <span className="text-xs text-teal-600 dark:text-teal-400 font-medium ml-1">{groupPoints} pts</span>
                      )}
                    </button>
                  )}

                  {/* Task Rows */}
                  {!isCollapsed && (
                    <DndContext sensors={taskDragSensors} collisionDetection={closestCenter}
                      onDragEnd={(event) => handleTaskDragEnd(event, group.tasks)}>
                      <SortableContext items={group.tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                        {group.tasks.map(task => (
                          <SortableTaskRow key={task.id} task={task}>
                            <div
                              className="flex-1 min-w-0 flex items-center py-2 pr-4 border-b border-gray-50 dark:border-[#111218] hover:bg-gray-50 dark:hover:bg-[#111218] transition-colors cursor-pointer"
                              onClick={() => setSelectedTask(task)}
                            >
                              {allColumnIds.map(colId => (
                                <Fragment key={`${task.id}-${colId}`}>
                                  {renderCell(colId, task)}
                                </Fragment>
                              ))}
                              {/* Task Row Menu */}
                              <div className="w-10 flex-shrink-0 flex items-center justify-center" onClick={e => e.stopPropagation()}>
                                <TaskRowMenu
                                  task={task}
                                  onOpenTask={() => setSelectedTask(task)}
                                  onTaskDeleted={() => queryClient.invalidateQueries({ queryKey: ['tasks'] })}
                                />
                              </div>
                            </div>
                          </SortableTaskRow>
                        ))}
                      </SortableContext>
                    </DndContext>
                  )}

                  {/* Inline Add Task */}
                  {!isCollapsed && canEdit && (
                    inlineAddGroup === key ? (
                      <div className="flex items-center gap-3 px-4 py-2.5 pl-10 bg-gray-50 dark:bg-[#0f1014]">
                        <Plus className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <input type="text" value={inlineTaskName} onChange={e => setInlineTaskName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && inlineTaskName.trim()) handleInlineAddTask(key);
                            if (e.key === 'Escape') { setInlineAddGroup(null); setInlineTaskName(''); }
                          }}
                          placeholder="Task name" autoFocus
                          className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none" />
                        <button onClick={() => { if (inlineTaskName.trim()) handleInlineAddTask(key); }}
                          disabled={!inlineTaskName.trim()}
                          className="px-3 py-1 text-xs font-medium bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed">
                          Save
                        </button>
                        <button onClick={() => { setInlineAddGroup(null); setInlineTaskName(''); }}
                          className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => { setInlineAddGroup(key); setInlineTaskName(''); }}
                        className="flex items-center gap-2 px-4 py-2 pl-10 text-sm text-gray-400 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#0f1014] w-full transition-colors">
                        <Plus className="w-4 h-4" /> Add Task
                      </button>
                    )
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Task Detail Panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          statuses={statuses.map(s => ({ name: s.name, color: s.color, bgColor: s.bgColor }))}
          spaceName={selectedTask.space_id ? spaceMap.get(selectedTask.space_id)?.name : undefined}
          onTaskUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            queryClient.invalidateQueries({ queryKey: ['task-statuses-spaces'] });
            queryClient.invalidateQueries({ queryKey: ['task-statuses-sprints'] });
          }}
          allTasks={filteredTasks}
          onNavigateTask={(task) => setSelectedTask(task)}
        />
      )}

      {/* Customize View Sidebar */}
      {showViewPanel && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[60] bg-black/30" onClick={() => setShowViewPanel(false)} />
          {/* Panel */}
          <div className="fixed right-0 top-0 bottom-0 z-[61] w-[320px] bg-white dark:bg-[#14151a] border-l border-gray-200 dark:border-[#1f2229] shadow-2xl flex flex-col">
            {viewPanelStep === 'customize' ? (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#1f2229]">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">Customize view</span>
                  <button onClick={() => setShowViewPanel(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-[#1f2229] rounded">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                {/* Options */}
                <div className="flex-1 overflow-y-auto py-2">
                  <button onClick={() => setViewPanelStep('fields')}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1a1b24] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                        <Columns className="w-4 h-4 text-blue-400" />
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Fields</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                  <button onClick={() => {
                    setShowViewPanel(false);
                    if (selectedSprintIds.length === 1) {
                      const sprint = sprintMap.get(selectedSprintIds[0]);
                      if (sprint) { openSprintTaskStatuses(sprint); return; }
                    }
                    if (selectedFolderId !== 'all') {
                      const folder = sprintFolderMap.get(selectedFolderId);
                      if (folder) {
                        const space = spaceMap.get(folder.space_id);
                        if (space) { openSpaceTaskStatuses(space); return; }
                      }
                    }
                    if (spaces.length > 0) openSpaceTaskStatuses(spaces[0]);
                  }}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#1a1b24] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center flex-shrink-0">
                        <Circle className="w-4 h-4 text-violet-400" />
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Task Statuses</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-teal-600/20 flex items-center justify-center flex-shrink-0">
                        {showClosedTasks ? <Eye className="w-4 h-4 text-teal-400" /> : <EyeOff className="w-4 h-4 text-teal-400" />}
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Show closed tasks</span>
                    </div>
                    <button onClick={() => setShowClosedTasks(!showClosedTasks)}
                      className={cn("relative w-9 h-5 rounded-full transition-colors", showClosedTasks ? "bg-violet-600" : "bg-gray-300 dark:bg-slate-600")}>
                      <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", showClosedTasks ? "left-[18px]" : "left-0.5")} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Fields step header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-[#1f2229]">
                  <button onClick={() => { setViewPanelStep('customize'); setViewPanelSearch(''); }}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-[#1f2229] rounded">
                    <ChevronLeft className="w-4 h-4 text-gray-400" />
                  </button>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white flex-1">Fields</span>
                  <button onClick={() => setShowViewPanel(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-[#1f2229] rounded">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                {/* Search */}
                <div className="px-4 py-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input type="text" value={viewPanelSearch} onChange={e => setViewPanelSearch(e.target.value)}
                      placeholder="Search fields..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-100 dark:bg-[#1f2229] border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-500" />
                    {viewPanelSearch && (
                      <button onClick={() => setViewPanelSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                        <X className="w-3 h-3 text-gray-400" />
                      </button>
                    )}
                  </div>
                </div>
                {/* Field lists */}
                <div className="flex-1 overflow-y-auto">
                  {/* Shown fields */}
                  {filteredBaseFields.length > 0 && (
                    <div>
                      <div className="px-4 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Shown</div>
                      {filteredBaseFields.map(f => (
                        <div key={f.key} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#1a1b24]">
                          <span className="text-sm text-gray-900 dark:text-white">{f.label}</span>
                          {f.locked ? (
                            <span className="text-[10px] text-gray-400 dark:text-slate-500 uppercase">Locked</span>
                          ) : (
                            <button onClick={() => toggleColumn(f.key)}
                              className={cn("relative w-9 h-5 rounded-full transition-colors", settings.fields[f.key] ? "bg-violet-600" : "bg-gray-300 dark:bg-slate-600")}>
                              <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", settings.fields[f.key] ? "left-[18px]" : "left-0.5")} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Custom fields */}
                  {filteredCustomFieldsForPanel.length > 0 && (
                    <div>
                      <div className="px-4 py-1.5 mt-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Custom Fields</div>
                      {filteredCustomFieldsForPanel.map(f => {
                        const Icon = CUSTOM_FIELD_ICON_MAP[f.type] || FileText;
                        return (
                          <div key={f.id} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#1a1b24]">
                            <div className="flex items-center gap-2">
                              <Icon className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-sm text-gray-900 dark:text-white">{f.name}</span>
                            </div>
                            <button onClick={() => toggleColumn(f.id)}
                              className={cn("relative w-9 h-5 rounded-full transition-colors", settings.custom_fields[f.id] ? "bg-violet-600" : "bg-gray-300 dark:bg-slate-600")}>
                              <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", settings.custom_fields[f.id] ? "left-[18px]" : "left-0.5")} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {/* Add field button */}
                <div className="px-4 py-3 border-t border-gray-200 dark:border-[#1f2229]">
                  <button onClick={() => { setShowViewPanel(false); setShowCustomFieldPanel(true); }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors">
                    <Plus className="w-4 h-4" />
                    Add field
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Custom Field Panel */}
      <CustomFieldPanel
        isOpen={showCustomFieldPanel}
        onClose={() => setShowCustomFieldPanel(false)}
        onBack={() => { setShowCustomFieldPanel(false); setShowViewPanel(true); setViewPanelStep('fields'); }}
        spaceId={(() => {
          if (selectedFolderId !== 'all') {
            const folder = sprintFolderMap.get(selectedFolderId);
            return folder?.space_id || spaces[0]?.id || '';
          }
          return spaces[0]?.id || '';
        })()}
        onFieldCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['custom-fields-all'] });
          queryClient.invalidateQueries({ queryKey: ['custom-field-values-sprint'] });
          setShowCustomFieldPanel(false);
          setShowViewPanel(true);
          setViewPanelStep('fields');
        }}
        statusFieldVisible={settings.fields.status}
        onToggleStatusField={(visible: boolean) => {
          applySettings({ fields: { ...settings.fields, status: visible } });
        }}
      />

      {/* Task Statuses Modal */}
      {showTaskStatusesModal && taskStatusesTarget && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#232430] rounded-xl w-full max-w-[680px] shadow-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={() => setStatusMenuOpenIdx(null)}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#2a2b36]">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit {taskStatusesTarget.name} statuses
              </h2>
              <button onClick={() => { setShowTaskStatusesModal(false); resetStatusModalState(); }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1">
              <div className="flex">
                {/* Left panel */}
                <div className="w-[220px] shrink-0 px-5 py-5 border-r border-gray-200 dark:border-[#2a2b36]">
                  <div className="mb-5">
                    <label className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-3 block">Status type</label>
                    <div className="space-y-2">
                      {taskStatusesInheritedFrom && (
                        <label className="flex items-center gap-2.5 cursor-pointer" onClick={() => { setTaskStatusesUseCustom(false); setTaskStatusesList(taskStatusesParentStatuses); }}>
                          <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0", !taskStatusesUseCustom ? "border-violet-500" : "border-gray-300 dark:border-slate-500")}>
                            {!taskStatusesUseCustom && <div className="w-2 h-2 rounded-full bg-violet-500" />}
                          </div>
                          <span className="text-sm text-gray-700 dark:text-slate-300">Inherit from Space</span>
                        </label>
                      )}
                      <label className="flex items-center gap-2.5 cursor-pointer" onClick={() => { setTaskStatusesUseCustom(true); setTaskStatusesList(taskStatusesCustomStatuses.length > 0 ? taskStatusesCustomStatuses : taskStatusesList); }}>
                        <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0", taskStatusesUseCustom ? "border-violet-500" : "border-gray-300 dark:border-slate-500")}>
                          {taskStatusesUseCustom && <div className="w-2 h-2 rounded-full bg-violet-500" />}
                        </div>
                        <span className="text-sm text-gray-700 dark:text-slate-300">Use custom statuses</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-2 block">Status template</label>
                    <select value={taskStatusesTemplate} onChange={(e) => { applyStatusTemplate(e.target.value); setTaskStatusesUseCustom(true); }}
                      className="w-full bg-white dark:bg-[#1a1b24] border border-gray-200 dark:border-[#2a2b36] rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500">
                      <option value="custom">Custom</option>
                      <option value="simple">Simple</option>
                      <option value="scrum">Scrum</option>
                      <option value="kanban">Kanban</option>
                    </select>
                  </div>
                </div>

                {/* Right panel - Status list */}
                <div className="flex-1 py-4 px-5">
                  {taskStatusesInheritedFrom && !taskStatusesUseCustom && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
                      Open the <button className="text-violet-400 hover:underline" onClick={() => {
                        if (taskStatusesTarget.spaceId) {
                          const space = spaces.find(s => s.id === taskStatusesTarget.spaceId);
                          if (space) { setShowTaskStatusesModal(false); resetStatusModalState(); setTimeout(() => openSpaceTaskStatuses(space), 200); }
                        }
                      }}>Space status manager</button> to make changes to this template.
                    </p>
                  )}

                  {/* Render status sections */}
                  {(['active', 'done', 'closed'] as const).map(section => {
                    const sectionStatuses = taskStatusesList.map((s, idx) => ({ ...s, _origIdx: idx })).filter(s => categorizeStatus(s) === section);
                    const sectionLabel = section === 'active' ? 'Active' : section === 'done' ? 'Done' : 'Closed';
                    const sectionColor = section === 'active' ? '#3b82f6' : section === 'done' ? '#22c55e' : '#6b7280';
                    return (
                      <div key={section} className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-500 dark:text-slate-400">{sectionLabel}</span>
                          {taskStatusesUseCustom && (
                            <button onClick={() => { setStatusAddingToSection(section); setShowTaskStatusesAddForm(true); setTaskStatusesAddColor(sectionColor); }}
                              className="w-5 h-5 rounded-full border border-gray-300 dark:border-slate-500 flex items-center justify-center text-gray-400 hover:border-violet-400 hover:text-violet-400 transition-colors">
                              <Plus className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="space-y-1">
                          {sectionStatuses.map(status => (
                            <div key={status.id || `status-${status._origIdx}`}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-md group hover:bg-gray-50 dark:hover:bg-[#2a2b36] transition-colors">
                              {taskStatusesUseCustom && <GripVertical className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 cursor-grab flex-shrink-0" />}
                              <div className="relative flex-shrink-0">
                                <button onClick={() => taskStatusesUseCustom && setStatusColorPickerIdx(statusColorPickerIdx === status._origIdx ? null : status._origIdx)}
                                  className="w-4 h-4 rounded-full flex-shrink-0 cursor-pointer hover:scale-110 transition-transform" style={{ backgroundColor: status.color }} />
                                {statusColorPickerIdx === status._origIdx && (
                                  <div className="absolute left-0 top-full mt-2 bg-white dark:bg-[#1e1f29] border border-gray-200 dark:border-[#2a2b36] rounded-lg shadow-xl p-3 z-50" onClick={e => e.stopPropagation()}>
                                    <div className="text-[10px] text-gray-500 dark:text-slate-400 mb-2">Color</div>
                                    <div className="grid grid-cols-5 gap-2">
                                      {COLOR_SWATCHES.map(color => (
                                        <button key={color} onClick={() => {
                                          const newList = [...taskStatusesList];
                                          newList[status._origIdx] = { ...taskStatusesList[status._origIdx], color, bgColor: color };
                                          setTaskStatusesList(newList);
                                          setStatusColorPickerIdx(null);
                                        }}
                                          className={cn("w-6 h-6 rounded-full hover:scale-110 transition-transform border-2", status.color === color ? "border-white ring-1 ring-violet-400" : "border-transparent")}
                                          style={{ backgroundColor: color }} />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              {taskStatusesUseCustom ? (
                                <input type="text" value={status.name}
                                  onChange={e => {
                                    const newList = [...taskStatusesList];
                                    newList[status._origIdx] = { ...taskStatusesList[status._origIdx], name: e.target.value.toUpperCase() };
                                    setTaskStatusesList(newList);
                                  }}
                                  ref={statusRenameIdx === status._origIdx ? (el) => el?.focus() : undefined}
                                  className={cn("flex-1 bg-transparent text-gray-900 dark:text-white text-sm font-medium border-0 focus:outline-none focus:ring-0 px-1",
                                    statusRenameIdx === status._origIdx && "ring-1 ring-violet-500 rounded bg-white/5")}
                                  onBlur={() => { if (statusRenameIdx === status._origIdx) setStatusRenameIdx(null); }} />
                              ) : (
                                <span className="flex-1 text-sm text-gray-900 dark:text-slate-300 font-medium px-1">{status.name}</span>
                              )}
                              {taskStatusesUseCustom && (
                                <div className="relative flex-shrink-0">
                                  <button onClick={e => { e.stopPropagation(); setStatusMenuOpenIdx(statusMenuOpenIdx === status._origIdx ? null : status._origIdx); }}
                                    className="p-1 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all">
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                  </button>
                                  {statusMenuOpenIdx === status._origIdx && (
                                    <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-[#1e1f29] border border-gray-200 dark:border-[#2a2b36] rounded-lg shadow-xl z-50 py-1">
                                      <button onClick={() => { setStatusRenameIdx(status._origIdx); setStatusMenuOpenIdx(null); }}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#2a2b36]">
                                        <Edit2 className="w-3 h-3" /> Rename
                                      </button>
                                      <button onClick={() => { handleRemoveTaskStatus(status._origIdx); setStatusMenuOpenIdx(null); }}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-gray-100 dark:hover:bg-[#2a2b36]">
                                        <Trash2 className="w-3 h-3" /> Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                          {sectionStatuses.length === 0 && !showTaskStatusesAddForm && taskStatusesUseCustom && (
                            <button onClick={() => { setStatusAddingToSection(section); setShowTaskStatusesAddForm(true); setTaskStatusesAddColor(sectionColor); }}
                              className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-400 dark:text-slate-500 hover:text-violet-400 transition-colors cursor-pointer">
                              <Plus className="w-3 h-3" /> Add status
                            </button>
                          )}
                          {/* Inline Add Status */}
                          {taskStatusesUseCustom && showTaskStatusesAddForm && statusAddingToSection === section && (
                            <div className="flex items-center gap-2 px-2 py-1.5">
                              <div className="relative flex-shrink-0">
                                <button onClick={() => setStatusColorPickerIdx(statusColorPickerIdx === -1 ? null : -1)}
                                  className="w-4 h-4 rounded-full cursor-pointer hover:scale-110 transition-transform" style={{ backgroundColor: taskStatusesAddColor }} />
                                {statusColorPickerIdx === -1 && (
                                  <div className="absolute left-0 top-full mt-2 bg-white dark:bg-[#1e1f29] border border-gray-200 dark:border-[#2a2b36] rounded-lg shadow-xl p-3 z-50" onClick={e => e.stopPropagation()}>
                                    <div className="text-[10px] text-gray-500 dark:text-slate-400 mb-2">Color</div>
                                    <div className="grid grid-cols-5 gap-2">
                                      {COLOR_SWATCHES.map(color => (
                                        <button key={color} onClick={() => { setTaskStatusesAddColor(color); setStatusColorPickerIdx(null); }}
                                          className={cn("w-6 h-6 rounded-full hover:scale-110 transition-transform border-2", taskStatusesAddColor === color ? "border-white ring-1 ring-violet-400" : "border-transparent")}
                                          style={{ backgroundColor: color }} />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <input type="text" value={taskStatusesAddName} onChange={e => setTaskStatusesAddName(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && taskStatusesAddName.trim()) handleAddTaskStatus();
                                  if (e.key === 'Escape') { setShowTaskStatusesAddForm(false); setTaskStatusesAddName(''); }
                                }}
                                placeholder="Add status"
                                className="flex-1 bg-transparent text-gray-900 dark:text-white text-sm font-medium border border-gray-200 dark:border-[#2a2b36] rounded px-2 py-1 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                autoFocus />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-200 dark:border-[#2a2b36] bg-gray-50 dark:bg-[#1a1b24]">
              <span className="text-xs text-gray-400 dark:text-slate-500">
                {taskStatusesTarget.type === 'sprint' ? 'Sprint' : 'Space'}: {taskStatusesTarget.name}
              </span>
              <div className="flex items-center gap-3">
                <button onClick={() => { setShowTaskStatusesModal(false); resetStatusModalState(); }}
                  className="px-4 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#2e2f3a] rounded-lg transition-colors">
                  Cancel
                </button>
                <button onClick={handleApplyTaskStatuses}
                  className="px-5 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium transition-colors">
                  Apply changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
