import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface SpaceAccess {
  space_id: string;
  permission: string;
}

// Owner email - this user has full access even without a member record
const OWNER_EMAIL = 'yedam.venkatganesh@nxtwave.co.in';

export interface Member {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member' | 'limited_member' | 'guest' | 'owner';
  guest_permission?: 'full_edit' | 'edit' | 'view_only' | null;
  status: 'pending' | 'active' | 'offline';
  workspace_id?: string;
  space_id?: string;
  user_id?: string;
  joined_at?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  member: Member | null;
  loading: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;
  isGuest: boolean;
  isLimitedMember: boolean;
  canEdit: boolean;
  canManageMembers: boolean;
  needsSpaceAccess: boolean;
  canEditInSpace: (spaceId: string | undefined) => boolean;
  spaceAccessMap: Map<string, string>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  login: (user: User, session: Session | null, member: Member) => void;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if current user is the owner
  const isOwner = user?.email === OWNER_EMAIL;

  // Role-based permissions (owner has full access)
  const isAdmin = isOwner || member?.role === 'admin' || member?.role === 'owner';
  const isMember = isOwner || member?.role === 'member' || member?.role === 'admin' || member?.role === 'owner';
  const isGuest = !isOwner && member?.role === 'guest';
  const isLimitedMember = !isOwner && member?.role === 'limited_member';
  const canEdit = isOwner || member?.role !== 'guest' || member?.guest_permission === 'edit' || member?.guest_permission === 'full_edit';
  const canManageMembers = isOwner || member?.role === 'admin' || member?.role === 'owner';
  // Guests and limited members need explicit space access to see content
  const needsSpaceAccess = isGuest || isLimitedMember;

  // Space-level access for guests/limited members
  const [spaceAccessList, setSpaceAccessList] = useState<SpaceAccess[]>([]);
  const spaceAccessMap = useRef(new Map<string, string>());

