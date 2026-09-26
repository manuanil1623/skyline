import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabaseClient';
import { memoryTransactions } from '../route';

export async function GET() {
  if (isSupabaseConfigured()) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const { data, error } = await supabase
          .from('transactions')
          .select('*, transaction_items(*)')
          .eq('handler_id', session.user.id)
          .gte('created_at', startOfDay.toISOString())
          .order('created_at', { ascending: false });

        if (!error && data) return NextResponse.json(data);
      }
    } catch (e) {}
  }

  // Today memory fallback
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayList = memoryTransactions.filter((t) => new Date(t.created_at) >= startOfDay);
  return NextResponse.json(todayList);
}
