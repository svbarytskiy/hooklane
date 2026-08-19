create unique index if not exists execution_steps_attempt_step_unique
  on public.execution_steps (attempt_id, step_id);

alter table public.executions
  add column if not exists run_sequence integer not null default 0,
  add column if not exists replayed_from_execution_id uuid references public.executions(id) on delete set null,
  add column if not exists active_recovery_id uuid,
  add column if not exists dead_lettered_at timestamptz;

drop index if exists public.executions_incoming_event_id_unique;
create unique index if not exists executions_original_incoming_event_unique
  on public.executions (incoming_event_id)
  where replayed_from_execution_id is null;

alter table public.executions
  drop constraint if exists executions_status_allowed;
alter table public.executions
  add constraint executions_status_allowed
  check (status in ('pending', 'queued', 'running', 'succeeded', 'failed', 'cancelled', 'dead_lettered'));

create table if not exists public.execution_recoveries (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.executions(id) on delete cascade,
  target_execution_id uuid references public.executions(id) on delete set null,
  operation text not null check (operation in ('retry_failed_step', 'resume', 'replay_as_new', 'dead_letter')),
  from_attempt_id uuid references public.execution_attempts(id) on delete set null,
  step_id text,
  start_step_index integer,
  checkpoint jsonb,
  resolution_output jsonb,
  requested_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint execution_recoveries_start_step_non_negative
    check (start_step_index is null or start_step_index >= 0)
);

alter table public.execution_attempts enable row level security;
alter table public.execution_steps enable row level security;
alter table public.execution_outbox enable row level security;
alter table public.execution_recoveries enable row level security;

create index if not exists execution_recoveries_execution_created_idx
  on public.execution_recoveries (execution_id, created_at desc);

alter table public.executions
  drop constraint if exists executions_active_recovery_id_fkey;
alter table public.executions
  add constraint executions_active_recovery_id_fkey
  foreign key (active_recovery_id) references public.execution_recoveries(id) on delete set null;

create or replace function public.guard_execution_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then return new; end if;

  if old.status = 'succeeded' or old.status = 'cancelled' or old.status = 'dead_lettered' then
    raise exception 'execution % is terminal and cannot transition from % to %', old.id, old.status, new.status;
  end if;

  if old.status = 'failed' and new.status not in ('pending', 'dead_lettered') then
    raise exception 'invalid execution transition from % to %', old.status, new.status;
  end if;

  if old.status = 'pending' and new.status not in ('queued', 'cancelled') then
    raise exception 'invalid execution transition from % to %', old.status, new.status;
  end if;

  if old.status = 'queued' and new.status not in ('running', 'cancelled') then
    raise exception 'invalid execution transition from % to %', old.status, new.status;
  end if;

  if old.status = 'running' and new.status not in ('queued', 'succeeded', 'failed', 'cancelled') then
    raise exception 'invalid execution transition from % to %', old.status, new.status;
  end if;

  return new;
end;
$$;
