create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  avatar text not null default 'U',
  theme text not null default 'light',
  savings_goal numeric not null default 25,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('receita', 'despesa')),
  color text not null default '#10b981',
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('receita', 'despesa')),
  category_id text references public.categories(id) on delete set null,
  description text not null,
  amount numeric not null,
  date date not null,
  recurrence_id text null,
  imported boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.budgets (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id text references public.categories(id) on delete cascade,
  limit_amount numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists public.investments (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null,
  initial_amount numeric not null default 0,
  monthly_contribution numeric not null default 0,
  expected_return numeric not null default 0,
  current_return numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.goals (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric not null,
  current_amount numeric not null default 0,
  deadline date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_transactions (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('receita', 'despesa')),
  category_id text references public.categories(id) on delete set null,
  description text not null,
  amount numeric not null,
  start_date date not null,
  frequency text not null check (frequency in ('semanal', 'mensal', 'anual')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.investments enable row level security;
alter table public.goals enable row level security;
alter table public.recurring_transactions enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

create policy "categories_all_own" on public.categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "transactions_all_own" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "budgets_all_own" on public.budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "investments_all_own" on public.investments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "goals_all_own" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "recurring_transactions_all_own" on public.recurring_transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
