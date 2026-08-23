alter table public.executions
  add column if not exists event_sequence integer not null default 0;

create table if not exists public.execution_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  execution_id uuid not null references public.executions(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  event_type text not null check (event_type in (
    'execution.started',
    'execution.retry_scheduled',
    'execution.succeeded',
    'execution.failed',
    'execution.attempt.started',
    'execution.attempt.succeeded',
    'execution.attempt.failed',
    'execution.step.started',
    'execution.step.succeeded',
    'execution.step.failed',
    'execution.step.skipped'
  )),
  data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object'),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'published')),
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  claim_token uuid,
  claim_expires_at timestamptz,
  last_error text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  constraint execution_notification_outbox_execution_sequence_unique
    unique (execution_id, sequence)
);

create index if not exists execution_notification_outbox_pending_idx
  on public.execution_notification_outbox (
    status,
    next_attempt_at,
    claim_expires_at,
    created_at
  );

create index if not exists execution_notification_outbox_published_at_idx
  on public.execution_notification_outbox (published_at)
  where status = 'published';

alter table public.execution_notification_outbox enable row level security;
