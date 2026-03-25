import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isWithinInterval } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, AreaChart, Area
} from 'recharts';
import { Download, Calendar, TrendingUp, Users, Target, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { spacesApi, tasksApi } from '../services/api';
import type { Task, Space } from '../types';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const STATUS_COLORS: Record<string, string> = {
  'To Do': '#94a3b8',
  'In Progress': '#3b82f6',
  'Review': '#f59e0b',
  'Done': '#22c55e'
};

export default function Reports() {
  const [dateRange, setDateRange] = useState('week');

  const { data: spaces = [] } = useQuery({
    queryKey: ['spaces'],
    queryFn: spacesApi.getAll
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['all-tasks-reports'],
    queryFn: tasksApi.getAll
  });

  // Calculate date range
  const getDateRange = () => {
    const end = new Date();
    let start;
    switch (dateRange) {
      case 'week':
        start = subDays(end, 7);
        break;
      case 'month':
        start = subDays(end, 30);
        break;
      case 'quarter':
        start = subDays(end, 90);
        break;
      default:
        start = subDays(end, 7);
    }
    return { start, end };
  };

  const { start, end } = getDateRange();

  // Filter tasks within date range
  const tasksInRange = allTasks.filter(task => {
    const createdAt = new Date(task.created_at);
    return isWithinInterval(createdAt, { start, end });
  });

  // Tasks by status
  const tasksByStatus = allTasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusChartData = Object.entries(tasksByStatus).map(([status, count]) => ({
    name: status,
    value: count,
    color: STATUS_COLORS[status] || '#94a3b8'
  }));

  // Tasks by priority
  const tasksByPriority = allTasks.reduce((acc, task) => {
    acc[task.priority] = (acc[task.priority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const priorityChartData = [
    { name: 'Urgent', value: tasksByPriority['URGENT'] || 0, color: '#ef4444' },
    { name: 'High', value: tasksByPriority['HIGH'] || 0, color: '#f97316' },
    { name: 'Medium', value: tasksByPriority['MEDIUM'] || 0, color: '#eab308' },
    { name: 'Low', value: tasksByPriority['LOW'] || 0, color: '#3b82f6' }
  ];

  // Tasks by space
  const tasksBySpace = spaces.map(space => {
    const spaceTasks = allTasks.filter(t => t.space_id === space.id);
    const completed = spaceTasks.filter(t => t.status === 'Done').length;
    return {
      name: space.name.length > 15 ? space.name.substring(0, 15) + '...' : space.name,
      total: spaceTasks.length,
      completed,
      pending: spaceTasks.length - completed
    };
  });

  // Daily task completion trend
  const days = eachDayOfInterval({ start: subDays(new Date(), 13), end: new Date() });
  const dailyTrend = days.map(day => {
    const dayStart = new Date(day.setHours(0, 0, 0, 0));
    const dayEnd = new Date(day.setHours(23, 59, 59, 999));

    const created = allTasks.filter(t => {
      const date = new Date(t.created_at);
      return isWithinInterval(date, { start: dayStart, end: dayEnd });
    }).length;

    const completed = allTasks.filter(t => {
      if (t.status !== 'Done') return false;
      const date = new Date(t.created_at);
      return isWithinInterval(date, { start: dayStart, end: dayEnd });
    }).length;

    return {
      date: format(day, 'MMM d'),
      created,
      completed
    };
  });

  // Calculate metrics
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter(t => t.status === 'Done').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const overdueTasks = allTasks.filter(t => {
    if (!t.due_date || t.status === 'Done') return false;
    return new Date(t.due_date) < new Date();
  }).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50 dark:from-[#0f1012] dark:via-[#0f1012] dark:to-[#0f1012] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reports</h1>
            <p className="text-gray-500 dark:text-slate-400 mt-1">Analytics and insights for your workspaces</p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-[#1f2229] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#14151a] text-gray-900 dark:text-white"
            >
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
              <option value="quarter">Last 90 days</option>
            </select>
            <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/80 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">Total Tasks</p>
                  <p className="text-3xl font-bold mt-1">{totalTasks}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
                  <Target className="w-6 h-6 text-primary-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">Completed</p>
                  <p className="text-3xl font-bold mt-1">{completedTasks}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">Completion Rate</p>
                  <p className="text-3xl font-bold mt-1">{completionRate}%</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">Overdue</p>
                  <p className="text-3xl font-bold mt-1 text-red-600">{overdueTasks}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white/80 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229]">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="spaces">By Space</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-2 gap-6">
              {/* Task Status Distribution */}
              <Card className="bg-white/80 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] shadow-sm">
                <CardHeader>
                  <CardTitle>Task Status Distribution</CardTitle>
                  <CardDescription>Current status of all tasks</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                      >
                        {statusChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Priority Distribution */}
              <Card className="bg-white/80 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] shadow-sm">
                <CardHeader>
                  <CardTitle>Priority Distribution</CardTitle>
                  <CardDescription>Tasks by priority level</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={priorityChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {priorityChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="spaces">
            <Card className="bg-white/80 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] shadow-sm">
              <CardHeader>
                <CardTitle>Tasks by Space</CardTitle>
                <CardDescription>Completed vs pending tasks per space</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={tasksBySpace} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="completed" stackId="a" fill="#22c55e" name="Completed" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="pending" stackId="a" fill="#94a3b8" name="Pending" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends">
            <Card className="bg-white/80 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] shadow-sm">
              <CardHeader>
                <CardTitle>Task Activity Trend</CardTitle>
                <CardDescription>Tasks created and completed over the last 2 weeks</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={dailyTrend}>
                    <defs>
                      <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="created"
                      stroke="#6366f1"
                      fillOpacity={1}
                      fill="url(#colorCreated)"
                      name="Created"
                    />
                    <Area
                      type="monotone"
                      dataKey="completed"
                      stroke="#22c55e"
                      fillOpacity={1}
                      fill="url(#colorCompleted)"
                      name="Completed"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
