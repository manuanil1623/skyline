/**
 * Role-Based Access Control middleware.
 * Works with Supabase Auth JWTs. Attach to any Express route (or adapt
 * the same logic inline for Next.js API routes / route handlers).
 *
 * Usage:
 *   router.get('/admin/reports', requireAuth, requireRole('admin'), handler)
 *   router.post('/transactions', requireAuth, requireRole('admin','handler'), handler)
 */

const { createClient } = require('@supabase/supabase-js');

// Server-side client using the SERVICE ROLE key (never expose this key to the frontend).
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * requireAuth
 * Verifies the bearer token from the Authorization header, resolves the
 * Supabase user, loads their profile (role, active status), and attaches
 * both to `req.user` / `req.profile` for downstream handlers.
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, is_active')
      .eq('id', userData.user.id)
      .single();

    if (profileErr || !profile) {
      return res.status(403).json({ error: 'No staff profile found for this account' });
    }

    if (!profile.is_active) {
      return res.status(403).json({ error: 'This account has been deactivated. Contact the owner.' });
    }

    req.user = userData.user;
    req.profile = profile;
    // Also carry the raw token so route handlers can create a per-request
    // Supabase client that respects Row Level Security as this specific user.
    req.supabaseToken = token;
    next();
  } catch (err) {
    console.error('requireAuth error:', err);
    res.status(500).json({ error: 'Auth check failed' });
  }
}

/**
 * requireRole(...roles)
 * Restricts a route to one or more roles. Must run after requireAuth.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.profile) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!allowedRoles.includes(req.profile.role)) {
      return res.status(403).json({
        error: `This action requires role: ${allowedRoles.join(' or ')}`,
      });
    }
    next();
  };
}

/**
 * scopedClient(req)
 * Returns a Supabase client authenticated AS the requesting user (not the
 * service role), so Postgres RLS policies apply automatically. Prefer this
 * for handler-initiated reads/writes; use supabaseAdmin only for
 * privileged admin operations (e.g. creating staff logins).
 */
function scopedClient(req) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${req.supabaseToken}` } },
  });
}

module.exports = { requireAuth, requireRole, scopedClient, supabaseAdmin };
