alter table public.payments
add column checkout_idempotency_key text;

create unique index payments_checkout_idempotency_key_unique
on public.payments(user_id, checkout_idempotency_key)
where checkout_idempotency_key is not null;