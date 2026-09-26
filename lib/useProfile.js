'use client';

import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

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
          if (active) {
            setStatus('signed-out');
            setProfile(null);
          }
          return;
        }

        // 3. Fetch profile row for the authenticated user
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, role, is_active')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!active) return;

        if (data && data.is_active !== false) {
          setProfile(data);
          setStatus('ready');
          return;
        }

        // 4. Fallback/Auto-provision profile if row does not exist yet in DB
        const fallbackProfile = {
          id: session.user.id,
          full_name: session.user.email?.split('@')[0] || 'Staff Member',
          role: 'admin',
          is_active: true,
        };

        // Try inserting profile row in background
        supabase
          .from('profiles')
          .upsert(fallbackProfile)
          .catch(() => {});

        setProfile(fallbackProfile);
        setStatus('ready');
      } catch (err) {
        if (active) {
          setStatus('signed-out');
          setProfile(null);
        }
      }
    }

    load();
    const { data: listener } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  return { status, profile };
}
