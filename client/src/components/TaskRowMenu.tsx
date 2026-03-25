import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MoreHorizontal, Copy, ExternalLink, Columns, Pencil, RefreshCw,
  FileText, CopyPlus, Bell, UserPlus, Mail, Plus, GitMerge,
  Move, Timer, GitBranch, FileStack, Archive, Trash2, Share2,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { tasksApi } from '../services/api';
import type { Task } from '../types';

interface TaskRowMenuProps {
  task: Task;
  onRename?: () => void;
  onOpenTask?: () => void;
  onTaskDeleted?: () => void;
}

export default function TaskRowMenu({ task, onRename, onOpenTask, onTaskDeleted }: TaskRowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'actions' | 'copy'>('actions');
  const menuRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const deleteTaskMutation = useMutation({
    mutationFn: () => tasksApi.delete(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task deleted');
      onTaskDeleted?.();
      setIsOpen(false);
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const duplicateTaskMutation = useMutation({
    mutationFn: () => tasksApi.create({
      name: `${task.name} (copy)`,
      description: task.description || undefined,
      space_id: task.space_id,
      folder_id: task.folder_id || undefined,
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || undefined,
      start_date: task.start_date || undefined,
      assignee_name: task.assignee_name || undefined,
      estimated_hours: task.estimated_hours || undefined,
      tags: task.tags || undefined
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task duplicated');
      setIsOpen(false);
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const archiveTaskMutation = useMutation({
    mutationFn: () => tasksApi.update(task.id, { status: 'Archived' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task archived');
      setIsOpen(false);
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/workspace?task=${task.id}`);
    toast.success('Link copied to clipboard');
    setIsOpen(false);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(task.id);
    toast.success('Task ID copied to clipboard');
    setIsOpen(false);
  };

  const handleNewTab = () => {
    window.open(`${window.location.origin}/workspace?task=${task.id}`, '_blank');
    setIsOpen(false);
  };

  const handleRename = () => {
    onRename?.();
    setIsOpen(false);
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this task?')) {
      deleteTaskMutation.mutate();
    }
  };

  const handleDuplicate = () => {
    duplicateTaskMutation.mutate();
  };

  const handleArchive = () => {
    archiveTaskMutation.mutate();
  };

  // Placeholder actions with toast
  const handlePlaceholder = (action: string) => {
    toast.info(`${action} coming soon!`);
    setIsOpen(false);
  };

  const menuItems = [
    { icon: Columns, label: 'Add a column', action: () => handlePlaceholder('Add a column') },
    { divider: true },
    { icon: Pencil, label: 'Rename', action: handleRename },
    { icon: RefreshCw, label: 'Convert to', arrow: true, action: () => handlePlaceholder('Convert to') },
    { icon: FileText, label: 'Task Type', arrow: true, action: () => handlePlaceholder('Task Type') },
    { icon: CopyPlus, label: 'Duplicate', action: handleDuplicate },
    { icon: Bell, label: 'Remind me', action: () => handlePlaceholder('Remind me') },
    { icon: UserPlus, label: 'Follow task', action: () => handlePlaceholder('Follow task') },
    { icon: Mail, label: 'Send email to task', action: () => handlePlaceholder('Send email to task') },
    { icon: Plus, label: 'Add To', arrow: true, action: () => handlePlaceholder('Add To') },
    { icon: GitMerge, label: 'Merge', action: () => handlePlaceholder('Merge') },
    { icon: Move, label: 'Move', action: () => handlePlaceholder('Move') },
    { icon: Timer, label: 'Start timer', action: () => handlePlaceholder('Start timer') },
    { divider: true },
    { icon: GitBranch, label: 'Dependencies', action: () => handlePlaceholder('Dependencies') },
    { icon: FileStack, label: 'Templates', arrow: true, action: () => handlePlaceholder('Templates') },
    { divider: true },
    { icon: Archive, label: 'Archive', action: handleArchive },
    { icon: Trash2, label: 'Delete', action: handleDelete, danger: true },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1 text-gray-500 hover:text-white hover:bg-[#3e3f4a] rounded opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-56 bg-[#2e2f3a] border border-[#3e3f4a] rounded-lg shadow-xl z-50 py-1 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top tabs - Copy link, Copy ID, New tab */}
          <div className="flex border-b border-[#3e3f4a] px-2 pb-1 pt-1 gap-1">
            <button
              onClick={handleCopyLink}
              className="flex-1 px-2 py-1.5 text-xs text-gray-300 hover:bg-[#3e3f4a] rounded font-medium"
            >
              Copy link
            </button>
            <button
              onClick={handleCopyId}
              className="flex-1 px-2 py-1.5 text-xs text-gray-300 hover:bg-[#3e3f4a] rounded font-medium"
            >
              Copy ID
            </button>
            <button
              onClick={handleNewTab}
              className="flex-1 px-2 py-1.5 text-xs text-gray-300 hover:bg-[#3e3f4a] rounded font-medium"
            >
              New tab
            </button>
          </div>

          {/* Search input */}
          <div className="px-2 py-2 border-b border-[#3e3f4a]">
            <input
              type="text"
              placeholder="Search..."
              className="w-full px-2 py-1.5 bg-[#1a1b23] border border-[#3e3f4a] rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Menu items */}
          <div className="max-h-[320px] overflow-y-auto py-1">
            {menuItems.map((item, index) => {
              if (item.divider) {
                return <div key={index} className="border-t border-[#3e3f4a] my-1" />;
              }
              const Icon = item.icon!;
              return (
                <button
                  key={index}
                  onClick={item.action}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-[#3e3f4a] ${
                    item.danger ? 'text-red-400 hover:text-red-300' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.arrow && <ChevronRight className="w-3 h-3 text-gray-500" />}
                </button>
              );
            })}
          </div>

          {/* Bottom button - Sharing & Permissions */}
          <div className="border-t border-[#3e3f4a] p-2">
            <button
              onClick={() => handlePlaceholder('Sharing & Permissions')}
              className="w-full flex items-center justify-center gap-2 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg"
            >
              <Share2 className="w-4 h-4" />
              Sharing & Permissions
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
