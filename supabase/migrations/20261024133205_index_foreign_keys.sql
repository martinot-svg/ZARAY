-- Add non-destructive indexes for foreign-key columns flagged by Supabase performance advisors.
-- Existing data and constraints are unchanged.
create index if not exists audit_logs_actor_user_id_idx on public.audit_logs(actor_user_id);
create index if not exists companies_owner_user_id_idx on public.companies(owner_user_id);
create index if not exists company_invitations_invited_by_idx on public.company_invitations(invited_by);
create index if not exists customers_created_by_idx on public.customers(created_by);
create index if not exists customers_site_id_idx on public.customers(site_id);
create index if not exists manual_payment_methods_created_by_idx on public.manual_payment_methods(created_by);
create index if not exists manual_payment_methods_updated_by_idx on public.manual_payment_methods(updated_by);
create index if not exists manual_payment_reviewers_granted_by_idx on public.manual_payment_reviewers(granted_by);
create index if not exists manual_payment_reviewers_revoked_by_idx on public.manual_payment_reviewers(revoked_by);
create index if not exists manual_payment_reviewers_user_id_idx on public.manual_payment_reviewers(user_id);
create index if not exists manual_payment_submissions_reviewer_user_id_idx on public.manual_payment_submissions(reviewer_user_id);
create index if not exists offers_created_by_idx on public.offers(created_by);
create index if not exists payment_events_payment_id_idx on public.payment_events(payment_id);
create index if not exists subscription_orders_offer_id_idx on public.subscription_orders(offer_id);
create index if not exists subscription_orders_site_id_idx on public.subscription_orders(site_id);
create index if not exists wifi_tickets_created_by_idx on public.wifi_tickets(created_by);
