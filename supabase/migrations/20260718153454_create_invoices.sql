create table public.invoices (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id) on delete cascade,

  stripe_invoice_id text not null unique,

  stripe_customer_id text not null,

  stripe_subscription_id text,

  invoice_number text,

  status text not null,

  currency text not null,

  amount_due integer not null,

  amount_paid integer not null,

  hosted_invoice_url text,

  invoice_pdf text,

  period_start timestamptz not null,

  period_end timestamptz not null,

  stripe_created_at timestamptz not null,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint invoices_status_allowed
    check (
      status in (
        'draft',
        'open',
        'paid',
        'uncollectible',
        'void'
      )
    )
);

create index invoices_user_id_period_end_idx
  on public.invoices(user_id, period_end desc);

create index invoices_stripe_customer_id_idx
  on public.invoices(stripe_customer_id);

create index invoices_stripe_subscription_id_idx
  on public.invoices(stripe_subscription_id)
  where stripe_subscription_id is not null;

create index invoices_status_idx
  on public.invoices(status);

alter table public.invoices enable row level security;

create policy "Users can read own invoices"
  on public.invoices
  for select
  to authenticated
  using ((select auth.uid()) = user_id);