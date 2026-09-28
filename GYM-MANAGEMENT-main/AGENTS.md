<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project architecture

- Use Lovable Cloud with RLS-protected PostgreSQL records and TanStack server functions because gym data and permissions must be durable and server-enforced.
- Keep authorization roles exclusively in `user_roles`; profile records contain identity and gym details only to prevent privilege escalation.
- Use `/auth` as the public account entry and keep operational panels under the integration-managed `_authenticated` route boundary.
- Treat the uploaded theme screenshot as visual reference only; never ship it as an application asset.
