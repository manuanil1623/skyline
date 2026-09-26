import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../lib/supabaseClient';

const INITIAL_MOCK_SERVICES = [
  { id: 'srv-1', name: 'Haircut & Styling', category: 'Hair', base_price: 350, duration_mins: 30, is_active: true },
  { id: 'srv-2', name: 'Luxury Hair Spa', category: 'Hair', base_price: 950, duration_mins: 60, is_active: true },
  { id: 'srv-3', name: 'Global Hair Color', category: 'Hair', base_price: 1800, duration_mins: 90, is_active: true },
  { id: 'srv-4', name: 'Classic Glow Facial', category: 'Skin', base_price: 850, duration_mins: 45, is_active: true },
  { id: 'srv-5', name: 'Gold Radiance Facial', category: 'Skin', base_price: 1600, duration_mins: 60, is_active: true },
  { id: 'srv-6', name: 'Deluxe Manicure', category: 'Nails', base_price: 450, duration_mins: 30, is_active: true },
  { id: 'srv-7', name: 'Deluxe Pedicure', category: 'Nails', base_price: 550, duration_mins: 40, is_active: true },
  { id: 'srv-8', name: 'Eyebrow Threading', category: 'Threading', base_price: 60, duration_mins: 10, is_active: true },
  { id: 'srv-9', name: 'Full Body Waxing', category: 'Waxing', base_price: 1300, duration_mins: 60, is_active: true },
  { id: 'srv-10', name: 'Bridal Makeup', category: 'Makeup', base_price: 5500, duration_mins: 120, is_active: true },
];

let memoryServices = [...INITIAL_MOCK_SERVICES];

export async function GET() {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('name');
      
      if (!error && data && data.length > 0) {
        return NextResponse.json(data);
      }
    } catch (e) {
      console.warn('Supabase fetch failed, using fallback services:', e);
    }
  }
  return NextResponse.json(memoryServices.filter((s) => s.is_active));
}

export async function POST(req) {
  const body = await req.json();
  const { name, category = 'General', base_price, duration_mins = 30 } = body;

  if (!name || base_price == null) {
    return NextResponse.json({ error: 'name and base_price are required' }, { status: 400 });
  }

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('services')
        .insert({ name, category, base_price, duration_mins })
        .select()
        .single();
      if (!error && data) return NextResponse.json(data, { status: 201 });
    } catch (e) {}
  }

  const newService = {
    id: `srv-${Date.now()}`,
    name,
    category,
    base_price: Number(base_price),
    duration_mins: Number(duration_mins),
    is_active: true,
  };
  memoryServices.push(newService);
  return NextResponse.json(newService, { status: 201 });
}

export async function PATCH(req) {
  const body = await req.json();
  const { id, ...updates } = body;

  if (isSupabaseConfigured() && id) {
    try {
      const { data, error } = await supabase
        .from('services')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (!error && data) return NextResponse.json(data);
    } catch (e) {}
  }

  const index = memoryServices.findIndex((s) => s.id === id);
  if (index !== -1) {
    memoryServices[index] = { ...memoryServices[index], ...updates };
    return NextResponse.json(memoryServices[index]);
  }
  return NextResponse.json({ error: 'Service not found' }, { status: 404 });
}
