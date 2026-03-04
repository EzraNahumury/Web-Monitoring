'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiLogin } from '@/lib/api';
import { Role } from '@/lib/types';

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) redirectByRole(user.role);
  }, [user, loading]);

  function redirectByRole(role: Role) {
    if (role === 'admin') router.replace('/dashboard');
    else if (role === 'cs') router.replace('/orders');
    else router.replace('/production');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await apiLogin(username.trim(), password.trim());
      if (res.success && res.data) {
        login({ username: res.data.username, role: res.data.role as Role });
        redirectByRole(res.data.role as Role);
      } else {
        setError(res.error || 'Username atau password salah.');
      }
    } catch {
      setError('Tidak dapat terhubung ke server.');
    }
    setSubmitting(false);
  }

  if (loading) return null;

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0a0a0f]">
      {/* Ambient background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="blob-1 blob-glow absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="blob-2 blob-glow absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="blob-3 absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-blue-500/10 blur-[90px]" />
        <div className="blob-1 absolute top-[30%] right-[20%] w-[250px] h-[250px] rounded-full bg-violet-500/10 blur-[70px]" style={{animationDelay: '-6s'}} />
        <div className="blob-2 absolute bottom-[20%] left-[15%] w-[200px] h-[200px] rounded-full bg-indigo-400/10 blur-[60px]" style={{animationDelay: '-10s'}} />
      </div>

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 w-full max-w-[420px] px-4">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 relative">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-xl shadow-indigo-500/40" />
            <svg className="w-8 h-8 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Produksi Manager</h1>
          <p className="text-slate-500 text-sm mt-1.5 tracking-wide uppercase text-xs font-medium">AYRES Production System</p>
        </div>

        {/* Glass card */}
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/[0.08] to-white/[0.03] backdrop-blur-xl border border-white/[0.08] shadow-2xl" />

          <div className="relative p-8">
            <div className="mb-7">
              <h2 className="text-xl font-semibold text-white">Masuk ke Akun</h2>
              <p className="text-slate-500 text-sm mt-1">Selamat datang kembali</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username field */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Username
                </label>
                <div className={`relative rounded-2xl transition-all duration-200 ${focused === 'username' ? 'shadow-lg shadow-indigo-500/20' : ''}`}>
                  <div className={`absolute inset-0 rounded-2xl border transition-all duration-200 ${focused === 'username' ? 'border-indigo-500/60 bg-indigo-500/5' : 'border-white/[0.08] bg-white/[0.04]'}`} />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                    <svg className={`w-4 h-4 transition-colors ${focused === 'username' ? 'text-indigo-400' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    onFocus={() => setFocused('username')}
                    onBlur={() => setFocused(null)}
                    placeholder="Masukkan username"
                    required
                    autoFocus
                    className="relative z-10 w-full bg-transparent text-white placeholder-slate-600 pl-11 pr-4 py-3.5 text-sm rounded-2xl focus:outline-none"
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className={`relative rounded-2xl transition-all duration-200 ${focused === 'password' ? 'shadow-lg shadow-indigo-500/20' : ''}`}>
                  <div className={`absolute inset-0 rounded-2xl border transition-all duration-200 ${focused === 'password' ? 'border-indigo-500/60 bg-indigo-500/5' : 'border-white/[0.08] bg-white/[0.04]'}`} />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                    <svg className={`w-4 h-4 transition-colors ${focused === 'password' ? 'text-indigo-400' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    placeholder="Masukkan password"
                    required
                    className="relative z-10 w-full bg-transparent text-white placeholder-slate-600 pl-11 pr-12 py-3.5 text-sm rounded-2xl focus:outline-none"
                  />
                  <button
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="relative w-full group mt-2"
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 transition-all duration-300 group-disabled:opacity-50" />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative z-10 flex items-center justify-center gap-2 text-white font-semibold py-3.5 text-sm">
                  {submitting ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Masuk...
                    </>
                  ) : (
                    <>
                      Masuk ke Sistem
                      <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                      </svg>
                    </>
                  )}
                </span>
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-[11px] text-slate-600 font-medium tracking-widest uppercase">Quick Access</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {/* Quick login buttons */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { role: 'Admin', user: 'admin', from: 'from-indigo-500', to: 'to-indigo-600', glow: 'shadow-indigo-500/20', border: 'border-indigo-500/20 hover:border-indigo-500/40', badge: 'bg-indigo-500/10 text-indigo-400' },
                { role: 'CS', user: 'cs', from: 'from-sky-500', to: 'to-blue-600', glow: 'shadow-sky-500/20', border: 'border-sky-500/20 hover:border-sky-500/40', badge: 'bg-sky-500/10 text-sky-400' },
                { role: 'Produksi', user: 'produksi', from: 'from-amber-500', to: 'to-orange-500', glow: 'shadow-amber-500/20', border: 'border-amber-500/20 hover:border-amber-500/40', badge: 'bg-amber-500/10 text-amber-400' },
              ].map(a => (
                <button
                  key={a.user}
                  type="button"
                  onClick={() => { setUsername(a.user); setPassword(a.user); }}
                  className={`relative group flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-200 ${a.border}`}
                >
                  <span className={`text-[11px] font-bold ${a.badge} px-2 py-0.5 rounded-full`}>{a.role}</span>
                  <span className="text-[11px] text-slate-600 font-mono">{a.user}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-slate-700 text-xs mt-6">© 2026 AYRES System · All rights reserved</p>
      </div>
    </div>
  );
}
