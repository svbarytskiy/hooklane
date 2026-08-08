create table public.workspaces (
  id uuid primary key default gen_random_uuid(),

  name text not null,

  slug text not null,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);

create unique index workspaces_slug_unique
  on public.workspaces(slug);

create table public.workspace_members (
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,

  user_id uuid not null
    references public.profiles(id) on delete cascade,

  role text not null,

  created_at timestamptz not null default now(),

  constraint workspace_members_pkey
    primary key (workspace_id, user_id),

  constraint workspace_members_role_allowed
    check (role in ('owner', 'admin', 'member'))
);

create index workspace_members_user_id_idx
  on public.workspace_members(user_id);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create policy "Workspace members can read their workspaces"
  on public.workspaces
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members
      where workspace_members.workspace_id = workspaces.id
        and workspace_members.user_id = (select auth.uid())
    )
  );

create policy "Users can read their own workspace memberships"
  on public.workspace_members
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
