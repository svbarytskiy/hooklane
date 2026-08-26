create table public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version integer not null,
  name text not null,
  max_published_workflows integer not null,
  max_integrations integer not null,
  max_executions_per_period integer not null,
  max_concurrent_executions integer not null,
  execution_retention_days integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint billing_plans_code_version_unique unique (code, version),
  constraint billing_plans_limits_positive check (
    max_published_workflows > 0
    and max_integrations > 0
    and max_executions_per_period > 0
    and max_concurrent_executions > 0
    and execution_retention_days > 0
  )
);

create index billing_plans_active_idx
  on public.billing_plans(active);

insert into public.billing_plans (
  code,
  version,
  name,
  max_published_workflows,
  max_integrations,
  max_executions_per_period,
  max_concurrent_executions,
  execution_retention_days
)
values
  ('free', 1, 'Free', 3, 1, 100, 1, 7),
  ('pro', 1, 'Pro', 25, 10, 10000, 5, 30);

create table public.workspace_billing_accounts (
  workspace_id uuid primary key
    references public.workspaces(id) on delete cascade,
  billing_owner_user_id uuid not null
    references public.profiles(id) on delete restrict,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workspace_billing_accounts_owner_user_id_idx
  on public.workspace_billing_accounts(billing_owner_user_id);

create index workspace_billing_accounts_stripe_customer_id_idx
  on public.workspace_billing_accounts(stripe_customer_id)
  where stripe_customer_id is not null;

create table public.workspace_entitlements (
  workspace_id uuid primary key
    references public.workspaces(id) on delete cascade,
  billing_plan_id uuid not null
    references public.billing_plans(id) on delete restrict,
  source text not null default 'free',
  status text not null default 'active',
  stripe_subscription_id text unique,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workspace_entitlements_source_allowed
    check (source in ('free', 'stripe_subscription', 'manual')),
  constraint workspace_entitlements_status_allowed
    check (status in ('active', 'grace', 'suspended')),
  constraint workspace_entitlements_period_consistent
    check (
      (current_period_start is null and current_period_end is null)
      or (current_period_start is not null and current_period_end is not null)
    )
);

create index workspace_entitlements_billing_plan_id_idx
  on public.workspace_entitlements(billing_plan_id);

create index workspace_entitlements_status_idx
  on public.workspace_entitlements(status);

alter table public.billing_catalog
  add column billing_plan_id uuid
    references public.billing_plans(id) on delete restrict;

update public.billing_catalog
set billing_plan_id = billing_plans.id
from public.billing_plans
where public.billing_catalog.code = 'pro_monthly'
  and billing_plans.code = 'pro'
  and billing_plans.version = 1;

alter table public.billing_catalog
  add constraint billing_catalog_subscription_plan_required
    check (type <> 'subscription' or billing_plan_id is not null);

create table public.workspace_subscription_checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  idempotency_key text not null,
  stripe_checkout_session_id text unique,
  checkout_url text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_subscription_checkout_attempts_unique unique (workspace_id, idempotency_key),
  constraint workspace_subscription_checkout_attempts_status_allowed
    check (status in ('pending', 'open', 'completed', 'expired', 'failed'))
);

-- Usage is owned by a workspace and a concrete billing period. A Free workspace
-- uses a calendar-month period; a subscription uses its Stripe billing period.
-- We keep the aggregate row small and append the execution-level reservation
-- only when an accepted event has actually created an execution.
create table public.workspace_usage_periods (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  executions_reserved integer not null default 0,
  active_executions integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workspace_usage_periods_workspace_period_unique
    unique (workspace_id, period_start),
  constraint workspace_usage_periods_period_valid
    check (period_end > period_start),
  constraint workspace_usage_periods_counts_non_negative
    check (executions_reserved >= 0 and active_executions >= 0)
);

create index workspace_usage_periods_workspace_period_end_idx
  on public.workspace_usage_periods(workspace_id, period_end desc);

