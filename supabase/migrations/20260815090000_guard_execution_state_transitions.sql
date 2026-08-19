-- The application also guards transitions in its repository methods.
-- These triggers make those rules durable even if a future caller bypasses the app.

create or replace function public.guard_execution_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status in ('succeeded', 'failed', 'cancelled') then
    raise exception 'execution % is terminal and cannot transition from % to %', old.id, old.status, new.status;
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

drop trigger if exists executions_guard_status_transition on public.executions;
create trigger executions_guard_status_transition
before update of status on public.executions
for each row execute function public.guard_execution_status_transition();

create or replace function public.guard_runtime_status_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status <> 'running' or new.status not in ('succeeded', 'failed') then
    raise exception 'invalid % transition from % to %', tg_table_name, old.status, new.status;
  end if;

  return new;
end;
$$;

drop trigger if exists execution_attempts_guard_status_transition on public.execution_attempts;
create trigger execution_attempts_guard_status_transition
before update of status on public.execution_attempts
for each row execute function public.guard_runtime_status_transition();

drop trigger if exists execution_steps_guard_status_transition on public.execution_steps;
create trigger execution_steps_guard_status_transition
before update of status on public.execution_steps
for each row execute function public.guard_runtime_status_transition();

create unique index if not exists execution_attempts_execution_attempt_number_unique
  on public.execution_attempts (execution_id, attempt_number);
