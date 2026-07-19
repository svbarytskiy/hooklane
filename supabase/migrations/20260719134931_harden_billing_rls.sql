create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all
  on function public.is_admin()
  from public;

grant execute
  on function public.is_admin()
  to authenticated;

drop policy if exists "profiles_update_own"
  on public.profiles;

revoke update
  on public.profiles
  from authenticated;

create policy "profiles_select_admin"
on public.profiles
for select
to authenticated
using ((select public.is_admin()));

create policy "stripe_customers_select_admin"
on public.stripe_customers
for select
to authenticated
using ((select public.is_admin()));

create policy "payments_select_admin"
on public.payments
for select
to authenticated
using ((select public.is_admin()));

create policy "credit_transactions_select_admin"
on public.credit_transactions
for select
to authenticated
using ((select public.is_admin()));

create policy "subscriptions_select_admin"
on public.subscriptions
for select
to authenticated
using ((select public.is_admin()));

create policy "invoices_select_admin"
on public.invoices
for select
to authenticated
using ((select public.is_admin()));

create policy "refunds_select_admin"
on public.refunds
for select
to authenticated
using ((select public.is_admin()));