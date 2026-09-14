import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Lock, User, Eye, EyeOff, AlertCircle, KeyRound, Server, ShieldAlert, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

export const LoginGate: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [defaultHint, setDefaultHint] = useState<{ defaultUsername: string; defaultPassword: string } | null>(null);
  const [showHint, setShowHint] = useState(false);

  // Fetch hint on load
  useEffect(() => {
    fetch('/api/auth/hint')
      .then(res => res.json())
      .then(data => {
        if (data && data.defaultUsername) {
          setDefaultHint({
            defaultUsername: data.defaultUsername,
            defaultPassword: data.defaultPassword
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await login(username.trim(), password);
    if (!result.success) {
      setErrorMessage(result.error || 'Invalid credentials. Please verify and try again.');
      setIsSubmitting(false);
    }
  };

  const handleFillDefault = () => {
    if (defaultHint) {
      setUsername(defaultHint.defaultUsername);
      setPassword(defaultHint.defaultPassword);
      setErrorMessage(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 relative overflow-hidden selection:bg-emerald-500 selection:text-slate-950">
      {/* Ambient background decoration */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-xl shadow-emerald-950/60 ring-4 ring-emerald-500/20 mb-2">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">CG Food & Civil Supplies</h1>
          <p className="text-xs text-slate-400">
            Internal Portal & RDBMS Scraper Engine &bull; Private Access Only
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-white">Authorized Sign In</span>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Secured
            </span>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-xl p-3.5 flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-red-300">Authentication Failed</div>
                <div className="text-red-300/90 leading-relaxed">{errorMessage}</div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Username</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Password</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your security password"
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-950/70 border border-slate-700/80 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Secure Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Setup Hint Accordion */}
          {defaultHint && (
            <div className="border border-slate-800 rounded-xl bg-slate-950/50 overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setShowHint(!showHint)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-slate-400 hover:text-slate-200 transition text-left cursor-pointer"
              >
                <span className="flex items-center gap-1.5 font-medium text-[11px] text-emerald-400/90">
                  <Server className="w-3.5 h-3.5" /> Initial Administrator Credentials
                </span>
                {showHint ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showHint && (
                <div className="px-3.5 pb-3 pt-1 border-t border-slate-800/80 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <div className="text-slate-500 text-[10px]">USERNAME</div>
                      <div className="text-white font-semibold select-all">{defaultHint.defaultUsername}</div>
                    </div>
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <div className="text-slate-500 text-[10px]">PASSWORD</div>
                      <div className="text-white font-semibold select-all">{defaultHint.defaultPassword}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleFillDefault}
                    className="w-full py-1.5 px-3 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 rounded-lg text-center font-medium transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Auto-Fill Admin Credentials
                  </button>
                  <p className="text-[10px] text-slate-500 text-center">
                    You can change your password anytime inside the dashboard via the top profile menu.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Security Notice */}
        <div className="text-center text-[11px] text-slate-500 space-y-1">
          <p className="flex items-center justify-center gap-1">
            <ShieldAlert className="w-3 h-3 text-emerald-500" />
            Protected with PBKDF2 cryptographic hashing & brute-force lockouts.
          </p>
          <p>Unauthorized access attempts are logged with client IP address.</p>
        </div>
      </div>
    </div>
  );
};
