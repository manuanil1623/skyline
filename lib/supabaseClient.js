import { createClient } from '@supabase/supabase-js';

function sanitize(val) {
  if (!val) return '';
  return String(val)
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width spaces
    .replace(/[^\x20-\x7E]/g, '')        // keep strictly printable ASCII
    .trim();
}

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseUrl = sanitize(rawUrl) || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = sanitize(rawKey) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjIwMDAwMDAwMDB9.placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const isSupabaseConfigured = () => {
  const url = sanitize(process.env.NEXT_PUBLIC_SUPABASE_URL);
  return (
    url &&
    url !== 'https://placeholder-project.supabase.co' &&
    !url.includes('your-project') &&
    !url.includes('placeholder-project')
  );
};

// Helper used by frontend to call API routes with JWT attached
export async function apiFetch(path, options = {}) {
  const baseUrl = sanitize(process.env.NEXT_PUBLIC_API_URL);
  const url = `${baseUrl}${path}`;
  
  let token = null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token ? sanitize(session.access_token) : null;
  } catch (e) {
    console.warn('Could not retrieve Supabase session:', e);
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText || `Request failed (${res.status})` }));
    throw new Error(err.error || `HTTP error ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}
