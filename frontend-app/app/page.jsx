'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useProfile } from '../lib/useProfile';

export default function HomePage() {
  const router = useRouter();
  const { status, profile } = useProfile();

  useEffect(() => {
    if (status === 'signed-out') router.push('/login');
    if (status === 'ready') router.push(profile.role === 'admin' ? '/admin' : '/checkout');
  }, [status, profile, router]);

  return <div className="min-h-screen flex items-center justify-center text-[#8a767d]">Loading…</div>;
}
