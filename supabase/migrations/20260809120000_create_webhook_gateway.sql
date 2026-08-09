create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  workflow_id uuid not null
    references public.workflows(id) on delete cascade,
  name text not null,
  public_id text not null,
  status text not null default 'active',
  signature_mode text not null default 'none',
  signing_secret_ciphertext text,
  secret_last_rotated_at timestamptz,
  created_by uuid not null
    references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint webhook_endpoints_status_allowed
    check (status in ('active', 'inactive')),
  constraint webhook_endpoints_name_not_blank
    check (length(trim(name)) > 0),
  constraint webhook_endpoints_signature_mode_allowed
    check (signature_mode in ('none', 'hmac_sha256')),
  constraint webhook_endpoints_secret_matches_signature_mode
    check (
      (signature_mode = 'none' and signing_secret_ciphertext is null)
      or (
        signature_mode = 'hmac_sha256'
        and signing_secret_ciphertext is not null
      )
    )
);

create unique index webhook_endpoints_public_id_unique
  on public.webhook_endpoints(public_id);

create index webhook_endpoints_workspace_id_idx
  on public.webhook_endpoints(workspace_id);

create index webhook_endpoints_workflow_id_idx
  on public.webhook_endpoints(workflow_id);

create unique index webhook_endpoints_workflow_name_unique
  on public.webhook_endpoints(workflow_id, name);

create table public.incoming_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  webhook_endpoint_id uuid not null
    references public.webhook_endpoints(id) on delete restrict,
  workflow_id uuid not null
    references public.workflows(id) on delete restrict,
  workflow_version_id uuid not null
    references public.workflow_versions(id) on delete restrict,
  source_event_id text,
  content_type text not null,
  payload jsonb not null,
  payload_sha256 text not null,
  payload_size_bytes integer not null,
  status text not null default 'accepted',
  received_at timestamptz not null default now(),

  constraint incoming_events_payload_size_positive
    check (payload_size_bytes > 0),
  constraint incoming_events_status_allowed
    check (status in ('accepted'))
);

create unique index incoming_events_endpoint_source_event_unique
  on public.incoming_events(webhook_endpoint_id, source_event_id)
  where source_event_id is not null;

create index incoming_events_workspace_received_at_idx
  on public.incoming_events(workspace_id, received_at desc);

create index incoming_events_endpoint_received_at_idx
  on public.incoming_events(webhook_endpoint_id, received_at desc);

create index incoming_events_workflow_version_id_idx
  on public.incoming_events(workflow_version_id);

create table public.executions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  workflow_id uuid not null
    references public.workflows(id) on delete restrict,
  workflow_version_id uuid not null
    references public.workflow_versions(id) on delete restrict,
  incoming_event_id uuid not null
    references public.incoming_events(id) on delete restrict,
  status text not null default 'pending',
  queued_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  failure jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint executions_status_allowed
    check (status in (
      'pending',
      'queued',
      'running',
      'succeeded',
      'failed',
      'cancelled'
    ))
);

create unique index executions_incoming_event_id_unique
  on public.executions(incoming_event_id);

create index executions_workspace_created_at_idx
  on public.executions(workspace_id, created_at desc);

create index executions_workflow_status_created_at_idx
  on public.executions(workflow_id, status, created_at desc);

-- Webhook endpoint secrets and raw external payloads must never be readable
-- directly through the Supabase client API. Nest applies workspace authorization
-- and future payload redaction before returning any endpoint/event data.
alter table public.webhook_endpoints enable row level security;
alter table public.incoming_events enable row level security;
alter table public.executions enable row level security;
