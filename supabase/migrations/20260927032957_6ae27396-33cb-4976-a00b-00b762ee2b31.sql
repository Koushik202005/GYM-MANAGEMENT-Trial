CREATE OR REPLACE FUNCTION private.guard_profile_verification()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    IF NEW.phone IS DISTINCT FROM OLD.phone THEN
      NEW.phone_verified_at := NULL;
    ELSE
      NEW.phone_verified_at := OLD.phone_verified_at;
    END IF;
    IF NEW.onboarding_completed AND NOT OLD.onboarding_completed THEN
      NEW.onboarding_completed := OLD.onboarding_completed;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER profiles_guard_verification BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.guard_profile_verification();