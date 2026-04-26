-- Dingaringa Finance SaaS migration
-- Execute no SQL Editor do Supabase. Mantem dados atuais e adiciona o modelo profissional.

alter table public.transactions
  add column if not exists title text,
  add column if not exists is_recurring boolean not null default false,
  add column if not exists status text not null default 'realizado';

update public.transactions
set title = coalesce(title, description, 'Lancamento')
where title is null;

alter table public.transactions
  drop constraint if exists transactions_status_check;

alter table public.transactions
  add constraint transactions_status_check
  check (status in ('realizado', 'previsto'));

alter table public.recurring_transactions
  add column if not exists title text,
  add column if not exists auto_generate boolean not null default false;

update public.recurring_transactions
set title = coalesce(title, description, 'Recorrencia')
where title is null;

create table if not exists public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  hours_worked numeric not null check (hours_worked > 0),
  hourly_rate numeric not null check (hourly_rate > 0),
  total_earned numeric not null check (total_earned >= 0),
  transaction_id uuid null references public.transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.work_sessions enable row level security;

drop policy if exists "Users can view own work sessions" on public.work_sessions;
drop policy if exists "Users can insert own work sessions" on public.work_sessions;
drop policy if exists "Users can update own work sessions" on public.work_sessions;
drop policy if exists "Users can delete own work sessions" on public.work_sessions;

create policy "Users can view own work sessions"
  on public.work_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own work sessions"
  on public.work_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own work sessions"
  on public.work_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own work sessions"
  on public.work_sessions for delete
  using (auth.uid() = user_id);

create index if not exists work_sessions_user_date_idx on public.work_sessions(user_id, date desc);
create index if not exists transactions_user_status_date_idx on public.transactions(user_id, status, date desc);
