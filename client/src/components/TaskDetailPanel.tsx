import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, ChevronDown, Calendar, Clock, Flag, Tag, Users,
  FileText, Paperclip, Plus, Check, MoreHorizontal,
  Bell, Trash2, Send, ChevronRight,
  Circle, Search, SlidersHorizontal,
  Share2, Star, Maximize2, ChevronUp, Timer, GitBranch,
  AtSign, Smile, Link, Hash, PlayCircle, GripVertical, Play, HelpCircle,
  Pencil, UserPlus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { tasksApi, commentsApi, membersApi } from '../services/api';
import type { Task, TaskStatus, TaskPriority, Comment, UpdateTaskInput } from '../types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
}

interface StatusConfig {
  name: string;
  color: string;
  bgColor: string;
}

interface TaskDetailPanelProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  statuses: StatusConfig[];
  onTaskUpdated?: () => void;
  spaceName?: string;
  folderName?: string;
  allTasks?: Task[];
  onNavigateTask?: (task: Task) => void;
}

const priorities: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'LOW', label: 'Low', color: '#9ca3af' },
  { value: 'MEDIUM', label: 'Normal', color: '#9ca3af' },
  { value: 'HIGH', label: 'High', color: '#f97316' },
  { value: 'URGENT', label: 'Urgent', color: '#ef4444' }
];

