create table public.payments (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  stripe_customer_id text not null,

  stripe_checkout_session_id text unique,

  stripe_payment_intent_id text unique,

  product_type text not null,

  amount integer not null
    check (amount > 0),

  currency text not null default 'usd',

  credits_amount integer not null
    check (credits_amount > 0),

  status text not null default 'pending'
    check (status in (
      'pending',
      'paid',
      'failed',
      'canceled',
      'expired'
    )),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_user_id_idx
  on public.payments(user_id);

create index payments_status_idx
  on public.payments(status);

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  payment_id uuid
    references public.payments(id)
    on delete set null,

  amount integer not null
    check (amount <> 0),

  type text not null
    check (type in (
      'purchase',
      'refund',
      'adjustment'
    )),

  description text,

  created_at timestamptz not null default now()
);

create index credit_transactions_user_id_idx
  on public.credit_transactions(user_id);

create index credit_transactions_payment_id_idx
  on public.credit_transactions(payment_id);

alter table public.payments enable row level security;

create policy "payments_select_own"
on public.payments
for select
to authenticated
using (auth.uid() = user_id);

alter table public.credit_transactions enable row level security;

create policy "credit_transactions_select_own"
on public.credit_transactions
for select
to authenticated
using (auth.uid() = user_id);
