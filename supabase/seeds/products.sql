insert into public.billing_catalog (
  code,
  stripe_product_id,
  stripe_price_id,
  type,
  credits_amount,
  active
)
values (
  'credits_pack_100',
  'prod_UssU9Co1vJ2buj',
  'price_1Tt6jyPryFIic72BKb5mNklZ',
  'one_time',
  100,
  true
),
(
  'pro_monthly',
  'prod_Uu6M6HK355QI7w',
  'price_1TuI9fPryFIic72B57f3gd6J',
  'subscription',
  null,
  true
)
on conflict (code) do update set
  stripe_product_id = excluded.stripe_product_id,
  stripe_price_id = excluded.stripe_price_id,
  type = excluded.type,
  credits_amount = excluded.credits_amount,
  active = excluded.active,
  updated_at = now();