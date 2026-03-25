import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isToday, isTomorrow, isThisWeek, isPast } from 'date-fns';
import {
  CheckCircle2, Circle, Calendar, Clock,
  ChevronDown, ChevronRight, AlertTriangle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useAuth } from '../context/AuthContext';
import { spacesApi, tasksApi } from '../services/api';
import type { Task, Space } from '../types';

const priorityConfig: Record<string, { color: string; label: string }> = {
  URGENT: { color: 'bg-red-500 text-white', label: 'Urgent' },
  HIGH: { color: 'bg-orange-500 text-white', label: 'High' },
  MEDIUM: { color: 'bg-yellow-500 text-white', label: 'Medium' },
  LOW: { color: 'bg-blue-500 text-white', label: 'Low' },
};

export default function MyTasks() {
  const { user, member, canEdit } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overdue: true,
    today: true,
    tomorrow: true,
    thisWeek: true,
    later: false,
    completed: false
  });

  const { data: spaces = [] } = useQuery({
    queryKey: ['spaces'],
    queryFn: spacesApi.getAll
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['all-tasks-mytasks'],
    queryFn: tasksApi.getAll
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => {
      if (!canEdit) return Promise.reject(new Error('Read-only access'));
      return tasksApi.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-tasks-mytasks'] });
    }
  });

  const myTasks = allTasks.filter(t => {
    if (t.assignee_id === user?.id) return true;
    if (member?.name && t.assignees && t.assignees.includes(member.name)) return true;
    if (member?.name && t.assignee_name === member.name) return true;
    return false;
  });

  const categorizeTasks = () => {
    const overdue: Task[] = [];
    const today: Task[] = [];
    const tomorrow: Task[] = [];
    const thisWeek: Task[] = [];
    const later: Task[] = [];
    const completed: Task[] = [];

    myTasks.forEach(task => {
      if (task.status === 'Done') {
        completed.push(task);
        return;
      }

      if (!task.due_date) {
        later.push(task);
        return;
      }

      const dueDate = new Date(task.due_date);

      if (isPast(dueDate) && !isToday(dueDate)) {
        overdue.push(task);
      } else if (isToday(dueDate)) {
        today.push(task);
      } else if (isTomorrow(dueDate)) {
        tomorrow.push(task);
      } else if (isThisWeek(dueDate)) {
        thisWeek.push(task);
      } else {
        later.push(task);
      }
    });

    return { overdue, today, tomorrow, thisWeek, later, completed };
  };

  const { overdue, today, tomorrow, thisWeek, later, completed } = categorizeTasks();

  const handleToggleComplete = (task: Task) => {
    if (!canEdit) return;
    const newStatus = task.status === 'Done' ? 'To Do' : 'Done';
    updateTaskMutation.mutate({
      id: task.id,
      data: { status: newStatus }
    });
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderTask = (task: Task) => {
    const priority = priorityConfig[task.priority];
    const space = spaces.find(s => s.id === task.space_id);

    return (
      <div
        key={task.id}
        className="flex items-center gap-3 py-3 px-4 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
      >
        <button onClick={() => canEdit && handleToggleComplete(task)} disabled={!canEdit} className={!canEdit ? 'cursor-default' : ''}>
          {task.status === 'Done' ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <Circle className={cn("w-5 h-5 text-gray-300 transition-colors", canEdit && "hover:text-primary-500")} />
          )}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-medium",
              task.status === 'Done' && "line-through text-gray-400"
            )}>
              {task.name}
            </span>
            {priority && (
              <Badge className={cn("text-xs", priority.color)}>
                {priority.label}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-slate-400">
            <span>{space?.name}</span>
            {task.due_date && (
              <>
                <span>•</span>
                <span className={cn(
                  isPast(new Date(task.due_date)) && task.status !== 'Done' && "text-red-500"
                )}>
                  {format(new Date(task.due_date), 'MMM d')}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSection = (
    title: string,
    tasks: Task[],
    key: string,
    icon: React.ReactNode
  ) => {
    if (tasks.length === 0) return null;

    return (
      <Collapsible
        open={expandedSections[key]}
        onOpenChange={() => toggleSection(key)}
      >
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-3 py-2 px-4 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer">
            {expandedSections[key] ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
            {icon}
            <span className="font-semibold text-gray-700 dark:text-slate-300">{title}</span>
            <span className="text-sm text-gray-400 dark:text-slate-500">({tasks.length})</span>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-4 border-l-2 border-gray-100 dark:border-[#1f2229] pl-4">
            {tasks.map(renderTask)}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50 dark:from-[#0f1012] dark:via-[#0f1012] dark:to-[#0f1012]">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Tasks</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            {myTasks.filter(t => t.status !== 'Done').length} tasks remaining
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card className="bg-white/80 dark:bg-[#14151a]/80 backdrop-blur border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{overdue.length}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">Overdue</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-[#14151a]/80 backdrop-blur border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{today.length}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">Due Today</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-[#14151a]/80 backdrop-blur border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{thisWeek.length + tomorrow.length}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">This Week</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-[#14151a]/80 backdrop-blur border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{completed.length}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">Completed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Task List */}
        <Card className="bg-white/80 dark:bg-[#14151a]/80 backdrop-blur border-0 shadow-sm">
          <CardContent className="p-4">
            {renderSection('Overdue', overdue, 'overdue',
              <AlertTriangle className="w-4 h-4 text-red-500" />
            )}
            {renderSection('Today', today, 'today',
              <Calendar className="w-4 h-4 text-orange-500" />
            )}
            {renderSection('Tomorrow', tomorrow, 'tomorrow',
              <Calendar className="w-4 h-4 text-blue-500" />
            )}
            {renderSection('This Week', thisWeek, 'thisWeek',
              <Clock className="w-4 h-4 text-primary-500" />
            )}
            {renderSection('Later', later, 'later',
              <Calendar className="w-4 h-4 text-gray-400" />
            )}
            {renderSection('Completed', completed, 'completed',
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            )}

            {myTasks.length === 0 && (
              <div className="text-center py-8 text-gray-400 dark:text-slate-400">
                No tasks assigned to you yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
