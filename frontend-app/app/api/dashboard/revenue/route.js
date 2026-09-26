import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../../lib/supabaseClient';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || 'daily';

  if (isSupabaseConfigured()) {
    try {
      const viewMap = { daily: 'revenue_daily', weekly: 'revenue_weekly', monthly: 'revenue_monthly' };
      const { data, error } = await supabase
        .from(viewMap[period] || 'revenue_daily')
        .select('*')
        .order('period', { ascending: true })
        .limit(60);
      if (!error && data && data.length > 0) return NextResponse.json(data);
    } catch (e) {}
  }

  // Memory fallback sample series
  const now = new Date();
  const series = [];
  const count = period === 'daily' ? 7 : period === 'weekly' ? 4 : 6;

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    if (period === 'daily') d.setDate(d.getDate() - i);
    else if (period === 'weekly') d.setDate(d.getDate() - i * 7);
    else d.setMonth(d.getMonth() - i);

    series.push({
      period: d.toISOString(),
      revenue: Math.floor(2500 + Math.random() * 8000),
      txn_count: Math.floor(3 + Math.random() * 10),
    });
  }

  return NextResponse.json(series);
}
