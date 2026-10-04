-- Supabase foundation, not an enabled cloud adapter. Run once on a new project.
-- Browser access is read-only until transactional reservation/receipt RPCs and
-- authenticated Next.js sessions are implemented. Never enable demo cookies in cloud mode.
begin;
create schema if not exists private;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 100),
  kind text not null check (kind in ('supplier', 'recipient', 'network')),
  fixture boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.organization_members (
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  member_role text not null check (member_role in ('owner', 'member')),
  primary key (organization_id, user_id)
);
create index organization_members_user on public.organization_members(user_id);

-- Admin-provisioned membership; users cannot join an arbitrary organization.
create function private.my_organization_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select organization_id from public.organization_members
  where user_id = (select auth.uid());
$$;
revoke all on function private.my_organization_ids() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.my_organization_ids() to authenticated;

create table public.recipients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id),
  display_name text not null,
  materials text[] not null,
  demand_state text not null default 'prospect' check (demand_state in ('prospect', 'active', 'demo_active')),
  minimum_kg numeric not null check (minimum_kg >= 0 and minimum_kg <= 100000),
  capacity_kg numeric not null check (capacity_kg >= minimum_kg and capacity_kg <= 100000),
  requirements jsonb not null default '{}'::jsonb check (jsonb_typeof(requirements) = 'object'),
  fixture boolean not null default false
);
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  supplier_org_id uuid not null references public.organizations(id),
  material text not null check (material in ('grounds', 'beans', 'chaff', 'pulp', 'husks')),
  quantity_kg numeric not null check (quantity_kg > 0 and quantity_kg <= 10000),
  collected_at timestamptz not null,
  available_at timestamptz not null,
  expires_at timestamptz not null,
  facts jsonb not null check (jsonb_typeof(facts) = 'object'),
  fixture boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, supplier_org_id),
  check (collected_at <= available_at and available_at < expires_at)
);
create index listings_supplier on public.listings(supplier_org_id);
create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null,
  supplier_org_id uuid not null references public.organizations(id),
  recipient_org_id uuid not null references public.recipients(organization_id),
  agreed_kg numeric not null check (agreed_kg > 0 and agreed_kg <= 10000),
  accepted_kg numeric check (accepted_kg >= 0 and accepted_kg <= agreed_kg),
  reported_use_kg numeric check (reported_use_kg >= 0 and reported_use_kg <= accepted_kg),
  status text not null default 'proposed' check (status in ('proposed', 'booked', 'received', 'completed', 'disputed', 'cancelled')),
  pickup_at timestamptz not null,
  terms jsonb not null check (jsonb_typeof(terms) = 'object'),
  collection jsonb check (collection is null or jsonb_typeof(collection) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (listing_id, supplier_org_id) references public.listings(id, supplier_org_id),
  check (supplier_org_id <> recipient_org_id),
  check (reported_use_kg is null or (status = 'completed' and accepted_kg is not null)),
  check (status not in ('received', 'completed') or accepted_kg is not null)
);
create index transfers_supplier on public.transfers(supplier_org_id);
create index transfers_recipient on public.transfers(recipient_org_id);
create index transfers_listing on public.transfers(listing_id);
create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null,
  supplier_org_id uuid not null,
  model text,
  mode text not null check (mode in ('rules', 'openai')),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  usage jsonb,
  created_at timestamptz not null default now(),
  foreign key (listing_id, supplier_org_id) references public.listings(id, supplier_org_id)
);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.recipients enable row level security;
alter table public.listings enable row level security;
alter table public.transfers enable row level security;
alter table public.ai_generations enable row level security;
revoke all on public.organizations, public.organization_members, public.recipients, public.listings, public.transfers, public.ai_generations from anon, authenticated;
grant select on public.organizations, public.organization_members, public.recipients, public.listings, public.transfers, public.ai_generations to authenticated;

create policy organizations_member_read on public.organizations for select to authenticated
using (id in (select private.my_organization_ids()));
create policy memberships_self_read on public.organization_members for select to authenticated
using (user_id = (select auth.uid()));
create policy recipients_authenticated_read on public.recipients for select to authenticated using (true);
create policy transfers_participant_read on public.transfers for select to authenticated
using (supplier_org_id in (select private.my_organization_ids()) or recipient_org_id in (select private.my_organization_ids()));
create policy listings_participant_read on public.listings for select to authenticated
using (supplier_org_id in (select private.my_organization_ids()) or exists (
  select 1 from public.transfers t where t.listing_id = listings.id
  and t.recipient_org_id in (select private.my_organization_ids())
));
create policy ai_supplier_read on public.ai_generations for select to authenticated
using (supplier_org_id in (select private.my_organization_ids()));

comment on table public.transfers is 'Writes remain disabled pending authenticated, locking reservation and receipt RPCs. No client-supplied price, capacity or status is trusted.';
commit;
