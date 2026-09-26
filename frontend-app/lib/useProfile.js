'use client';

import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

/**
 * useProfile
 * Client-side hook that resolves the current session and the caller's
 * profile (full_name, role, is_active). Used by pages to decide whether
 * to show content, redirect to /login, or show an "access denied" state.
 *
 * NOTE: this is a UX convenience only — the real enforcement happens in
 * the Express middleware (requireRole) and Postgres RLS policies. Never
 * rely on this hook alone to protect sensitive data.
 */
export function useProfile() {
  const [status, setStatus] = useState('loading'); // loading | signed-out | ready
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      // 1. Check for active demo session in localStorage
      if (typeof window !== 'undefined') {
        const demoUser = localStorage.getItem('demo_user_profile');
        if (demoUser) {
          try {
            const parsed = JSON.parse(demoUser);
            if (active) {
              setProfile(parsed);
              setStatus('ready');
              return;
            }
          } catch (e) {
            localStorage.removeItem('demo_user_profile');
          }
        }
      }

      // 2. Check Supabase session
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (active) { setStatus('signed-out'); setProfile(null); }
          return;
        }
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, role, is_active')
          .eq('id', session.user.id)
          .single();
        if (!active) return;
        if (error || !data) {
          setStatus('signed-out');
          setProfile(null);
        } else {
          setProfile(data);
          setStatus('ready');
        }
      } catch (err) {
        if (active) {
          setStatus('signed-out');
          setProfile(null);
        }
      }
    }

    load();
    const { data: listener } = supabase.auth.onAuthStateChange(() => load());
    return () => { active = false; listener?.subscription?.unsubscribe(); };
  }, []);

  return { status, profile };
}

