create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  status text not null default 'active',
  created_by uuid not null
    references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workflows_status_allowed
    check (status in ('active', 'archived'))
);

create unique index workflows_workspace_slug_unique
  on public.workflows(workspace_id, slug);

create index workflows_workspace_id_idx
  on public.workflows(workspace_id);

create table public.workflow_versions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null
    references public.workflows(id) on delete cascade,
  version_number integer not null,
  state text not null default 'draft',
  definition jsonb not null,
  validation_errors jsonb,
  created_by uuid not null
    references public.profiles(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workflow_versions_version_number_positive
    check (version_number > 0),
  constraint workflow_versions_state_allowed
    check (state in ('draft', 'published')),
  constraint workflow_versions_published_at_matches_state
    check (
      (state = 'draft' and published_at is null)
      or (state = 'published' and published_at is not null)
    ),
  constraint workflow_versions_workflow_version_unique
    unique (workflow_id, version_number)
);

create index workflow_versions_workflow_id_idx
  on public.workflow_versions(workflow_id);

create unique index workflow_versions_one_draft_per_workflow
  on public.workflow_versions(workflow_id)
  where state = 'draft';

create table public.workflow_audit_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  workflow_id uuid not null
    references public.workflows(id) on delete cascade,
  actor_id uuid not null
    references public.profiles(id) on delete restrict,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint workflow_audit_records_event_type_allowed
    check (event_type in (
      'workflow_created',
      'draft_updated',
      'workflow_published',
      'workflow_archived'
    ))
);

create index workflow_audit_records_workflow_created_at_idx
  on public.workflow_audit_records(workflow_id, created_at desc);

create index workflow_audit_records_workspace_created_at_idx
  on public.workflow_audit_records(workspace_id, created_at desc);

alter table public.workflows enable row level security;
alter table public.workflow_versions enable row level security;
alter table public.workflow_audit_records enable row level security;

create policy "Workspace members can read workflows"
  on public.workflows
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members
      where workspace_members.workspace_id = workflows.workspace_id
        and workspace_members.user_id = (select auth.uid())
    )
  );

create policy "Workspace members can read workflow versions"
  on public.workflow_versions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workflows
      join public.workspace_members
        on workspace_members.workspace_id = workflows.workspace_id
      where workflows.id = workflow_versions.workflow_id
        and workspace_members.user_id = (select auth.uid())
    )
  );
