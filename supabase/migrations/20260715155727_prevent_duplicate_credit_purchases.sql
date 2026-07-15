create unique index credit_transactions_purchase_payment_unique
  on public.credit_transactions(payment_id)
  where type = 'purchase'
    and payment_id is not null;