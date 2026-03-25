import { useState, useEffect, useMemo } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LogOut, CheckSquare, Home, Calendar, FileText,
  ClipboardList, Settings, FolderKanban, BarChart3, Users, GanttChart, Layers,
  Plug, Zap, TrendingUp
} from 'lucide-react';
import { Toaster } from 'sonner';

const navItems = [
  { to: '/dashboard', icon: Home, label: 'Overview' },
  { to: '/workspace', icon: Layers, label: 'Workspace' },
  { to: '/docs', icon: FileText, label: 'Docs' },
  { to: '/forms', icon: CheckSquare, label: 'Forms' },
  { to: '/sprints', icon: Zap, label: 'Sprints' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/my-tasks', icon: ClipboardList, label: 'My Tasks' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/timeline', icon: GanttChart, label: 'Timeline' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/sprint-reports', icon: TrendingUp, label: 'Sprint Reports' },
  { to: '/integrations', icon: Plug, label: 'Integrations' },
  { to: '/team', icon: Users, label: 'Team' },
];

const GUEST_HIDDEN_PATHS = new Set(['/projects', '/timeline', '/reports', '/sprint-reports', '/integrations', '/team']);

export default function Layout() {
  const { user, signOut, isGuest, isLimitedMember } = useAuth();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1012]">
      <Toaster position="bottom-right" richColors />

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-gray-900 text-white z-50 border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-4 pb-0 flex-shrink-0">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
              <CheckSquare className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold">Synergy Hub</span>
          </div>
        </div>

        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
          <nav className="space-y-1">
            {navItems.filter(item => !(isGuest || isLimitedMember) || !GUEST_HIDDEN_PATHS.has(item.to)).map(({ to, icon: Icon, label }) => {
              const isActive = location.pathname === to ||
                (to === '/projects' && location.pathname.startsWith('/projects'));

              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Divider */}
          <div className="my-4 border-t border-gray-700" />

          {/* Settings */}
          {!(isGuest || isLimitedMember) && (
            <Link
              to="/settings"
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                location.pathname === '/settings'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Settings className="h-5 w-5" />
              <span className="font-medium">Settings</span>
            </Link>
          )}
        </div>

        {/* User info at bottom - always visible */}
        <div className="flex-shrink-0 p-4 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-medium">
                  {user?.user_metadata?.name?.charAt(0)?.toUpperCase() ||
                   user?.email?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="truncate">
                <p className="text-sm font-medium truncate">
                  {user?.user_metadata?.name || 'User'}
                </p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 min-h-screen bg-gray-50 dark:bg-[#0f1012]">
        <Outlet />
      </main>
    </div>
  );
}
