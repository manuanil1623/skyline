const express = require('express');
const router = express.Router();
const { requireAuth, requireRole, scopedClient, supabaseAdmin } = require('../middleware/rbac');

/**
 * Builds a standard UPI deep-link payload string.
 * Format follows the UPI Intent/Payment spec used by GPay, PhonePe, Paytm, etc.
 *   upi://pay?pa=<VPA>&pn=<PAYEE NAME>&am=<AMOUNT>&cu=INR&tn=<NOTE>&tr=<TXN REF>
 */
function buildUpiPayload({ amount, txnId }) {
  const params = new URLSearchParams({
    pa: process.env.SALON_UPI_VPA,        // e.g. "beautyparlor@okhdfcbank"
    pn: process.env.SALON_PAYEE_NAME || 'Beauty Parlor',
    am: amount.toFixed(2),
    cu: 'INR',
    tn: `Salon bill ${txnId.slice(0, 8)}`,
    tr: txnId,
  });
  return `upi://pay?${params.toString()}`;
}

// ---------------------------------------------------------------------
// POST /api/transactions — Handler creates a new bill (status: pending)
// ---------------------------------------------------------------------
router.post('/', requireAuth, requireRole('handler', 'admin'), async (req, res) => {
  const { items, discount = 0, payment_method, customer_name, customer_phone } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one service item is required' });
  }

  const subtotal = items.reduce((sum, i) => sum + Number(i.price) * (i.quantity || 1), 0);
  const total_amount = Math.max(subtotal - Number(discount || 0), 0);

  const db = scopedClient(req);

  const { data: txn, error: txnErr } = await db
    .from('transactions')
    .insert({
      handler_id: req.profile.id,
      customer_name,
      customer_phone,
      subtotal,
      discount,
      total_amount,
      payment_method,
      status: payment_method === 'qr' ? 'pending' : 'completed',
      confirmed_at: payment_method === 'qr' ? null : new Date().toISOString(),
    })
    .select()
    .single();

  if (txnErr) return res.status(400).json({ error: txnErr.message });

  const itemRows = items.map((i) => ({
    transaction_id: txn.id,
    service_id: i.service_id || null,
    service_name: i.name,
    price: i.price,
    is_custom_price: !!i.is_custom_price,
    quantity: i.quantity || 1,
  }));
  const { error: itemsErr } = await db.from('transaction_items').insert(itemRows);
  if (itemsErr) return res.status(400).json({ error: itemsErr.message });

  let qr_payload = null;
  if (payment_method === 'qr') {
    qr_payload = buildUpiPayload({ amount: total_amount, txnId: txn.id });
    await db.from('transactions').update({ qr_payload }).eq('id', txn.id);
  }

  res.status(201).json({ ...txn, qr_payload });
});

// ---------------------------------------------------------------------
// POST /api/transactions/:id/confirm — Handler manually confirms a QR
// payment ("Confirm Payment" button) once the customer shows the paid screen
// ---------------------------------------------------------------------
router.post('/:id/confirm', requireAuth, requireRole('handler', 'admin'), async (req, res) => {
  const db = scopedClient(req);
  const { data, error } = await db
    .from('transactions')
    .update({ status: 'completed', confirmed_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('handler_id', req.profile.id) // handlers can only confirm their own
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ---------------------------------------------------------------------
// POST /api/webhooks/upi-confirm — Payment gateway webhook (auto-verify)
// Verifies gateway signature, then marks the matching transaction complete.
// Mount this route WITHOUT requireAuth (gateways can't send user JWTs) but
// DO verify the provider's signature header before trusting the payload.
// ---------------------------------------------------------------------
router.post('/webhooks/upi-confirm', async (req, res) => {
  const { tr: txnId, status, upi_ref_id, signature } = req.body;

  const isValidSignature = verifyGatewaySignature(req.body, signature); // implement per-provider
  if (!isValidSignature) return res.status(401).json({ error: 'Invalid signature' });

  if (status !== 'SUCCESS') {
    return res.status(200).json({ received: true, ignored: true });
  }

  const { error } = await supabaseAdmin
    .from('transactions')
    .update({ status: 'completed', confirmed_at: new Date().toISOString(), upi_ref_id })
    .eq('id', txnId)
    .eq('status', 'pending');

  if (error) return res.status(400).json({ error: error.message });
  res.status(200).json({ received: true });
});

function verifyGatewaySignature(payload, signature) {
  // Placeholder — implement HMAC verification per your payment gateway's docs
  // (Razorpay, Cashfree, PhonePe PG, etc.) before trusting webhook data.
  return Boolean(signature);
}

// ---------------------------------------------------------------------
// GET /api/transactions/today — Handler's own daily ledger (today only)
// ---------------------------------------------------------------------
router.get('/today', requireAuth, requireRole('handler', 'admin'), async (req, res) => {
  const db = scopedClient(req);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await db
    .from('transactions')
    .select('*, transaction_items(*)')
    .eq('handler_id', req.profile.id)
    .gte('created_at', startOfDay.toISOString())
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ---------------------------------------------------------------------
// GET /api/transactions — Admin: full searchable/filterable audit log
// Query params: ?from=&to=&payment_method=&status=&handler_id=&q=
// ---------------------------------------------------------------------
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { from, to, payment_method, status, handler_id, q } = req.query;
  let query = supabaseAdmin.from('transactions').select('*, transaction_items(*), profiles(full_name)');

  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);
  if (payment_method) query = query.eq('payment_method', payment_method);
  if (status) query = query.eq('status', status);
  if (handler_id) query = query.eq('handler_id', handler_id);
  if (q) query = query.ilike('customer_name', `%${q}%`);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ---------------------------------------------------------------------
// PATCH /api/transactions/:id — Admin: edit a past transaction
// ---------------------------------------------------------------------
router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .update(req.body)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ---------------------------------------------------------------------
// POST /api/transactions/:id/void — Admin: void a transaction (audit trail kept)
// ---------------------------------------------------------------------
router.post('/:id/void', requireAuth, requireRole('admin'), async (req, res) => {
  const { reason } = req.body;
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .update({ status: 'voided', voided_by: req.profile.id, void_reason: reason })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

module.exports = router;