  // Fetch space access when member changes and needs it
  useEffect(() => {
    if (!needsSpaceAccess || !member?.id) {
      setSpaceAccessList([]);
      spaceAccessMap.current = new Map();
      return;
    }
    const fetchAccess = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/space-members/member/${member.id}`);
        if (res.ok) {
          const data: SpaceAccess[] = await res.json();
          setSpaceAccessList(data);
          const map = new Map<string, string>();
          data.forEach(sa => map.set(sa.space_id, sa.permission));
          spaceAccessMap.current = map;
        }
      } catch {
        // silently fail
      }
    };
    fetchAccess();
  }, [needsSpaceAccess, member?.id]);

  // Returns true if the user can edit items in the given space
  const canEditInSpace = useCallback((spaceId: string | undefined): boolean => {
    // Owners, admins, and members can always edit
    if (!needsSpaceAccess) return true;
    if (!spaceId) return false;
    const permission = spaceAccessMap.current.get(spaceId);
    return permission === 'full_edit' || permission === 'edit';
  }, [needsSpaceAccess, spaceAccessList]); // spaceAccessList triggers re-render when data arrives

  // Track if we're using a member-based session (from our custom login)
  const usingMemberSession = useRef(false);

  useEffect(() => {
    const initAuth = async () => {
      // Check for stored member login session (from our custom login endpoint)
      // Use localStorage for persistent auth across tabs and URL navigation
      const storedSession = localStorage.getItem('session');
      const storedMember = localStorage.getItem('member');

      if (storedSession && storedMember) {
        try {
          const parsedSession = JSON.parse(storedSession);
          const parsedMember = JSON.parse(storedMember);

          // Check if session is expired
          const expiresAt = parsedSession.expires_at;
          const isExpired = expiresAt && new Date(expiresAt * 1000) < new Date();

          if (!isExpired && parsedSession.user) {
            // Valid stored session - use it
            setSession(parsedSession);
            setUser(parsedSession.user);
            setMember(parsedMember);
            usingMemberSession.current = true;
            setLoading(false);

            // Refresh member data in background to get latest (only if not custom auth)
            const isUsingCustomAuth = sessionStorage.getItem('customAuth') === 'true';
            if (!isUsingCustomAuth && parsedSession.user.id) {
              fetchMemberData(parsedSession.user.id);
            }
            return; // Don't check Supabase session
          } else {
            // Session expired, clear it
            localStorage.removeItem('session');
            localStorage.removeItem('member');
            usingMemberSession.current = false;
          }
        } catch (e) {
          localStorage.removeItem('session');
          localStorage.removeItem('member');
          usingMemberSession.current = false;
        }
      }

      // No valid stored session, check Supabase session as fallback
      const { data: { session: supabaseSession } } = await supabase.auth.getSession();
      if (supabaseSession) {
        setSession(supabaseSession);
        setUser(supabaseSession.user);
        fetchMemberData(supabaseSession.user.id);
      }
      setLoading(false);
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignore all Supabase auth events when using custom auth
      const isUsingCustomAuth = localStorage.getItem('customAuth') === 'true';
      if (isUsingCustomAuth) {
        console.log('Ignoring Supabase auth event (using custom auth):', event);
        return;
      }

      // Only handle explicit sign out events
      // Don't let other events (INITIAL_SESSION, TOKEN_REFRESHED) override our stored session
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setMember(null);
        localStorage.removeItem('session');
        localStorage.removeItem('member');
        usingMemberSession.current = false;
        setLoading(false);
      } else if (event === 'SIGNED_IN' && !usingMemberSession.current) {
        // Only handle SIGNED_IN if we're not using a member session
        // This allows for fallback Supabase auth if needed
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchMemberData(session.user.id);
        }
        setLoading(false);
      }
      // Ignore INITIAL_SESSION, TOKEN_REFRESHED, USER_UPDATED events when using member session
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchMemberData = async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/members/me/${userId}`);
      if (response.ok) {
        const memberData = await response.json();
        setMember(memberData);
        localStorage.setItem('member', JSON.stringify(memberData));
      }
    } catch (error) {
      console.error('Failed to fetch member data:', error);
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    });

    if (error) {
      if (error.message.includes('already registered')) {
        throw new Error('An account with this email already exists. Please sign in instead.');
      }
      throw error;
    }

    // Auto sign-in after registration
    if (data.user && !data.session) {
      await supabase.auth.signInWithPassword({ email, password });
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Invalid email or password. Please try again.');
      }
      throw error;
    }
  };

  // Custom login for member system
  const login = (user: User, session: Session | null, memberData: Member) => {
    setUser(user);
    setMember(memberData);

    // Handle custom auth (null session) by creating a minimal session object
    if (!session) {
      // Create a fake session for custom auth
      const customSession = {
        access_token: 'custom-auth-token',
        token_type: 'bearer',
        expires_in: 86400, // 24 hours
        expires_at: Math.floor(Date.now() / 1000) + 86400,
        refresh_token: '',
        user: user
      };
      setSession(customSession as Session);
      localStorage.setItem('session', JSON.stringify(customSession));
      localStorage.setItem('member', JSON.stringify(memberData));
      localStorage.setItem('customAuth', 'true');
    } else {
      setSession(session);
      localStorage.setItem('session', JSON.stringify(session));
      localStorage.setItem('member', JSON.stringify(memberData));
      localStorage.removeItem('customAuth');
    }

    usingMemberSession.current = true;
  };

  const signOut = async () => {
    // Update member status to offline (logged out) on the server
    if (member?.email) {
      try {
        await fetch(`${API_BASE_URL}/api/members/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: member.email })
        });
      } catch (e) {
        console.error('Failed to update logout status:', e);
      }
    }

    try {
      await supabase.auth.signOut();
    } catch (e) {
      // Ignore error if already signed out
    }
    setUser(null);
    setSession(null);
    setMember(null);
    localStorage.removeItem('session');
    localStorage.removeItem('member');
    localStorage.removeItem('customAuth');
    usingMemberSession.current = false;
  };

  const changePassword = async (newPassword: string) => {
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/api/members/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ newPassword })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to change password');
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      member,
      loading,
      isOwner,
      isAdmin,
      isMember,
      isGuest,
      isLimitedMember,
      canEdit,
      canManageMembers,
      needsSpaceAccess,
      canEditInSpace,
      spaceAccessMap: spaceAccessMap.current,
      signUp,
      signIn,
      login,
      signOut,
      changePassword
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
