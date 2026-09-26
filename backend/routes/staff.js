const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, supabaseAdmin } = require('../middleware/rbac');

// GET /api/staff — admin: list all staff accounts
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, is_active, phone, created_at')
    .order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/staff — admin: create a new staff login (invites via email/temp password)
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { email, password, full_name, role = 'handler', phone } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'email, password, and full_name are required' });
  }

  // Creates the auth user; the DB trigger (handle_new_user) auto-creates the profile row.
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });
  if (createErr) return res.status(400).json({ error: createErr.message });

  if (phone) {
    await supabaseAdmin.from('profiles').update({ phone }).eq('id', created.user.id);
  }

  res.status(201).json({ id: created.user.id, email, full_name, role });
});

// PATCH /api/staff/:id — admin: update role, active status, or details
router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { full_name, role, is_active, phone } = req.body;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ full_name, role, is_active, phone })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// DELETE /api/staff/:id — admin: deactivate (never hard-delete, preserves audit trail)
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ is_active: false })
    .eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

module.exports = router;
