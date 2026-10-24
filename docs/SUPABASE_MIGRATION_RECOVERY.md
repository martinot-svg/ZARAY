# Supabase migration history recovery (2026-10-24)

## Purpose and safety

Ten migration versions are recorded by the production Supabase database but their SQL files were absent from `main`. This branch restores those ten paths so the repository can represent the production migration history.

**No production DDL was executed by this recovery, no migration was replayed, and no data was reset or changed.** Do not run `supabase db reset` against the production project. The restored files are kept on a separate branch pending execution-level replay validation in a disposable local database.

## Recovery provenance

| Version / file | Recovery method | Confidence |
| --- | --- | --- |
| `20261023071455_restrict_rls_auto_enable_execution.sql` | Rebuilt from the live `public.rls_auto_enable()` definition and enabled `ensure_rls` event trigger. | Reconstructed, not original bytes |
| `20261023071921_zaray_supabase_module1.sql` | Rebuilt foundational tenant-table DDL, RLS and read policies from live table metadata. The later owner column and write policies remain in the next migration. | Reconstructed, not original bytes |
| `20261023072010_zaray_rls_first_mutations.sql` | SQL hunk recovered from GitHub commit [eb46fa1](https://github.com/martinot-svg/ZARAY/commit/eb46fa1f4ce0d2b8bdc01fa84392a80483a74051). | Source-backed |
| `20261023072246_zaray_column_level_write_grants.sql` | SQL recovered from GitHub commit [04bd6e8](https://github.com/martinot-svg/ZARAY/commit/04bd6e827f301fba1df5ab38effbac5806fcc279). | Source-backed |
| `20261024080903_company_members_rbac_audit.sql` | SQL hunk recovered from GitHub commit [a69adfb](https://github.com/martinot-svg/ZARAY/commit/a69adfb89ce6a19b2f730839c8e4c36f0cff2d57). | Source-backed |
| `20261024081141_restrict_audit_log_reads.sql` | Rebuilt from the live audit-log SELECT policy and table grants. | Reconstructed, not original bytes |
| `20261024081502_deny_direct_invitation_access.sql` | Rebuilt from the live invitation table policy and table grants. | Reconstructed, not original bytes |
| `20261024082344_customers_offers.sql` | SQL hunk recovered from GitHub commit [a0c16d9](https://github.com/martinot-svg/ZARAY/commit/a0c16d97ebc510b49cc4f246ae664cf8e7d3742c). | Source-backed |
| `20261024085231_captive_portal_wifi_tickets.sql` | SQL hunk recovered from GitHub commit [28bb613](https://github.com/martinot-svg/ZARAY/commit/28bb61343da060bb62b3261ee4e2b7e5eeaf6335). | Source-backed |
| `20261024090326_payment_ledger_webhook.sql` | SQL hunk recovered from GitHub commit [eded502](https://github.com/martinot-svg/ZARAY/commit/eded502f86af974e90bd6385dbf5b1c82e2d5c18). | Source-backed |

The four reconstructed files are explicitly identified in their headers/comments. They should not be represented as byte-for-byte copies of the original SQL.

## Production inventory comparison

Read-only queries against production Supabase and static inventory extraction from all 19 migration files produced these results:

- Migration history: **19 versions in Supabase; 19 corresponding files on this branch**; all ten recovered filenames match their recorded versions and names.
- Public tables: **14 expected / 14 present**.
- RLS: **14 of 14 public tables have RLS enabled**.
- Public function names: **23 expected / 23 present**.
- Policy names: **18 expected / 18 present**.
- Explicitly named indexes created by the migrations: **40 expected; all 40 are present**. Production additionally has primary-key and unique indexes, which are not all included in that explicit-index count.
- The `ensure_rls` event trigger exists and is enabled.
- Sensitive-table privilege check: no direct `anon` or `authenticated` grants were found on `company_invitations`, `manual_payment_methods`, `manual_payment_submissions`, `manual_payment_reviewers`, or `payment_events`. The expected `SELECT` grants remain on `payments` and `subscription_orders`; both tables have RLS and tenant-scoped SELECT policies.

This is an **object-inventory comparison**, not yet a byte-for-byte schema diff and not proof that every reconstructed statement executes cleanly from an empty database.

## Required final validation before merging

1. Replay the complete migration sequence against a disposable local Supabase/Postgres database only.
2. Compare the resulting schema (columns, defaults, constraints, indexes, RLS, policies, triggers, function signatures and grants) with a read-only production schema snapshot.
3. Resolve every difference before merging this branch or treating the repository as a clean-room rebuild source.

Until those steps pass, keep this branch isolated and do not apply the recovered migrations to production. The production migration history already records these versions.
