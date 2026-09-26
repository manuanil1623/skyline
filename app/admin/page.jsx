'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useProfile } from '../../lib/useProfile';
import { supabase } from '../../lib/supabaseClient';
import AdminDashboard from '../../components/AdminDashboard';

export default function AdminPage() {
  const router = useRouter();
  const { status, profile } = useProfile();

  useEffect(() => {
    if (status === 'signed-out') router.push('/login');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#FAF4F0] flex flex-col items-center justify-center gap-2 text-[#8a767d]">
        <div className="w-8 h-8 border-2 border-[#A63D5B] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Loading portal…</span>
      </div>
    );
  }
  if (status === 'signed-out') return null;

  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#FAF4F0] flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-serif text-3xl text-[#2E1620] mb-2">Admin Portal Only</h1>
        <p className="text-[#8a767d] mb-6 text-sm max-w-sm">
          Your active login role is <strong>{profile?.role}</strong>. Please switch to the front desk checkout screen.
        </p>
        <button
          onClick={() => router.push('/checkout')}
          className="bg-[#2E1620] hover:bg-[#3B2530] text-white px-6 py-2.5 rounded-full text-sm font-medium transition-colors"
        >
          Go to Front Desk Checkout
        </button>
      </div>
    );
  }

  const handleSignOut = async () => {
    if (typeof window !== 'undefined') localStorage.removeItem('demo_user_profile');
    try { await supabase.auth.signOut(); } catch (e) {}
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex justify-between items-center px-6 py-3 bg-white border-b border-[#EBDFD9]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#A63D5B]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#2E1620]">
            Skyline Beauty Parlour Admin Portal
          </span>
          <span className="text-xs text-[#8a767d]">({profile?.full_name})</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/checkout')}
            className="text-xs text-[#2E1620] hover:underline"
          >
            Switch to Checkout
          </button>
          <button
            onClick={handleSignOut}
            className="text-xs font-medium text-[#A63D5B] hover:text-[#8f3450] bg-[#FAF4F0] px-3 py-1 rounded-lg border border-[#EBDFD9] transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
      <AdminDashboard />
    </div>
  );
}
