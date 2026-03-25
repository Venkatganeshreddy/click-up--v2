import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek, isWithinInterval, isPast, subDays, eachDayOfInterval } from 'date-fns';
import {
  CheckCircle2, AlertTriangle, TrendingUp,
  Plus, ArrowRight, Calendar, Folder, Users, Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { supabase } from '../lib/supabase';
import { spacesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444'];

export default function Dashboard() {
  // State for workspace filter
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('all');

  // Get auth context - this already has user, member, and role info
  const { user: currentUser, member: currentMember, isGuest } = useAuth();


  // Fetch spaces
  const { data: spaces = [] } = useQuery({
    queryKey: ['spaces'],
    queryFn: spacesApi.getAll
  });

  // Fetch all tasks
  const { data: allTasks = [] } = useQuery({
    queryKey: ['all-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch members
  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    }
  });

  // Fetch lists
  const { data: lists = [] } = useQuery({
    queryKey: ['lists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lists')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    }
  });

  // Filter lists by selected workspace
  const filteredLists = selectedSpaceId === 'all'
    ? lists
    : lists.filter(l => l.space_id === selectedSpaceId);

  // Get list IDs for the selected workspace
  const listIdsInSpace = new Set(filteredLists.map(l => l.id));

  // Filter tasks by workspace first
  let workspaceTasks = selectedSpaceId === 'all'
    ? allTasks
    : allTasks.filter(t => listIdsInSpace.has(t.list_id));

  // For guests, only show tasks assigned to them
  const filteredTasks = isGuest && currentMember
    ? workspaceTasks.filter(t =>
        t.assignee_id === currentMember.id ||
        (t.assignee_ids && t.assignee_ids.includes(currentMember.id))
      )
    : workspaceTasks;

  // Filter spaces for display
  const filteredSpaces = selectedSpaceId === 'all'
    ? spaces
    : spaces.filter(s => s.id === selectedSpaceId);

  // Stats calculations (using filtered tasks)
  const completedTasks = filteredTasks.filter(t => t.status === 'Done' || t.is_completed);
  const overdueTasks = filteredTasks.filter(t =>
    t.due_date && isPast(new Date(t.due_date)) && t.status !== 'Done' && !t.is_completed
  );
  const thisWeekTasks = filteredTasks.filter(t => {
    if (!t.due_date) return false;
    const dueDate = new Date(t.due_date);
    return isWithinInterval(dueDate, {
      start: startOfWeek(new Date()),
      end: endOfWeek(new Date())
    });
  });

  // Weekly data - calculate from real tasks
  const weeklyData = (() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const weekStart = startOfWeek(today);

    return eachDayOfInterval({
      start: weekStart,
      end: today
    }).map(day => {
      const dayName = days[day.getDay()];
      const dayTasks = filteredTasks.filter(t => {
        const createdDate = new Date(t.created_at);
        return format(createdDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
      });
      const completedOnDay = filteredTasks.filter(t => {
        if (!t.updated_at || (t.status !== 'Done' && !t.is_completed)) return false;
        const updatedDate = new Date(t.updated_at);
        return format(updatedDate, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
      });

      return {
        name: dayName,
        completed: completedOnDay.length,
        created: dayTasks.length
      };
    });
  })();

  // Status distribution (using filtered tasks)
  const statusData = [
    { name: 'To Do', value: filteredTasks.filter(t => t.status === 'To Do').length },
    { name: 'In Progress', value: filteredTasks.filter(t => t.status === 'In Progress').length },
    { name: 'Review', value: filteredTasks.filter(t => t.status === 'Review').length },
    { name: 'Done', value: filteredTasks.filter(t => t.status === 'Done' || t.is_completed).length },
  ].filter(d => d.value > 0);

  const completionRate = filteredTasks.length > 0
    ? Math.round((completedTasks.length / filteredTasks.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50 dark:from-[#0f1012] dark:via-[#0f1012] dark:to-[#0f1012]">
      <div className="max-w-7xl mx-auto p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                Welcome back{currentMember?.name ? `, ${currentMember.name.split(' ')[0]}` : ''}!
              </h1>
              {isGuest && (
                <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">
                  <Eye className="w-3 h-3 mr-1" /> Guest View
                </Badge>
              )}
            </div>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              {isGuest
                ? "Showing tasks assigned to you."
                : "Here's what's happening with your projects today."}
            </p>
          </div>
          <div className="flex gap-3 items-center">
            <Select value={selectedSpaceId} onValueChange={setSelectedSpaceId}>
              <SelectTrigger className="w-[220px] bg-white dark:bg-[#14151a] border-2 border-violet-200 dark:border-[#1f2229] shadow-sm hover:border-violet-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-200">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-violet-500" />
                  <SelectValue placeholder="Select Workspace" />
                </div>
              </SelectTrigger>
              <SelectContent className="z-50 bg-white dark:bg-[#14151a] border-2 border-violet-200 dark:border-[#1f2229] shadow-lg">
                <SelectItem value="all" className="font-medium">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-violet-500 to-purple-500" />
                    All Workspaces
                  </div>
                </SelectItem>
                {spaces.map(space => (
                  <SelectItem key={space.id} value={space.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: space.color }}
                      />
                      {space.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link to="/workspace">
              <Button className="bg-violet-600 hover:bg-violet-700">
                <Plus className="w-4 h-4 mr-2" /> New Task
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-white/80 dark:bg-[#14151a]/80 backdrop-blur border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Total Tasks</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{filteredTasks.length}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-violet-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-sm">
                <span className="text-green-500 font-medium">
                  {completedTasks.length} completed
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-[#14151a]/80 backdrop-blur border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Due This Week</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{thisWeekTasks.length}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                  {thisWeekTasks.filter(t => t.status === 'Done').length} done
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-[#14151a]/80 backdrop-blur border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Overdue</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{overdueTasks.length}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center text-sm">
                <span className="text-red-500 font-medium">Needs attention</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-[#14151a]/80 backdrop-blur border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Completion Rate</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white mt-1">{completionRate}%</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <Progress value={completionRate} className="mt-3 h-2" />
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Activity Chart */}
          <Card className="lg:col-span-2 bg-white/80 dark:bg-[#14151a]/80 backdrop-blur border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold dark:text-white">Weekly Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyData}>
                    <defs>
                      <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="completed"
                      stroke="#8b5cf6"
                      fillOpacity={1}
                      fill="url(#colorCompleted)"
                    />
                    <Area
                      type="monotone"
                      dataKey="created"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorCreated)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card className="bg-white/80 dark:bg-[#14151a]/80 backdrop-blur border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold dark:text-white">Task Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData.length > 0 ? statusData : [{ name: 'No Tasks', value: 1 }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {(statusData.length > 0 ? statusData : [{ name: 'No Tasks', value: 1 }]).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {statusData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-400">{entry.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Spaces Overview */}
          <Card className="bg-white/80 dark:bg-[#14151a]/80 backdrop-blur border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold dark:text-white">Your Spaces</CardTitle>
              <Link to="/workspace">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredSpaces.slice(0, 4).map((space) => {
                  // Get lists for this space
                  const spaceListIds = new Set(lists.filter(l => l.space_id === space.id).map(l => l.id));
                  // Get tasks that belong to lists in this space
                  const spaceTasks = allTasks.filter(t => spaceListIds.has(t.list_id));
                  const completed = spaceTasks.filter(t => t.status === 'Done' || t.is_completed).length;
                  const progress = spaceTasks.length > 0
                    ? Math.round((completed / spaceTasks.length) * 100)
                    : 0;

                  return (
                    <Link
                      key={space.id}
                      to="/workspace"
                      className="block"
                    >
                      <div className="p-3 rounded-lg border border-slate-100 dark:border-[#1f2229] hover:border-violet-200 dark:hover:border-violet-700 hover:bg-violet-50/50 dark:hover:bg-slate-700/50 transition-all">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${space.color}20` }}
                          >
                            <Folder className="h-5 w-5" style={{ color: space.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-slate-900 dark:text-white">{space.name}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {filteredLists.filter(l => l.space_id === space.id).length} lists
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-violet-600">{progress}%</span>
                          </div>
                        </div>
                        <Progress value={progress} className="mt-2 h-1.5" />
                      </div>
                    </Link>
                  );
                })}
                {filteredSpaces.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-slate-400 dark:text-slate-500 mb-3">No spaces yet</p>
                    <Link to="/workspace">
                      <Button variant="outline" size="sm">
                        <Plus className="w-4 h-4 mr-1" /> Create Space
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Team Members */}
          <Card className="bg-white/80 dark:bg-[#14151a]/80 backdrop-blur border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold dark:text-white">Team Members</CardTitle>
              <Link to="/team">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {members.slice(0, 5).map((member) => (
                  <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-violet-100 text-violet-700">
                        {member.name?.charAt(0)?.toUpperCase() || member.email?.charAt(0)?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white truncate">{member.name || 'Unknown'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{member.email}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        member.role === 'admin'
                          ? 'border-violet-200 text-violet-700'
                          : member.role === 'guest'
                          ? 'border-slate-200 text-slate-600'
                          : 'border-blue-200 text-blue-700'
                      }
                    >
                      {member.role}
                    </Badge>
                  </div>
                ))}
                {members.length === 0 && (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 dark:text-slate-500 mb-3">No team members yet</p>
                    <Link to="/workspace">
                      <Button variant="outline" size="sm">
                        <Plus className="w-4 h-4 mr-1" /> Invite Member
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
