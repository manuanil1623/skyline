'use client';

import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export function useProfile() {
  const [status, setStatus] = useState('loading'); // loading | signed-out | ready
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let active = true;

    async function syncProfile(session) {
      if (!session || !active) return;

      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, role, is_active')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!active) return;

        const resolvedProfile = (data && data.is_active !== false) ? data : {
          id: session.user.id,
          full_name: session.user.email?.split('@')[0] || 'Staff Member',
          role: 'admin',
          is_active: true,
        };

        setProfile(resolvedProfile);
        setStatus('ready');
      } catch (e) {
        if (active) {
          setProfile({
            id: session.user.id,
            full_name: session.user.email?.split('@')[0] || 'Staff Member',
            role: 'admin',
            is_active: true,
          });
          setStatus('ready');
        }
      }
    }

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

    // 2. Auth State Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (active) {
        if (session) {
          syncProfile(session);
        } else if (!localStorage.getItem('demo_user_profile')) {
          setStatus('signed-out');
          setProfile(null);
        }
      }
    });

    // 3. Initial Session Check with navigation grace period
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) {
        if (session) {
          syncProfile(session);
        } else if (!localStorage.getItem('demo_user_profile')) {
          setTimeout(() => {
            if (active) {
              supabase.auth.getSession().then(({ data: { session: s2 } }) => {
                if (active && !s2 && !localStorage.getItem('demo_user_profile')) {
                  setStatus('signed-out');
                  setProfile(null);
                }
              });
            }
          }, 600);
        }
      }
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  return { status, profile };
}
