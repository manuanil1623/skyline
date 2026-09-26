-- =====================================================================
-- SKYLINE BEAUTY PARLOUR ACCOUNTING APP — DATABASE SCHEMA (Postgres / Supabase)
-- =====================================================================
-- Run in the Supabase SQL editor, top to bottom. Uses Supabase Auth
-- (auth.users) as the identity source; this file adds a `profiles`
-- table to hold role + salon metadata, plus RLS policies for RBAC.
-- =====================================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- 1. ROLES & STAFF PROFILES
-- ---------------------------------------------------------------------
create type user_role as enum ('admin', 'handler');

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null,
  role          user_role not null default 'handler',
  is_active     boolean not null default true,
  phone         text,
  created_at    timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
-- (Admin creates staff logins via Supabase Admin API — see backend/routes/staff.js)
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'New Staff'),
          coalesce((new.raw_user_meta_data->>'role')::user_role, 'handler'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ---------------------------------------------------------------------
-- 2. SERVICES CATALOG (Admin CRUD)
-- ---------------------------------------------------------------------
create table services (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  category      text default 'General',
  base_price    numeric(10,2) not null check (base_price >= 0),
  duration_mins int default 30,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. TRANSACTIONS (the daily ledger)
-- ---------------------------------------------------------------------
create type payment_method as enum ('cash', 'card', 'qr');
create type transaction_status as enum ('pending', 'completed', 'voided');

create table transactions (
  id                uuid primary key default uuid_generate_v4(),
  handler_id        uuid not null references profiles(id),
  customer_name     text,
  customer_phone    text,
  subtotal          numeric(10,2) not null,
  discount          numeric(10,2) not null default 0,
  total_amount      numeric(10,2) not null,
  payment_method    payment_method not null,
  status            transaction_status not null default 'pending',
  qr_payload        text,                 -- the exact UPI string generated
  upi_ref_id        text,                 -- reference id once confirmed/webhook-verified
  voided_by         uuid references profiles(id),
  void_reason       text,
  created_at        timestamptz not null default now(),
  confirmed_at      timestamptz
);

create table transaction_items (
  id              uuid primary key default uuid_generate_v4(),
  transaction_id  uuid not null references transactions(id) on delete cascade,
  service_id      uuid references services(id),
  service_name    text not null,          -- snapshot, in case service is later renamed/deleted
  price           numeric(10,2) not null, -- snapshot price (supports manual override)
  is_custom_price boolean not null default false,
  quantity        int not null default 1
);

create index idx_transactions_created_at on transactions(created_at);
create index idx_transactions_handler on transactions(handler_id);
create index idx_transactions_status on transactions(status);
create index idx_transaction_items_txn on transaction_items(transaction_id);

-- ---------------------------------------------------------------------
-- 4. HELPER VIEW: daily/weekly/monthly revenue rollups for Admin
-- ---------------------------------------------------------------------
create view revenue_daily as
  select date_trunc('day', created_at) as period, payment_method,
         sum(total_amount) as revenue, count(*) as txn_count
  from transactions
  where status = 'completed'
  group by 1, 2;

create view revenue_weekly as
  select date_trunc('week', created_at) as period, payment_method,
         sum(total_amount) as revenue, count(*) as txn_count
  from transactions
  where status = 'completed'
  group by 1, 2;

create view revenue_monthly as
  select date_trunc('month', created_at) as period, payment_method,
         sum(total_amount) as revenue, count(*) as txn_count
  from transactions
  where status = 'completed'
  group by 1, 2;

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RBAC enforced at the DB layer)
-- ---------------------------------------------------------------------
alter table profiles enable row level security;
alter table services enable row level security;
alter table transactions enable row level security;
alter table transaction_items enable row level security;

-- Helper: is the current JWT user an admin?
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin' and is_active
  );
$$ language sql stable security definer;

-- PROFILES: everyone can read their own row; only admins can read/manage all
create policy "read own profile" on profiles for select
  using (id = auth.uid() or is_admin());
create policy "admin manages profiles" on profiles for all
  using (is_admin());

-- SERVICES: all authenticated staff can read active services;
-- only admins can insert/update/delete (CRUD)
create policy "staff read services" on services for select
  using (auth.role() = 'authenticated');
create policy "admin writes services" on services for insert with check (is_admin());
create policy "admin updates services" on services for update using (is_admin());
create policy "admin deletes services" on services for delete using (is_admin());

-- TRANSACTIONS: handlers can insert their own + read only TODAY's own rows;
-- admins can read/update/void everything (full audit access)
create policy "handler inserts own txn" on transactions for insert
  with check (handler_id = auth.uid());

create policy "handler reads own today txn" on transactions for select
  using (
    is_admin()
    or (handler_id = auth.uid() and created_at::date = now()::date)
  );

create policy "handler confirms own pending txn" on transactions for update
  using (handler_id = auth.uid() and status = 'pending')
  with check (handler_id = auth.uid());

create policy "admin full access txn" on transactions for all
  using (is_admin());

-- TRANSACTION_ITEMS inherit access via parent transaction
create policy "read items via txn access" on transaction_items for select
  using (
    exists (
      select 1 from transactions t
      where t.id = transaction_items.transaction_id
      and (is_admin() or (t.handler_id = auth.uid() and t.created_at::date = now()::date))
    )
  );
create policy "insert items via own txn" on transaction_items for insert
  with check (
    exists (
      select 1 from transactions t
      where t.id = transaction_items.transaction_id and t.handler_id = auth.uid()
    )
  );
create policy "admin manage items" on transaction_items for all using (is_admin());

-- ---------------------------------------------------------------------
-- 6. SEED DATA (example services)
-- ---------------------------------------------------------------------
insert into services (name, category, base_price, duration_mins) values
  ('Haircut', 'Hair', 300, 30),
  ('Hair Spa', 'Hair', 900, 60),
  ('Hair Color', 'Hair', 1800, 90),
  ('Classic Facial', 'Skin', 800, 45),
  ('Gold Facial', 'Skin', 1500, 60),
  ('Manicure', 'Nails', 400, 30),
  ('Pedicure', 'Nails', 500, 40),
  ('Threading (Eyebrows)', 'Threading', 50, 5),
  ('Full Body Waxing', 'Waxing', 1200, 60),
  ('Bridal Makeup', 'Makeup', 5000, 120);
