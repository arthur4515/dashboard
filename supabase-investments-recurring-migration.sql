alter table public.investments
  add column if not exists details jsonb not null default '{}'::jsonb;

alter table public.recurring_transactions
  add column if not exists kind text not null default 'despesa',
  add column if not exists end_date date null,
  add column if not exists status text not null default 'ativa',
  add column if not exists next_date date null,
  add column if not exists execution_day integer null;

alter table public.recurring_transactions
  drop constraint if exists recurring_transactions_frequency_check;

alter table public.recurring_transactions
  add constraint recurring_transactions_frequency_check
  check (frequency in ('diaria', 'semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual'));

alter table public.recurring_transactions
  drop constraint if exists recurring_transactions_kind_check;

alter table public.recurring_transactions
  add constraint recurring_transactions_kind_check
  check (kind in ('receita', 'despesa', 'aporte'));

alter table public.recurring_transactions
  drop constraint if exists recurring_transactions_status_check;

alter table public.recurring_transactions
  add constraint recurring_transactions_status_check
  check (status in ('ativa', 'inativa', 'pausada', 'encerrada'));

alter table public.recurring_transactions
  drop constraint if exists recurring_transactions_execution_day_check;

alter table public.recurring_transactions
  add constraint recurring_transactions_execution_day_check
  check (execution_day is null or execution_day between 0 and 31);
