import { useState, useMemo, useEffect, useRef, useCallback, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, ChevronRight, ChevronDown, Folder as FolderIcon,
  Trash2, Edit2, X, User, Calendar,
  MoreHorizontal, UserPlus, Search, Filter,
  SlidersHorizontal,
  LayoutGrid, Columns, CalendarDays, Users, GanttChart,
  Circle, CheckCircle2, Flag, GitBranch,
  ListFilter, XCircle, Tag, Archive, MessageSquare,
  UserCircle, CalendarCheck, CalendarPlus, Info,
  List as ListIcon, CheckSquare, ClipboardList, UserX, Clock, Check,
  Lock, Shield, Eye, HelpCircle, AlertCircle, GripVertical, ChevronLeft, Zap, RotateCcw, FileText, FileInput, Link, Copy, Calculator, Sparkles, Bookmark
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { spacesApi, foldersApi, tasksApi, membersApi, spaceMembersApi, taskListsApi, customFieldsApi, sprintFoldersApi, sprintsApi, docsApi, formsApi, taskStatusesApi, type Member, type SpaceMember, type TaskList, type CustomField, type CustomFieldValue, type TaskStatus as ApiTaskStatus } from '../services/api';
import type { Space, Folder, Task, TaskStatus, TaskPriority, UpdateTaskInput, SprintFolder, Sprint, Doc, Form } from '../types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '../context/AuthContext';
// InviteMemberDialog moved to Team page only
import TaskDetailPanel from '../components/TaskDetailPanel';
import TaskRowMenu from '../components/TaskRowMenu';
import CustomFieldPanel from '../components/CustomFieldPanel';
import { SprintFolderCreateModal, SprintCreateModal } from '../components/SprintCreateModal';
import DocEditor from '../components/DocEditor';
import FormBuilder from '../components/FormBuilder';
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
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

// Secondary sidebar width constants
const MIN_SECONDARY_SIDEBAR_WIDTH = 180;
const MAX_SECONDARY_SIDEBAR_WIDTH = 400;
const DEFAULT_SECONDARY_SIDEBAR_WIDTH = 220;

// Group by options
const BASE_GROUP_BY_OPTIONS = [
  { value: 'status', label: 'Status', icon: Circle },
  { value: 'folder', label: 'Folder', icon: FolderIcon },
  { value: 'assignee', label: 'Assignee', icon: User },
  { value: 'priority', label: 'Priority', icon: Flag },
  { value: 'dueDate', label: 'Due date', icon: Calendar },
  { value: 'none', label: 'None', icon: ListFilter },
];

const spaceColors = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'
];

// Status type definition
interface StatusConfig {
  name: string;
  color: string;
  bgColor: string;
  id?: string;
  status_group?: 'active' | 'done' | 'closed';
  position?: number;
}

// Default statuses (empty - users create their own)
const initialStatuses: StatusConfig[] = [];

// Available colors for custom statuses
const statusColors = [
  '#6b7280', '#3b82f6', '#8b5cf6', '#22c55e', '#ef4444',
  '#f97316', '#eab308', '#14b8a6', '#ec4899', '#06b6d4'
];

// Preset color swatches for the color picker
const COLOR_SWATCHES = [
  '#6b7280', '#3b82f6', '#8b5cf6', '#22c55e', '#ef4444',
  '#f97316', '#eab308', '#14b8a6', '#ec4899', '#06b6d4',
  '#a855f7', '#10b981', '#f43f5e', '#0ea5e9', '#84cc16',
  '#d946ef', '#6366f1', '#facc15', '#fb923c', '#64748b'
];

// Categorize a status by name heuristic
function categorizeStatus(status: StatusConfig): 'active' | 'done' | 'closed' {
  if (status.status_group) return status.status_group;
  const name = status.name.toUpperCase();
  if (/\b(DONE|COMPLETE|COMPLETED|FINISHED|RESOLVED)\b/.test(name)) return 'done';
  if (/\b(CLOSED|CANCELLED|CANCELED|ARCHIVED|REJECTED)\b/.test(name)) return 'closed';
  return 'active';
}

// ClickUp-style priority colors
const priorities: { value: TaskPriority; label: string; color: string; flagColor: string }[] = [
  { value: 'LOW', label: 'Low', color: '#9ca3af', flagColor: '#9ca3af' },
  { value: 'MEDIUM', label: 'Normal', color: '#9ca3af', flagColor: '#9ca3af' },
  { value: 'HIGH', label: 'High', color: '#f97316', flagColor: '#f97316' },
  { value: 'URGENT', label: 'Urgent', color: '#ef4444', flagColor: '#ef4444' }
];

const viewTabs = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'list', label: 'List', icon: ListIcon },
  { id: 'board', label: 'Board', icon: Columns },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'gantt', label: 'Gantt', icon: GanttChart },
];

// Base filter dropdown options
const BASE_FILTER_OPTIONS = [
  { id: 'status', label: 'Status', icon: Circle },
  { id: 'tags', label: 'Tags', icon: Tag },
  { id: 'dueDate', label: 'Due date', icon: Calendar },
  { id: 'priority', label: 'Priority', icon: Flag },
  { id: 'assignee', label: 'Assignee', icon: User },
  { id: 'archived', label: 'Archived', icon: Archive },
  { id: 'assignedComment', label: 'Assigned comment', icon: MessageSquare },
  { id: 'createdBy', label: 'Created by', icon: UserCircle },
  { id: 'dateClosed', label: 'Date closed', icon: CalendarCheck },
  { id: 'dateCreated', label: 'Date created', icon: CalendarPlus },
];

// Icon mapping for custom field types (using already-imported icons)
const CUSTOM_FIELD_ICON_MAP: Record<string, typeof Circle> = {
  dropdown: ListIcon,
  text: FileText,
  textarea: FileText,
  number: Calculator,
  date: Calendar,
  checkbox: CheckSquare,
  labels: Tag,
  people: User,
  email: FileText,
  phone: FileText,
  website: Link,
  url: Link,
  money: Calculator,
  rating: Sparkles,
  voting: Check,
  files: FileText,
  location: FileText,
};

type ListViewSettings = {
  fields: {
    name: boolean;
    assignee: boolean;
    due_date: boolean;
    priority: boolean;
    status: boolean;
  };
  custom_fields: Record<string, boolean>;
  custom_fields_order?: string[];
  base_fields_order?: string[];
  unified_column_order?: string[]; // Unified order mixing base and custom fields
  show_empty_statuses: boolean;
};

type BaseFieldKey = 'name' | 'assignee' | 'due_date' | 'priority' | 'status';

const DEFAULT_LIST_VIEW_SETTINGS: ListViewSettings = {
  fields: {
    name: true,
    assignee: true,
    due_date: true,
    priority: true,
    status: false
  },
  custom_fields: {},
  custom_fields_order: [],
  base_fields_order: ['name', 'assignee', 'due_date', 'priority'],
  show_empty_statuses: false
};

const DEFAULT_FILTERS: {
  status: string[];
  priority: string[];
  assignee: string[];
  dueDate: string[];
  tags: string[];
  customFields: Record<string, string[]>;
} = {
  status: [],
  priority: [],
  assignee: [],
  dueDate: [],
  tags: [],
  customFields: {},
};

// SortableBaseColumnHeader component for drag-and-drop base column reordering
interface SortableBaseColumnHeaderProps {
  slotKey: BaseFieldKey;
  index: number;
  total: number;
  label: string;
  widthClass: string;
  openColumnMenuId: string | null;
  setOpenColumnMenuId: (id: string | null) => void;
  moveBaseField: (fieldKey: BaseFieldKey, position: 'start' | 'end') => void;
  toggleBaseColumnVisibility: (slotKey: BaseFieldKey) => void;
  groupBy: string;
  effectiveListViewSettings: ListViewSettings;
  groupKey?: string;
}

function SortableBaseColumnHeader({
  slotKey,
  index,
  total,
  label,
  widthClass,
  openColumnMenuId,
  setOpenColumnMenuId,
  moveBaseField,
  toggleBaseColumnVisibility,
  groupKey,
}: SortableBaseColumnHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slotKey });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isName = slotKey === 'name';
  const menuId = groupKey ? `base:${slotKey}:${groupKey}` : `base:${slotKey}`;
  const isMenuOpen = openColumnMenuId === menuId;
  const canMoveStart = slotKey !== 'name' && index > 1;
  const canMoveEnd = slotKey !== 'name' && index < total - 1;

  return (
    <div
      ref={setNodeRef}
      style={style}
      key={slotKey}
      className={`${widthClass} relative group`}
    >
      <div
        {...(isName ? {} : { ...attributes, ...listeners })}
        className={slotKey === 'name' ? "flex items-center gap-1" : "flex items-center justify-center gap-0.5 cursor-grab active:cursor-grabbing"}
      >
        <span>{label}</span>
        {!isName && (
          <button
            data-column-menu-trigger
            onClick={(e) => {
              e.stopPropagation();
              setOpenColumnMenuId(isMenuOpen ? null : menuId);
            }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-400 dark:text-slate-500"
          >
            <MoreHorizontal className="w-3 h-3" />
          </button>
        )}
      </div>

      {isMenuOpen && (
        <div
          data-column-menu
          className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 py-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { moveBaseField(slotKey, 'start'); setOpenColumnMenuId(null); }}
            disabled={!canMoveStart}
            className={cn(
              "w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-700",
              !canMoveStart && "opacity-50 cursor-not-allowed"
            )}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Move to start
          </button>
          <button
            onClick={() => { moveBaseField(slotKey, 'end'); setOpenColumnMenuId(null); }}
            disabled={!canMoveEnd}
            className={cn(
              "w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-700",
              !canMoveEnd && "opacity-50 cursor-not-allowed"
            )}
          >
            <ChevronRight className="w-3.5 h-3.5" />
            Move to end
          </button>
          <button
            onClick={() => { toggleBaseColumnVisibility(slotKey); setOpenColumnMenuId(null); }}
            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            <Eye className="w-3.5 h-3.5" />
            Hide column
          </button>
        </div>
      )}
    </div>
  );
}

// SortableColumnHeader component for drag-and-drop column reordering
interface SortableColumnHeaderProps {
  field: CustomField;
  idx: number;
  totalFields: number;
  openColumnMenuId: string | null;
  setOpenColumnMenuId: (id: string | null) => void;
  moveCustomField: (fieldId: string, direction: 'left' | 'right' | 'start' | 'end') => void;
  applyListViewSettings: (updates: Partial<ListViewSettings>) => void;
  deleteCustomFieldMutation: any;
  groupKey?: string;
}

