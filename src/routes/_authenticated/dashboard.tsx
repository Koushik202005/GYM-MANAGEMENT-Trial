import { createFileRoute, redirect } from "@tanstack/react-router";
import { Dashboard } from "@/components/dashboard";
import { MemberDashboard } from "@/components/member-dashboard";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "Dashboard | Forge Fitness Pal" },
    { name: "description", content: "Manage members, classes, workouts, payments, and gym access at Forge Fitness." },
    { property: "og:title", content: "Forge Fitness Dashboard" },
    { property: "og:description", content: "Secure gym operations for members, coaches, and administrators." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ]}),
  loader: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("profiles").select("*").eq("id", user.id).single(),
    ]);
    if (!profile?.onboarding_completed) throw redirect({ to: "/onboarding" });
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    return { isAdmin, profile };
  },
  errorComponent: ({ error }) => <p className="p-8 text-sm text-destructive">{error.message}</p>,
  notFoundComponent: () => <p className="p-8">Not found</p>,
  component: DashboardPage,
});

function DashboardPage() {
  const { isAdmin, profile } = Route.useLoaderData();
  return isAdmin ? <Dashboard name={profile.display_name} /> : <MemberDashboard profile={profile} />;
}
