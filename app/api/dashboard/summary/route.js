import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabaseClient';
import { memoryTransactions } from '../../transactions/route';

export async function GET() {
  if (isSupabaseConfigured()) {
    try {
      const now = new Date();
      const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
      const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const totalsFor = async (since) => {
        const { data, error } = await supabase
          .from('transactions')
          .select('total_amount')
          .eq('status', 'completed')
          .gte('created_at', since.toISOString());
        if (error) throw error;
        return data.reduce((sum, r) => sum + Number(r.total_amount), 0);
      };

      const [today, week, month] = await Promise.all([
        totalsFor(startOfDay),
        totalsFor(startOfWeek),
        totalsFor(startOfMonth),
      ]);

      return NextResponse.json({ today, week, month });
    } catch (e) {}
  }

  // Memory fallback
  const now = new Date();
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const completed = memoryTransactions.filter((t) => t.status === 'completed');
  const today = completed
    .filter((t) => new Date(t.created_at) >= startOfDay)
    .reduce((s, t) => s + Number(t.total_amount), 0);
  const week = completed
    .filter((t) => new Date(t.created_at) >= startOfWeek)
    .reduce((s, t) => s + Number(t.total_amount), 0);
  const month = completed
    .filter((t) => new Date(t.created_at) >= startOfMonth)
    .reduce((s, t) => s + Number(t.total_amount), 0);

  return NextResponse.json({ today, week, month });
}
