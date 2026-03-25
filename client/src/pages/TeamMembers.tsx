import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Mail, MoreVertical, Search, Trash2, RefreshCw,
  Shield, UserPlus, Crown, UserCheck, Clock, CheckCircle2,
  User, ChevronDown, X, WifiOff
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '../context/AuthContext';
import InviteMemberDialog from '../components/InviteMemberDialog';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface Member {
  id: string;
  email: string;
  name: string;
  role: 'member' | 'limited_member' | 'guest' | 'admin';
  status: 'pending' | 'active' | 'offline';
  workspace_id?: string;
  space_id?: string;
  invited_at: string;
  joined_at?: string;
}

const roleConfig = {
  admin: { label: 'Admin', color: 'bg-violet-600', icon: Shield, description: 'Full access' },
  member: { label: 'Member', color: 'bg-blue-600', icon: UserCheck, description: 'Standard access' },
  limited_member: { label: 'Limited', color: 'bg-slate-600', icon: User, description: 'Limited access' },
  guest: { label: 'Guest', color: 'bg-gray-600', icon: User, description: 'Access by permission' }
};

const statusConfig = {
  pending: { label: 'Pending', color: 'bg-amber-600', icon: Clock },
  active: { label: 'Active', color: 'bg-green-600', icon: CheckCircle2 },
  offline: { label: 'Offline', color: 'bg-slate-600', icon: WifiOff }
};

// Get auth token from sessionStorage (fallback)
const getAuthTokenFromStorage = (): string | null => {
  try {
    const session = localStorage.getItem('session');
    if (session) {
      const parsed = JSON.parse(session);
      return parsed.access_token;
    }
  } catch (e) {
    console.error('Failed to get auth token');
  }
  return null;
};

