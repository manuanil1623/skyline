const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, scopedClient, supabaseAdmin } = require('../middleware/rbac');

// GET /api/services — any authenticated staff (handler or admin) can read active services
router.get('/', requireAuth, async (req, res) => {
  const db = scopedClient(req);
  const { data, error } = await db
    .from('services')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('name');
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/services — admin only: create a new service
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, category, base_price, duration_mins } = req.body;
  if (!name || base_price == null) {
    return res.status(400).json({ error: 'name and base_price are required' });
  }
  const { data, error } = await supabaseAdmin
    .from('services')
    .insert({ name, category, base_price, duration_mins })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/services/:id — admin only: update price / name / active status
router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body, updated_at: new Date().toISOString() };
  const { data, error } = await supabaseAdmin
    .from('services')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// DELETE /api/services/:id — admin only: soft-delete (deactivate) a service
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin
    .from('services')
    .update({ is_active: false })
    .eq('id', id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

module.exports = router;
