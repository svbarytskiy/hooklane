create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  provider text not null,
  provider_account_id text not null,
  provider_account_email text,
  provider_account_name text,
  status text not null default 'active',
  scopes text[] not null default '{}',
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  token_key_version integer not null default 1,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  last_refreshed_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null
    references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint integration_connections_provider_allowed
    check (provider in ('slack')),
  constraint integration_connections_status_allowed
    check (status in ('active', 'expired', 'revoked', 'needs_reconnect')),
  constraint integration_connections_token_key_version_positive
    check (token_key_version > 0),
  constraint integration_connections_revoked_at_matches_status
    check (
      (status = 'revoked' and revoked_at is not null)
      or (status <> 'revoked' and revoked_at is null)
    )
);

create unique index integration_connections_workspace_provider_account_unique
  on public.integration_connections (workspace_id, provider, provider_account_id);

create index integration_connections_workspace_created_at_idx
  on public.integration_connections (workspace_id, created_at desc);

create index integration_connections_workspace_provider_status_idx
  on public.integration_connections (workspace_id, provider, status);

create table public.oauth_authorization_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null,
  provider text not null,
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  code_verifier_ciphertext text not null,
  code_verifier_key_version integer not null default 1,
  redirect_uri text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),

  constraint oauth_authorization_states_provider_allowed
    check (provider in ('slack')),
  constraint oauth_authorization_states_code_verifier_key_version_positive
    check (code_verifier_key_version > 0),
  constraint oauth_authorization_states_expires_after_creation
    check (expires_at > created_at)
);

create unique index oauth_authorization_states_state_hash_unique
  on public.oauth_authorization_states (state_hash);

create index oauth_authorization_states_pending_expiry_idx
  on public.oauth_authorization_states (expires_at)
  where consumed_at is null;

alter table public.integration_connections enable row level security;
alter table public.oauth_authorization_states enable row level security;
