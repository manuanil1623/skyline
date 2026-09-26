import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

let memoryStaff = [
  { id: 'demo-admin-id', full_name: 'Owner Admin', role: 'admin', is_active: true, phone: '9876543210', created_at: new Date().toISOString() },
  { id: 'demo-handler-id', full_name: 'Front Desk Stylist', role: 'handler', is_active: true, phone: '9876543211', created_at: new Date().toISOString() },
];

export async function GET() {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, is_active, phone, created_at')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) return NextResponse.json(data);
    } catch (e) {}
  }
  return NextResponse.json(memoryStaff);
}

export async function POST(req) {
  const body = await req.json();
  const { full_name, role = 'handler', phone = '' } = body;

  if (!full_name) {
    return NextResponse.json({ error: 'full_name is required' }, { status: 400 });
  }

  const newStaff = {
    id: `staff-${Date.now()}`,
    full_name,
    role,
    is_active: true,
    phone,
    created_at: new Date().toISOString(),
  };
  memoryStaff.unshift(newStaff);
  return NextResponse.json(newStaff, { status: 201 });
}
