import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Users, Mail, Lock, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Floating shapes for background
const floatingShapes = [
  { size: 300, x: '10%', y: '20%', delay: 0, duration: 20, color: 'from-violet-500/8 to-pink-500/8' },
  { size: 200, x: '80%', y: '10%', delay: 2, duration: 25, color: 'from-blue-500/8 to-violet-500/8' },
  { size: 250, x: '70%', y: '70%', delay: 4, duration: 22, color: 'from-pink-500/8 to-orange-500/8' },
  { size: 180, x: '20%', y: '80%', delay: 1, duration: 18, color: 'from-teal-500/8 to-blue-500/8' },
  { size: 150, x: '50%', y: '50%', delay: 3, duration: 24, color: 'from-violet-500/6 to-teal-500/6' },
];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/members/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || 'Server error. Please try again later.');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      login(data.user, data.session, data.member);
      const redirectParam = new URLSearchParams(location.search).get('redirect');
      const redirectTo = redirectParam && redirectParam.startsWith('/') ? redirectParam : '/dashboard';
      navigate(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1012] flex items-center justify-center p-4 overflow-hidden relative">
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-30 dark:opacity-20"
          style={{
            background: mounted
              ? 'radial-gradient(ellipse at 20% 50%, rgba(139, 92, 246, 0.15), transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(236, 72, 153, 0.1), transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(59, 130, 246, 0.1), transparent 50%)'
              : 'transparent',
            transition: 'all 2s ease-out'
          }}
        />

        {/* Floating shapes */}
        {floatingShapes.map((shape, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full bg-gradient-to-br ${shape.color} blur-3xl`}
            style={{
              width: shape.size,
              height: shape.size,
              left: shape.x,
              top: shape.y,
            }}
            animate={{
              x: [0, 30, -20, 15, 0],
              y: [0, -25, 15, -10, 0],
              scale: [1, 1.1, 0.95, 1.05, 1],
            }}
            transition={{
              duration: shape.duration,
              repeat: Infinity,
              delay: shape.delay,
              ease: 'easeInOut',
            }}
          />
        ))}

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: 'linear-gradient(rgba(139, 92, 246, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.5) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Main content */}
      <div className="w-full max-w-md relative z-10">
        {/* Logo/Header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="w-16 h-16 bg-gradient-to-br from-violet-600 to-pink-500 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-violet-500/25"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            whileHover={{ scale: 1.1, rotate: 5 }}
          >
            <Users className="w-8 h-8 text-white" />
          </motion.div>
          <motion.h1
            className="text-2xl font-bold text-gray-900 dark:text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            Synergy Hub
          </motion.h1>
          <motion.p
            className="text-gray-500 dark:text-slate-400 mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            Sign in to your account
          </motion.p>
        </motion.div>

        {/* Login Card */}
        <motion.div
          className="bg-white/80 dark:bg-[#14151a]/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/30 overflow-hidden border border-gray-200/50 dark:border-[#1f2229]/50"
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        >
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-2 p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg overflow-hidden"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 500 }}
                  >
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  </motion.div>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <label className="block text-sm text-gray-600 dark:text-slate-400 mb-2">Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400 dark:text-slate-500 group-focus-within:text-violet-500 transition-colors" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full pl-10 pr-4 py-3 bg-gray-100/80 dark:bg-[#0f1012]/50 border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200"
                  disabled={loading}
                />
              </div>
            </motion.div>

            {/* Password */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <label className="block text-sm text-gray-600 dark:text-slate-400 mb-2">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400 dark:text-slate-500 group-focus-within:text-violet-500 transition-colors" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-12 py-3 bg-gray-100/80 dark:bg-[#0f1012]/50 border border-gray-200 dark:border-[#1f2229] rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-200"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </motion.div>

            {/* Submit Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <motion.button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-violet-600 to-violet-500 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
                whileHover={!loading ? { scale: 1.02 } : {}}
                whileTap={!loading ? { scale: 0.98 } : {}}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </motion.button>
            </motion.div>
          </form>

          {/* Footer */}
          <motion.div
            className="px-6 py-4 bg-gray-50/50 dark:bg-[#0f1012]/30 border-t border-gray-200/50 dark:border-[#1f2229]/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <p className="text-center text-sm text-gray-500 dark:text-slate-400">
              Don't have an account? Contact your workspace administrator.
            </p>
          </motion.div>
        </motion.div>

        {/* Help text */}
        <motion.p
          className="text-center text-gray-400 dark:text-slate-500 text-sm mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          Need help? Contact your workspace admin for login credentials.
        </motion.p>
      </div>
    </div>
  );
}
