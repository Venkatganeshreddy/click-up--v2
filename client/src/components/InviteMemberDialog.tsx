import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, ChevronDown, Check, User, Shield, Users, Eye, EyeOff, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: string;
  spaceId?: string;
}

const roles = [
  {
    value: 'member',
    label: 'Member',
    description: 'Can access all public items in your Workspace.',
    icon: User,
  },
  {
    value: 'limited_member',
    label: 'Limited Member',
    description: 'Can only access items shared with them.',
    icon: Users,
  },
  {
    value: 'guest',
    label: 'Guest',
    description: 'Access depends on workspace permission set by admin/member.',
    icon: User,
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'Can manage Spaces, People, Billing and other Workspace settings.',
    icon: Shield,
  },
];

const guestPermissionOptions = [
  { value: 'full_edit', label: 'Full edit', description: 'Can create, edit, and manage items in allowed workspace areas.' },
  { value: 'edit', label: 'Edit', description: 'Can create and edit items in allowed workspace areas.' },
  { value: 'view_only', label: 'View only', description: 'Can view items but cannot make changes.' },
];

// Generate random password
const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

export default function InviteMemberDialog({ open, onOpenChange, workspaceId, spaceId }: InviteMemberDialogProps) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(generatePassword());
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('member');
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [guestPermission, setGuestPermission] = useState<'full_edit' | 'edit' | 'view_only'>('view_only');

  const selectedRole = roles.find(r => r.value === role) || roles[0];

  // Get auth token from sessionStorage
  const getAuthToken = (): string | null => {
    if (session?.access_token) return session.access_token;
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

  const createMemberMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      name: string;
      password: string;
      role: string;
      workspace_id?: string;
      space_id?: string;
      guest_permission?: 'full_edit' | 'edit' | 'view_only';
    }) => {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/api/members/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create member');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success(data.message || 'Member created successfully');
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create member');
    }
  });

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword(generatePassword());
    setRole('member');
    setGuestPermission('view_only');
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Please enter the member name');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    createMemberMutation.mutate({
      email: email.trim(),
      name: name.trim(),
      password,
      role,
      guest_permission: role === 'guest' ? guestPermission : undefined,
      workspace_id: workspaceId,
      space_id: spaceId
    });
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(password);
    toast.success('Password copied to clipboard');
  };

  const regeneratePassword = () => {
    setPassword(generatePassword());
    toast.success('New password generated');
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] max-h-[90vh] bg-[#13141a] border border-violet-500/30 rounded-2xl shadow-[0_0_60px_rgba(139,92,246,0.15)] z-50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-violet-600/20 via-fuchsia-600/10 to-transparent border-b border-violet-500/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <User className="w-4.5 h-4.5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">Add New Member</h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-violet-300 mb-1.5">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter member's full name"
              className="w-full px-3.5 py-2.5 bg-[#1a1b26] border border-slate-700/80 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
            />
          </div>

          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-violet-300 mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter member's email"
              className="w-full px-3.5 py-2.5 bg-[#1a1b26] border border-slate-700/80 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
            />
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-sm font-medium text-violet-300 mb-1.5">Default Password</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-3.5 py-2.5 pr-10 bg-[#1a1b26] border border-slate-700/80 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 font-mono transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={copyPassword}
                className="px-3 py-2.5 bg-[#1a1b26] border border-slate-700/80 rounded-lg text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all"
                title="Copy password"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={regeneratePassword}
                className="px-3 py-2.5 bg-[#1a1b26] border border-slate-700/80 rounded-lg text-slate-400 hover:text-emerald-300 hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-all"
                title="Generate new password"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Member will receive this password via email and can change it after login.
            </p>
          </div>

          {/* Role Selector */}
          <div>
            <label className="block text-sm font-medium text-violet-300 mb-1.5">Role</label>
            <div className="relative">
              <button
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 bg-[#1a1b26] border border-slate-700/80 rounded-lg text-left hover:border-violet-500/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    role === 'admin' ? "bg-gradient-to-br from-amber-500 to-orange-500" :
                    role === 'member' ? "bg-gradient-to-br from-violet-500 to-indigo-500" :
                    role === 'limited_member' ? "bg-gradient-to-br from-sky-500 to-blue-500" :
                    "bg-gradient-to-br from-slate-500 to-slate-600"
                  )}>
                    <selectedRole.icon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-white font-semibold flex items-center gap-1.5">
                      {selectedRole.label}
                      <ChevronDown className={cn("w-4 h-4 text-violet-400 transition-transform", showRoleDropdown && "rotate-180")} />
                    </div>
                    <div className="text-xs text-slate-400">{selectedRole.description}</div>
                  </div>
                </div>
              </button>

              {/* Role Dropdown */}
              {showRoleDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1b26] border border-violet-500/30 rounded-xl shadow-2xl shadow-violet-500/10 z-10 overflow-hidden">
                  {roles.map((r) => {
                    const gradientClass =
                      r.value === 'admin' ? "from-amber-500 to-orange-500" :
                      r.value === 'member' ? "from-violet-500 to-indigo-500" :
                      r.value === 'limited_member' ? "from-sky-500 to-blue-500" :
                      "from-slate-500 to-slate-600";
                    return (
                      <button
                        key={r.value}
                        onClick={() => {
                          setRole(r.value);
                          setShowRoleDropdown(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-violet-500/10 transition-colors",
                          role === r.value && "bg-violet-500/15"
                        )}
                      >
                        <div className={cn("w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center flex-shrink-0", gradientClass)}>
                          <r.icon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium text-sm">{r.label}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{r.description}</div>
                        </div>
                        {role === r.value && (
                          <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {role === 'guest' && (
            <div>
              <label className="block text-sm font-medium text-violet-300 mb-1.5">Guest Workspace Access</label>
              <select
                value={guestPermission}
                onChange={(e) => setGuestPermission(e.target.value as 'full_edit' | 'edit' | 'view_only')}
                className="w-full px-3.5 py-2.5 bg-[#1a1b26] border border-slate-700/80 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
              >
                {guestPermissionOptions.map(option => (
                  <option key={option.value} value={option.value} className="bg-[#1a1b26]">
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1.5">
                {guestPermissionOptions.find(option => option.value === guestPermission)?.description}
              </p>
            </div>
          )}

          {/* Role Permissions Info */}
          <div className={cn(
            "rounded-xl p-3.5 border",
            role === 'admin' ? "bg-amber-500/5 border-amber-500/20" :
            role === 'member' ? "bg-violet-500/5 border-violet-500/20" :
            role === 'limited_member' ? "bg-sky-500/5 border-sky-500/20" :
            "bg-slate-500/5 border-slate-500/20"
          )}>
            <h4 className={cn(
              "text-sm font-semibold mb-2",
              role === 'admin' ? "text-amber-400" :
              role === 'member' ? "text-violet-400" :
              role === 'limited_member' ? "text-sky-400" :
              "text-slate-400"
            )}>Role Permissions</h4>
            <div className="text-xs text-slate-300 space-y-1">
              {role === 'admin' && (
                <>
                  <p>• Full access to all workspaces and settings</p>
                  <p>• Can manage members, roles, and permissions</p>
                  <p>• Can create, edit, and delete all items</p>
                </>
              )}
              {role === 'member' && (
                <>
                  <p>• Can access all public items in workspaces</p>
                  <p>• Can create and edit tasks</p>
                  <p>• Cannot manage workspace settings</p>
                </>
              )}
              {role === 'limited_member' && (
                <>
                  <p>• Can only access items shared with them</p>
                  <p>• Can edit tasks assigned to them</p>
                  <p>• Limited view of workspace</p>
                </>
              )}
              {role === 'guest' && (
                <>
                  {guestPermission === 'full_edit' && <p>• Full edit access in permitted workspace areas</p>}
                  {guestPermission === 'edit' && <p>• Edit access in permitted workspace areas</p>}
                  {guestPermission === 'view_only' && <p>• View-only access in permitted workspace areas</p>}
                  <p>• Access scope is controlled by admin/member assignments</p>
                  <p>• Workspace visibility still depends on explicit sharing/access</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-violet-500/20 bg-[#111219]">
          <button
            onClick={() => onOpenChange(false)}
            className="px-5 py-2 text-sm text-slate-300 hover:text-white border border-slate-700/80 rounded-lg hover:bg-white/5 transition-all font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMemberMutation.isPending || !name.trim() || !email.trim()}
            className="px-5 py-2 text-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-lg hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-semibold shadow-lg shadow-violet-500/25"
          >
            {createMemberMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              'Create Member'
            )}
          </button>
        </div>
      </div>
    </>
  );
}
