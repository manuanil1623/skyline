'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useProfile } from '../../lib/useProfile';
import { supabase } from '../../lib/supabaseClient';
import HandlerCheckout from '../../components/HandlerCheckout';

export default function CheckoutPage() {
  const router = useRouter();
  const { status, profile } = useProfile();

  useEffect(() => {
    if (status === 'signed-out') router.push('/login');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#FAF4F0] flex flex-col items-center justify-center gap-2 text-[#8a767d]">
        <div className="w-8 h-8 border-2 border-[#A63D5B] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Loading checkout…</span>
      </div>
    );
  }
  if (status === 'signed-out') return null;

  const handleSignOut = async () => {
    if (typeof window !== 'undefined') localStorage.removeItem('demo_user_profile');
    try { await supabase.auth.signOut(); } catch (e) {}
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex justify-between items-center px-6 py-3 bg-white border-b border-[#EBDFD9]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#6B8F71]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#2E1620]">
            Rosé &amp; Co. Front Desk
          </span>
          <span className="text-xs text-[#8a767d]">({profile?.full_name} · {profile?.role})</span>
        </div>
        <div className="flex items-center gap-4">
          {profile?.role === 'admin' && (
            <button
              onClick={() => router.push('/admin')}
              className="text-xs text-[#2E1620] hover:underline"
            >
              Owner Dashboard
            </button>
          )}
          <button
            onClick={handleSignOut}
            className="text-xs font-medium text-[#A63D5B] hover:text-[#8f3450] bg-[#FAF4F0] px-3 py-1 rounded-lg border border-[#EBDFD9] transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
      <HandlerCheckout />
    </div>
  );
}
