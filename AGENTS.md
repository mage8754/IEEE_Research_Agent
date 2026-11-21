<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- All AI calls live in `src/lib/ai/research.functions.ts` server functions (auth-protected, Lovable AI gateway via `gateway.server.ts`); the browser never calls models or holds keys. Why: keeps prompts, keys and activity logging server-side.
- Every AI rewrite goes through `src/lib/engines/latex.ts` (mask → rewrite → restore) and is rejected if any placeholder is lost or duplicated. Why: LaTeX syntax must never be modified.
- AI findings carry verbatim quotes that are checked against the source text (`quoteAppearsIn`) and labelled verified/unverified. Why: the app must never present fabricated results as facts.
- Citation consistency checks are deterministic and local (`src/lib/engines/citations.ts`), never AI. Why: results must be reproducible and never imply external verification.
- Each completed analysis is stored as a row in `research_activity`; dashboard stats and history derive from it. Why: one source of truth per user.
- Auth is client-side (session in browser); workspace pages live under the `_workspace` pathless layout, which redirects signed-out users to /login. Why: SSR has no session.
