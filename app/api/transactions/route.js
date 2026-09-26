import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

// Memory store for demo / unconfigured mode
export const memoryTransactions = [
  {
    id: 'txn-demo-1',
    handler_id: 'demo-handler-id',
    customer_name: 'Priya Sharma',
    customer_phone: '9876543210',
    subtotal: 1200,
    discount: 0,
    total_amount: 1200,
    payment_method: 'qr',
    status: 'completed',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    confirmed_at: new Date(Date.now() - 3500000).toISOString(),
    profiles: { full_name: 'Front Desk' },
  },
  {
    id: 'txn-demo-2',
    handler_id: 'demo-handler-id',
    customer_name: 'Ananya Verma',
    customer_phone: '9811223344',
    subtotal: 450,
    discount: 50,
    total_amount: 400,
    payment_method: 'cash',
    status: 'completed',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    confirmed_at: new Date(Date.now() - 7200000).toISOString(),
    profiles: { full_name: 'Front Desk' },
  },
];

function buildUpiPayload({ amount, txnId }) {
  const vpa = process.env.SALON_UPI_VPA || 'skylinebeauty@okhdfcbank';
  const name = process.env.SALON_PAYEE_NAME || 'Skyline Beauty Parlour';
  const params = new URLSearchParams({
    pa: vpa,
    pn: name,
    am: Number(amount).toFixed(2),
    cu: 'INR',
    tn: `Salon Bill ${txnId.slice(0, 8)}`,
    tr: txnId,
  });
  return `upi://pay?${params.toString()}`;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const payment_method = searchParams.get('payment_method');
  const status = searchParams.get('status');
  const q = searchParams.get('q');

  if (isSupabaseConfigured()) {
    try {
      let query = supabase.from('transactions').select('*, transaction_items(*), profiles(full_name)');
      if (payment_method) query = query.eq('payment_method', payment_method);
      if (status) query = query.eq('status', status);
      if (q) query = query.ilike('customer_name', `%${q}%`);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data) return NextResponse.json(data);
    } catch (e) {}
  }

  let list = [...memoryTransactions];
  if (payment_method) list = list.filter((t) => t.payment_method === payment_method);
  if (status) list = list.filter((t) => t.status === status);
  if (q) list = list.filter((t) => (t.customer_name || '').toLowerCase().includes(q.toLowerCase()));
  return NextResponse.json(list);
}

export async function POST(req) {
  const body = await req.json();
  const { items = [], discount = 0, payment_method = 'cash', customer_name = '', customer_phone = '' } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'At least one service item is required' }, { status: 400 });
  }

  const subtotal = items.reduce((sum, i) => sum + Number(i.price) * (i.quantity || 1), 0);
  const total_amount = Math.max(subtotal - Number(discount || 0), 0);
  const txnId = `txn-${Date.now()}`;
  const isPending = payment_method === 'qr';

  let qr_payload = null;
  if (payment_method === 'qr') {
    qr_payload = buildUpiPayload({ amount: total_amount, txnId });
  }

  if (isSupabaseConfigured()) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const handler_id = session?.user?.id;
      if (handler_id) {
        const { data: txn, error } = await supabase
          .from('transactions')
          .insert({
            handler_id,
            customer_name,
            customer_phone,
            subtotal,
            discount,
            total_amount,
            payment_method,
            status: isPending ? 'pending' : 'completed',
            qr_payload,
            confirmed_at: isPending ? null : new Date().toISOString(),
          })
          .select()
          .single();

        if (!error && txn) {
          const itemRows = items.map((i) => ({
            transaction_id: txn.id,
            service_id: i.service_id || null,
            service_name: i.name,
            price: i.price,
            is_custom_price: !!i.is_custom_price,
            quantity: i.quantity || 1,
          }));
          await supabase.from('transaction_items').insert(itemRows);
          return NextResponse.json({ ...txn, qr_payload }, { status: 201 });
        }
      }
    } catch (e) {}
  }

  const newTxn = {
    id: txnId,
    handler_id: 'demo-handler-id',
    customer_name,
    customer_phone,
    subtotal,
    discount,
    total_amount,
    payment_method,
    status: isPending ? 'pending' : 'completed',
    qr_payload,
    created_at: new Date().toISOString(),
    confirmed_at: isPending ? null : new Date().toISOString(),
    profiles: { full_name: 'Front Desk' },
    transaction_items: items,
  };

  memoryTransactions.unshift(newTxn);
  return NextResponse.json(newTxn, { status: 201 });
}
