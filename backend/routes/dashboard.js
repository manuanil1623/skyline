const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, supabaseAdmin } = require('../middleware/rbac');

// GET /api/dashboard/revenue?period=daily|weekly|monthly
router.get('/revenue', requireAuth, requireRole('admin'), async (req, res) => {
  const period = req.query.period || 'daily';
  const viewMap = { daily: 'revenue_daily', weekly: 'revenue_weekly', monthly: 'revenue_monthly' };
  const view = viewMap[period];
  if (!view) return res.status(400).json({ error: 'period must be daily, weekly, or monthly' });

  const { data, error } = await supabaseAdmin
    .from(view)
    .select('*')
    .order('period', { ascending: true })
    .limit(60);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/dashboard/summary — headline cards: today / this week / this month totals
router.get('/summary', requireAuth, requireRole('admin'), async (req, res) => {
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalsFor = async (since) => {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('total_amount')
      .eq('status', 'completed')
      .gte('created_at', since.toISOString());
    if (error) throw error;
    return data.reduce((sum, r) => sum + Number(r.total_amount), 0);
  };

  try {
    const [today, week, month] = await Promise.all([
      totalsFor(startOfDay),
      totalsFor(startOfWeek),
      totalsFor(startOfMonth),
    ]);
    res.json({ today, week, month });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/dashboard/payment-breakdown?period=daily|weekly|monthly
router.get('/payment-breakdown', requireAuth, requireRole('admin'), async (req, res) => {
  const period = req.query.period || 'monthly';
  const viewMap = { daily: 'revenue_daily', weekly: 'revenue_weekly', monthly: 'revenue_monthly' };
  const { data, error } = await supabaseAdmin
    .from(viewMap[period] || 'revenue_monthly')
    .select('payment_method, revenue, txn_count');
  if (error) return res.status(400).json({ error: error.message });

  const totals = {};
  for (const row of data) {
    totals[row.payment_method] = (totals[row.payment_method] || 0) + Number(row.revenue);
  }
  res.json(totals);
});

module.exports = router;
