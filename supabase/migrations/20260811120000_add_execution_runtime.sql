create table if not exists public.execution_attempts (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.executions(id) on delete cascade,
  attempt_number integer not null,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz,
  completed_at timestamptz,
  error jsonb
);

create index if not exists execution_attempts_execution_id_idx
  on public.execution_attempts (execution_id, attempt_number);

create table if not exists public.execution_steps (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.executions(id) on delete cascade,
  attempt_id uuid not null references public.execution_attempts(id) on delete cascade,
  step_id text not null,
  step_index integer not null,
  status text not null check (status in ('running', 'succeeded', 'failed', 'skipped')),
  input jsonb,
  output jsonb,
  error jsonb,
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists execution_steps_execution_id_idx
  on public.execution_steps (execution_id, step_index);

create table if not exists public.execution_outbox (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null unique references public.executions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'published')),
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  last_error text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists execution_outbox_pending_idx
  on public.execution_outbox (status, next_attempt_at, created_at);
