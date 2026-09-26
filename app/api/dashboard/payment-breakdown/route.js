import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabaseClient';
import { memoryTransactions } from '../../transactions/route';

export async function GET() {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('revenue_daily')
        .select('payment_method, revenue');
      
      if (!error && data) {
        const totals = { cash: 0, card: 0, qr: 0 };
        for (const r of data) {
          totals[r.payment_method] = (totals[r.payment_method] || 0) + Number(r.revenue);
        }
        return NextResponse.json(totals);
      }
    } catch (e) {}
  }

  const totals = { cash: 4500, card: 3200, qr: 6800 };
  for (const t of memoryTransactions) {
    if (t.status === 'completed') {
      totals[t.payment_method] = (totals[t.payment_method] || 0) + Number(t.total_amount);
    }
  }
  return NextResponse.json(totals);
}
