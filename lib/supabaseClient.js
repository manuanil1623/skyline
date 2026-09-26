import { createClient } from '@supabase/supabase-js';

const cleanHeaderValue = (val) => (val || '').toString().replace(/[^\x00-\x7F]/g, '').trim();

const supabaseUrl = cleanHeaderValue(process.env.NEXT_PUBLIC_SUPABASE_URL) || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = cleanHeaderValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjIwMDAwMDAwMDB9.placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = () => {
  const url = cleanHeaderValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  return (
    url &&
    url !== 'https://placeholder-project.supabase.co' &&
    !url.includes('your-project')
  );
};

// Helper used by frontend to call API routes (Next.js app API or Express backend) with JWT attached
export async function apiFetch(path, options = {}) {
  const baseUrl = cleanHeaderValue(process.env.NEXT_PUBLIC_API_URL);
  const url = `${baseUrl}${path}`;
  
  let token = null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token ? cleanHeaderValue(session.access_token) : null;
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

