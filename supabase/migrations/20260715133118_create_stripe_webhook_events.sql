create table public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),

  stripe_event_id text not null unique,

  event_type text not null,

  status text not null default 'received',

  payload jsonb not null,

  error text,

  received_at timestamptz not null default now(),

  processed_at timestamptz,

  created_at timestamptz not null default now(),

  constraint stripe_webhook_events_status_allowed
    check (status in ('received', 'processed', 'failed', 'ignored'))
);

create index stripe_webhook_events_status_idx
  on public.stripe_webhook_events(status);

create index stripe_webhook_events_event_type_idx
  on public.stripe_webhook_events(event_type);