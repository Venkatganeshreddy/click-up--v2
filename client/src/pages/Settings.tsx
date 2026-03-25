import { useState } from 'react';
import { User, Bell, Shield, LogOut, Save, Eye, EyeOff, Key, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '../context/AuthContext';
import { Toaster, toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const roleLabels: Record<string, { label: string; color: string }> = {
  owner: { label: 'Owner', color: 'bg-gradient-to-r from-violet-600 to-pink-500' },
  admin: { label: 'Admin', color: 'bg-violet-600' },
  member: { label: 'Member', color: 'bg-blue-600' },
  limited_member: { label: 'Limited Member', color: 'bg-slate-600' },
  guest: { label: 'Guest', color: 'bg-gray-600' }
};

export default function Settings() {
  const navigate = useNavigate();
  const { user, member, isOwner, signOut, changePassword } = useAuth();
  const [profile, setProfile] = useState({
    full_name: member?.name || user?.user_metadata?.name || '',
    email: member?.email || user?.email || '',
    job_title: '',
    department: '',
  });

  const [notifications, setNotifications] = useState({
    email_tasks: true,
    email_comments: true,
    email_mentions: true,
    push_tasks: true,
    push_comments: true,
    push_mentions: true
  });

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleSaveProfile = () => {
    toast.success('Profile updated successfully');
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in both password fields');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsChangingPassword(true);

    try {
      await changePassword(newPassword);
      toast.success('Password changed successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      toast.error('Failed to log out');
    }
  };

  const roleInfo = isOwner ? roleLabels.owner : (member?.role ? roleLabels[member.role] : null);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1012] p-6">
      <Toaster position="bottom-right" richColors />
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">Manage your account preferences</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="bg-white dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229]">
            <TabsTrigger value="profile" className="gap-2 data-[state=active]:bg-violet-600 data-[state=active]:text-white">
              <User className="w-4 h-4" /> Profile
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2 data-[state=active]:bg-violet-600 data-[state=active]:text-white">
              <Bell className="w-4 h-4" /> Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2 data-[state=active]:bg-violet-600 data-[state=active]:text-white">
              <Shield className="w-4 h-4" /> Security
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="bg-white dark:bg-[#14151a] border-gray-200 dark:border-[#1f2229]">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Profile Information</CardTitle>
                <CardDescription className="text-gray-500 dark:text-slate-400">Update your personal details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src="" />
                    <AvatarFallback className="text-2xl bg-violet-600 text-white">
                      {profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <button className="px-4 py-2 border border-gray-200 dark:border-[#1f2229] rounded-lg hover:bg-gray-100 dark:hover:bg-[#3a3b46] text-gray-900 dark:text-white transition-colors">
                      Change Photo
                    </button>
                    {roleInfo && (
                      <div className="mt-2">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-white ${roleInfo.color}`}>
                          {roleInfo.label}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profile.full_name}
                      onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={profile.email}
                      disabled
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-400 dark:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">
                      Job Title
                    </label>
                    <input
                      type="text"
                      value={profile.job_title}
                      onChange={(e) => setProfile({ ...profile, job_title: e.target.value })}
                      placeholder="e.g., Product Manager"
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      value={profile.department}
                      onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                      placeholder="e.g., Engineering"
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSaveProfile}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                >
                  <Save className="w-4 h-4" /> Save Changes
                </button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card className="bg-white dark:bg-[#14151a] border-gray-200 dark:border-[#1f2229]">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Notification Preferences</CardTitle>
                <CardDescription className="text-gray-500 dark:text-slate-400">Choose how you want to be notified</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-4">Email Notifications</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Task Updates</p>
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                          Get notified when tasks are assigned or updated
                        </p>
                      </div>
                      <Switch
                        checked={notifications.email_tasks}
                        onCheckedChange={(c) =>
                          setNotifications({ ...notifications, email_tasks: c })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Comments</p>
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                          Get notified about new comments on your tasks
                        </p>
                      </div>
                      <Switch
                        checked={notifications.email_comments}
                        onCheckedChange={(c) =>
                          setNotifications({ ...notifications, email_comments: c })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Mentions</p>
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                          Get notified when someone mentions you
                        </p>
                      </div>
                      <Switch
                        checked={notifications.email_mentions}
                        onCheckedChange={(c) =>
                          setNotifications({ ...notifications, email_mentions: c })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-4">Push Notifications</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Task Updates</p>
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                          Browser notifications for task updates
                        </p>
                      </div>
                      <Switch
                        checked={notifications.push_tasks}
                        onCheckedChange={(c) =>
                          setNotifications({ ...notifications, push_tasks: c })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Comments</p>
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                          Browser notifications for new comments
                        </p>
                      </div>
                      <Switch
                        checked={notifications.push_comments}
                        onCheckedChange={(c) =>
                          setNotifications({ ...notifications, push_comments: c })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Mentions</p>
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                          Browser notifications for mentions
                        </p>
                      </div>
                      <Switch
                        checked={notifications.push_mentions}
                        onCheckedChange={(c) =>
                          setNotifications({ ...notifications, push_mentions: c })
                        }
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <div className="space-y-6">
              {/* Account Info */}
              <Card className="bg-white dark:bg-[#14151a] border-gray-200 dark:border-[#1f2229]">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">Account Information</CardTitle>
                  <CardDescription className="text-gray-500 dark:text-slate-400">Your account details</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-gray-100 dark:bg-[#14151a] rounded-lg space-y-2">
                    <p className="text-sm text-gray-700 dark:text-slate-300">
                      <span className="text-gray-400 dark:text-slate-500">Email:</span> {member?.email || user?.email}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-slate-300">
                      <span className="text-gray-400 dark:text-slate-500">Role:</span>{' '}
                      {roleInfo ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${roleInfo.color}`}>
                          {roleInfo.label}
                        </span>
                      ) : 'N/A'}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-slate-300">
                      <span className="text-gray-400 dark:text-slate-500">Joined:</span>{' '}
                      {member?.joined_at
                        ? new Date(member.joined_at).toLocaleDateString()
                        : user?.created_at
                        ? new Date(user.created_at).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Change Password */}
              <Card className="bg-white dark:bg-[#14151a] border-gray-200 dark:border-[#1f2229]">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                    <Key className="w-5 h-5" /> Change Password
                  </CardTitle>
                  <CardDescription className="text-gray-500 dark:text-slate-400">Update your password to keep your account secure</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full px-3 py-2 pr-10 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full px-3 py-2 pr-10 bg-gray-100 dark:bg-[#14151a] border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleChangePassword}
                    disabled={isChangingPassword || !newPassword || !confirmPassword}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isChangingPassword ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Changing...
                      </>
                    ) : (
                      <>
                        <Key className="w-4 h-4" />
                        Change Password
                      </>
                    )}
                  </button>
                </CardContent>
              </Card>

              {/* Sign Out */}
              <Card className="bg-white dark:bg-[#14151a] border-gray-200 dark:border-[#1f2229]">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">Sign Out</CardTitle>
                  <CardDescription className="text-gray-500 dark:text-slate-400">Sign out of your account</CardDescription>
                </CardHeader>
                <CardContent>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
