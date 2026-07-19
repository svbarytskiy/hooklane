create table public.refunds (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id) on delete cascade,

  payment_id uuid
    references public.payments(id) on delete cascade,

  invoice_id uuid
    references public.invoices(id) on delete cascade,

  stripe_refund_id text not null unique,

  stripe_charge_id text,

  stripe_payment_intent_id text,

  amount integer not null,

  currency text not null,

  status text not null,

  reason text,

  failure_reason text,

  stripe_created_at timestamptz not null,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint refunds_amount_positive
    check (amount > 0),

  constraint refunds_status_allowed
    check (
      status in (
        'pending',
        'requires_action',
        'succeeded',
        'failed',
        'canceled'
      )
    ),

  constraint refunds_exactly_one_source
    check (
      (payment_id is not null and invoice_id is null)
      or
      (payment_id is null and invoice_id is not null)
    )
);

create index refunds_user_id_created_at_idx
  on public.refunds(user_id, created_at desc);

create index refunds_payment_id_idx
  on public.refunds(payment_id)
  where payment_id is not null;

create index refunds_invoice_id_idx
  on public.refunds(invoice_id)
  where invoice_id is not null;

create index refunds_status_idx
  on public.refunds(status);

create index refunds_stripe_payment_intent_id_idx
  on public.refunds(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table public.credit_transactions
  add column refund_id uuid
    references public.refunds(id) on delete set null;

create unique index credit_transactions_refund_id_unique
  on public.credit_transactions(refund_id)
  where refund_id is not null;

alter table public.refunds enable row level security;

create policy "Users can read own refunds"
  on public.refunds
  for select
  to authenticated
  using ((select auth.uid()) = user_id);