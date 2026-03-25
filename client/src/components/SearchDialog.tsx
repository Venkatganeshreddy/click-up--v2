import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Calendar, Flag, Tag, FolderKanban } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { spacesApi, tasksApi } from '../services/api';
import type { Task, Space } from '../types';
import { format } from 'date-fns';

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-600',
  HIGH: 'bg-orange-100 text-orange-600',
  URGENT: 'bg-red-100 text-red-600',
};

export default function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'tasks' | 'spaces'>('all');

  // Fetch all spaces and tasks
  const { data: spaces = [] } = useQuery({
    queryKey: ['spaces'],
    queryFn: spacesApi.getAll
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['all-tasks-search'],
    queryFn: tasksApi.getAll
  });

  // Filter results
  const filteredTasks = searchQuery.trim()
    ? allTasks.filter(task => {
        const query = searchQuery.toLowerCase();
        return (
          task.name.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query) ||
          task.tags?.some(tag => tag.toLowerCase().includes(query))
        );
      })
    : [];

  const filteredSpaces = searchQuery.trim()
    ? spaces.filter(space => {
        const query = searchQuery.toLowerCase();
        return (
          space.name.toLowerCase().includes(query) ||
          space.description?.toLowerCase().includes(query)
        );
      })
    : [];

  const results = selectedCategory === 'all'
    ? [...filteredTasks, ...filteredSpaces]
    : selectedCategory === 'tasks'
    ? filteredTasks
    : filteredSpaces;

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSelectedCategory('all');
    }
  }, [open]);

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Search</DialogTitle>
        </DialogHeader>

        <div className="px-6 pt-4">
          {/* Search Input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks, spaces, tags..."
              className="pl-10 pr-10"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                selectedCategory === 'all'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              All ({filteredTasks.length + filteredSpaces.length})
            </button>
            <button
              onClick={() => setSelectedCategory('tasks')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                selectedCategory === 'tasks'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              Tasks ({filteredTasks.length})
            </button>
            <button
              onClick={() => setSelectedCategory('spaces')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                selectedCategory === 'spaces'
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              Spaces ({filteredSpaces.length})
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="px-6 pb-6 overflow-y-auto max-h-[50vh]">
          {!searchQuery.trim() ? (
            <div className="text-center py-12 text-gray-500 dark:text-slate-400">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Start typing to search...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-slate-400">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No results found</p>
              <p className="text-sm mt-1">Try different keywords</p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((item) => {
                if ('status' in item) {
                  // Task
                  const task = item as Task;
                  const space = spaces.find(s => s.id === task.space_id);
                  return (
                    <div
                      key={task.id}
                      className="p-4 rounded-lg border border-gray-200 dark:border-[#1f2229] hover:border-primary-300 hover:bg-primary-50/50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                            {highlightText(task.name, searchQuery)}
                          </h4>
                          {task.description && (
                            <p className="text-sm text-gray-500 dark:text-slate-400 line-clamp-1">
                              {highlightText(task.description, searchQuery)}
                            </p>
                          )}
                        </div>
                        <Badge className={PRIORITY_COLORS[task.priority]}>
                          {task.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {space && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
                            <FolderKanban className="h-3 w-3" />
                            {space.name}
                          </div>
                        )}
                        {task.due_date && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(task.due_date), 'MMM d')}
                          </div>
                        )}
                        {task.tags && task.tags.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
                            <Tag className="h-3 w-3" />
                            {task.tags.slice(0, 2).join(', ')}
                            {task.tags.length > 2 && ` +${task.tags.length - 2}`}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                } else {
                  // Space
                  const space = item as Space;
                  return (
                    <div
                      key={space.id}
                      className="p-4 rounded-lg border border-gray-200 dark:border-[#1f2229] hover:border-primary-300 hover:bg-primary-50/50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${space.color}20` }}
                        >
                          <span className="text-xl">{space.icon}</span>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {highlightText(space.name, searchQuery)}
                          </h4>
                          {space.description && (
                            <p className="text-sm text-gray-500 dark:text-slate-400 line-clamp-1">
                              {highlightText(space.description, searchQuery)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}











