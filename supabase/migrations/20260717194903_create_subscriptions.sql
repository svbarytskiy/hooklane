create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id) on delete cascade,

  stripe_customer_id text not null,

  stripe_subscription_id text not null unique,

  stripe_subscription_item_id text not null unique,

  stripe_price_id text not null,

  status text not null,

  current_period_start timestamptz not null,

  current_period_end timestamptz not null,

  cancel_at_period_end boolean not null default false,

  trial_end timestamptz,

  canceled_at timestamptz,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint subscriptions_status_allowed
    check (
      status in (
        'incomplete',
        'incomplete_expired',
        'trialing',
        'active',
        'past_due',
        'canceled',
        'unpaid',
        'paused'
      )
    )
);

create index subscriptions_user_id_idx
  on public.subscriptions(user_id);

create index subscriptions_status_idx
  on public.subscriptions(status);

create unique index subscriptions_one_current_per_user_unique
  on public.subscriptions(user_id)
  where status in (
    'incomplete',
    'trialing',
    'active',
    'past_due',
    'unpaid',
    'paused'
  );

alter table public.subscriptions enable row level security;

create policy "Users can read own subscriptions"
  on public.subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
