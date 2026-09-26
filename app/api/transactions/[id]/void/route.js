import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../../../lib/supabaseClient';
import { memoryTransactions } from '../../route';

export async function POST(req, { params }) {
  const { id } = await params;
  const body = await req.json();
  const { reason = 'Voided by admin' } = body;

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .update({ status: 'voided', void_reason: reason })
        .eq('id', id)
        .select()
        .single();
      if (!error && data) return NextResponse.json(data);
    } catch (e) {}
  }

  const txn = memoryTransactions.find((t) => t.id === id);
  if (txn) {
    txn.status = 'voided';
    txn.void_reason = reason;
    return NextResponse.json(txn);
  }

  return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
}
