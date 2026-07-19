insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  false,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.profile_avatars (
  user_id uuid primary key
    references public.profiles(id)
    on delete cascade,

  bucket_id text not null default 'avatars',

  object_path text not null unique,

  mime_type text not null,

  size_bytes bigint not null,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint profile_avatars_bucket_allowed
    check (bucket_id = 'avatars'),

  constraint profile_avatars_mime_type_allowed
    check (
      mime_type in (
        'image/jpeg',
        'image/png',
        'image/webp'
      )
    ),

  constraint profile_avatars_size_allowed
    check (
      size_bytes > 0
      and size_bytes <= 5242880
    ),

  constraint profile_avatars_path_owned
    check (
      object_path like user_id::text || '/%'
    )
);

alter table public.profile_avatars
enable row level security;

revoke all
  on public.profile_avatars
  from anon;

grant select, insert, update, delete
  on public.profile_avatars
  to authenticated;

create policy "profile_avatars_select_own"
on public.profile_avatars
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "profile_avatars_insert_own"
on public.profile_avatars
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "profile_avatars_update_own"
on public.profile_avatars
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "profile_avatars_delete_own"
on public.profile_avatars
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "profile_avatars_select_admin"
on public.profile_avatars
for select
to authenticated
using ((select public.is_admin()));

create policy "avatar_objects_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "avatar_objects_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "avatar_objects_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "avatar_objects_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "avatar_objects_select_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and (select public.is_admin())
);