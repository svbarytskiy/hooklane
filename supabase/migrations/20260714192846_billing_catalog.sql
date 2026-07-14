create table public.billing_catalog (
  id uuid primary key default gen_random_uuid(),

  code text not null unique,

  stripe_product_id text not null,

  stripe_price_id text not null unique,

  type text not null
    check (type in ('one_time', 'subscription')),

  credits_amount integer
    check (credits_amount is null or credits_amount > 0),

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index billing_catalog_active_idx
  on public.billing_catalog(active);

create index billing_catalog_type_idx
  on public.billing_catalog(type);

alter table public.billing_catalog enable row level security;