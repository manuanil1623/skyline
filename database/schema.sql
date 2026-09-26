-- =====================================================================
-- SKYLINE BEAUTY PARLOUR ACCOUNTING APP — DATABASE SCHEMA (Postgres / Supabase)
-- =====================================================================
-- Run in the Supabase SQL editor (SQL Editor -> New Query -> Run).
-- Safe to run multiple times (idempotent).
-- =====================================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- 1. ROLES & ENUM TYPES
-- ---------------------------------------------------------------------
do $$ 
begin 
  if not exists (select 1 from pg_type where typname = 'user_role') then 
    create type user_role as enum ('admin', 'handler'); 
  end if; 
  if not exists (select 1 from pg_type where typname = 'payment_method') then 
    create type payment_method as enum ('cash', 'card', 'qr'); 
  end if; 
  if not exists (select 1 from pg_type where typname = 'transaction_status') then 
    create type transaction_status as enum ('pending', 'completed', 'voided'); 
  end if; 
end $$;

-- ---------------------------------------------------------------------
-- 2. STAFF PROFILES
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null,
  role          user_role not null default 'handler',
  is_active     boolean not null default true,
  phone         text,
  created_at    timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  user_role_val public.user_role := 'handler';
  user_name_val text := 'New Staff';
begin
  if new.raw_user_meta_data is not null then
    if new.raw_user_meta_data->>'full_name' is not null then
      user_name_val := new.raw_user_meta_data->>'full_name';
    end if;
    if new.raw_user_meta_data->>'role' = 'admin' then
      user_role_val := 'admin';
    end if;
  end if;

  insert into public.profiles (id, full_name, role)
  values (new.id, user_name_val, user_role_val)
  on conflict (id) do nothing;

  return new;
exception when others then
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ---------------------------------------------------------------------
-- 3. SERVICES CATALOG
-- ---------------------------------------------------------------------
create table if not exists services (
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
-- 4. TRANSACTIONS (the daily ledger)
-- ---------------------------------------------------------------------
create table if not exists transactions (
  id                uuid primary key default uuid_generate_v4(),
  handler_id        uuid not null references profiles(id),
  customer_name     text,
  customer_phone    text,
  subtotal          numeric(10,2) not null,
  discount          numeric(10,2) not null default 0,
  total_amount      numeric(10,2) not null,
  payment_method    payment_method not null,
  status            transaction_status not null default 'pending',
  qr_payload        text,                 -- exact UPI string generated
  upi_ref_id        text,                 -- reference id once confirmed/webhook-verified
  voided_by         uuid references profiles(id),
  void_reason       text,
  created_at        timestamptz not null default now(),
  confirmed_at      timestamptz
);

create table if not exists transaction_items (
  id              uuid primary key default uuid_generate_v4(),
  transaction_id  uuid not null references transactions(id) on delete cascade,
  service_id      uuid references services(id),
  service_name    text not null,          -- snapshot name
  price           numeric(10,2) not null, -- snapshot price
  is_custom_price boolean not null default false,
  quantity        int not null default 1
);

create index if not exists idx_transactions_created_at on transactions(created_at);
create index if not exists idx_transactions_handler on transactions(handler_id);
create index if not exists idx_transactions_status on transactions(status);
create index if not exists idx_transaction_items_txn on transaction_items(transaction_id);

-- ---------------------------------------------------------------------
-- 5. HELPER VIEWS: daily/weekly/monthly revenue rollups for Admin
-- ---------------------------------------------------------------------
create or replace view revenue_daily as
  select date_trunc('day', created_at) as period, payment_method,
         sum(total_amount) as revenue, count(*) as txn_count
  from transactions
  where status = 'completed'
  group by 1, 2;

create or replace view revenue_weekly as
  select date_trunc('week', created_at) as period, payment_method,
         sum(total_amount) as revenue, count(*) as txn_count
  from transactions
  where status = 'completed'
  group by 1, 2;

create or replace view revenue_monthly as
  select date_trunc('month', created_at) as period, payment_method,
         sum(total_amount) as revenue, count(*) as txn_count
  from transactions
  where status = 'completed'
  group by 1, 2;

-- ---------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RBAC)
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

-- Drop existing policies to allow clean re-execution
drop policy if exists "read own profile" on profiles;
drop policy if exists "admin manages profiles" on profiles;
drop policy if exists "staff read services" on services;
drop policy if exists "admin writes services" on services;
drop policy if exists "admin updates services" on services;
drop policy if exists "admin deletes services" on services;
drop policy if exists "handler inserts own txn" on transactions;
drop policy if exists "handler reads own today txn" on transactions;
drop policy if exists "handler confirms own pending txn" on transactions;
drop policy if exists "admin full access txn" on transactions;
drop policy if exists "read items via txn access" on transaction_items;
drop policy if exists "insert items via own txn" on transaction_items;
drop policy if exists "admin manage items" on transaction_items;

-- Re-create policies
create policy "read own profile" on profiles for select
  using (id = auth.uid() or is_admin());
create policy "admin manages profiles" on profiles for all
  using (is_admin());

create policy "staff read services" on services for select
  using (auth.role() = 'authenticated');
create policy "admin writes services" on services for insert with check (is_admin());
create policy "admin updates services" on services for update using (is_admin());
create policy "admin deletes services" on services for delete using (is_admin());

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
-- 7. SEED DATA (inserted only if services table is empty)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from services limit 1) then
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
  end if;
end $$;
