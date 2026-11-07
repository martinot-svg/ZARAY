-- ZARAY FiveOne Pay: opt-in hybrid multi-site settlement, disabled until merchant credentials are configured.
-- All newly introduced tables are service-only; secrets and attempts never enter the browser Data API.
create table public.fiveonepay_merchants (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 site_id uuid,
 label text not null default 'Compte FiveOne Pay',
 environment text not null default 'sandbox' check (environment in ('sandbox','production')),
 api_key_ciphertext text not null,
 webhook_secret_ciphertext text not null,
 enabled boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key (site_id,company_id) references public.sites(id,company_id) on delete cascade
);
create unique index fiveonepay_company_merchant on public.fiveonepay_merchants(company_id,environment) where site_id is null;
create unique index fiveonepay_site_merchant on public.fiveonepay_merchants(site_id,environment) where site_id is not null;

create table public.fiveonepay_site_routing (
 site_id uuid primary key,
 company_id uuid not null,
 mode text not null default 'shared' check (mode in ('shared','dedicated')),
 updated_at timestamptz not null default now(),
 foreign key (site_id,company_id) references public.sites(id,company_id) on delete cascade
);
create table public.fiveonepay_site_codes (
 site_id uuid primary key,
 company_id uuid not null references public.companies(id) on delete cascade,
 code text not null check (code ~ '^[A-Z0-9]{3,6}$'),
 next_number bigint not null default 1 check (next_number>=1),
 foreign key (site_id,company_id) references public.sites(id,company_id) on delete cascade,
 unique (company_id,code)
);
create table public.fiveonepay_attempts (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 site_id uuid not null,
 order_id uuid not null references public.subscription_orders(id) on delete cascade,
 merchant_id uuid not null references public.fiveonepay_merchants(id) on delete cascade,
 internal_reference text not null check (internal_reference ~ '^ABWIFI-[A-Z0-9]{3,6}-[0-9]{6,}$'),
 provider_payment_id text,
 fiveonepay_reference text,
 payment_url text,
 environment text not null check (environment in ('sandbox','production')),
 status text not null default 'prepared' check (status in ('prepared','pending','expired','succeeded','review_required','failed')),
 amount bigint not null check (amount>0),
 currency text not null default 'MGA' check (currency='MGA'),
 commission bigint,
 net_amount bigint,
 payable_amount bigint,
 operator text,
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key (site_id,company_id) references public.sites(id,company_id) on delete cascade,
 unique (company_id,internal_reference)
);
create unique index fiveonepay_provider_payment_unique on public.fiveonepay_attempts(provider_payment_id) where provider_payment_id is not null;
create index fiveonepay_attempt_order_idx on public.fiveonepay_attempts(order_id,created_at desc);
create index fiveonepay_attempt_merchant_idx on public.fiveonepay_attempts(merchant_id,created_at desc);

create table public.fiveonepay_webhook_events(
 id uuid primary key default gen_random_uuid(),
 merchant_id uuid not null references public.fiveonepay_merchants(id) on delete cascade,
 attempt_id uuid not null references public.fiveonepay_attempts(id) on delete cascade,
 provider_event_id text not null,
 event_type text not null,
 payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
 received_at timestamptz not null default now(),
 unique (merchant_id,provider_event_id)
);

alter table public.fiveonepay_merchants enable row level security;
alter table public.fiveonepay_site_routing enable row level security;
alter table public.fiveonepay_site_codes enable row level security;
alter table public.fiveonepay_attempts enable row level security;
alter table public.fiveonepay_webhook_events enable row level security;
revoke all on public.fiveonepay_merchants,public.fiveonepay_site_routing,
 public.fiveonepay_site_codes,public.fiveonepay_attempts,public.fiveonepay_webhook_events
 from public,anon,authenticated;
grant select,insert,update,delete on public.fiveonepay_merchants,public.fiveonepay_site_routing,
 public.fiveonepay_site_codes,public.fiveonepay_attempts,public.fiveonepay_webhook_events to service_role;