export default function TaskDetailPanel({
  task,
  isOpen,
  onClose,
  statuses,
  onTaskUpdated,
  spaceName = 'Products',
  folderName = 'Workflow',
  allTasks = [],
  onNavigateTask
}: TaskDetailPanelProps) {
  const queryClient = useQueryClient();
  const { canEdit } = useAuth();

  const [taskName, setTaskName] = useState(task.name);
  const [isStarred, setIsStarred] = useState(false);
  const [taskDescription, setTaskDescription] = useState(task.description || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'subtasks' | 'activity'>('details');
  const [newComment, setNewComment] = useState('');
  const [estimatedHours, setEstimatedHours] = useState(task.estimated_hours?.toString() || '');
  const [tagsInput, setTagsInput] = useState('');
  const [showTagsInput, setShowTagsInput] = useState(false);

  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState('');
  const [showTimeTrackingModal, setShowTimeTrackingModal] = useState(false);
  const [showTimeEstimatePopup, setShowTimeEstimatePopup] = useState(false);
  const [timeTrackInput, setTimeTrackInput] = useState('');
  const [timeTrackNotes, setTimeTrackNotes] = useState('');
  const [trackedTime, setTrackedTime] = useState(0);
  const [showTaskTypeDropdown, setShowTaskTypeDropdown] = useState(false);
  const [selectedTaskType, setSelectedTaskType] = useState(task.task_type || 'Task');
  const [checklists, setChecklists] = useState<{ id: string; name: string; items: { id: string; text: string; checked: boolean }[] }[]>(task.checklists || []);
  const [isEditingSprintPoints, setIsEditingSprintPoints] = useState(false);
  const [sprintPointsInput, setSprintPointsInput] = useState(task.sprint_points?.toString() || '');

  // Refs for click outside detection
  const priorityRef = useRef<HTMLDivElement>(null);
  const timeEstimateRef = useRef<HTMLDivElement>(null);

  // Debounce timer refs for auto-save
  const estimateDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setTaskName(task.name);
    setTaskDescription(task.description || '');
    setEstimatedHours(task.estimated_hours?.toString() || '');
    setSelectedTaskType(task.task_type || 'Task');
    setTrackedTime(task.tracked_time || 0);
    setChecklists(task.checklists || []);
    setAssigneeSearchQuery('');
    setSprintPointsInput(task.sprint_points?.toString() || '');
    setIsEditingSprintPoints(false);
  }, [task]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown]')) {
        setShowStatusDropdown(false);
        setShowPriorityDropdown(false);
        setShowTimeEstimatePopup(false);
        setShowTaskTypeDropdown(false);
        setShowAssigneeDropdown(false);
      }
    };

    if (showStatusDropdown || showPriorityDropdown || showTimeEstimatePopup || showTaskTypeDropdown || showAssigneeDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showStatusDropdown, showPriorityDropdown, showTimeEstimatePopup, showTaskTypeDropdown, showAssigneeDropdown]);

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', task.id],
    queryFn: () => commentsApi.getByTask(task.id),
    enabled: isOpen
  });

  // Fetch all team members for assignee selection
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ['members'],
    queryFn: membersApi.getAll,
    enabled: isOpen
  });

  const updateTaskMutation = useMutation({
    mutationFn: (data: UpdateTaskInput) => tasksApi.update(task.id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onTaskUpdated?.();
      // Show success toast for the updated field
      if (variables.status) toast.success(`Status updated to ${variables.status}`);
      else if (variables.priority) toast.success(`Priority updated to ${variables.priority}`);
      else if (variables.assignees !== undefined) {
        const assigneeCount = variables.assignees?.length || 0;
        if (assigneeCount === 0) toast.success('Assignees cleared');
        else toast.success(`Assigned to ${assigneeCount} member${assigneeCount > 1 ? 's' : ''}`);
      }
      else if (variables.assignee_name !== undefined) toast.success(variables.assignee_name ? `Assigned to ${variables.assignee_name}` : 'Assignee removed');
      else if (variables.due_date !== undefined) toast.success(variables.due_date ? `Due date set to ${new Date(variables.due_date).toLocaleDateString()}` : 'Due date removed');
      else if (variables.start_date !== undefined) toast.success(variables.start_date ? `Start date set to ${new Date(variables.start_date).toLocaleDateString()}` : 'Start date removed');
      else if (variables.estimated_hours !== undefined) toast.success(`Time estimate updated`);
      else if (variables.tags !== undefined) toast.success('Tags updated');
      else if (variables.name) toast.success('Task name updated');
      else if (variables.description !== undefined) toast.success('Description updated');
      else if (variables.task_type) toast.success(`Task type changed to ${variables.task_type}`);
      else if (variables.tracked_time !== undefined) toast.success('Time tracking updated');
      else if (variables.checklists !== undefined) toast.success('Checklist updated');
      else if (variables.sprint_points !== undefined) toast.success('Sprint points updated');
    },
    onError: (err: Error) => toast.error(`Failed to save: ${err.message}`)
  });

  const deleteTaskMutation = useMutation({
    mutationFn: () => tasksApi.delete(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task deleted');
      onClose();
    }
  });

  const createCommentMutation = useMutation({
    mutationFn: (content: string) => commentsApi.create(task.id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', task.id] });
      setNewComment('');
    }
  });

  const handleNameSave = () => {
    if (taskName.trim() && taskName !== task.name) {
      updateTaskMutation.mutate({ name: taskName });
    }
    setIsEditingName(false);
  };

  const handleDescriptionSave = () => {
    if (taskDescription !== task.description) {
      updateTaskMutation.mutate({ description: taskDescription || undefined });
    }
    setIsEditingDescription(false);
  };

  const handleStatusChange = (status: string) => {
    updateTaskMutation.mutate({ status: status as TaskStatus });
    setShowStatusDropdown(false);
  };

  const handlePriorityChange = (priority: TaskPriority) => {
    updateTaskMutation.mutate({ priority });
    setShowPriorityDropdown(false);
  };

  // Toggle assignee for multi-select
  const handleAssigneeToggle = (member: Member) => {
    const currentAssignees = task.assignees || [];
    const isSelected = currentAssignees.includes(member.name);
    const newAssignees = isSelected
      ? currentAssignees.filter(a => a !== member.name)
      : [...currentAssignees, member.name];

    updateTaskMutation.mutate({
      assignees: newAssignees,
      assignee_name: newAssignees.length > 0 ? newAssignees[0] : null
    });
  };

  // Clear all assignees
  const handleClearAssignees = () => {
    updateTaskMutation.mutate({ assignees: [], assignee_name: null });
  };

  // Filter members based on search
  const filteredMembers = members.filter((m: Member) =>
    m.name.toLowerCase().includes(assigneeSearchQuery.toLowerCase()) ||
    m.email.toLowerCase().includes(assigneeSearchQuery.toLowerCase())
  );

  const handleDueDateChange = (date: string) => {
    updateTaskMutation.mutate({ due_date: date || undefined });
  };

  const handleStartDateChange = (date: string) => {
    updateTaskMutation.mutate({ start_date: date || undefined });
  };

  // Parse time string like "3h 20m", "2.5h", "30m", or just numbers
  const parseTimeInput = (input: string): number | null => {
    if (!input.trim()) return null;

    // Try to match formats like "3h 20m", "3h", "20m", "3.5"
    const hourMinMatch = input.match(/(\d+(?:\.\d+)?)\s*h(?:ours?)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?/i);
    const minOnlyMatch = input.match(/^(\d+)\s*m(?:in(?:utes?)?)?$/i);
    const numOnlyMatch = input.match(/^(\d+(?:\.\d+)?)$/);

    if (hourMinMatch) {
      const hours = parseFloat(hourMinMatch[1]) || 0;
      const minutes = parseInt(hourMinMatch[2]) || 0;
      return hours + minutes / 60;
    } else if (minOnlyMatch) {
      return parseInt(minOnlyMatch[1]) / 60;
    } else if (numOnlyMatch) {
      return parseFloat(numOnlyMatch[1]);
    }
    return null;
  };

  // Format time display (convert hours to "Xh Ym" format)
  const formatTimeDisplay = (value: string): string => {
    if (!value) return 'Empty';

    const hours = parseTimeInput(value);
    if (hours === null || hours <= 0) return value || 'Empty';

    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);

    if (wholeHours === 0) return `${minutes}m`;
    if (minutes === 0) return `${wholeHours}h`;
    return `${wholeHours}h ${minutes}m`;
  };

  const handleEstimatedHoursChange = (value: string) => {
    setEstimatedHours(value);

    // Clear existing debounce timer
    if (estimateDebounceRef.current) {
      clearTimeout(estimateDebounceRef.current);
    }

    // Debounce the save - auto-save after 800ms of no typing
    estimateDebounceRef.current = setTimeout(() => {
      const hours = parseTimeInput(value);
      if (hours !== null && hours > 0) {
        updateTaskMutation.mutate({ estimated_hours: hours });
      } else if (value === '' || value === '0') {
        // Clear the estimate
        updateTaskMutation.mutate({ estimated_hours: undefined });
      }
    }, 800);
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (estimateDebounceRef.current) {
        clearTimeout(estimateDebounceRef.current);
      }
    };
  }, []);

  const handleAddTag = () => {
    if (tagsInput.trim()) {
      const newTags = [...(task.tags || []), tagsInput.trim()];
      updateTaskMutation.mutate({ tags: newTags });
      setTagsInput('');
      setShowTagsInput(false);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = (task.tags || []).filter(tag => tag !== tagToRemove);
    updateTaskMutation.mutate({ tags: newTags });
  };

  const handleCommentSubmit = () => {
    if (newComment.trim()) {
      createCommentMutation.mutate(newComment.trim());
    }
  };

  // Navigation functions
  const currentTaskIndex = allTasks.findIndex(t => t.id === task.id);

  const handleNavigatePrev = () => {
    if (currentTaskIndex > 0 && onNavigateTask) {
      onNavigateTask(allTasks[currentTaskIndex - 1]);
    } else {
      toast.info('No previous task');
    }
  };

  const handleNavigateNext = () => {
    if (currentTaskIndex < allTasks.length - 1 && onNavigateTask) {
      onNavigateTask(allTasks[currentTaskIndex + 1]);
    } else {
      toast.info('No next task');
    }
  };

  // Handler for time tracking - saves to database
  const handleSaveTimeTracking = () => {
    // Parse time input like "3h 20m" or "2.5"
    const timeMatch = timeTrackInput.match(/(\d+)\s*h?\s*(\d*)\s*m?/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]) || 0;
      const minutes = parseInt(timeMatch[2]) || 0;
      const totalMinutes = hours * 60 + minutes;
      const newTrackedTime = trackedTime + totalMinutes;
      setTrackedTime(newTrackedTime);
      updateTaskMutation.mutate({ tracked_time: newTrackedTime });
      setTimeTrackInput('');
      setTimeTrackNotes('');
      setShowTimeTrackingModal(false);
    } else if (timeTrackInput) {
      const hours = parseFloat(timeTrackInput);
      if (!isNaN(hours)) {
        const totalMinutes = Math.round(hours * 60);
        const newTrackedTime = trackedTime + totalMinutes;
        setTrackedTime(newTrackedTime);
        updateTaskMutation.mutate({ tracked_time: newTrackedTime });
        setTimeTrackInput('');
        setTimeTrackNotes('');
        setShowTimeTrackingModal(false);
      }
    }
  };

  // Handlers
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href + '?task=' + task.id);
    toast.success('Task link copied to clipboard!');
  };
  const handleMaximize = () => toast.info('Full screen mode coming soon!');
  const handleRelationships = () => toast.info('Task relationships coming soon!');
  const handleCreateField = () => toast.info('Custom fields coming soon!');
  const handleAttachment = () => toast.info('File attachments coming soon!');
  const handleAddSubtask = () => toast.info('Subtasks coming soon!');
  const handleActivitySearch = () => toast.info('Activity search coming soon!');
  const handleNotifications = () => toast.info('Notification settings coming soon!');
  const handleActivitySort = () => toast.info('Activity sorting coming soon!');
  const handleEmoji = () => toast.info('Emoji picker coming soon!');
  const handleMention = () => toast.info('@mentions coming soon!');
  const handleCommentAttach = () => toast.info('Comment attachments coming soon!');
  const handleAddLink = () => toast.info('Link insertion coming soon!');
  const handleHashtag = () => toast.info('Hashtags coming soon!');
  const handleMoreOptions = () => toast.info('More options coming soon!');
  const handleToggleStar = () => {
    setIsStarred(!isStarred);
    toast.success(isStarred ? 'Removed from favorites' : 'Added to favorites');
  };

  // Task Type handler
  const handleTaskTypeChange = (type: string) => {
    setSelectedTaskType(type);
    setShowTaskTypeDropdown(false);
    updateTaskMutation.mutate({ task_type: type });
  };

  // Checklist handlers - all save to database
  const handleAddChecklist = () => {
    const newChecklist = {
      id: `checklist-${Date.now()}`,
      name: 'Checklist',
      items: []
    };
    const updatedChecklists = [...checklists, newChecklist];
    setChecklists(updatedChecklists);
    updateTaskMutation.mutate({ checklists: updatedChecklists });
  };

  const handleAddChecklistItem = (checklistId: string, text: string) => {
    if (!text.trim()) return;
    const updatedChecklists = checklists.map(cl => {
      if (cl.id === checklistId) {
        return {
          ...cl,
          items: [...cl.items, { id: `item-${Date.now()}`, text: text.trim(), checked: false }]
        };
      }
      return cl;
    });
    setChecklists(updatedChecklists);
    updateTaskMutation.mutate({ checklists: updatedChecklists });
  };

  const handleToggleChecklistItem = (checklistId: string, itemId: string) => {
    const updatedChecklists = checklists.map(cl => {
      if (cl.id === checklistId) {
        return {
          ...cl,
          items: cl.items.map(item =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
          )
        };
      }
      return cl;
    });
    setChecklists(updatedChecklists);
    updateTaskMutation.mutate({ checklists: updatedChecklists });
  };

  const handleDeleteChecklistItem = (checklistId: string, itemId: string) => {
    const updatedChecklists = checklists.map(cl => {
      if (cl.id === checklistId) {
        return {
          ...cl,
          items: cl.items.filter(item => item.id !== itemId)
        };
      }
      return cl;
    });
    setChecklists(updatedChecklists);
    updateTaskMutation.mutate({ checklists: updatedChecklists });
  };

  const handleDeleteChecklist = (checklistId: string) => {
    const updatedChecklists = checklists.filter(cl => cl.id !== checklistId);
    setChecklists(updatedChecklists);
    updateTaskMutation.mutate({ checklists: updatedChecklists });
  };

  const currentStatus = statuses.find(s => s.name === task.status);
  const currentPriority = priorities.find(p => p.value === task.priority);

  const formatDateShort = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(-2)}`;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full bg-gray-50 dark:bg-[#0f1012] z-50 flex w-full max-w-[1100px] shadow-2xl animate-in slide-in-from-right duration-200">

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200 dark:border-[#1f2229]">

          {/* Top Header Bar */}
          <div className="flex items-center justify-between h-12 px-4 border-b border-gray-200 dark:border-[#1f2229] bg-gray-50 dark:bg-[#0f1012] flex-shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={handleNavigatePrev}
                className="p-1 text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded"
                title="Previous task"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={handleNavigateNext}
                className="p-1 text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded"
                title="Next task"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1 ml-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="text-green-500">■</span>
                <span>{spaceName}</span>
                <ChevronRight className="w-3 h-3 text-gray-600" />
                <span>📁</span>
                <span>{folderName}</span>
                <ChevronRight className="w-3 h-3 text-gray-600" />
                <span>≡</span>
                <span>{folderName}</span>
                <Plus className="w-3 h-3 ml-1 text-gray-600" />
              </div>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500 mr-2">
                Created {new Date(task.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <button
                onClick={handleShare}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded"
              >
                <Share2 className="w-3 h-3" /> Share
              </button>
              <button
                onClick={handleMoreOptions}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              <button
                onClick={handleToggleStar}
                className={cn(
                  "p-1.5 hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded",
                  isStarred ? "text-yellow-400" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                <Star className={cn("w-4 h-4", isStarred && "fill-yellow-400")} />
              </button>
              <button
                onClick={handleMaximize}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 max-w-3xl">

              {/* Task Type & ID Row */}
              <div className="flex items-center gap-2 mb-4">
                <div className="relative" data-dropdown>
                  <button
                    onClick={() => canEdit && setShowTaskTypeDropdown(!showTaskTypeDropdown)}
                    className={cn("flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-[#2e2f3a] rounded text-sm text-gray-600 dark:text-gray-300", canEdit && "hover:bg-gray-200 dark:hover:bg-[#3e3f4a]", !canEdit && "cursor-default")}
                  >
                    <Circle className="w-3 h-3 text-teal-400 fill-teal-400" />
                    <span>{selectedTaskType}</span>
                    {canEdit && <ChevronDown className="w-3 h-3 text-gray-500" />}
                  </button>
                  {showTaskTypeDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#2e2f3a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 py-2 min-w-[220px]" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between px-3 pb-2 border-b border-gray-200 dark:border-[#1f2229]">
                        <span className="text-xs text-gray-500 font-medium">Task Types</span>
                        <button className="text-xs text-purple-400 hover:text-purple-300">Edit</button>
                      </div>
                      {/* Default types */}
                      <div className="py-1">
                        <button
                          onClick={() => handleTaskTypeChange('Task')}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#3e3f4a]"
                        >
                          <Circle className="w-4 h-4 text-teal-400" fill="#2dd4bf" />
                          <span className="text-gray-900 dark:text-white flex-1 text-left">Task</span>
                          <span className="text-xs text-gray-500">(default)</span>
                          {selectedTaskType === 'Task' && <Check className="w-4 h-4 text-purple-400" />}
                        </button>
                        <button
                          onClick={() => handleTaskTypeChange('Milestone')}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#3e3f4a]"
                        >
                          <div className="w-4 h-4 rotate-45 border-2 border-amber-400 bg-amber-400/20" />
                          <span className="text-gray-900 dark:text-white flex-1 text-left">Milestone</span>
                          {selectedTaskType === 'Milestone' && <Check className="w-4 h-4 text-purple-400" />}
                        </button>
                        <button
                          onClick={() => handleTaskTypeChange('Form Response')}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#3e3f4a]"
                        >
                          <FileText className="w-4 h-4 text-blue-400" />
                          <span className="text-gray-900 dark:text-white flex-1 text-left">Form Response</span>
                          {selectedTaskType === 'Form Response' && <Check className="w-4 h-4 text-purple-400" />}
                        </button>
                        <button
                          onClick={() => handleTaskTypeChange('Meeting Note')}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#3e3f4a]"
                        >
                          <FileText className="w-4 h-4 text-purple-400" />
                          <span className="text-gray-900 dark:text-white flex-1 text-left">Meeting Note</span>
                          {selectedTaskType === 'Meeting Note' && <Check className="w-4 h-4 text-purple-400" />}
                        </button>
                      </div>

                      {/* Recommended section */}
                      <div className="border-t border-gray-200 dark:border-[#1f2229] pt-1">
                        <div className="flex items-center gap-2 px-3 py-1">
                          <span className="text-xs text-gray-500 font-medium">Recommended</span>
                          <HelpCircle className="w-3 h-3 text-gray-500" />
                        </div>
                        {[
                          { name: 'Asset', icon: '📦' },
                          { name: 'Initiative', icon: '🎯' },
                          { name: 'Lead', icon: '👤' },
                          { name: 'Person', icon: '👤' },
                          { name: 'Project', icon: '📋' }
                        ].map(type => (
                          <button
                            key={type.name}
                            onClick={() => handleTaskTypeChange(type.name)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#3e3f4a] group"
                          >
                            <span className="text-base">{type.icon}</span>
                            <span className="text-gray-900 dark:text-white flex-1 text-left">{type.name}</span>
                            <Plus className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100" />
                          </button>
                        ))}
                      </div>

                      {/* Create Task Type */}
                      <div className="border-t border-gray-200 dark:border-[#1f2229] pt-1 mt-1">
                        <button
                          onClick={() => { setShowTaskTypeDropdown(false); toast.info('Create Task Type coming soon!'); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-[#3e3f4a]"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Create Task Type</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-500">{task.id.slice(0, 8)}</span>
              </div>

              {/* Task Title */}
              {isEditingName && canEdit ? (
                <input
                  type="text"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  onBlur={handleNameSave}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleNameSave();
                    if (e.key === 'Escape') { setTaskName(task.name); setIsEditingName(false); }
                  }}
                  className="text-[28px] font-semibold text-gray-900 dark:text-white bg-transparent outline-none w-full mb-4 border-b-2 border-purple-500"
                  autoFocus
                />
              ) : (
                <h1
                  onClick={() => canEdit && setIsEditingName(true)}
                  className={cn("text-[28px] font-semibold text-gray-900 dark:text-white mb-4", canEdit && "cursor-text hover:text-gray-700 dark:hover:text-gray-200")}
                >
                  {task.name}
                </h1>
              )}

              {/* AI Suggestion Bar */}
              {/* Properties Section */}
              <div className="space-y-3 mb-6">

                {/* Row 1: Status | Assignees */}
                <div className="grid grid-cols-2 gap-x-8">
                  <div className="flex items-center py-1 hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded px-2 -mx-2 cursor-pointer" data-dropdown>
                    <div className="flex items-center gap-2 w-24 text-gray-500 dark:text-white">
                      <Circle className="w-4 h-4" />
                      <span className="text-sm">Status</span>
                    </div>
                    <div className="relative flex items-center gap-2">
                      <button
                        onClick={() => canEdit && setShowStatusDropdown(!showStatusDropdown)}
                        className={cn("flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wide", !canEdit && "opacity-70 cursor-default")}
                        style={{ backgroundColor: currentStatus?.bgColor || '#4b5563', color: '#fff' }}
                      >
                        {task.status}
                        {canEdit && <ChevronDown className="w-3 h-3" />}
                      </button>
                      {canEdit && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStatusChange('Done'); }}
                          className="p-0.5 text-gray-500 hover:text-green-400"
                          title="Mark as Done"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      {showStatusDropdown && (
                        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#2e2f3a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 py-1 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                          {/* Status options */}
                          {statuses.map(s => (
                            <button
                              key={s.name}
                              onClick={() => handleStatusChange(s.name)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#3e3f4a] group"
                            >
                              <GripVertical className="w-3 h-3 text-gray-600 opacity-0 group-hover:opacity-100" />
                              <Circle className="w-4 h-4" style={{ color: s.bgColor }} fill={s.bgColor} />
                              <span className="text-gray-900 dark:text-white flex-1 text-left">{s.name}</span>
                              {task.status === s.name && <Check className="w-3 h-3 text-purple-400" />}
                              <MoreHorizontal className="w-3 h-3 text-gray-500 opacity-0 group-hover:opacity-100" />
                            </button>
                          ))}
                          <div className="border-t border-gray-200 dark:border-[#1f2229] mt-1 pt-1">
                            <button
                              onClick={() => { setShowStatusDropdown(false); setShowStatusModal(true); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#3e3f4a] hover:text-gray-900 dark:hover:text-white"
                            >
                              <Plus className="w-4 h-4" />
                              <span>Add status</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center py-1 hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded px-2 -mx-2 cursor-pointer relative" data-dropdown>
                    <div className="flex items-center gap-2 w-24 text-gray-500 dark:text-white">
                      <Users className="w-4 h-4" />
                      <span className="text-sm">Assignees</span>
                    </div>
                    <button
                      onClick={() => canEdit && setShowAssigneeDropdown(!showAssigneeDropdown)}
                      className={cn("flex items-center gap-2", !canEdit && "cursor-default")}
                    >
                      {(task.assignees && task.assignees.length > 0) ? (
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2">
                            {task.assignees.slice(0, 3).map((assigneeName, idx) => {
                              const colors = ['bg-violet-500', 'bg-pink-500', 'bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-cyan-500'];
                              const colorIndex = assigneeName.charCodeAt(0) % colors.length;
                              return (
                                <Avatar key={idx} className="w-6 h-6 border-2 border-gray-50 dark:border-[#0f1012]">
                                  <AvatarFallback className={cn("text-white text-[10px] font-bold", colors[colorIndex])}>
                                    {assigneeName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                              );
                            })}
                            {task.assignees.length > 3 && (
                              <div className="w-6 h-6 rounded-full bg-slate-600 border-2 border-gray-50 dark:border-[#0f1012] flex items-center justify-center">
                                <span className="text-[9px] text-white font-medium">+{task.assignees.length - 3}</span>
                              </div>
                            )}
                          </div>
                          <span className="text-sm text-gray-900 dark:text-white">
                            {task.assignees.length === 1 ? task.assignees[0] : `${task.assignees.length} assignees`}
                          </span>
                        </div>
                      ) : task.assignee_name ? (
                        <>
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="bg-pink-500 text-white text-[10px] font-bold">
                              {task.assignee_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-gray-900 dark:text-white">{task.assignee_name}</span>
                        </>
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-slate-400">Empty</span>
                      )}
                    </button>

                    {/* Assignee Dropdown - Multi-select */}
                    {showAssigneeDropdown && (
                      <div
                        className="absolute top-full left-0 mt-1 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-xl shadow-2xl z-50 w-72 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Search */}
                        <div className="p-3 border-b border-gray-200 dark:border-[#1f2229]">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                              type="text"
                              value={assigneeSearchQuery}
                              onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                              placeholder="Search team members..."
                              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#2e2f3a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                              autoFocus
                            />
                          </div>
                        </div>

                        {/* Members List */}
                        <div className="max-h-64 overflow-y-auto py-2">
                          {/* Clear all option */}
                          {(task.assignees && task.assignees.length > 0) && (
                            <button
                              onClick={handleClearAssignees}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white dark:hover:bg-[#2e2f3a] transition-colors border-b border-gray-200 dark:border-[#1f2229]"
                            >
                              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                                <X className="w-4 h-4 text-gray-400" />
                              </div>
                              <span className="text-gray-400">Clear all assignees</span>
                            </button>
                          )}

                          {/* Team members - Multi-select with checkboxes */}
                          {filteredMembers.length > 0 ? (
                            filteredMembers.map((member: Member) => {
                              const currentAssignees = task.assignees || [];
                              const isSelected = currentAssignees.includes(member.name);
                              const colors = ['bg-violet-500', 'bg-pink-500', 'bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-cyan-500'];
                              const colorIndex = member.name.charCodeAt(0) % colors.length;

                              return (
                                <button
                                  key={member.id}
                                  onClick={() => handleAssigneeToggle(member)}
                                  className={cn(
                                    "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                                    isSelected ? "bg-purple-500/20" : "hover:bg-white dark:hover:bg-[#2e2f3a]"
                                  )}
                                >
                                  {/* Checkbox */}
                                  <div className={cn(
                                    "w-5 h-5 rounded border flex items-center justify-center flex-shrink-0",
                                    isSelected ? "bg-purple-500 border-purple-500" : "border-gray-500"
                                  )}>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                  </div>
                                  <Avatar className="w-8 h-8">
                                    <AvatarFallback className={cn("text-white text-xs font-bold", colors[colorIndex])}>
                                      {member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 text-left">
                                    <p className={cn("font-medium", isSelected ? "text-purple-300" : "text-gray-900 dark:text-white")}>
                                      {member.name}
                                    </p>
                                    <p className="text-xs text-gray-500">{member.email}</p>
                                  </div>
                                </button>
                              );
                            })
                          ) : (
                            <div className="px-4 py-6 text-center">
                              <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                              <p className="text-sm text-gray-500">No members found</p>
                            </div>
                          )}
                        </div>

                        {/* Footer */}
                        <div className="px-3 py-2 border-t border-gray-200 dark:border-[#1f2229]">
                          <p className="text-xs text-gray-500 text-center">
                            {(task.assignees?.length || 0) > 0
                              ? `${task.assignees?.length} selected · ${members.length} total members`
                              : `${members.length} team member${members.length !== 1 ? 's' : ''}`
                            }
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 2: Dates | Priority */}
                <div className="grid grid-cols-2 gap-x-8">
                  <div className="flex items-center py-1 hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded px-2 -mx-2">
                    <div className="flex items-center gap-2 w-24 text-gray-500 dark:text-white">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Dates</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <button
                        onClick={() => canEdit && (document.getElementById('start-date-input') as HTMLInputElement)?.showPicker?.()}
                        className={cn("flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-[#2e2f3a] rounded text-gray-500 dark:text-slate-300", canEdit && "hover:bg-gray-200 dark:hover:bg-[#3e3f4a] hover:text-gray-900 dark:hover:text-white", !canEdit && "cursor-default")}
                      >
                        <Calendar className="w-3 h-3" />
                        <span>{task.start_date ? new Date(task.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Start'}</span>
                      </button>
                      <input
                        id="start-date-input"
                        type="date"
                        value={task.start_date?.split('T')[0] || ''}
                        onChange={(e) => handleStartDateChange(e.target.value)}
                        className="sr-only"
                        disabled={!canEdit}
                      />
                      <span className="text-gray-600 dark:text-slate-400">→</span>
                      <button
                        onClick={() => canEdit && (document.getElementById('due-date-input') as HTMLInputElement)?.showPicker?.()}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-[#2e2f3a] rounded",
                          task.due_date ? "text-pink-400" : "text-gray-500 dark:text-slate-300",
                          canEdit && "hover:bg-gray-200 dark:hover:bg-[#3e3f4a]",
                          !canEdit && "cursor-default"
                        )}
                      >
                        <Calendar className="w-3 h-3" />
                        <span>{task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Due'}</span>
                      </button>
                      <input
                        id="due-date-input"
                        type="date"
                        value={task.due_date?.split('T')[0] || ''}
                        onChange={(e) => handleDueDateChange(e.target.value)}
                        className="sr-only"
                        disabled={!canEdit}
                      />
                    </div>
                  </div>

                  <div className="flex items-center py-1 hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded px-2 -mx-2 cursor-pointer" data-dropdown ref={priorityRef}>
                    <div className="flex items-center gap-2 w-24 text-gray-500 dark:text-white">
                      <Flag className="w-4 h-4" />
                      <span className="text-sm">Priority</span>
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => canEdit && setShowPriorityDropdown(!showPriorityDropdown)}
                        className={cn("flex items-center gap-1 text-sm text-gray-500 dark:text-slate-300", canEdit && "hover:text-gray-900 dark:hover:text-white", !canEdit && "cursor-default")}
                      >
                        {currentPriority ? (
                          <>
                            <Flag className="w-3.5 h-3.5" style={{ color: currentPriority.color }} fill={currentPriority.value === 'URGENT' ? currentPriority.color : 'none'} />
                            <span style={{ color: currentPriority.color }}>{currentPriority.label}</span>
                          </>
                        ) : (
                          <span className="text-gray-500">Empty</span>
                        )}
                      </button>
                      {showPriorityDropdown && (
                        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#2e2f3a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 py-2 min-w-[180px]" onClick={(e) => e.stopPropagation()}>
                          <div className="px-3 py-1 text-xs text-gray-500 font-medium">Task Priority</div>
                          {priorities.map(p => (
                            <button
                              key={p.value}
                              onClick={() => handlePriorityChange(p.value)}
                              className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#3e3f4a]"
                            >
                              <Flag
                                className="w-4 h-4"
                                style={{ color: p.color }}
                                fill={p.value === 'URGENT' || p.value === 'HIGH' ? p.color : 'none'}
                              />
                              <span className="text-gray-900 dark:text-white">{p.label}</span>
                              {task.priority === p.value && <Check className="w-4 h-4 ml-auto text-purple-400" />}
                            </button>
                          ))}
                          <div className="px-3 py-2 border-t border-gray-200 dark:border-[#1f2229] mt-2">
                            <div className="text-xs text-gray-500 mb-2">Add to Personal Priorities</div>
                            <div className="flex gap-1">
                              {['TC', 'CM', 'AK', 'AS'].map((initials, i) => (
                                <Avatar key={i} className="w-6 h-6 cursor-pointer hover:ring-2 hover:ring-purple-500">
                                  <AvatarFallback className="text-[10px] text-white" style={{ backgroundColor: ['#0ea5e9', '#ec4899', '#8b5cf6', '#22c55e'][i] }}>
                                    {initials}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                              <button className="w-6 h-6 rounded-full border border-dashed border-gray-500 flex items-center justify-center hover:border-purple-500">
                                <Users className="w-3 h-3 text-gray-500" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 3: Time Estimate | Track Time */}
                <div className="grid grid-cols-2 gap-x-8">
                  <div className="flex items-center py-1 hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded px-2 -mx-2 cursor-pointer relative" data-dropdown ref={timeEstimateRef}>
                    <div className="flex items-center gap-2 w-24 text-gray-500 dark:text-white">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">Time Estimate</span>
                    </div>
                    <button
                      onClick={() => canEdit && setShowTimeEstimatePopup(!showTimeEstimatePopup)}
                      className={cn("text-sm text-gray-500 dark:text-slate-400", canEdit && "hover:text-gray-900 dark:hover:text-white", !canEdit && "cursor-default")}
                    >
                      {formatTimeDisplay(estimatedHours)}
                    </button>
                    {showTimeEstimatePopup && (
                      <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#2e2f3a] border border-gray-200 dark:border-[#1f2229] rounded-lg shadow-xl z-50 p-3 min-w-[250px]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm text-gray-900 dark:text-white">Time Estimate</span>
                          <HelpCircle className="w-3 h-3 text-gray-500" />
                        </div>
                        <input
                          type="text"
                          value={estimatedHours}
                          onChange={(e) => handleEstimatedHoursChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setShowTimeEstimatePopup(false);
                            }
                            if (e.key === 'Escape') {
                              setShowTimeEstimatePopup(false);
                            }
                          }}
                          placeholder="Type in time (e.g. 3h 30m, 2.5h, 45m)"
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0f1012] border border-gray-200 dark:border-[#1f2229] rounded text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                          autoFocus
                        />
                        <p className="text-xs text-gray-500 mt-2">Changes are automatically saved</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center py-1 hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded px-2 -mx-2 cursor-pointer relative">
                    <div className="flex items-center gap-2 w-24 text-gray-500 dark:text-white">
                      <Timer className="w-4 h-4" />
                      <span className="text-sm">Track Time</span>
                    </div>
                    <button
                      onClick={() => canEdit && setShowTimeTrackingModal(true)}
                      className={cn("flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400", canEdit && "hover:text-purple-400", !canEdit && "cursor-default")}
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{trackedTime > 0 ? `${Math.floor(trackedTime / 60)}h ${trackedTime % 60}m` : canEdit ? 'Add time' : 'No time'}</span>
                    </button>
                  </div>
                </div>

                {/* Row 4: Tags | Relationships */}
                <div className="grid grid-cols-2 gap-x-8">
                  <div className={cn("flex items-center py-1 rounded px-2 -mx-2", canEdit && "hover:bg-gray-100 dark:hover:bg-[#2e2f3a] cursor-pointer")} onClick={() => canEdit && !showTagsInput && setShowTagsInput(true)}>
                    <div className="flex items-center gap-2 w-24 text-gray-500 dark:text-white">
                      <Tag className="w-4 h-4" />
                      <span className="text-sm">Tags</span>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {task.tags && task.tags.length > 0 ? (
                        <>
                          {task.tags.map((tag, i) => (
                            <span
                              key={i}
                              onClick={() => canEdit && handleRemoveTag(tag)}
                              className={cn("px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded flex items-center gap-1 group", canEdit && "cursor-pointer hover:bg-purple-500/30")}
                            >
                              {tag}
                              {canEdit && <X className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100" />}
                            </span>
                          ))}
                          {canEdit && (
                            <button onClick={() => setShowTagsInput(true)} className="text-gray-500 hover:text-purple-400">
                              <Plus className="w-3 h-3" />
                            </button>
                          )}
                        </>
                      ) : (showTagsInput && canEdit) ? (
                        <input
                          type="text"
                          value={tagsInput}
                          onChange={(e) => setTagsInput(e.target.value)}
                          onBlur={() => tagsInput.trim() ? handleAddTag() : setShowTagsInput(false)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); if (e.key === 'Escape') setShowTagsInput(false); }}
                          placeholder="Enter tag..."
                          className="px-2 py-1 bg-gray-50 dark:bg-[#0f1012] border border-purple-500 rounded text-sm text-gray-900 dark:text-white w-28 focus:outline-none"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-slate-400">Empty</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center py-1 hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded px-2 -mx-2 cursor-pointer" onClick={handleRelationships}>
                    <div className="flex items-center gap-2 w-24 text-gray-500 dark:text-white">
                      <GitBranch className="w-4 h-4" />
                      <span className="text-sm">Relationships</span>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-slate-400">Empty</span>
                  </div>
                </div>

                {/* Row 5: Sprint Points (shown when task is in a sprint) */}
                {task.sprint_id && (
                  <div className="grid grid-cols-2 gap-x-8">
                    <div className="flex items-center py-1 hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded px-2 -mx-2 cursor-pointer relative">
                      <div className="flex items-center gap-2 w-24 text-gray-500 dark:text-white">
                        <Hash className="w-4 h-4" />
                        <span className="text-sm">Sprint Pts</span>
                      </div>
                      {isEditingSprintPoints ? (
                        <input
                          type="number"
                          value={sprintPointsInput}
                          onChange={(e) => setSprintPointsInput(e.target.value)}
                          onBlur={() => {
                            const pts = parseFloat(sprintPointsInput);
                            if (!isNaN(pts) && pts >= 0) {
                              updateTaskMutation.mutate({ sprint_points: pts });
                            } else if (sprintPointsInput === '') {
                              updateTaskMutation.mutate({ sprint_points: null });
                            }
                            setIsEditingSprintPoints(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') { setSprintPointsInput(task.sprint_points?.toString() || ''); setIsEditingSprintPoints(false); }
                          }}
                          className="w-20 px-2 py-1 bg-gray-50 dark:bg-[#0f1012] border border-teal-500 rounded text-sm text-gray-900 dark:text-white focus:outline-none"
                          autoFocus
                          min="0"
                          step="0.5"
                        />
                      ) : (
                        <button
                          onClick={() => canEdit && setIsEditingSprintPoints(true)}
                          className={cn("text-sm", task.sprint_points ? "text-teal-400 font-medium" : "text-gray-500 dark:text-slate-400", canEdit && "hover:text-gray-900 dark:hover:text-white")}
                        >
                          {task.sprint_points ? `${task.sprint_points} points` : 'Set points'}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center py-1 px-2 -mx-2">
                      <div className="flex items-center gap-2 text-gray-400">
                        <span className="text-xs px-2 py-0.5 bg-teal-600/20 text-teal-400 rounded">Sprint</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Description Section */}
              <div className="mb-6">
                {isEditingDescription && canEdit ? (
                  <div>
                    <textarea
                      value={taskDescription}
                      onChange={(e) => setTaskDescription(e.target.value)}
                      placeholder="Type '/' for commands..."
                      rows={4}
                      className="w-full px-3 py-2 bg-white dark:bg-[#2e2f3a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white text-sm resize-none focus:outline-none focus:border-purple-500"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        onClick={() => { setTaskDescription(task.description || ''); setIsEditingDescription(false); }}
                        className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDescriptionSave}
                        className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : task.description ? (
                  <div
                    onClick={() => canEdit && setIsEditingDescription(true)}
                    className={cn("text-sm text-gray-600 dark:text-gray-300 p-2 rounded whitespace-pre-wrap", canEdit && "cursor-pointer hover:bg-gray-100 dark:hover:bg-[#2e2f3a]")}
                  >
                    {task.description}
                  </div>
                ) : canEdit ? (
                  <button
                    onClick={() => setIsEditingDescription(true)}
                    className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    <FileText className="w-4 h-4" />
                    Add description
                  </button>
                ) : (
                  <p className="text-sm text-gray-500 p-2">No description</p>
                )}
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200 dark:border-[#1f2229] mb-6">
                <div className="flex gap-6">
                  <button
                    onClick={() => setActiveTab('details')}
                    className={cn(
                      "pb-3 text-sm font-medium -mb-px",
                      activeTab === 'details' ? "text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    )}
                  >
                    Details
                  </button>
                  <button
                    onClick={() => setActiveTab('subtasks')}
                    className={cn(
                      "pb-3 text-sm font-medium -mb-px flex items-center gap-1",
                      activeTab === 'subtasks' ? "text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    )}
                  >
                    Subtasks <span className="text-gray-500 text-xs">0</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('activity')}
                    className={cn(
                      "pb-3 text-sm font-medium -mb-px",
                      activeTab === 'activity' ? "text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white" : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    )}
                  >
                    Action Items
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              {activeTab === 'details' && (
                <div className="space-y-6">
                  {/* Checklists Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Checklists</h3>
                    <div className="space-y-4">
                      {checklists.map((checklist, checklistIndex) => {
                        const completedCount = checklist.items.filter(item => item.checked).length;
                        return (
                          <div key={checklist.id} className="bg-white dark:bg-[#2e2f3a] rounded-lg overflow-hidden border border-gray-200 dark:border-transparent">
                            {/* Checklist header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#1f2229]">
                              <div className="flex items-center gap-2">
                                <span className="text-gray-900 dark:text-white font-medium">{checklist.name}</span>
                                <span className="text-xs text-gray-500">{completedCount} of {checklist.items.length}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {canEdit && (
                                  <button
                                    onClick={() => handleDeleteChecklist(checklist.id)}
                                    className="p-1 text-gray-500 hover:text-red-400"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                                <Avatar className="w-6 h-6">
                                  <AvatarFallback className="bg-gray-600 text-white text-[10px]">
                                    {task.assignee_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                              </div>
                            </div>
                            {/* Checklist items */}
                            <div className="px-4 py-2">
                              {checklist.items.map(item => (
                                <div key={item.id} className="flex items-center gap-3 py-2 group hover:bg-gray-100 dark:hover:bg-[#3e3f4a] -mx-4 px-4">
                                  <button
                                    onClick={() => canEdit && handleToggleChecklistItem(checklist.id, item.id)}
                                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                      item.checked
                                        ? 'bg-purple-500 border-purple-500'
                                        : canEdit ? 'border-gray-500 hover:border-purple-400' : 'border-gray-500'
                                    }`}
                                  >
                                    {item.checked && <Check className="w-3 h-3 text-white" />}
                                  </button>
                                  <span className={`flex-1 text-sm ${item.checked ? 'text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                                    {item.text}
                                  </span>
                                  {canEdit && (
                                    <button
                                      onClick={() => handleDeleteChecklistItem(checklist.id, item.id)}
                                      className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                              {/* Add item input */}
                              {canEdit && (
                                <div className="flex items-center gap-3 py-2">
                                  <Plus className="w-4 h-4 text-gray-500" />
                                  <input
                                    type="text"
                                    placeholder="Add item"
                                    className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-500 outline-none"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                                        handleAddChecklistItem(checklist.id, (e.target as HTMLInputElement).value);
                                        (e.target as HTMLInputElement).value = '';
                                      }
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {/* Add checklist button */}
                      {canEdit && (
                        <button
                          onClick={handleAddChecklist}
                          className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-purple-400"
                        >
                          <Plus className="w-4 h-4" />
                          Add checklist
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Add Custom Fields</h3>
                    <button
                      onClick={handleCreateField}
                      className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 dark:border-[#1f2229] rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-purple-500 hover:text-purple-400"
                    >
                      <Plus className="w-4 h-4" />
                      Create a field in this List
                    </button>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Attachments</h3>
                    <div
                      onClick={handleAttachment}
                      className="border border-dashed border-gray-300 dark:border-[#1f2229] rounded-lg p-8 text-center hover:border-purple-500 cursor-pointer"
                    >
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Drop your files here to <span className="text-purple-400 underline">upload</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'subtasks' && (
                <div>
                  <button
                    onClick={handleAddSubtask}
                    className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300"
                  >
                    <Plus className="w-4 h-4" /> Add subtask
                  </button>
                </div>
              )}

              {activeTab === 'activity' && (
                <p className="text-sm text-gray-500">No action items</p>
              )}
            </div>
          </div>
        </div>

        {/* Activity Sidebar */}
        <div className="w-[320px] flex flex-col bg-gray-50 dark:bg-[#0f1012] flex-shrink-0">
          {/* Header */}
          <div className="flex items-center justify-between h-12 px-4 border-b border-gray-200 dark:border-[#1f2229]">
            <h3 className="text-gray-900 dark:text-white font-medium">Activity</h3>
            <div className="flex items-center gap-0.5">
              <button
                onClick={handleActivitySearch}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded"
              >
                <Search className="w-4 h-4" />
              </button>
              <button
                onClick={handleNotifications}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded flex items-center gap-0.5"
              >
                <Bell className="w-4 h-4" />
                <span className="text-xs">0</span>
              </button>
              <button
                onClick={handleActivitySort}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tab */}
          <div className="px-4 border-b border-gray-200 dark:border-[#1f2229]">
            <button className="py-2 text-sm text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white -mb-px">
              Activity
            </button>
          </div>

          {/* Activity List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Show comments if any */}
            {comments.length > 0 ? (
              <>
                {comments.map((comment: Comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="w-0.5 bg-purple-500 rounded-full flex-shrink-0 mt-1" style={{ minHeight: '32px' }} />
                    <div>
                      <p className="text-xs text-gray-300">{comment.content}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(comment.created_at).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-[#2e2f3a] flex items-center justify-center mb-3">
                  <Bell className="w-5 h-5 text-gray-500" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">No activity yet</p>
                <p className="text-xs text-gray-500 mt-1">Comments and updates will appear here</p>
              </div>
            )}

            {/* Task creation info at bottom */}
            {comments.length > 0 && (
              <div className="flex gap-3 pt-2 border-t border-gray-200 dark:border-[#1f2229]">
                <div className="w-0.5 bg-gray-600 rounded-full flex-shrink-0 mt-1" style={{ height: '32px' }} />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Task created</p>
                  <p className="text-xs text-gray-500">
                    {new Date(task.created_at).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Comment Input */}
          <div className="p-3 border-t border-gray-200 dark:border-[#1f2229]">
            <div className="bg-white dark:bg-[#2e2f3a] rounded-lg border border-gray-200 dark:border-transparent">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCommentSubmit(); } }}
                placeholder={canEdit ? "Write a comment..." : "View only — comments disabled"}
                className="w-full px-3 py-2 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-500 outline-none"
                disabled={!canEdit}
              />
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex items-center">
                  <button onClick={handleCommentAttach} className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white"><Plus className="w-4 h-4" /></button>
                  <button className="flex items-center gap-1 px-1.5 py-0.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                    Comment <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center">
                  <button onClick={handleEmoji} className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white" title="Emoji"><Smile className="w-3.5 h-3.5" /></button>
                  <button onClick={handleMention} className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white" title="Mention"><AtSign className="w-3.5 h-3.5" /></button>
                  <button onClick={handleCommentAttach} className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white" title="Attach file"><Paperclip className="w-3.5 h-3.5" /></button>
                  <button onClick={handleAddLink} className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white" title="Add link"><Link className="w-3.5 h-3.5" /></button>
                  <button onClick={handleHashtag} className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white" title="Hashtag"><Hash className="w-3.5 h-3.5" /></button>
                  <button onClick={handleMoreOptions} className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white" title="More options"><MoreHorizontal className="w-3.5 h-3.5" /></button>
                  <button
                    onClick={handleCommentSubmit}
                    disabled={!newComment.trim()}
                    className="p-1 text-gray-500 hover:text-purple-400 disabled:opacity-40"
                    title="Send"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Delete */}
          {canEdit && (
            <div className="p-3 border-t border-gray-200 dark:border-[#1f2229]">
              <button
                onClick={() => { if (confirm('Delete this task?')) deleteTaskMutation.mutate(); }}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg"
              >
                <Trash2 className="w-4 h-4" /> Delete Task
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status Workflow Editor Modal */}
      {showStatusModal && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[60]" onClick={() => setShowStatusModal(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-50 dark:bg-[#0f1012] border border-gray-200 dark:border-[#1f2229] rounded-xl shadow-2xl z-[70] w-[500px] max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#1f2229]">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Workflow statuses</h3>
              </div>
              <button
                onClick={() => setShowStatusModal(false)}
                className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {/* Active Statuses */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium text-gray-400">Active statuses</span>
                  <span className="text-xs text-gray-500">{statuses.filter(s => !['Done', 'Completed', 'Closed'].includes(s.name)).length}</span>
                </div>
                <div className="space-y-1">
                  {statuses.filter(s => !['Done', 'Completed', 'Closed'].includes(s.name)).map((status, index) => (
                    <div
                      key={status.name}
                      className="flex items-center gap-2 p-2 bg-white dark:bg-[#2e2f3a] rounded-lg group hover:bg-gray-100 dark:hover:bg-[#3e3f4a] cursor-move"
                    >
                      <GripVertical className="w-4 h-4 text-gray-500 cursor-grab" />
                      <Circle className="w-4 h-4" style={{ color: status.bgColor }} fill={status.bgColor} />
                      <span className="flex-1 text-sm text-gray-900 dark:text-white">{status.name}</span>
                      <button className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white opacity-0 group-hover:opacity-100">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => toast.info('Add status coming soon!')}
                  className="flex items-center gap-2 mt-2 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded-lg w-full"
                >
                  <Plus className="w-4 h-4" />
                  Add status
                </button>
              </div>

              {/* Done Statuses */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium text-green-400">Done statuses</span>
                  <span className="text-xs text-gray-500">{statuses.filter(s => ['Done', 'Completed'].includes(s.name)).length}</span>
                </div>
                <div className="space-y-1">
                  {statuses.filter(s => ['Done', 'Completed'].includes(s.name)).map(status => (
                    <div
                      key={status.name}
                      className="flex items-center gap-2 p-2 bg-white dark:bg-[#2e2f3a] rounded-lg group hover:bg-gray-100 dark:hover:bg-[#3e3f4a] cursor-move"
                    >
                      <GripVertical className="w-4 h-4 text-gray-500 cursor-grab" />
                      <Check className="w-4 h-4 text-green-500" />
                      <span className="flex-1 text-sm text-gray-900 dark:text-white">{status.name}</span>
                      <button className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white opacity-0 group-hover:opacity-100">
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => toast.info('Add done status coming soon!')}
                  className="flex items-center gap-2 mt-2 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-green-400 hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded-lg w-full"
                >
                  <Plus className="w-4 h-4" />
                  Add status
                </button>
              </div>

              {/* Closed Statuses */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium text-gray-400">Closed statuses</span>
                  <span className="text-xs text-gray-500">{statuses.filter(s => ['Closed', 'Archived'].includes(s.name)).length}</span>
                </div>
                <div className="space-y-1">
                  {statuses.filter(s => ['Closed', 'Archived'].includes(s.name)).map(status => (
                    <div
                      key={status.name}
                      className="flex items-center gap-2 p-2 bg-white dark:bg-[#2e2f3a] rounded-lg group hover:bg-gray-100 dark:hover:bg-[#3e3f4a] cursor-move"
                    >
                      <GripVertical className="w-4 h-4 text-gray-500 cursor-grab" />
                      <Circle className="w-4 h-4 text-gray-500" />
                      <span className="flex-1 text-sm text-gray-900 dark:text-white">{status.name}</span>
                      <button className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white opacity-0 group-hover:opacity-100">
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => toast.info('Add closed status coming soon!')}
                  className="flex items-center gap-2 mt-2 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded-lg w-full"
                >
                  <Plus className="w-4 h-4" />
                  Add status
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-[#1f2229]">
              <button
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => { toast.success('Workflow saved'); setShowStatusModal(false); }}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </>
      )}

      {/* Time Tracking Modal */}
      {showTimeTrackingModal && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[60]" onClick={() => setShowTimeTrackingModal(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-50 dark:bg-[#0f1012] border border-gray-200 dark:border-[#1f2229] rounded-xl shadow-2xl z-[70] w-[420px] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#1f2229]">
              <div className="flex items-center gap-3">
                <Timer className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Time on this task</h3>
                  <p className="text-xs text-gray-500">{trackedTime > 0 ? `${Math.floor(trackedTime / 60)}h ${trackedTime % 60}m tracked` : 'No time tracked'}</p>
                </div>
              </div>
              <button
                onClick={() => setShowTimeTrackingModal(false)}
                className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2e2f3a] rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Location Info */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-500">■</span>
                <span className="text-gray-500 dark:text-gray-400">{spaceName}</span>
                <ChevronRight className="w-3 h-3 text-gray-600" />
                <span className="text-gray-500 dark:text-gray-400">{task.name}</span>
              </div>

              {/* Time Input */}
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">Enter time (ex: 3h 20m) or start timer</label>
                <div className="relative">
                  <input
                    type="text"
                    value={timeTrackInput}
                    onChange={(e) => setTimeTrackInput(e.target.value)}
                    placeholder="0h 0m"
                    className="w-full px-3 py-2.5 bg-white dark:bg-[#2e2f3a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                    autoFocus
                  />
                  <button
                    onClick={() => toast.info('Timer coming soon!')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-purple-400 hover:bg-purple-500/20 rounded"
                    title="Start timer"
                  >
                    <PlayCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">Start</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => (document.getElementById('time-track-start-date') as HTMLInputElement)?.showPicker?.()}
                      className="flex-1 flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#2e2f3a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-[#4e4f5a]"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </button>
                    <input id="time-track-start-date" type="date" className="sr-only" />
                    <button className="flex items-center gap-1 px-3 py-2 bg-white dark:bg-[#2e2f3a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-[#4e4f5a]">
                      <Clock className="w-4 h-4" />
                      <span>9:00</span>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">End</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => (document.getElementById('time-track-end-date') as HTMLInputElement)?.showPicker?.()}
                      className="flex-1 flex items-center gap-2 px-3 py-2 bg-white dark:bg-[#2e2f3a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-[#4e4f5a]"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </button>
                    <input id="time-track-end-date" type="date" className="sr-only" />
                    <button className="flex items-center gap-1 px-3 py-2 bg-white dark:bg-[#2e2f3a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-[#4e4f5a]">
                      <Clock className="w-4 h-4" />
                      <span>10:00</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs text-gray-500 block mb-1.5">Notes</label>
                <textarea
                  value={timeTrackNotes}
                  onChange={(e) => setTimeTrackNotes(e.target.value)}
                  placeholder="Add notes..."
                  rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-[#2e2f3a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Tags */}
              <div>
                <button
                  onClick={() => toast.info('Time tracking tags coming soon!')}
                  className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-purple-400"
                >
                  <Tag className="w-4 h-4" />
                  Add tags
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-[#1f2229]">
              <button
                onClick={() => {
                  setTimeTrackInput('');
                  setTimeTrackNotes('');
                }}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Clear
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTimeTrackingModal(false)}
                  className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTimeTracking}
                  disabled={!timeTrackInput.trim()}
                  className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </>
      )}

    </>
  );
}
