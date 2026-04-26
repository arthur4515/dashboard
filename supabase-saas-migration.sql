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

alter table public.work_sessions
  add column if not exists type text not null default 'normal',
  add column if not exists hours_extra numeric not null default 0,
  add column if not exists worked boolean not null default true,
  add column if not exists is_absent boolean not null default false,
  add column if not exists discounts numeric not null default 0,
  add column if not exists gross_earned numeric not null default 0,
  add column if not exists net_earned numeric not null default 0;

update public.work_sessions
set
  gross_earned = case when gross_earned = 0 then total_earned else gross_earned end,
  net_earned = case when net_earned = 0 then total_earned else net_earned end,
  is_absent = case when type = 'falta' then true else is_absent end,
  worked = case when type in ('falta', 'folga') then false else worked end;

alter table public.work_sessions
  drop constraint if exists work_sessions_hours_worked_check;

alter table public.work_sessions
  add constraint work_sessions_hours_worked_check
  check (hours_worked >= 0);

alter table public.work_sessions
  drop constraint if exists work_sessions_hourly_rate_check;

alter table public.work_sessions
  add constraint work_sessions_hourly_rate_check
  check (hourly_rate >= 0);

alter table public.work_sessions
  drop constraint if exists work_sessions_type_check;

alter table public.work_sessions
  add constraint work_sessions_type_check
  check (type in ('normal', 'falta', 'extra', 'folga'));

alter table public.work_sessions
  drop constraint if exists work_sessions_hours_extra_check;

alter table public.work_sessions
  add constraint work_sessions_hours_extra_check
  check (hours_extra >= 0);

alter table public.work_sessions
  drop constraint if exists work_sessions_discounts_check;

alter table public.work_sessions
  add constraint work_sessions_discounts_check
  check (discounts >= 0);

alter table public.work_sessions
  drop constraint if exists work_sessions_gross_earned_check;

alter table public.work_sessions
  add constraint work_sessions_gross_earned_check
  check (gross_earned >= 0);

alter table public.work_sessions
  drop constraint if exists work_sessions_net_earned_check;

alter table public.work_sessions
  add constraint work_sessions_net_earned_check
  check (net_earned >= 0);

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

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  default_hourly_rate numeric not null default 25,
  default_daily_hours numeric not null default 8,
  overtime_multiplier numeric not null default 1.5,
  created_at timestamptz not null default now()
);

alter table public.user_settings
  add column if not exists hourly_rate numeric not null default 25,
  add column if not exists default_hours numeric not null default 8,
  add column if not exists discount_inss numeric not null default 0,
  add column if not exists discount_fgts numeric not null default 0,
  add column if not exists other_discounts numeric not null default 0;

update public.user_settings
set
  hourly_rate = coalesce(hourly_rate, default_hourly_rate, 25),
  default_hours = coalesce(default_hours, default_daily_hours, 8);

alter table public.user_settings
  drop constraint if exists user_settings_hourly_rate_check;

alter table public.user_settings
  add constraint user_settings_hourly_rate_check
  check (hourly_rate >= 0);

alter table public.user_settings
  drop constraint if exists user_settings_default_hours_check;

alter table public.user_settings
  add constraint user_settings_default_hours_check
  check (default_hours >= 0);

alter table public.user_settings
  drop constraint if exists user_settings_overtime_multiplier_check;

alter table public.user_settings
  add constraint user_settings_overtime_multiplier_check
  check (overtime_multiplier >= 1);

alter table public.user_settings
  drop constraint if exists user_settings_discount_inss_check;

alter table public.user_settings
  add constraint user_settings_discount_inss_check
  check (discount_inss >= 0);

alter table public.user_settings
  drop constraint if exists user_settings_discount_fgts_check;

alter table public.user_settings
  add constraint user_settings_discount_fgts_check
  check (discount_fgts >= 0);

alter table public.user_settings
  drop constraint if exists user_settings_other_discounts_check;

alter table public.user_settings
  add constraint user_settings_other_discounts_check
  check (other_discounts >= 0);

alter table public.user_settings enable row level security;

drop policy if exists "Users can view own settings" on public.user_settings;
drop policy if exists "Users can insert own settings" on public.user_settings;
drop policy if exists "Users can update own settings" on public.user_settings;
drop policy if exists "Users can delete own settings" on public.user_settings;

create policy "Users can view own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert own settings"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own settings"
  on public.user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own settings"
  on public.user_settings for delete
  using (auth.uid() = user_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  type text not null check (type in ('vale', 'salario')),
  date date not null,
  transaction_id uuid null references public.transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.payments
  add column if not exists transaction_id uuid null references public.transactions(id) on delete set null,
  add column if not exists gross_amount numeric not null default 0,
  add column if not exists discounts numeric not null default 0,
  add column if not exists net_amount numeric not null default 0;

update public.payments
set
  gross_amount = case when gross_amount = 0 then amount else gross_amount end,
  net_amount = case when net_amount = 0 then amount else net_amount end;

alter table public.payments
  drop constraint if exists payments_gross_amount_check;

alter table public.payments
  add constraint payments_gross_amount_check
  check (gross_amount >= 0);

alter table public.payments
  drop constraint if exists payments_discounts_check;

alter table public.payments
  add constraint payments_discounts_check
  check (discounts >= 0);

alter table public.payments
  drop constraint if exists payments_net_amount_check;

alter table public.payments
  add constraint payments_net_amount_check
  check (net_amount >= 0);

alter table public.payments enable row level security;

drop policy if exists "Users can view own payments" on public.payments;
drop policy if exists "Users can insert own payments" on public.payments;
drop policy if exists "Users can update own payments" on public.payments;
drop policy if exists "Users can delete own payments" on public.payments;

create policy "Users can view own payments"
  on public.payments for select
  using (auth.uid() = user_id);

create policy "Users can insert own payments"
  on public.payments for insert
  with check (auth.uid() = user_id);

create policy "Users can update own payments"
  on public.payments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own payments"
  on public.payments for delete
  using (auth.uid() = user_id);

create index if not exists payments_user_date_idx on public.payments(user_id, date desc);
create unique index if not exists payments_user_type_date_idx on public.payments(user_id, type, date);
