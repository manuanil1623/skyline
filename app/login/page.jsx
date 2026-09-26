'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    setConfigured(isSupabaseConfigured());
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanEmail = (email || '').trim().replace(/[^\x20-\x7E]/g, '');
    const cleanPassword = (password || '').trim();

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, is_active')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        // Auto-provision profile for signed-in user if missing
        const { data: countData } = await supabase.from('profiles').select('id', { count: 'exact', head: true });
        const isFirstUser = !countData || countData.length === 0;
        const initialRole = isFirstUser ? 'admin' : 'handler';

        const { data: newProfile } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            full_name: cleanEmail.split('@')[0] || 'Staff User',
            role: initialRole,
            is_active: true,
          })
          .select('role, is_active')
          .single();

        profile = newProfile || { role: initialRole, is_active: true };
      }

      if (!profile.is_active) {
        setError('This account has been deactivated. Contact the owner.');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      // Clear any demo profile override
      localStorage.removeItem('demo_user_profile');
      router.push(profile.role === 'admin' ? '/admin' : '/checkout');
    } catch (err) {
      console.error('Sign-in error:', err);
      setError(err.message || 'Failed to sign in. Please verify your Supabase API keys.');
      setLoading(false);
    }
  };

  const handleDemoSignIn = (role) => {
    const demoProfile = {
      id: role === 'admin' ? 'demo-admin-id' : 'demo-handler-id',
      full_name: role === 'admin' ? 'Demo Manager (Admin)' : 'Front Desk (Handler)',
      role: role,
      is_active: true,
    };
    localStorage.setItem('demo_user_profile', JSON.stringify(demoProfile));
    router.push(role === 'admin' ? '/admin' : '/checkout');
  };

  return (
    <div className="min-h-screen bg-[#FAF4F0] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md bg-white border border-[#EBDFD9] rounded-3xl p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full bg-[#A63D5B]" />
          <p className="text-xs text-[#A63D5B] font-semibold tracking-wider uppercase">Skyline Beauty Parlour</p>
        </div>
        <h1 className="font-serif text-3xl text-[#2E1620] mb-2">Staff Sign In</h1>
        <p className="text-xs text-[#8a767d] mb-6">Enter your credentials to access checkout or administration</p>

        {!configured && (
          <div className="mb-6 bg-[#FAF0E6] border border-[#E8D0C5] text-[#8C4B31] text-xs px-4 py-3 rounded-2xl flex flex-col gap-1">
            <span className="font-bold flex items-center gap-1.5">
              <span>ℹ️</span> Supabase Credentials Unset
            </span>
            <span>
              To connect real Supabase Auth, add your <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env.local</code>.
            </span>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-[#F4D8DE] text-[#8f3450] text-xs px-4 py-2.5 rounded-xl border border-[#E5B8C2]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-[#8a767d] mb-1 font-medium">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#FAF4F0] border border-[#EBDFD9] rounded-xl px-3.5 py-2.5 text-sm text-[#2E1620] focus:outline-none focus:border-[#A63D5B] transition-colors"
              placeholder="staff@salon.com"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-[#8a767d] mb-1 font-medium">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#FAF4F0] border border-[#EBDFD9] rounded-xl px-3.5 py-2.5 text-sm text-[#2E1620] focus:outline-none focus:border-[#A63D5B] transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2E1620] hover:bg-[#3B2530] text-white text-sm font-medium py-3 rounded-full transition-all disabled:opacity-50 shadow-sm mt-2"
          >
            {loading ? 'Signing in…' : 'Sign in with Supabase'}
          </button>
        </form>

        <div className="my-6 border-t border-[#EBDFD9] relative text-center">
          <span className="bg-white px-3 text-[11px] text-[#8a767d] uppercase tracking-widest relative -top-2.5 font-medium">
            Or quick demo login
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleDemoSignIn('handler')}
            className="bg-[#FAF4F0] hover:bg-[#F3E8E2] text-[#2E1620] text-xs font-semibold py-2.5 px-3 rounded-xl border border-[#EBDFD9] transition-all flex flex-col items-center gap-0.5"
          >
            <span>Front Desk</span>
            <span className="text-[10px] font-normal text-[#8a767d]">(Handler Mode)</span>
          </button>
          <button
            type="button"
            onClick={() => handleDemoSignIn('admin')}
            className="bg-[#FAF4F0] hover:bg-[#F3E8E2] text-[#A63D5B] text-xs font-semibold py-2.5 px-3 rounded-xl border border-[#EBDFD9] transition-all flex flex-col items-center gap-0.5"
          >
            <span>Owner Dashboard</span>
            <span className="text-[10px] font-normal text-[#8a767d]">(Admin Mode)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
