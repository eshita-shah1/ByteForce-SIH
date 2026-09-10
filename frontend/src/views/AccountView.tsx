import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, Check, Eye, EyeOff, KeyRound, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AccountView: React.FC = () => {
  const { user, updateDisplayName } = useAuth();
  const [displayName, setDisplayName] = useState(user?.name || 'Mining Engineer');
  const [password, setPassword] = useState('••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  // Reset password modal state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateDisplayName(displayName);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }
    setPassword(newPassword);
    setResetSuccess(true);
    setTimeout(() => {
      setResetSuccess(false);
      setResetModalOpen(false);
      setNewPassword('');
      setConfirmPassword('');
      setResetError(null);
    }, 1500);
  };

  return (
    <div className="p-8 flex flex-col items-center min-h-[calc(100vh-4rem)] animate-fadeIn">
      {/* Header — centered */}
      <div className="w-full max-w-lg mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Account Settings
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Manage your personal mining engineer credentials and security preferences.
        </p>
      </div>

      {/* Main Settings Card — centered, fixed width */}
      <div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-subtle p-7">
        <form onSubmit={handleSaveProfile} className="space-y-6">
          {/* User Profile Banner — centered horizontally */}
          <div className="flex flex-col items-center text-center gap-2 pb-6 border-b border-slate-100">
            <div className="w-16 h-16 rounded-full bg-brand-forest text-white font-bold text-xl flex items-center justify-center ring-4 ring-brand-mint-bg">
              {user?.initials || 'ME'}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{displayName}</h2>
              <span className="text-xs text-slate-500">{user?.role || 'Principal Mining Engineer'}</span>
              <span className="block text-[11px] font-mono text-emerald-600 mt-0.5">
                Balaghat Operations Group (ID: TS-8821)
              </span>
            </div>
          </div>

          {/* 1. Display Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Display Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Full Name"
                className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Your name as displayed across telemetry reports, GIS logs, and team audits.
            </p>
          </div>

          {/* 2. Email (Read-only) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                disabled
                value={user?.email || 'test@terrascope.com'}
                className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed select-none"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Managed via corporate identity directory. Email address cannot be altered here.
            </p>
          </div>

          {/* 3. Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Password
              </label>
              <button
                type="button"
                onClick={() => setResetModalOpen(true)}
                className="text-xs font-semibold text-brand-forest hover:text-brand-forest-light transition-colors hover:underline cursor-pointer"
              >
                Reset Password
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                readOnly
                value={password}
                className="w-full pl-9 pr-10 py-2.5 text-xs font-mono rounded-lg border border-slate-200 bg-slate-50/50 text-slate-700 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-brand-forest hover:bg-brand-forest-hover text-white text-xs font-semibold tracking-wide transition-all shadow-sm active:scale-[0.99]"
            >
              Save Changes
            </button>

            {savedToast && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 animate-fadeIn">
                <Check className="w-4 h-4" />
                <span>Preferences updated successfully</span>
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {resetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white max-w-md w-full rounded-xl border border-slate-200 shadow-xl p-6 relative"
            >
              <button
                onClick={() => setResetModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-brand-forest text-white flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-brand-mint-light" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Reset Security Password
                  </h3>
                  <p className="text-xs text-slate-500">
                    Update credential for {user?.email}
                  </p>
                </div>
              </div>

              {resetError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccess ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 text-center font-medium">
                  Password successfully updated! Closing...
                </div>
              ) : (
                <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none"
                    />
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setResetModalOpen(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-semibold text-white bg-brand-forest hover:bg-brand-forest-hover rounded-lg shadow-sm"
                    >
                      Update Password
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
