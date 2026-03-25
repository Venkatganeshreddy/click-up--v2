import { useState, useEffect, useRef, useCallback, useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, ChevronDown, ChevronRight, ChevronLeft, Plus, Trash2, Settings, Eye, Copy,
  Type, AlignLeft, Calendar, List, CheckSquare, Phone, Users, Upload,
  Hash, PenTool, Info, Flag, GripVertical, Sun, Moon, MoreHorizontal,
  Search, User, Tag, Clock, Mail, Globe, MapPin, Link2, FileText, Image,
  Camera, DollarSign, Paperclip, ClipboardList, Check, Edit3, Folder,
  MessageSquare, ExternalLink, Columns, Link, SlidersHorizontal
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formsApi, formResponsesApi, spacesApi, taskListsApi, membersApi, customFieldsApi, taskStatusesApi, type TaskList, type CustomField, type CustomFieldValue, type TaskStatus } from '../services/api';
import SpellCheckInput from './SpellCheckInput';
import CustomFieldPanel from './CustomFieldPanel';
import type { Form, FormField, FormResponse, FormSettings, Space } from '../types';
import {
  DndContext,
  closestCenter,
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
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable column header for form responses
interface SortableResponseColumnHeaderProps {
  id: string;
  label: string;
  widthClass: string;
  isFixed?: boolean;
  index: number;
  total: number;
  isCustomField?: boolean;
  openColumnMenuId: string | null;
  setOpenColumnMenuId: (id: string | null) => void;
  onMoveToStart: (colId: string) => void;
  onMoveToEnd: (colId: string) => void;
  onHideColumn: (colId: string) => void;
  onDeleteField?: (colId: string, label: string) => void;
}

function SortableResponseColumnHeader({
  id, label, widthClass, isFixed,
  index, total, isCustomField,
  openColumnMenuId, setOpenColumnMenuId,
  onMoveToStart, onMoveToEnd, onHideColumn, onDeleteField,
}: SortableResponseColumnHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isMenuOpen = openColumnMenuId === id;
  const canMoveStart = !isFixed && index > 1; // index 0 is 'name' (fixed)
  const canMoveEnd = !isFixed && index < total - 1;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${widthClass} relative group`}
    >
      <div
        {...(isFixed ? {} : { ...attributes, ...listeners })}
        className={isFixed ? "flex items-center gap-1" : "flex items-center justify-center gap-0.5 cursor-grab active:cursor-grabbing"}
      >
        <span className="truncate">{label}</span>
        {!isFixed && (
          <button
            data-column-menu-trigger
            onClick={(e) => {
              e.stopPropagation();
              setOpenColumnMenuId(isMenuOpen ? null : id);
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
          className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 py-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { onMoveToStart(id); setOpenColumnMenuId(null); }}
            disabled={!canMoveStart}
            className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-700 ${!canMoveStart ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Move to start
          </button>
          <button
            onClick={() => { onMoveToEnd(id); setOpenColumnMenuId(null); }}
            disabled={!canMoveEnd}
            className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-700 ${!canMoveEnd ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <ChevronRight className="w-3.5 h-3.5" />
            Move to end
          </button>
          <button
            onClick={() => { onHideColumn(id); setOpenColumnMenuId(null); }}
            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            <Eye className="w-3.5 h-3.5" />
            Hide column
          </button>
          {(isCustomField || id.startsWith('data:')) && onDeleteField && (
            <button
              onClick={() => { onDeleteField(id, label); setOpenColumnMenuId(null); }}
              className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete field
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// SortableResponseRow component for drag-and-drop response row reordering
function SortableResponseRow({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

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


interface FormBuilderProps {
  form: Form;
  onClose: () => void;
  inline?: boolean;
}

// Sub-item interface for question types
interface SubItem {
  id: string;
  name: string;
  icon: any;
  isNew?: boolean;
  mapTo?: string;
}

// Enhanced question type definitions matching ClickUp
const questionTypes: Array<{
  id: string;
  name: string;
  icon: any;
  color: string;
  bgColor: string;
  subItems?: SubItem[];
}> = [
  {
    id: 'task_property',
    name: 'Task property',
    icon: Settings,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    subItems: [
      { id: 'task_name', name: 'Task Name', icon: Type, mapTo: 'name', isNew: false },
      { id: 'task_description', name: 'Task Description', icon: AlignLeft, mapTo: 'description', isNew: false },
      { id: 'assignee', name: 'Assignee', icon: User, mapTo: 'assignee', isNew: false },
      { id: 'status', name: 'Status', icon: CheckSquare, mapTo: 'status', isNew: false },
      { id: 'priority', name: 'Priority', icon: Flag, mapTo: 'priority', isNew: false },
      { id: 'start_date', name: 'Start Date', icon: Calendar, mapTo: 'start_date', isNew: false },
      { id: 'due_date', name: 'Due Date', icon: Calendar, mapTo: 'due_date', isNew: false },
      { id: 'tags', name: 'Tags', icon: Tag, mapTo: 'tags', isNew: false },
      { id: 'time_estimate', name: 'Time Estimate', icon: Clock, mapTo: 'time_estimate', isNew: false },
      { id: 'attachments', name: 'Attachments', icon: Paperclip, mapTo: 'attachments', isNew: false }
    ]
  },
  {
    id: 'short_text',
    name: 'Short text',
    icon: Type,
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/20',
    subItems: [
      { id: 'text', name: 'Text', icon: Type, isNew: true },
      { id: 'text_mapped', name: 'Text (Mapped)', icon: Type }
    ]
  },
  {
    id: 'long_text',
    name: 'Long text',
    icon: AlignLeft,
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/20',
    subItems: [
      { id: 'textarea', name: 'Text area (Long Text)', icon: AlignLeft, isNew: true }
    ]
  },
  {
    id: 'dates',
    name: 'Dates',
    icon: Calendar,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    subItems: [
      { id: 'date', name: 'Date', icon: Calendar, isNew: true },
      { id: 'start_date', name: 'Start Date', icon: Calendar },
      { id: 'due_date', name: 'Due Date', icon: Calendar }
    ]
  },
  {
    id: 'single_select',
    name: 'Single-select',
    icon: List,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    subItems: [
      { id: 'dropdown', name: 'Dropdown', icon: ChevronDown, isNew: true },
      { id: 'checkbox', name: 'Checkbox', icon: CheckSquare, isNew: true },
      { id: 'rating', name: 'Rating', icon: Flag, isNew: true },
      { id: 'voting', name: 'Voting', icon: Check, isNew: true },
      { id: 'status', name: 'Status', icon: CheckSquare }
    ]
  },
  {
    id: 'multi_select',
    name: 'Multi-select',
    icon: CheckSquare,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    subItems: [
      { id: 'labels', name: 'Labels', icon: Tag, isNew: true },
      { id: 'tags', name: 'Tags', icon: Tag }
    ]
  },
  {
    id: 'contact_info',
    name: 'Contact info',
    icon: Phone,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    subItems: [
      { id: 'email', name: 'Email', icon: Mail, isNew: true },
      { id: 'website', name: 'Website', icon: Globe, isNew: true },
      { id: 'phone', name: 'Phone', icon: Phone, isNew: true },
      { id: 'location', name: 'Location', icon: MapPin, isNew: true },
      { id: 'url', name: 'URL', icon: Link2, isNew: true }
    ]
  },
  {
    id: 'people',
    name: 'People',
    icon: Users,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/20',
    subItems: [
      { id: 'people', name: 'People', icon: Users, isNew: true },
      { id: 'assignee', name: 'Assignee', icon: User }
    ]
  },
  {
    id: 'uploads',
    name: 'Uploads',
    icon: Upload,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    subItems: [
      { id: 'files', name: 'Files', icon: Paperclip, isNew: true },
      { id: 'attachments', name: 'Attachments', icon: Paperclip },
      { id: 'attach_documents', name: 'Attach Documents', icon: FileText, isNew: true },
      { id: 'image', name: 'Image', icon: Image, isNew: true },
      { id: 'screenshot', name: 'Screenshot', icon: Camera, isNew: true }
    ]
  },
  {
    id: 'number',
    name: 'Number',
    icon: Hash,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/20',
    subItems: [
      { id: 'money', name: 'Money', icon: DollarSign, isNew: true },
      { id: 'number', name: 'Number', icon: Hash, isNew: true },
      { id: 'time_estimate', name: 'Time Estimate', icon: Clock }
    ]
  },
  {
    id: 'signature',
    name: 'Signature',
    icon: PenTool,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/20',
    subItems: [
      { id: 'signature', name: 'Signature', icon: PenTool, isNew: true }
    ]
  },
  {
    id: 'info_block',
    name: 'Information Block',
    icon: Info,
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/20'
  }
];

// Default status options for form responses
const defaultStatusOptions: { id: string; name: string; color: string; status_group: 'active' | 'done' | 'closed' }[] = [
  { id: 'to_do', name: 'TO DO', color: '#6b7280', status_group: 'active' },
  { id: 'in_progress', name: 'IN PROGRESS', color: '#3b82f6', status_group: 'active' },
  { id: 'in_review', name: 'IN REVIEW', color: '#8b5cf6', status_group: 'active' },
  { id: 'done', name: 'DONE', color: '#22c55e', status_group: 'done' },
  { id: 'closed', name: 'CLOSED', color: '#ef4444', status_group: 'closed' }
];

// Type for status options
interface StatusOption {
  id: string;
  name: string;
  color: string;
  status_group?: 'active' | 'done' | 'closed';
  position?: number;
}

const priorityOptions = [
  { id: 'urgent', name: 'Urgent', color: '#ef4444', icon: '🔥' },
  { id: 'high', name: 'High', color: '#f97316', icon: '⬆️' },
  { id: 'normal', name: 'Normal', color: '#6b7280', icon: '➡️' },
  { id: 'low', name: 'Low', color: '#3b82f6', icon: '⬇️' }
];

// Group By options
const groupByOptions = [
  { id: 'status', name: 'Status', icon: CheckSquare },
  { id: 'assignee', name: 'Assignee', icon: User },
  { id: 'priority', name: 'Priority', icon: Flag },
  { id: 'tags', name: 'Tags', icon: Tag },
  { id: 'due_date', name: 'Due date', icon: Calendar },
  { id: 'none', name: 'None', icon: List },
];

// ClickUp-style List View Component for Form Responses
interface ResponsesListViewProps {
  responses: FormResponse[];
  members: any[];
  statusOptions: StatusOption[];
  priorityOptions: typeof priorityOptions;
  isLoading: boolean;
  onAddResponse: (defaultStatus?: string) => void;
  onEditResponse: (response: FormResponse) => void;
  onDeleteResponse: (id: string) => void;
  onUpdateResponse: (id: string, data: Partial<FormResponse>) => void;
  onUpdateStatuses: (statuses: StatusOption[]) => void;
  responseSearch: string;
  setResponseSearch: (search: string) => void;
  formSpace?: Space;
  formName: string;
  formId: string;
  inheritFromSpace: boolean;
  onToggleInheritance: (inherit: boolean) => void;
  customFields: CustomField[];
  fieldValueMap: Record<string, Record<string, CustomFieldValue>>;
  onFieldCreated: () => void;
}

function ResponsesListView({
  responses,
  members,
  statusOptions,
  priorityOptions,
  isLoading,
  onAddResponse,
  onEditResponse,
  onDeleteResponse,
  onUpdateResponse,
  onUpdateStatuses,
  responseSearch,
  setResponseSearch,
  formSpace,
  formName,
  formId,
  inheritFromSpace,
  onToggleInheritance,
  customFields,
  fieldValueMap,
  onFieldCreated
}: ResponsesListViewProps) {
  const queryClient = useQueryClient();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [activeAssigneeCell, setActiveAssigneeCell] = useState<string | null>(null);
  const [activeDateCell, setActiveDateCell] = useState<string | null>(null);
  const [activeStatusCell, setActiveStatusCell] = useState<string | null>(null);
  const [activeRowMenu, setActiveRowMenu] = useState<string | null>(null);
  const [activeGroupMenu, setActiveGroupMenu] = useState<string | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [groupBy, setGroupBy] = useState('status');
  const [showGroupByDropdown, setShowGroupByDropdown] = useState(false);
  const [groupBySearch, setGroupBySearch] = useState('');

  // Drag-and-drop state for response row reordering
  const [activeDragResponse, setActiveDragResponse] = useState<FormResponse | null>(null);

  const taskDragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const handleResponseDragStart = useCallback((event: DragStartEvent) => {
    const responseId = event.active.id as string;
    const response = responses.find(r => r.id === responseId);
    if (response) setActiveDragResponse(response);
  }, [responses]);

  const handleResponseDragEnd = useCallback((event: DragEndEvent, groupResponses: FormResponse[]) => {
    const { active, over } = event;
    setActiveDragResponse(null);

    if (!over || active.id === over.id) return;

    const oldIndex = groupResponses.findIndex(r => r.id === active.id);
    const newIndex = groupResponses.findIndex(r => r.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(groupResponses, oldIndex, newIndex);

    // Optimistically update the cache
    queryClient.setQueryData(['formResponses', formId], (old: FormResponse[] | undefined) => {
      if (!old) return old;
      return old.map(r => {
        const newPos = reordered.findIndex(rr => rr.id === r.id);
        if (newPos !== -1) {
          return { ...r, position: newPos };
        }
        return r;
      });
    });

    // Persist position updates
    reordered.forEach((response, idx) => {
      if ((response.position ?? 0) !== idx) {
        formResponsesApi.update(response.id, { position: idx } as Partial<FormResponse>);
      }
    });
  }, [queryClient, formId]);

  // Column order state for drag-and-drop column reordering
  const defaultColumnOrder = ['name', 'assignee', 'due_date', 'priority'];
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`form-response-col-order-v3-${formId}`);
      if (!saved) return defaultColumnOrder;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return defaultColumnOrder;
      return parsed.length > 0 ? parsed : defaultColumnOrder;
    } catch {
      return defaultColumnOrder;
    }
  });

  // Column drag sensors (separate from row drag)
  const columnDragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // Custom field inline editing state
  const [editingFieldCell, setEditingFieldCell] = useState<{ responseId: string; fieldId: string; field: CustomField } | null>(null);
  const [editingFieldValue, setEditingFieldValue] = useState<any>(null);

  // Mutation for setting custom field values
  const setFieldValueMutation = useMutation({
    mutationFn: ({ responseId, fieldId, value }: { responseId: string; fieldId: string; value: any }) =>
      customFieldsApi.setValue(responseId, fieldId, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customFieldValues'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update field value');
    }
  });
  const [showEditStatusesModal, setShowEditStatusesModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<FormResponse | null>(null);
  const [showTaskDetailPanel, setShowTaskDetailPanel] = useState(false);

  // Detail panel dropdown states
  const [detailStatusOpen, setDetailStatusOpen] = useState(false);
  const [detailAssigneeOpen, setDetailAssigneeOpen] = useState(false);
  const [detailDueDateOpen, setDetailDueDateOpen] = useState(false);
  const [detailPriorityOpen, setDetailPriorityOpen] = useState(false);
  const [detailMenuOpen, setDetailMenuOpen] = useState(false);
  const [detailAssigneeSearch, setDetailAssigneeSearch] = useState('');

  // Edit statuses state
  const [editingStatuses, setEditingStatuses] = useState<StatusOption[]>(statusOptions);
  const [useCustomStatuses, setUseCustomStatuses] = useState(!inheritFromSpace);
  const [newStatusName, setNewStatusName] = useState('');
  const [statusTemplate, setStatusTemplate] = useState('custom');
  const [colorPickerStatusId, setColorPickerStatusId] = useState<string | null>(null);
  const [statusMenuOpenId, setStatusMenuOpenId] = useState<string | null>(null);
  const [renamingStatusId, setRenamingStatusId] = useState<string | null>(null);
  const [originalStatusNames, setOriginalStatusNames] = useState<Record<string, string>>({});
  const [showCustomFieldPanel, setShowCustomFieldPanel] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const initializedColumnsRef = useRef(false);
  const [columnSearchQuery, setColumnSearchQuery] = useState('');
  const [openColumnMenuId, setOpenColumnMenuId] = useState<string | null>(null);
  const [showFieldsPanel, setShowFieldsPanel] = useState(false);
  const [fieldsPanelStep, setFieldsPanelStep] = useState<'customize' | 'fields'>('customize');
  const [fieldsPanelSearch, setFieldsPanelSearch] = useState('');
  const [showAddColumnPanel, setShowAddColumnPanel] = useState(false);
  const [showEmptyStatuses, setShowEmptyStatuses] = useState(() => {
    try {
      return localStorage.getItem(`form-response-show-empty-${formId}`) === 'true';
    } catch { return false; }
  });
  // Track hidden base fields and custom fields (visible by default)
  const [hiddenBaseFields, setHiddenBaseFields] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`form-response-hidden-fields-${formId}`);
      if (saved) return new Set(JSON.parse(saved));
      // Default: status is hidden until user adds it
      return new Set(['status']);
    } catch { return new Set(['status']); }
  });
  const [hiddenCustomFields, setHiddenCustomFields] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`form-response-hidden-cf-${formId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  // Merge custom fields into column order, filtering out hidden fields
  const allColumnIds = useMemo(() => {
    const baseFieldIds = ['name', 'status', 'assignee', 'due_date', 'priority'];
    const customFieldIds = customFields.filter(f => !hiddenCustomFields.has(f.id)).map(f => f.id);
    const dataColIds = visibleColumns.map(col => `data:${col}`);
    const validIds = new Set([...baseFieldIds, ...customFieldIds, ...dataColIds]);

    // Start with saved order, filtering out stale/removed columns and hidden base fields
    const ordered = columnOrder.filter(id => {
      if (!validIds.has(id)) return false;
      if (id !== 'name' && hiddenBaseFields.has(id)) return false;
      return true;
    });

    // Append any NEW columns not yet in saved order
    for (const id of baseFieldIds) {
      if (!ordered.includes(id) && !hiddenBaseFields.has(id)) ordered.push(id);
    }
    // name is always shown
    if (!ordered.includes('name')) ordered.unshift('name');
    for (const id of customFieldIds) {
      if (!ordered.includes(id)) ordered.push(id);
    }
    for (const id of dataColIds) {
      if (!ordered.includes(id)) ordered.push(id);
    }
    return ordered;
  }, [columnOrder, customFields, visibleColumns, hiddenBaseFields, hiddenCustomFields]);

  const handleColumnDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Don't allow moving 'name' column
    if (active.id === 'name' || over.id === 'name') return;

    // Use allColumnIds so custom fields and data columns are also draggable
    const oldIndex = allColumnIds.indexOf(active.id as string);
    const newIndex = allColumnIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove([...allColumnIds], oldIndex, newIndex);
    localStorage.setItem(`form-response-col-order-v3-${formId}`, JSON.stringify(newOrder));
    setColumnOrder(newOrder);
  }, [formId, allColumnIds]);

  // Column menu: move to start (after 'name')
  const handleColumnMoveToStart = useCallback((colId: string) => {
    const current = [...allColumnIds];
    const filtered = current.filter(id => id !== colId);
    const nameIdx = filtered.indexOf('name');
    filtered.splice(nameIdx + 1, 0, colId);
    localStorage.setItem(`form-response-col-order-v3-${formId}`, JSON.stringify(filtered));
    setColumnOrder(filtered);
  }, [formId, allColumnIds]);

  // Column menu: move to end
  const handleColumnMoveToEnd = useCallback((colId: string) => {
    const current = [...allColumnIds];
    const newOrder = [...current.filter(id => id !== colId), colId];
    localStorage.setItem(`form-response-col-order-v3-${formId}`, JSON.stringify(newOrder));
    setColumnOrder(newOrder);
  }, [formId, allColumnIds]);

  // Column menu: hide column
  const handleColumnHide = useCallback((colId: string) => {
    const baseFieldIds = ['name', 'status', 'assignee', 'due_date', 'priority'];
    if (baseFieldIds.includes(colId)) {
      setHiddenBaseFields(prev => {
        const next = new Set(prev);
        next.add(colId);
        localStorage.setItem(`form-response-hidden-fields-${formId}`, JSON.stringify([...next]));
        return next;
      });
    } else if (colId.startsWith('data:')) {
      const colName = colId.replace('data:', '');
      setVisibleColumns(prev => prev.filter(c => c !== colName));
    } else {
      // Custom field
      setHiddenCustomFields(prev => {
        const next = new Set(prev);
        next.add(colId);
        localStorage.setItem(`form-response-hidden-cf-${formId}`, JSON.stringify([...next]));
        return next;
      });
    }
  }, [formId]);

  // Column menu: delete field (custom fields only)
  const deleteCustomFieldMutation = useMutation({
    mutationFn: (fieldId: string) => customFieldsApi.delete(fieldId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customFields'] });
      toast.success('Field deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete field');
    }
  });

  const handleColumnDelete = useCallback((colId: string, label: string) => {
    if (colId.startsWith('data:')) {
      const colName = colId.replace('data:', '');
      setVisibleColumns(prev => prev.filter(c => c !== colName));
      toast.success(`Column "${colName}" removed`);
    } else {
      if (confirm(`Delete field "${label}"?`)) {
        deleteCustomFieldMutation.mutate(colId);
      }
    }
  }, [deleteCustomFieldMutation]);

  // Column config map for rendering
  const columnConfig: Record<string, { label: string; widthClass: string; isFixed?: boolean }> = {
    name: { label: 'Name', widthClass: 'flex-1 min-w-[200px]', isFixed: true },
    status: { label: 'Status', widthClass: 'w-32 text-center' },
    assignee: { label: 'Assignee', widthClass: 'w-32 text-center' },
    due_date: { label: 'Due date', widthClass: 'w-28 text-center' },
    priority: { label: 'Priority', widthClass: 'w-24 text-center' },
  };
  const statusInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Color palette for status colors
  const colorPalette = [
    '#6b7280', '#9ca3af', '#4b5563', // Grays
    '#ef4444', '#f97316', '#f59e0b', // Red, Orange, Amber
    '#eab308', '#84cc16', '#22c55e', // Yellow, Lime, Green
    '#10b981', '#14b8a6', '#06b6d4', // Emerald, Teal, Cyan
    '#0ea5e9', '#3b82f6', '#6366f1', // Sky, Blue, Indigo
    '#8b5cf6', '#a855f7', '#d946ef', // Violet, Purple, Fuchsia
    '#ec4899', '#f43f5e', '#be123c', // Pink, Rose, Dark Rose
  ];

  // View state (list, calendar, team)
  const [currentView, setCurrentView] = useState<'list' | 'calendar' | 'team'>('list');

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);

  // Refs for click-outside detection
  const groupByRef = useRef<HTMLDivElement>(null);
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);

  // Click outside handler for all dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close group by dropdown
      if (groupByRef.current && !groupByRef.current.contains(event.target as Node)) {
        setShowGroupByDropdown(false);
        setGroupBySearch('');
      }
      // Close group menus
      if (activeGroupMenu && groupMenuRef.current && !groupMenuRef.current.contains(event.target as Node)) {
        setActiveGroupMenu(null);
      }
      // Close row menus
      if (activeRowMenu && rowMenuRef.current && !rowMenuRef.current.contains(event.target as Node)) {
        setActiveRowMenu(null);
      }
      // Close column header menus when clicking outside
      const target = event.target as HTMLElement;
      if (openColumnMenuId && !target.closest('[data-column-menu]') && !target.closest('[data-column-menu-trigger]')) {
        setOpenColumnMenuId(null);
      }
      // Close inline dropdowns when clicking outside
      if (!target.closest('[data-dropdown="assignee"]')) {
        setActiveAssigneeCell(null);
        setAssigneeSearch('');
      }
      if (!target.closest('[data-dropdown="date"]')) {
        setActiveDateCell(null);
      }
      if (!target.closest('[data-dropdown="status"]')) {
        setActiveStatusCell(null);
      }
      // Close custom field editor when clicking outside
      if (!target.closest('[data-field-editor]')) {
        setEditingFieldCell(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeGroupMenu, activeRowMenu, openColumnMenuId]);

  const openAddColumnMenu = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setShowFieldsPanel(false);
    setShowCustomFieldPanel(false);
    setShowAddColumnPanel(true);
  }, []);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowGroupByDropdown(false);
        setActiveGroupMenu(null);
        setActiveRowMenu(null);
        setOpenColumnMenuId(null);
        setActiveAssigneeCell(null);
        setActiveDateCell(null);
        setActiveStatusCell(null);
        setShowEditStatusesModal(false);
        setColorPickerStatusId(null);
        setDetailStatusOpen(false);
        setDetailAssigneeOpen(false);
        setDetailDueDateOpen(false);
        setDetailPriorityOpen(false);
        setShowTaskDetailPanel(false);
        setSelectedTask(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Compute groups based on groupBy selection
  const computedGroups = useMemo(() => {
    type Group = { id: string; name: string; color: string; responses: FormResponse[] };
    const groups: Group[] = [];

    if (groupBy === 'status') {
      // Group by status
      const grouped = statusOptions.reduce((acc, status) => {
        acc[status.id] = responses.filter(r => {
          const responseStatus = r.status?.toLowerCase() || '';
          const statusId = status.id.toLowerCase();
          const statusName = status.name.toLowerCase();
          return responseStatus === statusId || responseStatus === statusName;
        });
        return acc;
      }, {} as Record<string, FormResponse[]>);

      // Find unmatched responses and add to first group
      const matchedIds = new Set(Object.values(grouped).flat().map(r => r.id));
      const unmatched = responses.filter(r => !matchedIds.has(r.id));
      if (unmatched.length > 0 && statusOptions.length > 0) {
        grouped[statusOptions[0].id] = [...(grouped[statusOptions[0].id] || []), ...unmatched];
      }

      statusOptions.forEach(status => {
        groups.push({ id: status.id, name: status.name, color: status.color, responses: grouped[status.id] || [] });
      });
    } else if (groupBy === 'priority') {
      // Group by priority
      priorityOptions.forEach(p => {
        const matched = responses.filter(r => (r.priority || '').toLowerCase() === p.id.toLowerCase());
        groups.push({ id: p.id, name: p.name, color: p.color, responses: matched });
      });
      const noPriority = responses.filter(r => !r.priority || !priorityOptions.some(p => p.id.toLowerCase() === (r.priority || '').toLowerCase()));
      if (noPriority.length > 0) {
        groups.push({ id: 'no_priority', name: 'No Priority', color: '#9ca3af', responses: noPriority });
      }
    } else if (groupBy === 'assignee') {
      // Group by assignee
      const assigneeMap: Record<string, { name: string; responses: FormResponse[] }> = {};
      const unassigned: FormResponse[] = [];

      responses.forEach(r => {
        const ids = r.assignee_ids?.length ? r.assignee_ids : r.assignee_id ? [r.assignee_id] : [];
        if (ids.length === 0) {
          unassigned.push(r);
        } else {
          ids.forEach(id => {
            const member = members.find((m: any) => m.id === id);
            const name = member?.name || id;
            if (!assigneeMap[id]) assigneeMap[id] = { name, responses: [] };
            assigneeMap[id].responses.push(r);
          });
        }
      });

      Object.entries(assigneeMap)
        .sort(([, a], [, b]) => a.name.localeCompare(b.name))
        .forEach(([id, data]) => {
          groups.push({ id, name: data.name, color: '#6366f1', responses: data.responses });
        });
      if (unassigned.length > 0 || Object.keys(assigneeMap).length === 0) {
        groups.push({ id: 'unassigned', name: 'Unassigned', color: '#9ca3af', responses: unassigned });
      }
    } else if (groupBy === 'due_date') {
      // Group by due date buckets
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const buckets: Record<string, FormResponse[]> = {
        overdue: [], today: [], tomorrow: [], this_week: [], later: [], no_date: []
      };

      responses.forEach(r => {
        if (!r.due_date) { buckets.no_date.push(r); return; }
        const d = new Date(r.due_date);
        d.setHours(0, 0, 0, 0);
        if (d < now) buckets.overdue.push(r);
        else if (d.getTime() === now.getTime()) buckets.today.push(r);
        else if (d.getTime() === tomorrow.getTime()) buckets.tomorrow.push(r);
        else if (d < weekEnd) buckets.this_week.push(r);
        else buckets.later.push(r);
      });

      const bucketConfig = [
        { id: 'overdue', name: 'Overdue', color: '#ef4444' },
        { id: 'today', name: 'Today', color: '#f59e0b' },
        { id: 'tomorrow', name: 'Tomorrow', color: '#3b82f6' },
        { id: 'this_week', name: 'This Week', color: '#22c55e' },
        { id: 'later', name: 'Later', color: '#8b5cf6' },
        { id: 'no_date', name: 'No Date', color: '#9ca3af' },
      ];
      bucketConfig.forEach(b => {
        groups.push({ id: b.id, name: b.name, color: b.color, responses: buckets[b.id] });
      });
    } else if (groupBy === 'tags') {
      // Group by tags
      const tagMap: Record<string, FormResponse[]> = {};
      const noTags: FormResponse[] = [];

      responses.forEach(r => {
        if (!r.tags || r.tags.length === 0) { noTags.push(r); return; }
        r.tags.forEach(tag => {
          if (!tagMap[tag]) tagMap[tag] = [];
          tagMap[tag].push(r);
        });
      });

      Object.keys(tagMap).sort().forEach(tag => {
        groups.push({ id: tag, name: tag, color: '#6366f1', responses: tagMap[tag] });
      });
      if (noTags.length > 0 || Object.keys(tagMap).length === 0) {
        groups.push({ id: 'no_tags', name: 'No Tags', color: '#9ca3af', responses: noTags });
      }
    } else {
      // 'none' - single group
      groups.push({ id: 'all', name: 'All Responses', color: '#6366f1', responses: [...responses] });
    }

    // Sort responses within each group by position
    groups.forEach(g => g.responses.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)));

    return groups;
  }, [groupBy, responses, statusOptions, priorityOptions, members, showEmptyStatuses]);

  // Compute available custom columns from all response_data fields
  const availableColumns = Array.from(new Set(
    responses.flatMap(r => Object.keys(r.response_data || {}))
  )).filter(col => !['Task Name', 'name'].includes(col));

  // Initialize response_data columns on first load so form fields show by default.
  useEffect(() => {
    if (!initializedColumnsRef.current && availableColumns.length > 0) {
      setVisibleColumns(availableColumns);
      initializedColumnsRef.current = true;
    }
  }, [availableColumns]);

  // Filter columns based on search
  const filteredColumns = availableColumns.filter(col =>
    col.toLowerCase().includes(columnSearchQuery.toLowerCase())
  );

  const toggleColumn = (columnName: string) => {
    const isCurrentlyVisible = visibleColumns.includes(columnName);
    setVisibleColumns(prev =>
      isCurrentlyVisible
        ? prev.filter(c => c !== columnName)
        : [...prev, columnName]
    );
    toast.success(isCurrentlyVisible ? `"${columnName}" column hidden` : `"${columnName}" column added`);
  };

  const toggleGroup = (statusId: string) => {
    const newCollapsed = new Set(collapsedGroups);
    if (newCollapsed.has(statusId)) {
      newCollapsed.delete(statusId);
    } else {
      newCollapsed.add(statusId);
    }
    setCollapsedGroups(newCollapsed);
  };

  const filteredMembers = members.filter((m: any) =>
    m.name?.toLowerCase().includes(assigneeSearch.toLowerCase())
  );

  const filteredGroupByOptions = groupByOptions.filter(opt =>
    opt.name.toLowerCase().includes(groupBySearch.toLowerCase())
  );

  const formatDueDate = (date: string | null) => {
    if (!date) return null;
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;
  };

  // Get avatar color based on initials
  const getAvatarColor = (name: string) => {
    const colors = ['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Copy link to clipboard
  const copyTaskLink = (taskId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/tasks/${taskId}`);
    toast.success('Link copied to clipboard');
  };

  // Duplicate task
  const duplicateTask = (task: FormResponse) => {
    // This would call create with same data
    onAddResponse(task.status || undefined);
  };

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty days for the start of the month
    for (let i = 0; i < startingDay; i++) {
      const prevDate = new Date(year, month, -startingDay + i + 1);
      days.push(prevDate);
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    // Add remaining days to complete the grid (6 rows)
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }

    return days;
  };

  const getTasksForDate = (date: Date | null) => {
    if (!date) return [];
    return responses.filter(r => {
      if (!r.due_date) return false;
      const taskDate = new Date(r.due_date);
      return taskDate.toDateString() === date.toDateString();
    });
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    return date.toDateString() === new Date().toDateString();
  };

  const isCurrentMonth = (date: Date | null) => {
    if (!date) return false;
    return date.getMonth() === currentDate.getMonth();
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const calendarDays = getDaysInMonth(currentDate);

  // Get unscheduled and overdue tasks
  const unscheduledTasks = responses.filter(r => !r.due_date);
  const overdueTasks = responses.filter(r => {
    if (!r.due_date) return false;
    return new Date(r.due_date) < new Date() && r.status !== 'done';
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-[#0f1012]">
      {/* Location Header / Breadcrumb */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#1f2229] bg-gray-100 dark:bg-[#14151a]">
        <div className="flex items-center gap-2 text-sm">
          {formSpace && (
            <>
              <div
                className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white"
                style={{ backgroundColor: formSpace.color || '#6366f1' }}
              >
                {formSpace.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-gray-500 dark:text-slate-300 font-medium">{formSpace.name}</span>
              <span className="text-gray-400 dark:text-slate-500">/</span>
            </>
          )}
          <ClipboardList className="w-4 h-4 text-violet-400" />
          <span className="text-gray-900 dark:text-white font-medium">{formName}</span>
          <span className="text-gray-400 dark:text-slate-500">...</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAddResponse()}
            className="px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded hover:bg-violet-700 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add Task
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 dark:border-[#1f2229] bg-gray-100 dark:bg-[#14151a]">
        <button
          onClick={() => toast.info('Form Issues view coming soon')}
          className="px-3 py-1.5 text-xs text-gray-500 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded flex items-center gap-1.5"
        >
          <ClipboardList className="w-3.5 h-3.5" /> Form Issues
        </button>
        <button
          onClick={() => setCurrentView('list')}
          className={`px-3 py-1.5 text-xs rounded flex items-center gap-1.5 ${
            currentView === 'list' ? 'bg-gray-200 dark:bg-[#15161a] text-gray-900 dark:text-white' : 'text-gray-500 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          <List className="w-3.5 h-3.5" /> List
        </button>
        <button
          onClick={() => setCurrentView('calendar')}
          className={`px-3 py-1.5 text-xs rounded flex items-center gap-1.5 ${
            currentView === 'calendar' ? 'bg-gray-200 dark:bg-[#15161a] text-gray-900 dark:text-white' : 'text-gray-500 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" /> Calendar
        </button>
        <button
          onClick={() => setCurrentView('team')}
          className={`px-3 py-1.5 text-xs rounded flex items-center gap-1.5 ${
            currentView === 'team' ? 'bg-gray-200 dark:bg-[#15161a] text-gray-900 dark:text-white' : 'text-gray-500 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Team
        </button>
        <button
          onClick={() => toast.info('Custom views coming soon')}
          className="px-3 py-1.5 text-xs text-gray-500 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded flex items-center gap-1.5"
        >
          + View
        </button>
      </div>

      {/* Toolbar - Only show for List View */}
      {currentView === 'list' && (
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-[#1f2229]">
        <div className="flex items-center gap-2">
          {/* Group By Dropdown */}
          <div className="relative" ref={groupByRef}>
            <button
              onClick={() => setShowGroupByDropdown(!showGroupByDropdown)}
              className="px-3 py-1.5 text-xs text-gray-500 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded flex items-center gap-1.5"
            >
              <List className="w-3.5 h-3.5" />
              Group: {groupByOptions.find(o => o.id === groupBy)?.name || 'Status'}
              <ChevronDown className="w-3 h-3 text-gray-400 dark:text-slate-400" />
            </button>
            {showGroupByDropdown && (
              <div className="absolute left-0 top-full mt-1 w-64 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50">
                <div className="p-2 border-b border-gray-200 dark:border-[#1f2229]">
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-100 dark:bg-[#14151a] rounded">
                    <Search className="w-3.5 h-3.5 text-gray-400 dark:text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={groupBySearch}
                      onChange={(e) => setGroupBySearch(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="py-1">
                  <div className="px-3 py-1.5 text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider">Group by</div>
                  {filteredGroupByOptions.map(option => (
                    <button
                      key={option.id}
                      onClick={() => {
                        setGroupBy(option.id);
                        setShowGroupByDropdown(false);
                        setGroupBySearch('');
                      }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-700 ${
                        groupBy === option.id ? 'text-violet-400' : 'text-gray-500 dark:text-slate-300'
                      }`}
                    >
                      <option.icon className="w-4 h-4" />
                      {option.name}
                      {groupBy === option.id && <Check className="w-4 h-4 ml-auto" />}
                    </button>
                  ))}
                </div>
                <div className="p-2 border-t border-gray-200 dark:border-[#1f2229]">
                  <button
                    onClick={() => {
                      toast.info('Group by options coming soon');
                      setShowGroupByDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-sm text-gray-400 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded flex items-center gap-2"
                  >
                    <Settings className="w-3.5 h-3.5" /> More options...
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => toast.info('Subtasks view coming soon')}
            className="px-3 py-1.5 text-xs text-gray-500 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded flex items-center gap-1.5"
          >
            Subtasks
          </button>
          <button
            onClick={() => {
              setShowFieldsPanel(true);
              setFieldsPanelStep('customize');
            }}
            className="px-3 py-1.5 text-xs text-gray-500 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded flex items-center gap-1.5"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Customize
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toast.info('Filters coming soon')}
            className="px-3 py-1.5 text-xs text-gray-500 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" /> Filter
          </button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={responseSearch}
              onChange={(e) => setResponseSearch(e.target.value)}
              className="w-40 pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none"
            />
          </div>
        </div>
      </div>
      )}


      {/* Calendar View */}
      {currentView === 'calendar' && (
        <div className="flex-1 flex overflow-hidden">
          {/* Main Calendar */}
          <div className="flex-1 flex flex-col">
            {/* Calendar Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-[#1f2229]">
              <div className="flex items-center gap-2">
                <button
                  onClick={goToToday}
                  className="px-3 py-1.5 bg-gray-200 dark:bg-[#15161a] hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-white text-xs font-medium rounded"
                >
                  Today
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowMonthDropdown(!showMonthDropdown)}
                    className="px-3 py-1.5 bg-gray-100 dark:bg-[#14151a] hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-900 dark:text-white text-xs font-medium rounded flex items-center gap-1.5 border border-gray-200 dark:border-[#1f2229]"
                  >
                    Month <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
                <button
                  onClick={goToPreviousMonth}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                <button
                  onClick={goToNextMonth}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toast.info('Filters coming soon')}
                  className="px-3 py-1.5 text-xs text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" /> Filter
                </button>
                <button
                  onClick={() => toast.info('Show closed coming soon')}
                  className="px-3 py-1.5 text-xs text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" /> Closed
                </button>
                <button
                  onClick={() => toast.info('Assignee filter coming soon')}
                  className="px-3 py-1.5 text-xs text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded flex items-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5" /> Assignee
                </button>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={responseSearch}
                    onChange={(e) => setResponseSearch(e.target.value)}
                    className="w-32 pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 overflow-auto">
              {/* Day Headers */}
              <div className="grid grid-cols-7 border-b border-gray-200 dark:border-[#1f2229] sticky top-0 bg-gray-50 dark:bg-[#0f1012] z-10">
                {dayNames.map(day => (
                  <div key={day} className="px-2 py-2 text-xs font-medium text-gray-400 dark:text-slate-400 border-r border-gray-200 dark:border-[#1f2229] last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Weeks */}
              <div className="grid grid-cols-7 flex-1">
                {calendarDays.map((day, index) => {
                  const tasksForDay = day ? getTasksForDate(day) : [];
                  const isCurrentMonthDay = isCurrentMonth(day);
                  const isTodayDay = isToday(day);

                  return (
                    <div
                      key={index}
                      className={`min-h-[100px] border-r border-b border-gray-200 dark:border-[#1f2229] last:border-r-0 p-1 ${
                        !isCurrentMonthDay ? 'bg-gray-100/50 dark:bg-slate-900/30' : ''
                      } ${isTodayDay ? 'bg-violet-100 dark:bg-violet-600/10' : ''}`}
                    >
                      <div className={`text-xs font-medium mb-1 text-right pr-1 ${
                        isTodayDay ? 'text-violet-600 dark:text-violet-400' : isCurrentMonthDay ? 'text-gray-700 dark:text-slate-300' : 'text-gray-400 dark:text-slate-600'
                      }`}>
                        {day?.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {tasksForDay.slice(0, 3).map(task => {
                          const status = statusOptions.find(s => s.id === task.status);
                          return (
                            <button
                              key={task.id}
                              onClick={() => {
                                setSelectedTask(task);
                                setShowTaskDetailPanel(true);
                              }}
                              className="w-full text-left px-1.5 py-0.5 rounded text-[10px] truncate hover:opacity-80"
                              style={{ backgroundColor: `${status?.color || '#6366f1'}30`, color: status?.color || '#6366f1' }}
                            >
                              {task.name}
                            </button>
                          );
                        })}
                        {tasksForDay.length > 3 && (
                          <div className="text-[10px] text-gray-400 dark:text-slate-500 pl-1">
                            +{tasksForDay.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar - Unscheduled & Overdue */}
          <div className="w-48 border-l border-gray-200 dark:border-[#1f2229] bg-gray-100 dark:bg-[#14151a] overflow-y-auto">
            {/* Unscheduled */}
            <div className="border-b border-gray-200 dark:border-[#1f2229]">
              <div className="flex items-center justify-between px-3 py-2 bg-gray-200/50 dark:bg-[#14151a]">
                <span className="text-xs font-medium text-gray-500 dark:text-slate-400">Unscheduled</span>
                <span className="text-xs text-gray-400 dark:text-slate-500">{unscheduledTasks.length}</span>
              </div>
              <div className="max-h-40 overflow-y-auto">
                {unscheduledTasks.slice(0, 5).map(task => (
                  <button
                    key={task.id}
                    onClick={() => {
                      setSelectedTask(task);
                      setShowTaskDetailPanel(true);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 border-b border-gray-200/50 dark:border-[#1f2229] truncate"
                  >
                    {task.name}
                  </button>
                ))}
                {unscheduledTasks.length > 5 && (
                  <div className="px-3 py-2 text-[10px] text-gray-400 dark:text-slate-500">
                    +{unscheduledTasks.length - 5} more
                  </div>
                )}
                {unscheduledTasks.length === 0 && (
                  <div className="px-3 py-4 text-[10px] text-gray-400 dark:text-slate-500 text-center">No unscheduled tasks</div>
                )}
              </div>
            </div>

            {/* Overdue */}
            <div>
              <div className="flex items-center justify-between px-3 py-2 bg-red-100 dark:bg-red-900/20">
                <span className="text-xs font-medium text-red-600 dark:text-red-400">Overdue</span>
                <span className="text-xs text-red-600 dark:text-red-400">{overdueTasks.length}</span>
              </div>
              <div className="max-h-40 overflow-y-auto">
                {overdueTasks.slice(0, 5).map(task => (
                  <button
                    key={task.id}
                    onClick={() => {
                      setSelectedTask(task);
                      setShowTaskDetailPanel(true);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-red-500 dark:text-red-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 border-b border-gray-200/50 dark:border-[#1f2229] truncate"
                  >
                    {task.name}
                  </button>
                ))}
                {overdueTasks.length > 5 && (
                  <div className="px-3 py-2 text-[10px] text-red-500 dark:text-red-400">
                    +{overdueTasks.length - 5} more
                  </div>
                )}
                {overdueTasks.length === 0 && (
                  <div className="px-3 py-4 text-[10px] text-gray-400 dark:text-slate-500 text-center">No overdue tasks</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team View */}
      {currentView === 'team' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Users className="w-16 h-16 text-gray-400 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Team View</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">Team workload view coming soon</p>
          </div>
        </div>
      )}

      {/* List View */}
      {currentView === 'list' && (
      <div className="flex-1 overflow-auto">
        {responses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-[#14151a] flex items-center justify-center mb-4">
              <ClipboardList className="w-8 h-8 text-gray-400 dark:text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No responses yet</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Create your first form response to track submissions</p>
            <button
              onClick={() => onAddResponse()}
              className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Response
            </button>
          </div>
        ) : (
          <div className="min-w-[900px]">
            {/* Dynamic Groups */}
            {computedGroups.map(group => {
              const groupResponses = group.responses;
              const isCollapsed = collapsedGroups.has(group.id);

              if (groupResponses.length === 0 && !showEmptyStatuses && groupBy === 'status') return null;
              if (groupResponses.length === 0 && groupBy !== 'status') return null;

              return (
                <div key={group.id} className="border-b border-gray-200 dark:border-[#1f2229]">
                  {/* Group Header */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-[#14151a] sticky top-0 z-10">
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className="p-0.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded"
                    >
                      <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-slate-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                    </button>
                    <div
                      className="flex items-center gap-2 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer hover:opacity-80"
                      style={{ backgroundColor: group.color, color: 'white' }}
                    >
                      <Check className="w-3 h-3" />
                      {group.name}
                    </div>
                    <span className="text-xs text-gray-400 dark:text-slate-500">{groupResponses.length}</span>

                    {/* Group Options Menu */}
                    <div className="relative">
                      <button
                        onClick={() => setActiveGroupMenu(activeGroupMenu === group.id ? null : group.id)}
                        className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {activeGroupMenu === group.id && (
                        <div className="absolute left-0 top-full mt-1 w-56 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 py-1">
                          {groupBy === 'status' && (
                            <>
                              <button
                                onClick={() => {
                                  toast.info('Status rename coming soon');
                                  setActiveGroupMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Edit3 className="w-4 h-4 text-gray-400 dark:text-slate-400" /> Rename
                              </button>
                              <button
                                onClick={() => {
                                  setEditingStatuses(statusOptions);
                                  setOriginalStatusNames(Object.fromEntries(statusOptions.map(s => [s.id, s.name])));
                                  setShowEditStatusesModal(true);
                                  setActiveGroupMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Settings className="w-4 h-4 text-gray-400 dark:text-slate-400" /> Edit statuses
                              </button>
                              <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                            </>
                          )}
                          <button
                            onClick={() => {
                              toggleGroup(group.id);
                              setActiveGroupMenu(null);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                          >
                            <ChevronRight className="w-4 h-4 text-gray-400 dark:text-slate-400" />
                            {isCollapsed ? 'Expand group' : 'Collapse group'}
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => onAddResponse(groupBy === 'status' ? group.id : undefined)}
                      className="ml-2 text-xs text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Task
                    </button>
                  </div>

                  {/* Column Headers - Drag & Drop Reorderable */}
                  {!isCollapsed && groupResponses.length > 0 && (
                    <DndContext
                      sensors={columnDragSensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleColumnDragEnd}
                    >
                      <div className="flex items-center px-2 py-1.5 text-[11px] text-gray-400 dark:text-slate-500 uppercase tracking-wider bg-gray-50 dark:bg-[#0f1012] border-b border-gray-200 dark:border-[#1f2229]">
                        <div className="w-8 flex-shrink-0" /> {/* Checkbox space to match row alignment */}
                        <SortableContext items={allColumnIds} strategy={horizontalListSortingStrategy}>
                          {allColumnIds.map((colId, colIdx) => {
                            const commonProps = {
                              index: colIdx,
                              total: allColumnIds.length,
                              openColumnMenuId,
                              setOpenColumnMenuId,
                              onMoveToStart: handleColumnMoveToStart,
                              onMoveToEnd: handleColumnMoveToEnd,
                              onHideColumn: handleColumnHide,
                              onDeleteField: handleColumnDelete,
                            };
                            // Base field columns
                            const config = columnConfig[colId];
                            if (config) {
                              return (
                                <SortableResponseColumnHeader
                                  key={colId}
                                  id={colId}
                                  label={config.label}
                                  widthClass={config.widthClass}
                                  isFixed={config.isFixed}
                                  {...commonProps}
                                />
                              );
                            }
                            // Custom field columns
                            const customField = customFields.find(f => f.id === colId);
                            if (customField) {
                              return (
                                <SortableResponseColumnHeader
                                  key={colId}
                                  id={colId}
                                  label={customField.name}
                                  widthClass="w-28 text-center"
                                  isCustomField
                                  {...commonProps}
                                />
                              );
                            }
                            // Response data columns
                            if (colId.startsWith('data:')) {
                              const colName = colId.replace('data:', '');
                              if (visibleColumns.includes(colName)) {
                                return (
                                  <SortableResponseColumnHeader
                                    key={colId}
                                    id={colId}
                                    label={colName}
                                    widthClass="w-32 text-center"
                                    {...commonProps}
                                  />
                                );
                              }
                            }
                            return null;
                          })}
                        </SortableContext>
                        {/* Add Column Button */}
                        <button
                          onClick={() => {
                            setShowFieldsPanel(true);
                            setFieldsPanelStep('fields');
                            setFieldsPanelSearch('');
                          }}
                          className="w-10 flex items-center justify-center text-gray-400 dark:text-slate-500 hover:text-violet-400"
                          title="Add a column"
                        >
                          <div className="w-5 h-5 rounded-full border border-dashed border-gray-300 dark:border-slate-600 flex items-center justify-center hover:border-violet-400 hover:text-violet-400 transition-colors">
                            <Plus className="w-3 h-3" />
                          </div>
                        </button>
                        <div className="w-10 flex items-center justify-center text-gray-400 dark:text-slate-500">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </DndContext>
                  )}

                  {/* Responses with Drag & Drop */}
                  {!isCollapsed && (
                  <DndContext
                    sensors={taskDragSensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleResponseDragStart}
                    onDragEnd={(event) => handleResponseDragEnd(event, groupResponses)}
                  >
                    <SortableContext
                      items={groupResponses.map(r => r.id)}
                      strategy={verticalListSortingStrategy}
                    >
                  {groupResponses.map(response => {
                    const priority = priorityOptions.find(p => p.id === response.priority);
                    const responseStatus = response.status
                      ? (statusOptions.find(s => s.id === response.status || s.name.toLowerCase() === response.status?.toLowerCase())
                        || { id: 'default', name: response.status?.toUpperCase(), color: '#6b7280', status_group: 'active' as const })
                      : { id: null, name: 'NO STATUS', color: '#9ca3af', status_group: 'active' as const };

                    return (
                      <SortableResponseRow key={response.id} id={response.id}>
                      <div
                        className="flex items-center px-2 py-2 hover:bg-gray-100/50 dark:hover:bg-slate-800/40 border-b border-gray-200/50 dark:border-[#1f2229]/50"
                      >
                        {/* Checkbox with Status Color - always first */}
                        <div className="w-8 flex items-center">
                          <div
                            className="w-4 h-4 rounded-full border-2 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                            style={{ borderColor: responseStatus?.color || group.color }}
                            onClick={() => {
                              // Mark as complete
                              const nextStatus = response.status === 'completed' ? 'approved' : 'completed';
                              onUpdateResponse(response.id, { status: nextStatus });
                            }}
                          >
                            {response.status === 'completed' && (
                              <Check className="w-2.5 h-2.5" style={{ color: responseStatus?.color || group.color }} />
                            )}
                          </div>
                        </div>

                        {/* Render cells in allColumnIds order */}
                        {allColumnIds.map(colId => {
                        if (colId === 'name') return (
                        <div key="name" className="flex-1 min-w-[200px] flex items-center gap-2">
                          <span
                            onClick={() => {
                              setSelectedTask(response);
                              setShowTaskDetailPanel(true);
                            }}
                            className="text-sm text-gray-900 dark:text-white hover:text-violet-600 dark:hover:text-violet-400 cursor-pointer"
                          >
                            {response.name}
                          </span>
                          {response.response_data && Object.keys(response.response_data).length > 0 && (
                            <span className="text-gray-400 dark:text-slate-500">
                              <AlignLeft className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                        );
                        if (colId === 'status') return (
                        <div key="status" className="w-32 flex justify-center relative" data-dropdown="status">
                          {activeStatusCell === response.id ? (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-52 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 py-1 max-h-64 overflow-y-auto">
                              {statusOptions.map((s) => (
                                <button
                                  key={s.id}
                                  onClick={() => {
                                    onUpdateResponse(response.id, { status: s.id });
                                    setActiveStatusCell(null);
                                  }}
                                  className={cn(
                                    "w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-700",
                                    response.status === s.id && "bg-violet-50 dark:bg-violet-500/10"
                                  )}
                                >
                                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                                  <span className="flex-1 text-gray-700 dark:text-slate-300">{s.name}</span>
                                  {response.status === s.id && <Check className="w-3.5 h-3.5 text-violet-500" />}
                                </button>
                              ))}
                              <div className="border-t border-gray-200 dark:border-[#1f2229] mt-1 pt-1">
                                <button
                                  onClick={() => {
                                    onUpdateResponse(response.id, { status: null });
                                    setActiveStatusCell(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-sm text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                >
                                  <X className="w-3 h-3" /> Clear status
                                </button>
                              </div>
                            </div>
                          ) : null}
                          <button
                            onClick={() => setActiveStatusCell(activeStatusCell === response.id ? null : response.id)}
                            className="w-full flex justify-center"
                          >
                            {responseStatus ? (
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                                style={{ backgroundColor: responseStatus.color }}
                              >
                                {responseStatus.name}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">
                                —
                              </span>
                            )}
                          </button>
                        </div>
                        );
                        if (colId === 'assignee') return (
                        <div key="assignee" className="w-32 flex justify-center relative" data-dropdown="assignee">
                          {activeAssigneeCell === response.id ? (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-64 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50">
                              <div className="p-2 border-b border-gray-200 dark:border-[#1f2229]">
                                <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-100 dark:bg-[#14151a] rounded">
                                  <Search className="w-3.5 h-3.5 text-gray-400 dark:text-slate-400" />
                                  <input
                                    type="text"
                                    placeholder="Search members..."
                                    value={assigneeSearch}
                                    onChange={(e) => setAssigneeSearch(e.target.value)}
                                    className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none"
                                    autoFocus
                                  />
                                </div>
                              </div>
                              <div className="py-1 max-h-64 overflow-y-auto">
                                <button
                                  onClick={() => {
                                    onUpdateResponse(response.id, { assignee_ids: [], assignee_id: null });
                                    setActiveAssigneeCell(null);
                                    setAssigneeSearch('');
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                >
                                  <User className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                                  Clear all assignees
                                </button>
                                {filteredMembers.map((m: any) => {
                                  const currentAssignees = response.assignee_ids || (response.assignee_id ? [response.assignee_id] : []);
                                  const isSelected = currentAssignees.includes(m.id);
                                  return (
                                    <button
                                      key={m.id}
                                      onClick={() => {
                                        const newAssignees = isSelected
                                          ? currentAssignees.filter((id: string) => id !== m.id)
                                          : [...currentAssignees, m.id];
                                        onUpdateResponse(response.id, {
                                          assignee_ids: newAssignees,
                                          assignee_id: newAssignees[0] || null // Keep first as primary for backward compat
                                        });
                                      }}
                                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2 ${isSelected ? 'text-violet-500 dark:text-violet-400 bg-violet-100 dark:bg-violet-500/10' : 'text-gray-600 dark:text-slate-300'}`}
                                    >
                                      <div
                                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-medium"
                                        style={{ backgroundColor: getAvatarColor(m.name || '') }}
                                      >
                                        {m.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                                      </div>
                                      <span className="flex-1">{m.name}</span>
                                      {isSelected && <Check className="w-4 h-4" />}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="p-2 border-t border-gray-200 dark:border-[#1f2229]">
                                <button
                                  onClick={() => {
                                    setActiveAssigneeCell(null);
                                    setAssigneeSearch('');
                                  }}
                                  className="w-full px-3 py-1.5 text-sm text-white bg-violet-600 hover:bg-violet-700 rounded"
                                >
                                  Done
                                </button>
                              </div>
                            </div>
                          ) : null}
                          <button
                            onClick={() => setActiveAssigneeCell(activeAssigneeCell === response.id ? null : response.id)}
                            className="w-full flex justify-center"
                          >
                            {(() => {
                              const assigneeIds = response.assignee_ids || (response.assignee_id ? [response.assignee_id] : []);
                              const assignees = assigneeIds.map((id: string) => members.find((m: any) => m.id === id)).filter(Boolean);

                              if (assignees.length === 0) {
                                return (
                                  <div className="w-7 h-7 rounded-full border border-dashed border-gray-300 dark:border-[#1f2229] flex items-center justify-center text-gray-400 dark:text-slate-500 hover:border-gray-400 dark:hover:border-slate-400 cursor-pointer">
                                    <User className="w-3.5 h-3.5" />
                                  </div>
                                );
                              }

                              if (assignees.length === 1) {
                                const a = assignees[0] as any;
                                return (
                                  <div
                                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] text-white font-medium cursor-pointer hover:ring-2 hover:ring-violet-500"
                                    style={{ backgroundColor: getAvatarColor(a.name || '') }}
                                    title={a.name}
                                  >
                                    {a.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                                  </div>
                                );
                              }

                              // Multiple assignees - show stacked avatars
                              return (
                                <div className="flex -space-x-2">
                                  {assignees.slice(0, 3).map((a: any, i: number) => (
                                    <div
                                      key={a.id}
                                      className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] text-white font-medium border-2 border-gray-50 dark:border-[#0f1012] cursor-pointer hover:ring-2 hover:ring-violet-500"
                                      style={{ backgroundColor: getAvatarColor(a.name || ''), zIndex: 10 - i }}
                                      title={a.name}
                                    >
                                      {a.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                                    </div>
                                  ))}
                                  {assignees.length > 3 && (
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] text-white font-medium bg-gray-400 dark:bg-slate-600 border-2 border-gray-50 dark:border-[#0f1012]">
                                      +{assignees.length - 3}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </button>
                        </div>

                        );
                        if (colId === 'due_date') return (
                        <div key="due_date" className="w-28 flex justify-center relative" data-dropdown="date">
                          {activeDateCell === response.id ? (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 p-2">
                              <input
                                type="date"
                                value={response.due_date?.split('T')[0] || ''}
                                onChange={(e) => {
                                  onUpdateResponse(response.id, { due_date: e.target.value || null });
                                  setActiveDateCell(null);
                                }}
                                className="px-3 py-2 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded text-sm text-gray-900 dark:text-white outline-none"
                                autoFocus
                              />
                              {response.due_date && (
                                <button
                                  onClick={() => {
                                    onUpdateResponse(response.id, { due_date: null });
                                    setActiveDateCell(null);
                                  }}
                                  className="w-full mt-2 px-3 py-1.5 text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded"
                                >
                                  Clear date
                                </button>
                              )}
                            </div>
                          ) : null}
                          <button
                            onClick={() => setActiveDateCell(activeDateCell === response.id ? null : response.id)}
                            className={`text-sm ${response.due_date ? 'text-cyan-500 dark:text-cyan-400' : 'text-gray-400 dark:text-slate-500'} hover:text-cyan-400 dark:hover:text-cyan-300`}
                          >
                            {response.due_date ? (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {formatDueDate(response.due_date)}
                              </span>
                            ) : (
                              <Calendar className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        );
                        if (colId === 'priority') return (
                        <div key="priority" className="w-24 flex justify-center">
                          <span className="flex items-center gap-1 text-xs" style={{ color: priority?.color }}>
                            <Flag className="w-3.5 h-3.5" />
                            {priority?.name || '—'}
                          </span>
                        </div>
                        );
                        if (colId.startsWith('data:')) {
                          const col = colId.replace('data:', '');
                          if (visibleColumns.includes(col)) {
                            let value = response.response_data?.[col];
                            // Resolve member IDs to names (for assignee fields stored as IDs)
                            if (typeof value === 'string' && value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/i)) {
                              const member = members.find((m: any) => m.id === value);
                              if (member) value = (member as any).name || value;
                            }
                            const displayValue = Array.isArray(value)
                              ? value.join(', ')
                              : typeof value === 'object'
                                ? JSON.stringify(value)
                                : String(value || '—');
                            return (
                              <div key={colId} className="w-32 flex justify-center">
                                <span className="text-xs text-gray-600 dark:text-slate-300 truncate max-w-[120px]" title={displayValue}>
                                  {displayValue}
                                </span>
                              </div>
                            );
                          }
                        }

                        // Custom Field Value Cells
                        {
                          const field = customFields.find(f => f.id === colId);
                          if (field) {
                          const fieldValue = fieldValueMap[response.id]?.[field.id];
                          const isEditing = editingFieldCell?.responseId === response.id && editingFieldCell?.fieldId === field.id;

                          // Get current value for editing
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
                              case 'money':
                              case 'rating':
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

                          // Generate display value
                          let displayValue: React.ReactNode = '—';

                          if (fieldValue) {
                            if (field.type === 'checkbox') {
                              displayValue = fieldValue.value_boolean ? '✓' : '✗';
                            } else if (field.type === 'dropdown') {
                              const val = fieldValue.value_json || fieldValue.value_text;
                              if (val && field.type_config?.options) {
                                const option = field.type_config.options.find((o: any) => o.id === val || o.name === val);
                                if (option) {
                                  displayValue = (
                                    <span
                                      className="px-2 py-0.5 rounded text-xs font-medium"
                                      style={{ backgroundColor: option.color + '20', color: option.color }}
                                    >
                                      {option.name}
                                    </span>
                                  );
                                } else {
                                  displayValue = String(val);
                                }
                              }
                            } else if (field.type === 'labels') {
                              const val = fieldValue.value_json || fieldValue.value_text;
                              const labelOptions = field.type_config?.options;
                              if (Array.isArray(val) && val.length > 0 && labelOptions) {
                                const labelNames = val.map((v: string) => {
                                  const opt = labelOptions.find((o: any) => o.id === v || o.name === v);
                                  return opt ? opt.name : v;
                                });
                                displayValue = labelNames.join(', ');
                              } else if (Array.isArray(val)) {
                                displayValue = val.join(', ');
                              } else if (val) {
                                displayValue = String(val);
                              }
                            } else if (field.type === 'people') {
                              const val = fieldValue.value_json;
                              if (Array.isArray(val) && val.length > 0) {
                                displayValue = (
                                  <div className="flex -space-x-1">
                                    {val.slice(0, 2).map((name: string, idx: number) => (
                                      <div
                                        key={idx}
                                        className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] text-white border border-gray-50 dark:border-[#0f1012]"
                                        style={{ backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899'][idx % 3] }}
                                        title={name}
                                      >
                                        {name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                      </div>
                                    ))}
                                    {val.length > 2 && (
                                      <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-slate-600 border border-gray-50 dark:border-[#0f1012] flex items-center justify-center text-[9px] text-gray-900 dark:text-white">
                                        +{val.length - 2}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                            } else if (field.type === 'date') {
                              displayValue = fieldValue.value_date ? new Date(fieldValue.value_date).toLocaleDateString() : '—';
                            } else if (field.type === 'rating') {
                              displayValue = '⭐'.repeat(Number(fieldValue.value_number) || 0);
                            } else if (field.type === 'number' || field.type === 'currency' || field.type === 'money') {
                              displayValue = fieldValue.value_number !== undefined ? String(fieldValue.value_number) : '—';
                            } else if (fieldValue.value_text) {
                              displayValue = fieldValue.value_text;
                            } else if (fieldValue.value_json) {
                              displayValue = typeof fieldValue.value_json === 'object'
                                ? JSON.stringify(fieldValue.value_json)
                                : String(fieldValue.value_json);
                            }
                          }

                          return (
                            <div
                              key={field.id}
                              data-field-editor
                              className="w-28 flex items-center justify-center text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-[#3a3b46]/50 rounded cursor-pointer relative"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (field.type === 'checkbox') {
                                  // Toggle checkbox immediately
                                  const newValue = !fieldValue?.value_boolean;
                                  setFieldValueMutation.mutate({ responseId: response.id, fieldId: field.id, value: newValue });
                                } else {
                                  setEditingFieldCell({ responseId: response.id, fieldId: field.id, field });
                                  setEditingFieldValue(getCurrentValue());
                                }
                              }}
                            >
                              <span className="text-xs text-gray-600 dark:text-slate-300 truncate max-w-[100px]">
                                {displayValue}
                              </span>

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
                                            setFieldValueMutation.mutate({ responseId: response.id, fieldId: field.id, value: editingFieldValue });
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
                                            setFieldValueMutation.mutate({ responseId: response.id, fieldId: field.id, value: editingFieldValue });
                                            setEditingFieldCell(null);
                                          }}
                                          className="px-2 py-1 text-xs bg-violet-600 text-white rounded hover:bg-violet-700"
                                        >
                                          Save
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Number/Currency/Money Editor */}
                                  {['number', 'currency', 'money'].includes(field.type) && (
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
                                            setFieldValueMutation.mutate({ responseId: response.id, fieldId: field.id, value: editingFieldValue });
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
                                            setFieldValueMutation.mutate({ responseId: response.id, fieldId: field.id, value: editingFieldValue });
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
                                            setFieldValueMutation.mutate({ responseId: response.id, fieldId: field.id, value: editingFieldValue });
                                            setEditingFieldCell(null);
                                          }}
                                          className="px-2 py-1 text-xs bg-violet-600 text-white rounded hover:bg-violet-700"
                                        >
                                          Save
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Rating Editor */}
                                  {field.type === 'rating' && (
                                    <div className="p-2">
                                      <div className="flex gap-1 justify-center mb-2">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                          <button
                                            key={star}
                                            onClick={() => {
                                              setFieldValueMutation.mutate({ responseId: response.id, fieldId: field.id, value: star });
                                              setEditingFieldCell(null);
                                            }}
                                            className={`text-xl ${(editingFieldValue || 0) >= star ? 'text-yellow-400' : 'text-gray-400'} hover:text-yellow-400`}
                                          >
                                            ⭐
                                          </button>
                                        ))}
                                      </div>
                                      <button
                                        onClick={() => setEditingFieldCell(null)}
                                        className="w-full px-2 py-1 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  )}

                                  {/* Dropdown Editor */}
                                  {field.type === 'dropdown' && field.type_config?.options && (
                                    <div className="py-1 max-h-48 overflow-y-auto">
                                      {field.type_config.options.map((option: any) => (
                                        <button
                                          key={option.id}
                                          onClick={() => {
                                            setFieldValueMutation.mutate({ responseId: response.id, fieldId: field.id, value: option.id });
                                            setEditingFieldCell(null);
                                          }}
                                          className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-[#2e2f3a] transition-colors ${
                                            editingFieldValue === option.id ? 'bg-gray-100 dark:bg-[#2e2f3a]' : ''
                                          }`}
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
                                          setFieldValueMutation.mutate({ responseId: response.id, fieldId: field.id, value: null });
                                          setEditingFieldCell(null);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-[#2e2f3a] transition-colors border-t border-gray-200 dark:border-[#1f2229]"
                                      >
                                        <X className="w-3 h-3" />
                                        <span>Clear</span>
                                      </button>
                                    </div>
                                  )}

                                  {/* Labels Editor (multi-select) */}
                                  {field.type === 'labels' && field.type_config?.options && (
                                    <div className="py-1 max-h-48 overflow-y-auto">
                                      {field.type_config.options.map((option: any) => {
                                        const currentLabels = Array.isArray(editingFieldValue) ? editingFieldValue : [];
                                        const isSelected = currentLabels.includes(option.id);

                                        return (
                                          <button
                                            key={option.id}
                                            onClick={() => {
                                              const newValue = isSelected
                                                ? currentLabels.filter((id: string) => id !== option.id)
                                                : [...currentLabels, option.id];
                                              setEditingFieldValue(newValue);
                                              setFieldValueMutation.mutate({ responseId: response.id, fieldId: field.id, value: newValue });
                                            }}
                                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-[#2e2f3a] transition-colors ${
                                              isSelected ? 'bg-violet-500/20' : ''
                                            }`}
                                          >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                              isSelected ? 'bg-violet-500 border-violet-500' : 'border-slate-500'
                                            }`}>
                                              {isSelected && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <span
                                              className="w-3 h-3 rounded-full"
                                              style={{ backgroundColor: option.color }}
                                            />
                                            <span className={isSelected ? 'text-violet-300' : 'text-gray-900 dark:text-white'}>{option.name}</span>
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

                                  {/* People Editor */}
                                  {field.type === 'people' && (
                                    <div className="py-1 max-h-48 overflow-y-auto">
                                      {members.map((member: any) => {
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
                                              setFieldValueMutation.mutate({ responseId: response.id, fieldId: field.id, value: newValue });
                                            }}
                                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-[#2e2f3a] transition-colors ${
                                              isSelected ? 'bg-violet-500/20' : ''
                                            }`}
                                          >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                              isSelected ? 'bg-violet-500 border-violet-500' : 'border-slate-500'
                                            }`}>
                                              {isSelected && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <div
                                              className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] text-white"
                                              style={{ backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899'][member.name.charCodeAt(0) % 3] }}
                                            >
                                              {member.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                                            </div>
                                            <span className={isSelected ? 'text-violet-300' : 'text-gray-900 dark:text-white'}>{member.name}</span>
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
                          }
                        }
                        return null;
                        })}

                        {/* Spacer for Add Column header button */}
                        <div className="w-10 flex-shrink-0" />

                        {/* Row Actions Menu - always last */}
                        <div className="w-10 flex justify-center relative">
                          <button
                            onClick={() => setActiveRowMenu(activeRowMenu === response.id ? null : response.id)}
                            className="p-1 text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded opacity-0 group-hover:opacity-100"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {activeRowMenu === response.id && (
                            <div ref={rowMenuRef} className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 py-1">
                              <button
                                onClick={() => {
                                  copyTaskLink(response.id);
                                  setActiveRowMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Link2 className="w-4 h-4 text-gray-400 dark:text-slate-400" /> Copy link
                              </button>
                              <button
                                onClick={() => {
                                  onEditResponse(response);
                                  setActiveRowMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Edit3 className="w-4 h-4 text-gray-400 dark:text-slate-400" /> Rename
                              </button>
                              <button
                                onClick={() => {
                                  duplicateTask(response);
                                  setActiveRowMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Copy className="w-4 h-4 text-gray-400 dark:text-slate-400" /> Duplicate
                              </button>
                              <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(response.id);
                                  toast.success('Response ID copied');
                                  setActiveRowMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Copy className="w-4 h-4 text-gray-400 dark:text-slate-400" /> Copy ID
                              </button>
                              <button
                                onClick={() => {
                                  window.open(`${window.location.origin}/form-response/${response.id}`, '_blank');
                                  setActiveRowMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <ExternalLink className="w-4 h-4 text-gray-400 dark:text-slate-400" /> New tab
                              </button>
                              <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                              <button
                                onClick={(e) => {
                                  openAddColumnMenu(e);
                                  setActiveRowMenu(null);
                                }}
                                data-add-column-trigger
                                className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Columns className="w-4 h-4 text-gray-400 dark:text-slate-400" /> Add a column
                              </button>
                              <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                              <button
                                onClick={() => {
                                  toast.info('Move to coming soon');
                                  setActiveRowMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Folder className="w-4 h-4 text-gray-400 dark:text-slate-400" /> Move to
                              </button>
                              <button
                                onClick={() => {
                                  toast.info('Convert to coming soon');
                                  setActiveRowMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2"
                              >
                                <FileText className="w-4 h-4 text-gray-400 dark:text-slate-400" /> Convert to
                              </button>
                              <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                              <button
                                onClick={() => {
                                  onDeleteResponse(response.id);
                                  setActiveRowMenu(null);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      </SortableResponseRow>
                    );
                  })}
                    </SortableContext>
                    {/* Drag overlay for response rows */}
                    <DragOverlay>
                      {activeDragResponse ? (
                        <div className="flex items-center px-4 py-2 bg-white dark:bg-[#1a1b23] border border-violet-500/50 rounded-lg shadow-xl opacity-90">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <GripVertical className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                            <span className="text-sm text-gray-900 dark:text-white truncate">{activeDragResponse.name}</span>
                          </div>
                        </div>
                      ) : null}
                    </DragOverlay>
                  </DndContext>
                  )}

                  {/* Add Task Row */}
                  {!isCollapsed && (
                    <button
                      onClick={() => onAddResponse(groupBy === 'status' ? group.id : undefined)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100/50 dark:hover:bg-slate-800/40 w-full"
                    >
                      <Plus className="w-4 h-4" /> Add Task
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Edit Statuses Modal */}
      {showEditStatusesModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setShowEditStatusesModal(false); setColorPickerStatusId(null); setStatusMenuOpenId(null); setRenamingStatusId(null); }} />
          <div className="relative bg-white dark:bg-[#232430] border border-gray-200 dark:border-[#2a2b36] rounded-xl shadow-2xl w-full max-w-[680px] z-10 max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#2a2b36]">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit {formName} statuses</h3>
              <button onClick={() => { setShowEditStatusesModal(false); setColorPickerStatusId(null); setStatusMenuOpenId(null); setRenamingStatusId(null); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded-lg text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1">
              <div className="flex">
                {/* Left Panel - Status Type & Template */}
                <div className="w-[220px] shrink-0 px-5 py-5 border-r border-gray-200 dark:border-[#2a2b36]">
                  <div className="mb-5">
                    <label className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-3 block">
                      Status type <span className="text-gray-400 dark:text-slate-500 cursor-help">ⓘ</span>
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                          !useCustomStatuses ? "border-violet-500" : "border-gray-300 dark:border-slate-500"
                        )}>
                          {!useCustomStatuses && <div className="w-2 h-2 rounded-full bg-violet-500" />}
                        </div>
                        <span
                          className="text-sm text-gray-700 dark:text-slate-300"
                          onClick={() => { setUseCustomStatuses(false); setEditingStatuses(statusOptions); }}
                        >Inherit from Space</span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                          useCustomStatuses ? "border-violet-500" : "border-gray-300 dark:border-slate-500"
                        )}>
                          {useCustomStatuses && <div className="w-2 h-2 rounded-full bg-violet-500" />}
                        </div>
                        <span
                          className="text-sm text-gray-700 dark:text-slate-300"
                          onClick={() => setUseCustomStatuses(true)}
                        >Use custom statuses</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-2 block">Status template</label>
                    <select
                      value={statusTemplate}
                      onChange={(e) => {
                        setStatusTemplate(e.target.value);
                        setUseCustomStatuses(true);
                        if (e.target.value === 'simple') {
                          setEditingStatuses([
                            { id: 'todo', name: 'TO DO', color: '#3b82f6', status_group: 'active' },
                            { id: 'in_progress', name: 'IN PROGRESS', color: '#f59e0b', status_group: 'active' },
                            { id: 'complete', name: 'COMPLETE', color: '#22c55e', status_group: 'done' }
                          ]);
                        } else if (e.target.value === 'scrum') {
                          setEditingStatuses([
                            { id: 'backlog', name: 'BACKLOG', color: '#6b7280', status_group: 'active' },
                            { id: 'todo', name: 'TO DO', color: '#3b82f6', status_group: 'active' },
                            { id: 'in_progress', name: 'IN PROGRESS', color: '#f59e0b', status_group: 'active' },
                            { id: 'review', name: 'REVIEW', color: '#8b5cf6', status_group: 'active' },
                            { id: 'done', name: 'DONE', color: '#22c55e', status_group: 'done' }
                          ]);
                        } else if (e.target.value === 'kanban') {
                          setEditingStatuses([
                            { id: 'todo', name: 'TO DO', color: '#3b82f6', status_group: 'active' },
                            { id: 'doing', name: 'DOING', color: '#f59e0b', status_group: 'active' },
                            { id: 'done', name: 'DONE', color: '#22c55e', status_group: 'done' }
                          ]);
                        }
                      }}
                      className="w-full bg-white dark:bg-[#1a1b24] border border-gray-200 dark:border-[#2a2b36] rounded-lg px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                    >
                      <option value="custom">Custom</option>
                      <option value="simple">Simple</option>
                      <option value="scrum">Scrum</option>
                      <option value="kanban">Kanban</option>
                    </select>
                  </div>
                </div>

                {/* Right Panel - Status List with Active/Done/Closed */}
                <div className="flex-1 py-4 px-5">
                  {/* Render each section: active, done, closed */}
                  {(['active', 'done', 'closed'] as const).map(sectionKey => {
                    const sectionStatuses = editingStatuses.filter(s => (s.status_group || 'active') === sectionKey);
                    const sectionLabel = sectionKey === 'active' ? 'Active' : sectionKey === 'done' ? 'Done' : 'Closed';
                    const defaultColor = sectionKey === 'active' ? '#3b82f6' : sectionKey === 'done' ? '#22c55e' : '#6b7280';

                    return (
                      <div key={sectionKey} className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
                            {sectionLabel} <span className="text-gray-400 dark:text-slate-500 cursor-help">ⓘ</span>
                          </span>
                          {useCustomStatuses && (
                            <button
                              onClick={() => {
                                const newStatus: StatusOption = {
                                  id: `status-${sectionKey}-${Date.now()}`,
                                  name: 'NEW STATUS',
                                  color: defaultColor,
                                  status_group: sectionKey
                                };
                                setEditingStatuses([...editingStatuses, newStatus]);
                              }}
                              className="w-5 h-5 rounded-full border border-gray-300 dark:border-slate-500 flex items-center justify-center text-gray-400 dark:text-slate-500 hover:border-violet-400 hover:text-violet-400 transition-colors"
                              title="Add status"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="space-y-1">
                          {sectionStatuses.map((status) => (
                            <div key={status.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md group hover:bg-gray-50 dark:hover:bg-[#2a2b36] transition-colors">
                              {useCustomStatuses && (
                                <GripVertical className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 cursor-grab flex-shrink-0" />
                              )}
                              <div className="relative flex-shrink-0">
                                <button
                                  onClick={() => useCustomStatuses && setColorPickerStatusId(colorPickerStatusId === status.id ? null : status.id)}
                                  className="w-4 h-4 rounded-full flex-shrink-0 cursor-pointer hover:scale-110 transition-transform"
                                  style={{ backgroundColor: status.color }}
                                />
                                {colorPickerStatusId === status.id && useCustomStatuses && (
                                  <div className="absolute left-0 top-full mt-2 bg-white dark:bg-[#1e1f29] border border-gray-200 dark:border-[#2a2b36] rounded-lg shadow-xl p-3 z-50" onClick={(e) => e.stopPropagation()}>
                                    <div className="text-[10px] text-gray-500 dark:text-slate-400 mb-2">Color</div>
                                    <div className="grid grid-cols-5 gap-2">
                                      {colorPalette.map((color) => (
                                        <button
                                          key={color}
                                          onClick={() => {
                                            const updated = [...editingStatuses];
                                            const idx = updated.findIndex(s => s.id === status.id);
                                            if (idx !== -1) {
                                              updated[idx] = { ...updated[idx], color };
                                              setEditingStatuses(updated);
                                            }
                                            setColorPickerStatusId(null);
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
                              {useCustomStatuses && renamingStatusId === status.id ? (
                                <input
                                  ref={(el) => { statusInputRefs.current[status.id] = el; }}
                                  type="text"
                                  value={status.name}
                                  onChange={(e) => {
                                    const updated = [...editingStatuses];
                                    const idx = updated.findIndex(s => s.id === status.id);
                                    if (idx !== -1) {
                                      updated[idx] = { ...updated[idx], name: e.target.value.toUpperCase() };
                                      setEditingStatuses(updated);
                                    }
                                  }}
                                  onBlur={() => setRenamingStatusId(null)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') setRenamingStatusId(null); }}
                                  autoFocus
                                  className="flex-1 bg-transparent text-gray-900 dark:text-white text-sm font-medium border border-gray-200 dark:border-[#2a2b36] rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
                                />
                              ) : (
                                <span className="flex-1 text-sm text-gray-900 dark:text-slate-300 font-medium px-1">{status.name}</span>
                              )}
                              {useCustomStatuses && (
                                <div className="relative flex-shrink-0">
                                  <button
                                    onClick={() => setStatusMenuOpenId(statusMenuOpenId === status.id ? null : status.id)}
                                    className="p-1 text-gray-400 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-gray-100 dark:hover:bg-slate-700"
                                  >
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                  </button>
                                  {statusMenuOpenId === status.id && (
                                    <div className="absolute right-0 top-7 z-50 w-36 bg-white dark:bg-[#1e1f29] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl py-1">
                                      <button
                                        onClick={() => {
                                          setStatusMenuOpenId(null);
                                          setRenamingStatusId(status.id);
                                          setTimeout(() => { statusInputRefs.current[status.id]?.focus(); statusInputRefs.current[status.id]?.select(); }, 50);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 text-left"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" /> Rename
                                      </button>
                                      <button
                                        onClick={() => { setStatusMenuOpenId(null); setEditingStatuses(editingStatuses.filter(s => s.id !== status.id)); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700 text-left"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" /> Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                          {sectionStatuses.length === 0 && useCustomStatuses && (
                            <button
                              onClick={() => {
                                const newStatus: StatusOption = {
                                  id: `status-${sectionKey}-${Date.now()}`,
                                  name: sectionKey === 'done' ? 'DONE' : sectionKey === 'closed' ? 'CLOSED' : 'NEW STATUS',
                                  color: defaultColor,
                                  status_group: sectionKey
                                };
                                setEditingStatuses([...editingStatuses, newStatus]);
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-400 dark:text-slate-500 hover:text-violet-400 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3 h-3" /> Add status
                            </button>
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
                  onClick={() => {
                    onUpdateStatuses(editingStatuses);
                    onToggleInheritance(!useCustomStatuses);
                    toast.success('Status changes saved');
                    setShowEditStatusesModal(false);
                    setColorPickerStatusId(null);
                  }}
                  className="px-5 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium transition-colors"
                >
                  Apply changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Panel */}
      {showTaskDetailPanel && selectedTask && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-[200]"
            onClick={() => {
              setShowTaskDetailPanel(false);
              setSelectedTask(null);
              setDetailMenuOpen(false);
            }}
          />

          {/* Full Page Modal Panel */}
          <div className="fixed top-0 right-0 h-full bg-gray-50 dark:bg-[#0f1012] z-[201] flex w-full max-w-[1100px] shadow-2xl animate-in slide-in-from-right duration-200">

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200 dark:border-[#1f2229]">

              {/* Top Header Bar */}
              <div className="flex items-center justify-between h-12 px-4 border-b border-gray-200 dark:border-[#1f2229] bg-gray-50 dark:bg-[#0f1012] flex-shrink-0">
                <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                  <span className="text-violet-500">■</span>
                  <span>{formName}</span>
                  <ChevronRight className="w-3 h-3 text-gray-600" />
                  <span>📋</span>
                  <span>Responses</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500 mr-2">
                    Submitted {selectedTask.created_at ? new Date(selectedTask.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/form/${formId}`);
                      toast.success('Link copied!');
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded"
                  >
                    <Link className="w-3 h-3" /> Share
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => setDetailMenuOpen(!detailMenuOpen)}
                      className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {detailMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setDetailMenuOpen(false)} />
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 py-1">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/form/${formId}`);
                              toast.success('Form link copied!');
                              setDetailMenuOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 flex items-center gap-2"
                          >
                            <Link className="w-4 h-4" /> Copy Link
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(selectedTask.id);
                              toast.success('Response ID copied!');
                              setDetailMenuOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 flex items-center gap-2"
                          >
                            <Copy className="w-4 h-4" /> Copy ID
                          </button>
                          <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                          <button
                            onClick={(e) => {
                              openAddColumnMenu(e);
                              setDetailMenuOpen(false);
                            }}
                            data-add-column-trigger
                            className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 flex items-center gap-2"
                          >
                            <Columns className="w-4 h-4" /> Add a Column
                          </button>
                          <div className="border-t border-gray-200 dark:border-[#1f2229] my-1" />
                          <button
                            onClick={() => {
                              onDeleteResponse(selectedTask.id);
                              setShowTaskDetailPanel(false);
                              setSelectedTask(null);
                              setDetailMenuOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-100 dark:hover:bg-slate-700/50 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" /> Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setShowTaskDetailPanel(false);
                      setSelectedTask(null);
                      setDetailMenuOpen(false);
                    }}
                    className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Task Name Section */}
              <div className="px-8 pt-6 pb-2">
                <div className="flex items-start gap-3">
                  <div
                    className="w-5 h-5 mt-1 rounded border-2 flex-shrink-0"
                    style={{ borderColor: statusOptions.find(s => s.id === selectedTask.status)?.color || '#6b7280' }}
                  />
                  <h1 className="text-2xl font-semibold text-gray-900 dark:text-white flex-1">
                    {selectedTask.name}
                  </h1>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-8 pb-6">
                {/* Properties Grid */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 py-4 border-b border-gray-200 dark:border-[#1f2229]">
                  {/* Status */}
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-24">Status</span>
                    <div className="relative flex-1">
                      {(() => {
                        const currentStatus = statusOptions.find(s => s.id === selectedTask.status);
                        const statusColor = currentStatus?.color || '#6b7280';
                        const statusName = currentStatus?.name || 'Select status';
                        return (
                          <button
                            onClick={() => {
                              setDetailStatusOpen(!detailStatusOpen);
                              setDetailAssigneeOpen(false);
                              setDetailDueDateOpen(false);
                              setDetailPriorityOpen(false);
                            }}
                            className="px-3 py-1.5 rounded text-xs font-semibold cursor-pointer hover:opacity-80 flex items-center gap-2"
                            style={{
                              backgroundColor: `${statusColor}30`,
                              color: statusColor
                            }}
                          >
                            {statusName}
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        );
                      })()}
                      {detailStatusOpen && (
                        <div className="absolute top-full left-0 mt-1 w-52 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 py-1">
                          <div className="px-3 py-1.5 text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider border-b border-gray-200 dark:border-[#1f2229]">
                            Select status
                          </div>
                          {statusOptions.length > 0 ? (
                            statusOptions.map(status => (
                              <button
                                key={status.id}
                                onClick={() => {
                                  onUpdateResponse(selectedTask.id, { status: status.id });
                                  setSelectedTask({ ...selectedTask, status: status.id });
                                  setDetailStatusOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700/50 flex items-center gap-2 ${
                                  selectedTask.status === status.id ? 'bg-gray-100 dark:bg-[#15161a]/30' : ''
                                }`}
                              >
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                                <span className="text-gray-600 dark:text-slate-300">{status.name}</span>
                                {selectedTask.status === status.id && <Check className="w-3 h-3 ml-auto text-violet-400" />}
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-gray-400 dark:text-slate-500">No statuses available</div>
                          )}
                          <div className="border-t border-gray-200 dark:border-[#1f2229] mt-1 pt-1">
                            <button
                              onClick={() => {
                                setDetailStatusOpen(false);
                                setEditingStatuses(statusOptions);
                                setOriginalStatusNames(Object.fromEntries(statusOptions.map(s => [s.id, s.name])));
                                setShowEditStatusesModal(true);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-violet-500 dark:text-violet-400 hover:bg-gray-100 dark:hover:bg-slate-700/50 flex items-center gap-2"
                            >
                              <Plus className="w-3 h-3" />
                              Manage statuses
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-24">Priority</span>
                    <div className="relative flex-1">
                      <button
                        onClick={() => {
                          setDetailPriorityOpen(!detailPriorityOpen);
                          setDetailStatusOpen(false);
                          setDetailAssigneeOpen(false);
                          setDetailDueDateOpen(false);
                        }}
                        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700/50 text-sm"
                        style={{ color: priorityOptions.find(p => p.id === selectedTask.priority)?.color }}
                      >
                        <Flag className="w-3.5 h-3.5" />
                        {priorityOptions.find(p => p.id === selectedTask.priority)?.name || 'Normal'}
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {detailPriorityOpen && (
                        <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 py-1">
                          {priorityOptions.map(priority => (
                            <button
                              key={priority.id}
                              onClick={() => {
                                onUpdateResponse(selectedTask.id, { priority: priority.id });
                                setSelectedTask({ ...selectedTask, priority: priority.id });
                                setDetailPriorityOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700/50 flex items-center gap-2"
                              style={{ color: priority.color }}
                            >
                              <Flag className="w-3.5 h-3.5" />
                              {priority.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Assignees */}
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-24">Assignees</span>
                    <div className="relative flex-1">
                      <button
                        onClick={() => {
                          setDetailAssigneeOpen(!detailAssigneeOpen);
                          setDetailStatusOpen(false);
                          setDetailDueDateOpen(false);
                          setDetailPriorityOpen(false);
                          setDetailAssigneeSearch('');
                        }}
                        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700/50 text-sm"
                      >
                        {(() => {
                          const assigneeIds = selectedTask.assignee_ids || (selectedTask.assignee_id ? [selectedTask.assignee_id] : []);
                          const assignees = assigneeIds.map((id: string) => members.find((m: any) => m.id === id)).filter(Boolean);

                          if (assignees.length === 0) {
                            return (
                              <span className="text-gray-400 dark:text-slate-400 flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Add
                              </span>
                            );
                          }

                          if (assignees.length === 1) {
                            const a = assignees[0] as any;
                            return (
                              <>
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white"
                                  style={{ backgroundColor: getAvatarColor(a.name || '') }}
                                >
                                  {a.name?.charAt(0) || '?'}
                                </div>
                                <span className="text-gray-600 dark:text-slate-300">{a.name}</span>
                              </>
                            );
                          }

                          return (
                            <div className="flex items-center gap-1">
                              <div className="flex -space-x-1.5">
                                {assignees.slice(0, 3).map((a: any, i: number) => (
                                  <div
                                    key={a.id}
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white border border-white dark:border-[#0f1012]"
                                    style={{ backgroundColor: getAvatarColor(a.name || ''), zIndex: 10 - i }}
                                    title={a.name}
                                  >
                                    {a.name?.charAt(0) || '?'}
                                  </div>
                                ))}
                              </div>
                              <span className="text-gray-600 dark:text-slate-300 text-xs">
                                {assignees.length > 3 ? `+${assignees.length - 3}` : `${assignees.length} people`}
                              </span>
                            </div>
                          );
                        })()}
                        <ChevronDown className="w-3 h-3 text-gray-400 dark:text-slate-400" />
                      </button>
                      {detailAssigneeOpen && (
                        <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 py-1">
                          <div className="px-2 py-1.5 border-b border-gray-200 dark:border-[#1f2229]">
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                              <input
                                type="text"
                                placeholder="Search members..."
                                value={detailAssigneeSearch}
                                onChange={(e) => setDetailAssigneeSearch(e.target.value)}
                                className="w-full pl-7 pr-2 py-1.5 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded text-xs text-gray-900 dark:text-white outline-none"
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            <button
                              onClick={() => {
                                onUpdateResponse(selectedTask.id, { assignee_ids: [], assignee_id: null });
                                setSelectedTask({ ...selectedTask, assignee_ids: [], assignee_id: null });
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-400 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700/50 flex items-center gap-2"
                            >
                              <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-[#15161a] flex items-center justify-center">
                                <X className="w-3 h-3" />
                              </div>
                              Clear all
                            </button>
                            {members
                              .filter((m: any) => m.name?.toLowerCase().includes(detailAssigneeSearch.toLowerCase()))
                              .map((member: any) => {
                                const currentAssignees = selectedTask.assignee_ids || (selectedTask.assignee_id ? [selectedTask.assignee_id] : []);
                                const isSelected = currentAssignees.includes(member.id);
                                return (
                                  <button
                                    key={member.id}
                                    onClick={() => {
                                      const newAssignees = isSelected
                                        ? currentAssignees.filter((id: string) => id !== member.id)
                                        : [...currentAssignees, member.id];
                                      onUpdateResponse(selectedTask.id, {
                                        assignee_ids: newAssignees,
                                        assignee_id: newAssignees[0] || null
                                      });
                                      setSelectedTask({
                                        ...selectedTask,
                                        assignee_ids: newAssignees,
                                        assignee_id: newAssignees[0] || null
                                      });
                                    }}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700/50 flex items-center gap-2 ${isSelected ? 'bg-violet-100 dark:bg-violet-500/10' : ''}`}
                                  >
                                    <div
                                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white"
                                      style={{ backgroundColor: getAvatarColor(member.name || '') }}
                                    >
                                      {member.name?.charAt(0) || '?'}
                                    </div>
                                    <span className={`flex-1 ${isSelected ? 'text-violet-500 dark:text-violet-400' : 'text-gray-600 dark:text-slate-300'}`}>{member.name}</span>
                                    {isSelected && <Check className="w-4 h-4 text-violet-500 dark:text-violet-400" />}
                                  </button>
                                );
                              })}
                          </div>
                          <div className="px-2 py-1.5 border-t border-gray-200 dark:border-[#1f2229]">
                            <button
                              onClick={() => setDetailAssigneeOpen(false)}
                              className="w-full px-3 py-1.5 text-xs text-white bg-violet-600 hover:bg-violet-700 rounded"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Due Date */}
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-24">Due date</span>
                    <div className="relative flex-1">
                      <button
                        onClick={() => {
                          setDetailDueDateOpen(!detailDueDateOpen);
                          setDetailStatusOpen(false);
                          setDetailAssigneeOpen(false);
                          setDetailPriorityOpen(false);
                        }}
                        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700/50 text-sm"
                      >
                        {selectedTask.due_date ? (
                          <span className="text-cyan-500 dark:text-cyan-400 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(selectedTask.due_date).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-slate-400 flex items-center gap-1">
                            <Plus className="w-3 h-3" /> Add
                          </span>
                        )}
                        <ChevronDown className="w-3 h-3 text-gray-400 dark:text-slate-400" />
                      </button>
                      {detailDueDateOpen && (
                        <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 p-3">
                          <input
                            type="date"
                            value={selectedTask.due_date ? new Date(selectedTask.due_date).toISOString().split('T')[0] : ''}
                            onChange={(e) => {
                              const newDate = e.target.value ? new Date(e.target.value).toISOString() : null;
                              onUpdateResponse(selectedTask.id, { due_date: newDate });
                              setSelectedTask({ ...selectedTask, due_date: newDate });
                              setDetailDueDateOpen(false);
                            }}
                            className="w-full px-3 py-2 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-sm text-gray-900 dark:text-white outline-none"
                            autoFocus
                          />
                          {selectedTask.due_date && (
                            <button
                              onClick={() => {
                                onUpdateResponse(selectedTask.id, { due_date: null });
                                setSelectedTask({ ...selectedTask, due_date: null });
                                setDetailDueDateOpen(false);
                              }}
                              className="w-full mt-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded"
                            >
                              Remove due date
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description / Response Data Section */}
                <div className="py-6">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Response Details</span>
                  </div>

                  {/* Form Response Content */}
                  {selectedTask.response_data && Object.keys(selectedTask.response_data).length > 0 ? (
                    <div className="space-y-4">
                      {Object.entries(selectedTask.response_data).map(([key, value]) => {
                        // Check if value is an image URL or array of image URLs
                        const isImageUrl = (url: any): boolean => {
                          if (typeof url !== 'string') return false;
                          const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i;
                          const isStorageUrl = url.includes('supabase') && url.includes('storage');
                          return imageExtensions.test(url) || isStorageUrl;
                        };

                        const renderValue = (val: any) => {
                          if (Array.isArray(val)) {
                            const hasImages = val.some(isImageUrl);
                            if (hasImages) {
                              return (
                                <div className="flex flex-wrap gap-3 mt-2">
                                  {val.map((item, idx) => (
                                    isImageUrl(item) ? (
                                      <a
                                        key={idx}
                                        href={item}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block"
                                      >
                                        <img
                                          src={item}
                                          alt={`${key} ${idx + 1}`}
                                          className="w-40 h-40 object-cover rounded-lg border border-gray-200 dark:border-[#1f2229] hover:border-violet-500 dark:hover:border-violet-500 transition-colors shadow-sm"
                                        />
                                      </a>
                                    ) : (
                                      <span key={idx} className="text-gray-700 dark:text-slate-200">{String(item)}</span>
                                    )
                                  ))}
                                </div>
                              );
                            }
                            return val.join(', ');
                          }
                          if (isImageUrl(val)) {
                            return (
                              <a
                                href={val}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block mt-2"
                              >
                                <img
                                  src={val}
                                  alt={key}
                                  className="max-w-full max-h-72 object-contain rounded-lg border border-gray-200 dark:border-[#1f2229] hover:border-violet-500 dark:hover:border-violet-500 transition-colors shadow-sm"
                                />
                              </a>
                            );
                          }
                          if (typeof val === 'object') {
                            return JSON.stringify(val, null, 2);
                          }
                          // Resolve member IDs to names for backward compat
                          const strVal = String(val);
                          if (strVal.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/i)) {
                            const member = members.find((m: any) => m.id === strVal);
                            if (member) return (member as any).name || strVal;
                          }
                          return strVal;
                        };

                        return (
                          <div key={key} className="bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg p-4">
                            <div className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">{key}</div>
                            <div className="text-sm text-gray-800 dark:text-slate-200 whitespace-pre-wrap">
                              {renderValue(value)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg p-8 text-center">
                      <div className="text-gray-400 dark:text-slate-500">No response data available</div>
                    </div>
                  )}
                </div>

                {/* Add Custom Field Button */}
                <div className="py-4 border-t border-gray-200 dark:border-[#1f2229]">
                  <button
                    onClick={() => setShowCustomFieldPanel(true)}
                    className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-violet-500 dark:hover:text-violet-400"
                  >
                    <Plus className="w-4 h-4" />
                    Add Custom Field
                  </button>
                </div>

                {/* Attachments Section */}
                <div className="py-4 border-t border-gray-200 dark:border-[#1f2229]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Attachments</span>
                    </div>
                  </div>
                  <div className="border-2 border-dashed border-gray-200 dark:border-[#1f2229] rounded-lg p-6 text-center">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-slate-600" />
                    <p className="text-sm text-gray-400 dark:text-slate-500">Drop files here or click to upload</p>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center gap-2 px-6 py-4 border-t border-gray-200 dark:border-[#1f2229] bg-gray-50 dark:bg-[#0f1012]">
                <button
                  onClick={() => onEditResponse(selectedTask)}
                  className="flex-1 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors"
                >
                  Edit Response
                </button>
                <button
                  onClick={() => {
                    onDeleteResponse(selectedTask.id);
                    setShowTaskDetailPanel(false);
                    setSelectedTask(null);
                  }}
                  className="px-4 py-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-sm font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Activity Panel (Right Side) */}
            <div className="w-[340px] flex flex-col bg-white dark:bg-[#14151a] flex-shrink-0">
              {/* Activity Header */}
              <div className="flex items-center justify-between h-12 px-4 border-b border-gray-200 dark:border-[#1f2229]">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Activity</span>
                </div>
                <button className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded">
                  <Search className="w-4 h-4" />
                </button>
              </div>

              {/* Activity Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Submission Activity */}
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Form submitted</span>
                    </div>
                    <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      {selectedTask.created_at ? new Date(selectedTask.created_at).toLocaleString() : 'Unknown'}
                    </div>
                  </div>
                </div>

                {/* Status Change Activity */}
                {selectedTask.status && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        Status set to{' '}
                        <span
                          className="font-medium"
                          style={{ color: statusOptions.find(s => s.id === selectedTask.status)?.color }}
                        >
                          {statusOptions.find(s => s.id === selectedTask.status)?.name || selectedTask.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                        {selectedTask.updated_at ? new Date(selectedTask.updated_at).toLocaleString() : 'Just now'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Assignee Activity */}
                {(selectedTask.assignee_ids?.length > 0 || selectedTask.assignee_id) && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        Assigned to{' '}
                        {(() => {
                          const assigneeIds = selectedTask.assignee_ids || (selectedTask.assignee_id ? [selectedTask.assignee_id] : []);
                          const assignees = assigneeIds.map((id: string) => members.find((m: any) => m.id === id)).filter(Boolean);
                          return assignees.map((a: any) => a.name).join(', ') || 'Unknown';
                        })()}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                        Recently
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Comment Input */}
              <div className="p-4 border-t border-gray-200 dark:border-[#1f2229]">
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                    U
                  </div>
                  <div className="flex-1">
                    <textarea
                      placeholder="Write a comment..."
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none resize-none"
                      rows={2}
                    />
                    <div className="flex items-center justify-end mt-2">
                      <button className="px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded hover:bg-violet-700">
                        Comment
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Customize / Fields Panel */}
      {showFieldsPanel && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setShowFieldsPanel(false)}
          />
          <div className="fixed top-0 right-0 h-full w-[320px] bg-white dark:bg-[#14151a] border-l border-gray-200 dark:border-[#1f2229] z-50 flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#1f2229]">
              <div className="flex items-center gap-2">
                {fieldsPanelStep === 'fields' && (
                  <button
                    onClick={() => { setFieldsPanelStep('customize'); setFieldsPanelSearch(''); }}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {fieldsPanelStep === 'fields' ? 'Fields' : 'Customize view'}
                </span>
              </div>
              <button
                onClick={() => setShowFieldsPanel(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {fieldsPanelStep === 'customize' ? (
                <div className="p-4 space-y-4">
                  <button
                    onClick={() => setFieldsPanelStep('fields')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1f2229] text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                  >
                    <span className="text-sm">Fields</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <div className="border-t border-gray-200 dark:border-[#1f2229] pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600 dark:text-slate-300">Show empty statuses</div>
                      <button
                        onClick={() => {
                          setShowEmptyStatuses(prev => {
                            const next = !prev;
                            localStorage.setItem(`form-response-show-empty-${formId}`, String(next));
                            return next;
                          });
                        }}
                        className={`w-9 h-5 rounded-full relative transition-colors ${showEmptyStatuses ? 'bg-violet-600' : 'bg-gray-300 dark:bg-slate-600'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${showEmptyStatuses ? 'right-0.5' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400" />
                    <input
                      type="text"
                      value={fieldsPanelSearch}
                      onChange={(e) => setFieldsPanelSearch(e.target.value)}
                      placeholder="Search for fields"
                      className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#15161a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>

                  {/* Base Fields */}
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500">Shown</div>
                    {[
                      { key: 'name', label: 'Name', locked: true },
                      { key: 'status', label: 'Status' },
                      { key: 'assignee', label: 'Assignee' },
                      { key: 'due_date', label: 'Due Date' },
                      { key: 'priority', label: 'Priority' },
                    ].filter(item => !fieldsPanelSearch || item.label.toLowerCase().includes(fieldsPanelSearch.toLowerCase())).map(item => {
                      const isEnabled = item.key === 'name' || !hiddenBaseFields.has(item.key);
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
                              onClick={() => {
                                setHiddenBaseFields(prev => {
                                  const next = new Set(prev);
                                  if (next.has(item.key)) next.delete(item.key);
                                  else next.add(item.key);
                                  localStorage.setItem(`form-response-hidden-fields-${formId}`, JSON.stringify([...next]));
                                  return next;
                                });
                              }}
                              className={`w-9 h-5 rounded-full relative transition-colors ${isEnabled ? 'bg-violet-600' : 'bg-gray-300 dark:bg-slate-600'}`}
                            >
                              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${isEnabled ? 'right-0.5' : 'left-0.5'}`} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Custom Fields */}
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500">Custom fields</div>
                    {customFields.filter(f => !fieldsPanelSearch || f.name.toLowerCase().includes(fieldsPanelSearch.toLowerCase())).length === 0 ? (
                      <div className="text-sm text-gray-500 dark:text-slate-400">No custom fields</div>
                    ) : (
                      customFields.filter(f => !fieldsPanelSearch || f.name.toLowerCase().includes(fieldsPanelSearch.toLowerCase())).map(field => {
                        const isEnabled = !hiddenCustomFields.has(field.id);
                        return (
                          <div
                            key={field.id}
                            className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1f2229] bg-white dark:bg-[#15161a]"
                          >
                            <span className="text-sm text-gray-700 dark:text-slate-200">{field.name}</span>
                            <button
                              onClick={() => {
                                setHiddenCustomFields(prev => {
                                  const next = new Set(prev);
                                  if (next.has(field.id)) next.delete(field.id);
                                  else next.add(field.id);
                                  localStorage.setItem(`form-response-hidden-cf-${formId}`, JSON.stringify([...next]));
                                  return next;
                                });
                              }}
                              className={`w-9 h-5 rounded-full relative transition-colors ${isEnabled ? 'bg-violet-600' : 'bg-gray-300 dark:bg-slate-600'}`}
                            >
                              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${isEnabled ? 'right-0.5' : 'left-0.5'}`} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Response Data Columns */}
                  {availableColumns.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500">Form data columns</div>
                      {availableColumns.filter(col => !fieldsPanelSearch || col.toLowerCase().includes(fieldsPanelSearch.toLowerCase())).map(col => {
                        const isVisible = visibleColumns.includes(col);
                        return (
                          <div
                            key={col}
                            className="flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1f2229] bg-white dark:bg-[#15161a]"
                          >
                            <span className="text-sm text-gray-700 dark:text-slate-200">{col}</span>
                            <button
                              onClick={() => {
                                setVisibleColumns(prev =>
                                  isVisible ? prev.filter(c => c !== col) : [...prev, col]
                                );
                              }}
                              className={`w-9 h-5 rounded-full relative transition-colors ${isVisible ? 'bg-violet-600' : 'bg-gray-300 dark:bg-slate-600'}`}
                            >
                              <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${isVisible ? 'right-0.5' : 'left-0.5'}`} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add Field Button */}
                  <button
                    onClick={() => {
                      setShowFieldsPanel(false);
                      setShowCustomFieldPanel(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-violet-500 text-violet-500 hover:bg-violet-500/10 rounded-lg"
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

      {/* Add Column Panel */}
      {showAddColumnPanel && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setShowAddColumnPanel(false)}
          />
          <div className="fixed top-0 right-0 h-full w-[320px] bg-white dark:bg-[#14151a] border-l border-gray-200 dark:border-[#1f2229] z-50 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#1f2229]">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Add column</span>
              <button
                onClick={() => setShowAddColumnPanel(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              <button
                onClick={() => {
                  setShowAddColumnPanel(false);
                  setShowCustomFieldPanel(true);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1f2229] text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
              >
                <span className="flex items-center gap-2 text-sm">
                  <Plus className="w-4 h-4" />
                  Create field
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400 dark:text-slate-500" />
              </button>
              <button
                onClick={() => {
                  setShowAddColumnPanel(false);
                  setFieldsPanelSearch('');
                  setFieldsPanelStep('fields');
                  setShowFieldsPanel(true);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1f2229] text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
              >
                <span className="flex items-center gap-2 text-sm">
                  <Columns className="w-4 h-4" />
                  Fields
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400 dark:text-slate-500" />
              </button>
              <button
                onClick={() => {
                  setShowAddColumnPanel(false);
                  setFieldsPanelSearch('');
                  setFieldsPanelStep('customize');
                  setShowFieldsPanel(true);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1f2229] text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
              >
                <span className="flex items-center gap-2 text-sm">
                  <SlidersHorizontal className="w-4 h-4" />
                  Custom view
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400 dark:text-slate-500" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Custom Field Panel - ClickUp Style */}
      <CustomFieldPanel
        isOpen={showCustomFieldPanel}
        onClose={() => setShowCustomFieldPanel(false)}
        spaceId={formSpace?.id || ''}
        onFieldCreated={() => {
          toast.success('Field created! It will appear as a column.');
          onFieldCreated();
        }}
        statusFieldVisible={!hiddenBaseFields.has('status')}
        onToggleStatusField={(visible) => {
          setHiddenBaseFields(prev => {
            const next = new Set(prev);
            if (visible) {
              next.delete('status');
            } else {
              next.add('status');
            }
            localStorage.setItem(`form-response-hidden-fields-${formId}`, JSON.stringify([...next]));
            return next;
          });
          // Ensure 'status' is in column order when toggling ON
          if (visible && !columnOrder.includes('status')) {
            const newOrder = [...columnOrder, 'status'];
            setColumnOrder(newOrder);
            localStorage.setItem(`form-response-col-order-v3-${formId}`, JSON.stringify(newOrder));
          }
        }}
      />
    </div>
  );
}

export default function FormBuilder({ form, onClose, inline = false }: FormBuilderProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'build' | 'responses' | 'settings' | 'preview'>('build');
  const [formName, setFormName] = useState(form.name);
  const [formDescription, setFormDescription] = useState(form.description || '');
  const [fields, setFields] = useState<FormField[]>(form.fields || []);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(form.is_published || false);
  const [searchQuery, setSearchQuery] = useState('');
  const [subMenuSection, setSubMenuSection] = useState<'new' | 'location' | 'workspace'>('new');

  // Settings state
  const [settings, setSettings] = useState<FormSettings>(form.settings || {
    theme: 'dark',
    buttonLabel: 'Submit',
    layout: 'one-column',
    buttonColor: '#7c3aed',
    showResubmit: false,
    hideBranding: false
  });

  // Response creation state
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [responseName, setResponseName] = useState('');
  // Default to first active status (like "TODO" or "BACKLOG")
  const [responseStatus, setResponseStatus] = useState(() => {
    const firstActiveStatus = defaultStatusOptions.find(s => s.status_group === 'active');
    return firstActiveStatus?.id || 'todo';
  });
  const [responseAssignee, setResponseAssignee] = useState('');
  const [responseDueDate, setResponseDueDate] = useState('');
  const [responsePriority, setResponsePriority] = useState('normal');
  const [responseTags, setResponseTags] = useState<string[]>([]);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTagsDropdown, setShowTagsDropdown] = useState(false);
  const [responseType, setResponseType] = useState<'task' | 'doc' | 'reminder'>('task');

  // Editing response state
  const [editingResponse, setEditingResponse] = useState<FormResponse | null>(null);
  const [responseSearch, setResponseSearch] = useState('');

  // Settings assignee dropdown state
  const [showSettingsAssigneeDropdown, setShowSettingsAssigneeDropdown] = useState(false);
  const [settingsAssigneeSearch, setSettingsAssigneeSearch] = useState('');
  const settingsAssigneeRef = useRef<HTMLDivElement>(null);

  // File upload state - tracks uploaded files per field
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File[]>>({});
  const [dragOverField, setDragOverField] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Refs for click outside detection
  const questionDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);
  const priorityDropdownRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (questionDropdownRef.current && !questionDropdownRef.current.contains(event.target as Node)) {
        setShowAddQuestion(false);
        setExpandedType(null);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(event.target as Node)) {
        setShowAssigneeDropdown(false);
      }
      if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(event.target as Node)) {
        setShowPriorityDropdown(false);
      }
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
      if (settingsAssigneeRef.current && !settingsAssigneeRef.current.contains(event.target as Node)) {
        setShowSettingsAssigneeDropdown(false);
        setSettingsAssigneeSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdowns and modals on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showResponseModal || editingResponse) {
          setShowResponseModal(false);
          setEditingResponse(null);
          resetResponseForm();
        } else if (showAddQuestion) {
          setShowAddQuestion(false);
          setExpandedType(null);
        } else if (showStatusDropdown) {
          setShowStatusDropdown(false);
        } else if (showAssigneeDropdown) {
          setShowAssigneeDropdown(false);
        } else if (showPriorityDropdown) {
          setShowPriorityDropdown(false);
        } else if (showDatePicker) {
          setShowDatePicker(false);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showResponseModal, editingResponse, showAddQuestion, showStatusDropdown, showAssigneeDropdown, showPriorityDropdown, showDatePicker]);

  // Queries
  const { data: spaces = [] } = useQuery<Space[]>({
    queryKey: ['spaces'],
    queryFn: spacesApi.getAll
  });

  const { data: lists = [] } = useQuery<TaskList[]>({
    queryKey: ['task-lists'],
    queryFn: taskListsApi.getAll
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: membersApi.getAll
  });

  // Query custom fields for the form's space
  const { data: customFields = [] } = useQuery<CustomField[]>({
    queryKey: ['customFields', form.space_id],
    queryFn: () => form.space_id ? customFieldsApi.getBySpace(form.space_id) : Promise.resolve([]),
    enabled: !!form.space_id
  });

  const { data: responses = [], isLoading: responsesLoading, refetch: refetchResponses } = useQuery<FormResponse[]>({
    queryKey: ['form-responses', form.id],
    queryFn: () => formResponsesApi.getByForm(form.id),
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false // Don't refetch when switching tabs
  });

  // Get response IDs for fetching custom field values
  const responseIds = useMemo(() => responses.map(r => r.id), [responses]);

  // Fetch custom field values for all responses
  const { data: customFieldValues = [] } = useQuery<CustomFieldValue[]>({
    queryKey: ['customFieldValues', responseIds],
    queryFn: () => responseIds.length > 0 ? customFieldsApi.getValuesBatch(responseIds) : Promise.resolve([]),
    enabled: responseIds.length > 0
  });

  // Map custom field values by response and field for easy lookup
  const fieldValueMap = useMemo(() => {
    const map: Record<string, Record<string, CustomFieldValue>> = {};
    customFieldValues.forEach(value => {
      if (!map[value.task_id]) map[value.task_id] = {};
      map[value.task_id][value.field_id] = value;
    });
    return map;
  }, [customFieldValues]);

  // Query for task statuses (supports inheritance from space)
  const { data: fetchedStatuses = [] } = useQuery<TaskStatus[]>({
    queryKey: ['task-statuses-form', form.id],
    queryFn: () => taskStatusesApi.getByForm(form.id)
  });

  // Status management state
  const [inheritFromSpace, setInheritFromSpace] = useState<boolean>(
    form.status_settings?.inherit_from_space !== false
  );

  // Convert fetched statuses to StatusOption format, or use defaults
  const statusOptions: StatusOption[] = fetchedStatuses.length > 0
    ? fetchedStatuses.map(s => ({
        id: s.id,
        name: s.name,
        color: s.color,
        status_group: s.status_group,
        position: s.position
      }))
    : defaultStatusOptions;

  // Mutations
  const updateFormMutation = useMutation({
    mutationFn: (data: Partial<Form>) => formsApi.update(form.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
    }
  });

  const createResponseMutation = useMutation({
    mutationFn: formResponsesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-responses', form.id] });
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      setShowResponseModal(false);
      resetResponseForm();
      toast.success('Form response created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create response');
    }
  });

  const updateResponseMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FormResponse> }) =>
      formResponsesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-responses', form.id] });
      setEditingResponse(null);
      toast.success('Response updated');
    }
  });

  const deleteResponseMutation = useMutation({
    mutationFn: formResponsesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-responses', form.id] });
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success('Response deleted');
    }
  });

  // Mutation for updating form statuses
  const updateStatusesMutation = useMutation({
    mutationFn: (statuses: StatusOption[]) => taskStatusesApi.bulkUpdate({
      statuses: statuses.map((s, i) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        status_group: s.status_group || 'active',
        position: i
      })),
      form_id: form.id
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-statuses-form', form.id] });
      toast.success('Statuses updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update statuses');
    }
  });

  // Handler for updating statuses
  const handleUpdateStatuses = (statuses: StatusOption[]) => {
    updateStatusesMutation.mutate(statuses);
  };

  // Handler for toggling inheritance
  const handleToggleInheritance = (inherit: boolean) => {
    setInheritFromSpace(inherit);
    // Update the form's status_settings
    updateFormMutation.mutate({
      status_settings: { inherit_from_space: inherit }
    });
    if (inherit) {
      // Refetch statuses from space
      queryClient.invalidateQueries({ queryKey: ['task-statuses-form', form.id] });
    }
  };

  const resetResponseForm = () => {
    setResponseName('');
    // Reset to first active status (like "BACKLOG" or "TODO")
    const firstActiveStatus = statusOptions.find(s => s.status_group === 'active') || statusOptions[0];
    setResponseStatus(firstActiveStatus?.id || 'backlog');
    setResponseAssignee('');
    setResponseDueDate('');
    setResponsePriority('normal');
    setResponseTags([]);
    setResponseType('task');
  };

  // Auto-save form changes
  useEffect(() => {
    const timeout = setTimeout(() => {
      updateFormMutation.mutate({
        name: formName,
        description: formDescription,
        fields,
        settings
      });
    }, 1500);
    return () => clearTimeout(timeout);
  }, [formName, formDescription, fields, settings]);

  const addField = (parentType: string, subItem: any) => {
    const newField: FormField = {
      id: crypto.randomUUID(),
      label: subItem.name,
      type: subItem.id,
      required: false,
      placeholder: `Enter ${subItem.name.toLowerCase()}...`,
      mapTo: subItem.isNew ? undefined : (subItem.mapTo || subItem.id)
    };

    // Set appropriate placeholders and options based on type
    if (subItem.id === 'email') {
      newField.placeholder = 'Enter email address...';
    } else if (subItem.id === 'phone') {
      newField.placeholder = 'Enter phone number...';
    } else if (subItem.id === 'website' || subItem.id === 'url') {
      newField.placeholder = 'https://...';
    } else if (subItem.id === 'money') {
      newField.placeholder = '$0.00';
    } else if (subItem.id === 'dropdown' || subItem.id === 'status') {
      newField.options = ['Option 1', 'Option 2', 'Option 3'];
    } else if (subItem.id === 'checkbox' || subItem.id === 'labels') {
      newField.options = ['Option 1', 'Option 2', 'Option 3'];
    }

    setFields([...fields, newField]);
    setShowAddQuestion(false);
    setExpandedType(null);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const handleCreateResponse = () => {
    if (!responseName.trim()) {
      toast.error('Please enter a response name');
      return;
    }

    createResponseMutation.mutate({
      form_id: form.id,
      name: responseName.trim(),
      status: responseStatus,
      assignee_id: responseAssignee || undefined,
      due_date: responseDueDate || undefined,
      priority: responsePriority,
      tags: responseTags,
      response_data: {}
    });
  };

  const formSpace = spaces.find(s => s.id === form.space_id);

  // File upload handlers
  const handleFileSelect = (fieldId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    setUploadedFiles(prev => ({
      ...prev,
      [fieldId]: [...(prev[fieldId] || []), ...newFiles]
    }));
    toast.success(`${newFiles.length} file${newFiles.length > 1 ? 's' : ''} uploaded`);
  };

  const handleDragOver = (e: React.DragEvent, fieldId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverField(fieldId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverField(null);
  };

  const handleDrop = (e: React.DragEvent, fieldId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverField(null);

    const files = e.dataTransfer.files;
    handleFileSelect(fieldId, files);
  };

  const removeFile = (fieldId: string, fileIndex: number) => {
    setUploadedFiles(prev => ({
      ...prev,
      [fieldId]: prev[fieldId]?.filter((_, i) => i !== fileIndex) || []
    }));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (file: File) => {
    const type = file.type;
    if (type.startsWith('image/')) return Image;
    if (type.startsWith('video/')) return Camera;
    if (type.includes('pdf')) return FileText;
    return Paperclip;
  };

  // Render field preview based on type
  const renderFieldInput = (field: FormField) => {
    const isUploadType = ['files', 'attachments', 'attach_documents', 'image', 'screenshot'].includes(field.type);

    if (isUploadType) {
      const fieldFiles = uploadedFiles[field.id] || [];
      const isDragOver = dragOverField === field.id;
      const isImageOnly = field.type === 'image' || field.type === 'screenshot';
      const acceptTypes = isImageOnly ? 'image/*' : '*/*';

      return (
        <div className="space-y-3">
          {/* Upload Zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
              isDragOver
                ? 'border-violet-500 bg-violet-500/10'
                : 'border-slate-600 hover:border-violet-500'
            }`}
            onDragOver={(e) => handleDragOver(e, field.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, field.id)}
            onClick={() => fileInputRefs.current[field.id]?.click()}
          >
            <input
              type="file"
              ref={(el) => { fileInputRefs.current[field.id] = el; }}
              className="hidden"
              multiple
              accept={acceptTypes}
              onChange={(e) => handleFileSelect(field.id, e.target.files)}
            />
            <div className="flex flex-col items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isDragOver ? 'bg-violet-500/20' : 'bg-slate-700'
              }`}>
                {isImageOnly ? (
                  <Image className={`w-6 h-6 ${isDragOver ? 'text-violet-400' : 'text-slate-400'}`} />
                ) : (
                  <Upload className={`w-6 h-6 ${isDragOver ? 'text-violet-400' : 'text-slate-400'}`} />
                )}
              </div>
              <div>
                <p className={`text-sm font-medium ${isDragOver ? 'text-violet-300' : 'text-slate-300'}`}>
                  {isDragOver ? 'Drop files here' : 'Drop your files here to upload'}
                </p>
                <p className="text-xs text-slate-500 mt-1">or click to browse</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRefs.current[field.id]?.click();
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition-colors"
              >
                Browse Files
              </button>
              <p className="text-xs text-slate-500">
                {isImageOnly ? 'Supports: JPG, PNG, GIF, WebP' : 'Supports: All file types up to 10MB'}
              </p>
            </div>
          </div>

          {/* Uploaded Files Preview */}
          {fieldFiles.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-slate-500 uppercase tracking-wider">
                Uploaded files ({fieldFiles.length})
              </div>
              <div className="space-y-2">
                {fieldFiles.map((file, index) => {
                  const FileIcon = getFileIcon(file);
                  const isImage = file.type.startsWith('image/');

                  return (
                    <div
                      key={`${field.id}-${index}`}
                      className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg group"
                    >
                      {/* Preview or Icon */}
                      {isImage ? (
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-700 flex-shrink-0">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                          <FileIcon className="w-6 h-6 text-slate-400" />
                        </div>
                      )}

                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-300 truncate">{file.name}</p>
                        <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => {
                            // Preview file
                            if (isImage) {
                              window.open(URL.createObjectURL(file), '_blank');
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFile(field.id, index)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (field.type === 'signature') {
      return (
        <div className="border border-slate-700 rounded-lg p-4 h-32 flex items-center justify-center bg-slate-800/30">
          <div className="text-center">
            <PenTool className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-xs text-slate-500">Click to sign</p>
          </div>
        </div>
      );
    }

    if (field.type === 'long_text' || field.type === 'textarea' || field.type === 'task_description') {
      return (
        <textarea
          placeholder={field.placeholder}
          className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-300 placeholder-slate-500 outline-none focus:border-violet-500"
          rows={4}
        />
      );
    }

    if (field.type === 'priority') {
      return (
        <div className="flex gap-2">
          {priorityOptions.map(p => (
            <button
              key={p.id}
              className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-300 hover:border-violet-500 flex items-center justify-center gap-2"
            >
              <Flag className="w-4 h-4" style={{ color: p.color }} />
              {p.name}
            </button>
          ))}
        </div>
      );
    }

    if (field.type === 'status' || field.mapTo === 'status') {
      return (
        <div className="flex gap-2 flex-wrap">
          {statusOptions.map(s => (
            <button
              key={s.id}
              className="px-3 py-1.5 rounded text-xs font-medium"
              style={{ backgroundColor: `${s.color}20`, color: s.color }}
            >
              {s.name}
            </button>
          ))}
        </div>
      );
    }

    if (field.type === 'dropdown' || field.type === 'single_select') {
      return (
        <div className="relative">
          <select className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-400 appearance-none outline-none">
            <option>Select option...</option>
            {field.options?.map((opt, i) => (
              <option key={i}>{opt}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        </div>
      );
    }

    if (field.type === 'checkbox' || field.type === 'labels' || field.type === 'tags' || field.type === 'multi_select') {
      return (
        <div className="space-y-2">
          {(field.options || ['Option 1', 'Option 2', 'Option 3']).map((opt, i) => (
            <label key={i} className="flex items-center gap-3 cursor-pointer group">
              <div className="w-5 h-5 rounded border border-slate-600 flex items-center justify-center group-hover:border-violet-500">
                <Check className="w-3 h-3 text-transparent" />
              </div>
              <span className="text-sm text-slate-300">{opt}</span>
            </label>
          ))}
        </div>
      );
    }

    if (field.type === 'rating') {
      return (
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} className="w-10 h-10 rounded-lg border border-slate-600 text-slate-400 hover:border-violet-500 hover:text-violet-400">
              {n}
            </button>
          ))}
        </div>
      );
    }

    if (field.type === 'people' || field.type === 'assignee') {
      return (
        <div className="relative">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg cursor-pointer hover:border-slate-600">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-400">Select people...</span>
          </div>
        </div>
      );
    }

    if (field.type === 'date' || field.type === 'start_date' || field.type === 'due_date') {
      return (
        <input
          type="date"
          className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-300 outline-none focus:border-violet-500"
        />
      );
    }

    return (
      <input
        type={field.type === 'number' || field.type === 'money' || field.type === 'time_estimate' ? 'number' : field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
        placeholder={field.placeholder}
        className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-300 placeholder-slate-500 outline-none focus:border-violet-500"
      />
    );
  };

  // Get icon for field type
  const getFieldIcon = (type: string) => {
    const typeMap: Record<string, any> = {
      task_name: Type, task_description: AlignLeft, assignee: User, status: CheckSquare,
      priority: Flag, start_date: Calendar, due_date: Calendar, tags: Tag,
      time_estimate: Clock, attachments: Paperclip, text: Type, textarea: AlignLeft,
      date: Calendar, dropdown: List, checkbox: CheckSquare, rating: Flag, voting: Check,
      labels: Tag, email: Mail, website: Globe, phone: Phone, location: MapPin, url: Link2,
      people: Users, files: Paperclip, attach_documents: FileText, image: Image,
      screenshot: Camera, money: DollarSign, number: Hash, signature: PenTool
    };
    const Icon = typeMap[type] || Type;
    return <Icon className="w-4 h-4" />;
  };

  // Filter responses by search
  const filteredResponses = responses.filter(r =>
    r.name.toLowerCase().includes(responseSearch.toLowerCase())
  );

  return (
    <div className={inline ? 'contents' : 'fixed inset-0 z-[200]'}>
      {inline ? (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      ) : (
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      )}

      <div className={inline ? 'fixed top-0 right-0 h-full z-50 w-full max-w-[1100px] shadow-2xl animate-in slide-in-from-right duration-200 bg-[#1e1f28] flex flex-col overflow-hidden' : 'absolute inset-4 lg:inset-8 bg-[#1e1f28] rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10'}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700 bg-[#1a1b23]">
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 flex items-center gap-2">
              {formSpace && (
                <>
                  <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: formSpace.color || '#6366f1' }}>
                    {formSpace.name.charAt(0).toUpperCase()}
                  </div>
                  {formSpace.name}
                  <ChevronRight className="w-3.5 h-3.5" />
                </>
              )}
              <span className="text-white font-medium">{formName}</span>
            </span>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
            {(['build', 'responses', 'settings', 'preview'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                  activeTab === tab ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'responses' && responses.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-violet-600 rounded text-[10px]">{responses.length}</span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{responses.length} responses</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/form/${form.id}`);
                toast.success('Public form link copied!');
              }}
              className="px-3 py-1.5 text-xs text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-700 flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" /> Copy Link
            </button>
            <button
              onClick={() => {
                const newPublishState = !isPublished;
                updateFormMutation.mutate(
                  { is_published: newPublishState },
                  {
                    onSuccess: () => {
                      setIsPublished(newPublishState);
                      toast.success(newPublishState ? 'Form published!' : 'Form unpublished');
                    }
                  }
                );
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
                isPublished
                  ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                  : 'bg-violet-600 text-white hover:bg-violet-700'
              }`}
            >
              {isPublished ? 'Unpublish' : 'Publish'}
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar - pages (only for build/settings/preview) */}
          {activeTab !== 'responses' && (
            <div className="w-48 border-r border-slate-700 bg-[#1a1b23] p-3">
              <div className="space-y-1">
                <button
                  onClick={() => toast.info('Currently viewing Start Page')}
                  className="w-full text-left px-3 py-2 rounded-lg bg-violet-600/20 text-white text-sm flex items-center gap-2"
                >
                  <div className="w-1 h-6 bg-violet-500 rounded-full" />
                  Start Page
                </button>
                <button
                  onClick={() => toast.info('End Page customization coming soon')}
                  className="w-full text-left px-3 py-2 rounded-lg text-slate-400 text-sm flex items-center gap-2 hover:bg-slate-700/50"
                >
                  <div className="w-1 h-1 bg-slate-500 rounded-full" />
                  End Page
                </button>
              </div>
            </div>
          )}

          {/* Form content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'build' && (
              <div className={`max-w-3xl mx-auto py-8 px-6 ${settings.theme === 'light' ? 'bg-white' : ''}`}>
                {/* Logo */}
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center mb-6">
                  <div className="w-8 h-8 border-2 border-white rounded transform rotate-45" />
                </div>

                {/* Form title */}
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full text-2xl font-bold text-white bg-transparent border-none outline-none mb-3"
                  placeholder="Form name"
                />

                {/* Description */}
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full text-sm text-slate-400 bg-transparent border-none outline-none resize-none mb-8"
                  placeholder="Form description (optional)"
                  rows={2}
                />

                {/* Fields */}
                <div className="space-y-6">
                  {fields.map((field, index) => (
                    <div key={field.id} className="group">
                      <div className="flex items-start gap-2">
                        <button className="mt-2 p-1 text-slate-500 opacity-0 group-hover:opacity-100 cursor-grab">
                          <GripVertical className="w-4 h-4" />
                        </button>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="text-slate-400">
                              {getFieldIcon(field.type)}
                            </div>
                            <SpellCheckInput
                              value={field.label}
                              onChange={(val) => updateField(field.id, { label: val })}
                              className="text-sm font-medium text-white bg-transparent border-none outline-none flex-1"
                            />
                            {field.required && <span className="text-red-500">*</span>}
                            {field.mapTo && (
                              <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 text-[10px] rounded-full">
                                Mapped
                              </span>
                            )}
                          </div>
                          {field.helpText && (
                            <p className="text-xs text-slate-500 mb-2">{field.helpText}</p>
                          )}
                          {renderFieldInput(field)}
                        </div>
                        <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100">
                          <button
                            onClick={() => updateField(field.id, { required: !field.required })}
                            className={`p-1.5 rounded hover:bg-slate-700 ${field.required ? 'text-red-400' : 'text-slate-500'}`}
                            title="Required"
                          >
                            <span className="text-xs font-bold">*</span>
                          </button>
                          <button
                            onClick={() => setEditingFieldId(field.id === editingFieldId ? null : field.id)}
                            className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeField(field.id)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Field settings panel */}
                      {editingFieldId === field.id && (
                        <div className="mt-3 ml-8 p-3 bg-slate-800/50 rounded-lg border border-slate-700 space-y-3">
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Placeholder</label>
                            <SpellCheckInput
                              value={field.placeholder || ''}
                              onChange={(val) => updateField(field.id, { placeholder: val })}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Help Text</label>
                            <SpellCheckInput
                              value={field.helpText || ''}
                              onChange={(val) => updateField(field.id, { helpText: val })}
                              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white outline-none"
                            />
                          </div>
                          {(field.type === 'dropdown' || field.type === 'status' || field.type === 'checkbox' || field.type === 'labels') && (
                            <div>
                              <label className="text-xs text-slate-400 block mb-1">Options</label>
                              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                {(field.options || []).map((opt, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={opt}
                                      onChange={(e) => {
                                        const newOptions = [...(field.options || [])];
                                        newOptions[i] = e.target.value;
                                        updateField(field.id, { options: newOptions });
                                      }}
                                      className="flex-1 px-2.5 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-white outline-none focus:border-violet-500"
                                    />
                                    <button
                                      onClick={() => {
                                        const newOptions = (field.options || []).filter((_, idx) => idx !== i);
                                        updateField(field.id, { options: newOptions });
                                      }}
                                      className="p-1 text-slate-500 hover:text-red-400 flex-shrink-0"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <button
                                onClick={() => {
                                  const currentOptions = field.options || [];
                                  updateField(field.id, { options: [...currentOptions, `Option ${currentOptions.length + 1}`] });
                                }}
                                className="mt-2 flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" /> Add option
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add question button */}
                <div className="relative mt-6" ref={questionDropdownRef}>
                  <button
                    onClick={() => setShowAddQuestion(!showAddQuestion)}
                    className="w-full py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 hover:border-violet-500 hover:text-violet-400 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add question
                  </button>

                  {/* Question type dropdown */}
                  {showAddQuestion && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-[600px] bg-[#1e1f28] border border-slate-700 rounded-xl shadow-2xl z-50 flex">
                      {/* Question types */}
                      <div className="w-64 border-r border-slate-700 py-2 max-h-[500px] overflow-y-auto">
                        <div className="px-3 mb-2">
                          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg">
                            <Search className="w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Search..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                            />
                          </div>
                        </div>
                        <div className="px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                          Question type
                        </div>
                        {questionTypes.filter(t =>
                          t.name.toLowerCase().includes(searchQuery.toLowerCase())
                        ).map(type => (
                          <button
                            key={type.id}
                            onClick={() => {
                              if (type.subItems) {
                                setExpandedType(expandedType === type.id ? null : type.id);
                                setSubMenuSection('new');
                              } else {
                                addField(type.id, { id: type.id, name: type.name, isNew: true });
                              }
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-slate-700/50 ${
                              expandedType === type.id ? 'bg-slate-700/50 text-white' : 'text-slate-300'
                            }`}
                          >
                            <span className="flex items-center gap-3">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${type.bgColor}`}>
                                <type.icon className={`w-4 h-4 ${type.color}`} />
                              </div>
                              {type.name}
                            </span>
                            {type.subItems && <ChevronRight className="w-4 h-4 text-slate-500" />}
                          </button>
                        ))}
                      </div>

                      {/* Sub-options panel */}
                      {expandedType && (
                        <div className="w-80 py-2 max-h-[500px] overflow-y-auto">
                          {/* For task_property, show all mapped fields directly (filter out already-used) */}
                          {expandedType === 'task_property' ? (
                            <div>
                              <div className="px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                Map to task property
                              </div>
                              {questionTypes.find(t => t.id === 'task_property')?.subItems?.filter(s => !s.mapTo || !fields.some(f => f.mapTo === s.mapTo)).map(subItem => (
                                <button
                                  key={subItem.id}
                                  onClick={() => addField(expandedType, { ...subItem, isNew: false })}
                                  className="w-full text-left px-4 py-2.5 text-sm text-slate-300 flex items-center gap-3 hover:bg-slate-700/50"
                                >
                                  <subItem.icon className="w-4 h-4 text-blue-400" />
                                  {subItem.name}
                                  <span className="ml-auto px-2 py-0.5 bg-blue-600/20 text-blue-400 text-[10px] rounded">Task</span>
                                </button>
                              ))}
                              {questionTypes.find(t => t.id === 'task_property')?.subItems?.filter(s => !s.mapTo || !fields.some(f => f.mapTo === s.mapTo)).length === 0 && (
                                <p className="px-4 py-2 text-xs text-slate-500">All task properties already added</p>
                              )}
                            </div>
                          ) : (
                            <>
                              {/* Section tabs for other types */}
                              <div className="px-3 mb-3">
                                <div className="flex gap-1 p-1 bg-slate-800 rounded-lg">
                                  {(['new', 'location', 'workspace'] as const).map(section => (
                                    <button
                                      key={section}
                                      onClick={() => setSubMenuSection(section)}
                                      className={`flex-1 px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors ${
                                        subMenuSection === section
                                          ? 'bg-slate-700 text-white'
                                          : 'text-slate-400 hover:text-white'
                                      }`}
                                    >
                                      {section === 'new' && 'Create new'}
                                      {section === 'location' && 'Map to Field'}
                                      {section === 'workspace' && 'Workspace'}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {subMenuSection === 'new' && (
                                <div>
                                  <div className="px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                    Create new field
                                  </div>
                                  {questionTypes.find(t => t.id === expandedType)?.subItems?.filter(s => s.isNew).map(subItem => (
                                    <button
                                      key={subItem.id}
                                      onClick={() => addField(expandedType, subItem)}
                                      className="w-full text-left px-4 py-2.5 text-sm text-slate-300 flex items-center gap-3 hover:bg-slate-700/50"
                                    >
                                      <subItem.icon className="w-4 h-4 text-slate-400" />
                                      {subItem.name}
                                      <span className="ml-auto px-2 py-0.5 bg-green-600/20 text-green-400 text-[10px] rounded">New</span>
                                    </button>
                                  ))}
                                  {questionTypes.find(t => t.id === expandedType)?.subItems?.filter(s => s.isNew).length === 0 && (
                                    <p className="px-4 py-2 text-xs text-slate-500">No new fields available for this type</p>
                                  )}
                                </div>
                              )}

                              {subMenuSection === 'location' && (
                                <div>
                                  <div className="px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                    Map to field in this location
                                  </div>
                                  {questionTypes.find(t => t.id === expandedType)?.subItems?.filter(s => !s.isNew && (!s.mapTo || !fields.some(f => f.mapTo === s.mapTo))).map(subItem => (
                                    <button
                                      key={subItem.id}
                                      onClick={() => addField(expandedType, subItem)}
                                      className="w-full text-left px-4 py-2.5 text-sm text-slate-300 flex items-center gap-3 hover:bg-slate-700/50"
                                    >
                                      <subItem.icon className="w-4 h-4 text-blue-400" />
                                      {subItem.name}
                                      <span className="ml-auto px-2 py-0.5 bg-blue-600/20 text-blue-400 text-[10px] rounded">Task</span>
                                    </button>
                                  ))}
                                  {questionTypes.find(t => t.id === expandedType)?.subItems?.filter(s => !s.isNew && (!s.mapTo || !fields.some(f => f.mapTo === s.mapTo))).length === 0 && (
                                    <p className="px-4 py-2 text-xs text-slate-500">All task properties already added</p>
                                  )}
                                </div>
                              )}

                              {subMenuSection === 'workspace' && (
                                <div>
                                  <div className="px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                    Map to field in Workspace
                                  </div>
                                  <div className="px-4">
                                    {customFields.length > 0 ? (
                                      <div className="space-y-1 mb-3">
                                        {customFields.map((cf: CustomField) => {
                                          const fieldTypeMap: Record<string, any> = {
                                            text: Type, number: Hash, date: Calendar, dropdown: List,
                                            checkbox: CheckSquare, email: Mail, url: Link2, phone: Phone,
                                            people: Users, labels: Tag, money: DollarSign, rating: Flag
                                          };
                                          const FieldIcon = fieldTypeMap[cf.type] || Type;
                                          return (
                                            <button
                                              key={cf.id}
                                              onClick={() => {
                                                addField(expandedType || 'custom', {
                                                  id: cf.id,
                                                  name: cf.name,
                                                  icon: FieldIcon,
                                                  mapTo: `custom_${cf.id}`,
                                                  isNew: false
                                                });
                                              }}
                                              className="w-full text-left px-3 py-2.5 text-sm text-slate-300 flex items-center gap-3 hover:bg-slate-700/50 rounded-lg"
                                            >
                                              <FieldIcon className="w-4 h-4 text-violet-400" />
                                              {cf.name}
                                              <span className="ml-auto px-2 py-0.5 bg-violet-600/20 text-violet-400 text-[10px] rounded">{cf.type}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-slate-500 mb-3">No custom fields found in this workspace</p>
                                    )}
                                    <button
                                      onClick={() => {
                                        toast.info('Custom field creation coming soon');
                                        setShowAddQuestion(false);
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm text-slate-400 border border-dashed border-slate-600 rounded-lg hover:border-violet-500 flex items-center gap-2"
                                    >
                                      <Plus className="w-4 h-4" />
                                      Create custom field
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Responses Tab - ClickUp-style List View */}
            {activeTab === 'responses' && (
              <ResponsesListView
                responses={filteredResponses}
                members={members}
                statusOptions={statusOptions}
                priorityOptions={priorityOptions}
                isLoading={responsesLoading}
                onAddResponse={(defaultStatus) => {
                  if (defaultStatus) {
                    setResponseStatus(defaultStatus);
                  }
                  setShowResponseModal(true);
                }}
                onEditResponse={setEditingResponse}
                onDeleteResponse={(id) => deleteResponseMutation.mutate(id)}
                onUpdateResponse={(id, data) => updateResponseMutation.mutate({ id, data })}
                onUpdateStatuses={handleUpdateStatuses}
                responseSearch={responseSearch}
                setResponseSearch={setResponseSearch}
                formSpace={formSpace}
                formName={formName}
                formId={form.id}
                inheritFromSpace={inheritFromSpace}
                onToggleInheritance={handleToggleInheritance}
                customFields={customFields}
                fieldValueMap={fieldValueMap}
                onFieldCreated={() => {
                  queryClient.invalidateQueries({ queryKey: ['customFields', form.space_id] });
                  queryClient.invalidateQueries({ queryKey: ['customFieldValues'] });
                }}
              />
            )}

            {activeTab === 'settings' && (
              <div className="flex">
                {/* Form preview */}
                <div className="flex-1 py-8 px-6">
                  <div className={`max-w-2xl mx-auto ${settings.theme === 'light' ? 'bg-white p-8 rounded-xl' : ''}`}>
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center mb-6">
                      <div className="w-8 h-8 border-2 border-white rounded transform rotate-45" />
                    </div>
                    <h2 className={`text-2xl font-bold mb-3 ${settings.theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                      {formName}
                    </h2>
                    <p className={`text-sm mb-8 ${settings.theme === 'light' ? 'text-gray-600' : 'text-slate-400'}`}>
                      {formDescription}
                    </p>
                    {fields.map(field => (
                      <div key={field.id} className="mb-4">
                        <label className={`text-sm font-medium mb-1 block ${settings.theme === 'light' ? 'text-gray-700' : 'text-white'}`}>
                          {field.label}{field.required && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type="text"
                          placeholder={field.placeholder}
                          className={`w-full px-4 py-2.5 rounded-lg text-sm outline-none ${
                            settings.theme === 'light'
                              ? 'bg-gray-100 border border-gray-200 text-gray-900 placeholder-gray-400'
                              : 'bg-slate-800/50 border border-slate-700 text-slate-300 placeholder-slate-500'
                          }`}
                          readOnly
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Settings panel */}
                <div className="w-80 border-l border-slate-700 bg-[#1a1b23] p-4 overflow-y-auto">
                  <div className="space-y-6">
                    {/* After submitting */}
                    <div>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">After submitting the form</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-300">Create task in</span>
                          <select className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300">
                            {lists.map(list => (
                              <option key={list.id} value={list.id}>{list.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center justify-between relative" ref={settingsAssigneeRef}>
                          <span className="text-sm text-slate-300">Assign tasks to</span>
                          <button
                            onClick={() => setShowSettingsAssigneeDropdown(!showSettingsAssigneeDropdown)}
                            className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-400 flex items-center gap-1 hover:bg-slate-700"
                          >
                            {settings.assignTasksTo ? (
                              <>
                                <div
                                  className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                                  style={{ backgroundColor: '#6366f1' }}
                                >
                                  {members.find((m: any) => m.id === settings.assignTasksTo)?.name?.charAt(0) || '?'}
                                </div>
                                {members.find((m: any) => m.id === settings.assignTasksTo)?.name || 'Unknown'}
                              </>
                            ) : (
                              <>
                                <User className="w-3 h-3" /> No assignees
                              </>
                            )}
                            <ChevronDown className="w-3 h-3 ml-1" />
                          </button>
                          {showSettingsAssigneeDropdown && (
                            <div className="absolute top-full right-0 mt-1 w-48 bg-[#23242f] border border-slate-700 rounded-lg shadow-xl z-50 py-1">
                              <div className="px-2 py-1.5">
                                <input
                                  type="text"
                                  placeholder="Search members..."
                                  value={settingsAssigneeSearch}
                                  onChange={(e) => setSettingsAssigneeSearch(e.target.value)}
                                  className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white outline-none"
                                  autoFocus
                                />
                              </div>
                              <div className="max-h-32 overflow-y-auto">
                                <button
                                  onClick={() => {
                                    setSettings({ ...settings, assignTasksTo: undefined });
                                    setShowSettingsAssigneeDropdown(false);
                                    setSettingsAssigneeSearch('');
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-xs text-slate-400 hover:bg-slate-700 flex items-center gap-2"
                                >
                                  <X className="w-3 h-3" /> No assignee
                                </button>
                                {members
                                  .filter((m: any) => m.name?.toLowerCase().includes(settingsAssigneeSearch.toLowerCase()))
                                  .map((member: any) => (
                                    <button
                                      key={member.id}
                                      onClick={() => {
                                        setSettings({ ...settings, assignTasksTo: member.id });
                                        setShowSettingsAssigneeDropdown(false);
                                        setSettingsAssigneeSearch('');
                                        toast.success(`Tasks will be assigned to ${member.name}`);
                                      }}
                                      className="w-full px-3 py-1.5 text-left text-xs text-white hover:bg-slate-700 flex items-center gap-2"
                                    >
                                      <div
                                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                                        style={{ backgroundColor: '#6366f1' }}
                                      >
                                        {member.name?.charAt(0) || '?'}
                                      </div>
                                      {member.name}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Submission settings */}
                    <div>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Submission settings</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-300">Redirect URL</span>
                          <input
                            type="text"
                            placeholder="https://"
                            className="w-32 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 outline-none"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-300">Button label</span>
                          <input
                            type="text"
                            value={settings.buttonLabel || 'Submit'}
                            onChange={(e) => setSettings({ ...settings, buttonLabel: e.target.value })}
                            className="w-24 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 outline-none"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-300">Show resubmit button</span>
                          <button
                            onClick={() => setSettings({ ...settings, showResubmit: !settings.showResubmit })}
                            className={`w-9 h-5 rounded-full transition-colors relative ${settings.showResubmit ? 'bg-blue-600' : 'bg-slate-600'}`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-0.5 transition-all ${settings.showResubmit ? 'left-[18px]' : 'left-0.5'}`} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-300">Hide branding</span>
                          <button
                            onClick={() => setSettings({ ...settings, hideBranding: !settings.hideBranding })}
                            className={`w-9 h-5 rounded-full transition-colors relative ${settings.hideBranding ? 'bg-blue-600' : 'bg-slate-600'}`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm absolute top-0.5 transition-all ${settings.hideBranding ? 'left-[18px]' : 'left-0.5'}`} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Layout */}
                    <div>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Layout</h3>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setSettings({ ...settings, layout: 'one-column' })}
                          className={`flex-1 p-3 rounded-lg border ${
                            settings.layout === 'one-column' ? 'border-violet-500 bg-violet-500/10' : 'border-slate-700'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="h-2 bg-slate-600 rounded w-full" />
                            <div className="h-2 bg-slate-600 rounded w-3/4" />
                          </div>
                          <span className="text-[10px] text-slate-400 mt-2 block">One column</span>
                        </button>
                        <button
                          onClick={() => setSettings({ ...settings, layout: 'two-column' })}
                          className={`flex-1 p-3 rounded-lg border ${
                            settings.layout === 'two-column' ? 'border-violet-500 bg-violet-500/10' : 'border-slate-700'
                          }`}
                        >
                          <div className="flex gap-1">
                            <div className="flex-1 space-y-1">
                              <div className="h-2 bg-slate-600 rounded" />
                              <div className="h-2 bg-slate-600 rounded" />
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="h-2 bg-slate-600 rounded" />
                              <div className="h-2 bg-slate-600 rounded" />
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 mt-2 block">Two column</span>
                        </button>
                      </div>
                    </div>

                    {/* Colors */}
                    <div>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Colors</h3>
                      <div className="space-y-3">
                        <div>
                          <span className="text-xs text-slate-400 mb-2 block">Theme</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSettings({ ...settings, theme: 'light' })}
                              className={`flex-1 py-2 px-3 rounded-lg border text-xs flex items-center justify-center gap-2 ${
                                settings.theme === 'light' ? 'border-violet-500 bg-violet-500/10 text-white' : 'border-slate-700 text-slate-400'
                              }`}
                            >
                              <Sun className="w-3.5 h-3.5" /> Light
                            </button>
                            <button
                              onClick={() => setSettings({ ...settings, theme: 'dark' })}
                              className={`flex-1 py-2 px-3 rounded-lg border text-xs flex items-center justify-center gap-2 ${
                                settings.theme === 'dark' ? 'border-violet-500 bg-violet-500/10 text-white' : 'border-slate-700 text-slate-400'
                              }`}
                            >
                              <Moon className="w-3.5 h-3.5" /> Dark
                            </button>
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-slate-400 mb-2 block">Buttons color</span>
                          <div className="flex flex-wrap gap-2">
                            {['#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#84cc16', '#eab308', '#f97316', '#ef4444', '#ec4899', '#8b5cf6'].map(color => (
                              <button
                                key={color}
                                onClick={() => setSettings({ ...settings, buttonColor: color })}
                                className={`w-6 h-6 rounded-full ${settings.buttonColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1a1b23]' : ''}`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'preview' && (
              <div className={`min-h-full py-8 ${settings.theme === 'light' ? 'bg-gray-100' : ''}`}>
                <div className={`max-w-2xl mx-auto px-6 py-8 rounded-xl ${settings.theme === 'light' ? 'bg-white shadow-lg' : ''}`}>
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center mb-6">
                    <div className="w-8 h-8 border-2 border-white rounded transform rotate-45" />
                  </div>
                  <h2 className={`text-2xl font-bold mb-3 ${settings.theme === 'light' ? 'text-gray-900' : 'text-white'}`}>
                    {formName}
                  </h2>
                  <p className={`text-sm mb-8 ${settings.theme === 'light' ? 'text-gray-600' : 'text-slate-400'}`}>
                    {formDescription}
                  </p>

                  {fields.map(field => (
                    <div key={field.id} className="mb-5">
                      <label className={`text-sm font-medium mb-1.5 block ${settings.theme === 'light' ? 'text-gray-700' : 'text-white'}`}>
                        {field.label}{field.required && <span className="text-red-500">*</span>}
                      </label>
                      {field.helpText && (
                        <p className={`text-xs mb-2 ${settings.theme === 'light' ? 'text-gray-500' : 'text-slate-500'}`}>
                          {field.helpText}
                        </p>
                      )}
                      {renderFieldInput(field)}
                    </div>
                  ))}

                  <button
                    className="w-full py-3 rounded-lg text-white font-medium mt-4"
                    style={{ backgroundColor: settings.buttonColor || '#7c3aed' }}
                  >
                    {settings.buttonLabel || 'Submit'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Add Form Response floating button (only on build tab) */}
          {activeTab === 'build' && (
            <button
              onClick={() => setShowResponseModal(true)}
              className="fixed bottom-6 right-6 px-4 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 shadow-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Form Response
            </button>
          )}
        </div>
      </div>

      {/* Add/Edit Response Modal - Enhanced ClickUp-style */}
      {(showResponseModal || editingResponse) && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setShowResponseModal(false); setEditingResponse(null); resetResponseForm(); }} />
          <div className="relative bg-[#23242f] border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl z-10">
            {/* Modal tabs - ClickUp style */}
            <div className="flex items-center gap-1 px-4 py-2.5 border-b border-slate-700 bg-[#1e1f28] rounded-t-xl">
              <button
                onClick={() => setResponseType('task')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  responseType === 'task'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                Task
              </button>
              <button
                onClick={() => setResponseType('doc')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  responseType === 'doc'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                Doc
              </button>
              <button
                onClick={() => setResponseType('reminder')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  responseType === 'reminder'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                Reminder
              </button>
              <button
                onClick={() => toast.info('Chat creation coming soon')}
                className="px-3 py-1.5 text-sm text-slate-400 hover:text-white rounded-md hover:bg-slate-700/50"
              >
                Chat
              </button>
              <button
                onClick={() => toast.info('Whiteboard coming soon')}
                className="px-3 py-1.5 text-sm text-slate-400 hover:text-white rounded-md hover:bg-slate-700/50"
              >
                Whiteboard
              </button>
              <button
                onClick={() => toast.info('Dashboard coming soon')}
                className="px-3 py-1.5 text-sm text-slate-400 hover:text-white rounded-md hover:bg-slate-700/50"
              >
                Dashboard
              </button>
              <div className="flex-1" />
              <button
                onClick={() => { setShowResponseModal(false); setEditingResponse(null); resetResponseForm(); }}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Form location badges */}
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-violet-600/20 text-violet-400 rounded-md text-xs font-medium flex items-center gap-1.5 cursor-pointer hover:bg-violet-600/30">
                  <ClipboardList className="w-3.5 h-3.5" />
                  {formName}
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </span>
                <span className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded-md text-xs text-slate-300 flex items-center gap-1.5 cursor-pointer">
                  Form Response
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </span>
              </div>

              {/* Response name - Large input */}
              <input
                type="text"
                value={editingResponse ? editingResponse.name : responseName}
                onChange={(e) => editingResponse
                  ? setEditingResponse({ ...editingResponse, name: e.target.value })
                  : setResponseName(e.target.value)
                }
                placeholder="Task name or type '/' for commands"
                className="w-full text-xl text-white bg-transparent border-none outline-none placeholder-slate-500"
                autoFocus
              />

              {/* Description buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toast.info('Description field coming soon')}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-md flex items-center gap-1.5 transition-colors"
                >
                  <AlignLeft className="w-3.5 h-3.5" /> Add description
                </button>
                <button
                  onClick={() => toast.info('AI writing assistant coming soon')}
                  className="px-3 py-1.5 text-xs text-violet-400 hover:text-violet-300 border border-violet-600/30 hover:border-violet-600/50 bg-violet-600/10 hover:bg-violet-600/20 rounded-md flex items-center gap-1.5 transition-colors"
                >
                  ✨ Write with AI
                </button>
              </div>

              {/* Action buttons row - Main controls */}
              <div className="flex items-center gap-2 flex-wrap pt-2">
                {/* Status - Prominent */}
                <div className="relative" ref={statusDropdownRef}>
                  <button
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    className="px-3 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2 hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: statusOptions.find(s => s.id === (editingResponse?.status || responseStatus))?.color }}
                  >
                    <Check className="w-4 h-4" />
                    {statusOptions.find(s => s.id === (editingResponse?.status || responseStatus))?.name || 'TO DO'}
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  {showStatusDropdown && (
                    <div className="absolute left-0 top-full mt-1 bg-[#1e1f28] border border-slate-700 rounded-lg shadow-xl z-20 w-56 py-1">
                      <div className="p-2 border-b border-slate-700">
                        <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-800 rounded">
                          <Search className="w-3.5 h-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search statuses..."
                            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                          />
                        </div>
                      </div>
                      <div className="py-1.5 text-[10px] text-slate-500 px-3 uppercase tracking-wider">Select status</div>
                      {statusOptions.map(status => (
                        <button
                          key={status.id}
                          onClick={() => {
                            if (editingResponse) {
                              setEditingResponse({ ...editingResponse, status: status.id });
                            } else {
                              setResponseStatus(status.id);
                            }
                            setShowStatusDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700 flex items-center gap-2 ${
                            (editingResponse?.status || responseStatus) === status.id ? 'text-white' : 'text-slate-300'
                          }`}
                        >
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: status.color }} />
                          {status.name}
                          {(editingResponse?.status || responseStatus) === status.id && (
                            <Check className="w-4 h-4 ml-auto text-violet-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Assignee */}
                <div className="relative" ref={assigneeDropdownRef}>
                  <button
                    onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 flex items-center gap-2"
                  >
                    {(editingResponse?.assignee_id || responseAssignee) ? (
                      <>
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-[10px] text-white font-medium">
                          {(members.find((m: any) => m.id === (editingResponse?.assignee_id || responseAssignee)) as any)?.name?.charAt(0) || '?'}
                        </div>
                        {(members.find((m: any) => m.id === (editingResponse?.assignee_id || responseAssignee)) as any)?.name || 'Assignee'}
                      </>
                    ) : (
                      <>
                        <User className="w-4 h-4" /> Assignee
                      </>
                    )}
                  </button>
                  {showAssigneeDropdown && (
                    <div className="absolute left-0 top-full mt-1 bg-[#1e1f28] border border-slate-700 rounded-lg shadow-xl z-20 w-64 py-1">
                      <div className="p-2 border-b border-slate-700">
                        <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-800 rounded">
                          <Search className="w-3.5 h-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search team members..."
                            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                          />
                        </div>
                      </div>
                      <div className="py-1.5 text-[10px] text-slate-500 px-3 uppercase tracking-wider">Workspace members</div>
                      <button
                        onClick={() => {
                          if (editingResponse) {
                            setEditingResponse({ ...editingResponse, assignee_id: null });
                          } else {
                            setResponseAssignee('');
                          }
                          setShowAssigneeDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                      >
                        <div className="w-6 h-6 rounded-full border border-dashed border-slate-600 flex items-center justify-center">
                          <User className="w-3 h-3 text-slate-500" />
                        </div>
                        Unassigned
                      </button>
                      {members.map((m: any) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            if (editingResponse) {
                              setEditingResponse({ ...editingResponse, assignee_id: m.id });
                            } else {
                              setResponseAssignee(m.id);
                            }
                            setShowAssigneeDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
                        >
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center text-[10px] text-white font-medium">
                            {m.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <span>{m.name}</span>
                          {m.email && <span className="text-xs text-slate-500 ml-auto">{m.email}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Due date */}
                <div className="relative" ref={datePickerRef}>
                  <button
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                      (editingResponse?.due_date || responseDueDate)
                        ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    {(editingResponse?.due_date || responseDueDate)
                      ? new Date(editingResponse?.due_date || responseDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : 'Due date'}
                  </button>
                  {showDatePicker && (
                    <div className="absolute left-0 top-full mt-1 bg-[#1e1f28] border border-slate-700 rounded-lg shadow-xl z-20 p-3">
                      <div className="flex flex-col gap-2">
                        <input
                          type="date"
                          value={editingResponse?.due_date?.split('T')[0] || responseDueDate}
                          onChange={(e) => {
                            if (editingResponse) {
                              setEditingResponse({ ...editingResponse, due_date: e.target.value });
                            } else {
                              setResponseDueDate(e.target.value);
                            }
                            setShowDatePicker(false);
                          }}
                          className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const today = new Date().toISOString().split('T')[0];
                              if (editingResponse) {
                                setEditingResponse({ ...editingResponse, due_date: today });
                              } else {
                                setResponseDueDate(today);
                              }
                              setShowDatePicker(false);
                            }}
                            className="flex-1 px-2 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                          >
                            Today
                          </button>
                          <button
                            onClick={() => {
                              const tomorrow = new Date();
                              tomorrow.setDate(tomorrow.getDate() + 1);
                              const tomorrowStr = tomorrow.toISOString().split('T')[0];
                              if (editingResponse) {
                                setEditingResponse({ ...editingResponse, due_date: tomorrowStr });
                              } else {
                                setResponseDueDate(tomorrowStr);
                              }
                              setShowDatePicker(false);
                            }}
                            className="flex-1 px-2 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                          >
                            Tomorrow
                          </button>
                        </div>
                        {(editingResponse?.due_date || responseDueDate) && (
                          <button
                            onClick={() => {
                              if (editingResponse) {
                                setEditingResponse({ ...editingResponse, due_date: null });
                              } else {
                                setResponseDueDate('');
                              }
                              setShowDatePicker(false);
                            }}
                            className="px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded"
                          >
                            Clear date
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Priority */}
                <div className="relative" ref={priorityDropdownRef}>
                  <button
                    onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 flex items-center gap-2"
                  >
                    <Flag
                      className="w-4 h-4"
                      style={{ color: priorityOptions.find(p => p.id === (editingResponse?.priority || responsePriority))?.color }}
                    />
                    {priorityOptions.find(p => p.id === (editingResponse?.priority || responsePriority))?.name || 'Priority'}
                  </button>
                  {showPriorityDropdown && (
                    <div className="absolute left-0 top-full mt-1 bg-[#1e1f28] border border-slate-700 rounded-lg shadow-xl z-20 w-48 py-1">
                      <div className="py-1.5 text-[10px] text-slate-500 px-3 uppercase tracking-wider">Set priority</div>
                      {priorityOptions.map(p => (
                        <button
                          key={p.id}
                          onClick={() => {
                            if (editingResponse) {
                              setEditingResponse({ ...editingResponse, priority: p.id });
                            } else {
                              setResponsePriority(p.id);
                            }
                            setShowPriorityDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700 flex items-center gap-2 ${
                            (editingResponse?.priority || responsePriority) === p.id ? 'text-white' : 'text-slate-300'
                          }`}
                        >
                          <Flag className="w-4 h-4" style={{ color: p.color }} />
                          {p.name}
                          {(editingResponse?.priority || responsePriority) === p.id && (
                            <Check className="w-4 h-4 ml-auto text-violet-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tags */}
                <button
                  onClick={() => toast.info('Tags selection coming soon')}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 flex items-center gap-2"
                >
                  <Tag className="w-4 h-4" /> Tags
                </button>

                {/* More options */}
                <button
                  onClick={() => toast.info('More options coming soon')}
                  className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-white"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>

              {/* Custom fields section */}
              <div className="pt-4 border-t border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Custom Fields</span>
                  <button
                    onClick={() => toast.info('Custom field creation coming soon')}
                    className="text-xs text-violet-400 hover:text-violet-300"
                  >
                    + Add field
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => toast.info('Time estimate field coming soon')}
                    className="px-3 py-2.5 border border-dashed border-slate-600 rounded-lg text-xs text-slate-400 hover:border-violet-500 hover:text-violet-400 flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Time estimate
                  </button>
                  <button
                    onClick={() => toast.info('Sprint points field coming soon')}
                    className="px-3 py-2.5 border border-dashed border-slate-600 rounded-lg text-xs text-slate-400 hover:border-violet-500 hover:text-violet-400 flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Sprint points
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-700 bg-slate-800/30 rounded-b-xl">
              <button
                onClick={() => toast.info('Templates coming soon')}
                className="px-3 py-1.5 text-sm text-slate-400 flex items-center gap-1.5 hover:text-white hover:bg-slate-700 rounded-md"
              >
                <FileText className="w-4 h-4" /> Templates
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowResponseModal(false); setEditingResponse(null); resetResponseForm(); }}
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (editingResponse) {
                      updateResponseMutation.mutate({
                        id: editingResponse.id,
                        data: {
                          name: editingResponse.name,
                          status: editingResponse.status,
                          assignee_id: editingResponse.assignee_id,
                          due_date: editingResponse.due_date,
                          priority: editingResponse.priority
                        }
                      });
                    } else {
                      handleCreateResponse();
                    }
                  }}
                  disabled={createResponseMutation.isPending || updateResponseMutation.isPending}
                  className="px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {(createResponseMutation.isPending || updateResponseMutation.isPending) && (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  {editingResponse ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