function SortableColumnHeader({
  field,
  idx,
  totalFields,
  openColumnMenuId,
  setOpenColumnMenuId,
  moveCustomField,
  applyListViewSettings,
  deleteCustomFieldMutation,
  groupKey,
}: SortableColumnHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="w-28 text-center relative group"
    >
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-center gap-0.5 cursor-grab active:cursor-grabbing"
      >
        <span className="truncate">{field.name}</span>
        <button
          data-column-menu-trigger
          onClick={(e) => {
            e.stopPropagation();
            const menuId = groupKey ? `${field.id}:${groupKey}` : field.id;
            setOpenColumnMenuId(openColumnMenuId === menuId ? null : menuId);
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-400 dark:text-slate-500"
        >
          <MoreHorizontal className="w-3 h-3" />
        </button>
      </div>
      {openColumnMenuId === (groupKey ? `${field.id}:${groupKey}` : field.id) && (
        <div
          data-column-menu
          className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              moveCustomField(field.id, 'start');
              setOpenColumnMenuId(null);
            }}
            disabled={idx === 0}
            className={cn(
              "w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-700",
              idx === 0 && "opacity-50 cursor-not-allowed"
            )}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Move to start
          </button>
          <button
            onClick={() => {
              moveCustomField(field.id, 'end');
              setOpenColumnMenuId(null);
            }}
            disabled={idx === totalFields - 1}
            className={cn(
              "w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-700",
              idx === totalFields - 1 && "opacity-50 cursor-not-allowed"
            )}
          >
            <ChevronRight className="w-3.5 h-3.5" />
            Move to end
          </button>
          <button
            onClick={() => {
              applyListViewSettings({ custom_fields: { [field.id]: false } });
              setOpenColumnMenuId(null);
            }}
            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            <Eye className="w-3.5 h-3.5" />
            Hide column
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete field "${field.name}"?`)) {
                deleteCustomFieldMutation.mutate(field.id);
                setOpenColumnMenuId(null);
              }
            }}
            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete field
          </button>
        </div>
      )}
    </div>
  );
}

// SortableTaskRow component for drag-and-drop task row reordering
function SortableTaskRow({ task, children }: { task: Task; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto' as any,
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="flex items-center group">
        <div
          {...listeners}
          className="flex items-center justify-center w-6 h-full cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function Workspace() {
  const queryClient = useQueryClient();
  const { member, needsSpaceAccess, isOwner, canEdit: globalCanEdit, canEditInSpace } = useAuth();

  // Drag-and-drop sensors for column reordering
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // Task row drag-and-drop sensors (separate to avoid conflict with column DnD)
  const taskDragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // Drag-and-drop state for column reordering
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);

  // Drag-and-drop state for task row reordering
  const [activeDragTask, setActiveDragTask] = useState<Task | null>(null);

  // Core state
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [selectedList, setSelectedList] = useState<TaskList | null>(null);

  // Space-aware edit permission: guests can edit if they have edit/full_edit in this space
  const canEdit = canEditInSpace(selectedSpace?.id);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [showSpaceOverview, setShowSpaceOverview] = useState(false);
  const [showViewPanel, setShowViewPanel] = useState(false);
  const [viewPanelStep, setViewPanelStep] = useState<'customize' | 'fields'>('customize');

  // Sprint state
  const [selectedSprint, setSelectedSprint] = useState<Sprint | null>(null);
  const [selectedSprintFolder, setSelectedSprintFolder] = useState<SprintFolder | null>(null);
  const [expandedSprintFolders, setExpandedSprintFolders] = useState<Record<string, boolean>>({});
  const [showSprintFolderModal, setShowSprintFolderModal] = useState(false);
  const [showSprintCreateModal, setShowSprintCreateModal] = useState(false);
  const [sprintCreateFolderId, setSprintCreateFolderId] = useState<string | null>(null);
  const [sprintFolderPlusDropdown, setSprintFolderPlusDropdown] = useState<string | null>(null);
  const [folderPlusDropdown, setFolderPlusDropdown] = useState<string | null>(null);
  const [listMenuDropdown, setListMenuDropdown] = useState<string | null>(null);
  const [docMenuDropdown, setDocMenuDropdown] = useState<string | null>(null);
  const [formMenuDropdown, setFormMenuDropdown] = useState<string | null>(null);
  const [renamingDocId, setRenamingDocId] = useState<string | null>(null);
  const [renamingFormId, setRenamingFormId] = useState<string | null>(null);
  const [renameDocValue, setRenameDocValue] = useState('');
  const [renameFormValue, setRenameFormValue] = useState('');
  const [sprintCreateForFolder, setSprintCreateForFolder] = useState<string | null>(null);

  // Secondary sidebar resize state
  const [secondarySidebarWidth, setSecondarySidebarWidth] = useState(() => {
    const saved = localStorage.getItem('secondarySidebarWidth');
    return saved ? parseInt(saved, 10) : DEFAULT_SECONDARY_SIDEBAR_WIDTH;
  });
  const [isResizingSecondary, setIsResizingSecondary] = useState(false);
  const [isSecondaryCollapsed, setIsSecondaryCollapsed] = useState(() => {
    const saved = localStorage.getItem('secondarySidebarCollapsed');
    return saved === 'true';
  });
  const secondarySidebarRef = useRef<HTMLElement>(null);

  // Create dropdown state
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);

  // Doc modal state
  const [showDocModal, setShowDocModal] = useState(false);
  const [docName, setDocName] = useState('');
  const [docTargetFolder, setDocTargetFolder] = useState<string | null>(null);
  const [editingDoc, setEditingDoc] = useState<Doc | null>(null);

  // Form modal state
  const [showFormModal, setShowFormModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTargetFolder, setFormTargetFolder] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<Form | null>(null);
  const [overviewDocMenuOpen, setOverviewDocMenuOpen] = useState(false);
  const [openDocAfterCreate, setOpenDocAfterCreate] = useState(true);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [bookmarkQuery, setBookmarkQuery] = useState('');
  const [bookmarks, setBookmarks] = useState<{ id: string; title: string; url: string }[]>([]);

  // Task Statuses Modal state (for space/folder/list/sprint level - STRICT ISOLATION)
  const [showTaskStatusesModal, setShowTaskStatusesModal] = useState(false);
  const [taskStatusesTarget, setTaskStatusesTarget] = useState<{
    type: 'space' | 'folder' | 'list' | 'sprint';
    id: string;
    name: string;
    spaceId?: string;
    spaceName?: string;
    folderId?: string;
    folderName?: string;
  } | null>(null);
  const [taskStatusesInheritedFrom, setTaskStatusesInheritedFrom] = useState<{ type: 'space' | 'folder'; name: string } | null>(null);
  const [taskStatusesUseCustom, setTaskStatusesUseCustom] = useState(false);
  const [taskStatusesList, setTaskStatusesList] = useState<StatusConfig[]>([]);
  const [taskStatusesParentStatuses, setTaskStatusesParentStatuses] = useState<StatusConfig[]>([]); // Store parent statuses for inheritance
  const [taskStatusesCustomStatuses, setTaskStatusesCustomStatuses] = useState<StatusConfig[]>([]); // Store custom statuses
  const [taskStatusesTemplate, setTaskStatusesTemplate] = useState<string>('custom');
  const [taskStatusesAddName, setTaskStatusesAddName] = useState('');
  const [taskStatusesAddColor, setTaskStatusesAddColor] = useState('#3b82f6');
  const [taskStatusesAddGroup, setTaskStatusesAddGroup] = useState<'active' | 'done' | 'closed'>('active');
  const [showTaskStatusesAddForm, setShowTaskStatusesAddForm] = useState(false);
  const [statusSectionCollapsed, setStatusSectionCollapsed] = useState<Record<string, boolean>>({ active: false, done: false, closed: false });
  const [statusAddingToSection, setStatusAddingToSection] = useState<'active' | 'done' | 'closed'>('active');
  const [statusColorPickerIdx, setStatusColorPickerIdx] = useState<number | null>(null);
  const [statusMenuOpenIdx, setStatusMenuOpenIdx] = useState<number | null>(null);
  const [statusRenameIdx, setStatusRenameIdx] = useState<number | null>(null);
  const [taskStatusesOriginalNames, setTaskStatusesOriginalNames] = useState<string[]>([]);

  // List modal state
  const [showListModal, setShowListModal] = useState(false);
  const [listName, setListName] = useState('');
  const [listDescription, setListDescription] = useState('');
  const [listColor, setListColor] = useState('#6366f1');
  const [editingList, setEditingList] = useState<TaskList | null>(null);
  const [listTargetFolder, setListTargetFolder] = useState<string | null>(null);

  // View state
  const [activeView, setActiveView] = useState<string>('list');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Group, Sort, Filter state
  const [groupBy, setGroupBy] = useState<string>('status');
  const [sortBy, setSortBy] = useState<BaseFieldKey | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showGroupByDropdown, setShowGroupByDropdown] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showClosedTasks, setShowClosedTasks] = useState(true);
  const [showEverything, setShowEverything] = useState(false);

  // Active filters
  const [activeFilters, setActiveFilters] = useState<{
    status: string[];
    priority: string[];
    assignee: string[];
    dueDate: string[];
    tags: string[];
    customFields: Record<string, string[]>;
  }>(DEFAULT_FILTERS);

  // Filter dropdown state
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedFilterType, setSelectedFilterType] = useState<string | null>(null);
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const [appliedFilterTypes, setAppliedFilterTypes] = useState<string[]>([]);

  // Date filter state (for calendar picker)
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const filterScopeKey = useMemo(() => {
    if (selectedSprint?.id) return `sprint:${selectedSprint.id}`;
    if (selectedList?.id) return `list:${selectedList.id}`;
    if (selectedFolder?.id) return `folder:${selectedFolder.id}`;
    if (selectedSpace?.id) return `space:${selectedSpace.id}`;
    return null;
  }, [selectedSprint?.id, selectedList?.id, selectedFolder?.id, selectedSpace?.id]);

  const filterScopeLoadedRef = useRef<string | null>(null);

  // Load per-scope filters and groupBy
  useEffect(() => {
    if (!filterScopeKey) return;
    const raw = localStorage.getItem(`view-filters-${filterScopeKey}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setGroupBy(parsed.groupBy || 'status');
        const loadedFilters = parsed.activeFilters || DEFAULT_FILTERS;
        setActiveFilters({ ...DEFAULT_FILTERS, ...loadedFilters, customFields: loadedFilters.customFields || {} });
        setAppliedFilterTypes(parsed.appliedFilterTypes || []);
        setFilterStartDate(parsed.filterStartDate || '');
        setFilterEndDate(parsed.filterEndDate || '');
      } catch {
        setGroupBy('status');
        setActiveFilters(DEFAULT_FILTERS);
        setAppliedFilterTypes([]);
        setFilterStartDate('');
        setFilterEndDate('');
      }
    } else {
      setGroupBy('status');
      setActiveFilters(DEFAULT_FILTERS);
      setAppliedFilterTypes([]);
      setFilterStartDate('');
      setFilterEndDate('');
    }
    filterScopeLoadedRef.current = filterScopeKey;
  }, [filterScopeKey]);

  // Persist per-scope filters and groupBy
  useEffect(() => {
    if (!filterScopeKey) return;
    if (filterScopeLoadedRef.current !== filterScopeKey) return;
    const payload = {
      groupBy,
      activeFilters,
      appliedFilterTypes,
      filterStartDate,
      filterEndDate
    };
    localStorage.setItem(`view-filters-${filterScopeKey}`, JSON.stringify(payload));
  }, [filterScopeKey, groupBy, activeFilters, appliedFilterTypes, filterStartDate, filterEndDate]);

  // Inline add task state
  const [inlineAddGroup, setInlineAddGroup] = useState<string | null>(null);
  const [inlineTaskName, setInlineTaskName] = useState('');

  // Custom statuses state - stored per space
  const [spaceStatuses, setSpaceStatuses] = useState<Record<string, StatusConfig[]>>(() => {
    const saved = localStorage.getItem('spaceStatuses');
    return saved ? JSON.parse(saved) : {};
  });
  const [showAddStatusModal, setShowAddStatusModal] = useState(false);
  const [newStatusName, setNewStatusName] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#3b82f6');

  // Status editing state
  const [editingStatus, setEditingStatus] = useState<StatusConfig | null>(null);
  const [showEditStatusModal, setShowEditStatusModal] = useState(false);
  const [editStatusName, setEditStatusName] = useState('');
  const [editStatusColor, setEditStatusColor] = useState('#3b82f6');
  const [openStatusMenuId, setOpenStatusMenuId] = useState<string | null>(null);

  // Save space statuses to localStorage whenever they change (for backwards compatibility)
  useEffect(() => {
    localStorage.setItem('spaceStatuses', JSON.stringify(spaceStatuses));
  }, [spaceStatuses]);

  // Save secondary sidebar width to localStorage
  useEffect(() => {
    if (!isSecondaryCollapsed) {
      localStorage.setItem('secondarySidebarWidth', secondarySidebarWidth.toString());
    }
  }, [secondarySidebarWidth, isSecondaryCollapsed]);

  // Save secondary sidebar collapsed state
  useEffect(() => {
    localStorage.setItem('secondarySidebarCollapsed', isSecondaryCollapsed.toString());
  }, [isSecondaryCollapsed]);

  // Handle mouse move during secondary sidebar resize
  const handleSecondaryMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingSecondary || !secondarySidebarRef.current) return;

    const sidebarRect = secondarySidebarRef.current.getBoundingClientRect();
    const newWidth = e.clientX - sidebarRect.left;

    if (newWidth >= MIN_SECONDARY_SIDEBAR_WIDTH && newWidth <= MAX_SECONDARY_SIDEBAR_WIDTH) {
      setSecondarySidebarWidth(newWidth);
      // Don't auto-collapse on resize - keep header always visible
      if (isSecondaryCollapsed) {
        setIsSecondaryCollapsed(false);
      }
    }
  }, [isResizingSecondary, isSecondaryCollapsed]);

  // Handle mouse up to stop secondary sidebar resize
  const handleSecondaryMouseUp = useCallback(() => {
    setIsResizingSecondary(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Add/remove event listeners for secondary sidebar resize
  useEffect(() => {
    if (isResizingSecondary) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleSecondaryMouseMove);
      document.addEventListener('mouseup', handleSecondaryMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleSecondaryMouseMove);
      document.removeEventListener('mouseup', handleSecondaryMouseUp);
    };
  }, [isResizingSecondary, handleSecondaryMouseMove, handleSecondaryMouseUp]);

  const startSecondaryResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSecondary(true);
  };

  const toggleSecondaryCollapse = () => {
    setIsSecondaryCollapsed(!isSecondaryCollapsed);
    if (isSecondaryCollapsed) {
      setSecondarySidebarWidth(DEFAULT_SECONDARY_SIDEBAR_WIDTH);
    }
  };

  const currentSecondaryWidth = isSecondaryCollapsed ? MIN_SECONDARY_SIDEBAR_WIDTH : secondarySidebarWidth;

  // Close status menu on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openStatusMenuId) {
        setOpenStatusMenuId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openStatusMenuId]);

  // Modal states
  const [showSpaceModal, setShowSpaceModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingSpace, setEditingSpace] = useState<Space | null>(null);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showCustomFieldPanel, setShowCustomFieldPanel] = useState(false);
  const [editingFieldCell, setEditingFieldCell] = useState<{ taskId: string; fieldId: string; field: CustomField } | null>(null);
  const [editingFieldValue, setEditingFieldValue] = useState<any>(null);

  // Task Detail Panel state
  const [selectedTaskForPanel, setSelectedTaskForPanel] = useState<Task | null>(null);
  const [showTaskPanel, setShowTaskPanel] = useState(false);

  // Form states
  const [spaceName, setSpaceName] = useState('');
  const [spaceDescription, setSpaceDescription] = useState('');
  const [spaceColor, setSpaceColor] = useState('#6366f1');
  const [folderName, setFolderName] = useState('');

  // Space member selection state
  const [selectedSpaceMembers, setSelectedSpaceMembers] = useState<{ member_id: string; permission: string }[]>([]);
  const [showMemberSelector, setShowMemberSelector] = useState(false);
  const [spaceDefaultPermission, setSpaceDefaultPermission] = useState<string>('full_edit');
  const [showPermissionDropdown, setShowPermissionDropdown] = useState(false);
  const [spaceIsPrivate, setSpaceIsPrivate] = useState(false);
  const [spaceIcon, setSpaceIcon] = useState('S');

  // Space Members Management state
  const [showSpaceMembersModal, setShowSpaceMembersModal] = useState(false);
  const [editingMemberPermission, setEditingMemberPermission] = useState<string | null>(null);
  const [showAddGuestDropdown, setShowAddGuestDropdown] = useState(false);
  const [addGuestPermission, setAddGuestPermission] = useState<string>('view_only');
  const [addGuestSearchQuery, setAddGuestSearchQuery] = useState('');

  // Task form states
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('To Do');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('MEDIUM');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskFolderId, setTaskFolderId] = useState<string>('');
  const [taskListId, setTaskListId] = useState<string>('');

  // Priority dropdown state for task list
  const [openPriorityDropdownId, setOpenPriorityDropdownId] = useState<string | null>(null);

  // Status dropdown state for task list
  const [openStatusDropdownId, setOpenStatusDropdownId] = useState<string | null>(null);
  const [inlineStatusInput, setInlineStatusInput] = useState('');
  const [statusDropdownSearch, setStatusDropdownSearch] = useState('');
  const [statusDropdownTab, setStatusDropdownTab] = useState<'all' | 'active' | 'done' | 'closed'>('all');
  const [statusDropdownMenuOpen, setStatusDropdownMenuOpen] = useState(false);
  const [inlineStatusTaskId, setInlineStatusTaskId] = useState<string | null>(null);

  // Inline Date picker state
  const [openDatePickerId, setOpenDatePickerId] = useState<string | null>(null);
  const [datePickerMonth, setDatePickerMonth] = useState(new Date());

  // Inline Assignee picker state
  const [openAssigneePickerId, setOpenAssigneePickerId] = useState<string | null>(null);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState('');
  const [openColumnMenuId, setOpenColumnMenuId] = useState<string | null>(null);

  // Inline empty-list add task state
  const [inlineEmptyTaskName, setInlineEmptyTaskName] = useState('');
  const [inlineEmptyAssignees, setInlineEmptyAssignees] = useState<string[]>([]);
  const [inlineEmptyDueDate, setInlineEmptyDueDate] = useState<string>('');
  const [inlineEmptyPriority, setInlineEmptyPriority] = useState<TaskPriority>('MEDIUM');
  const [inlineEmptyAssigneeOpen, setInlineEmptyAssigneeOpen] = useState(false);
  const [inlineEmptyDateOpen, setInlineEmptyDateOpen] = useState(false);
  const [inlineEmptyPriorityOpen, setInlineEmptyPriorityOpen] = useState(false);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (openPriorityDropdownId && !target.closest('[data-priority-dropdown]')) {
        setOpenPriorityDropdownId(null);
      }
      if (openStatusDropdownId && !target.closest('[data-status-dropdown]')) {
        setOpenStatusDropdownId(null);
        setInlineStatusInput('');
        setInlineStatusTaskId(null);
        setStatusDropdownSearch('');
        setStatusDropdownTab('all');
        setStatusDropdownMenuOpen(false);
      }
      if (openDatePickerId && !target.closest('[data-date-picker]')) {
        setOpenDatePickerId(null);
      }
      if (openAssigneePickerId && !target.closest('[data-assignee-picker]')) {
        setOpenAssigneePickerId(null);
        setAssigneeSearchQuery('');
      }
      if (inlineEmptyAssigneeOpen && !target.closest('[data-inline-empty-assignee]')) {
        setInlineEmptyAssigneeOpen(false);
        setAssigneeSearchQuery('');
      }
      if (inlineEmptyDateOpen && !target.closest('[data-inline-empty-date]')) {
        setInlineEmptyDateOpen(false);
      }
      if (inlineEmptyPriorityOpen && !target.closest('[data-inline-empty-priority]')) {
        setInlineEmptyPriorityOpen(false);
      }
      if (openColumnMenuId && !target.closest('[data-column-menu]') && !target.closest('[data-column-menu-trigger]')) {
        setOpenColumnMenuId(null);
      }
      if (overviewDocMenuOpen && !target.closest('[data-overview-doc-menu]')) {
        setOverviewDocMenuOpen(false);
      }
      if (sprintFolderPlusDropdown && !target.closest('[data-sprint-folder-plus]')) {
        setSprintFolderPlusDropdown(null);
      }
      if (folderPlusDropdown && !target.closest('[data-folder-plus]')) {
        setFolderPlusDropdown(null);
      }
      if (listMenuDropdown && !target.closest('[data-list-menu]')) {
        setListMenuDropdown(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openPriorityDropdownId, openStatusDropdownId, openDatePickerId, openAssigneePickerId, openColumnMenuId, inlineEmptyAssigneeOpen, inlineEmptyDateOpen, inlineEmptyPriorityOpen, sprintFolderPlusDropdown, folderPlusDropdown]);

  // Queries
  const { data: spaces = [] } = useQuery({
    queryKey: ['spaces'],
    queryFn: spacesApi.getAll
  });

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: foldersApi.getAll
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: tasksApi.getAll
  });

  // Fetch task lists (containers for tasks)
  const { data: taskLists = [] } = useQuery({
    queryKey: ['task-lists'],
    queryFn: taskListsApi.getAll
  });

  // Fetch docs
  const { data: docs = [] } = useQuery<Doc[]>({
    queryKey: ['docs'],
    queryFn: docsApi.getAll
  });

  // Fetch forms
  const { data: forms = [] } = useQuery<Form[]>({
    queryKey: ['forms'],
    queryFn: formsApi.getAll
  });

  // Fetch sprint folders
  const { data: sprintFolders = [] } = useQuery<SprintFolder[]>({
    queryKey: ['sprint-folders'],
    queryFn: sprintFoldersApi.getAll
  });

  // Fetch all sprints
  const { data: sprints = [] } = useQuery<Sprint[]>({
    queryKey: ['sprints'],
    queryFn: sprintsApi.getAll
  });

  // Fetch custom fields for the current context (list > folder > space)
  const { data: customFields = [] } = useQuery<CustomField[]>({
    queryKey: ['customFields', selectedSpace?.id, selectedFolder?.id, selectedList?.id],
    queryFn: () => {
      if (selectedList) return customFieldsApi.getByList(selectedList.id);
      if (selectedFolder) return customFieldsApi.getByFolder(selectedFolder.id);
      if (selectedSpace) return customFieldsApi.getBySpace(selectedSpace.id);
      return Promise.resolve([]);
    },
    enabled: !!selectedSpace || !!selectedFolder || !!selectedList
  });

  const listViewSettings: ListViewSettings = useMemo(() => {
    // Load view settings from localStorage keyed by list/sprint ID
    const entityId = selectedList?.id || selectedSprint?.id;
    let stored: Partial<ListViewSettings> | undefined;
    if (entityId) {
      try {
        const raw = localStorage.getItem(`view-settings-${entityId}`);
        if (raw) stored = JSON.parse(raw);
      } catch { /* ignore parse errors */ }
    }
    const mergedFields = {
      ...DEFAULT_LIST_VIEW_SETTINGS.fields,
      ...(stored?.fields || {})
    };
    mergedFields.name = true;
    return {
      fields: mergedFields,
      custom_fields: {
        ...DEFAULT_LIST_VIEW_SETTINGS.custom_fields,
        ...(stored?.custom_fields || {})
      },
      custom_fields_order: stored?.custom_fields_order ?? DEFAULT_LIST_VIEW_SETTINGS.custom_fields_order,
      base_fields_order: stored?.base_fields_order ?? DEFAULT_LIST_VIEW_SETTINGS.base_fields_order,
      unified_column_order: stored?.unified_column_order ?? DEFAULT_LIST_VIEW_SETTINGS.unified_column_order,
      show_empty_statuses: stored?.show_empty_statuses ?? DEFAULT_LIST_VIEW_SETTINGS.show_empty_statuses
    };
  }, [selectedList, selectedSprint]);
  const [listViewSettingsOverride, setListViewSettingsOverride] = useState<ListViewSettings | null>(null);
  const [viewPanelSearch, setViewPanelSearch] = useState('');
  const effectiveListViewSettings = listViewSettingsOverride ?? listViewSettings;

  useEffect(() => {
    setListViewSettingsOverride(null);
  }, [selectedList?.id, selectedSprint?.id]);

  useEffect(() => {
    if (!showViewPanel) {
      setViewPanelStep('customize');
      setViewPanelSearch('');
    }
  }, [showViewPanel]);

  useEffect(() => {
    if (activeView !== 'list' || (!selectedList && !selectedSprint)) {
      setShowViewPanel(false);
    }
  }, [activeView, selectedList?.id, selectedSprint?.id]);

  const orderedCustomFields = useMemo(() => {
    const order = effectiveListViewSettings.custom_fields_order || [];
    if (order.length === 0) return customFields;
    const map = new Map(customFields.map(field => [field.id, field]));
    const ordered = order.map(id => map.get(id)).filter(Boolean) as CustomField[];
    const remaining = customFields.filter(field => !order.includes(field.id));
    return [...ordered, ...remaining];
  }, [customFields, effectiveListViewSettings.custom_fields_order]);

  const visibleCustomFields = useMemo(
    () => orderedCustomFields.filter(field => effectiveListViewSettings.custom_fields[field.id] !== false),
    [orderedCustomFields, effectiveListViewSettings.custom_fields]
  );

  // Fetch custom field values for visible tasks
  const taskIds = useMemo(() => tasks.map(t => t.id), [tasks]);
  const { data: customFieldValues = [] } = useQuery<CustomFieldValue[]>({
    queryKey: ['customFieldValues', taskIds],
    queryFn: () => taskIds.length > 0 ? customFieldsApi.getValuesBatch(taskIds) : Promise.resolve([]),
    enabled: taskIds.length > 0
  });

  // Map custom field values by task and field for easy lookup
  const fieldValueMap = useMemo(() => {
    const map: Record<string, Record<string, CustomFieldValue>> = {};
    customFieldValues.forEach(value => {
      if (!map[value.task_id]) map[value.task_id] = {};
      map[value.task_id][value.field_id] = value;
    });
    return map;
  }, [customFieldValues]);

  // Fetch available members for space assignment
  const { data: availableMembers = [] } = useQuery({
    queryKey: ['members'],
    queryFn: membersApi.getAll
  });

  // Fetch spaces the current member has access to (for guests/limited members)
  const { data: memberSpaceAccess = [], refetch: refetchSpaceAccess } = useQuery({
    queryKey: ['memberSpaceAccess', member?.id],
    queryFn: async () => {
      if (!member?.id) return [];
      console.log('Fetching space access for member:', member.id);
      const result = await spaceMembersApi.getByMember(member.id);
      console.log('Space access result:', result);
      return result;
    },
    enabled: needsSpaceAccess && !!member?.id,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  // Fetch members of the selected space (for admins to manage permissions)
  const { data: spaceMembers = [] } = useQuery({
    queryKey: ['space-members', selectedSpace?.id],
    queryFn: async () => {
      if (!selectedSpace?.id) return [];
      return spaceMembersApi.getBySpace(selectedSpace.id);
    },
    enabled: !!selectedSpace?.id && (isOwner || !needsSpaceAccess)
  });

  // Fetch task statuses for the selected space (from database)
  const { data: dbSpaceStatuses = [] } = useQuery<ApiTaskStatus[]>({
    queryKey: ['task-statuses-space', selectedSpace?.id],
    queryFn: async () => {
      if (!selectedSpace?.id) return [];
      return taskStatusesApi.getBySpace(selectedSpace.id);
    },
    enabled: !!selectedSpace?.id
  });

  // Fetch task statuses for the selected folder (from database)
  const { data: dbFolderStatuses = [] } = useQuery<ApiTaskStatus[]>({
    queryKey: ['task-statuses-folder', selectedFolder?.id],
    queryFn: async () => {
      if (!selectedFolder?.id) return [];
      return taskStatusesApi.getByFolder(selectedFolder.id);
    },
    enabled: !!selectedFolder?.id
  });

  // Fetch task statuses for the selected list (from database)
  const { data: dbListStatuses = [] } = useQuery<ApiTaskStatus[]>({
    queryKey: ['task-statuses-list', selectedList?.id, selectedSprint?.id],
    queryFn: async () => {
      if (selectedList?.id) return taskStatusesApi.getByList(selectedList.id);
      if (selectedSprint?.id) return taskStatusesApi.getBySprint(selectedSprint.id);
      return [];
    },
    enabled: !!selectedList?.id || !!selectedSprint?.id
  });

  // Get statuses for the current view - STRICT ISOLATION: list > folder > space
  const statuses: StatusConfig[] = useMemo(() => {
    // Convert API statuses to StatusConfig format
    const toStatusConfig = (apiStatuses: ApiTaskStatus[]): StatusConfig[] => {
      return apiStatuses.map(s => ({
        name: s.name,
        color: s.color,
        bgColor: s.color,
        id: s.id,
        status_group: s.status_group,
        position: s.position
      }));
    };

    const localFallback = selectedSpace ? (spaceStatuses[selectedSpace.id] || []) : [];

    // Priority: List/Sprint statuses > Folder statuses > Space statuses
    if ((selectedList || selectedSprint) && dbListStatuses && dbListStatuses.length > 0) {
      const base = toStatusConfig(dbListStatuses);
      localFallback.forEach(s => {
        if (!base.some(b => b.name.toLowerCase() === s.name.toLowerCase())) {
          base.push(s);
        }
      });
      return base;
    }

    if (selectedFolder && dbFolderStatuses && dbFolderStatuses.length > 0) {
      const base = toStatusConfig(dbFolderStatuses);
      localFallback.forEach(s => {
        if (!base.some(b => b.name.toLowerCase() === s.name.toLowerCase())) {
          base.push(s);
        }
      });
      return base;
    }

    if (selectedSpace && dbSpaceStatuses && dbSpaceStatuses.length > 0) {
      const base = toStatusConfig(dbSpaceStatuses);
      localFallback.forEach(s => {
        if (!base.some(b => b.name.toLowerCase() === s.name.toLowerCase())) {
          base.push(s);
        }
      });
      return base;
    }

    // Fallback to localStorage statuses for the space
    if (selectedSpace) {
      return localFallback;
    }

    return [];
  }, [selectedSpace, selectedFolder, selectedList, selectedSprint, dbSpaceStatuses, dbFolderStatuses, dbListStatuses, spaceStatuses]);

  const listHasCustomStatuses = selectedList && dbListStatuses.length > 0;
  const sprintHasCustomStatuses = selectedSprint && dbListStatuses.length > 0;

  // Filter spaces based on access permissions
  const visibleSpaces = useMemo(() => {
    if (!needsSpaceAccess) {
      // Admins, members, and owner can see all spaces
      return spaces;
    }
    // Guests and limited members can only see spaces they have access to
    console.log('Filtering spaces for guest. memberSpaceAccess:', memberSpaceAccess);
    const accessibleSpaceIds = new Set(
      memberSpaceAccess.map((sa: { space_id: string }) => sa.space_id)
    );
    console.log('Accessible space IDs:', Array.from(accessibleSpaceIds));
    const filtered = spaces.filter(space => accessibleSpaceIds.has(space.id));
    console.log('Filtered spaces:', filtered);
    return filtered;
  }, [spaces, needsSpaceAccess, memberSpaceAccess]);

  // Space Mutations
  const createSpaceMutation = useMutation({
    mutationFn: async (input: { name: string; description?: string; color?: string }) => {
      if (!canEdit) throw new Error('View only');
      const space = await spacesApi.create(input);
      console.log('Space created:', space);
      // Add selected members to the space
      if (selectedSpaceMembers.length > 0) {
        console.log('Adding members to space:', {
          space_id: space.id,
          members: selectedSpaceMembers
        });
        try {
          const result = await spaceMembersApi.addBulkMembers({
            space_id: space.id,
            members: selectedSpaceMembers.map(sm => ({
              member_id: sm.member_id,
              permission: sm.permission || 'view_only'
            }))
          });
          console.log('Members added successfully:', result);
        } catch (memberError) {
          console.error('Failed to add members:', memberError);
          // Space was created, but members failed - show warning
          toast.warning('Space created, but failed to add some guests. You can add them later.');
        }
      }
      return space;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['space-members'] });
      setShowSpaceModal(false);
      resetSpaceForm();
      toast.success('Space created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create space')
  });

  const updateSpaceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Space> }) => spacesApi.update(id, data),
    onSuccess: (updatedSpace) => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      // Update selectedSpace if it's the one being edited
      if (selectedSpace?.id === updatedSpace.id) {
        setSelectedSpace(updatedSpace);
      }
      setShowSpaceModal(false);
      setEditingSpace(null);
      resetSpaceForm();
      toast.success('Space updated');
    },
    onError: (err: Error) => {
      console.error('Update space error:', err);
      toast.error(err.message || 'Failed to update space');
    }
  });

  const deleteSpaceMutation = useMutation({
    mutationFn: (id: string) => {
      if (!canEdit) return Promise.reject(new Error('View only'));
      return spacesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      if (selectedSpace) setSelectedSpace(null);
      toast.success('Space deleted');
    }
  });

  // Space Member Management Mutations
  const updateMemberPermissionMutation = useMutation({
    mutationFn: ({ id, permission }: { id: string; permission: string }) =>
      spaceMembersApi.updatePermission(id, permission),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['space-members', selectedSpace?.id] });
      setEditingMemberPermission(null);
      toast.success('Permission updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update permission')
  });

  const removeMemberFromSpaceMutation = useMutation({
    mutationFn: (id: string) => spaceMembersApi.removeMember(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['space-members', selectedSpace?.id] });
      toast.success('Member removed from space');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to remove member')
  });

  const addMemberToSpaceMutation = useMutation({
    mutationFn: (data: { space_id: string; member_id: string; permission: string }) =>
      spaceMembersApi.addMember(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['space-members', selectedSpace?.id] });
      setShowAddGuestDropdown(false);
      setAddGuestSearchQuery('');
      toast.success('Guest added to space');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to add guest')
  });

  // Folder Mutations
  const createFolderMutation = useMutation({
    mutationFn: (input: Parameters<typeof foldersApi.create>[0]) => {
      if (!canEdit) return Promise.reject(new Error('View only'));
      return foldersApi.create(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      setShowFolderModal(false);
      setFolderName('');
      toast.success('Folder created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create folder')
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => {
      if (!canEdit) return Promise.reject(new Error('View only'));
      return foldersApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      if (selectedFolder) setSelectedFolder(null);
      toast.success('Folder deleted');
    }
  });

  const updateFolderMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Folder> }) => {
      console.log('Calling foldersApi.update with:', id, data);
      return foldersApi.update(id, data);
    },
    onSuccess: (result) => {
      console.log('Folder update success:', result);
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      setShowFolderModal(false);
      setEditingFolder(null);
      setFolderName('');
      toast.success('Folder updated');
    },
    onError: (err: Error) => {
      console.error('Folder update error:', err);
      toast.error(err.message || 'Failed to update folder');
    }
  });

  // Sprint Folder Mutations
  const createSprintFolderMutation = useMutation({
    mutationFn: (input: { name?: string; space_id: string; default_duration?: number; folder_id?: string }) => {
      if (!canEdit) return Promise.reject(new Error('View only'));
      return sprintFoldersApi.create(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint-folders'] });
      queryClient.invalidateQueries({ queryKey: ['sprints'] });
      queryClient.invalidateQueries({ queryKey: ['task-lists'] });
      setShowSprintFolderModal(false);
      toast.success('Sprint folder created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create sprint folder')
  });

  const deleteSprintFolderMutation = useMutation({
    mutationFn: (id: string) => {
      if (!canEdit) return Promise.reject(new Error('View only'));
      return sprintFoldersApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint-folders'] });
      queryClient.invalidateQueries({ queryKey: ['sprints'] });
      if (selectedSprintFolder) setSelectedSprintFolder(null);
      if (selectedSprint) setSelectedSprint(null);
      toast.success('Sprint folder deleted');
    }
  });

  // Sprint Mutations
  const createSprintMutation = useMutation({
    mutationFn: (input: { name?: string; sprint_folder_id: string; space_id: string; start_date: string; end_date: string; folder_id?: string }) => {
      if (!canEdit) return Promise.reject(new Error('View only'));
      return sprintsApi.create(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints'] });
      setShowSprintCreateModal(false);
      toast.success('Sprint created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create sprint')
  });

  const deleteSprintMutation = useMutation({
    mutationFn: (id: string) => {
      if (!canEdit) return Promise.reject(new Error('View only'));
      return sprintsApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (selectedSprint) setSelectedSprint(null);
      toast.success('Sprint deleted');
    }
  });

  const rolloverSprintMutation = useMutation({
    mutationFn: ({ sprintId, targetSprintId }: { sprintId: string; targetSprintId: string }) =>
      sprintsApi.rollover(sprintId, targetSprintId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(`Rolled over ${result.moved} tasks`);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to rollover tasks')
  });

  // Doc Mutations
  const createDocMutation = useMutation({
    mutationFn: docsApi.create,
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({ queryKey: ['docs'] });
      setShowDocModal(false);
      setDocName('');
      setDocTargetFolder(null);
      if (openDocAfterCreate) {
        setEditingDoc(newDoc);
      }
      setOpenDocAfterCreate(true);
      toast.success('Doc created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create doc')
  });

  const deleteDocMutation = useMutation({
    mutationFn: (id: string) => {
      if (!canEdit) return Promise.reject(new Error('View only'));
      return docsApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docs'] });
      toast.success('Doc deleted');
    }
  });

  const updateDocMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Doc> }) => {
      if (!canEdit) return Promise.reject(new Error('View only'));
      return docsApi.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docs'] });
      toast.success('Doc updated');
    }
  });

  // Form Mutations
  const createFormMutation = useMutation({
    mutationFn: formsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      setShowFormModal(false);
      setFormName('');
      setFormDescription('');
      setFormTargetFolder(null);
      toast.success('Form created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create form')
  });

  const deleteFormMutation = useMutation({
    mutationFn: (id: string) => {
      if (!canEdit) return Promise.reject(new Error('View only'));
      return formsApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Form deleted');
    }
  });

  const updateFormMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Form> }) => {
      if (!canEdit) return Promise.reject(new Error('View only'));
      return formsApi.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Form updated');
    }
  });

  // Task List Mutations (Lists that contain tasks)
  const createTaskListMutation = useMutation({
    mutationFn: taskListsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists'] });
      setShowListModal(false);
      resetListForm();
      toast.success('List created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create list')
  });

  const updateTaskListMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TaskList> }) => taskListsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists'] });
      setShowListModal(false);
      setEditingList(null);
      resetListForm();
      toast.success('List updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update list')
  });

  const updateListViewSettingsMutation = useMutation<void, Error, { id: string; view_settings: ListViewSettings }>({
    mutationFn: async ({ id, view_settings }: { id: string; view_settings: ListViewSettings }) => {
      // Save view settings to localStorage (no database column needed)
      localStorage.setItem(`view-settings-${id}`, JSON.stringify(view_settings));
    },
    onSuccess: () => {
      // No need to invalidate queries since settings are in localStorage
    },
    onError: (err: Error) => {
      console.error('Failed to save view settings:', err);
    }
  });

  const applyListViewSettings = useCallback((partial: Partial<ListViewSettings>) => {
    // Work for both lists and sprints
    const targetId = selectedList?.id || selectedSprint?.id;
    if (!targetId) return;
    if (!canEdit) {
      toast.error('View only');
      return;
    }
    const next: ListViewSettings = {
      ...effectiveListViewSettings,
      ...partial,
      fields: {
        ...effectiveListViewSettings.fields,
        ...(partial.fields || {})
      },
      custom_fields: {
        ...effectiveListViewSettings.custom_fields,
        ...(partial.custom_fields || {})
      },
      custom_fields_order: partial.custom_fields_order ?? effectiveListViewSettings.custom_fields_order,
      base_fields_order: partial.base_fields_order ?? effectiveListViewSettings.base_fields_order,
      unified_column_order: partial.unified_column_order ?? effectiveListViewSettings.unified_column_order
    };
    next.fields.name = true;
    setListViewSettingsOverride(next);
    updateListViewSettingsMutation.mutate({ id: targetId, view_settings: next });
  }, [selectedList, selectedSprint, canEdit, effectiveListViewSettings, updateListViewSettingsMutation]);

  const deleteTaskListMutation = useMutation({
    mutationFn: (id: string) => {
      if (!canEdit) return Promise.reject(new Error('View only'));
      return taskListsApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists'] });
      if (selectedList) setSelectedList(null);
      toast.success('List deleted');
    }
  });

  // Task Mutations
  const createTaskMutation = useMutation({
    mutationFn: (input: Parameters<typeof tasksApi.create>[0]) => {
      if (!canEdit) return Promise.reject(new Error('View only'));
      return tasksApi.create(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowTaskModal(false);
      resetTaskForm();
      toast.success('Task created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create task')
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskInput }) => {
      if (!canEdit) return Promise.reject(new Error('View only'));
      return tasksApi.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowTaskModal(false);
      setEditingTask(null);
      resetTaskForm();
      toast.success('Task updated');
    }
  });

  // Custom field value mutation
  const setFieldValueMutation = useMutation({
    mutationFn: ({ taskId, fieldId, value }: { taskId: string; fieldId: string; value: any }) =>
      customFieldsApi.setValue(taskId, fieldId, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customFieldValues'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update field')
  });

  const deleteCustomFieldMutation = useMutation({
    mutationFn: (id: string) => customFieldsApi.delete(id),
    onSuccess: (_data, fieldId) => {
      queryClient.invalidateQueries({ queryKey: ['customFields'] });
      // Remove from view settings order/visibility
      const filteredOrder = (effectiveListViewSettings.custom_fields_order || []).filter(id => id !== fieldId);
      const nextCustomFields = { ...effectiveListViewSettings.custom_fields };
      delete nextCustomFields[fieldId];
      applyListViewSettings({ custom_fields_order: filteredOrder, custom_fields: nextCustomFields });
      toast.success('Field deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete field')
  });

  const deleteTaskMutation = useMutation({
    mutationFn: tasksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task deleted');
    }
  });

  // Status mutations for database-backed statuses
  const invalidateAllStatusQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['task-statuses-space'] });
    queryClient.invalidateQueries({ queryKey: ['task-statuses-folder'] });
    queryClient.invalidateQueries({ queryKey: ['task-statuses-list'] });
    queryClient.invalidateQueries({ queryKey: ['task-statuses-spaces'] });
    queryClient.invalidateQueries({ queryKey: ['task-statuses-sprints'] });
  }, [queryClient]);

  const createStatusMutation = useMutation({
    mutationFn: (input: { name: string; color: string; space_id?: string; folder_id?: string; list_id?: string; sprint_id?: string; position?: number; status_group?: 'active' | 'done' | 'closed' }) =>
      taskStatusesApi.create(input),
    onSuccess: () => {
      invalidateAllStatusQueries();
      toast.success('Status created');
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ApiTaskStatus> }) =>
      taskStatusesApi.update(id, data),
    onSuccess: () => {
      invalidateAllStatusQueries();
      toast.success('Status updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update status')
  });

  const deleteStatusMutation = useMutation({
    mutationFn: (id: string) => taskStatusesApi.delete(id),
    onSuccess: () => {
      invalidateAllStatusQueries();
      toast.success('Status deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete status')
  });

  const bulkUpdateStatusesMutation = useMutation({
    mutationFn: (data: { statuses: any[]; space_id?: string; folder_id?: string; list_id?: string }) =>
      taskStatusesApi.bulkUpdate(data),
    onSuccess: () => {
      invalidateAllStatusQueries();
      toast.success('Statuses updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update statuses')
  });

  // Helper functions
  const resetSpaceForm = () => {
    setSpaceName('');
    setSpaceDescription('');
    setSpaceColor('#6366f1');
    setSelectedSpaceMembers([]);
    setShowMemberSelector(false);
    setSpaceDefaultPermission('full_edit');
    setShowPermissionDropdown(false);
    setSpaceIsPrivate(false);
    setSpaceIcon('S');
  };

  const resetTaskForm = () => {
    setTaskName('');
    setTaskDescription('');
    setTaskStatus('To Do');
    setTaskPriority('MEDIUM');
    setTaskAssignee('');
    setTaskDueDate('');
    setTaskFolderId('');
    setTaskListId('');
  };

  const resetListForm = () => {
    setListName('');
    setListDescription('');
    setListColor('#6366f1');
    setListTargetFolder(null);
  };

  // Handle list creation/update
  const handleListSubmit = () => {
    if (!canEdit || !listName.trim()) return;

    if (editingList) {
      updateTaskListMutation.mutate({
        id: editingList.id,
        data: {
          name: listName.trim(),
          description: listDescription || undefined,
          color: listColor
        }
      });
    } else {
      createTaskListMutation.mutate({
        name: listName.trim(),
        description: listDescription || undefined,
        color: listColor,
        space_id: listTargetFolder ? undefined : selectedSpace?.id,
        folder_id: listTargetFolder || undefined
      });
    }
  };

  const createDocForSpace = (openEditor: boolean) => {
    if (!selectedSpace) return;
    if (!canEdit) { toast.error('View only — you do not have edit permissions'); return; }
    setOpenDocAfterCreate(openEditor);
    createDocMutation.mutate({
      name: 'Untitled',
      content: '',
      space_id: selectedSpace.id,
      folder_id: null,
      owner_id: member?.id,
    } as any);
  };

  // Open list modal for editing
  const openEditList = (list: TaskList) => {
    if (!canEdit) { toast.error('View only — you do not have edit permissions'); return; }
    setEditingList(list);
    setListName(list.name);
    setListDescription(list.description || '');
    setListColor(list.color);
    setListTargetFolder(list.folder_id || null);
    setShowListModal(true);
  };

  // Handle doc creation
  const handleDocSubmit = () => {
    if (!canEdit || !docName.trim()) return;
    createDocMutation.mutate({
      name: docName.trim(),
      space_id: docTargetFolder ? undefined : selectedSpace?.id,
      folder_id: docTargetFolder || undefined,
      owner_id: member?.id,
    });
  };

  // Open doc modal for creating in a specific folder or space
  const openCreateDoc = (folderId?: string) => {
    if (!canEdit) { toast.error('View only — you do not have edit permissions'); return; }
    setDocName('');
    setDocTargetFolder(folderId || null);
    setShowDocModal(true);
  };

  // Handle form creation
  const handleFormSubmit = () => {
    if (!canEdit || !formName.trim()) return;
    createFormMutation.mutate({
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      space_id: formTargetFolder ? undefined : selectedSpace?.id,
      folder_id: formTargetFolder || undefined
    });
  };

  // Open form modal for creating in a specific folder or space
  const openCreateForm = (folderId?: string) => {
    if (!canEdit) { toast.error('View only — you do not have edit permissions'); return; }
    setFormName('');
    setFormDescription('');
    setFormTargetFolder(folderId || null);
    setShowFormModal(true);
  };

  // Open list modal for creating in a specific folder or space
  const openCreateList = (folderId?: string) => {
    if (!canEdit) { toast.error('View only — you do not have edit permissions'); return; }
    resetListForm();
    setListTargetFolder(folderId || null);
    setShowListModal(true);
  };

  const handleAddStatus = async () => {
    if (!newStatusName.trim() || !selectedSpace) return;
    // Check for duplicate status name in current scope
    if (statuses.some(s => s.name.toLowerCase() === newStatusName.trim().toLowerCase())) {
      toast.error('Status already exists');
      return;
    }

    // Determine the scope to create the status in.
    // If we're inside a sprint/list, create it at that scope so it's isolated.
    const scopeParam: Record<string, string> = {};
    if (selectedSprint) {
      scopeParam.sprint_id = selectedSprint.id;
    } else if (selectedList) {
      scopeParam.list_id = selectedList.id;
    } else if (selectedFolder) {
      scopeParam.folder_id = selectedFolder.id;
    } else {
      scopeParam.space_id = selectedSpace.id;
    }

    const nextStatus: StatusConfig = {
      name: newStatusName.trim().toUpperCase(),
      color: newStatusColor,
      bgColor: newStatusColor
    };

    // Use database API to create status, fall back to local storage on network failure
    try {
      await createStatusMutation.mutateAsync({
        name: nextStatus.name,
        color: nextStatus.color,
        ...scopeParam,
        position: statuses.length,
        status_group: 'active'
      });
      if (groupBy === 'status' && !effectiveListViewSettings.show_empty_statuses) {
        applyListViewSettings({ show_empty_statuses: true });
      }
    } catch (err) {
      setSpaceStatuses(prev => {
        const existing = prev[selectedSpace.id] || [];
        if (existing.some(s => s.name.toLowerCase() === nextStatus.name.toLowerCase())) return prev;
        return { ...prev, [selectedSpace.id]: [...existing, nextStatus] };
      });
      toast.error('API unavailable. Status saved locally.');
      if (groupBy === 'status' && !effectiveListViewSettings.show_empty_statuses) {
        applyListViewSettings({ show_empty_statuses: true });
      }
    }

    setNewStatusName('');
    setNewStatusColor('#3b82f6');
    setShowAddStatusModal(false);
  };

  const handleDeleteStatus = (statusToDelete: StatusConfig) => {
    if (!selectedSpace) return;

    // Don't allow deleting if there are tasks with this status in the current space
    const tasksWithStatus = tasks.filter(t => t.space_id === selectedSpace.id && t.status === statusToDelete.name);
    if (tasksWithStatus.length > 0) {
      toast.error(`Cannot delete: ${tasksWithStatus.length} task(s) have this status`);
      return;
    }

    // Use database API if status has an ID, otherwise use localStorage
    if (statusToDelete.id) {
      deleteStatusMutation.mutate(statusToDelete.id);
    } else {
      setSpaceStatuses(prev => ({
        ...prev,
        [selectedSpace.id]: (prev[selectedSpace.id] || []).filter(s => s.name !== statusToDelete.name)
      }));
      toast.success('Status deleted');
    }
    setOpenStatusMenuId(null);
  };

  const openEditStatus = (status: StatusConfig) => {
    setEditingStatus(status);
    setEditStatusName(status.name);
    setEditStatusColor(status.bgColor);
    setShowEditStatusModal(true);
    setOpenStatusMenuId(null);
  };

  const handleEditStatus = () => {
    if (!editStatusName.trim() || !selectedSpace || !editingStatus) return;
    // Check for duplicate name (excluding the current status being edited)
    if (statuses.some(s => s.name.toLowerCase() === editStatusName.trim().toLowerCase() && s.name !== editingStatus.name)) {
      toast.error('Status name already exists');
      return;
    }

    const oldName = editingStatus.name;
    const newName = editStatusName.trim().toUpperCase();

    // Use database API if status has an ID
    if (editingStatus.id) {
      updateStatusMutation.mutate({
        id: editingStatus.id,
        data: { name: newName, color: editStatusColor }
      });
    } else {
      // Fallback to localStorage for legacy statuses
      setSpaceStatuses(prev => ({
        ...prev,
        [selectedSpace.id]: (prev[selectedSpace.id] || []).map(s =>
          s.name === oldName
            ? { ...s, name: newName, bgColor: editStatusColor }
            : s
        )
      }));
      toast.success('Status updated');
    }

    // Update tasks that have this status (if name changed)
    if (oldName !== newName) {
      tasks.filter(t => t.status === oldName).forEach(task => {
        updateTaskMutation.mutate({ id: task.id, data: { status: newName as any } });
      });
    }

    setShowEditStatusModal(false);
    setEditingStatus(null);
    setEditStatusName('');
    setEditStatusColor('#3b82f6');
    toast.success('Status updated');
  };

  // Open Task Statuses modal for SPACE (strict isolation)
  const openSpaceTaskStatuses = async (space: Space) => {
    setTaskStatusesTarget({
      type: 'space',
      id: space.id,
      name: space.name,
      spaceId: space.id,
      spaceName: space.name
    });

    setTaskStatusesInheritedFrom(null); // Spaces don't inherit
    setTaskStatusesUseCustom(true); // Always custom for space
    setTaskStatusesTemplate('custom');

    try {
      const spaceStatuses = await taskStatusesApi.getBySpace(space.id);
      const mapped = spaceStatuses.map((s: ApiTaskStatus) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        bgColor: s.color,
        status_group: s.status_group,
        position: s.position
      }));
      setTaskStatusesList(mapped);
      setTaskStatusesOriginalNames(mapped.map(s => s.name));
    } catch (err) {
      setTaskStatusesList([]);
      setTaskStatusesOriginalNames([]);
    }
    setShowTaskStatusesAddForm(false);
    setShowTaskStatusesModal(true);
  };

  // Open Task Statuses modal for FOLDER (can inherit from space)
  const openFolderTaskStatuses = async (folder: Folder) => {
    const parentSpace = spaces.find(s => s.id === folder.space_id);

    setTaskStatusesTarget({
      type: 'folder',
      id: folder.id,
      name: folder.name,
      spaceId: folder.space_id,
      spaceName: parentSpace?.name || 'Space'
    });

    // Folders CAN inherit from their parent space
    setTaskStatusesInheritedFrom({ type: 'space', name: parentSpace?.name || 'Space' });

    try {
      // Get folder's own statuses
      const folderStatuses = await taskStatusesApi.getByFolder(folder.id);

      // Get parent space statuses for inheritance option
      const spaceStatuses = parentSpace ? await taskStatusesApi.getBySpace(parentSpace.id) : [];

      // Store both parent and custom statuses
      const parentStatusesMapped = spaceStatuses.map((s: ApiTaskStatus) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        bgColor: s.color,
        status_group: s.status_group,
        position: s.position
      }));

      const customStatusesMapped = folderStatuses.map((s: ApiTaskStatus) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        bgColor: s.color,
        status_group: s.status_group,
        position: s.position
      }));

      setTaskStatusesParentStatuses(parentStatusesMapped);
      setTaskStatusesCustomStatuses(customStatusesMapped);

      // If folder has custom statuses, use custom mode
      if (folderStatuses && folderStatuses.length > 0) {
        setTaskStatusesUseCustom(true);
        setTaskStatusesList(customStatusesMapped);
        setTaskStatusesOriginalNames(customStatusesMapped.map(s => s.name));
      } else {
        // Otherwise inherit from space
        setTaskStatusesUseCustom(false);
        setTaskStatusesList(parentStatusesMapped);
        setTaskStatusesOriginalNames(parentStatusesMapped.map(s => s.name));
      }
      setTaskStatusesTemplate('custom');
    } catch (err) {
      setTaskStatusesList([]);
      setTaskStatusesParentStatuses([]);
      setTaskStatusesCustomStatuses([]);
      setTaskStatusesUseCustom(false);
      setTaskStatusesOriginalNames([]);
    }
    setShowTaskStatusesAddForm(false);
    setShowTaskStatusesModal(true);
  };

  // Open Task Statuses modal for LIST (can inherit from space)
  const openListTaskStatuses = async (list: TaskList) => {
    const parentFolder = list.folder_id ? folders.find(f => f.id === list.folder_id) : null;
    const parentSpace = spaces.find(s => s.id === list.space_id);

    setTaskStatusesTarget({
      type: 'list',
      id: list.id,
      name: list.name,
      folderId: list.folder_id || undefined,
      folderName: parentFolder?.name,
      spaceId: list.space_id,
      spaceName: parentSpace?.name || 'Space'
    });

    // Lists CAN inherit from their parent space
    setTaskStatusesInheritedFrom({ type: 'space', name: parentSpace?.name || 'Space' });

    try {
      // Get list's own statuses
      const listStatuses = await taskStatusesApi.getByList(list.id);

      // Get parent space statuses for inheritance option
      const spaceStatuses = parentSpace ? await taskStatusesApi.getBySpace(parentSpace.id) : [];

      // Store both parent and custom statuses
      const parentStatusesMapped = spaceStatuses.map((s: ApiTaskStatus) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        bgColor: s.color,
        status_group: s.status_group,
        position: s.position
      }));

      const customStatusesMapped = listStatuses.map((s: ApiTaskStatus) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        bgColor: s.color,
        status_group: s.status_group,
        position: s.position
      }));

      setTaskStatusesParentStatuses(parentStatusesMapped);
      setTaskStatusesCustomStatuses(customStatusesMapped);

      // If list has custom statuses, use custom mode
      if (listStatuses && listStatuses.length > 0) {
        setTaskStatusesUseCustom(true);
        setTaskStatusesList(customStatusesMapped);
        setTaskStatusesOriginalNames(customStatusesMapped.map(s => s.name));
      } else {
        // Otherwise inherit from space
        setTaskStatusesUseCustom(false);
        setTaskStatusesList(parentStatusesMapped);
        setTaskStatusesOriginalNames(parentStatusesMapped.map(s => s.name));
      }
      setTaskStatusesTemplate('custom');
    } catch (err) {
      setTaskStatusesList([]);
      setTaskStatusesParentStatuses([]);
      setTaskStatusesCustomStatuses([]);
      setTaskStatusesUseCustom(false);
      setTaskStatusesOriginalNames([]);
    }
    setShowTaskStatusesAddForm(false);
    setShowTaskStatusesModal(true);
  };

  const openSprintTaskStatuses = async (sprint: Sprint) => {
    const parentSpace = spaces.find(s => s.id === sprint.space_id);

    setTaskStatusesTarget({
      type: 'sprint',
      id: sprint.id,
      name: sprint.name,
      spaceId: sprint.space_id,
      spaceName: parentSpace?.name || 'Space'
    });

    setTaskStatusesInheritedFrom({ type: 'space', name: parentSpace?.name || 'Space' });

    try {
      const sprintStatuses = await taskStatusesApi.getBySprint(sprint.id);
      const spaceStatuses = parentSpace ? await taskStatusesApi.getBySpace(parentSpace.id) : [];

      const parentStatusesMapped = spaceStatuses.map((s: ApiTaskStatus) => ({
        id: s.id, name: s.name, color: s.color, bgColor: s.color,
        status_group: s.status_group, position: s.position
      }));

      const customStatusesMapped = sprintStatuses.map((s: ApiTaskStatus) => ({
        id: s.id, name: s.name, color: s.color, bgColor: s.color,
        status_group: s.status_group, position: s.position
      }));

      setTaskStatusesParentStatuses(parentStatusesMapped);
      setTaskStatusesCustomStatuses(customStatusesMapped);

      if (sprintStatuses && sprintStatuses.length > 0) {
        setTaskStatusesUseCustom(true);
        setTaskStatusesList(customStatusesMapped);
        setTaskStatusesOriginalNames(customStatusesMapped.map(s => s.name));
      } else {
        setTaskStatusesUseCustom(false);
        setTaskStatusesList(parentStatusesMapped);
        setTaskStatusesOriginalNames(parentStatusesMapped.map(s => s.name));
      }
      setTaskStatusesTemplate('custom');
    } catch (err) {
      setTaskStatusesList([]);
      setTaskStatusesParentStatuses([]);
      setTaskStatusesCustomStatuses([]);
      setTaskStatusesUseCustom(false);
      setTaskStatusesOriginalNames([]);
    }
    setShowTaskStatusesAddForm(false);
    setShowTaskStatusesModal(true);
  };

  // Handle applying task statuses changes (with inheritance support)
  const handleApplyTaskStatuses = async () => {
    if (!taskStatusesTarget) return;
    try {
      // Build the scope parameter for bulkUpdate
      const scopeParam: Record<string, string> = {};
      if (taskStatusesTarget.type === 'space') {
        scopeParam.space_id = taskStatusesTarget.id;
      } else if (taskStatusesTarget.type === 'folder') {
        scopeParam.folder_id = taskStatusesTarget.id;
      } else if (taskStatusesTarget.type === 'list') {
        scopeParam.list_id = taskStatusesTarget.id;
      } else if (taskStatusesTarget.type === 'sprint') {
        scopeParam.sprint_id = taskStatusesTarget.id;
      }

      // If inheriting from parent, save empty custom statuses (delete custom statuses)
      // If using custom, save the custom statuses
      const statusesToSave = taskStatusesUseCustom ? taskStatusesList : [];

      // Detect renamed statuses and batch-update tasks
      if (taskStatusesUseCustom && taskStatusesOriginalNames.length > 0) {
        for (let i = 0; i < taskStatusesOriginalNames.length; i++) {
          const oldName = taskStatusesOriginalNames[i];
          const newStatus = taskStatusesList[i];
          if (newStatus && newStatus.name !== oldName) {
            // This status was renamed — update all tasks with old status name in this scope
            let query = supabase.from('lists').update({ status: newStatus.name }).eq('status', oldName);
            if (taskStatusesTarget.type === 'space') {
              query = query.eq('space_id', taskStatusesTarget.id);
            } else if (taskStatusesTarget.type === 'folder') {
              query = query.eq('folder_id', taskStatusesTarget.id);
            } else if (taskStatusesTarget.type === 'list') {
              query = query.eq('list_id', taskStatusesTarget.id);
            } else if (taskStatusesTarget.type === 'sprint') {
              query = query.eq('sprint_id', taskStatusesTarget.id);
            }
            await query;
          }
        }
      }

      // Save statuses for this specific scope
      await taskStatusesApi.bulkUpdate({
        statuses: statusesToSave.map((s, idx) => ({
          name: s.name,
          color: s.color,
          status_group: categorizeStatus(s),
          position: idx
        })),
        ...scopeParam
      });

      toast.success(`Statuses saved for ${taskStatusesTarget.type}: ${taskStatusesTarget.name}`);

      // Invalidate all status queries across both Workspace and SprintBoard
      invalidateAllStatusQueries();
      queryClient.invalidateQueries({ queryKey: ['tasks'] });

      setShowTaskStatusesModal(false);
      resetStatusModalState();
    } catch (err) {
      toast.error('Failed to save statuses');
    }
  };

  // Add status to the task statuses list
  const handleAddTaskStatus = () => {
    if (!taskStatusesAddName.trim()) return;
    const newStatus: StatusConfig = {
      name: taskStatusesAddName.trim().toUpperCase(),
      color: taskStatusesAddColor,
      bgColor: taskStatusesAddColor,
      status_group: statusAddingToSection,
      position: taskStatusesList.length
    };
    setTaskStatusesList([...taskStatusesList, newStatus]);
    setTaskStatusesAddName('');
    setTaskStatusesAddColor('#3b82f6');
    setTaskStatusesAddGroup('active');
    setShowTaskStatusesAddForm(false);
  };

  // Remove status from the task statuses list
  const handleRemoveTaskStatus = (index: number) => {
    setTaskStatusesList(taskStatusesList.filter((_, i) => i !== index));
  };

  // Reset all status modal state
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
    setStatusSectionCollapsed({ active: false, done: false, closed: false });
    setStatusAddingToSection('active');
    setStatusColorPickerIdx(null);
    setStatusMenuOpenIdx(null);
    setStatusRenameIdx(null);
    setTaskStatusesOriginalNames([]);
  };

  // Status templates with categorization
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
      { name: 'IN REVIEW', color: '#f59e0b', bgColor: '#f59e0b', status_group: 'active' },
      { name: 'BLOCKED', color: '#ef4444', bgColor: '#ef4444', status_group: 'active' },
      { name: 'DONE', color: '#22c55e', bgColor: '#22c55e', status_group: 'done' },
      { name: 'CLOSED', color: '#9ca3af', bgColor: '#9ca3af', status_group: 'closed' }
    ]
  };

  // Apply a status template
  const applyStatusTemplate = (template: string) => {
    setTaskStatusesTemplate(template);
    if (template === 'custom') {
      // For custom, keep the current list or clear if empty
      return;
    }
    const templateStatuses = statusTemplates[template];
    if (templateStatuses) {
      // Deep clone to avoid reference issues
      setTaskStatusesList(templateStatuses.map(s => ({ ...s })));
    }
  };

  const handleSpaceSubmit = () => {
    if (!canEdit || !spaceName.trim()) return;
    if (editingSpace) {
      updateSpaceMutation.mutate({
        id: editingSpace.id,
        data: { name: spaceName, description: spaceDescription, color: spaceColor }
      });
    } else {
      createSpaceMutation.mutate({ name: spaceName, description: spaceDescription, color: spaceColor });
    }
  };

  const handleFolderSubmit = () => {
    console.log('handleFolderSubmit called, editingFolder:', editingFolder, 'folderName:', folderName);
    if (!canEdit || !folderName.trim()) return;

    if (editingFolder) {
      console.log('Updating folder:', editingFolder.id, 'with name:', folderName);
      updateFolderMutation.mutate({
        id: editingFolder.id,
        data: { name: folderName }
      });
    } else {
      console.log('Creating new folder');
      if (!selectedSpace) return;
      createFolderMutation.mutate({ name: folderName, space_id: selectedSpace.id });
    }
  };

  const openEditFolder = (folder: Folder) => {
    if (!canEdit) { toast.error('View only — you do not have edit permissions'); return; }
    console.log('openEditFolder called with folder:', folder);
    setEditingFolder(folder);
    setFolderName(folder.name);
    setShowFolderModal(true);
  };

  const handleTaskSubmit = () => {
    if (!canEdit || !taskName.trim()) return;

    if (editingTask) {
      // For editing, we don't need selectedSpace
      updateTaskMutation.mutate({
        id: editingTask.id,
        data: {
          name: taskName,
          description: taskDescription || undefined,
          status: taskStatus,
          priority: taskPriority,
          due_date: taskDueDate || undefined,
          assignee_name: taskAssignee || undefined
        }
      });
    } else {
      // For creating, we need a space
      if (!selectedSpace) return;
      const newTaskData: any = {
        name: taskName,
        description: taskDescription,
        space_id: selectedSpace.id,
        folder_id: taskFolderId || (selectedFolder?.id) || undefined,
        list_id: taskListId || (selectedList?.id) || undefined,
        status: taskStatus,
        priority: taskPriority,
        due_date: taskDueDate,
        assignee_name: taskAssignee
      };
      // Add sprint_id if creating from sprint view
      if (selectedSprint) {
        newTaskData.sprint_id = selectedSprint.id;
      }
      createTaskMutation.mutate(newTaskData);
    }
  };

  // Inline add task - supports both status and assignee grouping
  const handleInlineAddTask = async (groupKey: string) => {
    if (!inlineTaskName.trim() || !selectedSpace) return;

    const taskData: {
      name: string;
      space_id: string;
      folder_id?: string;
      list_id?: string;
      status: TaskStatus;
      priority: TaskPriority;
      assignee_name?: string;
      sprint_id?: string;
    } = {
      name: inlineTaskName,
      space_id: selectedSpace.id,
      folder_id: selectedFolder?.id,
      list_id: selectedList?.id,
      status: 'To Do' as TaskStatus,
      priority: 'MEDIUM'
    };

    if (groupBy === 'status') {
      taskData.status = groupKey as TaskStatus;
    } else if (groupBy === 'assignee' && groupKey !== 'Unassigned') {
      taskData.assignee_name = groupKey;
    }

    // When in sprint view, auto-assign the new task to the sprint
    if (selectedSprint) {
      taskData.sprint_id = selectedSprint.id;
    }

    createTaskMutation.mutate(taskData);

    setInlineTaskName('');
    setInlineAddGroup(null);
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const toggleSprintFolder = (folderId: string) => {
    setExpandedSprintFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const getSprintStatus = (sprint: Sprint): 'not_started' | 'in_progress' | 'done' => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(sprint.start_date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(sprint.end_date);
    end.setHours(0, 0, 0, 0);
    if (today < start) return 'not_started';
    if (today > end) return 'done';
    return 'in_progress';
  };

  const getSprintStatusLabel = (status: 'not_started' | 'in_progress' | 'done') => {
    switch (status) {
      case 'not_started': return 'Not Started';
      case 'in_progress': return 'In Progress';
      case 'done': return 'Done';
    }
  };

  const getSprintStatusColor = (status: 'not_started' | 'in_progress' | 'done') => {
    switch (status) {
      case 'not_started': return '#6b7280';
      case 'in_progress': return '#3b82f6';
      case 'done': return '#22c55e';
    }
  };

  const openEditSpace = (space: Space) => {
    if (!canEdit) { toast.error('View only — you do not have edit permissions'); return; }
    setEditingSpace(space);
    setSpaceName(space.name);
    setSpaceDescription(space.description || '');
    setSpaceColor(space.color);
    setShowSpaceModal(true);
  };

  const openEditTask = (task: Task) => {
    // Use the new task detail panel instead of modal
    setSelectedTaskForPanel(task);
    setShowTaskPanel(true);
  };

  const closeTaskPanel = () => {
    setShowTaskPanel(false);
    setSelectedTaskForPanel(null);
  };

  // Keep selectedTaskForPanel in sync with latest query data
  useEffect(() => {
    if (selectedTaskForPanel) {
      const updated = tasks.find(t => t.id === selectedTaskForPanel.id);
      if (updated && updated !== selectedTaskForPanel) {
        setSelectedTaskForPanel(updated);
      }
    }
  }, [tasks, selectedTaskForPanel]);

  const openAddTask = (status: TaskStatus = 'To Do', folderId?: string, listId?: string) => {
    if (!canEdit) { toast.error('View only — you do not have edit permissions'); return; }
    resetTaskForm();
    setTaskStatus(status);
    // Set list_id if provided or use selected list
    if (listId) {
      setTaskListId(listId);
    } else if (selectedList) {
      setTaskListId(selectedList.id);
    }
    // Set folder_id for legacy support
    if (folderId) {
      setTaskFolderId(folderId);
    } else if (selectedFolder) {
      setTaskFolderId(selectedFolder.id);
    }
    setShowTaskModal(true);
  };

  const createInlineEmptyTask = () => {
    if (!canEdit) { toast.error('View only — you do not have edit permissions'); return; }
    if (!inlineEmptyTaskName.trim()) return;

    // Allow task creation for both lists and sprints
    if ((!selectedList && !selectedSprint) || !selectedSpace) return;

    const taskData: any = {
      name: inlineEmptyTaskName.trim(),
      description: '',
      status: 'To Do',
      priority: inlineEmptyPriority,
      due_date: inlineEmptyDueDate || undefined,
      assignees: inlineEmptyAssignees,
      assignee_name: inlineEmptyAssignees[0] || undefined,
      space_id: selectedSpace.id
    };

    // For list tasks
    if (selectedList) {
      taskData.list_id = selectedList.id;
      taskData.folder_id = selectedList.folder_id || selectedFolder?.id;
    }

    // For sprint tasks
    if (selectedSprint) {
      taskData.sprint_id = selectedSprint.id;
      taskData.folder_id = selectedSprint.folder_id || selectedFolder?.id;
    }

    createTaskMutation.mutate(taskData);
    setInlineEmptyTaskName('');
    setInlineEmptyAssignees([]);
    setInlineEmptyDueDate('');
    setInlineEmptyPriority('MEDIUM');
    setInlineEmptyAssigneeOpen(false);
    setInlineEmptyDateOpen(false);
    setInlineEmptyPriorityOpen(false);
  };

  const getTaskSortValue = useCallback((task: Task, key: BaseFieldKey) => {
    switch (key) {
      case 'name':
        return task.name?.toLowerCase() || '';
      case 'assignee':
        return (task.assignees?.[0] || task.assignee_name || '').toLowerCase();
      case 'due_date':
        return task.due_date ? new Date(task.due_date).getTime() : 0;
      case 'priority': {
        const order = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];
        const idx = order.indexOf(task.priority || 'MEDIUM');
        return idx === -1 ? 999 : idx;
      }
      case 'status':
        return task.status?.toLowerCase() || '';
      default:
        return '';
    }
  }, []);

  // Filter items for selected space
  const spaceFolders = folders.filter(f => f.space_id === selectedSpace?.id);

  // Lists directly in the space (not in any folder)
  const spaceDirectLists = taskLists.filter(l => l.space_id === selectedSpace?.id && !l.folder_id);

  // All lists in the space (including folder lists)
  const spaceAllLists = taskLists.filter(l => l.space_id === selectedSpace?.id);

  // All sprints in the space
  const spaceSprints = sprints.filter(s => s.space_id === selectedSpace?.id);

  // Get lists for a specific folder
  const getListsForFolder = (folderId: string) => taskLists.filter(l => l.folder_id === folderId);

  // Get lists for the selected folder (memoized)
  const folderLists = useMemo(() => {
    if (!selectedFolder) return [];
    return taskLists.filter(l => l.folder_id === selectedFolder.id);
  }, [selectedFolder, taskLists]);

  // Get task count for a list
  const getListTaskCount = (listId: string) => tasks.filter(t => t.list_id === listId).length;

  const getListCompletedCount = (listId: string) =>
    tasks.filter(t => t.list_id === listId).filter(t => {
      const status = (t.status || '').toLowerCase();
      return status === 'done' || status === 'completed' || status === 'complete' || status === 'closed';
    }).length;

  const renderMiniAssignees = (task: Task) => {
    const names = (task.assignees && task.assignees.length > 0)
      ? task.assignees
      : task.assignee_name ? [task.assignee_name] : [];
    if (names.length === 0) {
      return <span className="text-xs text-gray-500 dark:text-slate-500">—</span>;
    }
    return (
      <div className="flex -space-x-1 justify-center">
        {names.slice(0, 3).map((assigneeName, idx) => (
          <div
            key={`${task.id}-assignee-${idx}`}
            className="w-5 h-5 rounded-full border border-gray-900 dark:border-[#0f1012] flex items-center justify-center text-[9px] text-white font-medium"
            style={{ backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#3b82f6', '#22c55e', '#f97316'][assigneeName.charCodeAt(0) % 6] }}
            title={assigneeName}
          >
            {assigneeName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
        ))}
        {names.length > 3 && (
          <div className="w-5 h-5 rounded-full border border-gray-900 dark:border-[#0f1012] bg-slate-700 text-[9px] text-white font-medium flex items-center justify-center">
            +{names.length - 3}
          </div>
        )}
      </div>
    );
  };

  const getStatusGroupsForList = (listId: string) => {
    // When sprint is selected, only show tasks from that sprint
    let listTasks = tasks.filter(t => t.list_id === listId);
    if (selectedSprint) {
      listTasks = listTasks.filter(t => t.sprint_id === selectedSprint.id);
    }
    const groups = new Map<string, Task[]>();
    listTasks.forEach(task => {
      const key = (task.status || 'TO DO').toString();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(task);
    });
    return Array.from(groups.entries()).map(([status, items]) => ({ status, items }));
  };

  // Get tasks for a specific list
  const getTasksForList = (listId: string) => {
    let listTasks = tasks.filter(t => t.list_id === listId);
    // When sprint is selected, only show tasks from that sprint
    if (selectedSprint) {
      listTasks = listTasks.filter(t => t.sprint_id === selectedSprint.id);
    }
    return listTasks;
  };

  const spaceTasks = useMemo(() => {
    let filtered = tasks.filter(t => t.space_id === selectedSpace?.id);

    // Filter by list if one is selected
    if (selectedList) {
      filtered = filtered.filter(t => t.list_id === selectedList.id);
    }
    // Filter by folder if one is selected - get all tasks in lists that belong to this folder
    else if (selectedFolder) {
      const folderListIds = new Set(taskLists.filter(l => l.folder_id === selectedFolder.id).map(l => l.id));
      filtered = filtered.filter(t => t.list_id && folderListIds.has(t.list_id) || t.folder_id === selectedFolder.id);
    }

    return filtered;
  }, [tasks, selectedSpace?.id, selectedFolder, selectedList, taskLists]);

  // Apply search and filters
  const filteredTasks = useMemo(() => {
    let filtered = showEverything ? tasks : spaceTasks;

    // Sprint filter - when a sprint is selected, show only sprint tasks
    if (selectedSprint) {
      filtered = filtered.filter(t => t.sprint_id === selectedSprint.id);
    }

    // For guests/limited members, filter to only show tasks from accessible spaces
    if (needsSpaceAccess) {
      const accessibleSpaceIds = new Set(memberSpaceAccess.map((sa: { space_id: string }) => sa.space_id));
      filtered = filtered.filter(t => accessibleSpaceIds.has(t.space_id));
    }

    // Search filter - searches name, description, assignees, and tags
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.assignees?.some(a => a.toLowerCase().includes(query)) ||
        t.assignee_name?.toLowerCase().includes(query) ||
        t.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Status filter
    if (activeFilters.status.length > 0) {
      filtered = filtered.filter(t => activeFilters.status.includes(t.status));
    }

    // Priority filter
    if (activeFilters.priority.length > 0) {
      filtered = filtered.filter(t => activeFilters.priority.includes(t.priority));
    }

    // Assignee filter (check both assignees array and legacy assignee_name)
    if (activeFilters.assignee.length > 0) {
      filtered = filtered.filter(t => {
        // Check assignees array first
        if (t.assignees && t.assignees.length > 0) {
          return t.assignees.some(a => activeFilters.assignee.includes(a));
        }
        // Fall back to legacy assignee_name
        return t.assignee_name && activeFilters.assignee.includes(t.assignee_name);
      });
    }

    // Due date filter (using date range from calendar)
    if (filterStartDate || filterEndDate) {
      filtered = filtered.filter(t => {
        if (!t.due_date) return false;

        const dueDate = new Date(t.due_date);
        dueDate.setHours(0, 0, 0, 0);

        if (filterStartDate && filterEndDate) {
          const start = new Date(filterStartDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(filterEndDate);
          end.setHours(23, 59, 59, 999);
          return dueDate >= start && dueDate <= end;
        } else if (filterStartDate) {
          const start = new Date(filterStartDate);
          start.setHours(0, 0, 0, 0);
          return dueDate >= start;
        } else if (filterEndDate) {
          const end = new Date(filterEndDate);
          end.setHours(23, 59, 59, 999);
          return dueDate <= end;
        }

        return true;
      });
    }

    // Custom field filters
    const activeCustomFieldFilters = Object.entries(activeFilters.customFields).filter(([_, values]) => values.length > 0);
    if (activeCustomFieldFilters.length > 0) {
      filtered = filtered.filter(t => {
        return activeCustomFieldFilters.every(([fieldId, filterValues]) => {
          const fv = fieldValueMap[t.id]?.[fieldId];
          if (!fv) return false;
          const field = orderedCustomFields.find(f => f.id === fieldId);
          if (!field) return false;

          if (field.type === 'dropdown') {
            return filterValues.includes(fv.value_json);
          } else if (field.type === 'labels' || field.type === 'people') {
            const vals = fv.value_json;
            if (Array.isArray(vals)) {
              return vals.some((v: string) => filterValues.includes(v));
            }
            return false;
          } else if (field.type === 'checkbox') {
            const val = fv.value_boolean ? 'true' : 'false';
            return filterValues.includes(val);
          } else {
            const val = fv.value_text || fv.value_number?.toString() || '';
            return filterValues.includes(val);
          }
        });
      });
    }

    // Hide completed/closed tasks when toggle is off
    if (!showClosedTasks) {
      filtered = filtered.filter(t =>
        t.status !== 'Done' &&
        t.status !== 'Completed' &&
        t.status !== 'Closed' &&
        t.status !== 'Archived'
      );
    }

    if (sortBy) {
      const sorted = [...filtered].sort((a, b) => {
        const aVal = getTaskSortValue(a, sortBy);
        const bVal = getTaskSortValue(b, sortBy);
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
      filtered = sorted;
    }

    return filtered;
  }, [showEverything, tasks, spaceTasks, searchQuery, activeFilters, showClosedTasks, filterStartDate, filterEndDate, needsSpaceAccess, memberSpaceAccess, selectedSprint, sortBy, sortOrder, getTaskSortValue, fieldValueMap, orderedCustomFields]);

  // Get unique assignees (from both assignees array and legacy assignee_name)
  const uniqueAssignees = useMemo(() => {
    const assigneesSet = new Set<string>();
    tasks.forEach(t => {
      // Add from assignees array
      if (t.assignees && t.assignees.length > 0) {
        t.assignees.forEach(a => assigneesSet.add(a));
      }
      // Also add legacy assignee_name
      if (t.assignee_name) assigneesSet.add(t.assignee_name);
    });
    return Array.from(assigneesSet);
  }, [tasks]);

  // Group tasks dynamically
  const groupedTasks = useMemo(() => {
    const groups: Record<string, { name: string; color: string; tasks: Task[] }> = {};

    // Empty state for both lists and sprints
    if ((selectedList || selectedSprint) && filteredTasks.length === 0) {
      return groups;
    }

    if (groupBy === 'status') {
      // First, add groups for all configured statuses
      statuses.forEach(status => {
        groups[status.name] = {
          name: status.name,
          color: status.bgColor,
          tasks: filteredTasks.filter(t => t.status === status.name)
        };
      });

      // Then, find tasks with statuses not in the configured list and add them as separate groups
      const configuredStatusNames = new Set(statuses.map(s => s.name));
      const unconfiguredStatuses = new Map<string, Task[]>();

      filteredTasks.forEach(task => {
        if (task.status && !configuredStatusNames.has(task.status)) {
          if (!unconfiguredStatuses.has(task.status)) {
            unconfiguredStatuses.set(task.status, []);
          }
          unconfiguredStatuses.get(task.status)!.push(task);
        }
      });

      // Add unconfigured status groups
      unconfiguredStatuses.forEach((tasks, statusName) => {
        groups[statusName] = {
          name: statusName,
          color: '#6b7280', // Default gray color for unconfigured statuses
          tasks: tasks
        };
      });
    } else if (groupBy === 'priority') {
      priorities.forEach(p => {
        groups[p.value] = {
          name: p.label,
          color: p.flagColor,
          tasks: filteredTasks.filter(t => t.priority === p.value)
        };
      });
    } else if (groupBy === 'folder') {
      // Group by folder
      const noFolder: Task[] = [];
      const byFolder: Record<string, Task[]> = {};

      filteredTasks.forEach(t => {
        if (t.folder_id) {
          if (!byFolder[t.folder_id]) byFolder[t.folder_id] = [];
          byFolder[t.folder_id].push(t);
        } else {
          noFolder.push(t);
        }
      });

      spaceFolders.forEach(folder => {
        const folderTasks = byFolder[folder.id] || [];
        groups[folder.id] = { name: folder.name, color: '#6366f1', tasks: folderTasks };
      });

      if (noFolder.length > 0) {
        groups['no-folder'] = { name: 'No Folder', color: '#94a3b8', tasks: noFolder };
      }
    } else if (groupBy === 'assignee') {
      const unassigned: Task[] = [];
      const byAssignee: Record<string, Task[]> = {};

      filteredTasks.forEach(t => {
        // Check assignees array first (task appears in each assignee's group)
        if (t.assignees && t.assignees.length > 0) {
          t.assignees.forEach(assigneeName => {
            if (!byAssignee[assigneeName]) byAssignee[assigneeName] = [];
            byAssignee[assigneeName].push(t);
          });
        } else if (t.assignee_name) {
          // Fall back to legacy assignee_name
          if (!byAssignee[t.assignee_name]) byAssignee[t.assignee_name] = [];
          byAssignee[t.assignee_name].push(t);
        } else {
          unassigned.push(t);
        }
      });

      Object.keys(byAssignee).sort().forEach(name => {
        groups[name] = { name, color: '#6366f1', tasks: byAssignee[name] };
      });
      if (unassigned.length > 0) {
        groups['Unassigned'] = { name: 'Unassigned', color: '#94a3b8', tasks: unassigned };
      }
    } else if (groupBy === 'dueDate') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);

      groups['Overdue'] = { name: 'Overdue', color: '#ef4444', tasks: [] };
      groups['Today'] = { name: 'Today', color: '#f97316', tasks: [] };
      groups['Tomorrow'] = { name: 'Tomorrow', color: '#eab308', tasks: [] };
      groups['This Week'] = { name: 'This Week', color: '#22c55e', tasks: [] };
      groups['Later'] = { name: 'Later', color: '#3b82f6', tasks: [] };
      groups['No Date'] = { name: 'No Date', color: '#94a3b8', tasks: [] };

      filteredTasks.forEach(t => {
        if (!t.due_date) {
          groups['No Date'].tasks.push(t);
        } else {
          const dueDate = new Date(t.due_date);
          dueDate.setHours(0, 0, 0, 0);

          if (dueDate < today) {
            groups['Overdue'].tasks.push(t);
          } else if (dueDate.getTime() === today.getTime()) {
            groups['Today'].tasks.push(t);
          } else if (dueDate.getTime() === tomorrow.getTime()) {
            groups['Tomorrow'].tasks.push(t);
          } else if (dueDate < nextWeek) {
            groups['This Week'].tasks.push(t);
          } else {
            groups['Later'].tasks.push(t);
          }
        }
      });
    } else if (groupBy.startsWith('cf_')) {
      // Group by custom field
      const cfId = groupBy.replace('cf_', '');
      const field = orderedCustomFields.find(f => f.id === cfId);
      if (field) {
        const ungrouped: Task[] = [];

        if (field.type === 'dropdown' && field.type_config?.options) {
          // Pre-create groups for all dropdown options
          field.type_config.options.forEach((opt: any) => {
            groups[opt.id] = { name: opt.name, color: opt.color || '#6366f1', tasks: [] };
          });
          filteredTasks.forEach(t => {
            const fv = fieldValueMap[t.id]?.[cfId];
            const val = fv?.value_json;
            if (val && groups[val]) {
              groups[val].tasks.push(t);
            } else {
              ungrouped.push(t);
            }
          });
        } else if (field.type === 'labels' && field.type_config?.options) {
          field.type_config.options.forEach((opt: any) => {
            groups[opt.id] = { name: opt.name, color: opt.color || '#6366f1', tasks: [] };
          });
          filteredTasks.forEach(t => {
            const fv = fieldValueMap[t.id]?.[cfId];
            const vals = fv?.value_json;
            if (Array.isArray(vals) && vals.length > 0) {
              vals.forEach((v: string) => {
                if (groups[v]) groups[v].tasks.push(t);
              });
            } else {
              ungrouped.push(t);
            }
          });
        } else if (field.type === 'checkbox') {
          groups['checked'] = { name: 'Checked', color: '#22c55e', tasks: [] };
          groups['unchecked'] = { name: 'Unchecked', color: '#6b7280', tasks: [] };
          filteredTasks.forEach(t => {
            const fv = fieldValueMap[t.id]?.[cfId];
            if (fv?.value_boolean) {
              groups['checked'].tasks.push(t);
            } else {
              groups['unchecked'].tasks.push(t);
            }
          });
        } else if (field.type === 'people') {
          filteredTasks.forEach(t => {
            const fv = fieldValueMap[t.id]?.[cfId];
            const vals = fv?.value_json;
            if (Array.isArray(vals) && vals.length > 0) {
              vals.forEach((v: string) => {
                if (!groups[v]) groups[v] = { name: v, color: '#6366f1', tasks: [] };
                groups[v].tasks.push(t);
              });
            } else {
              ungrouped.push(t);
            }
          });
        } else {
          // Generic grouping by text/number value
          filteredTasks.forEach(t => {
            const fv = fieldValueMap[t.id]?.[cfId];
            const val = fv?.value_text || fv?.value_number?.toString() || '';
            if (val) {
              if (!groups[val]) groups[val] = { name: val, color: '#6366f1', tasks: [] };
              groups[val].tasks.push(t);
            } else {
              ungrouped.push(t);
            }
          });
        }

        if (ungrouped.length > 0) {
          groups['_ungrouped'] = { name: 'No Value', color: '#94a3b8', tasks: ungrouped };
        }
      } else {
        groups['All Tasks'] = { name: 'All Tasks', color: '#6366f1', tasks: filteredTasks };
      }
    } else {
      groups['All Tasks'] = { name: 'All Tasks', color: '#6366f1', tasks: filteredTasks };
    }

    if (groupBy === 'status' && !effectiveListViewSettings.show_empty_statuses) {
      Object.keys(groups).forEach(key => {
        if (groups[key].tasks.length === 0) {
          delete groups[key];
        }
      });
    }

    // Sort tasks within each group by position
    Object.values(groups).forEach(group => {
      group.tasks.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    });

    return groups;
  }, [filteredTasks, groupBy, spaceFolders, effectiveListViewSettings.show_empty_statuses, fieldValueMap, orderedCustomFields]);

  const selectedListTaskCount = useMemo(() => {
    if (!selectedList) return 0;
    return tasks.filter(t => t.list_id === selectedList.id).length;
  }, [tasks, selectedList]);

  const selectedSprintTaskCount = useMemo(() => {
    if (!selectedSprint) return 0;
    return tasks.filter(t => t.sprint_id === selectedSprint.id).length;
  }, [tasks, selectedSprint]);

  const showSpaceListOverview = !!selectedSpace && !selectedFolder && !selectedList && !showEverything && !selectedSprint;

  // Calculate stats for the banner and cards
  const stats = useMemo(() => {
    const currentTasks = showEverything ? tasks : spaceTasks;
    const unfinishedTasks = currentTasks.filter(t => t.status !== 'Done');
    // Check both assignees array and legacy assignee_name
    const tasksWithoutAssignee = currentTasks.filter(t =>
      (!t.assignees || t.assignees.length === 0) && !t.assignee_name
    );
    const tasksWithoutEffort = currentTasks.filter(t => !t.estimated_hours);

    return {
      total: currentTasks.length,
      unfinished: unfinishedTasks.length,
      missingAssignee: tasksWithoutAssignee.length,
      missingEffort: tasksWithoutEffort.length,
    };
  }, [tasks, spaceTasks, showEverything]);

  const baseFieldItems = useMemo(() => ([
    { key: 'name' as BaseFieldKey, label: 'Task Name', locked: true },
    { key: 'assignee' as BaseFieldKey, label: 'Assignee' },
    { key: 'due_date' as BaseFieldKey, label: 'Due date' },
    { key: 'priority' as BaseFieldKey, label: 'Priority' },
    { key: 'status' as BaseFieldKey, label: 'Status' }
  ]), []);

  const baseFieldOrder = useMemo((): BaseFieldKey[] => {
    const stored = effectiveListViewSettings.base_fields_order || [];
    const order = stored.length > 0 ? stored : (DEFAULT_LIST_VIEW_SETTINGS.base_fields_order || []);
    const normalized = order.filter(key => baseFieldItems.some(item => item.key === key)) as BaseFieldKey[];
    if (!normalized.includes('name')) normalized.unshift('name');
    return normalized;
  }, [effectiveListViewSettings.base_fields_order, baseFieldItems]);

  const orderedBaseFields = useMemo(() => {
    const map = new Map(baseFieldItems.map(item => [item.key, item]));
    return baseFieldOrder.map(key => map.get(key)).filter(Boolean) as { key: BaseFieldKey; label: string; locked?: boolean }[];
  }, [baseFieldItems, baseFieldOrder]);

  const filteredBaseFields = useMemo(() => {
    const q = viewPanelSearch.trim().toLowerCase();
    if (!q) return orderedBaseFields;
    return orderedBaseFields.filter(item => item.label.toLowerCase().includes(q));
  }, [orderedBaseFields, viewPanelSearch]);

  const filteredCustomFieldsForPanel = useMemo(() => {
    const q = viewPanelSearch.trim().toLowerCase();
    if (!q) return customFields;
    return customFields.filter(field => field.name.toLowerCase().includes(q));
  }, [customFields, viewPanelSearch]);

  // Unified column order combining base fields and custom fields
  // MUST be defined before moveCustomField and moveBaseField that use it
  const SPRINT_FIELD_IDS = ['sprint_points', 'sprints'] as const;

  const allColumnIds = useMemo(() => {
    let ids: string[];
    // If we have a unified order saved, use it (allows mixing base and custom fields)
    if (effectiveListViewSettings.unified_column_order && effectiveListViewSettings.unified_column_order.length > 0) {
      // Filter to only include valid columns (base fields that are visible + custom fields + sprint fields)
      ids = effectiveListViewSettings.unified_column_order.filter(id => {
        // Check if it's a base field
        if (['name', 'assignee', 'due_date', 'priority', 'status'].includes(id)) {
          return true; // Always include base fields in the order
        }
        // Check if it's a sprint field
        if ((SPRINT_FIELD_IDS as readonly string[]).includes(id)) {
          return !!selectedSprint; // Only include sprint fields when sprint is selected
        }
        // Check if it's a valid custom field (and visible)
        return orderedCustomFields.some(f => f.id === id);
      });
      // Append any NEW custom fields not yet in the saved order
      for (const field of orderedCustomFields) {
        if (!ids.includes(field.id)) {
          ids.push(field.id);
        }
      }
    } else {
      // Fallback to old behavior: base fields first, then custom fields
      ids = [...baseFieldOrder, ...orderedCustomFields.map(f => f.id)];
    }
    // Ensure sprint fields are present when a sprint is selected
    if (selectedSprint) {
      if (!ids.includes('sprint_points')) ids.push('sprint_points');
      if (!ids.includes('sprints')) ids.push('sprints');
    }
    return ids;
  }, [baseFieldOrder, orderedCustomFields, effectiveListViewSettings.unified_column_order, selectedSprint]);

  const moveCustomField = useCallback((fieldId: string, direction: 'left' | 'right' | 'start' | 'end') => {
    // Work with unified order
    const current = [...allColumnIds];
    const index = current.indexOf(fieldId);
    if (index === -1) return;

    let nextOrder: string[];

    if (direction === 'start') {
      // Move to beginning (after 'name')
      nextOrder = current.filter(id => id !== fieldId);
      const nameIdx = nextOrder.indexOf('name');
      nextOrder.splice(nameIdx + 1, 0, fieldId);
    } else if (direction === 'end') {
      // Move to end
      nextOrder = [...current.filter(id => id !== fieldId), fieldId];
    } else {
      // Swap with adjacent (left or right)
      const swapWith = direction === 'left' ? index - 1 : index + 1;
      if (swapWith < 0 || swapWith >= current.length) return;
      nextOrder = [...current];
      [nextOrder[index], nextOrder[swapWith]] = [nextOrder[swapWith], nextOrder[index]];
    }

    applyListViewSettings({ unified_column_order: nextOrder });
  }, [allColumnIds, applyListViewSettings]);

  // Handle drag start for columns
  const handleColumnDragStart = useCallback((event: DragStartEvent) => {
    setActiveColumnId(event.active.id as string);
  }, []);

  // Handle drag-and-drop for ALL columns (base + custom fields mixed)
  const handleUnifiedColumnDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    console.log('🎯 Drag end:', { activeId: active.id, overId: over?.id });

    if (!over || active.id === over.id) {
      setActiveColumnId(null);
      return;
    }

    // Don't allow moving 'name' column
    if (active.id === 'name' || over.id === 'name') {
      console.log('⛔ Cannot move NAME column');
      setActiveColumnId(null);
      return;
    }

    const oldIndex = allColumnIds.indexOf(active.id as string);
    const newIndex = allColumnIds.indexOf(over.id as string);

    console.log('📊 Moving from index', oldIndex, 'to', newIndex);

    if (oldIndex === -1 || newIndex === -1) {
      console.log('❌ Invalid index');
      setActiveColumnId(null);
      return;
    }

    const nextOrder = arrayMove(allColumnIds, oldIndex, newIndex);

    console.log('🔄 Old order:', allColumnIds);
    console.log('🔄 New order:', nextOrder);

    // Save the unified order (allows mixing base and custom fields)
    applyListViewSettings({
      unified_column_order: nextOrder as string[]
    });

    setActiveColumnId(null);
  }, [allColumnIds, applyListViewSettings]);

  // Handle task row drag start
  const handleTaskDragStart = useCallback((event: DragStartEvent) => {
    if (!canEdit) return;
    const taskId = event.active.id as string;
    const allTasks = queryClient.getQueryData<Task[]>(['tasks', selectedSpace?.id]) || [];
    const task = allTasks.find(t => t.id === taskId);
    if (task) setActiveDragTask(task);
  }, [canEdit, queryClient, selectedSpace?.id]);

  // Handle task row drag end - reorder within group
  const handleTaskDragEnd = useCallback((event: DragEndEvent, groupTasks: Task[], groupKey: string) => {
    const { active, over } = event;
    setActiveDragTask(null);

    if (!canEdit || !over || active.id === over.id) return;

    const oldIndex = groupTasks.findIndex(t => t.id === active.id);
    const newIndex = groupTasks.findIndex(t => t.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(groupTasks, oldIndex, newIndex);

    // Optimistically update the cache
    queryClient.setQueryData(['tasks', selectedSpace?.id], (old: Task[] | undefined) => {
      if (!old) return old;
      return old.map(t => {
        const newPos = reordered.findIndex(rt => rt.id === t.id);
        if (newPos !== -1) {
          return { ...t, position: newPos };
        }
        return t;
      });
    });

    // Persist position updates for all reordered tasks
    reordered.forEach((task, idx) => {
      if (task.position !== idx) {
        tasksApi.update(task.id, { position: idx });
      }
    });
  }, [canEdit, queryClient, selectedSpace?.id]);

  const moveBaseField = useCallback((fieldKey: BaseFieldKey, position: 'start' | 'end') => {
    if (fieldKey === 'name') return;

    // Work with unified order
    const current = [...allColumnIds];
    const idx = current.indexOf(fieldKey);
    if (idx === -1) return;

    // Remove from current position
    current.splice(idx, 1);

    // Insert at new position (after 'name' for start, at end for end)
    if (position === 'start') {
      const nameIdx = current.indexOf('name');
      current.splice(nameIdx + 1, 0, fieldKey);
    } else {
      current.push(fieldKey);
    }

    applyListViewSettings({ unified_column_order: current });
  }, [allColumnIds, applyListViewSettings]);

  const toggleBaseColumnVisibility = useCallback((slotKey: BaseFieldKey) => {
    if (slotKey === 'name') return;
    if (slotKey === 'assignee') {
      const key = groupBy === 'assignee' ? 'status' : 'assignee';
      applyListViewSettings({ fields: { ...effectiveListViewSettings.fields, [key]: !effectiveListViewSettings.fields[key] } });
      return;
    }
    applyListViewSettings({ fields: { ...effectiveListViewSettings.fields, [slotKey]: !effectiveListViewSettings.fields[slotKey] } });
  }, [applyListViewSettings, effectiveListViewSettings.fields, groupBy]);

  const setColumnSort = useCallback((key: BaseFieldKey, order?: 'asc' | 'desc') => {
    if (sortBy === key) {
      setSortOrder(order || (sortOrder === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortOrder(order || 'asc');
    }
  }, [sortBy, sortOrder]);

  const setColumnGroup = useCallback((key: BaseFieldKey) => {
    const map: Record<BaseFieldKey, string | null> = {
      name: 'none',
      assignee: 'assignee',
      due_date: 'dueDate',
      priority: 'priority',
      status: 'status'
    };
    const groupKey = map[key];
    if (groupKey) setGroupBy(groupKey);
  }, []);

  // Get Lists (tasks grouped by folder for sidebar display)
  const getFolderLists = (folderId: string) => {
    return tasks.filter(t => t.folder_id === folderId);
  };

  // Toggle group expansion
  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupName]: prev[groupName] === false }));
  };

  const isGroupExpanded = (groupName: string) => {
    return expandedGroups[groupName] !== false;
  };

  const renderBaseHeaderCell = (slotKey: BaseFieldKey, index: number, total: number) => {
    const isName = slotKey === 'name';
    const columnKey: BaseFieldKey = slotKey === 'assignee'
      ? (groupBy === 'assignee' ? 'status' : 'assignee')
      : slotKey;

    if (isName && !effectiveListViewSettings.fields.name) return null;
    if (slotKey === 'assignee') {
      const shouldShow = groupBy === 'assignee'
        ? effectiveListViewSettings.fields.status
        : effectiveListViewSettings.fields.assignee;
      if (!shouldShow) return null;
    }
    if (slotKey === 'due_date' && !effectiveListViewSettings.fields.due_date) return null;
    if (slotKey === 'priority' && !effectiveListViewSettings.fields.priority) return null;
    if (slotKey === 'status' && !effectiveListViewSettings.fields.status) return null;

    const label = slotKey === 'status'
      ? 'Status'
      : slotKey === 'assignee'
        ? (groupBy === 'assignee' ? 'Status' : 'Assignee')
        : slotKey === 'due_date'
          ? 'Due date'
          : slotKey === 'priority'
            ? 'Priority'
            : 'Name';

    const widthClass = slotKey === 'name' ? 'flex-1 pl-8' : (slotKey === 'assignee' || slotKey === 'status') ? 'w-28 text-center' : 'w-24 text-center';

    const menuId = `base:${slotKey}`;
    const isMenuOpen = openColumnMenuId === menuId;
    const canMoveStart = slotKey !== 'name' && index > 1;
    const canMoveEnd = slotKey !== 'name' && index < total - 1;

    return (
      <div key={slotKey} className={`${widthClass} relative group`}>
        <div className={slotKey === 'name' ? "flex items-center gap-1" : "flex items-center justify-center gap-1"}>
          <span>{label}</span>
          {!isName && (
            <button
              data-column-menu-trigger
              onClick={(e) => {
                e.stopPropagation();
                setOpenColumnMenuId(isMenuOpen ? null : menuId);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-400 dark:text-slate-500"
            >
              <MoreHorizontal className="w-3 h-3" />
            </button>
          )}
        </div>

        {isMenuOpen && (
          <div
            data-column-menu
            className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { moveBaseField(slotKey, 'start'); setOpenColumnMenuId(null); }}
              disabled={!canMoveStart}
              className={cn(
                "w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-700",
                !canMoveStart && "opacity-50 cursor-not-allowed"
              )}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Move to start
            </button>
            <button
              onClick={() => { moveBaseField(slotKey, 'end'); setOpenColumnMenuId(null); }}
              disabled={!canMoveEnd}
              className={cn(
                "w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-700",
                !canMoveEnd && "opacity-50 cursor-not-allowed"
              )}
            >
              <ChevronRight className="w-3.5 h-3.5" />
              Move to end
            </button>
            <button
              onClick={() => { toggleBaseColumnVisibility(slotKey); setOpenColumnMenuId(null); }}
              className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              <Eye className="w-3.5 h-3.5" />
              Hide column
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderBaseRowCell = (slotKey: BaseFieldKey, task: Task, statusColor: string, priority: { value: TaskPriority; label: string; color: string; flagColor: string } | undefined, subtaskCount: number) => {
    if (slotKey === 'name') {
      if (!effectiveListViewSettings.fields.name) return null;
      const showInlineStatus = !effectiveListViewSettings.fields.status;
      return (
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <button
            onClick={(e) => e.stopPropagation()}
            className="p-0.5 text-gray-400 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white rounded opacity-0 group-hover:opacity-100"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {showInlineStatus && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const nextOpen = openStatusDropdownId === task.id ? null : task.id;
                setOpenStatusDropdownId(nextOpen);
                if (nextOpen) {
                  setInlineStatusInput(task.status || '');
                  setInlineStatusTaskId(task.id);
                } else {
                  setInlineStatusInput('');
                  setInlineStatusTaskId(null);
                }
              }}
              className="flex-shrink-0 hover:scale-125 transition-transform"
              data-status-dropdown
            >
              <Circle className="w-4 h-4" style={{ color: statusColor }} />
            </button>
          )}
          <span className="text-sm text-gray-900 dark:text-white truncate">{task.name}</span>
          {subtaskCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400 dark:text-slate-500 flex-shrink-0">
              <GitBranch className="w-3 h-3" />
              {subtaskCount}
            </span>
          )}
        </div>
      );
    }

    if (slotKey === 'assignee') {
      const shouldShow = groupBy === 'assignee'
        ? effectiveListViewSettings.fields.status
        : effectiveListViewSettings.fields.assignee;
      if (!shouldShow) return null;
      return (
        <div className="w-28 flex justify-center relative" data-assignee-picker>
          {groupBy === 'assignee' ? (
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
              style={{ backgroundColor: statusColor, color: 'white' }}
            >
              {task.status}
            </span>
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenAssigneePickerId(openAssigneePickerId === task.id ? null : task.id);
                  setAssigneeSearchQuery('');
                }}
                className="hover:ring-2 hover:ring-violet-500 rounded-full transition-all flex items-center"
              >
                {(task.assignees && task.assignees.length > 0) ? (
                  <div className="flex -space-x-2">
                    {task.assignees.slice(0, 3).map((assigneeName, idx) => (
                      <Avatar key={idx} className="w-7 h-7 border-2 border-[#1a1b23]">
                        <AvatarFallback
                          className="text-white text-[10px] font-semibold"
                          style={{
                            backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#3b82f6', '#22c55e', '#f97316'][assigneeName.charCodeAt(0) % 6]
                          }}
                        >
                          {assigneeName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {task.assignees.length > 3 && (
                      <div className="w-7 h-7 rounded-full bg-gray-300 dark:bg-[#15161a] border-2 border-gray-50 dark:border-[#0f1012] flex items-center justify-center">
                        <span className="text-[10px] text-gray-900 dark:text-white font-medium">+{task.assignees.length - 3}</span>
                      </div>
                    )}
                  </div>
                ) : task.assignee_name ? (
                  <Avatar className="w-7 h-7 border-2 border-[#1a1b23]">
                    <AvatarFallback
                      className="text-white text-[10px] font-semibold"
                      style={{
                        backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#3b82f6', '#22c55e', '#f97316'][task.assignee_name.charCodeAt(0) % 6]
                      }}
                    >
                      {task.assignee_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="w-7 h-7 rounded-full border border-dashed border-gray-300 dark:border-[#1f2229] flex items-center justify-center hover:border-violet-500">
                    <User className="w-3.5 h-3.5 text-gray-400 dark:text-slate-600" />
                  </div>
                )}
              </button>

              {openAssigneePickerId === task.id && (
                <div
                  className="absolute top-full right-0 mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-xl shadow-2xl z-50 w-64 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-2 border-b border-gray-200 dark:border-[#1f2229]">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                      <input
                        type="text"
                        value={assigneeSearchQuery}
                        onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="w-full pl-8 pr-2 py-1.5 bg-gray-100 dark:bg-[#2e2f3a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-xs text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto py-1">
                    {(task.assignees && task.assignees.length > 0) && (
                      <button
                        onClick={() => {
                          updateTaskMutation.mutate({ id: task.id, data: { assignees: [], assignee_name: null } });
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors border-b border-gray-200 dark:border-[#1f2229]"
                      >
                        <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
                          <X className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                        </div>
                        <span className="text-gray-500 dark:text-gray-400">Clear all assignees</span>
                      </button>
                    )}

                    {availableMembers
                      .filter((m: Member) =>
                        m.name.toLowerCase().includes(assigneeSearchQuery.toLowerCase()) ||
                        m.email.toLowerCase().includes(assigneeSearchQuery.toLowerCase())
                      )
                      .map((member: Member) => {
                        const currentAssignees = task.assignees || [];
                        const isSelected = currentAssignees.includes(member.name);
                        const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#3b82f6', '#22c55e', '#f97316'];
                        const colorIndex = member.name.charCodeAt(0) % colors.length;

                        return (
                          <button
                            key={member.id}
                            onClick={() => {
                              const newAssignees = isSelected
                                ? currentAssignees.filter(a => a !== member.name)
                                : [...currentAssignees, member.name];
                              updateTaskMutation.mutate({
                                id: task.id,
                                data: {
                                  assignees: newAssignees,
                                  assignee_name: newAssignees.length > 0 ? newAssignees[0] : null
                                }
                              });
                            }}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors",
                              isSelected ? "bg-violet-500/20" : "hover:bg-gray-100 dark:hover:bg-slate-700"
                            )}
                          >
                            <div className={cn(
                              "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                              isSelected ? "bg-violet-500 border-violet-500" : "border-gray-300 dark:border-slate-500"
                            )}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <Avatar className="w-6 h-6">
                              <AvatarFallback
                                className="text-white text-[9px] font-bold"
                                style={{ backgroundColor: colors[colorIndex] }}
                              >
                                {member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 text-left truncate">
                              <span className={isSelected ? "text-violet-300" : "text-gray-900 dark:text-white"}>{member.name}</span>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      );
    }

    if (slotKey === 'due_date') {
      if (!effectiveListViewSettings.fields.due_date) return null;
      return (
        <div className="w-24 flex justify-center relative" data-date-picker>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpenDatePickerId(openDatePickerId === task.id ? null : task.id);
              setDatePickerMonth(task.due_date ? new Date(task.due_date) : new Date());
            }}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            {task.due_date ? (
              <span className={cn(
                "text-sm",
                isOverdue(task.due_date) && task.status !== 'Done' ? "text-red-400" : "text-pink-400"
              )}>
                {formatDate(task.due_date)}
              </span>
            ) : (
              <Calendar className="w-4 h-4 text-gray-400 dark:text-slate-600" />
            )}
          </button>

          {openDatePickerId === task.id && (
            <div
              className="absolute top-full right-0 mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-xl shadow-2xl z-50 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex">
                <div className="w-36 border-r border-gray-200 dark:border-[#1f2229] py-2">
                  {[
                    { label: 'Today', days: 0 },
                    { label: 'Tomorrow', days: 1 },
                    { label: 'This weekend', days: (() => { const d = new Date(); return 6 - d.getDay(); })() },
                    { label: 'Next week', days: 7 },
                    { label: '2 weeks', days: 14 },
                    { label: '4 weeks', days: 28 },
                  ].map((option) => {
                    const targetDate = new Date();
                    targetDate.setDate(targetDate.getDate() + option.days);
                    const dateStr = targetDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

                    return (
                      <button
                        key={option.label}
                        onClick={() => {
                          updateTaskMutation.mutate({
                            id: task.id,
                            data: { due_date: targetDate.toISOString().split('T')[0] }
                          });
                          setOpenDatePickerId(null);
                        }}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <span>{option.label}</span>
                        <span className="text-gray-400 dark:text-slate-500">{dateStr}</span>
                      </button>
                    );
                  })}
                  {task.due_date && (
                    <button
                      onClick={() => {
                        updateTaskMutation.mutate({ id: task.id, data: { due_date: undefined } });
                        setOpenDatePickerId(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors border-t border-gray-200 dark:border-[#1f2229] mt-1"
                    >
                      <X className="w-3 h-3" />
                      Clear date
                    </button>
                  )}
                </div>

                <div className="p-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-900 dark:text-white">
                      {datePickerMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setDatePickerMonth(new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() - 1))}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-slate-400"
                      >
                        <ChevronRight className="w-3 h-3 rotate-180" />
                      </button>
                      <button
                        onClick={() => setDatePickerMonth(new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() + 1))}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-slate-400"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-0.5 mb-1">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                      <div key={day} className="w-6 h-5 flex items-center justify-center text-[10px] text-gray-400 dark:text-slate-500">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-0.5">
                    {(() => {
                      const year = datePickerMonth.getFullYear();
                      const month = datePickerMonth.getMonth();
                      const firstDay = new Date(year, month, 1).getDay();
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const selectedDate = task.due_date ? new Date(task.due_date) : null;
                      if (selectedDate) selectedDate.setHours(0, 0, 0, 0);

                      const days = [];
                      for (let i = 0; i < firstDay; i++) {
                        days.push(<div key={`empty-${i}`} className="w-6 h-6" />);
                      }
                      for (let day = 1; day <= daysInMonth; day++) {
                        const date = new Date(year, month, day);
                        const isToday = date.getTime() === today.getTime();
                        const isSelected = selectedDate && date.getTime() === selectedDate.getTime();

                        days.push(
                          <button
                            key={day}
                            onClick={() => {
                              updateTaskMutation.mutate({
                                id: task.id,
                                data: { due_date: date.toISOString().split('T')[0] }
                              });
                              setOpenDatePickerId(null);
                            }}
                            className={cn(
                              "w-6 h-6 flex items-center justify-center text-[10px] rounded transition-colors",
                              isSelected
                                ? "bg-violet-500 text-white"
                                : isToday
                                ? "bg-red-500 text-white"
                                : "text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-700"
                            )}
                          >
                            {day}
                          </button>
                        );
                      }
                      return days;
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (slotKey === 'priority') {
      if (!effectiveListViewSettings.fields.priority) return null;
      return (
        <div className="w-24 flex items-center justify-center relative" data-priority-dropdown>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpenPriorityDropdownId(openPriorityDropdownId === task.id ? null : task.id);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            {priority && priority.value === 'URGENT' ? (
              <>
                <Flag className="w-4 h-4 text-red-500" fill="#ef4444" />
                <span className="text-xs text-red-500">{priority.label}</span>
              </>
            ) : priority && priority.value === 'HIGH' ? (
              <>
                <Flag className="w-4 h-4 text-orange-500" fill="#f97316" />
              </>
            ) : (
              <Flag
                className="w-4 h-4"
                style={{ color: priority?.flagColor || '#9ca3af' }}
              />
            )}
          </button>

          {openPriorityDropdownId === task.id && (
            <div
              className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-2 border-b border-gray-200 dark:border-[#1f2229]">
                <span className="text-xs text-gray-500 dark:text-slate-400">Task Priority</span>
              </div>
              <div className="py-1">
                {priorities.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => {
                      updateTaskMutation.mutate({ id: task.id, data: { priority: p.value } });
                      setOpenPriorityDropdownId(null);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors",
                      task.priority === p.value ? "bg-gray-100 dark:bg-[#15161a]" : ""
                    )}
                  >
                    <Flag
                      className="w-4 h-4"
                      style={{
                        color: p.value === 'URGENT' ? '#ef4444' : p.value === 'HIGH' ? '#f97316' : '#9ca3af'
                      }}
                      fill={p.value === 'URGENT' ? '#ef4444' : p.value === 'HIGH' ? '#f97316' : 'transparent'}
                    />
                    <span className="text-gray-500 dark:text-slate-400">{p.label}</span>
                    {task.priority === p.value && (
                      <Check className="w-4 h-4 ml-auto text-violet-400" />
                    )}
                  </button>
                ))}
                <button
                  onClick={() => {
                    updateTaskMutation.mutate({ id: task.id, data: { priority: 'MEDIUM' } });
                    setOpenPriorityDropdownId(null);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors border-t border-gray-200 dark:border-[#1f2229]"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Clear</span>
                </button>
              </div>
              <div className="border-t border-gray-200 dark:border-[#1f2229] px-3 py-2">
                <div className="text-xs text-gray-400 dark:text-slate-500 mb-2">Add to Personal Priorities</div>
                <div className="flex gap-1">
                  {['TC', 'CM', 'AK', 'AS'].map((initials, i) => (
                    <Avatar key={i} className="w-6 h-6 cursor-pointer hover:ring-2 hover:ring-violet-500">
                      <AvatarFallback
                        className="text-[10px] text-white"
                        style={{ backgroundColor: ['#0ea5e9', '#ec4899', '#8b5cf6', '#22c55e'][i] }}
                      >
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  <div className="w-6 h-6 rounded-full border border-dashed border-gray-300 dark:border-slate-500 flex items-center justify-center cursor-pointer hover:border-violet-400">
                    <User className="w-3 h-3 text-gray-400 dark:text-slate-500" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (slotKey === 'status') {
      if (!effectiveListViewSettings.fields.status) return null;
      // Use configured statuses, or fall back to defaults so users always have options
      const defaultStatusOptions: StatusConfig[] = [
        { name: 'TO DO', color: '#6b7280', bgColor: '#6b7280' },
        { name: 'IN PROGRESS', color: '#3b82f6', bgColor: '#3b82f6' },
        { name: 'REVIEW', color: '#f59e0b', bgColor: '#f59e0b' },
        { name: 'DONE', color: '#22c55e', bgColor: '#22c55e' }
      ];
      const statusOptions = statuses.length > 0 ? statuses : defaultStatusOptions;
      const currentStatus = statusOptions.find(s => s.name === task.status);
      return (
        <div className="w-28 flex items-center justify-center relative" data-status-dropdown>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const nextOpen = openStatusDropdownId === task.id ? null : task.id;
              setOpenStatusDropdownId(nextOpen);
              if (nextOpen) {
                setInlineStatusInput(task.status || '');
                setInlineStatusTaskId(task.id);
              } else {
                setInlineStatusInput('');
                setInlineStatusTaskId(null);
              }
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors max-w-full"
          >
            <Circle
              className="w-3 h-3 flex-shrink-0"
              style={{ color: currentStatus?.color || statusColor }}
              fill={currentStatus?.color || statusColor}
            />
            <span
              className="text-xs font-medium truncate"
              style={{ color: currentStatus?.color || statusColor }}
            >
              {task.status || 'No Status'}
            </span>
          </button>

          {openStatusDropdownId === task.id && (() => {
            const filteredBySearch = statusOptions.filter(s =>
              s.name.toLowerCase().includes(statusDropdownSearch.toLowerCase())
            );
            const filteredStatuses = statusDropdownTab === 'all'
              ? filteredBySearch
              : filteredBySearch.filter(s => categorizeStatus(s) === statusDropdownTab);

            const activeStatuses = filteredStatuses.filter(s => categorizeStatus(s) === 'active');
            const doneStatuses = filteredStatuses.filter(s => categorizeStatus(s) === 'done');
            const closedStatuses = filteredStatuses.filter(s => categorizeStatus(s) === 'closed');

            return (
            <div
              className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with title and ... menu */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-[#1f2229]">
                <span className="text-xs font-medium text-gray-500 dark:text-slate-400">Status</span>
                <div className="relative">
                  <button
                    onClick={() => setStatusDropdownMenuOpen(!statusDropdownMenuOpen)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
                  </button>
                  {statusDropdownMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-[#1e1f29] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-[60]">
                      <button
                        onClick={() => {
                          setStatusDropdownMenuOpen(false);
                          setOpenStatusDropdownId(null);
                          setStatusDropdownSearch('');
                          setStatusDropdownTab('all');
                          if (selectedList) {
                            openListTaskStatuses(selectedList);
                          } else if (selectedSprint) {
                            openSprintTaskStatuses(selectedSprint);
                          } else if (selectedFolder) {
                            openFolderTaskStatuses(selectedFolder);
                          } else if (selectedSpace) {
                            openSpaceTaskStatuses(selectedSpace);
                          }
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors rounded-lg"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit statuses
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Search */}
              <div className="px-3 py-2">
                <input
                  type="text"
                  value={statusDropdownSearch}
                  onChange={(e) => setStatusDropdownSearch(e.target.value)}
                  placeholder="Search statuses..."
                  className="w-full px-2.5 py-1.5 text-xs bg-gray-100 dark:bg-[#1a1b24] border border-gray-200 dark:border-[#1f2229] rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  autoFocus
                />
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-0.5 px-2 pb-1">
                {(['all', 'active', 'done', 'closed'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setStatusDropdownTab(tab)}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors capitalize",
                      statusDropdownTab === tab
                        ? "bg-violet-500/15 text-violet-400"
                        : "text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Status List */}
              <div className="py-1 max-h-60 overflow-y-auto">
                {statusDropdownTab === 'all' ? (
                  <>
                    {activeStatuses.length > 0 && (
                      <div>
                        <div className="px-3 py-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">Active</span>
                        </div>
                        {activeStatuses.map((s) => (
                          <button
                            key={s.name}
                            onClick={() => {
                              updateTaskMutation.mutate({ id: task.id, data: { status: s.name as any } });
                              setOpenStatusDropdownId(null);
                              setStatusDropdownSearch('');
                              setStatusDropdownTab('all');
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors",
                              task.status === s.name ? "bg-gray-50 dark:bg-[#15161a]" : ""
                            )}
                          >
                            <Circle className="w-3 h-3 flex-shrink-0" style={{ color: s.color }} fill={s.color} />
                            <span className="text-gray-700 dark:text-slate-300 text-xs">{s.name}</span>
                            {task.status === s.name && <Check className="w-3.5 h-3.5 ml-auto text-violet-400" />}
                          </button>
                        ))}
                      </div>
                    )}
                    {doneStatuses.length > 0 && (
                      <div>
                        <div className="px-3 py-1 mt-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-green-500 dark:text-green-400">Done</span>
                        </div>
                        {doneStatuses.map((s) => (
                          <button
                            key={s.name}
                            onClick={() => {
                              updateTaskMutation.mutate({ id: task.id, data: { status: s.name as any } });
                              setOpenStatusDropdownId(null);
                              setStatusDropdownSearch('');
                              setStatusDropdownTab('all');
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors",
                              task.status === s.name ? "bg-gray-50 dark:bg-[#15161a]" : ""
                            )}
                          >
                            <Circle className="w-3 h-3 flex-shrink-0" style={{ color: s.color }} fill={s.color} />
                            <span className="text-gray-700 dark:text-slate-300 text-xs">{s.name}</span>
                            {task.status === s.name && <Check className="w-3.5 h-3.5 ml-auto text-violet-400" />}
                          </button>
                        ))}
                      </div>
                    )}
                    {closedStatuses.length > 0 && (
                      <div>
                        <div className="px-3 py-1 mt-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">Closed</span>
                        </div>
                        {closedStatuses.map((s) => (
                          <button
                            key={s.name}
                            onClick={() => {
                              updateTaskMutation.mutate({ id: task.id, data: { status: s.name as any } });
                              setOpenStatusDropdownId(null);
                              setStatusDropdownSearch('');
                              setStatusDropdownTab('all');
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors",
                              task.status === s.name ? "bg-gray-50 dark:bg-[#15161a]" : ""
                            )}
                          >
                            <Circle className="w-3 h-3 flex-shrink-0" style={{ color: s.color }} fill={s.color} />
                            <span className="text-gray-700 dark:text-slate-300 text-xs">{s.name}</span>
                            {task.status === s.name && <Check className="w-3.5 h-3.5 ml-auto text-violet-400" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  filteredStatuses.map((s) => (
                    <button
                      key={s.name}
                      onClick={() => {
                        updateTaskMutation.mutate({ id: task.id, data: { status: s.name as any } });
                        setOpenStatusDropdownId(null);
                        setStatusDropdownSearch('');
                        setStatusDropdownTab('all');
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors",
                        task.status === s.name ? "bg-gray-50 dark:bg-[#15161a]" : ""
                      )}
                    >
                      <Circle className="w-3 h-3 flex-shrink-0" style={{ color: s.color }} fill={s.color} />
                      <span className="text-gray-700 dark:text-slate-300 text-xs">{s.name}</span>
                      {task.status === s.name && <Check className="w-3.5 h-3.5 ml-auto text-violet-400" />}
                    </button>
                  ))
                )}
                {filteredStatuses.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs text-gray-400 dark:text-slate-500">No statuses found</div>
                )}
              </div>
            </div>
            );
          })()}
        </div>
      );
    }

    return null;
  };

  // Toggle filter
  const toggleFilter = (filterType: 'status' | 'priority' | 'assignee' | 'dueDate' | 'tags', value: string) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterType]: prev[filterType].includes(value)
        ? prev[filterType].filter(v => v !== value)
        : [...prev[filterType], value]
    }));
  };

  // Toggle custom field filter
  const toggleCustomFieldFilter = (fieldId: string, value: string) => {
    setActiveFilters(prev => {
      const currentValues = prev.customFields[fieldId] || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      return {
        ...prev,
        customFields: { ...prev.customFields, [fieldId]: newValues }
      };
    });
  };

  const hasActiveFilters = activeFilters.status.length > 0 ||
    activeFilters.priority.length > 0 ||
    activeFilters.assignee.length > 0 ||
    activeFilters.tags.length > 0 ||
    Object.values(activeFilters.customFields).some(v => v.length > 0) ||
    filterStartDate !== '' ||
    filterEndDate !== '' ||
    searchQuery.trim() !== '';

  const clearAllFilters = () => {
    setActiveFilters({ status: [], priority: [], assignee: [], dueDate: [], tags: [], customFields: {} });
    setSearchQuery('');
    setAppliedFilterTypes([]);
    setSelectedFilterType(null);
    setFilterStartDate('');
    setFilterEndDate('');
  };

  // Add a filter type
  const addFilterType = (filterType: string) => {
    if (!appliedFilterTypes.includes(filterType)) {
      setAppliedFilterTypes([...appliedFilterTypes, filterType]);
    }
    setSelectedFilterType(filterType);
    setShowFilterDropdown(false);
    setFilterSearchQuery('');
  };

  // Remove a filter type
  const removeFilterType = (filterType: string) => {
    setAppliedFilterTypes(appliedFilterTypes.filter(f => f !== filterType));
    // Clear the filter values for this type
    if (filterType === 'status') {
      setActiveFilters(prev => ({ ...prev, status: [] }));
    } else if (filterType === 'priority') {
      setActiveFilters(prev => ({ ...prev, priority: [] }));
    } else if (filterType === 'assignee') {
      setActiveFilters(prev => ({ ...prev, assignee: [] }));
    } else if (filterType === 'dueDate') {
      setActiveFilters(prev => ({ ...prev, dueDate: [] }));
    } else if (filterType === 'tags') {
      setActiveFilters(prev => ({ ...prev, tags: [] }));
    } else if (filterType.startsWith('cf_')) {
      const fieldId = filterType.replace('cf_', '');
      setActiveFilters(prev => {
        const newCf = { ...prev.customFields };
        delete newCf[fieldId];
        return { ...prev, customFields: newCf };
      });
    }
    if (selectedFilterType === filterType) {
      setSelectedFilterType(null);
    }
  };

  // Build dynamic filter options: base + custom fields
  const filterOptions = useMemo(() => {
    const options = [...BASE_FILTER_OPTIONS];
    orderedCustomFields.forEach(field => {
      options.push({
        id: `cf_${field.id}`,
        label: field.name,
        icon: CUSTOM_FIELD_ICON_MAP[field.type] || SlidersHorizontal,
      });
    });
    return options;
  }, [orderedCustomFields]);

  // Build dynamic group by options: base + custom fields (dropdown, labels, people, checkbox)
  const groupByOptions = useMemo(() => {
    const options = [...BASE_GROUP_BY_OPTIONS];
    orderedCustomFields.forEach(field => {
      if (['dropdown', 'labels', 'people', 'checkbox'].includes(field.type)) {
        options.splice(options.length - 1, 0, {
          value: `cf_${field.id}`,
          label: field.name,
          icon: CUSTOM_FIELD_ICON_MAP[field.type] || SlidersHorizontal,
        });
      }
    });
    return options;
  }, [orderedCustomFields]);

  // Filter options based on search
  const filteredFilterOptions = filterOptions.filter(option =>
    option.label.toLowerCase().includes(filterSearchQuery.toLowerCase())
  );

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
  };

  const isOverdue = (dateStr: string) => {
    return new Date(dateStr) < new Date();
  };

  // Get folder name
  const getFolderName = (folderId: string | null) => {
    if (!folderId) return '';
    const folder = folders.find(f => f.id === folderId);
    return folder?.name || '';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1012] flex">
      {/* Sidebar */}
      <aside
        ref={secondarySidebarRef}
        style={{ width: currentSecondaryWidth }}
        className="bg-gray-50 dark:bg-[#0f1012] border-r border-gray-200 dark:border-[#1f2229] flex flex-col relative transition-[width] duration-150 ease-out"
      >
        <div className="px-3 py-3 border-b border-gray-200 dark:border-[#1f2229]">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1 min-w-0">
              {isSecondaryCollapsed && (
                <button
                  onClick={toggleSecondaryCollapse}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white flex-shrink-0"
                  title="Expand sidebar"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap overflow-hidden">Spaces</h2>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {!needsSpaceAccess && (
                <button
                  onClick={() => setShowSpaceModal(true)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                  title="Create Space"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
              {!isSecondaryCollapsed && (
                <button
                  onClick={toggleSecondaryCollapse}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                  title="Collapse sidebar"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Resize Handle */}
        <div
          onMouseDown={startSecondaryResize}
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize group hover:bg-violet-500 transition-colors z-10 ${
            isResizingSecondary ? 'bg-violet-500' : 'bg-transparent'
          }`}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -right-2 w-4 h-8 bg-gray-300 dark:bg-[#15161a] rounded-r flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="w-3 h-3 text-gray-500 dark:text-slate-400" />
          </div>
        </div>

        {/* Collapse button is now integrated into the header */}

        {/* Spaces List */}
        <div className={`flex-1 overflow-y-auto ${isSecondaryCollapsed ? 'p-1' : 'p-2'}`}>
          {/* Everything View - Only for non-guests/non-limited members */}
          {!needsSpaceAccess && (
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg cursor-pointer mb-2",
                isSecondaryCollapsed ? "px-2 py-2 justify-center" : "px-3 py-2",
                showEverything ? "bg-violet-600/20 border border-violet-500/30" : "hover:bg-gray-100 dark:hover:bg-slate-700"
              )}
              onClick={() => {
                setShowEverything(true);
                setSelectedSpace(null);
                setSelectedFolder(null);
              }}
              title={isSecondaryCollapsed ? "Everything" : undefined}
            >
              <LayoutGrid className="w-4 h-4 text-green-500 flex-shrink-0" />
              {!isSecondaryCollapsed && (
                <span className={cn(
                  "text-sm font-medium whitespace-nowrap overflow-hidden",
                  showEverything ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-slate-400"
                )}>Everything</span>
              )}
            </div>
          )}

          {visibleSpaces.map(space => {
            const isSpaceSelected = selectedSpace?.id === space.id && !showEverything;
            const spaceListsDirect = taskLists.filter(l => l.space_id === space.id && !l.folder_id);
            const spaceFoldersItems = folders.filter(f => f.space_id === space.id);

            return (
              <div key={space.id}>
                {/* Space Header */}
                <div
                  className={cn(
                    "flex items-center justify-between rounded-lg cursor-pointer group",
                    isSecondaryCollapsed ? "px-2 py-2 justify-center" : "px-3 py-2",
                    isSpaceSelected && !selectedFolder && !selectedList && showSpaceOverview
                      ? "bg-violet-600/20 border border-violet-500/30"
                      : "hover:bg-gray-100 dark:hover:bg-slate-700"
                  )}
                  onClick={() => {
                    setShowEverything(false);
                    setSelectedSpace(space);
                    setSelectedFolder(null);
                    setSelectedList(null);
                    setSelectedSprint(null);
                    setSelectedSprintFolder(null);
                    setShowSpaceOverview(true);
                    setActiveView('overview');
                  }}
                  title={isSecondaryCollapsed ? space.name : undefined}
                >
                  <div className={cn("flex items-center gap-2", isSecondaryCollapsed && "justify-center")}>
                    {!isSecondaryCollapsed && (
                      isSpaceSelected ? (
                        <ChevronDown className="w-3 h-3 text-gray-500 dark:text-slate-400" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-gray-500 dark:text-slate-400" />
                      )
                    )}
                    <div className="w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: space.color }}>
                      {space.name.charAt(0).toUpperCase()}
                    </div>
                    {!isSecondaryCollapsed && (
                      <span className={cn(
                        "text-sm font-medium whitespace-nowrap overflow-hidden",
                        isSpaceSelected ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-slate-400"
                      )}>{space.name}</span>
                    )}
                  </div>
                  {!isSecondaryCollapsed && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Create dropdown button */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSpace(space);
                          setShowCreateDropdown(showCreateDropdown && selectedSpace?.id === space.id ? false : true);
                        }}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                        title="Add List or Folder"
                      >
                        <Plus className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white" />
                      </button>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditSpace(space); }}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                      title="Rename Space"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSpaceMutation.mutate(space.id); }}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                      title="Delete Space"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-300" />
                    </button>
                  </div>
                  )}
                </div>

                {/* Space contents - shown when space is selected and sidebar expanded */}
                {isSpaceSelected && !isSecondaryCollapsed && (
                  <div className="ml-4 mt-1 space-y-0.5">
                    {/* Lists directly in space (not in folders) */}
                    {spaceListsDirect.map(list => {
                      const listTaskCount = tasks.filter(t => t.list_id === list.id).length;
                      return (
                        <div
                          key={list.id}
                          className={cn(
                            "flex items-center justify-between px-2 py-1.5 rounded cursor-pointer group",
                            selectedList?.id === list.id
                              ? "bg-violet-600/20 border border-violet-500/30"
                              : "hover:bg-gray-100 dark:hover:bg-slate-700"
                          )}
                          onClick={() => {
                            setSelectedList(list);
                            setSelectedFolder(null);
                            setSelectedSprint(null);
                            setSelectedSprintFolder(null);
                            setShowSpaceOverview(false);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <ListIcon className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                            <span className={cn(
                              "text-sm truncate max-w-[120px]",
                              selectedList?.id === list.id ? "text-gray-900 dark:text-white font-medium" : "text-gray-500 dark:text-slate-400"
                            )}>{list.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {listTaskCount > 0 && (
                              <span className="text-xs text-gray-400 dark:text-slate-500 mr-1">{listTaskCount}</span>
                            )}
                            <div className="relative" data-list-menu>
                              <button
                                onClick={(e) => { e.stopPropagation(); setListMenuDropdown(listMenuDropdown === list.id ? null : list.id); }}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded opacity-0 group-hover:opacity-100"
                                title="List options"
                              >
                                <MoreHorizontal className="w-3 h-3 text-gray-500 dark:text-slate-400" />
                              </button>
                              {listMenuDropdown === list.id && (
                                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 w-48 py-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(`${window.location.origin}/workspace?list=${list.id}`);
                                      toast.success('List link copied!');
                                      setListMenuDropdown(null);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                  >
                                    <Link className="w-4 h-4" />
                                    Copy Link
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(list.id);
                                      toast.success('List ID copied!');
                                      setListMenuDropdown(null);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                  >
                                    <Copy className="w-4 h-4" />
                                    Copy ID
                                  </button>
                                  <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setListMenuDropdown(null);
                                      setShowCustomFieldPanel(true);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                  >
                                    <Columns className="w-4 h-4" />
                                    Add a Column
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setListMenuDropdown(null); openEditList(list); }}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                    Rename
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setListMenuDropdown(null); openListTaskStatuses(list); }}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                  >
                                    <Circle className="w-4 h-4 text-violet-400" />
                                    Task statuses
                                  </button>
                                  <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setListMenuDropdown(null); deleteTaskListMutation.mutate(list.id); }}
                                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Docs directly in space (not in folders) */}
                    {docs.filter(d => d.space_id === space.id && !d.folder_id).map(doc => (
                      <div
                        key={`doc-${doc.id}`}
                        className="flex items-center justify-between px-2 py-1.5 rounded cursor-pointer group hover:bg-gray-100 dark:hover:bg-slate-700"
                        onClick={() => setEditingDoc(doc)}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-400" />
                          {renamingDocId === doc.id ? (
                            <input
                              type="text"
                              value={renameDocValue}
                              onChange={(e) => setRenameDocValue(e.target.value)}
                              onBlur={() => {
                                if (renameDocValue.trim() && renameDocValue !== doc.name) {
                                  updateDocMutation.mutate({ id: doc.id, data: { name: renameDocValue.trim() } });
                                }
                                setRenamingDocId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  if (renameDocValue.trim() && renameDocValue !== doc.name) {
                                    updateDocMutation.mutate({ id: doc.id, data: { name: renameDocValue.trim() } });
                                  }
                                  setRenamingDocId(null);
                                } else if (e.key === 'Escape') {
                                  setRenamingDocId(null);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm bg-transparent border border-violet-500 rounded px-1 py-0.5 text-gray-900 dark:text-white outline-none w-full max-w-[120px]"
                              autoFocus
                            />
                          ) : (
                            <span className="text-sm text-gray-500 dark:text-slate-400 truncate max-w-[120px]">{doc.name}</span>
                          )}
                        </div>
                        <div className="relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); setDocMenuDropdown(docMenuDropdown === doc.id ? null : doc.id); }}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded opacity-0 group-hover:opacity-100"
                            title="Doc options"
                          >
                            <MoreHorizontal className="w-3 h-3 text-gray-500 dark:text-slate-400" />
                          </button>
                          {docMenuDropdown === doc.id && (
                            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 w-48 py-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(`${window.location.origin}/docs/public/${doc.id}`);
                                  toast.success('Public link copied!');
                                  setDocMenuDropdown(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Link className="w-4 h-4" />
                                Copy Link
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(doc.id);
                                  toast.success('Doc ID copied!');
                                  setDocMenuDropdown(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Copy className="w-4 h-4" />
                                Copy ID
                              </button>
                              <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDocMenuDropdown(null);
                                  setSelectedSpace(spaces.find(s => s.id === doc.space_id) || null);
                                  setShowCustomFieldPanel(true);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Columns className="w-4 h-4" />
                                Add a Column
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDocMenuDropdown(null); setRenamingDocId(doc.id); setRenameDocValue(doc.name); }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Edit2 className="w-4 h-4" />
                                Rename
                              </button>
                              <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                              <button
                                onClick={(e) => { e.stopPropagation(); setDocMenuDropdown(null); deleteDocMutation.mutate(doc.id); }}
                                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Forms directly in space (not in folders) */}
                    {forms.filter(f => f.space_id === space.id && !f.folder_id).map(form => (
                      <div
                        key={`form-${form.id}`}
                        className="flex items-center justify-between px-2 py-1.5 rounded cursor-pointer group hover:bg-gray-100 dark:hover:bg-slate-700"
                        onClick={() => setEditingForm(form)}
                      >
                        <div className="flex items-center gap-2">
                          <ClipboardList className="w-4 h-4 text-green-400" />
                          {renamingFormId === form.id ? (
                            <input
                              type="text"
                              value={renameFormValue}
                              onChange={(e) => setRenameFormValue(e.target.value)}
                              onBlur={() => {
                                if (renameFormValue.trim() && renameFormValue !== form.name) {
                                  updateFormMutation.mutate({ id: form.id, data: { name: renameFormValue.trim() } });
                                }
                                setRenamingFormId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  if (renameFormValue.trim() && renameFormValue !== form.name) {
                                    updateFormMutation.mutate({ id: form.id, data: { name: renameFormValue.trim() } });
                                  }
                                  setRenamingFormId(null);
                                } else if (e.key === 'Escape') {
                                  setRenamingFormId(null);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm bg-transparent border border-violet-500 rounded px-1 py-0.5 text-gray-900 dark:text-white outline-none w-full max-w-[120px]"
                              autoFocus
                            />
                          ) : (
                            <span className="text-sm text-gray-500 dark:text-slate-400 truncate max-w-[120px]">{form.name}</span>
                          )}
                        </div>
                        <div className="relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); setFormMenuDropdown(formMenuDropdown === form.id ? null : form.id); }}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded opacity-0 group-hover:opacity-100"
                            title="Form options"
                          >
                            <MoreHorizontal className="w-3 h-3 text-gray-500 dark:text-slate-400" />
                          </button>
                          {formMenuDropdown === form.id && (
                            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 w-48 py-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(`${window.location.origin}/form/${form.id}`);
                                  toast.success('Public form link copied!');
                                  setFormMenuDropdown(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Link className="w-4 h-4" />
                                Copy Link
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(form.id);
                                  toast.success('Form ID copied!');
                                  setFormMenuDropdown(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Copy className="w-4 h-4" />
                                Copy ID
                              </button>
                              <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFormMenuDropdown(null);
                                  setSelectedSpace(spaces.find(s => s.id === form.space_id) || null);
                                  setShowCustomFieldPanel(true);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Columns className="w-4 h-4" />
                                Add a Column
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setFormMenuDropdown(null); setRenamingFormId(form.id); setRenameFormValue(form.name); }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Edit2 className="w-4 h-4" />
                                Rename
                              </button>
                              <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                              <button
                                onClick={(e) => { e.stopPropagation(); setFormMenuDropdown(null); deleteFormMutation.mutate(form.id); }}
                                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Folders */}
                    {spaceFoldersItems.map(folder => {
                      const folderLists = taskLists.filter(l => l.folder_id === folder.id);
                      const folderTaskCount = folderLists.reduce((acc, list) =>
                        acc + tasks.filter(t => t.list_id === list.id).length, 0
                      );

                      return (
                        <div key={folder.id}>
                          {/* Folder Header */}
                          <div
                            className={cn(
                              "flex items-center justify-between px-2 py-1.5 rounded cursor-pointer group",
                              selectedFolder?.id === folder.id && !selectedList
                                ? "bg-violet-600/20 border border-violet-500/30"
                                : "hover:bg-gray-100 dark:hover:bg-slate-700"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFolder(folder.id);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              {expandedFolders[folder.id] ? (
                                <ChevronDown className="w-3 h-3 text-gray-500 dark:text-slate-400" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-gray-500 dark:text-slate-400" />
                              )}
                              <FolderIcon className="w-4 h-4 text-yellow-500" />
                              <span className="text-sm text-gray-500 dark:text-slate-400">{folder.name}</span>
                              {folderTaskCount > 0 && (
                                <span className="text-xs text-gray-400 dark:text-slate-500">{folderTaskCount}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                              <div className="relative" data-folder-plus>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFolderPlusDropdown(folderPlusDropdown === folder.id ? null : folder.id);
                                  }}
                                  className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                                  title="Add to Folder"
                                >
                                  <Plus className="w-3 h-3 text-gray-500 dark:text-slate-400" />
                                </button>
                                {folderPlusDropdown === folder.id && (
                                  <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 py-1 w-48">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setFolderPlusDropdown(null);
                                        openCreateList(folder.id);
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                    >
                                      <ListIcon className="w-4 h-4 text-violet-400" />
                                      Create List
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setFolderPlusDropdown(null);
                                        // Find or create a sprint folder for this space, then open sprint create modal
                                        const spaceSf = sprintFolders.find(sf => sf.space_id === space.id);
                                        if (spaceSf) {
                                          setSprintCreateFolderId(spaceSf.id);
                                          setSprintCreateForFolder(folder.id);
                                          setShowSprintCreateModal(true);
                                        } else {
                                          // Auto-create sprint folder for this space, then open modal
                                          createSprintFolderMutation.mutate(
                                            { name: 'Sprints', space_id: space.id, default_duration: 14, folder_id: folder.id },
                                            {
                                              onSuccess: (result: { folder: SprintFolder; sprint: Sprint }) => {
                                                toast.success('Sprint 1 created');
                                              }
                                            }
                                          );
                                        }
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                    >
                                      <Zap className="w-4 h-4 text-teal-400" />
                                      Create Sprint
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setFolderPlusDropdown(null);
                                        openCreateDoc(folder.id);
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                    >
                                      <FileText className="w-4 h-4 text-blue-400" />
                                      Create Doc
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setFolderPlusDropdown(null);
                                        openCreateForm(folder.id);
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                    >
                                      <ClipboardList className="w-4 h-4 text-green-400" />
                                      Create Form
                                    </button>
                                    <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setFolderPlusDropdown(null);
                                        openFolderTaskStatuses(folder);
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                    >
                                      <Circle className="w-4 h-4 text-violet-400" />
                                      Task statuses
                                    </button>
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); openEditFolder(folder); }}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                                title="Rename Folder"
                              >
                                <Edit2 className="w-3 h-3 text-gray-500 dark:text-slate-400" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteFolderMutation.mutate(folder.id); }}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                                title="Delete Folder"
                              >
                                <Trash2 className="w-3 h-3 text-red-400" />
                              </button>
                            </div>
                          </div>

                          {/* Lists inside folder */}
                          {expandedFolders[folder.id] && (
                            <div className="ml-5 space-y-0.5 mt-0.5">
                              {folderLists.map(list => {
                                const listTaskCount = tasks.filter(t => t.list_id === list.id).length;
                                return (
                                  <div
                                    key={list.id}
                                    className={cn(
                                      "flex items-center justify-between px-2 py-1.5 rounded cursor-pointer group",
                                      selectedList?.id === list.id
                                        ? "bg-violet-600/20 border border-violet-500/30"
                                        : "hover:bg-gray-100 dark:hover:bg-slate-700"
                                    )}
                                    onClick={() => {
                                      setSelectedList(list);
                                      setSelectedFolder(folder);
                                      setSelectedSprint(null);
                                      setSelectedSprintFolder(null);
                                      setShowSpaceOverview(false);
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <ListIcon className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                                      <span className={cn(
                                        "text-sm truncate max-w-[100px]",
                                        selectedList?.id === list.id ? "text-gray-900 dark:text-white font-medium" : "text-gray-500 dark:text-slate-400"
                                      )}>{list.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {listTaskCount > 0 && (
                                        <span className="text-xs text-gray-400 dark:text-slate-500">{listTaskCount}</span>
                                      )}
                                      <div className="relative" data-list-menu>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setListMenuDropdown(listMenuDropdown === list.id ? null : list.id); }}
                                          className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded opacity-0 group-hover:opacity-100"
                                          title="List options"
                                        >
                                          <MoreHorizontal className="w-3 h-3 text-gray-500 dark:text-slate-400" />
                                        </button>
                                        {listMenuDropdown === list.id && (
                                          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 w-48 py-1">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                navigator.clipboard.writeText(`${window.location.origin}/workspace?list=${list.id}`);
                                                toast.success('List link copied!');
                                                setListMenuDropdown(null);
                                              }}
                                              className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                            >
                                              <Link className="w-4 h-4" />
                                              Copy Link
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                navigator.clipboard.writeText(list.id);
                                                toast.success('List ID copied!');
                                                setListMenuDropdown(null);
                                              }}
                                              className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                            >
                                              <Copy className="w-4 h-4" />
                                              Copy ID
                                            </button>
                                            <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setListMenuDropdown(null);
                                                setShowCustomFieldPanel(true);
                                              }}
                                              className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                            >
                                              <Columns className="w-4 h-4" />
                                              Add a Column
                                            </button>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setListMenuDropdown(null); openEditList(list); }}
                                              className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                            >
                                              <Edit2 className="w-4 h-4" />
                                              Rename
                                            </button>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setListMenuDropdown(null); openListTaskStatuses(list); }}
                                              className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                            >
                                              <Circle className="w-4 h-4 text-violet-400" />
                                              Task statuses
                                            </button>
                                            <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setListMenuDropdown(null); deleteTaskListMutation.mutate(list.id); }}
                                              className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                              Delete
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              {/* Sprints inside this folder - sorted by start_date descending (newest first) */}
                              {sprints.filter(s => s.folder_id === folder.id).sort((a, b) => {
                                const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
                                const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
                                return dateB - dateA;
                              }).map(sprint => {
                                const sprintStatus = getSprintStatus(sprint);
                                const statusColor = getSprintStatusColor(sprintStatus);
                                const taskCount = tasks.filter(t => t.sprint_id === sprint.id).length;

                                return (
                                  <div
                                    key={sprint.id}
                                    className={cn(
                                      "flex items-center justify-between px-2 py-1.5 rounded cursor-pointer group",
                                      selectedSprint?.id === sprint.id
                                        ? "bg-teal-600/20 border border-teal-500/30"
                                        : "hover:bg-gray-100 dark:hover:bg-slate-700"
                                    )}
                                    onClick={() => {
                                      setSelectedSprint(sprint);
                                      setSelectedSprintFolder(sprintFolders.find(sf => sf.id === sprint.sprint_folder_id) || null);
                                      setSelectedFolder(folder);
                                      setSelectedList(null);
                                      setShowSpaceOverview(false);
                                      setActiveView('list'); // Sprint should default to list view
                                    }}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {sprintStatus === 'not_started' ? (
                                        <Circle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: statusColor }} strokeDasharray="4 2" />
                                      ) : sprintStatus === 'in_progress' ? (
                                        <Circle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: statusColor }} />
                                      ) : (
                                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: statusColor }} />
                                      )}
                                      <span className={cn(
                                        "text-xs truncate",
                                        selectedSprint?.id === sprint.id ? "text-gray-900 dark:text-white font-medium" : "text-gray-500 dark:text-slate-400"
                                      )}>
                                        {sprint.name}{' '}
                                        <span className="text-gray-400 dark:text-slate-500">
                                          ({new Date(sprint.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: '2-digit' })}{' - '}{new Date(sprint.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: '2-digit' })})
                                        </span>
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {taskCount > 0 && (
                                        <span className="text-xs text-gray-400 dark:text-slate-500">{taskCount}</span>
                                      )}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); deleteSprintMutation.mutate(sprint.id); }}
                                        className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded opacity-0 group-hover:opacity-100"
                                        title="Delete Sprint"
                                      >
                                        <Trash2 className="w-3 h-3 text-red-400" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                              {/* Docs inside this folder */}
                              {docs.filter(d => d.folder_id === folder.id).map(doc => (
                                <div
                                  key={`doc-${doc.id}`}
                                  className="flex items-center justify-between px-2 py-1.5 rounded cursor-pointer group hover:bg-gray-100 dark:hover:bg-slate-700"
                                  onClick={() => setEditingDoc(doc)}
                                >
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                                    {renamingDocId === doc.id ? (
                                      <input
                                        type="text"
                                        value={renameDocValue}
                                        onChange={(e) => setRenameDocValue(e.target.value)}
                                        onBlur={() => {
                                          if (renameDocValue.trim() && renameDocValue !== doc.name) {
                                            updateDocMutation.mutate({ id: doc.id, data: { name: renameDocValue.trim() } });
                                          }
                                          setRenamingDocId(null);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            if (renameDocValue.trim() && renameDocValue !== doc.name) {
                                              updateDocMutation.mutate({ id: doc.id, data: { name: renameDocValue.trim() } });
                                            }
                                            setRenamingDocId(null);
                                          } else if (e.key === 'Escape') {
                                            setRenamingDocId(null);
                                          }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-sm bg-transparent border border-violet-500 rounded px-1 py-0.5 text-gray-900 dark:text-white outline-none w-full max-w-[100px]"
                                        autoFocus
                                      />
                                    ) : (
                                      <span className="text-sm text-gray-500 dark:text-slate-400 truncate max-w-[100px]">{doc.name}</span>
                                    )}
                                  </div>
                                  <div className="relative">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setDocMenuDropdown(docMenuDropdown === doc.id ? null : doc.id); }}
                                      className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded opacity-0 group-hover:opacity-100"
                                      title="Doc options"
                                    >
                                      <MoreHorizontal className="w-3 h-3 text-gray-500 dark:text-slate-400" />
                                    </button>
                                    {docMenuDropdown === doc.id && (
                                      <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 w-48 py-1">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(`${window.location.origin}/docs/public/${doc.id}`);
                                            toast.success('Public link copied!');
                                            setDocMenuDropdown(null);
                                          }}
                                          className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                        >
                                          <Link className="w-4 h-4" />
                                          Copy Link
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(doc.id);
                                            toast.success('Doc ID copied!');
                                            setDocMenuDropdown(null);
                                          }}
                                          className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                        >
                                          <Copy className="w-4 h-4" />
                                          Copy ID
                                        </button>
                                        <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDocMenuDropdown(null);
                                            setSelectedSpace(spaces.find(s => s.id === doc.space_id) || null);
                                            setShowCustomFieldPanel(true);
                                          }}
                                          className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                        >
                                          <Columns className="w-4 h-4" />
                                          Add a Column
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setDocMenuDropdown(null); setRenamingDocId(doc.id); setRenameDocValue(doc.name); }}
                                          className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                          Rename
                                        </button>
                                        <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setDocMenuDropdown(null); deleteDocMutation.mutate(doc.id); }}
                                          className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {/* Forms inside this folder */}
                              {forms.filter(f => f.folder_id === folder.id).map(form => (
                                <div
                                  key={`form-${form.id}`}
                                  className="flex items-center justify-between px-2 py-1.5 rounded cursor-pointer group hover:bg-gray-100 dark:hover:bg-slate-700"
                                  onClick={() => setEditingForm(form)}
                                >
                                  <div className="flex items-center gap-2">
                                    <ClipboardList className="w-3.5 h-3.5 text-green-400" />
                                    {renamingFormId === form.id ? (
                                      <input
                                        type="text"
                                        value={renameFormValue}
                                        onChange={(e) => setRenameFormValue(e.target.value)}
                                        onBlur={() => {
                                          if (renameFormValue.trim() && renameFormValue !== form.name) {
                                            updateFormMutation.mutate({ id: form.id, data: { name: renameFormValue.trim() } });
                                          }
                                          setRenamingFormId(null);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            if (renameFormValue.trim() && renameFormValue !== form.name) {
                                              updateFormMutation.mutate({ id: form.id, data: { name: renameFormValue.trim() } });
                                            }
                                            setRenamingFormId(null);
                                          } else if (e.key === 'Escape') {
                                            setRenamingFormId(null);
                                          }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-sm bg-transparent border border-violet-500 rounded px-1 py-0.5 text-gray-900 dark:text-white outline-none w-full max-w-[100px]"
                                        autoFocus
                                      />
                                    ) : (
                                      <span className="text-sm text-gray-500 dark:text-slate-400 truncate max-w-[100px]">{form.name}</span>
                                    )}
                                  </div>
                                  <div className="relative">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setFormMenuDropdown(formMenuDropdown === form.id ? null : form.id); }}
                                      className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded opacity-0 group-hover:opacity-100"
                                      title="Form options"
                                    >
                                      <MoreHorizontal className="w-3 h-3 text-gray-500 dark:text-slate-400" />
                                    </button>
                                    {formMenuDropdown === form.id && (
                                      <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 w-48 py-1">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(`${window.location.origin}/form/${form.id}`);
                                            toast.success('Public form link copied!');
                                            setFormMenuDropdown(null);
                                          }}
                                          className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                        >
                                          <Link className="w-4 h-4" />
                                          Copy Link
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(form.id);
                                            toast.success('Form ID copied!');
                                            setFormMenuDropdown(null);
                                          }}
                                          className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                        >
                                          <Copy className="w-4 h-4" />
                                          Copy ID
                                        </button>
                                        <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setFormMenuDropdown(null);
                                            setSelectedSpace(spaces.find(s => s.id === form.space_id) || null);
                                            setShowCustomFieldPanel(true);
                                          }}
                                          className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                        >
                                          <Columns className="w-4 h-4" />
                                          Add a Column
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setFormMenuDropdown(null); setRenamingFormId(form.id); setRenameFormValue(form.name); }}
                                          className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                          Rename
                                        </button>
                                        <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setFormMenuDropdown(null); deleteFormMutation.mutate(form.id); }}
                                          className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                          Delete
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {folderLists.length === 0 && sprints.filter(s => s.folder_id === folder.id).length === 0 && docs.filter(d => d.folder_id === folder.id).length === 0 && forms.filter(f => f.folder_id === folder.id).length === 0 && (
                                <button
                                  onClick={() => openCreateList(folder.id)}
                                  className="w-full text-left px-2 py-1.5 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-500 dark:hover:text-slate-400 flex items-center gap-2"
                                >
                                  <Plus className="w-3 h-3" /> Add List
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* New Space link - only if empty */}
                    {spaceListsDirect.length === 0 && spaceFoldersItems.length === 0 && (
                      <div className="pt-2">
                        <button
                          onClick={() => openCreateList()}
                          className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 px-2"
                        >
                          <Plus className="w-3 h-3" /> New List
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add Space Button - Only for non-guests and when sidebar expanded */}
          {!needsSpaceAccess && !isSecondaryCollapsed && (
            <button
              onClick={() => setShowSpaceModal(true)}
              className="w-full mt-2 px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create Space
            </button>
          )}

          {/* Message for guests/limited members with no access */}
          {needsSpaceAccess && visibleSpaces.length === 0 && !isSecondaryCollapsed && (
            <div className="mt-4 p-4 bg-gray-100 dark:bg-[#14151a]/50 rounded-lg border border-gray-200 dark:border-[#1f2229]">
              <div className="flex items-center gap-2 text-amber-400 mb-2">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">No Access</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                You don't have access to any spaces yet. Please contact an admin to get access.
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-[#f7f8fb] dark:bg-[#191a21]">
        {(selectedSpace || showEverything) ? (
          <>
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-[#1f2229] bg-white dark:bg-[#0f1012]">
              <div className="p-4 pb-0">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {showEverything ? 'Everything' :
                         selectedSprint ? selectedSprint.name :
                         selectedList ? selectedList.name :
                         showSpaceOverview ? selectedSpace?.name :
                         selectedFolder?.name || selectedSpace?.name}
                      </h1>
                      {selectedSprint && (
                        <Zap className="w-5 h-5 text-teal-400" />
                      )}
                      <button className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white">
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                      {/* Manage Access Button - Only for admins/owners when a space is selected */}
                      {!showEverything && selectedSpace && !needsSpaceAccess && (
                        <button
                          onClick={() => setShowSpaceMembersModal(true)}
                          className="flex items-center gap-1.5 px-3 py-1 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                          title="Manage space access"
                        >
                          <Users className="w-4 h-4" />
                          <span>Access</span>
                          {spaceMembers.length > 0 && (
                            <span className="px-1.5 py-0.5 text-xs bg-violet-600 text-white rounded-full">
                              {spaceMembers.length}
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                    <p className="text-gray-500 dark:text-slate-500 mt-1 text-sm">
                      {showEverything ? (
                        <span>{filteredTasks.length} tasks across all spaces</span>
                      ) : selectedSprint ? (
                        <span>
                          {new Date(selectedSprint.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: '2-digit' })}
                          {' - '}
                          {new Date(selectedSprint.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: '2-digit' })}
                          {' \u00b7 '}
                          {tasks.filter(t => t.sprint_id === selectedSprint.id).length} tasks in this sprint
                        </span>
                      ) : selectedList ? (
                        <span>{tasks.filter(t => t.list_id === selectedList.id).length} tasks in this list</span>
                      ) : showSpaceOverview ? (
                        <span>Space Overview</span>
                      ) : selectedFolder ? (
                        <span>{filteredTasks.length} tasks in this folder</span>
                      ) : (
                        <span>{filteredTasks.length} tasks in this space</span>
                      )}
                    </p>
                  </div>
                  {!showEverything && (
                    <button
                      onClick={() => openAddTask()}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md font-medium flex items-center gap-2 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Task
                    </button>
                  )}
                </div>

                {/* View Tabs */}
                <div className="flex items-center gap-1 mt-4 border-b border-gray-200 dark:border-[#1f2229] -mb-px">
                  {viewTabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveView(tab.id);
                        if (tab.id === 'overview') {
                          setShowSpaceOverview(true);
                          setSelectedList(null);
                        } else {
                          setShowSpaceOverview(false);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                        activeView === tab.id
                          ? "text-gray-900 dark:text-white border-violet-500"
                          : "text-gray-500 dark:text-slate-500 border-transparent hover:text-gray-900 dark:hover:text-white"
                      )}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  ))}
                  <button className="flex items-center gap-1 px-3 py-2.5 text-sm text-gray-500 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white">
                    <Plus className="w-4 h-4" /> View
                  </button>
                </div>
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-[#1f2229] bg-white dark:bg-[#0f1012] relative">
              <div className="flex items-center gap-2">
                {/* Group By Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowGroupByDropdown(!showGroupByDropdown)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                  >
                    <Circle className="w-4 h-4" />
                    Group: {groupByOptions.find(o => o.value === groupBy)?.label}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showGroupByDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 w-48">
                      {groupByOptions.map(option => (
                        <button
                          key={option.value}
                          onClick={() => { setGroupBy(option.value); setShowGroupByDropdown(false); }}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700",
                            groupBy === option.value ? "text-gray-900 dark:text-white bg-gray-100 dark:bg-[#15161a]" : "text-gray-500 dark:text-slate-400"
                          )}
                        >
                          <option.icon className="w-4 h-4" />
                          {option.label}
                          {groupBy === option.value && <CheckCircle2 className="w-4 h-4 ml-auto text-violet-500" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              <div className="flex items-center gap-2">
                {/* Customize View Button */}
                {activeView === 'list' && (selectedList || selectedSprint) && (
                  <button
                    onClick={() => {
                      setShowViewPanel(true);
                      setViewPanelStep('customize');
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    Customize
                  </button>
                )}

                {/* Filter Button */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowFilterPanel(!showFilterPanel);
                      if (!showFilterPanel) {
                        setShowFilterDropdown(true);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md",
                      showFilterPanel || hasActiveFilters
                        ? "text-white bg-violet-600"
                        : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700"
                    )}
                  >
                    <Filter className="w-4 h-4" />
                    Filter
                    {hasActiveFilters && (
                      <span className="w-4 h-4 rounded-full bg-white text-violet-600 text-xs flex items-center justify-center font-bold">
                        {activeFilters.status.length + activeFilters.priority.length + activeFilters.assignee.length + activeFilters.dueDate.length + Object.values(activeFilters.customFields).reduce((sum, v) => sum + v.length, 0)}
                      </span>
                    )}
                  </button>

                  {/* Filter Panel - ClickUp Style */}
                  {showFilterPanel && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-xl shadow-2xl z-50">
                      {/* Header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#1f2229]">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-900 dark:text-white font-medium">Filters</span>
                          <Info className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                        </div>
                        <button className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1">
                          Saved filters <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Applied Filters */}
                      {appliedFilterTypes.length > 0 && (
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-[#1f2229] space-y-3">
                          {appliedFilterTypes.map(filterType => {
                            const filterOption = filterOptions.find(f => f.id === filterType);
                            if (!filterOption) return null;

                            return (
                              <div key={filterType} className="bg-gray-100 dark:bg-[#15161a] rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <filterOption.icon className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                                    <span className="text-sm text-gray-900 dark:text-white">{filterOption.label}</span>
                                  </div>
                                  <button
                                    onClick={() => removeFilterType(filterType)}
                                    className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded"
                                  >
                                    <Trash2 className="w-3 h-3 text-gray-500 dark:text-slate-400" />
                                  </button>
                                </div>

                                {/* Filter values based on type */}
                                {filterType === 'status' && (() => {
                                  // Merge configured statuses with any extra statuses found in tasks
                                  const configuredNames = new Set(statuses.map(s => s.name));
                                  const extraStatuses: StatusConfig[] = [];
                                  (showEverything ? tasks : spaceTasks).forEach(t => {
                                    if (t.status && !configuredNames.has(t.status) && !extraStatuses.some(e => e.name === t.status)) {
                                      extraStatuses.push({ name: t.status, color: '#6b7280', bgColor: '#6b7280' });
                                    }
                                  });
                                  const allStatuses = [...statuses, ...extraStatuses];

                                  return (
                                    <div className="flex flex-wrap gap-1">
                                      {/* All button */}
                                      <button
                                        onClick={() => setActiveFilters(prev => ({ ...prev, status: [] }))}
                                        className={cn(
                                          "px-2 py-1 text-xs rounded border font-medium",
                                          activeFilters.status.length === 0
                                            ? "border-violet-500 bg-violet-500/30 text-gray-900 dark:text-white"
                                            : "border-gray-300 dark:border-[#1f2229] text-gray-500 dark:text-slate-400 hover:border-gray-400 dark:hover:border-slate-500"
                                        )}
                                      >
                                        All
                                      </button>
                                      {allStatuses.map(status => (
                                        <button
                                          key={status.name}
                                          onClick={() => toggleFilter('status', status.name)}
                                          className={cn(
                                            "px-2 py-1 text-xs rounded border",
                                            activeFilters.status.includes(status.name)
                                              ? "border-violet-500 bg-violet-500/30 text-gray-900 dark:text-white"
                                              : "border-gray-300 dark:border-[#1f2229] text-gray-500 dark:text-slate-400 hover:border-gray-400 dark:hover:border-slate-500"
                                          )}
                                        >
                                          <span className="w-2 h-2 rounded-full inline-block mr-1" style={{ backgroundColor: status.color }} />
                                          {status.name}
                                        </button>
                                      ))}
                                    </div>
                                  );
                                })()}

                                {filterType === 'priority' && (
                                  <div className="flex flex-wrap gap-1">
                                    <button
                                      onClick={() => setActiveFilters(prev => ({ ...prev, priority: [] }))}
                                      className={cn(
                                        "px-2 py-1 text-xs rounded border font-medium",
                                        activeFilters.priority.length === 0
                                          ? "border-violet-500 bg-violet-500/30 text-gray-900 dark:text-white"
                                          : "border-gray-300 dark:border-[#1f2229] text-gray-500 dark:text-slate-400 hover:border-gray-400 dark:hover:border-slate-500"
                                      )}
                                    >
                                      All
                                    </button>
                                    {priorities.map(p => (
                                      <button
                                        key={p.value}
                                        onClick={() => toggleFilter('priority', p.value)}
                                        className={cn(
                                          "px-2 py-1 text-xs rounded border flex items-center gap-1",
                                          activeFilters.priority.includes(p.value)
                                            ? "border-violet-500 bg-violet-500/30 text-gray-900 dark:text-white"
                                            : "border-gray-300 dark:border-[#1f2229] text-gray-500 dark:text-slate-400 hover:border-gray-400 dark:hover:border-slate-500"
                                        )}
                                      >
                                        <Flag className="w-3 h-3" style={{ color: p.color }} />
                                        {p.label}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {filterType === 'assignee' && (
                                  <div className="flex flex-wrap gap-1">
                                    <button
                                      onClick={() => setActiveFilters(prev => ({ ...prev, assignee: [] }))}
                                      className={cn(
                                        "px-2 py-1 text-xs rounded border font-medium",
                                        activeFilters.assignee.length === 0
                                          ? "border-violet-500 bg-violet-500/30 text-gray-900 dark:text-white"
                                          : "border-gray-300 dark:border-[#1f2229] text-gray-500 dark:text-slate-400 hover:border-gray-400 dark:hover:border-slate-500"
                                      )}
                                    >
                                      All
                                    </button>
                                    {uniqueAssignees.length > 0 ? (
                                      uniqueAssignees.map(assignee => (
                                        <button
                                          key={assignee}
                                          onClick={() => toggleFilter('assignee', assignee)}
                                          className={cn(
                                            "px-2 py-1 text-xs rounded border",
                                            activeFilters.assignee.includes(assignee)
                                              ? "border-violet-500 bg-violet-500/30 text-gray-900 dark:text-white"
                                              : "border-gray-300 dark:border-[#1f2229] text-gray-500 dark:text-slate-400 hover:border-gray-400 dark:hover:border-slate-500"
                                          )}
                                        >
                                          {assignee}
                                        </button>
                                      ))
                                    ) : (
                                      <span className="text-xs text-gray-400 dark:text-slate-500">No assignees found</span>
                                    )}
                                  </div>
                                )}

                                {filterType === 'dueDate' && (() => {
                                  const year = calendarMonth.getFullYear();
                                  const month = calendarMonth.getMonth();
                                  const firstDay = new Date(year, month, 1).getDay();
                                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);
                                  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

                                  const days = [];
                                  for (let i = 0; i < firstDay; i++) {
                                    days.push(null);
                                  }
                                  for (let i = 1; i <= daysInMonth; i++) {
                                    days.push(i);
                                  }

                                  return (
                                    <div className="space-y-2">
                                      {/* Calendar Header */}
                                      <div className="flex items-center justify-between">
                                        <button
                                          onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}
                                          className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                                        >
                                          <ChevronRight className="w-4 h-4 rotate-180" />
                                        </button>
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                          {monthNames[month]} {year}
                                        </span>
                                        <button
                                          onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}
                                          className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                                        >
                                          <ChevronRight className="w-4 h-4" />
                                        </button>
                                      </div>

                                      {/* Day Headers */}
                                      <div className="grid grid-cols-7 gap-1 text-center">
                                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                          <div key={day} className="text-[10px] text-gray-400 dark:text-slate-500 py-1">
                                            {day}
                                          </div>
                                        ))}
                                      </div>

                                      {/* Calendar Days */}
                                      <div className="grid grid-cols-7 gap-1">
                                        {days.map((day, idx) => {
                                          if (!day) return <div key={idx} />;

                                          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                          const isSelected = filterStartDate === dateStr;
                                          const dateObj = new Date(year, month, day);
                                          const isToday = dateObj.getTime() === today.getTime();

                                          return (
                                            <button
                                              key={idx}
                                              onClick={() => {
                                                if (filterStartDate === dateStr) {
                                                  setFilterStartDate('');
                                                  setFilterEndDate('');
                                                } else {
                                                  setFilterStartDate(dateStr);
                                                  setFilterEndDate(dateStr);
                                                }
                                              }}
                                              className={cn(
                                                "w-7 h-7 text-xs rounded-full flex items-center justify-center transition-colors",
                                                isSelected
                                                  ? "bg-violet-600 text-white"
                                                  : isToday
                                                    ? "bg-gray-200 dark:bg-[#15161a] text-gray-900 dark:text-white"
                                                    : "text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-700"
                                              )}
                                            >
                                              {day}
                                            </button>
                                          );
                                        })}
                                      </div>

                                      {/* Selected Date Display */}
                                      {filterStartDate && (
                                        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-[#1f2229]">
                                          <span className="text-xs text-gray-500 dark:text-slate-400">
                                            Selected: {new Date(filterStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                          </span>
                                          <button
                                            onClick={() => {
                                              setFilterStartDate('');
                                              setFilterEndDate('');
                                            }}
                                            className="text-xs text-red-400 hover:text-red-300"
                                          >
                                            Clear
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}

                                {/* Custom field filters */}
                                {filterType.startsWith('cf_') && (() => {
                                  const cfId = filterType.replace('cf_', '');
                                  const field = orderedCustomFields.find(f => f.id === cfId);
                                  if (!field) return null;
                                  const cfFilterValues = activeFilters.customFields[cfId] || [];

                                  // Collect unique values for this custom field from tasks
                                  const uniqueValues: { value: string; label: string; color?: string }[] = [];
                                  const seenValues = new Set<string>();
                                  const currentTasks = showEverything ? tasks : spaceTasks;
                                  currentTasks.forEach(task => {
                                    const fv = fieldValueMap[task.id]?.[cfId];
                                    if (!fv) return;
                                    if (field.type === 'dropdown') {
                                      const val = fv.value_json;
                                      if (val && !seenValues.has(val)) {
                                        seenValues.add(val);
                                        const opt = field.type_config?.options?.find((o: any) => o.id === val);
                                        uniqueValues.push({ value: val, label: opt?.name || val, color: opt?.color });
                                      }
                                    } else if (field.type === 'labels') {
                                      const vals = fv.value_json;
                                      if (Array.isArray(vals)) {
                                        vals.forEach((v: string) => {
                                          if (!seenValues.has(v)) {
                                            seenValues.add(v);
                                            const opt = field.type_config?.options?.find((o: any) => o.id === v || o.name === v);
                                            uniqueValues.push({ value: v, label: opt?.name || v, color: opt?.color });
                                          }
                                        });
                                      }
                                    } else if (field.type === 'checkbox') {
                                      const val = fv.value_boolean ? 'true' : 'false';
                                      if (!seenValues.has(val)) {
                                        seenValues.add(val);
                                        uniqueValues.push({ value: val, label: val === 'true' ? 'Checked' : 'Unchecked' });
                                      }
                                    } else if (field.type === 'people') {
                                      const vals = fv.value_json;
                                      if (Array.isArray(vals)) {
                                        vals.forEach((v: string) => {
                                          if (!seenValues.has(v)) {
                                            seenValues.add(v);
                                            uniqueValues.push({ value: v, label: v });
                                          }
                                        });
                                      }
                                    } else {
                                      const val = fv.value_text || fv.value_number?.toString() || '';
                                      if (val && !seenValues.has(val)) {
                                        seenValues.add(val);
                                        uniqueValues.push({ value: val, label: val });
                                      }
                                    }
                                  });

                                  // Also add all dropdown/label options even if not used yet
                                  if ((field.type === 'dropdown' || field.type === 'labels') && field.type_config?.options) {
                                    field.type_config.options.forEach((opt: any) => {
                                      if (!seenValues.has(opt.id)) {
                                        seenValues.add(opt.id);
                                        uniqueValues.push({ value: opt.id, label: opt.name, color: opt.color });
                                      }
                                    });
                                  }

                                  return (
                                    <div className="flex flex-wrap gap-1">
                                      <button
                                        onClick={() => setActiveFilters(prev => ({
                                          ...prev,
                                          customFields: { ...prev.customFields, [cfId]: [] }
                                        }))}
                                        className={cn(
                                          "px-2 py-1 text-xs rounded border font-medium",
                                          cfFilterValues.length === 0
                                            ? "border-violet-500 bg-violet-500/30 text-gray-900 dark:text-white"
                                            : "border-gray-300 dark:border-[#1f2229] text-gray-500 dark:text-slate-400 hover:border-gray-400 dark:hover:border-slate-500"
                                        )}
                                      >
                                        All
                                      </button>
                                      {uniqueValues.map(item => (
                                        <button
                                          key={item.value}
                                          onClick={() => toggleCustomFieldFilter(cfId, item.value)}
                                          className={cn(
                                            "px-2 py-1 text-xs rounded border",
                                            cfFilterValues.includes(item.value)
                                              ? "border-violet-500 bg-violet-500/30 text-gray-900 dark:text-white"
                                              : "border-gray-300 dark:border-[#1f2229] text-gray-500 dark:text-slate-400 hover:border-gray-400 dark:hover:border-slate-500"
                                          )}
                                        >
                                          {item.color && (
                                            <span className="w-2 h-2 rounded-full inline-block mr-1" style={{ backgroundColor: item.color }} />
                                          )}
                                          {item.label}
                                        </button>
                                      ))}
                                      {uniqueValues.length === 0 && (
                                        <span className="text-xs text-gray-400 dark:text-slate-500">No values found</span>
                                      )}
                                    </div>
                                  );
                                })()}

                                {!['status', 'priority', 'assignee', 'dueDate'].includes(filterType) && !filterType.startsWith('cf_') && (
                                  <span className="text-xs text-gray-400 dark:text-slate-500">Coming soon...</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Select Filter Dropdown */}
                      <div className="px-4 py-3">
                        <div className="relative">
                          <button
                            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-[#15161a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-slate-500"
                          >
                            <span>Select filter</span>
                            <ChevronDown className={cn("w-4 h-4 transition-transform", showFilterDropdown && "rotate-180")} />
                          </button>

                          {showFilterDropdown && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-100 dark:bg-[#15161a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl overflow-hidden z-10">
                              {/* Search */}
                              <div className="p-2 border-b border-gray-200 dark:border-[#1f2229]">
                                <div className="relative">
                                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400" />
                                  <input
                                    type="text"
                                    value={filterSearchQuery}
                                    onChange={(e) => setFilterSearchQuery(e.target.value)}
                                    placeholder="Search..."
                                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                    autoFocus
                                  />
                                </div>
                              </div>

                              {/* Filter Options */}
                              <div className="max-h-64 overflow-y-auto">
                                {filteredFilterOptions.map(option => (
                                  <button
                                    key={option.id}
                                    onClick={() => addFilterType(option.id)}
                                    className={cn(
                                      "w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors",
                                      appliedFilterTypes.includes(option.id)
                                        ? "text-violet-400 bg-violet-500/10"
                                        : "text-gray-500 dark:text-slate-400"
                                    )}
                                  >
                                    <option.icon className="w-4 h-4" />
                                    {option.label}
                                    {appliedFilterTypes.includes(option.id) && (
                                      <CheckCircle2 className="w-4 h-4 ml-auto text-violet-500" />
                                    )}
                                  </button>
                                ))}
                                {filteredFilterOptions.length === 0 && (
                                  <div className="px-4 py-3 text-sm text-gray-400 dark:text-slate-500 text-center">
                                    No filters found
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Clear All */}
                      {hasActiveFilters && (
                        <div className="px-4 py-3 border-t border-gray-200 dark:border-[#1f2229]">
                          <button
                            onClick={clearAllFilters}
                            className="w-full px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            Clear all filters
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Closed Tasks Toggle - ClickUp Style */}
                <button
                  onClick={() => setShowClosedTasks(!showClosedTasks)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors",
                    showClosedTasks
                      ? "text-gray-900 dark:text-white bg-gray-100 dark:bg-[#15161a]"
                      : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700"
                  )}
                >
                  <CheckCircle2 className={cn("w-4 h-4", showClosedTasks && "text-green-500")} />
                  Closed
                  {/* Toggle Switch */}
                  <div className={cn(
                    "w-9 h-5 rounded-full relative transition-colors cursor-pointer",
                    showClosedTasks ? "bg-purple-600" : "bg-slate-600"
                  )}>
                    <div className={cn(
                      "w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow-sm",
                      showClosedTasks ? "right-0.5" : "left-0.5"
                    )} />
                  </div>
                </button>

                {/* Search */}
                <div className="relative flex items-center gap-2">
                  <div className="relative">
                    <Search className={cn(
                      "w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2",
                      searchQuery ? "text-violet-400" : "text-gray-500 dark:text-slate-400"
                    )} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search tasks..."
                      className={cn(
                        "w-48 pl-9 pr-8 py-1.5 text-sm bg-white dark:bg-[#14151a] border rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all",
                        searchQuery ? "border-violet-500 ring-1 ring-violet-500/50" : "border-gray-200 dark:border-[#1f2229]"
                      )}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {searchQuery && (
                    <span className="text-xs text-violet-400 whitespace-nowrap">
                      {filteredTasks.length} found
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Overview Content */}
            {activeView === 'overview' && selectedSpace && (
              <div className="flex-1 overflow-auto">
                <div className="px-6 pt-4">
                  <div className="bg-[#2e2a52] text-slate-200 text-xs rounded-lg px-4 py-2 flex items-center justify-between">
                    <span>Get the most out of your Overview! Add, reorder, and resize cards to customize this page.</span>
                    <button className="text-violet-200 hover:text-white underline">Get Started</button>
                  </div>
                </div>

                <div className="px-6 pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Filter className="w-3.5 h-3.5" />
                    Filters
                  </div>
                  <button className="px-3 py-1.5 text-xs bg-violet-600 text-white rounded hover:bg-violet-700">Add card</button>
                </div>

                {/* Cards row */}
                <div className="px-6 pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Recent */}
                  <div className="bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg p-4">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Recent</div>
                    <div className="space-y-2 text-xs text-gray-500 dark:text-slate-400">
                      {[...spaceFolders.map(f => ({ type: 'folder', name: f.name })), ...spaceDirectLists.map(l => ({ type: 'list', name: l.name })), ...spaceSprints.map(s => ({ type: 'sprint', name: s.name }))].slice(0, 5).map((item, idx) => (
                        <div key={`${item.type}-${idx}`} className="flex items-center gap-2">
                          {item.type === 'folder' ? <FolderIcon className="w-3.5 h-3.5" /> : item.type === 'sprint' ? <Flag className="w-3.5 h-3.5" /> : <ListIcon className="w-3.5 h-3.5" />}
                          <span>{item.name}</span>
                        </div>
                      ))}
                      {spaceFolders.length + spaceDirectLists.length + spaceSprints.length === 0 && (
                        <div className="text-slate-500">No recent items</div>
                      )}
                    </div>
                  </div>

                  {/* Docs */}
                  <div className="bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg p-4 relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">Docs</div>
                      <div className="relative" data-overview-doc-menu>
                        <button
                          onClick={() => setOverviewDocMenuOpen(!overviewDocMenuOpen)}
                          className="px-2 py-1 text-xs bg-violet-600 text-white rounded hover:bg-violet-700"
                        >
                          Add a Doc
                        </button>
                        {overviewDocMenuOpen && (
                          <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50">
                            <button
                              onClick={() => { setOverviewDocMenuOpen(false); createDocForSpace(true); }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-slate-700"
                            >
                              As a view
                            </button>
                            <button
                              onClick={() => { setOverviewDocMenuOpen(false); createDocForSpace(false); }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-slate-700"
                            >
                              In Sidebar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {docs.filter(d => d.space_id === selectedSpace?.id).length === 0 ? (
                      <div className="flex flex-col items-center justify-center text-center">
                        <FileText className="w-8 h-8 text-slate-500 mb-2" />
                        <div className="text-xs text-slate-400">There are no Docs in this location yet.</div>
                      </div>
                    ) : (
                      <div className="space-y-2 text-xs text-slate-400">
                        {docs.filter(d => d.space_id === selectedSpace?.id).slice(0, 5).map(doc => (
                          <button
                            key={doc.id}
                            onClick={() => setEditingDoc(doc)}
                            className="w-full text-left flex items-center gap-2 hover:text-white"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span className="truncate">{doc.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bookmarks */}
                  <div className="bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg p-4 relative">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">Bookmarks</div>
                      <button
                        onClick={() => setShowBookmarkModal(true)}
                        className="px-2 py-1 text-xs bg-violet-600 text-white rounded hover:bg-violet-700"
                      >
                        Add Bookmark
                      </button>
                    </div>
                    {bookmarks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center text-center">
                        <Bookmark className="w-8 h-8 text-slate-500 mb-2" />
                        <div className="text-xs text-slate-400">Bookmarks make it easy to save ClickUp items or any URL.</div>
                      </div>
                    ) : (
                      <div className="space-y-2 text-xs text-slate-400">
                        {bookmarks.slice(0, 5).map(b => (
                          <a key={b.id} href={b.url} target="_blank" rel="noreferrer" className="block truncate hover:text-white">
                            {b.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Folders row */}
                <div className="px-6 pt-6">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Folders</div>
                  <div className="flex flex-wrap gap-3">
                    {spaceFolders.map(folder => (
                      <button
                        key={folder.id}
                        onClick={() => { setSelectedFolder(folder); setShowSpaceOverview(false); setActiveView('list'); }}
                        className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1f2229] bg-white dark:bg-[#14151a] text-xs text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                      >
                        <FolderIcon className="w-3.5 h-3.5 inline mr-2 text-yellow-500" />
                        {folder.name}
                      </button>
                    ))}
                    {spaceFolders.length === 0 && (
                      <span className="text-xs text-slate-500">No folders yet</span>
                    )}
                  </div>
                </div>

                {/* Sprints row */}
                <div className="px-6 pt-6">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Sprints</div>
                  <div className="flex flex-wrap gap-3">
                    {spaceSprints.map(sprint => (
                      <button
                        key={sprint.id}
                        onClick={() => { setSelectedSprint(sprint); setSelectedSprintFolder(null); setShowSpaceOverview(false); setActiveView('list'); }}
                        className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1f2229] bg-white dark:bg-[#14151a] text-xs text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                      >
                        <Flag className="w-3.5 h-3.5 text-violet-400" />
                        {sprint.name}
                      </button>
                    ))}
                    {spaceSprints.length === 0 && (
                      <span className="text-xs text-slate-500">No sprints yet</span>
                    )}
                  </div>
                </div>

                {/* Lists table */}
                <div className="px-6 pt-6 pb-10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">Lists</div>
                    <button
                      onClick={() => openCreateList()}
                      className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> New List
                    </button>
                  </div>
                  <div className="bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-[#1f2229] text-slate-400">
                          <th className="text-left px-4 py-3">Name</th>
                          <th className="text-left px-4 py-3">Color</th>
                          <th className="text-left px-4 py-3">Progress</th>
                          <th className="text-left px-4 py-3">Start</th>
                          <th className="text-left px-4 py-3">End</th>
                          <th className="text-left px-4 py-3">Priority</th>
                          <th className="text-left px-4 py-3">Owner</th>
                        </tr>
                      </thead>
                      <tbody>
                        {spaceAllLists.map(list => (
                          <tr
                            key={list.id}
                            className="border-b border-gray-200 dark:border-[#1f2229] hover:bg-gray-100 dark:hover:bg-slate-700/50 cursor-pointer"
                            onClick={() => { setSelectedList(list); setSelectedSprint(null); setSelectedSprintFolder(null); setShowSpaceOverview(false); setActiveView('list'); }}
                          >
                            <td className="px-4 py-3 text-gray-900 dark:text-white">{list.name}</td>
                            <td className="px-4 py-3"><div className="w-3 h-3 rounded" style={{ backgroundColor: list.color }} /></td>
                            <td className="px-4 py-3 text-slate-500">
                              {getListCompletedCount(list.id)}/{getListTaskCount(list.id)}
                            </td>
                            <td className="px-4 py-3 text-slate-500">-</td>
                            <td className="px-4 py-3 text-slate-500">-</td>
                            <td className="px-4 py-3 text-slate-500">-</td>
                            <td className="px-4 py-3 text-slate-500">-</td>
                          </tr>
                        ))}
                        <tr className="hover:bg-gray-100 dark:hover:bg-slate-700/50 cursor-pointer" onClick={() => openCreateList()}>
                          <td colSpan={7} className="px-4 py-3 text-slate-400">
                            <Plus className="w-3.5 h-3.5 inline mr-2" /> New List
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* List View Content */}
            {activeView === 'list' && (
              <div className="flex-1 overflow-auto">
                {/* Space-level empty list layout (ClickUp style) */}
                {showSpaceListOverview && (
                  <div className="px-4 pt-4 pb-2">
                    <div className="mb-4 rounded-lg border border-gray-200 dark:border-[#1f2229] bg-white/5 dark:bg-[#14151a] px-4 py-2 text-xs text-gray-400">
                      <span className="font-medium text-gray-200">Setup your List:</span>{' '}
                      <button
                        onClick={() => { setShowViewPanel(true); setViewPanelStep('fields'); }}
                        className="text-violet-400 hover:text-violet-300"
                      >
                        Create new fields
                      </button>
                      <span className="mx-2 text-gray-500">•</span>
                      <button
                        onClick={() => toast.info('Copy settings coming soon')}
                        className="text-violet-400 hover:text-violet-300"
                      >
                        Copy settings from another list
                      </button>
                    </div>

                    <div className="space-y-4">
                      {spaceFolders.map(folder => {
                        const folderLists = taskLists.filter(l => l.folder_id === folder.id);
                        return (
                          <div key={folder.id} className="border border-gray-200 dark:border-[#1f2229] rounded-lg bg-white/5 dark:bg-[#14151a]">
                            <div className="px-4 py-3 text-sm text-gray-200 flex items-center gap-2">
                              <FolderIcon className="w-4 h-4 text-yellow-500" />
                              {folder.name}
                            </div>
                            <div className="border-t border-gray-200 dark:border-[#1f2229]">
                              {folderLists.map(list => (
                                <div key={list.id} className="px-4 py-3 border-b border-gray-200 dark:border-[#1f2229] last:border-b-0">
                                  {(() => {
                                    const groups = getStatusGroupsForList(list.id);
                                    if (groups.length === 0) {
                                      return (
                                        <>
                                          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                                            <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-200">TO DO</span>
                                            <button
                                              onClick={() => { setSelectedList(list); setActiveView('list'); }}
                                              className="text-slate-300 hover:text-white"
                                            >
                                              {list.name}
                                            </button>
                                            <button
                                              onClick={() => openAddTask('To Do', folder.id, list.id)}
                                              className="ml-auto text-slate-400 hover:text-white flex items-center gap-1"
                                            >
                                              <Plus className="w-3 h-3" /> Add Task
                                            </button>
                                          </div>
                                          <div className="text-[11px] uppercase text-slate-500 mb-1">Name</div>
                                          <button
                                            onClick={() => openAddTask('To Do', folder.id, list.id)}
                                            className="text-sm text-slate-500 hover:text-white flex items-center gap-2"
                                          >
                                            <Plus className="w-3 h-3" /> Add Task
                                          </button>
                                        </>
                                      );
                                    }

                                    return groups.map(group => (
                                      <div key={`${list.id}-${group.status}`} className="mb-3 last:mb-0">
                                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                                          <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-200">
                                            {group.status.toString().toUpperCase()}
                                          </span>
                                          <button
                                            onClick={() => { setSelectedList(list); setActiveView('list'); }}
                                            className="text-slate-300 hover:text-white"
                                          >
                                            {list.name}
                                          </button>
                                          <button
                                            onClick={() => openAddTask(group.status.toString(), folder.id, list.id)}
                                            className="ml-auto text-slate-400 hover:text-white flex items-center gap-1"
                                          >
                                            <Plus className="w-3 h-3" /> Add Task
                                          </button>
                                        </div>
                                        <div className="flex items-center text-[11px] uppercase text-slate-500 mb-1">
                                          <div className="flex-1">Name</div>
                                          <div className="w-28 text-center">Assignee</div>
                                          <div className="w-24 text-center">Due date</div>
                                          <div className="w-20 text-center">Priority</div>
                                        </div>
                                        <div className="border border-gray-200 dark:border-[#1f2229] rounded-md overflow-hidden">
                                          {group.items.map(task => (
                                            <div
                                              key={task.id}
                                              onClick={() => openEditTask(task)}
                                              className="flex items-center px-2 py-2 text-sm text-gray-200 border-t border-gray-200 dark:border-[#1f2229] first:border-t-0 hover:bg-white/5 cursor-pointer"
                                            >
                                              <div className="flex-1 truncate">{task.name}</div>
                                              <div className="w-28 flex justify-center">{renderMiniAssignees(task)}</div>
                                              <div className="w-24 text-center text-xs text-gray-500 dark:text-slate-500">
                                                {task.due_date ? new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                                              </div>
                                              <div className="w-20 text-center">
                                                {task.priority ? (
                                                  <Flag className="w-3.5 h-3.5 inline" style={{ color: priorities.find(p => p.value === task.priority)?.flagColor || '#94a3b8' }} />
                                                ) : (
                                                  <span className="text-xs text-gray-500 dark:text-slate-500">—</span>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ));
                                  })()}
                                </div>
                              ))}
                            </div>
                          </div>
                      );
                      })}

                      {spaceDirectLists.map(list => (
                        <div key={list.id} className="border border-gray-200 dark:border-[#1f2229] rounded-lg bg-white/5 dark:bg-[#14151a]">
                          <div className="px-4 py-3 text-sm text-gray-200 flex items-center gap-2">
                            <ListIcon className="w-4 h-4 text-slate-400" />
                            {list.name}
                          </div>
                          <div className="border-t border-gray-200 dark:border-[#1f2229] px-4 py-3">
                            {(() => {
                              const groups = getStatusGroupsForList(list.id);
                              if (groups.length === 0) {
                                return (
                                  <>
                                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                                      <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-200">TO DO</span>
                                      <button
                                        onClick={() => openAddTask('To Do', undefined, list.id)}
                                        className="ml-auto text-slate-400 hover:text-white flex items-center gap-1"
                                      >
                                        <Plus className="w-3 h-3" /> Add Task
                                      </button>
                                    </div>
                                    <div className="text-[11px] uppercase text-slate-500 mb-1">Name</div>
                                    <button
                                      onClick={() => openAddTask('To Do', undefined, list.id)}
                                      className="text-sm text-slate-500 hover:text-white flex items-center gap-2"
                                    >
                                      <Plus className="w-3 h-3" /> Add Task
                                    </button>
                                  </>
                                );
                              }

                              return groups.map(group => (
                                <div key={`${list.id}-${group.status}`} className="mb-3 last:mb-0">
                                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                                    <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-200">
                                      {group.status.toString().toUpperCase()}
                                    </span>
                                    <button
                                      onClick={() => openAddTask(group.status.toString(), undefined, list.id)}
                                      className="ml-auto text-slate-400 hover:text-white flex items-center gap-1"
                                    >
                                      <Plus className="w-3 h-3" /> Add Task
                                    </button>
                                  </div>
                                  <div className="flex items-center text-[11px] uppercase text-slate-500 mb-1">
                                    <div className="flex-1">Name</div>
                                    <div className="w-28 text-center">Assignee</div>
                                    <div className="w-24 text-center">Due date</div>
                                    <div className="w-20 text-center">Priority</div>
                                  </div>
                                  <div className="border border-gray-200 dark:border-[#1f2229] rounded-md overflow-hidden">
                                    {group.items.map(task => (
                                      <div
                                        key={task.id}
                                        onClick={() => openEditTask(task)}
                                        className="flex items-center px-2 py-2 text-sm text-gray-200 border-t border-gray-200 dark:border-[#1f2229] first:border-t-0 hover:bg-white/5 cursor-pointer"
                                      >
                                        <div className="flex-1 truncate">{task.name}</div>
                                        <div className="w-28 flex justify-center">{renderMiniAssignees(task)}</div>
                                        <div className="w-24 text-center text-xs text-gray-500 dark:text-slate-500">
                                          {task.due_date ? new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                                        </div>
                                        <div className="w-20 text-center">
                                          {task.priority ? (
                                            <Flag className="w-3.5 h-3.5 inline" style={{ color: priorities.find(p => p.value === task.priority)?.flagColor || '#94a3b8' }} />
                                          ) : (
                                            <span className="text-xs text-gray-500 dark:text-slate-500">—</span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!showSpaceListOverview && (
                <>
                {/* Sprint Header - shown when sprint is selected */}
                {selectedSprint && (() => {
                  const sprintTasks = tasks.filter(t => t.sprint_id === selectedSprint.id);
                  const spStatus = getSprintStatus(selectedSprint);
                  const spStatusLabel = getSprintStatusLabel(spStatus);
                  const spStatusColor = getSprintStatusColor(spStatus);
                  const totalPts = sprintTasks.reduce((sum, t) => sum + (t.sprint_points || 0), 0);
                  const completedPts = sprintTasks.filter(t => t.status === 'Done').reduce((sum, t) => sum + (t.sprint_points || 0), 0);
                  const progressPct = totalPts > 0 ? Math.round((completedPts / totalPts) * 100) : 0;
                  const folderSprints = sprints.filter(s => s.sprint_folder_id === selectedSprint.sprint_folder_id);
                  const nextSp = folderSprints.find(s => s.position > selectedSprint.position);

                  return (
                    <div className="px-6 py-3 border-b border-gray-200 dark:border-[#1f2229] bg-white dark:bg-[#0a0a0f]">
                      {/* Breadcrumb */}
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xs text-gray-500 dark:text-slate-500 font-medium">
                          {selectedSpace?.name}{selectedFolder ? ` / ${selectedFolder.name}` : ''}
                        </span>
                      </div>

                      {/* Sprint Title and Metadata */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2.5">
                            <Zap className="w-5 h-5 text-teal-500" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                              {selectedSprint.name}
                            </h2>
                          </div>
                          <span
                            className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide"
                            style={{ backgroundColor: spStatusColor + '25', color: spStatusColor }}
                          >
                            {spStatusLabel}
                          </span>
                        </div>
                        {spStatus === 'done' && nextSp && (
                          <button
                            onClick={() => rolloverSprintMutation.mutate({ sprintId: selectedSprint.id, targetSprintId: nextSp.id })}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-600/15 text-amber-500 hover:bg-amber-600/25 rounded-md transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Rollover to {nextSp.name}
                          </button>
                        )}
                      </div>

                      {/* Sprint Info Row */}
                      <div className="flex items-center gap-5 text-sm">
                        <div className="flex items-center gap-1.5 text-gray-600 dark:text-slate-400">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {new Date(selectedSprint.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                            {' - '}
                            {new Date(selectedSprint.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-600 dark:text-slate-400">
                          <span className="text-gray-500 dark:text-slate-500">·</span>
                          <span className="font-medium">{sprintTasks.length}</span>
                          <span>{sprintTasks.length === 1 ? 'task' : 'tasks'} in this sprint</span>
                        </div>
                        {totalPts > 0 && (
                          <>
                            <div className="flex items-center gap-1.5 text-gray-600 dark:text-slate-400">
                              <span className="text-gray-500 dark:text-slate-500">·</span>
                              <span className="font-medium">{completedPts}/{totalPts}</span>
                              <span>points ({progressPct}%)</span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Progress Bar */}
                      {totalPts > 0 && (
                        <div className="mt-4 w-full h-1.5 bg-gray-200 dark:bg-[#1a1b20] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${progressPct}%`, backgroundColor: spStatusColor }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Breadcrumb - hide when sprint header is shown */}
                {!selectedSprint && (
                  <div className="px-6 py-3 text-sm text-gray-500 dark:text-slate-400">
                    {showEverything ? (
                      <span>Everything</span>
                    ) : (
                      <>
                        {selectedSpace?.name}
                        {selectedFolder && ` / ${selectedFolder.name}`}
                        {selectedList && ` / ${selectedList.name}`}
                      </>
                    )}
                  </div>
                )}

                {/* Unfinished Tasks Banner */}
                {!selectedSprint && stats.unfinished > 0 && (
                  <div className="mx-4 mb-4 px-4 py-2.5 bg-gradient-to-r from-teal-600/10 to-transparent border-l-4 border-teal-500 rounded">
                    <p className="text-center text-gray-600 dark:text-slate-300 text-sm">
                      {showEverything ? 'You have' : 'This ' + (selectedFolder ? 'list' : 'space') + ' has'}{' '}
                      <span className="font-medium text-teal-400 underline cursor-pointer hover:text-teal-300">
                        {stats.unfinished} unfinished tasks
                      </span>
                    </p>
                  </div>
                )}

                {/* Status Inheritance Banner - List */}
                {selectedList && (
                  <div className={`mx-4 mb-4 px-4 py-2.5 rounded flex items-center justify-between ${
                    listHasCustomStatuses
                      ? 'bg-gray-100 dark:bg-[#1a1b23] border border-gray-200 dark:border-[#2a2b35]'
                      : 'bg-gradient-to-r from-violet-600/10 to-teal-600/10 border border-violet-500/20 dark:border-violet-500/30'
                  }`}>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`w-2 h-2 rounded-full ${listHasCustomStatuses ? 'bg-violet-400' : 'bg-teal-400 animate-pulse'}`} />
                      {listHasCustomStatuses ? (
                        <span className="text-gray-600 dark:text-slate-300">Custom statuses</span>
                      ) : (
                        <span className="text-gray-600 dark:text-slate-300">
                          Using statuses from <span className="font-medium text-violet-400">"{selectedSpace?.name || 'Space'}"</span>
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => openListTaskStatuses(selectedList)}
                      className={`text-xs font-medium px-3 py-1 rounded transition-colors ${
                        listHasCustomStatuses
                          ? 'text-violet-400 hover:bg-violet-500/10'
                          : 'text-teal-400 bg-teal-500/10 hover:bg-teal-500/20'
                      }`}
                    >
                      {listHasCustomStatuses ? 'Edit' : 'Edit Statuses'}
                    </button>
                  </div>
                )}

                {/* Status Inheritance Banner - Sprint */}
                {selectedSprint && !selectedList && (
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
                          Using statuses from <span className="font-medium text-violet-400">"{selectedSpace?.name || 'Space'}"</span>
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => openSprintTaskStatuses(selectedSprint)}
                      className={`text-xs font-medium px-3 py-1 rounded transition-colors ${
                        sprintHasCustomStatuses
                          ? 'text-violet-400 hover:bg-violet-500/10'
                          : 'text-teal-400 bg-teal-500/10 hover:bg-teal-500/20'
                      }`}
                    >
                      {sprintHasCustomStatuses ? 'Edit' : 'Edit Statuses'}
                    </button>
                  </div>
                )}

                {/* Folder Collection View - Show lists inside folder when folder is selected but not a specific list or sprint */}
                {selectedFolder && !selectedList && !selectedSprint && activeView === 'list' && folderLists.length > 0 && (
                  <div className="pb-8">
                    {folderLists.map(list => {
                      const listTasks = getTasksForList(list.id);
                      const isExpanded = isGroupExpanded(`list-${list.id}`);
                      return (
                        <div key={list.id} className="mb-4">
                          {/* List Header */}
                          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-[#14151a] hover:bg-gray-100 dark:hover:bg-slate-700/50 border-b border-gray-200 dark:border-[#1f2229] group">
                            <button
                              onClick={() => toggleGroup(`list-${list.id}`)}
                              className="p-0.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                              )}
                            </button>
                            <ListIcon className="w-4 h-4 text-violet-400" />
                            <button
                              onClick={() => { setSelectedList(list); }}
                              className="text-sm font-semibold text-gray-900 dark:text-white hover:text-violet-400 transition-colors"
                            >
                              {list.name}
                            </button>
                            <span className="text-xs text-gray-400 dark:text-slate-500 font-medium ml-1">
                              {listTasks.length} tasks
                            </span>
                            <button
                              onClick={() => openAddTask('To Do', selectedFolder?.id, list.id)}
                              className="ml-auto px-2 py-1 text-xs text-gray-500 dark:text-slate-400 hover:text-violet-400 hover:bg-gray-200 dark:hover:bg-slate-700 rounded opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Add Task
                            </button>
                          </div>
                          {/* List Tasks */}
                          {isExpanded && (
                            <div className="border-l-2 border-violet-500/30 ml-4">
                              {listTasks.length === 0 ? (
                                <div className="px-4 py-6 text-center text-gray-500 dark:text-slate-500 text-sm">
                                  No tasks in this list.{' '}
                                  <button
                                    onClick={() => openAddTask('To Do', selectedFolder?.id, list.id)}
                                    className="text-violet-400 hover:text-violet-300"
                                  >
                                    Add one
                                  </button>
                                </div>
                              ) : (
                                listTasks.map(task => {
                                const isDone = task.status === 'Done' || task.status === 'DONE' || task.status === 'COMPLETED';
                                return (
                                  <div
                                    key={task.id}
                                    onClick={() => openEditTask(task)}
                                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer border-b border-gray-100 dark:border-[#1f2229] group"
                                  >
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateTaskMutation.mutate({
                                          id: task.id,
                                          data: { status: isDone ? 'To Do' : 'Done' }
                                        });
                                      }}
                                      className={cn(
                                        "w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors",
                                        isDone
                                          ? "bg-green-500 border-green-500"
                                          : "border-gray-300 dark:border-[#1f2229] hover:border-green-500"
                                      )}
                                    >
                                      {isDone && (
                                        <Check className="w-3 h-3 text-white" />
                                      )}
                                    </button>
                                    <span className="text-sm text-gray-900 dark:text-white flex-1 truncate">
                                      {task.name}
                                    </span>
                                    {task.status && (
                                      <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-gray-200 dark:bg-[#15161a] text-gray-600 dark:text-slate-300">
                                        {task.status}
                                      </span>
                                    )}
                                    {task.priority && (
                                      <Flag className="w-3.5 h-3.5" style={{ color: priorities.find(p => p.value === task.priority)?.flagColor || '#94a3b8' }} />
                                    )}
                                    {task.due_date && (
                                      <span className="text-xs text-gray-500 dark:text-slate-500">
                                        {new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                      </span>
                                    )}
                                  </div>
                                );
                              })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* Add List button at bottom */}
                    <button
                      onClick={() => { openCreateList(); }}
                      className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500 dark:text-slate-500 hover:text-violet-400 hover:bg-gray-50 dark:hover:bg-slate-800/50 w-full"
                    >
                      <Plus className="w-4 h-4" />
                      Add List
                    </button>
                  </div>
                )}

                {/* ClickUp-Style Task Groups - Show when NOT in folder collection view */}
                {(!selectedFolder || selectedList || selectedSprint || activeView !== 'list' || folderLists.length === 0) && (
                <div className="pb-8">
                  {((selectedList && selectedListTaskCount === 0) || (selectedSprint && selectedSprintTaskCount === 0)) ? (
                    <div className="px-4 pb-6">
                      {/* Empty list header */}
                      <DndContext
                        sensors={sensors}
                        collisionDetection={pointerWithin}
                        onDragStart={handleColumnDragStart}
                        onDragEnd={handleUnifiedColumnDragEnd}
                      >
                        <div className="flex items-center px-4 py-2.5 text-[11px] text-gray-500 dark:text-slate-500 font-medium uppercase tracking-wider bg-gray-50/50 dark:bg-[#0a0a0f] border-b border-gray-200 dark:border-[#1f2229]">
                          <SortableContext
                            items={allColumnIds}
                            strategy={horizontalListSortingStrategy}
                          >
                            {allColumnIds.map((id, idx) => {
                              const isBaseField = ['name', 'assignee', 'due_date', 'priority', 'status'].includes(id);
                              const isSprintField = id === 'sprint_points' || id === 'sprints';

                              if (isSprintField) {
                                const sprintLabel = id === 'sprint_points' ? 'Sprint Points' : 'Sprints';
                                const sprintWidth = id === 'sprint_points' ? 'w-24 text-center' : 'w-56 text-center';
                                return (
                                  <SortableBaseColumnHeader
                                    key={id}
                                    slotKey={id as BaseFieldKey}
                                    index={idx}
                                    total={allColumnIds.length}
                                    label={sprintLabel}
                                    widthClass={sprintWidth}
                                    openColumnMenuId={openColumnMenuId}
                                    setOpenColumnMenuId={setOpenColumnMenuId}
                                    moveBaseField={moveBaseField}
                                    toggleBaseColumnVisibility={toggleBaseColumnVisibility}
                                    groupBy={groupBy}
                                    effectiveListViewSettings={effectiveListViewSettings}
                                  />
                                );
                              }

                              if (isBaseField) {
                                const key = id as BaseFieldKey;
                                const isName = key === 'name';
                                if (isName && !effectiveListViewSettings.fields.name) return null;
                                if (key === 'assignee') {
                                  const shouldShow = groupBy === 'assignee'
                                    ? effectiveListViewSettings.fields.status
                                    : effectiveListViewSettings.fields.assignee;
                                  if (!shouldShow) return null;
                                }
                                if (key === 'due_date' && !effectiveListViewSettings.fields.due_date) return null;
                                if (key === 'priority' && !effectiveListViewSettings.fields.priority) return null;
                                if (key === 'status' && !effectiveListViewSettings.fields.status) return null;

                                const label = key === 'status'
                                  ? 'Status'
                                  : key === 'assignee'
                                    ? (groupBy === 'assignee' ? 'Status' : 'Assignee')
                                    : key === 'due_date'
                                      ? 'Due date'
                                      : key === 'priority'
                                        ? 'Priority'
                                        : 'Name';

                                const widthClass = key === 'name' ? 'flex-1 pl-8' : (key === 'assignee' || key === 'status') ? 'w-28 text-center' : 'w-24 text-center';

                                return (
                                  <SortableBaseColumnHeader
                                    key={key}
                                    slotKey={key}
                                    index={idx}
                                    total={allColumnIds.length}
                                    label={label}
                                    widthClass={widthClass}
                                    openColumnMenuId={openColumnMenuId}
                                    setOpenColumnMenuId={setOpenColumnMenuId}
                                    moveBaseField={moveBaseField}
                                    toggleBaseColumnVisibility={toggleBaseColumnVisibility}
                                    groupBy={groupBy}
                                    effectiveListViewSettings={effectiveListViewSettings}
                                  />
                                );
                              } else {
                                const field = orderedCustomFields.find(f => f.id === id);
                                if (!field) return null;

                                return (
                                  <SortableColumnHeader
                                    key={field.id}
                                    field={field}
                                    idx={idx}
                                    totalFields={allColumnIds.length}
                                    openColumnMenuId={openColumnMenuId}
                                    setOpenColumnMenuId={setOpenColumnMenuId}
                                    moveCustomField={moveCustomField}
                                    applyListViewSettings={applyListViewSettings}
                                    deleteCustomFieldMutation={deleteCustomFieldMutation}
                                  />
                                );
                              }
                            })}
                          </SortableContext>
                          {/* Add Column Button */}
                          {(selectedList || selectedSprint) && (
                            <button
                              onClick={() => {
                                if (!canEdit) {
                                  toast.error('View only');
                                  return;
                                }
                                setShowViewPanel(true);
                                setViewPanelStep('fields');
                              }}
                              className={cn(
                                "w-20 flex items-center justify-center",
                                canEdit
                                  ? "text-gray-400 dark:text-slate-500 hover:text-violet-400"
                                  : "text-gray-300 dark:text-slate-600 cursor-not-allowed"
                              )}
                            >
                              <div className={cn(
                                "w-6 h-6 rounded-full border border-dashed flex items-center justify-center transition-colors",
                                canEdit
                                  ? "border-gray-300 dark:border-slate-600 hover:border-violet-400 hover:text-violet-400"
                                  : "border-gray-200 dark:border-slate-700"
                              )}>
                                <Plus className="w-3 h-3" />
                              </div>
                            </button>
                          )}
                          <div className="w-8" />
                        </div>
                      </DndContext>

                      {/* Empty list inline add task row */}
                      <div className="w-full flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-[#1a1b20] hover:bg-gray-50 dark:hover:bg-[#0f1014] transition-colors">
                        <div className="w-5 h-5 rounded border-2 border-gray-300 dark:border-[#2a2b36] flex items-center justify-center text-gray-400 dark:text-slate-500">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                        <input
                          value={inlineEmptyTaskName}
                          onChange={(e) => setInlineEmptyTaskName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              createInlineEmptyTask();
                            } else if (e.key === 'Escape') {
                              setInlineEmptyTaskName('');
                            }
                          }}
                          placeholder="Task Name or type '/' for commands"
                          className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-600 focus:outline-none"
                        />
                        <div className="flex items-center gap-2">
                          <div className="relative" data-inline-empty-assignee>
                            <button
                              onClick={() => {
                                setInlineEmptyAssigneeOpen(!inlineEmptyAssigneeOpen);
                                setAssigneeSearchQuery('');
                              }}
                              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 dark:text-slate-500"
                              title="Assignee"
                            >
                              <User className="w-4 h-4" />
                            </button>
                            {inlineEmptyAssigneeOpen && (
                              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-xl shadow-2xl z-50 w-64 overflow-hidden">
                                <div className="p-2 border-b border-gray-200 dark:border-[#1f2229]">
                                  <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                                    <input
                                      type="text"
                                      value={assigneeSearchQuery}
                                      onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                                      placeholder="Search..."
                                      className="w-full pl-8 pr-2 py-1.5 bg-gray-100 dark:bg-[#2e2f3a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-xs text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                                      autoFocus
                                    />
                                  </div>
                                </div>
                                <div className="max-h-48 overflow-y-auto py-1">
                                  {availableMembers
                                    .filter((m: Member) =>
                                      m.name.toLowerCase().includes(assigneeSearchQuery.toLowerCase()) ||
                                      m.email.toLowerCase().includes(assigneeSearchQuery.toLowerCase())
                                    )
                                    .map((member: Member) => {
                                      const isSelected = inlineEmptyAssignees.includes(member.name);
                                      const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#3b82f6', '#22c55e', '#f97316'];
                                      const colorIndex = member.name.charCodeAt(0) % colors.length;
                                      return (
                                        <button
                                          key={member.id}
                                          onClick={() => {
                                            setInlineEmptyAssignees(prev =>
                                              isSelected ? prev.filter(a => a !== member.name) : [...prev, member.name]
                                            );
                                          }}
                                          className={cn(
                                            "w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors",
                                            isSelected ? "bg-violet-500/20" : "hover:bg-gray-100 dark:hover:bg-slate-700"
                                          )}
                                        >
                                          <div className={cn(
                                            "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                                            isSelected ? "bg-violet-500 border-violet-500" : "border-gray-300 dark:border-slate-500"
                                          )}>
                                            {isSelected && <Check className="w-3 h-3 text-white" />}
                                          </div>
                                          <Avatar className="w-6 h-6">
                                            <AvatarFallback
                                              className="text-white text-[9px] font-bold"
                                              style={{ backgroundColor: colors[colorIndex] }}
                                            >
                                              {member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                            </AvatarFallback>
                                          </Avatar>
                                          <div className="flex-1 text-left truncate">
                                            <span className={isSelected ? "text-violet-300" : "text-gray-900 dark:text-white"}>{member.name}</span>
                                          </div>
                                        </button>
                                      );
                                    })}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="relative" data-inline-empty-date>
                            <button
                              onClick={() => setInlineEmptyDateOpen(!inlineEmptyDateOpen)}
                              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 dark:text-slate-500"
                              title="Due date"
                            >
                              <Calendar className="w-4 h-4" />
                            </button>
                            {inlineEmptyDateOpen && (
                              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-xl shadow-2xl z-50 overflow-hidden">
                                <div className="p-2">
                                  <input
                                    type="date"
                                    value={inlineEmptyDueDate}
                                    onChange={(e) => setInlineEmptyDueDate(e.target.value)}
                                    className="bg-gray-100 dark:bg-[#2e2f3a] border border-gray-200 dark:border-[#1f2229] rounded px-2 py-1 text-xs text-gray-900 dark:text-white"
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="relative" data-inline-empty-priority>
                            <button
                              onClick={() => setInlineEmptyPriorityOpen(!inlineEmptyPriorityOpen)}
                              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 dark:text-slate-500"
                              title="Priority"
                            >
                              <Flag className="w-4 h-4" />
                            </button>
                            {inlineEmptyPriorityOpen && (
                              <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50">
                                {priorities.map(p => (
                                  <button
                                    key={p.value}
                                    onClick={() => { setInlineEmptyPriority(p.value); setInlineEmptyPriorityOpen(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-slate-700"
                                  >
                                    <Flag className="w-3.5 h-3.5" style={{ color: p.flagColor }} />
                                    <span>{p.label}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={createInlineEmptyTask}
                            disabled={!inlineEmptyTaskName.trim()}
                            className="px-3 py-1.5 text-xs font-medium bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                  <>
                  {Object.entries(groupedTasks).map(([key, group]) => (
                    <div key={key}>
                      {/* Group Header Row - ClickUp Style */}
                      <div className="flex items-center gap-2.5 px-4 py-2 bg-white dark:bg-[#0f1014] hover:bg-[#f7f8fb] dark:hover:bg-[#0f1014] group border-b border-gray-200 dark:border-[#1f2229]">
                        {/* Collapse/Expand Arrow */}
                        <button
                          onClick={() => toggleGroup(key)}
                          className="p-0.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded transition-colors"
                        >
                          {isGroupExpanded(key) ? (
                            <ChevronDown className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                          )}
                        </button>

                        {/* Group Badge - ClickUp Style */}
                        <div className="flex items-center gap-2.5">
                          {groupBy === 'assignee' ? (
                            <>
                              {key === 'Unassigned' ? (
                                <div className="w-5 h-5 rounded-full bg-gray-300 dark:bg-slate-600 flex items-center justify-center">
                                  <UserX className="w-3 h-3 text-gray-500 dark:text-slate-400" />
                                </div>
                              ) : (
                                <Avatar className="w-5 h-5">
                                  <AvatarFallback
                                    className="text-white text-[9px] font-bold"
                                    style={{ backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#3b82f6', '#22c55e', '#f97316'][group.name.charCodeAt(0) % 6] }}
                                  >
                                    {group.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {group.name}
                              </span>
                            </>
                          ) : (
                            <>
                              <span
                                className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider"
                                style={{ backgroundColor: group.color, color: 'white' }}
                              >
                                {group.name}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Task Count */}
                        <span className="text-xs text-gray-500 dark:text-slate-500 font-medium">
                          {group.tasks.length}
                        </span>

                        {/* More Options - Status Menu */}
                        {groupBy === 'status' && !showEverything && (
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenStatusMenuId(openStatusMenuId === key ? null : key);
                              }}
                              className="p-1 text-gray-400 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-slate-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Status options"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            {openStatusMenuId === key && (
                              <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 py-1 min-w-[140px]">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const status = statuses.find(s => s.name === key);
                                    if (status) openEditStatus(status);
                                  }}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white"
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Edit Status
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const statusToDelete = statuses.find(s => s.name === key);
                                    if (statusToDelete) handleDeleteStatus(statusToDelete);
                                  }}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-red-300"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete Status
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Add Task Button - Inline */}
                        {!showEverything && (groupBy === 'status' || groupBy === 'assignee') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setInlineAddGroup(key);
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-slate-700 rounded ml-auto"
                          >
                            <Plus className="w-3 h-3" />
                            Add Task
                          </button>
                        )}
                      </div>

                      {/* Expanded Task List */}
                      {isGroupExpanded(key) && (
                        <>
                          {/* Column Headers - ClickUp Style */}
                          <DndContext
                            sensors={sensors}
                            collisionDetection={pointerWithin}
                            onDragStart={handleColumnDragStart}
                            onDragEnd={handleUnifiedColumnDragEnd}
                          >
                            <div className="flex items-center py-2.5 text-[11px] text-gray-500 dark:text-slate-500 font-medium uppercase tracking-wider bg-[#f6f7fb] dark:bg-[#0a0a0f] border-b border-gray-200 dark:border-[#1f2229]">
                              {/* Spacer to match drag handle width in task rows */}
                              <div className="w-6 flex-shrink-0" />
                              <div className="flex-1 flex items-center min-w-0 px-4">
                              {/* All Columns (Base + Custom) - Unified Drag & Drop */}
                              <SortableContext
                                items={allColumnIds}
                                strategy={horizontalListSortingStrategy}
                              >
                                {allColumnIds.map((id, idx) => {
                                  // Check field type
                                  const isBaseField = ['name', 'assignee', 'due_date', 'priority', 'status'].includes(id);
                                  const isSprintField = id === 'sprint_points' || id === 'sprints';

                                  if (isSprintField) {
                                    const sprintLabel = id === 'sprint_points' ? 'Sprint Points' : 'Sprints';
                                    const sprintWidth = id === 'sprint_points' ? 'w-24 text-center' : 'w-56 text-center';
                                    return (
                                      <SortableBaseColumnHeader
                                        key={id}
                                        slotKey={id as BaseFieldKey}
                                        index={idx}
                                        total={allColumnIds.length}
                                        label={sprintLabel}
                                        widthClass={sprintWidth}
                                        openColumnMenuId={openColumnMenuId}
                                        setOpenColumnMenuId={setOpenColumnMenuId}
                                        moveBaseField={moveBaseField}
                                        toggleBaseColumnVisibility={toggleBaseColumnVisibility}
                                        groupBy={groupBy}
                                        effectiveListViewSettings={effectiveListViewSettings}
                                        groupKey={key}
                                      />
                                    );
                                  }

                                  if (isBaseField) {
                                    const colKey = id as BaseFieldKey;
                                  const isName = colKey === 'name';
                                  const columnKey: BaseFieldKey = colKey === 'assignee'
                                    ? (groupBy === 'assignee' ? 'status' : 'assignee')
                                    : colKey;

                                  if (isName && !effectiveListViewSettings.fields.name) return null;
                                  if (colKey === 'assignee') {
                                    const shouldShow = groupBy === 'assignee'
                                      ? effectiveListViewSettings.fields.status
                                      : effectiveListViewSettings.fields.assignee;
                                    if (!shouldShow) return null;
                                  }
                                  if (colKey === 'due_date' && !effectiveListViewSettings.fields.due_date) return null;
                                  if (colKey === 'priority' && !effectiveListViewSettings.fields.priority) return null;
                                  if (colKey === 'status' && !effectiveListViewSettings.fields.status) return null;

                                  const label = colKey === 'status'
                                    ? 'Status'
                                    : colKey === 'assignee'
                                      ? (groupBy === 'assignee' ? 'Status' : 'Assignee')
                                      : colKey === 'due_date'
                                        ? 'Due date'
                                        : colKey === 'priority'
                                          ? 'Priority'
                                          : 'Name';

                                  const widthClass = colKey === 'name' ? 'flex-1 pl-8' : (colKey === 'assignee' || colKey === 'status') ? 'w-28 text-center' : 'w-24 text-center';

                                  return (
                                    <SortableBaseColumnHeader
                                      key={colKey}
                                      slotKey={colKey}
                                      index={idx}
                                      total={allColumnIds.length}
                                      label={label}
                                      widthClass={widthClass}
                                      openColumnMenuId={openColumnMenuId}
                                      setOpenColumnMenuId={setOpenColumnMenuId}
                                      moveBaseField={moveBaseField}
                                      toggleBaseColumnVisibility={toggleBaseColumnVisibility}
                                      groupBy={groupBy}
                                      effectiveListViewSettings={effectiveListViewSettings}
                                      groupKey={key}
                                    />
                                  );
                                  } else {
                                    // This is a custom field
                                    const field = orderedCustomFields.find(f => f.id === id);
                                    if (!field) return null;

                                    return (
                                      <SortableColumnHeader
                                        key={field.id}
                                        field={field}
                                        idx={idx}
                                        totalFields={allColumnIds.length}
                                        openColumnMenuId={openColumnMenuId}
                                        setOpenColumnMenuId={setOpenColumnMenuId}
                                        moveCustomField={moveCustomField}
                                        applyListViewSettings={applyListViewSettings}
                                        deleteCustomFieldMutation={deleteCustomFieldMutation}
                                        groupKey={key}
                                      />
                                    );
                                  }
                                })}
                              </SortableContext>
                              {/* Add Column Button - show for both lists and sprints */}
                              {(selectedList || selectedSprint) && (
                                <button
                                  onClick={() => {
                                    if (!canEdit) {
                                      toast.error('View only');
                                      return;
                                    }
                                    setShowViewPanel(true);
                                    setViewPanelStep('fields');
                                  }}
                                  className={cn(
                                    "w-20 flex items-center justify-center",
                                    canEdit
                                      ? "text-gray-400 dark:text-slate-500 hover:text-violet-400"
                                      : "text-gray-300 dark:text-slate-600 cursor-not-allowed"
                                  )}
                                >
                                  <div className={cn(
                                    "w-6 h-6 rounded-full border border-dashed flex items-center justify-center transition-colors",
                                    canEdit
                                      ? "border-gray-300 dark:border-slate-600 hover:border-violet-400 hover:text-violet-400"
                                      : "border-gray-200 dark:border-slate-700"
                                  )}>
                                    <Plus className="w-3 h-3" />
                                  </div>
                                </button>
                              )}
                              <div className="w-8 flex justify-center">
                                <MoreHorizontal className="w-4 h-4" />
                              </div>
                              </div>
                            </div>
                          </DndContext>

                          {/* Task Rows - ClickUp Style with Drag & Drop */}
                          <DndContext
                            sensors={taskDragSensors}
                            collisionDetection={closestCenter}
                            onDragStart={handleTaskDragStart}
                            onDragEnd={(event) => handleTaskDragEnd(event, group.tasks, key)}
                          >
                            <SortableContext
                              items={group.tasks.map(t => t.id)}
                              strategy={verticalListSortingStrategy}
                            >
                          {group.tasks.map((task) => {
                            const priority = priorities.find(p => p.value === task.priority);
                            const statusColor = statuses.find(s => s.name === task.status)?.bgColor || '#22c55e';
                            // Subtask count placeholder (no subtask data available yet)
                            const subtaskCount = 0;

                            return (
                              <SortableTaskRow key={task.id} task={task}>
                              <div
                                className="flex items-center px-4 py-2.5 bg-white dark:bg-transparent border-b border-gray-200/70 dark:border-[#1a1b20] hover:bg-[#f7f8fb] dark:hover:bg-[#0f1014] cursor-pointer transition-colors group"
                                onClick={() => openEditTask(task)}
                              >
                                {/* Unified column rendering - follows allColumnIds order for both base and custom fields */}
                                {allColumnIds.map(id => {
                                  const isBaseField = ['name', 'assignee', 'due_date', 'priority', 'status'].includes(id);
                                  const isSprintField = id === 'sprint_points' || id === 'sprints';

                                  // Sprint field cells
                                  if (isSprintField && selectedSprint) {
                                    if (id === 'sprint_points') {
                                      return (
                                        <div key={`${task.id}-sprint_points`} className="w-24 flex justify-center">
                                          <span className="text-sm text-teal-600 dark:text-teal-400 font-semibold">
                                            {task.sprint_points ? task.sprint_points : '—'}
                                          </span>
                                        </div>
                                      );
                                    }
                                    if (id === 'sprints') {
                                      return (
                                        <div key={`${task.id}-sprints`} className="w-56 flex justify-center">
                                          <span className="px-2 py-0.5 text-xs text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-[#1a1b20] rounded whitespace-nowrap">
                                            {selectedSprint.name}{' '}
                                            ({new Date(selectedSprint.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                            {' - '}
                                            {new Date(selectedSprint.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })})
                                          </span>
                                        </div>
                                      );
                                    }
                                  }

                                  if (isBaseField) {
                                    const key = id as BaseFieldKey;
                                    return (
                                      <Fragment key={`${task.id}-${key}`}>
                                        {renderBaseRowCell(key, task, statusColor, priority, subtaskCount)}
                                      </Fragment>
                                    );
                                  }

                                  // Custom field cell
                                  const field = orderedCustomFields.find(f => f.id === id);
                                  if (!field) return null;

                                  const fieldValue = fieldValueMap[task.id]?.[field.id];
                                  const isEditing = editingFieldCell?.taskId === task.id && editingFieldCell?.fieldId === field.id;

                                  // Get current value based on field type
                                  const getCurrentValue = () => {
                                    if (!fieldValue) return null;
                                    switch (field.type) {
                                      case 'text':
                                      case 'email':
                                      case 'url':
                                      case 'phone':
                                        return fieldValue.value_text;
                                      case 'number':
                                      case 'currency':
                                        return fieldValue.value_number;
                                      case 'checkbox':
                                        return fieldValue.value_boolean;
                                      case 'date':
                                        return fieldValue.value_date;
                                      case 'dropdown':
                                      case 'people':
                                      case 'labels':
                                        return fieldValue.value_json;
                                      default:
                                        return null;
                                    }
                                  };

                                  const displayValue = (() => {
                                    if (!fieldValue) return null;
                                    switch (field.type) {
                                      case 'text':
                                      case 'email':
                                      case 'url':
                                      case 'phone':
                                        return fieldValue.value_text;
                                      case 'number':
                                      case 'currency':
                                        return fieldValue.value_number;
                                      case 'checkbox':
                                        return fieldValue.value_boolean ? '✓' : '';
                                      case 'date':
                                        return fieldValue.value_date ? new Date(fieldValue.value_date).toLocaleDateString() : null;
                                      case 'dropdown':
                                        const dropdownVal = fieldValue.value_json;
                                        if (dropdownVal && field.type_config?.options) {
                                          const option = field.type_config.options.find((o: any) => o.id === dropdownVal);
                                          return option ? (
                                            <span
                                              className="px-2 py-0.5 rounded text-xs font-medium"
                                              style={{ backgroundColor: option.color + '20', color: option.color }}
                                            >
                                              {option.name}
                                            </span>
                                          ) : null;
                                        }
                                        return null;
                                      case 'people':
                                        const peopleVal = fieldValue.value_json;
                                        if (Array.isArray(peopleVal) && peopleVal.length > 0) {
                                          return (
                                            <div className="flex -space-x-1">
                                              {peopleVal.slice(0, 2).map((name: string, idx: number) => (
                                                <Avatar key={idx} className="w-6 h-6 border border-gray-50 dark:border-[#0f1012]">
                                                  <AvatarFallback
                                                    className="text-[9px] text-white"
                                                    style={{ backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899'][idx % 3] }}
                                                  >
                                                    {name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                                  </AvatarFallback>
                                                </Avatar>
                                              ))}
                                              {peopleVal.length > 2 && (
                                                <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-slate-600 border border-gray-50 dark:border-[#0f1012] flex items-center justify-center text-[9px] text-gray-900 dark:text-white">
                                                  +{peopleVal.length - 2}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        }
                                        return null;
                                      default:
                                        return null;
                                    }
                                  })();

                                  return (
                                    <div
                                      key={field.id}
                                      className="w-28 flex items-center justify-center text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-[#3a3b46]/50 rounded cursor-pointer relative"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (field.type === 'checkbox') {
                                          // Toggle checkbox immediately
                                          const newValue = !fieldValue?.value_boolean;
                                          setFieldValueMutation.mutate({ taskId: task.id, fieldId: field.id, value: newValue });
                                        } else {
                                          setEditingFieldCell({ taskId: task.id, fieldId: field.id, field });
                                          setEditingFieldValue(getCurrentValue());
                                        }
                                      }}
                                    >
                                      {displayValue || <span className="text-gray-400 dark:text-slate-600">—</span>}

                                      {/* Inline Field Editor Popup */}
                                      {isEditing && field.type !== 'checkbox' && (
                                        <div
                                          className="absolute top-full left-0 mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-2xl z-50 min-w-[200px]"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {/* Text/Email/URL/Phone Editor */}
                                          {['text', 'email', 'url', 'phone'].includes(field.type) && (
                                            <div className="p-2">
                                              <input
                                                type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                                                value={editingFieldValue || ''}
                                                onChange={(e) => setEditingFieldValue(e.target.value)}
                                                placeholder={`Enter ${field.name}...`}
                                                autoFocus
                                                className="w-full px-3 py-2 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500"
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    setFieldValueMutation.mutate({ taskId: task.id, fieldId: field.id, value: editingFieldValue });
                                                    setEditingFieldCell(null);
                                                  } else if (e.key === 'Escape') {
                                                    setEditingFieldCell(null);
                                                  }
                                                }}
                                              />
                                              <div className="flex justify-end gap-2 mt-2">
                                                <button
                                                  onClick={() => setEditingFieldCell(null)}
                                                  className="px-2 py-1 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                                                >
                                                  Cancel
                                                </button>
                                                <button
                                                  onClick={() => {
                                                    setFieldValueMutation.mutate({ taskId: task.id, fieldId: field.id, value: editingFieldValue });
                                                    setEditingFieldCell(null);
                                                  }}
                                                  className="px-2 py-1 text-xs bg-violet-600 text-white rounded hover:bg-violet-700"
                                                >
                                                  Save
                                                </button>
                                              </div>
                                            </div>
                                          )}

                                          {/* Number/Currency Editor */}
                                          {['number', 'currency'].includes(field.type) && (
                                            <div className="p-2">
                                              <input
                                                type="number"
                                                value={editingFieldValue || ''}
                                                onChange={(e) => setEditingFieldValue(e.target.valueAsNumber || null)}
                                                placeholder={`Enter ${field.name}...`}
                                                autoFocus
                                                className="w-full px-3 py-2 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 focus:outline-none focus:border-violet-500"
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    setFieldValueMutation.mutate({ taskId: task.id, fieldId: field.id, value: editingFieldValue });
                                                    setEditingFieldCell(null);
                                                  } else if (e.key === 'Escape') {
                                                    setEditingFieldCell(null);
                                                  }
                                                }}
                                              />
                                              <div className="flex justify-end gap-2 mt-2">
                                                <button
                                                  onClick={() => setEditingFieldCell(null)}
                                                  className="px-2 py-1 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                                                >
                                                  Cancel
                                                </button>
                                                <button
                                                  onClick={() => {
                                                    setFieldValueMutation.mutate({ taskId: task.id, fieldId: field.id, value: editingFieldValue });
                                                    setEditingFieldCell(null);
                                                  }}
                                                  className="px-2 py-1 text-xs bg-violet-600 text-white rounded hover:bg-violet-700"
                                                >
                                                  Save
                                                </button>
                                              </div>
                                            </div>
                                          )}

                                          {/* Date Editor */}
                                          {field.type === 'date' && (
                                            <div className="p-2">
                                              <input
                                                type="date"
                                                value={editingFieldValue ? new Date(editingFieldValue).toISOString().split('T')[0] : ''}
                                                onChange={(e) => setEditingFieldValue(e.target.value)}
                                                autoFocus
                                                className="w-full px-3 py-2 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded text-sm text-gray-900 dark:text-white focus:outline-none focus:border-violet-500"
                                              />
                                              <div className="flex justify-end gap-2 mt-2">
                                                <button
                                                  onClick={() => setEditingFieldCell(null)}
                                                  className="px-2 py-1 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                                                >
                                                  Cancel
                                                </button>
                                                <button
                                                  onClick={() => {
                                                    setFieldValueMutation.mutate({ taskId: task.id, fieldId: field.id, value: editingFieldValue });
                                                    setEditingFieldCell(null);
                                                  }}
                                                  className="px-2 py-1 text-xs bg-violet-600 text-white rounded hover:bg-violet-700"
                                                >
                                                  Save
                                                </button>
                                              </div>
                                            </div>
                                          )}

                                          {/* Dropdown Editor */}
                                          {field.type === 'dropdown' && field.type_config?.options && (
                                            <div className="py-1 max-h-48 overflow-y-auto">
                                              {field.type_config.options.map((option: any) => (
                                                <button
                                                  key={option.id}
                                                  onClick={() => {
                                                    setFieldValueMutation.mutate({ taskId: task.id, fieldId: field.id, value: option.id });
                                                    setEditingFieldCell(null);
                                                  }}
                                                  className={cn(
                                                    "w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-[#2e2f3a] transition-colors",
                                                    editingFieldValue === option.id && "bg-gray-100 dark:bg-[#2e2f3a]"
                                                  )}
                                                >
                                                  <span
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: option.color }}
                                                  />
                                                  <span className="text-gray-900 dark:text-white">{option.name}</span>
                                                  {editingFieldValue === option.id && (
                                                    <Check className="w-3 h-3 ml-auto text-violet-400" />
                                                  )}
                                                </button>
                                              ))}
                                              <button
                                                onClick={() => {
                                                  setFieldValueMutation.mutate({ taskId: task.id, fieldId: field.id, value: null });
                                                  setEditingFieldCell(null);
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-[#2e2f3a] transition-colors border-t border-gray-200 dark:border-[#1f2229]"
                                              >
                                                <X className="w-3 h-3" />
                                                <span>Clear</span>
                                              </button>
                                            </div>
                                          )}

                                          {/* People Editor */}
                                          {field.type === 'people' && (
                                            <div className="py-1 max-h-48 overflow-y-auto">
                                              {availableMembers.map((member: Member) => {
                                                const currentPeople = Array.isArray(editingFieldValue) ? editingFieldValue : [];
                                                const isSelected = currentPeople.includes(member.name);

                                                return (
                                                  <button
                                                    key={member.id}
                                                    onClick={() => {
                                                      const newValue = isSelected
                                                        ? currentPeople.filter((n: string) => n !== member.name)
                                                        : [...currentPeople, member.name];
                                                      setEditingFieldValue(newValue);
                                                      setFieldValueMutation.mutate({ taskId: task.id, fieldId: field.id, value: newValue });
                                                    }}
                                                    className={cn(
                                                      "w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-[#2e2f3a] transition-colors",
                                                      isSelected && "bg-violet-500/20"
                                                    )}
                                                  >
                                                    <div className={cn(
                                                      "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                                                      isSelected ? "bg-violet-500 border-violet-500" : "border-slate-500"
                                                    )}>
                                                      {isSelected && <Check className="w-3 h-3 text-white" />}
                                                    </div>
                                                    <Avatar className="w-5 h-5">
                                                      <AvatarFallback
                                                        className="text-[8px] text-white"
                                                        style={{ backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899'][member.name.charCodeAt(0) % 3] }}
                                                      >
                                                        {member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                                      </AvatarFallback>
                                                    </Avatar>
                                                    <span className={isSelected ? "text-violet-300" : "text-gray-900 dark:text-white"}>{member.name}</span>
                                                  </button>
                                                );
                                              })}
                                              <div className="flex justify-end px-2 py-2 border-t border-gray-200 dark:border-[#1f2229]">
                                                <button
                                                  onClick={() => setEditingFieldCell(null)}
                                                  className="px-2 py-1 text-xs text-slate-400 hover:text-white"
                                                >
                                                  Done
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                                {/* Sprint columns now rendered inside allColumnIds.map above */}

                                {/* Add Column Spacer */}
                                <div className="w-20" />

                                {/* Actions Column */}
                                <div className="w-8 flex justify-center">
                                  <TaskRowMenu
                                    task={task}
                                    onRename={() => openEditTask(task)}
                                    onOpenTask={() => openEditTask(task)}
                                  />
                                </div>
                              </div>
                              </SortableTaskRow>
                            );
                          })}
                            </SortableContext>
                            {/* Drag overlay for task rows */}
                            <DragOverlay>
                              {activeDragTask ? (
                                <div className="flex items-center px-4 py-2.5 bg-white dark:bg-[#1a1b23] border border-violet-500/50 rounded-lg shadow-xl opacity-90">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <GripVertical className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                                    <Circle className="w-4 h-4 flex-shrink-0" style={{ color: statuses.find(s => s.name === activeDragTask.status)?.bgColor || '#22c55e' }} />
                                    <span className="text-sm text-gray-900 dark:text-white truncate">{activeDragTask.name}</span>
                                  </div>
                                </div>
                              ) : null}
                            </DragOverlay>
                          </DndContext>

                          {/* Inline Add Task Row */}
                          {!showEverything && groupBy === 'status' && (
                            inlineAddGroup === key ? (
                              <div className="flex items-center gap-3 px-4 py-3 pl-10 border-b border-gray-100 dark:border-[#1a1b20] bg-gray-50 dark:bg-[#0f1014]">
                                <Plus className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                                <input
                                  type="text"
                                  value={inlineTaskName}
                                  onChange={(e) => setInlineTaskName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && inlineTaskName.trim()) {
                                      handleInlineAddTask(key as TaskStatus);
                                    } else if (e.key === 'Escape') {
                                      setInlineAddGroup(null);
                                      setInlineTaskName('');
                                    }
                                  }}
                                  placeholder="Task name"
                                  className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-600 focus:outline-none"
                                  autoFocus
                                />
                                <button
                                  onClick={() => {
                                    if (inlineTaskName.trim()) {
                                      handleInlineAddTask(key as TaskStatus);
                                    }
                                  }}
                                  disabled={!inlineTaskName.trim()}
                                  className="px-3 py-1.5 text-xs font-medium bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setInlineAddGroup(null);
                                    setInlineTaskName('');
                                  }}
                                  className="p-1 text-gray-400 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setInlineAddGroup(key)}
                                className="flex items-center gap-2 px-4 py-2.5 pl-10 text-sm text-gray-500 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-[#0f1014] w-full transition-colors"
                              >
                                <Plus className="w-4 h-4" />
                                Add Task
                              </button>
                            )
                          )}
                        </>
                      )}
                    </div>
                  ))}

                  {/* Add Status Button - Only for status grouping */}
                  {groupBy === 'status' && !showEverything && (
                    <button
                      onClick={() => setShowAddStatusModal(true)}
                      className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500 dark:text-slate-500 hover:text-violet-400 hover:bg-gray-50 dark:hover:bg-[#0f1014] w-full transition-colors mt-2 border-t border-gray-200 dark:border-[#1a1b20]"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Status</span>
                    </button>
                  )}
                  </>
                  )}
                </div>
                )}
                </>
                )}
              </div>
            )}

            {/* Board View */}
            {activeView === 'board' && (
              <div className="flex-1 overflow-x-auto p-4">
                <div className="flex gap-4 h-full">
                  {Object.entries(groupedTasks).map(([key, group]) => (
                    <div key={key} className="flex-shrink-0 w-72">
                      <div className="bg-gray-100 dark:bg-[#14151a] rounded-lg p-3">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {groupBy === 'assignee' ? (
                              <>
                                {key === 'Unassigned' ? (
                                  <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-slate-600 flex items-center justify-center">
                                    <UserX className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                                  </div>
                                ) : (
                                  <Avatar className="w-6 h-6">
                                    <AvatarFallback
                                      className="text-white text-[10px] font-bold"
                                      style={{ backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#3b82f6', '#22c55e', '#f97316'][group.name.charCodeAt(0) % 6] }}
                                    >
                                      {group.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                    </AvatarFallback>
                                  </Avatar>
                                )}
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{group.name}</span>
                              </>
                            ) : (
                              <>
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{group.name}</span>
                              </>
                            )}
                            <span className="text-xs text-gray-500 dark:text-slate-500 bg-gray-200 dark:bg-[#15161a] px-2 py-0.5 rounded-full">
                              {group.tasks.length}
                            </span>
                          </div>
                          {!showEverything && (groupBy === 'status' || groupBy === 'assignee') && (
                            <button
                              onClick={() => setInlineAddGroup(key)}
                              className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div className="space-y-2">
                          {group.tasks.map((task) => {
                            const priority = priorities.find(p => p.value === task.priority);
                            const statusColor = statuses.find(s => s.name === task.status)?.bgColor || '#22c55e';
                            return (
                              <div
                                key={task.id}
                                className="bg-white dark:bg-[#15161a] rounded-lg p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-600 group shadow-sm dark:shadow-none"
                                onClick={() => openEditTask(task)}
                              >
                                <div className="flex items-start justify-between">
                                  <p className="text-sm text-gray-900 dark:text-white font-medium flex-1">{task.name}</p>
                                  <TaskRowMenu
                                    task={task}
                                    onRename={() => openEditTask(task)}
                                    onOpenTask={() => openEditTask(task)}
                                  />
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  {priority && (
                                    <Flag className="w-3 h-3" style={{ color: priority.color }} />
                                  )}
                                  {groupBy === 'assignee' ? (
                                    /* Show status badge when grouped by assignee */
                                    <span
                                      className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                                      style={{ backgroundColor: statusColor, color: 'white' }}
                                    >
                                      {task.status}
                                    </span>
                                  ) : (
                                    /* Show assignees when not grouped by assignee */
                                    (task.assignees && task.assignees.length > 0) ? (
                                      <div className="flex -space-x-1">
                                        {task.assignees.slice(0, 3).map((assigneeName, idx) => (
                                          <Avatar key={idx} className="w-5 h-5 border border-slate-700">
                                            <AvatarFallback
                                              className="text-white text-[8px]"
                                              style={{ backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#3b82f6', '#22c55e', '#f97316'][assigneeName.charCodeAt(0) % 6] }}
                                            >
                                              {assigneeName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                            </AvatarFallback>
                                          </Avatar>
                                        ))}
                                        {task.assignees.length > 3 && (
                                          <div className="w-5 h-5 rounded-full bg-gray-300 dark:bg-slate-600 border border-white dark:border-[#1f2229] flex items-center justify-center">
                                            <span className="text-[8px] text-gray-900 dark:text-white">+{task.assignees.length - 3}</span>
                                          </div>
                                        )}
                                      </div>
                                    ) : task.assignee_name && (
                                      <Avatar className="w-5 h-5">
                                        <AvatarFallback
                                          className="text-white text-xs"
                                          style={{ backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#3b82f6', '#22c55e', '#f97316'][task.assignee_name.charCodeAt(0) % 6] }}
                                        >
                                          {task.assignee_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                    )
                                  )}
                                  {task.due_date && (
                                    <span className={cn(
                                      "text-xs",
                                      isOverdue(task.due_date) && task.status !== 'Done'
                                        ? "text-pink-500"
                                        : "text-gray-500 dark:text-slate-400"
                                    )}>
                                      {formatDate(task.due_date)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {group.tasks.length === 0 && (
                            <div className="text-center py-4 text-sm text-gray-400 dark:text-slate-500">
                              No tasks
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add Status Column - Only for status grouping */}
                  {groupBy === 'status' && !showEverything && (
                    <div className="flex-shrink-0 w-56">
                      <button
                        onClick={() => setShowAddStatusModal(true)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-slate-500 hover:text-violet-400 hover:bg-gray-100 dark:hover:bg-slate-800/50 rounded-lg transition-colors w-full"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Status</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Other views placeholder */}
            {!['list', 'board', 'overview'].includes(activeView) && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{activeView.charAt(0).toUpperCase() + activeView.slice(1)} View</h2>
                  <p className="text-gray-500 dark:text-slate-400">Coming soon...</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <LayoutGrid className="w-16 h-16 text-gray-400 dark:text-slate-600 mx-auto mb-4" />
              {needsSpaceAccess ? (
                <>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    No Workspace Access
                  </h2>
                  <p className="text-gray-500 dark:text-slate-400 mb-4">
                    You don't have access to any spaces yet.<br />
                    Please contact an admin to get access to a space.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {spaces.length === 0 ? 'Create Your First Workspace' : 'Select a Workspace'}
                  </h2>
                  <p className="text-gray-500 dark:text-slate-400 mb-4">
                    {spaces.length === 0
                      ? 'Spaces help you organize your work into separate areas'
                      : 'Choose a space from the sidebar to get started'}
                  </p>
                  <button
                    onClick={() => setShowSpaceModal(true)}
                    className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
                  >
                    <Plus className="w-4 h-4 inline mr-2" />
                    {spaces.length === 0 ? 'Create Space' : 'Create New Workspace'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Customize View Panel */}
      {showViewPanel && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setShowViewPanel(false)}
          />
          <div className="fixed top-0 right-0 h-full w-[320px] bg-white dark:bg-[#14151a] border-l border-gray-200 dark:border-[#1f2229] z-50 flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#1f2229]">
              <div className="flex items-center gap-2">
                {viewPanelStep === 'fields' && (
                  <button
                    onClick={() => {
                      setViewPanelStep('customize');
                      setViewPanelSearch('');
                    }}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {viewPanelStep === 'fields' ? 'Fields' : 'Customize view'}
                </span>
              </div>
              <button
                onClick={() => setShowViewPanel(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {viewPanelStep === 'customize' ? (
                <div className="p-4 space-y-4">
                  <button
                    onClick={() => setViewPanelStep('fields')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1f2229] text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                  >
                    <span className="text-sm">Fields</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <div className="border-t border-gray-200 dark:border-[#1f2229] pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600 dark:text-slate-300">Show empty statuses</div>
                      <button
                        onClick={() => applyListViewSettings({ show_empty_statuses: !effectiveListViewSettings.show_empty_statuses })}
                        disabled={!canEdit}
                        className={cn(
                          "w-9 h-5 rounded-full relative transition-colors",
                          effectiveListViewSettings.show_empty_statuses ? "bg-violet-600" : "bg-gray-300 dark:bg-slate-600",
                          !canEdit && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow-sm",
                          effectiveListViewSettings.show_empty_statuses ? "right-0.5" : "left-0.5"
                        )} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400" />
                    <input
                      type="text"
                      value={viewPanelSearch}
                      onChange={(e) => setViewPanelSearch(e.target.value)}
                      placeholder="Search for fields"
                      className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#15161a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500">Shown</div>
                    {filteredBaseFields.map(item => {
                      const fieldKey = item.key as keyof ListViewSettings['fields'];
                      const isEnabled = effectiveListViewSettings.fields[fieldKey];
                      return (
                        <div
                          key={item.key}
                          className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1f2229] bg-white dark:bg-[#15161a]"
                        >
                          <span className="text-sm text-gray-700 dark:text-slate-200">{item.label}</span>
                          {item.locked ? (
                            <span className="text-xs text-gray-400">Locked</span>
                          ) : (
                            <button
                              onClick={() => applyListViewSettings({ fields: { ...effectiveListViewSettings.fields, [fieldKey]: !isEnabled } })}
                              disabled={!canEdit}
                              className={cn(
                                "w-9 h-5 rounded-full relative transition-colors",
                                isEnabled ? "bg-violet-600" : "bg-gray-300 dark:bg-slate-600",
                                !canEdit && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <div className={cn(
                                "w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow-sm",
                                isEnabled ? "right-0.5" : "left-0.5"
                              )} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500">Custom fields</div>
                    {filteredCustomFieldsForPanel.length === 0 ? (
                      <div className="text-sm text-gray-500 dark:text-slate-400">No custom fields</div>
                    ) : (
                      filteredCustomFieldsForPanel.map(field => {
                        const isEnabled = effectiveListViewSettings.custom_fields[field.id] !== false;
                        return (
                          <div
                            key={field.id}
                            className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1f2229] bg-white dark:bg-[#15161a]"
                          >
                            <span className="text-sm text-gray-700 dark:text-slate-200">{field.name}</span>
                            <button
                              onClick={() => applyListViewSettings({ custom_fields: { [field.id]: !isEnabled } })}
                              disabled={!canEdit}
                              className={cn(
                                "w-9 h-5 rounded-full relative transition-colors",
                                isEnabled ? "bg-violet-600" : "bg-gray-300 dark:bg-slate-600",
                                !canEdit && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <div className={cn(
                                "w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow-sm",
                                isEnabled ? "right-0.5" : "left-0.5"
                              )} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <button
                    onClick={() => {
                      if (!canEdit) {
                        toast.error('View only');
                        return;
                      }
                      setViewPanelStep('fields');
                      setShowViewPanel(false);
                      setShowCustomFieldPanel(true);
                    }}
                    disabled={!canEdit}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 px-3 py-2 border rounded-lg",
                      canEdit
                        ? "border-violet-500 text-violet-500 hover:bg-violet-500/10"
                        : "border-gray-300 dark:border-[#1f2229] text-gray-400 cursor-not-allowed"
                    )}
                  >
                    <Plus className="w-4 h-4" />
                    Add field
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Create Dropdown - Fixed position outside sidebar */}
      {showCreateDropdown && selectedSpace && (
        <div
          className="fixed bg-white dark:bg-[#1e1f29] border border-gray-200 dark:border-[#1f2229] rounded-xl shadow-2xl z-[100] w-72 py-3"
          style={{
            left: `${currentSecondaryWidth + 80}px`,
            top: '120px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 pb-3 border-b border-gray-200 dark:border-[#1f2229] mb-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Create New</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowCreateDropdown(false);
              openCreateList();
            }}
            className="w-full flex items-center gap-4 px-4 py-3 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#2a2b36] hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <div className="w-12 h-12 rounded-lg bg-violet-600/20 flex items-center justify-center flex-shrink-0">
              <ListIcon className="w-6 h-6 text-violet-400" />
            </div>
            <div className="text-left flex-1">
              <div className="font-semibold text-base text-gray-900 dark:text-white">List</div>
              <div className="text-sm text-gray-500 dark:text-slate-400">Track tasks, projects & more</div>
            </div>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowCreateDropdown(false);
              setShowFolderModal(true);
            }}
            className="w-full flex items-center gap-4 px-4 py-3 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#2a2b36] hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <div className="w-12 h-12 rounded-lg bg-amber-600/20 flex items-center justify-center flex-shrink-0">
              <FolderIcon className="w-6 h-6 text-amber-400" />
            </div>
            <div className="text-left flex-1">
              <div className="font-semibold text-base text-gray-900 dark:text-white">Folder</div>
              <div className="text-sm text-gray-500 dark:text-slate-400">Group Lists, Docs & more</div>
            </div>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowCreateDropdown(false);
              openCreateDoc();
            }}
            className="w-full flex items-center gap-4 px-4 py-3 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#2a2b36] hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <div className="w-12 h-12 rounded-lg bg-blue-600/20 flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-blue-400" />
            </div>
            <div className="text-left flex-1">
              <div className="font-semibold text-base text-gray-900 dark:text-white">Doc</div>
              <div className="text-sm text-gray-500 dark:text-slate-400">Write and collaborate on docs</div>
            </div>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowCreateDropdown(false);
              openCreateForm();
            }}
            className="w-full flex items-center gap-4 px-4 py-3 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#2a2b36] hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <div className="w-12 h-12 rounded-lg bg-green-600/20 flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-6 h-6 text-green-400" />
            </div>
            <div className="text-left flex-1">
              <div className="font-semibold text-base text-gray-900 dark:text-white">Form</div>
              <div className="text-sm text-gray-500 dark:text-slate-400">Collect data with custom forms</div>
            </div>
          </button>
          <div className="border-t border-gray-200 dark:border-[#1f2229] my-2" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowCreateDropdown(false);
              openSpaceTaskStatuses(selectedSpace);
            }}
            className="w-full flex items-center gap-4 px-4 py-3 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#2a2b36] hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <div className="w-12 h-12 rounded-lg bg-violet-600/20 flex items-center justify-center flex-shrink-0">
              <Circle className="w-6 h-6 text-violet-400" />
            </div>
            <div className="text-left flex-1">
              <div className="font-semibold text-base text-gray-900 dark:text-white">Task Statuses</div>
              <div className="text-sm text-gray-500 dark:text-slate-400">Configure statuses for this space</div>
            </div>
          </button>
        </div>
      )}

      {/* Backdrop for Create Dropdown */}
      {showCreateDropdown && (
        <div
          className="fixed inset-0 z-[99]"
          onClick={() => setShowCreateDropdown(false)}
        />
      )}

      {/* Space Modal - ClickUp Style */}
      {showSpaceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowSpaceModal(false); setEditingSpace(null); resetSpaceForm(); }}>
          <div className="bg-white dark:bg-[#14151a] rounded-xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#1f2229]">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingSpace ? 'Edit Space' : 'Create a Space'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                  A Space represents teams, departments, or groups, each with its own Lists, workflows, and settings.
                </p>
              </div>
              <button
                onClick={() => { setShowSpaceModal(false); setEditingSpace(null); resetSpaceForm(); }}
                className="text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4 space-y-5">
              {/* Icon & Name */}
              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-2">Icon & name</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSpaceColor(spaceColors[(spaceColors.indexOf(spaceColor) + 1) % spaceColors.length])}
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl font-bold shrink-0"
                    style={{ backgroundColor: spaceColor }}
                  >
                    {spaceName.charAt(0).toUpperCase() || 'S'}
                  </button>
                  <input
                    type="text"
                    value={spaceName}
                    onChange={(e) => setSpaceName(e.target.value)}
                    placeholder="e.g. Marketing, Engineering, HR"
                    className="flex-1 px-4 py-3 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-2">Description <span className="text-gray-400 dark:text-slate-500">(optional)</span></label>
                <input
                  type="text"
                  value={spaceDescription}
                  onChange={(e) => setSpaceDescription(e.target.value)}
                  placeholder="What's this space about?"
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>

              {/* Default Permission */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                  <span className="text-sm text-gray-500 dark:text-slate-400">Default permission</span>
                  <HelpCircle className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowPermissionDropdown(!showPermissionDropdown)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-slate-500"
                  >
                    <span>
                      {spaceDefaultPermission === 'full_edit' && 'Full edit'}
                      {spaceDefaultPermission === 'edit' && 'Edit'}
                      {spaceDefaultPermission === 'comment' && 'Comment'}
                      {spaceDefaultPermission === 'view_only' && 'View only'}
                    </span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform", showPermissionDropdown && "rotate-180")} />
                  </button>

                  {showPermissionDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-20 overflow-hidden">
                      {[
                        { value: 'full_edit', label: 'Full edit', desc: 'Can create and edit entities in this Space. Owners and admins can manage Space settings.', icon: Shield },
                        { value: 'edit', label: 'Edit', desc: "Can create and edit entities in this Space. Can't manage Space settings or delete entities.", icon: Edit2 },
                        { value: 'comment', label: 'Comment', desc: "Can comment on entities within this Space. Can't manage Space settings or edit entities.", icon: MessageSquare },
                        { value: 'view_only', label: 'View only', desc: "Read-only. Can't edit entities or comment in this Space outside of Chat. Can collaborate in Chat.", icon: Eye },
                      ].map(perm => (
                        <button
                          key={perm.value}
                          onClick={() => {
                            setSpaceDefaultPermission(perm.value);
                            setShowPermissionDropdown(false);
                          }}
                          className={cn(
                            "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-slate-700",
                            spaceDefaultPermission === perm.value && "bg-gray-100 dark:bg-[#15161a]"
                          )}
                        >
                          <perm.icon className="w-5 h-5 text-gray-500 dark:text-slate-400 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-900 dark:text-white font-medium">{perm.label}</span>
                              {spaceDefaultPermission === perm.value && <Check className="w-4 h-4 text-violet-400" />}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{perm.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Make Private Toggle */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-gray-900 dark:text-white font-medium">Make Private</p>
                  <p className="text-sm text-gray-500 dark:text-slate-400">Only you, members, invited guests</p>
                </div>
                <button
                  onClick={() => setSpaceIsPrivate(!spaceIsPrivate)}
                  className={cn(
                    "w-12 h-7 rounded-full transition-colors relative",
                    spaceIsPrivate ? "bg-violet-600" : "bg-slate-600"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-5 h-5 rounded-full bg-white transition-all",
                    spaceIsPrivate ? "left-6" : "left-1"
                  )} />
                </button>
              </div>

              {/* Add Guests (only show if private) */}
              {spaceIsPrivate && (
                <div>
                  <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1">Invite guests to this space</label>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">
                    <Info className="w-3 h-3 inline mr-1" />
                    Members and admins can see all spaces by default. Only guests need explicit access.
                  </p>
                  <div className="relative">
                    <button
                      onClick={() => setShowMemberSelector(!showMemberSelector)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-slate-500"
                    >
                      <span className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
                        <UserPlus className="w-4 h-4" />
                        {selectedSpaceMembers.length > 0
                          ? `${selectedSpaceMembers.length} guest(s) selected`
                          : 'Select guests to add'}
                      </span>
                      <ChevronDown className={cn("w-4 h-4 transition-transform", showMemberSelector && "rotate-180")} />
                    </button>

                    {showMemberSelector && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                        {availableMembers.filter(m => m.status === 'active' && (m.role === 'guest' || m.role === 'limited_member')).length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400 text-center">
                            No guests available. Add guests from the Team page first.
                          </div>
                        ) : (
                          availableMembers.filter(m => m.status === 'active' && (m.role === 'guest' || m.role === 'limited_member')).map(member => {
                            const isSelected = selectedSpaceMembers.some(sm => sm.member_id === member.id);
                            return (
                              <button
                                key={member.id}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedSpaceMembers(prev => prev.filter(sm => sm.member_id !== member.id));
                                  } else {
                                    setSelectedSpaceMembers(prev => [...prev, { member_id: member.id, permission: spaceDefaultPermission }]);
                                  }
                                }}
                                className={cn(
                                  "w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-slate-700",
                                  isSelected && "bg-violet-600/20"
                                )}
                              >
                                <div className={cn(
                                  "w-5 h-5 rounded border flex items-center justify-center",
                                  isSelected ? "bg-violet-600 border-violet-600" : "border-gray-300 dark:border-slate-500"
                                )}>
                                  {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                                <Avatar className="w-8 h-8">
                                  <AvatarFallback className="bg-violet-600 text-white text-sm">
                                    {member.name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="text-gray-900 dark:text-white text-sm truncate">{member.name}</p>
                                  <p className="text-gray-500 dark:text-slate-400 text-xs truncate">{member.email}</p>
                                </div>
                                <span className="text-xs text-gray-400 dark:text-slate-500 capitalize">{member.role === 'limited_member' ? 'Limited' : 'Guest'}</span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {/* Selected Members List */}
                  {selectedSpaceMembers.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedSpaceMembers.map(sm => {
                        const member = availableMembers.find(m => m.id === sm.member_id);
                        if (!member) return null;
                        return (
                          <div key={sm.member_id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-200 dark:bg-[#15161a] rounded-full">
                            <span className="text-gray-900 dark:text-white text-sm">{member.name}</span>
                            <button
                              onClick={() => setSelectedSpaceMembers(prev => prev.filter(item => item.member_id !== sm.member_id))}
                              className="text-gray-500 dark:text-slate-400 hover:text-red-400"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 dark:border-[#1f2229]">
              <button
                onClick={handleSpaceSubmit}
                disabled={!spaceName.trim()}
                className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {editingSpace ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowFolderModal(false); setEditingFolder(null); setFolderName(''); }}>
          <div className="bg-white dark:bg-[#14151a] rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#1f2229]">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editingFolder ? 'Rename Folder' : 'Create Folder'}</h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{editingFolder ? 'Enter a new name for this folder.' : 'Use Folders to organize your Lists, Docs, and more.'}</p>
              </div>
              <button
                onClick={() => { setShowFolderModal(false); setEditingFolder(null); setFolderName(''); }}
                className="text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-2">Name</label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="e.g. Project, Client, Team"
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleFolderSubmit(); }}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-[#1f2229]">
              <button
                onClick={(e) => { e.stopPropagation(); setShowFolderModal(false); setEditingFolder(null); setFolderName(''); }}
                className="px-6 py-2 bg-gray-200 dark:bg-[#15161a] text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleFolderSubmit(); }}
                disabled={!folderName.trim()}
                className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {editingFolder ? 'Rename' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List Modal */}
      {showListModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowListModal(false); setEditingList(null); resetListForm(); }}>
          <div className="bg-white dark:bg-[#14151a] rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#1f2229]">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editingList ? 'Rename List' : 'Create List'}</h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{editingList ? 'Enter a new name for this list.' : 'Lists contain your tasks, projects, and more.'}</p>
              </div>
              <button
                onClick={() => { setShowListModal(false); setEditingList(null); resetListForm(); }}
                className="text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-2">Name</label>
                <input
                  type="text"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="e.g. Sprint 1, Backlog, Todo"
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleListSubmit(); }}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-2">Description <span className="text-gray-400 dark:text-slate-500">(optional)</span></label>
                <input
                  type="text"
                  value={listDescription}
                  onChange={(e) => setListDescription(e.target.value)}
                  placeholder="What's this list about?"
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {spaceColors.map(color => (
                    <button
                      key={color}
                      onClick={() => setListColor(color)}
                      className={cn(
                        "w-8 h-8 rounded-full transition-all",
                        listColor === color && "ring-2 ring-gray-900 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-[#1e1f28]"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              {listTargetFolder && (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
                  <FolderIcon className="w-4 h-4" />
                  <span>Will be created in folder: {folders.find(f => f.id === listTargetFolder)?.name}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-gray-200 dark:border-[#1f2229]">
              <button
                onClick={handleListSubmit}
                disabled={!listName.trim()}
                className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {editingList ? 'Rename' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Doc Modal */}
      {showDocModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowDocModal(false); setDocName(''); setDocTargetFolder(null); }}>
          <div className="bg-white dark:bg-[#14151a] rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#1f2229]">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Doc</h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Write and collaborate on docs with your team.</p>
              </div>
              <button onClick={() => { setShowDocModal(false); setDocName(''); setDocTargetFolder(null); }} className="text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-2">Name</label>
                <input
                  type="text"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="e.g. Meeting Notes, Project Brief"
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleDocSubmit(); }}
                  autoFocus
                />
              </div>
              {docTargetFolder && (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
                  <FolderIcon className="w-4 h-4" />
                  <span>Will be created in folder: {folders.find(f => f.id === docTargetFolder)?.name}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-[#1f2229]">
              <button
                onClick={() => { setShowDocModal(false); setDocName(''); setDocTargetFolder(null); }}
                className="px-6 py-2 bg-gray-200 dark:bg-[#15161a] text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDocSubmit}
                disabled={!docName.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowFormModal(false); setFormName(''); setFormDescription(''); setFormTargetFolder(null); }}>
          <div className="bg-white dark:bg-[#14151a] rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#1f2229]">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Form</h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Collect data with custom forms.</p>
              </div>
              <button onClick={() => { setShowFormModal(false); setFormName(''); setFormDescription(''); setFormTargetFolder(null); }} className="text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-2">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Bug Report, Feature Request"
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleFormSubmit(); }}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-2">Description <span className="text-gray-400 dark:text-slate-500">(optional)</span></label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="What's this form about?"
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              {formTargetFolder && (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
                  <FolderIcon className="w-4 h-4" />
                  <span>Will be created in folder: {folders.find(f => f.id === formTargetFolder)?.name}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-[#1f2229]">
              <button
                onClick={() => { setShowFormModal(false); setFormName(''); setFormDescription(''); setFormTargetFolder(null); }}
                className="px-6 py-2 bg-gray-200 dark:bg-[#15161a] text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleFormSubmit}
                disabled={!formName.trim()}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#14151a] rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingTask ? 'Edit Task' : 'Create Task'}
              </h2>
              <button
                onClick={() => { setShowTaskModal(false); setEditingTask(null); resetTaskForm(); }}
                className="text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1">Task Name *</label>
                <input
                  type="text"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder="Enter task name"
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-[#15161a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* List Selector */}
              {!editingTask && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1">List</label>
                  <select
                    value={taskFolderId}
                    onChange={(e) => setTaskFolderId(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-100 dark:bg-[#15161a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="">No list</option>
                    {spaceFolders.map(folder => (
                      <option key={folder.id} value={folder.id}>{folder.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1">Description</label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="Add a description..."
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-[#15161a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1">Status</label>
                <div className="flex gap-2">
                  <select
                    value={taskStatus}
                    onChange={(e) => setTaskStatus(e.target.value as TaskStatus)}
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-[#15161a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {(statuses.length > 0 ? statuses : [
                      { name: 'TO DO', color: '#6b7280', bgColor: '#6b7280' },
                      { name: 'IN PROGRESS', color: '#3b82f6', bgColor: '#3b82f6' },
                      { name: 'REVIEW', color: '#f59e0b', bgColor: '#f59e0b' },
                      { name: 'DONE', color: '#22c55e', bgColor: '#22c55e' }
                    ]).map(s => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddStatusModal(true)}
                    className="px-3 py-2 bg-gray-100 dark:bg-[#15161a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                    title="Add new status"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1">Priority</label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-[#15161a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {priorities.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1">Assignee</label>
                <input
                  type="text"
                  value={taskAssignee}
                  onChange={(e) => setTaskAssignee(e.target.value)}
                  placeholder="Assignee name"
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-[#15161a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1">Due Date</label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-[#15161a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>

            <div className="flex justify-between gap-3 mt-6">
              {editingTask && (
                <button
                  onClick={() => {
                    deleteTaskMutation.mutate(editingTask.id);
                    setShowTaskModal(false);
                    setEditingTask(null);
                    resetTaskForm();
                  }}
                  className="px-4 py-2 text-red-400 hover:bg-red-500/20 rounded-lg flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              )}
              <div className="flex gap-3 ml-auto">
                <button
                  onClick={() => { setShowTaskModal(false); setEditingTask(null); resetTaskForm(); }}
                  className="px-4 py-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTaskSubmit}
                  disabled={!taskName.trim()}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingTask ? 'Save' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Status Modal */}
      {showAddStatusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#14151a] rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add New Status</h2>
              <button
                onClick={() => { setShowAddStatusModal(false); setNewStatusName(''); setNewStatusColor('#3b82f6'); }}
                className="text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1">Status Name</label>
                <input
                  type="text"
                  value={newStatusName}
                  onChange={(e) => setNewStatusName(e.target.value)}
                  placeholder="e.g., Blocked, QA Testing, Backlog"
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-[#15161a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddStatus(); }}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {statusColors.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewStatusColor(color)}
                      className={cn(
                        "w-8 h-8 rounded-full transition-all",
                        newStatusColor === color && "ring-2 ring-gray-900 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-slate-800"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              {/* Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1">Preview</label>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 text-xs font-medium rounded"
                    style={{ backgroundColor: newStatusColor, color: '#fff' }}
                  >
                    {newStatusName || 'STATUS NAME'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowAddStatusModal(false); setNewStatusName(''); setNewStatusColor('#3b82f6'); }}
                className="px-4 py-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStatus}
                disabled={!newStatusName.trim()}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
              >
                Add Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Status Modal */}
      {showEditStatusModal && editingStatus && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowEditStatusModal(false); setEditingStatus(null); }}>
          <div className="bg-white dark:bg-[#14151a] rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Status</h2>
              <button
                onClick={() => { setShowEditStatusModal(false); setEditingStatus(null); }}
                className="text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1">Status Name</label>
                <input
                  type="text"
                  value={editStatusName}
                  onChange={(e) => setEditStatusName(e.target.value)}
                  placeholder="Enter status name"
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-[#15161a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleEditStatus(); }}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {statusColors.map(color => (
                    <button
                      key={color}
                      onClick={() => setEditStatusColor(color)}
                      className={cn(
                        "w-8 h-8 rounded-full transition-all",
                        editStatusColor === color && "ring-2 ring-gray-900 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-slate-800"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              {/* Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-slate-300 mb-1">Preview</label>
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 text-xs font-medium rounded"
                    style={{ backgroundColor: editStatusColor, color: '#fff' }}
                  >
                    {editStatusName || 'STATUS NAME'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowEditStatusModal(false); setEditingStatus(null); }}
                className="px-4 py-2 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleEditStatus}
                disabled={!editStatusName.trim()}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Space Members Management Modal */}
      {showSpaceMembersModal && selectedSpace && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowSpaceMembersModal(false); setShowAddGuestDropdown(false); setAddGuestSearchQuery(''); }}>
          <div className="bg-white dark:bg-[#14151a] rounded-xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#1f2229]">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Manage Workspace Access</h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                  {selectedSpace.name} - {spaceMembers.length} {spaceMembers.length === 1 ? 'guest' : 'guests'} with access
                </p>
              </div>
              <button
                onClick={() => { setShowSpaceMembersModal(false); setShowAddGuestDropdown(false); setAddGuestSearchQuery(''); }}
                className="text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Add Guest Section */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-[#1f2229]">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-600 dark:text-slate-300">Add Guest to Workspace</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 dark:text-slate-500">Permission:</span>
                  <select
                    value={addGuestPermission}
                    onChange={(e) => setAddGuestPermission(e.target.value)}
                    className="px-2 py-1 bg-gray-100 dark:bg-[#15161a] border border-gray-200 dark:border-[#1f2229] rounded text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    <option value="full_edit">Full Edit</option>
                    <option value="edit">Edit</option>
                    <option value="comment">Comment</option>
                    <option value="view_only">View Only</option>
                  </select>
                </div>
              </div>

              <div className="relative">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-400" />
                    <input
                      type="text"
                      value={addGuestSearchQuery}
                      onChange={(e) => { setAddGuestSearchQuery(e.target.value); setShowAddGuestDropdown(true); }}
                      onFocus={() => setShowAddGuestDropdown(true)}
                      placeholder="Search guests to add..."
                      className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>

                {/* Guest Dropdown */}
                {showAddGuestDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                    {(() => {
                      const existingMemberIds = new Set(spaceMembers.map((sm: SpaceMember) => sm.member_id));
                      const availableGuests = availableMembers
                        .filter(m =>
                          m.status === 'active' &&
                          (m.role === 'guest' || m.role === 'limited_member') &&
                          !existingMemberIds.has(m.id)
                        )
                        .filter(m =>
                          !addGuestSearchQuery ||
                          m.name.toLowerCase().includes(addGuestSearchQuery.toLowerCase()) ||
                          m.email.toLowerCase().includes(addGuestSearchQuery.toLowerCase())
                        );

                      if (availableGuests.length === 0) {
                        return (
                          <div className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400 text-center">
                            {addGuestSearchQuery ? 'No matching guests found' : 'No more guests available to add'}
                          </div>
                        );
                      }

                      return availableGuests.map(guest => (
                        <button
                          key={guest.id}
                          onClick={() => {
                            addMemberToSpaceMutation.mutate({
                              space_id: selectedSpace.id,
                              member_id: guest.id,
                              permission: addGuestPermission
                            });
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-slate-700"
                        >
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-violet-600 text-white text-sm">
                              {guest.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-900 dark:text-white text-sm truncate">{guest.name}</p>
                            <p className="text-gray-500 dark:text-slate-400 text-xs truncate">{guest.email}</p>
                          </div>
                          <span className="text-xs text-gray-400 dark:text-slate-500 capitalize">{guest.role === 'limited_member' ? 'Limited' : 'Guest'}</span>
                          <Plus className="w-4 h-4 text-violet-400" />
                        </button>
                      ));
                    })()}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
                Only guests and limited members need to be added. Members and admins see all spaces by default.
              </p>
            </div>

            {/* Existing Members List */}
            <div className="px-6 py-4 max-h-[300px] overflow-y-auto">
              <label className="text-sm font-medium text-gray-600 dark:text-slate-300 mb-3 block">
                Current Access ({spaceMembers.length})
              </label>
              {spaceMembers.length === 0 ? (
                <div className="text-center py-6">
                  <Users className="w-10 h-10 text-gray-400 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-slate-400 text-sm">No guests added yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {spaceMembers.map((sm: SpaceMember) => (
                    <div key={sm.id} className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-[#14151a] rounded-lg">
                      <Avatar className="w-9 h-9">
                        <AvatarFallback className="bg-violet-600 text-white text-sm">
                          {sm.member?.name?.charAt(0)?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 dark:text-white font-medium text-sm truncate">{sm.member?.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{sm.member?.email || ''}</p>
                      </div>

                      {/* Permission Dropdown */}
                      <div className="relative">
                        {editingMemberPermission === sm.id ? (
                          <select
                            value={sm.permission}
                            onChange={(e) => {
                              updateMemberPermissionMutation.mutate({ id: sm.id, permission: e.target.value });
                            }}
                            onBlur={() => setEditingMemberPermission(null)}
                            className="px-2 py-1 bg-gray-200 dark:bg-[#15161a] border border-gray-300 dark:border-[#1f2229] rounded text-gray-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
                            autoFocus
                          >
                            <option value="full_edit">Full Edit</option>
                            <option value="edit">Edit</option>
                            <option value="comment">Comment</option>
                            <option value="view_only">View Only</option>
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingMemberPermission(sm.id)}
                            className="flex items-center gap-1.5 px-2 py-1 bg-gray-200 dark:bg-[#15161a] hover:bg-gray-300 dark:hover:bg-slate-600 rounded text-xs transition-colors"
                          >
                            {sm.permission === 'full_edit' && <Shield className="w-3 h-3 text-green-400" />}
                            {sm.permission === 'edit' && <Edit2 className="w-3 h-3 text-blue-400" />}
                            {sm.permission === 'comment' && <MessageSquare className="w-3 h-3 text-yellow-400" />}
                            {sm.permission === 'view_only' && <Eye className="w-3 h-3 text-gray-400 dark:text-slate-400" />}
                            <span className="text-gray-900 dark:text-white">
                              {sm.permission === 'full_edit' ? 'Full Edit' :
                               sm.permission === 'view_only' ? 'View Only' :
                               sm.permission.charAt(0).toUpperCase() + sm.permission.slice(1)}
                            </span>
                            <ChevronDown className="w-3 h-3 text-gray-400 dark:text-slate-400" />
                          </button>
                        )}
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${sm.member?.name || 'this member'} from this space?`)) {
                            removeMemberFromSpaceMutation.mutate(sm.id);
                          }
                        }}
                        className="p-1.5 text-gray-400 dark:text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        title="Remove from space"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 dark:border-[#1f2229]">
              <button
                onClick={() => { setShowSpaceMembersModal(false); setShowAddGuestDropdown(false); setAddGuestSearchQuery(''); }}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Panel */}
      {selectedTaskForPanel && (
        <TaskDetailPanel
          task={selectedTaskForPanel}
          isOpen={showTaskPanel}
          onClose={closeTaskPanel}
          statuses={statuses}
          spaceName={spaces.find(s => s.id === selectedTaskForPanel.space_id)?.name || 'Workspace'}
          folderName={folders.find(f => f.id === selectedTaskForPanel.folder_id)?.name || 'List'}
          onTaskUpdated={() => {
            // Refresh the task data after updates
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
          }}
          allTasks={filteredTasks}
          onNavigateTask={(task) => setSelectedTaskForPanel(task)}
        />
      )}

      {/* Custom Field Editor Backdrop */}
      {editingFieldCell && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setEditingFieldCell(null)}
        />
      )}

      {/* Custom Field Panel */}
      <CustomFieldPanel
        isOpen={showCustomFieldPanel}
        onClose={() => setShowCustomFieldPanel(false)}
        onBack={() => {
          setShowCustomFieldPanel(false);
          setShowViewPanel(true);
          setViewPanelStep('fields');
        }}
        spaceId={selectedSpace?.id || ''}
        folderId={selectedFolder?.id}
        listId={selectedList?.id}
        onFieldCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['customFields'] });
        }}
        statusFieldVisible={effectiveListViewSettings.fields.status}
        onToggleStatusField={(visible) => {
          const updates: Partial<ListViewSettings> = { fields: { ...effectiveListViewSettings.fields, status: visible } };
          if (visible) {
            // Ensure 'status' is in base_fields_order and unified_column_order
            const bfo = effectiveListViewSettings.base_fields_order || [];
            if (!bfo.includes('status')) {
              updates.base_fields_order = [...bfo, 'status'];
            }
            const uco = effectiveListViewSettings.unified_column_order || [];
            if (uco.length > 0 && !uco.includes('status')) {
              updates.unified_column_order = [...uco, 'status'];
            }
          }
          applyListViewSettings(updates);
        }}
      />

      {/* Sprint Folder Create Modal */}
      <SprintFolderCreateModal
        isOpen={showSprintFolderModal}
        onClose={() => setShowSprintFolderModal(false)}
        onCreateFolder={(data) => {
          if (selectedSpace) {
            createSprintFolderMutation.mutate({
              name: data.name,
              space_id: selectedSpace.id,
              default_duration: data.default_duration
            });
          }
        }}
      />

      {/* Sprint Create Modal */}
      {sprintCreateFolderId && (() => {
        const sfolder = sprintFolders.find(sf => sf.id === sprintCreateFolderId);
        // Filter sprints by the specific folder (not sprint_folder), so each folder has its own numbering
        const thisFolderSprints = sprints.filter(s => s.folder_id === sprintCreateForFolder);
        const lastSprint = thisFolderSprints.length > 0 ? thisFolderSprints[thisFolderSprints.length - 1] : null;

        return (
          <SprintCreateModal
            isOpen={showSprintCreateModal}
            onClose={() => { setShowSprintCreateModal(false); setSprintCreateFolderId(null); setSprintCreateForFolder(null); }}
            onCreateSprint={(data) => {
              if (sfolder) {
                createSprintMutation.mutate({
                  name: data.name,
                  sprint_folder_id: sprintCreateFolderId,
                  space_id: sfolder.space_id,
                  start_date: data.start_date,
                  end_date: data.end_date,
                  folder_id: sprintCreateForFolder || undefined
                });
              }
            }}
            defaultDuration={sfolder?.default_duration || 14}
            nextSprintNumber={thisFolderSprints.length + 1}
            lastSprintEndDate={lastSprint?.end_date}
          />
        );
      })()}

      {/* Doc Editor Overlay */}
      {editingDoc && (
        <DocEditor
          doc={editingDoc}
          onClose={() => {
            setEditingDoc(null);
            queryClient.invalidateQueries({ queryKey: ['docs'] });
          }}
        />
      )}

      {/* Form Builder Overlay */}
      {editingForm && (
        <div className="fixed inset-0 z-[200] bg-gray-50 dark:bg-[#0f1012]">
          <FormBuilder
            form={editingForm}
            onClose={() => {
              setEditingForm(null);
              queryClient.invalidateQueries({ queryKey: ['forms'] });
            }}
          />
        </div>
      )}

      {/* Task Statuses Modal for Folder/List - ClickUp Style */}
      {showTaskStatusesModal && taskStatusesTarget && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#232430] rounded-xl w-full max-w-[680px] shadow-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={() => { setStatusMenuOpenIdx(null); }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#2a2b36]">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit {taskStatusesTarget.name} statuses
              </h2>
              <button
                onClick={() => { setShowTaskStatusesModal(false); resetStatusModalState(); }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded-lg text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1">
              <div className="flex">
                {/* Left panel - Status type & template */}
                <div className="w-[220px] shrink-0 px-5 py-5 border-r border-gray-200 dark:border-[#2a2b36]">
                  {/* Status type */}
                  <div className="mb-5">
                    <label className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-3 block">
                      Status type <span className="text-gray-400 dark:text-slate-500 cursor-help" title="Choose how statuses are managed">ⓘ</span>
                    </label>
                    <div className="space-y-2">
                      {/* Inherit Option */}
                      {taskStatusesInheritedFrom && (
                        <label
                          className="flex items-center gap-2.5 cursor-pointer group"
                          onClick={() => {
                            setTaskStatusesUseCustom(false);
                            setTaskStatusesList(taskStatusesParentStatuses);
                          }}
                        >
                          <div className={cn(
                            "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                            !taskStatusesUseCustom ? "border-violet-500" : "border-gray-300 dark:border-slate-500"
                          )}>
                            {!taskStatusesUseCustom && <div className="w-2 h-2 rounded-full bg-violet-500" />}
                          </div>
                          <span className="text-sm text-gray-700 dark:text-slate-300">Inherit from Space</span>
                        </label>
                      )}
                      {/* Custom Option */}
                      <label
                        className="flex items-center gap-2.5 cursor-pointer group"
                        onClick={() => {
                          setTaskStatusesUseCustom(true);
                          setTaskStatusesList(taskStatusesCustomStatuses.length > 0 ? taskStatusesCustomStatuses : taskStatusesList);
                        }}
                      >
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                          taskStatusesUseCustom ? "border-violet-500" : "border-gray-300 dark:border-slate-500"
                        )}>
                          {taskStatusesUseCustom && <div className="w-2 h-2 rounded-full bg-violet-500" />}
                        </div>
                        <span className="text-sm text-gray-700 dark:text-slate-300">Use custom statuses</span>
                      </label>
                    </div>
                  </div>

                  {/* Status template */}
                  <div>
                    <label className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-2 block">Status template</label>
                    <select
                      value={taskStatusesTemplate}
                      onChange={(e) => { applyStatusTemplate(e.target.value); setTaskStatusesUseCustom(true); }}
                      className="w-full bg-white dark:bg-[#1a1b24] border border-gray-200 dark:border-[#2a2b36] rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                    >
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
                          if (space) {
                            setShowTaskStatusesModal(false);
                            resetStatusModalState();
                            setTimeout(() => openSpaceTaskStatuses(space), 200);
                          }
                        }
                      }}>Space status manager</button> to make changes to this template.
                    </p>
                  )}

                  {/* Active Section */}
                  {(() => {
                    const activeStatuses = taskStatusesList
                      .map((s, idx) => ({ ...s, _origIdx: idx }))
                      .filter(s => categorizeStatus(s) === 'active');
                    return (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
                            Active <span className="text-gray-400 dark:text-slate-500 cursor-help" title="Statuses for tasks that are active/in-progress">ⓘ</span>
                          </span>
                          {taskStatusesUseCustom && (
                            <button
                              onClick={() => {
                                setStatusAddingToSection('active');
                                setShowTaskStatusesAddForm(true);
                                setTaskStatusesAddColor('#3b82f6');
                              }}
                              className="w-5 h-5 rounded-full border border-gray-300 dark:border-slate-500 flex items-center justify-center text-gray-400 dark:text-slate-500 hover:border-violet-400 hover:text-violet-400 transition-colors"
                              title="Add status"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="space-y-1">
                          {activeStatuses.map((status) => (
                            <div
                              key={status.id || `status-${status._origIdx}`}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-md group hover:bg-gray-50 dark:hover:bg-[#2a2b36] transition-colors"
                            >
                              {taskStatusesUseCustom && (
                                <GripVertical className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 cursor-grab flex-shrink-0" />
                              )}
                              <div className="relative flex-shrink-0">
                                <button
                                  onClick={() => taskStatusesUseCustom && setStatusColorPickerIdx(statusColorPickerIdx === status._origIdx ? null : status._origIdx)}
                                  className="w-4 h-4 rounded-full flex-shrink-0 cursor-pointer hover:scale-110 transition-transform"
                                  style={{ backgroundColor: status.color }}
                                />
                                {statusColorPickerIdx === status._origIdx && (
                                  <div className="absolute left-0 top-full mt-2 bg-white dark:bg-[#1e1f29] border border-gray-200 dark:border-[#2a2b36] rounded-lg shadow-xl p-3 z-50" onClick={(e) => e.stopPropagation()}>
                                    <div className="text-[10px] text-gray-500 dark:text-slate-400 mb-2">Color</div>
                                    <div className="grid grid-cols-5 gap-2">
                                      {COLOR_SWATCHES.map(color => (
                                        <button
                                          key={color}
                                          onClick={() => {
                                            const newList = [...taskStatusesList];
                                            newList[status._origIdx] = { ...taskStatusesList[status._origIdx], color, bgColor: color };
                                            setTaskStatusesList(newList);
                                            setStatusColorPickerIdx(null);
                                          }}
                                          className={cn(
                                            "w-6 h-6 rounded-full hover:scale-110 transition-transform border-2",
                                            status.color === color ? "border-white ring-1 ring-violet-400" : "border-transparent"
                                          )}
                                          style={{ backgroundColor: color }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              {taskStatusesUseCustom ? (
                                <input
                                  type="text"
                                  value={status.name}
                                  onChange={(e) => {
                                    const newList = [...taskStatusesList];
                                    newList[status._origIdx] = { ...taskStatusesList[status._origIdx], name: e.target.value.toUpperCase() };
                                    setTaskStatusesList(newList);
                                  }}
                                  ref={statusRenameIdx === status._origIdx ? (el) => el?.focus() : undefined}
                                  className={cn(
                                    "flex-1 bg-transparent text-gray-900 dark:text-white text-sm font-medium border-0 focus:outline-none focus:ring-0 px-1",
                                    statusRenameIdx === status._origIdx && "ring-1 ring-violet-500 rounded bg-white/5"
                                  )}
                                  onBlur={() => { if (statusRenameIdx === status._origIdx) setStatusRenameIdx(null); }}
                                />
                              ) : (
                                <span className="flex-1 text-sm text-gray-900 dark:text-slate-300 font-medium px-1">{status.name}</span>
                              )}
                              {taskStatusesUseCustom && (
                                <div className="relative flex-shrink-0">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setStatusMenuOpenIdx(statusMenuOpenIdx === status._origIdx ? null : status._origIdx); }}
                                    className="p-1 text-gray-400 dark:text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                  </button>
                                  {statusMenuOpenIdx === status._origIdx && (
                                    <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-[#1e1f29] border border-gray-200 dark:border-[#2a2b36] rounded-lg shadow-xl z-50 py-1">
                                      <button
                                        onClick={() => { setStatusRenameIdx(status._origIdx); setStatusMenuOpenIdx(null); }}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#2a2b36]"
                                      >
                                        <Edit2 className="w-3 h-3" /> Rename
                                      </button>
                                      <button
                                        onClick={() => { handleRemoveTaskStatus(status._origIdx); setStatusMenuOpenIdx(null); }}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-gray-100 dark:hover:bg-[#2a2b36]"
                                      >
                                        <Trash2 className="w-3 h-3" /> Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                          {/* Inline Add Status for Active */}
                          {taskStatusesUseCustom && showTaskStatusesAddForm && statusAddingToSection === 'active' && (
                            <div className="flex items-center gap-2 px-2 py-1.5">
                              <div className="relative flex-shrink-0">
                                <button
                                  onClick={() => setStatusColorPickerIdx(statusColorPickerIdx === -1 ? null : -1)}
                                  className="w-4 h-4 rounded-full cursor-pointer hover:scale-110 transition-transform"
                                  style={{ backgroundColor: taskStatusesAddColor }}
                                />
                                {statusColorPickerIdx === -1 && (
                                  <div className="absolute left-0 top-full mt-2 bg-white dark:bg-[#1e1f29] border border-gray-200 dark:border-[#2a2b36] rounded-lg shadow-xl p-3 z-50" onClick={(e) => e.stopPropagation()}>
                                    <div className="text-[10px] text-gray-500 dark:text-slate-400 mb-2">Color</div>
                                    <div className="grid grid-cols-5 gap-2">
                                      {COLOR_SWATCHES.map(color => (
                                        <button
                                          key={color}
                                          onClick={() => { setTaskStatusesAddColor(color); setStatusColorPickerIdx(null); }}
                                          className={cn("w-6 h-6 rounded-full hover:scale-110 transition-transform border-2", taskStatusesAddColor === color ? "border-white ring-1 ring-violet-400" : "border-transparent")}
                                          style={{ backgroundColor: color }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <input
                                type="text"
                                value={taskStatusesAddName}
                                onChange={(e) => setTaskStatusesAddName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && taskStatusesAddName.trim()) handleAddTaskStatus();
                                  if (e.key === 'Escape') { setShowTaskStatusesAddForm(false); setTaskStatusesAddName(''); }
                                }}
                                placeholder="Add status"
                                className="flex-1 bg-transparent text-gray-900 dark:text-white text-sm font-medium border border-gray-200 dark:border-[#2a2b36] rounded px-2 py-1 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                autoFocus
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Done Section */}
                  {(() => {
                    const doneStatuses = taskStatusesList
                      .map((s, idx) => ({ ...s, _origIdx: idx }))
                      .filter(s => categorizeStatus(s) === 'done');
                    return (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
                            Done <span className="text-gray-400 dark:text-slate-500 cursor-help" title="Statuses that indicate completion">ⓘ</span>
                          </span>
                          {taskStatusesUseCustom && (
                            <button
                              onClick={() => {
                                setStatusAddingToSection('done');
                                setShowTaskStatusesAddForm(true);
                                setTaskStatusesAddColor('#22c55e');
                              }}
                              className="w-5 h-5 rounded-full border border-gray-300 dark:border-slate-500 flex items-center justify-center text-gray-400 dark:text-slate-500 hover:border-violet-400 hover:text-violet-400 transition-colors"
                              title="Add status"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="space-y-1">
                          {doneStatuses.map((status) => (
                            <div
                              key={status.id || `status-${status._origIdx}`}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-md group hover:bg-gray-50 dark:hover:bg-[#2a2b36] transition-colors"
                            >
                              {taskStatusesUseCustom && (
                                <GripVertical className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 cursor-grab flex-shrink-0" />
                              )}
                              <div className="relative flex-shrink-0">
                                <button
                                  onClick={() => taskStatusesUseCustom && setStatusColorPickerIdx(statusColorPickerIdx === status._origIdx ? null : status._origIdx)}
                                  className="w-4 h-4 rounded-full flex-shrink-0 cursor-pointer hover:scale-110 transition-transform"
                                  style={{ backgroundColor: status.color }}
                                />
                                {statusColorPickerIdx === status._origIdx && (
                                  <div className="absolute left-0 top-full mt-2 bg-white dark:bg-[#1e1f29] border border-gray-200 dark:border-[#2a2b36] rounded-lg shadow-xl p-3 z-50" onClick={(e) => e.stopPropagation()}>
                                    <div className="text-[10px] text-gray-500 dark:text-slate-400 mb-2">Color</div>
                                    <div className="grid grid-cols-5 gap-2">
                                      {COLOR_SWATCHES.map(color => (
                                        <button
                                          key={color}
                                          onClick={() => {
                                            const newList = [...taskStatusesList];
                                            newList[status._origIdx] = { ...taskStatusesList[status._origIdx], color, bgColor: color };
                                            setTaskStatusesList(newList);
                                            setStatusColorPickerIdx(null);
                                          }}
                                          className={cn("w-6 h-6 rounded-full hover:scale-110 transition-transform border-2", status.color === color ? "border-white ring-1 ring-violet-400" : "border-transparent")}
                                          style={{ backgroundColor: color }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              {taskStatusesUseCustom ? (
                                <input
                                  type="text"
                                  value={status.name}
                                  onChange={(e) => {
                                    const newList = [...taskStatusesList];
                                    newList[status._origIdx] = { ...taskStatusesList[status._origIdx], name: e.target.value.toUpperCase() };
                                    setTaskStatusesList(newList);
                                  }}
                                  ref={statusRenameIdx === status._origIdx ? (el) => el?.focus() : undefined}
                                  className={cn(
                                    "flex-1 bg-transparent text-gray-900 dark:text-white text-sm font-medium border-0 focus:outline-none focus:ring-0 px-1",
                                    statusRenameIdx === status._origIdx && "ring-1 ring-violet-500 rounded bg-white/5"
                                  )}
                                  onBlur={() => { if (statusRenameIdx === status._origIdx) setStatusRenameIdx(null); }}
                                />
                              ) : (
                                <span className="flex-1 text-sm text-gray-900 dark:text-slate-300 font-medium px-1">{status.name}</span>
                              )}
                              {taskStatusesUseCustom && (
                                <div className="relative flex-shrink-0">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setStatusMenuOpenIdx(statusMenuOpenIdx === status._origIdx ? null : status._origIdx); }}
                                    className="p-1 text-gray-400 dark:text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                  </button>
                                  {statusMenuOpenIdx === status._origIdx && (
                                    <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-[#1e1f29] border border-gray-200 dark:border-[#2a2b36] rounded-lg shadow-xl z-50 py-1">
                                      <button
                                        onClick={() => { setStatusRenameIdx(status._origIdx); setStatusMenuOpenIdx(null); }}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#2a2b36]"
                                      >
                                        <Edit2 className="w-3 h-3" /> Rename
                                      </button>
                                      <button
                                        onClick={() => { handleRemoveTaskStatus(status._origIdx); setStatusMenuOpenIdx(null); }}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-gray-100 dark:hover:bg-[#2a2b36]"
                                      >
                                        <Trash2 className="w-3 h-3" /> Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                          {doneStatuses.length === 0 && !showTaskStatusesAddForm && (
                            <button
                              onClick={() => { setStatusAddingToSection('done'); setShowTaskStatusesAddForm(true); setTaskStatusesAddColor('#22c55e'); }}
                              className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-400 dark:text-slate-500 hover:text-violet-400 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3 h-3" /> Add status
                            </button>
                          )}
                          {/* Inline Add Status for Done */}
                          {taskStatusesUseCustom && showTaskStatusesAddForm && statusAddingToSection === 'done' && (
                            <div className="flex items-center gap-2 px-2 py-1.5">
                              <div className="relative flex-shrink-0">
                                <button
                                  onClick={() => setStatusColorPickerIdx(statusColorPickerIdx === -1 ? null : -1)}
                                  className="w-4 h-4 rounded-full cursor-pointer hover:scale-110 transition-transform"
                                  style={{ backgroundColor: taskStatusesAddColor }}
                                />
                                {statusColorPickerIdx === -1 && (
                                  <div className="absolute left-0 top-full mt-2 bg-white dark:bg-[#1e1f29] border border-gray-200 dark:border-[#2a2b36] rounded-lg shadow-xl p-3 z-50" onClick={(e) => e.stopPropagation()}>
                                    <div className="text-[10px] text-gray-500 dark:text-slate-400 mb-2">Color</div>
                                    <div className="grid grid-cols-5 gap-2">
                                      {COLOR_SWATCHES.map(color => (
                                        <button
                                          key={color}
                                          onClick={() => { setTaskStatusesAddColor(color); setStatusColorPickerIdx(null); }}
                                          className={cn("w-6 h-6 rounded-full hover:scale-110 transition-transform border-2", taskStatusesAddColor === color ? "border-white ring-1 ring-violet-400" : "border-transparent")}
                                          style={{ backgroundColor: color }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <input
                                type="text"
                                value={taskStatusesAddName}
                                onChange={(e) => setTaskStatusesAddName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && taskStatusesAddName.trim()) handleAddTaskStatus();
                                  if (e.key === 'Escape') { setShowTaskStatusesAddForm(false); setTaskStatusesAddName(''); }
                                }}
                                placeholder="Add status"
                                className="flex-1 bg-transparent text-gray-900 dark:text-white text-sm font-medium border border-gray-200 dark:border-[#2a2b36] rounded px-2 py-1 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                autoFocus
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Closed Section */}
                  {(() => {
                    const closedStatuses = taskStatusesList
                      .map((s, idx) => ({ ...s, _origIdx: idx }))
                      .filter(s => categorizeStatus(s) === 'closed');
                    return (
                      <div className="mb-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
                            Closed <span className="text-gray-400 dark:text-slate-500 cursor-help" title="Statuses for closed/archived tasks">ⓘ</span>
                          </span>
                          {taskStatusesUseCustom && (
                            <button
                              onClick={() => {
                                setStatusAddingToSection('closed');
                                setShowTaskStatusesAddForm(true);
                                setTaskStatusesAddColor('#6b7280');
                              }}
                              className="w-5 h-5 rounded-full border border-gray-300 dark:border-slate-500 flex items-center justify-center text-gray-400 dark:text-slate-500 hover:border-violet-400 hover:text-violet-400 transition-colors"
                              title="Add status"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="space-y-1">
                          {closedStatuses.map((status) => (
                            <div
                              key={status.id || `status-${status._origIdx}`}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-md group hover:bg-gray-50 dark:hover:bg-[#2a2b36] transition-colors"
                            >
                              {taskStatusesUseCustom && (
                                <GripVertical className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 cursor-grab flex-shrink-0" />
                              )}
                              <div className="relative flex-shrink-0">
                                <button
                                  onClick={() => taskStatusesUseCustom && setStatusColorPickerIdx(statusColorPickerIdx === status._origIdx ? null : status._origIdx)}
                                  className="w-4 h-4 rounded-full flex-shrink-0 cursor-pointer hover:scale-110 transition-transform"
                                  style={{ backgroundColor: status.color }}
                                />
                                {statusColorPickerIdx === status._origIdx && (
                                  <div className="absolute left-0 top-full mt-2 bg-white dark:bg-[#1e1f29] border border-gray-200 dark:border-[#2a2b36] rounded-lg shadow-xl p-3 z-50" onClick={(e) => e.stopPropagation()}>
                                    <div className="text-[10px] text-gray-500 dark:text-slate-400 mb-2">Color</div>
                                    <div className="grid grid-cols-5 gap-2">
                                      {COLOR_SWATCHES.map(color => (
                                        <button
                                          key={color}
                                          onClick={() => {
                                            const newList = [...taskStatusesList];
                                            newList[status._origIdx] = { ...taskStatusesList[status._origIdx], color, bgColor: color };
                                            setTaskStatusesList(newList);
                                            setStatusColorPickerIdx(null);
                                          }}
                                          className={cn("w-6 h-6 rounded-full hover:scale-110 transition-transform border-2", status.color === color ? "border-white ring-1 ring-violet-400" : "border-transparent")}
                                          style={{ backgroundColor: color }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              {taskStatusesUseCustom ? (
                                <input
                                  type="text"
                                  value={status.name}
                                  onChange={(e) => {
                                    const newList = [...taskStatusesList];
                                    newList[status._origIdx] = { ...taskStatusesList[status._origIdx], name: e.target.value.toUpperCase() };
                                    setTaskStatusesList(newList);
                                  }}
                                  ref={statusRenameIdx === status._origIdx ? (el) => el?.focus() : undefined}
                                  className={cn(
                                    "flex-1 bg-transparent text-gray-900 dark:text-white text-sm font-medium border-0 focus:outline-none focus:ring-0 px-1",
                                    statusRenameIdx === status._origIdx && "ring-1 ring-violet-500 rounded bg-white/5"
                                  )}
                                  onBlur={() => { if (statusRenameIdx === status._origIdx) setStatusRenameIdx(null); }}
                                />
                              ) : (
                                <span className="flex-1 text-sm text-gray-900 dark:text-slate-300 font-medium px-1">{status.name}</span>
                              )}
                              {taskStatusesUseCustom && (
                                <div className="relative flex-shrink-0">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setStatusMenuOpenIdx(statusMenuOpenIdx === status._origIdx ? null : status._origIdx); }}
                                    className="p-1 text-gray-400 dark:text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                  </button>
                                  {statusMenuOpenIdx === status._origIdx && (
                                    <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-[#1e1f29] border border-gray-200 dark:border-[#2a2b36] rounded-lg shadow-xl z-50 py-1">
                                      <button
                                        onClick={() => { setStatusRenameIdx(status._origIdx); setStatusMenuOpenIdx(null); }}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-[#2a2b36]"
                                      >
                                        <Edit2 className="w-3 h-3" /> Rename
                                      </button>
                                      <button
                                        onClick={() => { handleRemoveTaskStatus(status._origIdx); setStatusMenuOpenIdx(null); }}
                                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-gray-100 dark:hover:bg-[#2a2b36]"
                                      >
                                        <Trash2 className="w-3 h-3" /> Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                          {closedStatuses.length === 0 && !showTaskStatusesAddForm && (
                            <button
                              onClick={() => { setStatusAddingToSection('closed'); setShowTaskStatusesAddForm(true); setTaskStatusesAddColor('#6b7280'); }}
                              className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-400 dark:text-slate-500 hover:text-violet-400 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3 h-3" /> Add status
                            </button>
                          )}
                          {/* Inline Add Status for Closed */}
                          {taskStatusesUseCustom && showTaskStatusesAddForm && statusAddingToSection === 'closed' && (
                            <div className="flex items-center gap-2 px-2 py-1.5">
                              <div className="relative flex-shrink-0">
                                <button
                                  onClick={() => setStatusColorPickerIdx(statusColorPickerIdx === -1 ? null : -1)}
                                  className="w-4 h-4 rounded-full cursor-pointer hover:scale-110 transition-transform"
                                  style={{ backgroundColor: taskStatusesAddColor }}
                                />
                                {statusColorPickerIdx === -1 && (
                                  <div className="absolute left-0 top-full mt-2 bg-white dark:bg-[#1e1f29] border border-gray-200 dark:border-[#2a2b36] rounded-lg shadow-xl p-3 z-50" onClick={(e) => e.stopPropagation()}>
                                    <div className="text-[10px] text-gray-500 dark:text-slate-400 mb-2">Color</div>
                                    <div className="grid grid-cols-5 gap-2">
                                      {COLOR_SWATCHES.map(color => (
                                        <button
                                          key={color}
                                          onClick={() => { setTaskStatusesAddColor(color); setStatusColorPickerIdx(null); }}
                                          className={cn("w-6 h-6 rounded-full hover:scale-110 transition-transform border-2", taskStatusesAddColor === color ? "border-white ring-1 ring-violet-400" : "border-transparent")}
                                          style={{ backgroundColor: color }}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <input
                                type="text"
                                value={taskStatusesAddName}
                                onChange={(e) => setTaskStatusesAddName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && taskStatusesAddName.trim()) handleAddTaskStatus();
                                  if (e.key === 'Escape') { setShowTaskStatusesAddForm(false); setTaskStatusesAddName(''); }
                                }}
                                placeholder="Add status"
                                className="flex-1 bg-transparent text-gray-900 dark:text-white text-sm font-medium border border-gray-200 dark:border-[#2a2b36] rounded px-2 py-1 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                autoFocus
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-gray-200 dark:border-[#2a2b36] bg-gray-50 dark:bg-[#1a1b24]">
              <button className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1.5 transition-colors">
                <span className="text-gray-400 dark:text-slate-500">ⓘ</span> Learn more about statuses
              </button>
              <div className="flex items-center gap-3">
                <button
                  className="px-4 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#2e2f3a] rounded-lg transition-colors"
                >
                  Save as template
                </button>
                <button
                  onClick={handleApplyTaskStatuses}
                  className="px-5 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium transition-colors"
                >
                  Apply changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bookmark Modal */}
      {showBookmarkModal && (
        <div className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#14151a] rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[#1f2229]">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add a bookmark</h3>
              <button
                onClick={() => { setShowBookmarkModal(false); setBookmarkQuery(''); }}
                className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <input
                type="text"
                value={bookmarkQuery}
                onChange={(e) => setBookmarkQuery(e.target.value)}
                placeholder="Search ClickUp or paste any link..."
                className="w-full px-3 py-2 bg-gray-100 dark:bg-[#1e1f29] border border-gray-200 dark:border-[#1f2229] rounded-lg text-sm text-gray-900 dark:text-white"
                autoFocus
              />
              <div className="text-xs text-gray-400">Recent</div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {[...spaceDirectLists.map(l => ({ id: l.id, title: l.name, url: '#' })), ...spaceFolders.map(f => ({ id: f.id, title: f.name, url: '#' }))].slice(0, 6).map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setBookmarks(prev => [{ id: Date.now().toString(), title: item.title, url: item.url }, ...prev]);
                      setShowBookmarkModal(false);
                      setBookmarkQuery('');
                    }}
                    className="w-full text-left text-xs text-gray-500 dark:text-slate-400 hover:text-white flex items-center gap-2"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-[#1f2229]">
              <button
                onClick={() => { setShowBookmarkModal(false); setBookmarkQuery(''); }}
                className="px-3 py-1.5 text-xs text-gray-500 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!bookmarkQuery.trim()) return;
                  const url = bookmarkQuery.trim();
                  setBookmarks(prev => [{ id: Date.now().toString(), title: url, url }, ...prev]);
                  setShowBookmarkModal(false);
                  setBookmarkQuery('');
                }}
                className="px-3 py-1.5 text-xs bg-violet-600 text-white rounded hover:bg-violet-700"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
