ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_illness boolean,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','flat')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  plan_id uuid REFERENCES public.membership_plans(id) ON DELETE CASCADE,
  valid_from date,
  valid_until date,
  max_redemptions integer,
  redemptions_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY coupons_admin_all ON public.coupons FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin')) WITH CHECK (private.has_role(auth.uid(),'admin'));
CREATE TRIGGER coupons_updated BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.membership_plans(id),
  ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.coupons(id),
  ADD COLUMN IF NOT EXISTS base_amount_inr numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_inr numeric NOT NULL DEFAULT 0;

CREATE TABLE public.renewal_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  days_before integer NOT NULL,
  channels text[] NOT NULL DEFAULT '{}',
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (membership_id, days_before)
);
GRANT ALL ON public.renewal_reminders TO service_role;
ALTER TABLE public.renewal_reminders ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE is_first boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(424242);
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role='admin') INTO is_first;
  INSERT INTO public.profiles (id,email,display_name,avatar_url)
  VALUES (NEW.id, COALESCE(NEW.email,''), COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email,''),'@',1)), NEW.raw_user_meta_data->>'avatar_url');
  IF is_first THEN
    INSERT INTO public.user_roles(user_id,role) VALUES (NEW.id,'admin');
  ELSE
    INSERT INTO public.user_roles(user_id,role) VALUES (NEW.id,'member');
    INSERT INTO public.members(profile_id, member_code, status, joined_on)
    VALUES (NEW.id, 'FRG-' || upper(substr(replace(NEW.id::text,'-',''),1,8)), 'lead', current_date);
  END IF;
  RETURN NEW;
END; $$;