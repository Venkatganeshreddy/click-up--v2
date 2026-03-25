import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import { spacesApi, tasksApi, spaceMembersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Task, Space } from '../types';

const priorityColors: Record<string, string> = {
  URGENT: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-yellow-500',
  LOW: 'bg-blue-500',
};

export default function CalendarPage() {
  const { member, needsSpaceAccess } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { data: spaces = [] } = useQuery({
    queryKey: ['spaces'],
    queryFn: spacesApi.getAll
  });

  const { data: rawTasks = [] } = useQuery({
    queryKey: ['all-tasks-calendar'],
    queryFn: tasksApi.getAll
  });

  // Fetch accessible spaces for guests/limited members
  const { data: memberSpaceAccess = [] } = useQuery({
    queryKey: ['memberSpaceAccess', member?.id],
    queryFn: () => member?.id ? spaceMembersApi.getByMember(member.id) : Promise.resolve([]),
    enabled: needsSpaceAccess && !!member?.id,
  });

  // Filter tasks for guests: only tasks in accessible spaces
  const allTasks = useMemo(() => {
    if (!needsSpaceAccess) return rawTasks;
    const accessibleSpaceIds = new Set(memberSpaceAccess.map((sa: { space_id: string }) => sa.space_id));
    return rawTasks.filter(t => accessibleSpaceIds.has(t.space_id));
  }, [rawTasks, needsSpaceAccess, memberSpaceAccess]);

  const getTasksForDate = (date: Date) => {
    return allTasks.filter(task => {
      if (!task.due_date) return false;
      return isSameDay(new Date(task.due_date), date);
    });
  };

  const renderCalendarDays = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const rows: JSX.Element[] = [];
    let days: JSX.Element[] = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const currentDay = day;
        const dayTasks = getTasksForDate(currentDay);
        const isCurrentMonth = isSameMonth(currentDay, currentDate);
        const isSelected = selectedDate && isSameDay(currentDay, selectedDate);
        const isTodayDate = isToday(currentDay);

        days.push(
          <div
            key={currentDay.toString()}
            className={cn(
              "min-h-[100px] p-2 border-b border-r border-gray-100 dark:border-[#1f2229] cursor-pointer transition-colors",
              !isCurrentMonth && "bg-gray-50/50 dark:bg-[#0f1012]/50 text-gray-300 dark:text-slate-600",
              isSelected && "bg-primary-50 dark:bg-[#14151a]",
              isTodayDate && "bg-blue-50/50 dark:bg-[#1a1c22]"
            )}
            onClick={() => setSelectedDate(currentDay)}
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className={cn(
                  "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                  isTodayDate && "bg-primary-600 text-white",
                  isSelected && !isTodayDate && "bg-gray-200 dark:bg-[#2a2d36]"
                )}
              >
                {format(currentDay, 'd')}
              </span>
            </div>
            <div className="space-y-1">
              {dayTasks.slice(0, 3).map(task => (
                <HoverCard key={task.id}>
                  <HoverCardTrigger>
                    <div
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded truncate text-white cursor-pointer",
                        priorityColors[task.priority] || 'bg-primary-500',
                        task.status === 'Done' && "opacity-50 line-through"
                      )}
                    >
                      {task.name}
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-64">
                    <div className="space-y-2">
                      <h4 className="font-semibold">{task.name}</h4>
                      {task.description && (
                        <p className="text-sm text-gray-500 dark:text-slate-400">{task.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                        <Badge variant="secondary" className="capitalize">
                          {task.priority.toLowerCase()} priority
                        </Badge>
                        <span>{task.status}</span>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              ))}
              {dayTasks.length > 3 && (
                <div className="text-xs text-gray-400 dark:text-slate-500 pl-1">
                  +{dayTasks.length - 3} more
                </div>
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div key={day.toString()} className="grid grid-cols-7">
          {days}
        </div>
      );
      days = [];
    }
    return rows;
  };

  const selectedDateTasks = selectedDate ? getTasksForDate(selectedDate) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50 dark:from-[#0f1012] dark:via-[#0f1012] dark:to-[#0f1012] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Calendar</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-lg font-semibold min-w-[160px] text-center">
                {format(currentDate, 'MMMM yyyy')}
              </span>
              <button
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-2 border border-gray-200 dark:border-[#1f2229] rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              Today
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Card className="bg-white/80 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] shadow-sm overflow-hidden">
              <div className="grid grid-cols-7 bg-gray-50 dark:bg-[#14151a] border-b border-gray-200 dark:border-[#1f2229]">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div
                    key={day}
                    className="py-3 text-center text-sm font-semibold text-gray-600 dark:text-slate-400"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div>{renderCalendarDays()}</div>
            </Card>
          </div>

          <div className="space-y-4">
            {selectedDate && (
              <Card className="bg-white/80 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg dark:text-white">
                    {format(selectedDate, 'EEEE, MMMM d')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedDateTasks.length > 0 ? (
                    <div className="space-y-3">
                      {selectedDateTasks.map(task => {
                        const space = spaces.find(s => s.id === task.space_id);
                        return (
                          <div
                            key={task.id}
                            className="p-3 rounded-lg border-l-4 bg-gray-50 dark:bg-[#15161a]"
                            style={{
                              borderLeftColor:
                                task.priority === 'URGENT' ? '#ef4444' :
                                task.priority === 'HIGH' ? '#f97316' :
                                task.priority === 'MEDIUM' ? '#eab308' :
                                task.priority === 'LOW' ? '#3b82f6' : '#8b5cf6'
                            }}
                          >
                            <h4 className={cn(
                              "font-medium text-gray-900 dark:text-white",
                              task.status === 'Done' && "line-through text-gray-400 dark:text-slate-500"
                            )}>
                              {task.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500 dark:text-slate-400">
                                {space?.name}
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {task.status}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-400 dark:text-slate-500 text-center py-4">
                      No tasks due on this day
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="bg-white/80 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg dark:text-white">Priority Legend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(priorityColors).map(([priority, color]) => (
                    <div key={priority} className="flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded", color)} />
                      <span className="text-sm capitalize text-gray-600 dark:text-slate-400">
                        {priority.toLowerCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
