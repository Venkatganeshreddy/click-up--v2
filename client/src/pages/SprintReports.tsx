import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, AreaChart, Area
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Zap,
  Users,
  Download
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

interface Sprint {
  id: string;
  name: string;
  goal?: string;
  start_date?: string;
  end_date?: string;
  status: 'PLANNING' | 'ACTIVE' | 'COMPLETED';
  created_at: string;
}

interface SprintTask {
  id: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  story_points?: number;
  sprint_id?: string;
  assignee_name?: string;
  created_at: string;
}

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const STATUS_COLORS: Record<string, string> = {
  'TODO': '#94a3b8',
  'IN_PROGRESS': '#3b82f6',
  'IN_REVIEW': '#f59e0b',
  'DONE': '#22c55e'
};

export default function SprintReports() {
  const [selectedSprintId, setSelectedSprintId] = useState<string>('all');

  // Fetch sprints
  const { data: sprints = [] } = useQuery({
    queryKey: ['sprint-reports-sprints'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sprints')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    }
  });

  // Fetch tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['sprint-reports-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .not('sprint_id', 'is', null);
      if (error) return [];
      return data || [];
    }
  });

  const completedSprints = sprints.filter((s: Sprint) => s.status === 'COMPLETED');
  const activeSprint = sprints.find((s: Sprint) => s.status === 'ACTIVE');

  // Filter tasks based on selection
  const filteredTasks = selectedSprintId === 'all'
    ? tasks
    : tasks.filter((t: SprintTask) => t.sprint_id === selectedSprintId);

  // Calculate velocity (story points per sprint)
  const velocityData = completedSprints.map((sprint: Sprint) => {
    const sprintTasks = tasks.filter((t: SprintTask) => t.sprint_id === sprint.id);
    const completedPoints = sprintTasks
      .filter((t: SprintTask) => t.status === 'DONE')
      .reduce((sum: number, t: SprintTask) => sum + (t.story_points || 0), 0);
    const totalPoints = sprintTasks.reduce((sum: number, t: SprintTask) => sum + (t.story_points || 0), 0);

    return {
      name: sprint.name,
      completed: completedPoints,
      total: totalPoints,
      completionRate: totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0
    };
  });

  // Average velocity
  const avgVelocity = velocityData.length > 0
    ? Math.round(velocityData.reduce((sum, v) => sum + v.completed, 0) / velocityData.length)
    : 0;

  // Tasks by status distribution
  const statusDistribution = filteredTasks.reduce((acc: Record<string, number>, task: SprintTask) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {});

  const statusChartData = Object.entries(statusDistribution).map(([status, count]) => ({
    name: status.replace('_', ' '),
    value: count,
    color: STATUS_COLORS[status] || '#94a3b8'
  }));

  // Team performance (tasks completed by assignee)
  const teamPerformance = filteredTasks.reduce((acc: Record<string, { completed: number; total: number; points: number }>, task: SprintTask) => {
    const assignee = task.assignee_name || 'Unassigned';
    if (!acc[assignee]) {
      acc[assignee] = { completed: 0, total: 0, points: 0 };
    }
    acc[assignee].total += 1;
    if (task.status === 'DONE') {
      acc[assignee].completed += 1;
      acc[assignee].points += task.story_points || 0;
    }
    return acc;
  }, {});

  const teamChartData = Object.entries(teamPerformance).map((entry) => {
    const [name, data] = entry as [string, { completed: number; total: number; points: number }];
    return {
      name: name.length > 12 ? name.substring(0, 12) + '...' : name,
      fullName: name,
      completed: data.completed,
      pending: data.total - data.completed,
      points: data.points,
      completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0
    };
  });

  // Sprint burndown (simulated for active sprint)
  const burndownData = activeSprint ? (() => {
    const sprintTasks = tasks.filter((t: SprintTask) => t.sprint_id === activeSprint.id);
    const totalPoints = sprintTasks.reduce((sum: number, t: SprintTask) => sum + (t.story_points || 0), 0);
    const completedPoints = sprintTasks
      .filter((t: SprintTask) => t.status === 'DONE')
      .reduce((sum: number, t: SprintTask) => sum + (t.story_points || 0), 0);

    const startDate = activeSprint.start_date ? new Date(activeSprint.start_date) : new Date();
    const endDate = activeSprint.end_date ? new Date(activeSprint.end_date) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const totalDays = differenceInDays(endDate, startDate) || 14;
    const daysPassed = Math.min(differenceInDays(new Date(), startDate), totalDays);

    return Array.from({ length: totalDays + 1 }, (_, i) => {
      const idealRemaining = totalPoints - (totalPoints / totalDays) * i;
      const actualRemaining = i <= daysPassed
        ? totalPoints - (completedPoints / Math.max(daysPassed, 1)) * i
        : null;

      return {
        day: `Day ${i}`,
        ideal: Math.round(idealRemaining),
        actual: actualRemaining !== null ? Math.round(actualRemaining) : undefined
      };
    });
  })() : [];

  // Overall metrics
  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter((t: SprintTask) => t.status === 'DONE').length;
  const totalPoints = filteredTasks.reduce((sum: number, t: SprintTask) => sum + (t.story_points || 0), 0);
  const completedPoints = filteredTasks
    .filter((t: SprintTask) => t.status === 'DONE')
    .reduce((sum: number, t: SprintTask) => sum + (t.story_points || 0), 0);

  const exportReport = () => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      sprint: selectedSprintId === 'all' ? 'All Sprints' : sprints.find((s: Sprint) => s.id === selectedSprintId)?.name,
      metrics: {
        totalTasks,
        completedTasks,
        totalPoints,
        completedPoints,
        avgVelocity
      },
      velocityData,
      teamPerformance: teamChartData
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sprint-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sprint Reports</h1>
          <p className="text-muted-foreground">Analytics and insights for sprint performance</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={selectedSprintId}
            onChange={(e) => setSelectedSprintId(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-[#1f2229] rounded-lg bg-white dark:bg-[#14151a] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Sprints</option>
            {[...sprints].sort((a, b) => {
              const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
              const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
              return dateB - dateA;
            }).map((sprint: Sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name} ({sprint.status})
              </option>
            ))}
          </select>
          <Button onClick={exportReport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sprints</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sprints.length}</div>
            <p className="text-xs text-muted-foreground">
              {completedSprints.length} completed
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Velocity</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgVelocity}</div>
            <p className="text-xs text-muted-foreground">
              story points/sprint
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Points Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedPoints}/{totalPoints}</div>
            <div className="w-full bg-secondary rounded-full h-2 mt-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Task Completion</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {completedTasks} of {totalTasks} tasks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="velocity" className="space-y-4">
        <TabsList className="bg-white/80 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229]">
          <TabsTrigger value="velocity">Velocity</TabsTrigger>
          <TabsTrigger value="burndown">Burndown</TabsTrigger>
          <TabsTrigger value="team">Team Performance</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
        </TabsList>

        <TabsContent value="velocity" className="space-y-4">
          <Card className="bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229]">
            <CardHeader>
              <CardTitle>Sprint Velocity</CardTitle>
              <CardDescription>Story points completed per sprint</CardDescription>
            </CardHeader>
            <CardContent>
              {velocityData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No completed sprints yet</p>
                  <p className="text-sm">Complete sprints to see velocity data</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={velocityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="completed" fill="#22c55e" name="Completed Points" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="total" fill="#94a3b8" name="Total Points" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="burndown" className="space-y-4">
          <Card className="bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229]">
            <CardHeader>
              <CardTitle>Sprint Burndown</CardTitle>
              <CardDescription>
                {activeSprint ? `Active Sprint: ${activeSprint.name}` : 'No active sprint'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!activeSprint ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active sprint</p>
                  <p className="text-sm">Start a sprint to see burndown chart</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={burndownData}>
                    <defs>
                      <linearGradient id="colorIdeal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="ideal"
                      stroke="#94a3b8"
                      fillOpacity={1}
                      fill="url(#colorIdeal)"
                      name="Ideal Burndown"
                      strokeDasharray="5 5"
                    />
                    <Area
                      type="monotone"
                      dataKey="actual"
                      stroke="#6366f1"
                      fillOpacity={1}
                      fill="url(#colorActual)"
                      name="Actual Burndown"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <Card className="bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229]">
            <CardHeader>
              <CardTitle>Team Performance</CardTitle>
              <CardDescription>Task completion by team member</CardDescription>
            </CardHeader>
            <CardContent>
              {teamChartData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No team data available</p>
                  <p className="text-sm">Assign tasks to team members to see performance</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={teamChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip
                      formatter={(value, name, props) => [value, name]}
                      labelFormatter={(label) => teamChartData.find(t => t.name === label)?.fullName || label}
                    />
                    <Legend />
                    <Bar dataKey="completed" stackId="a" fill="#22c55e" name="Completed" />
                    <Bar dataKey="pending" stackId="a" fill="#94a3b8" name="Pending" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <Card className="bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229]">
              <CardHeader>
                <CardTitle>Task Status Distribution</CardTitle>
                <CardDescription>Current status of sprint tasks</CardDescription>
              </CardHeader>
              <CardContent>
                {statusChartData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No tasks in sprints</p>
                  </div>
                ) : (
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
                )}
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229]">
              <CardHeader>
                <CardTitle>Sprint Completion Rates</CardTitle>
                <CardDescription>Task completion per sprint</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sprints.slice(0, 5).map((sprint: Sprint) => {
                    const sprintTasks = tasks.filter((t: SprintTask) => t.sprint_id === sprint.id);
                    const completed = sprintTasks.filter((t: SprintTask) => t.status === 'DONE').length;
                    const total = sprintTasks.length;
                    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

                    return (
                      <div key={sprint.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{sprint.name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant={sprint.status === 'ACTIVE' ? 'default' : sprint.status === 'COMPLETED' ? 'secondary' : 'outline'}>
                              {sprint.status}
                            </Badge>
                            <span className="text-sm text-muted-foreground">{rate}%</span>
                          </div>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {sprints.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No sprints created yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