create table public.workspace_execution_usage_reservations (
  execution_id uuid primary key references public.executions(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  usage_period_id uuid not null references public.workspace_usage_periods(id) on delete restrict,
  status text not null default 'reserved',
  reserved_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,

  constraint workspace_execution_usage_reservations_status_allowed
    check (status in ('reserved', 'running', 'completed', 'released')),
  constraint workspace_execution_usage_reservations_completed_at_consistent
    check (
      (status in ('reserved', 'running') and completed_at is null)
      or (status in ('completed', 'released') and completed_at is not null)
    )
);

create index workspace_execution_usage_reservations_workspace_status_idx
  on public.workspace_execution_usage_reservations(workspace_id, status);

-- Every function first locks the entitlement row. That makes concurrent requests
-- for one workspace serialize, so two requests cannot both pass the final slot.
create or replace function public.reserve_workspace_execution_quota(
  p_workspace_id uuid,
  p_execution_id uuid
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
  v_grace_ends_at timestamptz;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_max_executions integer;
  v_usage_period_id uuid;
begin
  select
    entitlements.status,
    entitlements.grace_ends_at,
    coalesce(entitlements.current_period_start, date_trunc('month', now() at time zone 'UTC') at time zone 'UTC'),
    coalesce(entitlements.current_period_end, (date_trunc('month', now() at time zone 'UTC') + interval '1 month') at time zone 'UTC'),
    plans.max_executions_per_period
  into
    v_status,
    v_grace_ends_at,
    v_period_start,
    v_period_end,
    v_max_executions
  from public.workspace_entitlements entitlements
  join public.billing_plans plans on plans.id = entitlements.billing_plan_id
  where entitlements.workspace_id = p_workspace_id
  for update of entitlements;

  if not found then
    return 'entitlement_missing';
  end if;

  if v_status <> 'active'
     and (v_status <> 'grace' or v_grace_ends_at is null or v_grace_ends_at <= now()) then
    return 'entitlement_inactive';
  end if;

  insert into public.workspace_usage_periods (workspace_id, period_start, period_end)
  values (p_workspace_id, v_period_start, v_period_end)
  on conflict (workspace_id, period_start)
  do update set updated_at = now()
  returning id into v_usage_period_id;

  update public.workspace_usage_periods
  set executions_reserved = executions_reserved + 1,
      updated_at = now()
  where id = v_usage_period_id
    and executions_reserved < v_max_executions;

  if not found then
    return 'execution_limit_exceeded';
  end if;

  insert into public.workspace_execution_usage_reservations (
    execution_id,
    workspace_id,
    usage_period_id
  )
  values (p_execution_id, p_workspace_id, v_usage_period_id);

  return 'reserved';
end;
$$;

create or replace function public.workspace_can_publish_workflow(
  p_workspace_id uuid,
  p_workflow_id uuid
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
  v_grace_ends_at timestamptz;
  v_max_workflows integer;
  v_published_workflow_count integer;
begin
  select entitlements.status, entitlements.grace_ends_at, plans.max_published_workflows
  into v_status, v_grace_ends_at, v_max_workflows
  from public.workspace_entitlements entitlements
  join public.billing_plans plans on plans.id = entitlements.billing_plan_id
  where entitlements.workspace_id = p_workspace_id
  for update of entitlements;

  if not found then return 'entitlement_missing'; end if;
  if v_status <> 'active'
     and (v_status <> 'grace' or v_grace_ends_at is null or v_grace_ends_at <= now()) then
    return 'entitlement_inactive';
  end if;

  select count(distinct workflows.id)
  into v_published_workflow_count
  from public.workflows workflows
  join public.workflow_versions versions on versions.workflow_id = workflows.id
  where workflows.workspace_id = p_workspace_id
    and workflows.status = 'active'
    and versions.state = 'published'
    and workflows.id <> p_workflow_id;

  if v_published_workflow_count >= v_max_workflows then
    return 'published_workflow_limit_exceeded';
  end if;

  return 'allowed';
end;
$$;

create or replace function public.workspace_can_activate_integration(
  p_workspace_id uuid,
  p_provider text,
  p_provider_account_id text
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
  v_grace_ends_at timestamptz;
  v_max_integrations integer;
  v_active_integration_count integer;
begin
  select entitlements.status, entitlements.grace_ends_at, plans.max_integrations
  into v_status, v_grace_ends_at, v_max_integrations
  from public.workspace_entitlements entitlements
  join public.billing_plans plans on plans.id = entitlements.billing_plan_id
  where entitlements.workspace_id = p_workspace_id
  for update of entitlements;

  if not found then return 'entitlement_missing'; end if;
  if v_status <> 'active'
     and (v_status <> 'grace' or v_grace_ends_at is null or v_grace_ends_at <= now()) then
    return 'entitlement_inactive';
  end if;

  if exists (
    select 1
    from public.integration_connections connections
    where connections.workspace_id = p_workspace_id
      and connections.provider = p_provider
      and connections.provider_account_id = p_provider_account_id
      and connections.status = 'active'
  ) then
    return 'allowed';
  end if;

  select count(*) into v_active_integration_count
  from public.integration_connections connections
  where connections.workspace_id = p_workspace_id
    and connections.status = 'active';

  if v_active_integration_count >= v_max_integrations then
    return 'integration_limit_exceeded';
  end if;

  return 'allowed';
end;
$$;

create or replace function public.try_acquire_workspace_execution_slot(
  p_execution_id uuid
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_reservation_status text;
  v_usage_period_id uuid;
  v_max_concurrent integer;
begin
  select reservations.status, reservations.usage_period_id, plans.max_concurrent_executions
  into v_reservation_status, v_usage_period_id, v_max_concurrent
  from public.workspace_execution_usage_reservations reservations
  join public.workspace_entitlements entitlements on entitlements.workspace_id = reservations.workspace_id
  join public.billing_plans plans on plans.id = entitlements.billing_plan_id
  where reservations.execution_id = p_execution_id
  for update of reservations, entitlements;

  if not found then return 'reservation_missing'; end if;
  if v_reservation_status = 'running' then return 'acquired'; end if;
  if v_reservation_status <> 'reserved' then return 'not_runnable'; end if;

  update public.workspace_usage_periods
  set active_executions = active_executions + 1, updated_at = now()
  where id = v_usage_period_id and active_executions < v_max_concurrent;
  if not found then return 'concurrency_limit_reached'; end if;

  update public.workspace_execution_usage_reservations
  set status = 'running', started_at = now()
  where execution_id = p_execution_id;
  return 'acquired';
end;
$$;

create or replace function public.release_workspace_execution_slot(p_execution_id uuid, p_terminal boolean default true)
returns void
language plpgsql
set search_path = ''
as $$
declare v_usage_period_id uuid;
begin
  select usage_period_id into v_usage_period_id
  from public.workspace_execution_usage_reservations
  where execution_id = p_execution_id and status = 'running'
  for update;
  if not found then return; end if;

  update public.workspace_execution_usage_reservations
  set status = case when p_terminal then 'completed' else 'reserved' end,
      completed_at = case when p_terminal then now() else null end,
      started_at = case when p_terminal then started_at else null end
  where execution_id = p_execution_id and status = 'running';
  update public.workspace_usage_periods
  set active_executions = greatest(active_executions - 1, 0), updated_at = now()
  where id = v_usage_period_id;
end;
$$;

create table public.scheduled_task_locks (
  task_name text primary key,
  locked_until timestamptz not null,
  updated_at timestamptz not null default now()
);

create or replace function public.try_acquire_scheduled_task_lock(
  p_task_name text,
  p_lease_seconds integer
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare v_acquired boolean;
begin
  insert into public.scheduled_task_locks (task_name, locked_until, updated_at)
  values (p_task_name, now() + make_interval(secs => p_lease_seconds), now())
  on conflict (task_name) do update
  set locked_until = excluded.locked_until,
      updated_at = excluded.updated_at
  where public.scheduled_task_locks.locked_until < now()
  returning true into v_acquired;

  return coalesce(v_acquired, false);
end;
$$;

insert into public.workspace_billing_accounts (
  workspace_id,
  billing_owner_user_id
)
select workspace_members.workspace_id, workspace_members.user_id
from public.workspace_members
where workspace_members.role = 'owner'
on conflict (workspace_id) do nothing;

update public.workspace_billing_accounts
set stripe_customer_id = stripe_customers.stripe_customer_id,
    updated_at = now()
from public.stripe_customers
where stripe_customers.user_id = workspace_billing_accounts.billing_owner_user_id
  and workspace_billing_accounts.stripe_customer_id is null;

insert into public.workspace_entitlements (
  workspace_id,
  billing_plan_id,
  source,
  status
)
select
  workspaces.id,
  billing_plans.id,
  'free',
  'active'
from public.workspaces
cross join public.billing_plans
where billing_plans.code = 'free'
  and billing_plans.version = 1
on conflict (workspace_id) do nothing;

create or replace function public.create_workspace_billing_records()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  free_plan_id uuid;
begin
  if new.role <> 'owner' then
    return new;
  end if;

  select id into free_plan_id
  from public.billing_plans
  where code = 'free'
    and version = 1
    and active = true;

  if free_plan_id is null then
    raise exception 'Active Free billing plan is missing';
  end if;

  insert into public.workspace_billing_accounts (
    workspace_id,
    billing_owner_user_id
  )
  values (new.workspace_id, new.user_id)
  on conflict (workspace_id) do nothing;

  insert into public.workspace_entitlements (
    workspace_id,
    billing_plan_id,
    source,
    status
  )
  values (new.workspace_id, free_plan_id, 'free', 'active')
  on conflict (workspace_id) do nothing;

  return new;
end;
$$;

create trigger workspace_members_create_billing_records
after insert on public.workspace_members
for each row
execute function public.create_workspace_billing_records();

alter table public.billing_plans enable row level security;
alter table public.workspace_billing_accounts enable row level security;
alter table public.workspace_entitlements enable row level security;
alter table public.workspace_usage_periods enable row level security;
alter table public.workspace_execution_usage_reservations enable row level security;

create policy "Workspace members can read workspace billing accounts"
on public.workspace_billing_accounts
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members
    where workspace_members.workspace_id = workspace_billing_accounts.workspace_id
      and workspace_members.user_id = (select auth.uid())
  )
);

create policy "Workspace members can read workspace entitlements"
on public.workspace_entitlements
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members
    where workspace_members.workspace_id = workspace_entitlements.workspace_id
      and workspace_members.user_id = (select auth.uid())
  )
);

create policy "Workspace members can read workspace usage periods"
on public.workspace_usage_periods
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members
    where workspace_members.workspace_id = workspace_usage_periods.workspace_id
      and workspace_members.user_id = (select auth.uid())
  )
);
