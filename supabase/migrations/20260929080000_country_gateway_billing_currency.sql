ALTER TABLE public.gym_settings
  ADD COLUMN country_code text NOT NULL DEFAULT 'IN',
  ADD COLUMN payment_gateway text NOT NULL DEFAULT 'razorpay';

ALTER TABLE public.gym_settings
  ADD CONSTRAINT gym_settings_country_code_check
    CHECK (country_code IN ('IN','US','GB','CA','AU','SG','AE','NZ','JP','DE','FR','IE')),
  ADD CONSTRAINT gym_settings_currency_check
    CHECK (currency IN ('INR','USD','EUR','GBP','AED','CAD','AUD','SGD','NZD','JPY')),
  ADD CONSTRAINT gym_settings_payment_gateway_check
    CHECK (payment_gateway IN ('razorpay','stripe')),
  ADD CONSTRAINT gym_settings_razorpay_region_check
    CHECK (payment_gateway <> 'razorpay' OR (country_code = 'IN' AND currency = 'INR'));

ALTER TABLE public.membership_plans RENAME COLUMN price_inr TO price_amount;
ALTER TABLE public.membership_plans RENAME COLUMN joining_fee_inr TO joining_fee_amount;

ALTER TABLE public.payments RENAME COLUMN amount_inr TO amount;
ALTER TABLE public.payments RENAME COLUMN base_amount_inr TO base_amount;
ALTER TABLE public.payments RENAME COLUMN discount_inr TO discount_amount;
ALTER TABLE public.payments RENAME COLUMN refund_amount_inr TO refund_amount;
ALTER TABLE public.payments ADD COLUMN currency text NOT NULL DEFAULT 'INR'
  CHECK (currency IN ('INR','USD','EUR','GBP','AED','CAD','AUD','SGD','NZD','JPY'));

ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'stripe';

CREATE OR REPLACE FUNCTION public.complete_membership_payment(
  p_payment_id uuid,
  p_provider_payment_id text,
  p_currency text,
  p_amount_minor bigint
)
RETURNS TABLE(new_membership_id uuid, completed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payment_row public.payments%ROWTYPE;
  scale_factor numeric;
  plan_days integer;
  today_date date := current_date;
  membership_start date;
  membership_end date;
  created_membership_id uuid;
BEGIN
  SELECT * INTO payment_row FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment record not found'; END IF;

  scale_factor := CASE upper(p_currency) WHEN 'JPY' THEN 1 ELSE 100 END;
  IF payment_row.currency <> upper(p_currency)
     OR round(payment_row.amount * scale_factor) <> p_amount_minor THEN
    RAISE EXCEPTION 'Gateway amount or currency does not match the payment record';
  END IF;

  IF payment_row.status = 'verified' THEN
    IF payment_row.provider_payment_id IS DISTINCT FROM p_provider_payment_id THEN
      RAISE EXCEPTION 'Payment was already completed with a different provider reference';
    END IF;
    RETURN QUERY SELECT payment_row.membership_id, false;
    RETURN;
  END IF;
  IF payment_row.status <> 'created' THEN RAISE EXCEPTION 'Payment is not awaiting confirmation'; END IF;

  SELECT duration_days INTO plan_days FROM public.membership_plans WHERE id = payment_row.plan_id;
  IF plan_days IS NULL THEN RAISE EXCEPTION 'Membership plan not found'; END IF;
  SELECT ends_on INTO membership_end FROM public.memberships
    WHERE member_id = payment_row.member_id AND status IN ('active','pending')
    ORDER BY ends_on DESC LIMIT 1;
  membership_start := CASE WHEN membership_end IS NOT NULL AND membership_end >= today_date
    THEN membership_end + 1 ELSE today_date END;
  membership_end := membership_start + plan_days - 1;

  INSERT INTO public.memberships(member_id, plan_id, status, starts_on, ends_on)
    VALUES (payment_row.member_id, payment_row.plan_id,
      CASE WHEN membership_start > today_date THEN 'pending'::public.membership_status ELSE 'active'::public.membership_status END,
      membership_start, membership_end)
    RETURNING id INTO created_membership_id;

  UPDATE public.payments SET status = 'verified', provider_payment_id = p_provider_payment_id,
    membership_id = created_membership_id, verified_at = now(), paid_at = now()
    WHERE id = p_payment_id;
  UPDATE public.members SET status = 'active' WHERE id = payment_row.member_id;

  RETURN QUERY SELECT created_membership_id, true;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_membership_payment(uuid, text, text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_membership_payment(uuid, text, text, bigint) TO service_role;