export default function TeamMembers() {
  const { user, canManageMembers, isOwner, isAdmin, session } = useAuth();
  const authToken = session?.access_token || getAuthTokenFromStorage();
  const membersApi = {
    getAll: async (): Promise<Member[]> => {
      const res = await fetch(`${API_BASE_URL}/api/members`);
      if (!res.ok) throw new Error('Failed to fetch members');
      return res.json();
    },
    delete: async (id: string): Promise<void> => {
      const res = await fetch(`${API_BASE_URL}/api/members/${id}`, {
        method: 'DELETE',
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove member');
      }
    },
    resendInvite: async (id: string): Promise<void> => {
      const res = await fetch(`${API_BASE_URL}/api/members/${id}/resend`, {
        method: 'POST',
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      });
      if (!res.ok) throw new Error('Failed to resend invitation');
    },
    updateRole: async (id: string, role: string): Promise<void> => {
      const res = await fetch(`${API_BASE_URL}/api/members/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({ role })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update role');
      }
    }
  };
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'offline' | 'pending'>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuId]);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: membersApi.getAll
  });

  const deleteMutation = useMutation({
    mutationFn: membersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('Member removed successfully');
    },
    onError: () => toast.error('Failed to remove member')
  });

  const resendMutation = useMutation({
    mutationFn: membersApi.resendInvite,
    onSuccess: () => toast.success('Invitation resent successfully'),
    onError: () => toast.error('Failed to resend invitation')
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => membersApi.updateRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('Role updated successfully');
    },
    onError: () => toast.error('Failed to update role')
  });

  // Filter members
  const filteredMembers = members.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' ||
      (activeTab === 'active' && member.status === 'active') ||
      (activeTab === 'offline' && member.status === 'offline') ||
      (activeTab === 'pending' && member.status === 'pending');
    return matchesSearch && matchesTab;
  });

  const activeCount = members.filter(m => m.status === 'active').length;
  const offlineCount = members.filter(m => m.status === 'offline').length;
  const pendingCount = members.filter(m => m.status === 'pending').length;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1012] text-gray-900 dark:text-white">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-[#2a2b36] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Team Members</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Manage your team and permissions</p>
          </div>
          {canManageMembers && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Invite People
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-white dark:bg-[#14151a] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-600/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{members.length}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">Total Members</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#14151a] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">Online</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#14151a] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-600/20 flex items-center justify-center">
                <WifiOff className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{offlineCount}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">Offline</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#14151a] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-600/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">Pending</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#14151a] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{members.filter(m => m.role === 'admin').length}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">Admins</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs and Search */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1 bg-white dark:bg-[#14151a] p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('all')}
              className={cn(
                "px-4 py-2 text-sm rounded-md transition-colors",
                activeTab === 'all' ? "bg-violet-600 text-white" : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              All ({members.length})
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={cn(
                "px-4 py-2 text-sm rounded-md transition-colors",
                activeTab === 'active' ? "bg-violet-600 text-white" : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              Online ({activeCount})
            </button>
            <button
              onClick={() => setActiveTab('offline')}
              className={cn(
                "px-4 py-2 text-sm rounded-md transition-colors",
                activeTab === 'offline' ? "bg-violet-600 text-white" : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              Offline ({offlineCount})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={cn(
                "px-4 py-2 text-sm rounded-md transition-colors",
                activeTab === 'pending' ? "bg-violet-600 text-white" : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              Pending ({pendingCount})
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-slate-400" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-10 pr-4 py-2 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        {/* Members Table */}
        <div className="bg-white dark:bg-[#14151a] rounded-xl overflow-visible">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-5 py-4 bg-gray-100 dark:bg-[#232430] rounded-t-xl border-b border-gray-200 dark:border-[#1f2229] text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
            <div className="col-span-4">Member</div>
            <div className="col-span-2">Role</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Joined</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {/* Table Body */}
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-gray-500 dark:text-slate-400">Loading members...</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-slate-400">
                {searchQuery ? 'No members found matching your search' : 'No team members yet. Invite someone to get started!'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-[#3a3b46]">
              {filteredMembers.map((member) => {
                const role = roleConfig[member.role] || roleConfig.member;
                const status = statusConfig[member.status] || statusConfig.offline;
                const RoleIcon = role.icon;
                const StatusIcon = status.icon;

                return (
                  <div
                    key={member.id}
                    className="grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-[#3a3b46]/40 transition-colors group"
                  >
                    {/* Member Info */}
                    <div className="col-span-4 flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-violet-600 text-white">
                          {member.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{member.name}</p>
                        <p className="text-sm text-gray-500 dark:text-slate-400">{member.email}</p>
                      </div>
                    </div>

                    {/* Role */}
                    <div className="col-span-2">
                      <div className="relative" ref={openMenuId === `role-${member.id}` ? dropdownRef : null}>
                        {canManageMembers ? (
                          <>
                            <button
                              onClick={() => setOpenMenuId(openMenuId === `role-${member.id}` ? null : `role-${member.id}`)}
                              className={cn(
                                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90",
                                role.color
                              )}
                            >
                              <RoleIcon className="w-3.5 h-3.5" />
                              {role.label}
                              <ChevronDown className={cn(
                                "w-3.5 h-3.5 transition-transform",
                                openMenuId === `role-${member.id}` && "rotate-180"
                              )} />
                            </button>
                            {openMenuId === `role-${member.id}` && (
                              <div className="absolute top-full left-0 mt-2 w-56 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-xl shadow-2xl z-50 overflow-hidden">
                                <div className="py-1">
                                  {Object.entries(roleConfig).map(([key, config]) => (
                                    <button
                                      key={key}
                                      onClick={() => {
                                        updateRoleMutation.mutate({ id: member.id, role: key });
                                        setOpenMenuId(null);
                                      }}
                                      className={cn(
                                        "w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors",
                                        member.role === key
                                          ? "bg-violet-600/20 border-l-2 border-violet-500"
                                          : "hover:bg-white dark:hover:bg-[#2a2b36] border-l-2 border-transparent"
                                      )}
                                    >
                                      <div className={cn(
                                        "w-8 h-8 rounded-lg flex items-center justify-center",
                                        config.color + "/20"
                                      )}>
                                        <config.icon className={cn(
                                          "w-4 h-4",
                                          member.role === key ? "text-violet-400" : "text-gray-500 dark:text-slate-400"
                                        )} />
                                      </div>
                                      <div className="flex-1">
                                        <p className={cn(
                                          "font-medium",
                                          member.role === key ? "text-violet-300" : "text-gray-900 dark:text-white"
                                        )}>{config.label}</p>
                                        <p className="text-xs text-slate-500">{config.description}</p>
                                      </div>
                                      {member.role === key && (
                                        <CheckCircle2 className="w-4 h-4 text-violet-400" />
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white",
                            role.color
                          )}>
                            <RoleIcon className="w-3.5 h-3.5" />
                            {role.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="col-span-2">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white",
                        status.color
                      )}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {status.label}
                      </span>
                    </div>

                    {/* Joined Date */}
                    <div className="col-span-2 text-sm text-gray-500 dark:text-slate-400">
                      {member.joined_at ? formatDate(member.joined_at) : `Invited ${formatDate(member.invited_at)}`}
                    </div>

                    {/* Actions - Only visible to Owner/Admin */}
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      {canManageMembers && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {member.status === 'pending' && (
                            <button
                              onClick={() => resendMutation.mutate(member.id)}
                              disabled={resendMutation.isPending}
                              className="p-2 text-gray-500 dark:text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                              title="Resend invitation"
                            >
                              <RefreshCw className={cn("w-4 h-4", resendMutation.isPending && "animate-spin")} />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm('Are you sure you want to remove this member?')) {
                                deleteMutation.mutate(member.id);
                              }
                            }}
                            className="p-2 text-gray-500 dark:text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            title="Remove member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Current User Info */}
        {user && (
          <div className="mt-6 p-4 bg-white dark:bg-[#14151a] rounded-xl">
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-2">Logged in as</p>
            <div className="flex items-center gap-3">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-violet-600 text-white text-sm">
                  {user.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{user.user_metadata?.name || 'You'}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">{user.email}</p>
              </div>
              <span className="ml-auto px-2 py-1 bg-violet-600 text-white text-xs rounded-full">Owner</span>
            </div>
          </div>
        )}
      </div>

      {/* Invite Dialog */}
      <InviteMemberDialog
        open={showInviteModal}
        onOpenChange={setShowInviteModal}
      />
    </div>
  );
}
