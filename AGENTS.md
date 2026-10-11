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

# Architecture rules

- App data lives in Lovable Cloud; src/lib/store.ts keeps an in-memory copy, updates it optimistically, then calls a `sk_*` database function and reloads via `sk_get_state` — the database is the source of truth.
- All writes go through `sk_*` security-definer functions (tables are read-only to clients) so stock checks and status transitions run atomically in one transaction.
- Inventory deductions are guarded by atomic status updates plus a unique index on movements (ref_type, ref_id, product_id) — prevents double deductions from repeated clicks or tabs.
- Demo data is rebuilt by `sk_reset_demo()`, which replays operations through the same business functions.
