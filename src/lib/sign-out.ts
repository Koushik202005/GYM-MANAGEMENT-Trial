import { supabase } from "@/integrations/supabase/client";

export async function signOut() {
  await supabase.auth.signOut();
  window.location.replace("/auth");
}
