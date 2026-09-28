import { createFileRoute, redirect } from "@tanstack/react-router";

// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  beforeLoad: () => { throw redirect({ to: "/auth" }); },
  head: () => ({ meta: [
    { title: "Forge Fitness Pal" },
    { name: "description", content: "Secure gym management for Forge Fitness members, coaches, and administrators." },
    { property: "og:title", content: "Forge Fitness" },
    { property: "og:description", content: "Train hard. Run smarter." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  return null;
}
