import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, Users, Mail } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface InviteDetails {
  email: string;
  role: string;
  workspace_name?: string;
}

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'accepting' | 'success' | 'error'>('loading');
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  // Verify the token on mount
  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setError('No invitation token provided');
      return;
    }

    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/members/invite/verify/${token}`);
      const data = await response.json();

      if (response.ok && data.valid) {
        setInviteDetails({
          email: data.email,
          role: data.role,
          workspace_name: data.workspace_name
        });
        setStatus('valid');
      } else {
        setStatus('invalid');
        setError(data.error || 'Invalid or expired invitation');
      }
    } catch (err) {
      setStatus('invalid');
      setError('Failed to verify invitation. Please try again.');
    }
  };

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    setStatus('accepting');
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/members/invite/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name: name.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else {
        setStatus('valid');
        setError(data.error || 'Failed to accept invitation');
      }
    } catch (err) {
      setStatus('valid');
      setError('Failed to accept invitation. Please try again.');
    }
  };

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      admin: 'Admin',
      member: 'Member',
      limited_member: 'Limited Member',
      guest: 'Guest'
    };
    return roles[role] || role;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1012] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-600 to-pink-500 rounded-2xl mx-auto flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ClickUp Clone</h1>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-[#14151a] rounded-2xl shadow-xl overflow-hidden">
          {/* Loading State */}
          {status === 'loading' && (
            <div className="p-8 text-center">
              <Loader2 className="w-12 h-12 text-violet-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-900 dark:text-white font-medium">Verifying invitation...</p>
              <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Please wait while we check your invitation</p>
            </div>
          )}

          {/* Invalid Token */}
          {status === 'invalid' && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Invalid Invitation</h2>
              <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">{error}</p>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
              >
                Go to Home
              </button>
            </div>
          )}

          {/* Valid Token - Show Form */}
          {(status === 'valid' || status === 'accepting') && inviteDetails && (
            <form onSubmit={handleAccept}>
              <div className="p-6 border-b border-gray-200 dark:border-[#1f2229]">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Accept Invitation</h2>
                <p className="text-gray-500 dark:text-slate-400 text-sm">You've been invited to join the workspace</p>
              </div>

              <div className="p-6 space-y-4">
                {/* Invite Details */}
                <div className="bg-gray-100 dark:bg-[#14151a] rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-600/20 rounded-lg flex items-center justify-center">
                      <Mail className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Email</p>
                      <p className="text-gray-900 dark:text-white font-medium">{inviteDetails.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Role</p>
                      <p className="text-gray-900 dark:text-white font-medium">{getRoleLabel(inviteDetails.role)}</p>
                    </div>
                  </div>
                </div>

                {/* Name Input */}
                <div>
                  <label className="block text-sm text-gray-500 dark:text-slate-400 mb-2">Your Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full px-4 py-3 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    disabled={status === 'accepting'}
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}
              </div>

              <div className="p-6 pt-0">
                <button
                  type="submit"
                  disabled={status === 'accepting'}
                  className="w-full py-3 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {status === 'accepting' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    'Accept Invitation'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Success State */}
          {status === 'success' && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Welcome to the Team!</h2>
              <p className="text-gray-500 dark:text-slate-400 text-sm mb-2">Your invitation has been accepted successfully.</p>
              <p className="text-gray-400 dark:text-slate-500 text-xs">Redirecting to dashboard...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-400 dark:text-slate-500 text-sm mt-6">
          Need help? Contact your workspace administrator.
        </p>
      </div>
    </div>
  );
}
