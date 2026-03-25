import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  format, addDays, startOfWeek, endOfWeek, eachDayOfInterval,
  differenceInDays, isWithinInterval, startOfDay, addWeeks, subWeeks
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { spacesApi, tasksApi } from '../services/api';
import type { Task, Space } from '../types';

const priorityColors: Record<string, string> = {
  URGENT: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-yellow-500',
  LOW: 'bg-blue-500'
};

const statusColors: Record<string, string> = {
  'To Do': 'bg-gray-400',
  'In Progress': 'bg-blue-500',
  'Review': 'bg-yellow-500',
  'Done': 'bg-green-500'
};

export default function Timeline() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSpace, setSelectedSpace] = useState<string>('all');

  const { data: spaces = [] } = useQuery({
    queryKey: ['spaces'],
    queryFn: spacesApi.getAll
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['all-tasks-timeline'],
    queryFn: tasksApi.getAll
  });

  // Get week range
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let tasks = allTasks.filter(t => t.due_date);
    if (selectedSpace !== 'all') {
      tasks = tasks.filter(t => t.space_id === selectedSpace);
    }
    return tasks;
  }, [allTasks, selectedSpace]);

  // Group tasks by space for the timeline
  const tasksBySpace = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    filteredTasks.forEach(task => {
      if (!grouped[task.space_id]) {
        grouped[task.space_id] = [];
      }
      grouped[task.space_id].push(task);
    });
    return grouped;
  }, [filteredTasks]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Calculate task position on timeline
  const getTaskStyle = (task: Task) => {
    if (!task.due_date) return null;
    const dueDate = startOfDay(new Date(task.due_date));

    // Check if task is within this week
    if (!isWithinInterval(dueDate, { start: weekStart, end: weekEnd })) {
      return null;
    }

    const dayIndex = differenceInDays(dueDate, weekStart);
    const left = (dayIndex / 7) * 100;
    const width = (1 / 7) * 100;

    return {
      left: `${left}%`,
      width: `${width}%`
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50 dark:from-[#0f1012] dark:via-[#0f1012] dark:to-[#0f1012] p-6">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Timeline</h1>
            <p className="text-gray-500 dark:text-slate-400 mt-1">Visualize your tasks on a timeline</p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={selectedSpace}
              onChange={(e) => setSelectedSpace(e.target.value)}
              className="px-4 py-2 border border-gray-200 dark:border-[#1f2229] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#14151a] text-gray-900 dark:text-white"
            >
              <option value="all">All Spaces</option>
              {spaces.map(space => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Timeline Controls */}
        <Card className="bg-white/80 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] shadow-sm mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigateWeek('prev')}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-[#1b1c25] rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={goToToday}
                  className="px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-[#1b1c25] rounded-lg transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={() => navigateWeek('next')}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-[#1b1c25] rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </h2>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-400 dark:text-slate-400" />
                <span className="text-sm text-gray-500 dark:text-slate-400">Week View</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timeline Grid */}
        <Card className="bg-white/80 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {/* Day Headers */}
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-[#1f2229]">
              {days.map((day, i) => {
                const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                return (
                  <div
                    key={i}
                    className={cn(
                      "px-4 py-3 text-center border-r last:border-r-0",
                      isToday && "bg-primary-50 dark:bg-[#1a1c22]"
                    )}
                  >
                    <p className="text-xs text-gray-500 dark:text-slate-400 uppercase">{format(day, 'EEE')}</p>
                    <p className={cn(
                      "text-lg font-semibold mt-1",
                      isToday ? "text-primary-600" : "text-gray-900 dark:text-white"
                    )}>
                      {format(day, 'd')}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Timeline Rows */}
            <div className="divide-y divide-gray-100 dark:divide-[#1f2229]">
              {Object.entries(tasksBySpace).map(([spaceId, tasks]) => {
                const space = spaces.find(s => s.id === spaceId);
                if (!space) return null;

                return (
                  <div key={spaceId} className="relative">
                    {/* Space Header */}
                    <div className="px-4 py-2 bg-gray-50 dark:bg-[#14151a] border-b border-gray-100 dark:border-[#1f2229]">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: space.color || '#6366f1' }}
                        />
                        <span className="font-medium text-gray-700 dark:text-slate-300">{space.name}</span>
                        <Badge variant="secondary" className="ml-2">
                          {tasks.length} tasks
                        </Badge>
                      </div>
                    </div>

                    {/* Tasks Timeline */}
                    <div className="relative min-h-[100px]">
                      {/* Grid Lines */}
                      <div className="absolute inset-0 grid grid-cols-7">
                        {days.map((day, i) => {
                          const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                          return (
                            <div
                              key={i}
                              className={cn(
                                "border-r last:border-r-0 border-gray-100 dark:border-[#1f2229]",
                                isToday && "bg-primary-50/50 dark:bg-[#1a1c22]"
                              )}
                            />
                          );
                        })}
                      </div>

                      {/* Tasks */}
                      <div className="relative p-2 space-y-2">
                        {tasks.map((task) => {
                          const style = getTaskStyle(task);
                          if (!style) return null;

                          return (
                            <div
                              key={task.id}
                              className="absolute top-2 h-8"
                              style={{ left: style.left, width: style.width }}
                            >
                              <div
                                className={cn(
                                  "h-full rounded-md px-2 flex items-center text-white text-xs font-medium truncate cursor-pointer hover:opacity-90 transition-opacity",
                                  statusColors[task.status] || 'bg-gray-400'
                                )}
                                title={`${task.name} - Due: ${format(new Date(task.due_date!), 'MMM d')}`}
                              >
                                <span className="truncate">{task.name}</span>
                              </div>
                            </div>
                          );
                        })}

                        {/* Spacer for tasks */}
                        {tasks.filter(t => getTaskStyle(t)).length > 0 && (
                          <div className="h-8" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {Object.keys(tasksBySpace).length === 0 && (
                <div className="p-12 text-center text-gray-400 dark:text-slate-400">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No tasks with due dates</p>
                  <p className="text-sm mt-1">Add due dates to your tasks to see them here</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="mt-6 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-gray-400" />
            <span className="text-sm text-gray-500 dark:text-slate-400">To Do</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span className="text-sm text-gray-500 dark:text-slate-400">In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-500" />
            <span className="text-sm text-gray-500 dark:text-slate-400">Review</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span className="text-sm text-gray-500 dark:text-slate-400">Done</span>
          </div>
        </div>
      </div>
    </div>
  );
}