-- Reserve a site-unique human reference and an attempt atomically. Retry-safe, so
-- concurrent requests cannot allocate a duplicate reference or initiate a second payment.
create or replace function public.reserve_fiveonepay_attempt(p_order_id uuid,p_merchant_id uuid)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare
 v_order public.subscription_orders%rowtype;
 v_site public.sites%rowtype;
 v_merchant public.fiveonepay_merchants%rowtype;
 v_existing public.fiveonepay_attempts%rowtype;
 v_code public.fiveonepay_site_codes%rowtype;
 v_mode text;
 v_words text[];
 v_base text;
 v_candidate text;
 v_i integer;
 v_ref text;
 v_attempt public.fiveonepay_attempts%rowtype;
begin
 select * into v_order from public.subscription_orders where id=p_order_id for update;
 if v_order.id is null or v_order.site_id is null or v_order.status<>'pending_payment'
    or v_order.paid_at is not null or v_order.currency<>'MGA' or
    v_order.amount<1 or v_order.amount<>trunc(v_order.amount) then
  raise exception 'order_unavailable' using errcode='22023';
 end if;
 select * into v_site from public.sites
  where id=v_order.site_id and company_id=v_order.company_id and status='active';
 if v_site.id is null then raise exception 'site_unavailable' using errcode='22023'; end if;
 select * into v_merchant from public.fiveonepay_merchants
  where id=p_merchant_id and company_id=v_order.company_id and enabled;
 if v_merchant.id is null then raise exception 'merchant_unavailable' using errcode='22023'; end if;
 select coalesce((select mode from public.fiveonepay_site_routing where site_id=v_site.id),'shared') into v_mode;
 if (v_mode='shared' and v_merchant.site_id is not null) or
    (v_mode='dedicated' and v_merchant.site_id is distinct from v_site.id) then
  raise exception 'merchant_site_mismatch' using errcode='22023';
 end if;
 select * into v_existing from public.fiveonepay_attempts
  where order_id=v_order.id and status in ('prepared','pending')
    and expires_at>now()
  order by created_at desc limit 1;
 if v_existing.id is not null then
  return jsonb_build_object('id',v_existing.id,'reference',v_existing.internal_reference,'status',v_existing.status);
 end if;
 select * into v_code from public.fiveonepay_site_codes where site_id=v_site.id for update;
 if v_code.site_id is null then
  v_words=regexp_split_to_array(trim(regexp_replace(v_site.name,'[^[:alnum:] ]',' ','g')),' +');
  if array_length(v_words,1)>=2 then
   v_base=upper(left(v_words[1],1)||left(v_words[2],1)||right(v_words[array_length(v_words,1)],1));
  else
   v_base=upper(left(coalesce(v_words[1],'WIFI')||'WIFI',3));
  end if;
  v_base=regexp_replace(v_base,'[^A-Z0-9]','','g');
  if length(v_base)<3 then v_base=rpad(v_base,3,'X'); end if;
  for v_i in 0..99 loop
   v_candidate=case when v_i=0 then v_base else left(v_base,3)||v_i::text end;
   insert into public.fiveonepay_site_codes(site_id,company_id,code)
   values(v_site.id,v_site.company_id,v_candidate)
   on conflict do nothing;
   select * into v_code from public.fiveonepay_site_codes where site_id=v_site.id for update;
   exit when v_code.site_id is not null;
  end loop;
  if v_code.site_id is null then raise exception 'site_code_exhausted' using errcode='23505'; end if;
 end if;
 v_ref='ABWIFI-'||v_code.code||'-'||lpad(v_code.next_number::text,6,'0');
 update public.fiveonepay_site_codes set next_number=next_number+1 where site_id=v_site.id;
 insert into public.fiveonepay_attempts(company_id,site_id,order_id,merchant_id,
   internal_reference,environment,amount,expires_at)
 values(v_order.company_id,v_site.id,v_order.id,v_merchant.id,v_ref,
  v_merchant.environment,v_order.amount,now()+interval '15 minutes')
 returning * into v_attempt;
 return jsonb_build_object('id',v_attempt.id,'reference',v_attempt.internal_reference,'status','prepared');
end;
$$;
revoke all on function public.reserve_fiveonepay_attempt(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_fiveonepay_attempt(uuid,uuid) to service_role;
