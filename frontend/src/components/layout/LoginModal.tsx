import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Compass, X, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const LoginModal: React.FC = () => {
  const { loginModalOpen, closeLoginModal, login, redirectTarget } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (loginModalOpen) {
      setError(null);
    }
  }, [loginModalOpen]);

  if (!loginModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await login(email, password);
      if (!res.success) {
        setError(res.error || 'Authentication failed');
      }
    } catch (err) {
      // login()/api.login() are not expected to throw (they catch their own
      // fetch/parse failures and return a structured result) - if something
      // still reaches here, it's a genuinely unexpected error and must be
      // logged, not silently swallowed, or it can never be diagnosed.
      console.error('Unexpected error during login:', err);
      setError('An error occurred during authentication. See the browser console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden relative"
        >
          {/* Close button */}
          <button
            onClick={closeLoginModal}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-7">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-brand-forest flex items-center justify-center text-white shadow-sm">
                <Compass className="w-6 h-6 text-brand-mint-light" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Sign in to TerraScope
                </h3>
                <p className="text-xs text-slate-500">
                  {redirectTarget === 'prospectivity'
                    ? 'Authenticate to access Manganese Prospectivity Analyst'
                    : redirectTarget === 'shortfall'
                    ? 'Authenticate to access Mining Shortfall Forecaster'
                    : 'Enter operational credentials to access workspace'}
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Corporate Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-forest focus:border-brand-forest transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-forest focus:border-brand-forest transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-brand-forest hover:bg-brand-forest-hover text-white text-xs font-semibold tracking-wide transition-all shadow-sm active:scale-[0.99] disabled:opacity-75"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Authenticate Session</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
