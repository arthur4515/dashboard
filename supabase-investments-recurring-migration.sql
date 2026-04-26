alter table public.investments
  add column if not exists details jsonb not null default '{}'::jsonb;

alter table public.recurring_transactions
  add column if not exists kind text not null default 'despesa',
  add column if not exists end_date date null,
  add column if not exists status text not null default 'ativa',
  add column if not exists next_date date null;
