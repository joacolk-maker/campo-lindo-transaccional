-- Campo Lindo · mantenedor, trazabilidad y datos estructurados del piloto
-- Ejecutar después de 202609290001_marketplace.sql.

alter table public.market_profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists verification_status text not null default 'PENDING'
    check (verification_status in ('PENDING','IN_REVIEW','VERIFIED','REJECTED','SUSPENDED'));

update public.market_profiles
set verification_status = case when verified then 'VERIFIED' else verification_status end;

alter table public.market_listings
  add column if not exists fulfillment_date date,
  add column if not exists availability_mode text not null default 'NOW'
    check (availability_mode in ('NOW','FUTURE'));

create table if not exists public.market_admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.market_profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists market_admin_audit_created_idx
  on public.market_admin_audit(created_at desc);

create or replace function public.market_is_admin(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.market_profiles where id = p_user), false);
$$;

revoke execute on function public.market_is_admin(uuid) from public, anon;
grant execute on function public.market_is_admin(uuid) to authenticated;

create or replace function public.market_can_read_listing(
  p_listing_id uuid,
  p_owner_id uuid,
  p_status text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_status = 'ACTIVE'
    or auth.uid() = p_owner_id
    or public.market_is_admin()
    or exists (
      select 1 from public.market_bids b
      where b.listing_id = p_listing_id and b.bidder_id = auth.uid()
    )
    or exists (
      select 1 from public.market_trades t
      where t.listing_id = p_listing_id and auth.uid() in (t.seller_id, t.buyer_id)
    );
$$;

revoke execute on function public.market_can_read_listing(uuid,uuid,text) from public;
grant execute on function public.market_can_read_listing(uuid,uuid,text) to anon, authenticated;

drop policy if exists market_listings_read on public.market_listings;
create policy market_listings_read on public.market_listings
for select using (public.market_can_read_listing(id, owner_id, status));

drop policy if exists market_profiles_admin_read on public.market_profiles;
create policy market_profiles_admin_read on public.market_profiles
for select to authenticated using (public.market_is_admin());

drop policy if exists market_listings_admin_read on public.market_listings;
create policy market_listings_admin_read on public.market_listings
for select to authenticated using (public.market_is_admin());

drop policy if exists market_bids_admin_read on public.market_bids;
create policy market_bids_admin_read on public.market_bids
for select to authenticated using (public.market_is_admin());

drop policy if exists market_trades_admin_read on public.market_trades;
create policy market_trades_admin_read on public.market_trades
for select to authenticated using (public.market_is_admin());

drop policy if exists market_trade_events_admin_read on public.market_trade_events;
create policy market_trade_events_admin_read on public.market_trade_events
for select to authenticated using (public.market_is_admin());

alter table public.market_admin_audit enable row level security;
drop policy if exists market_admin_audit_admin_read on public.market_admin_audit;
create policy market_admin_audit_admin_read on public.market_admin_audit
for select to authenticated using (public.market_is_admin());

drop view if exists public.market_public_bid_book;
create view public.market_public_bid_book as
select
  b.listing_id,
  b.unit_price,
  b.quantity,
  b.created_at,
  b.bidder_id,
  p.display_name as bidder_name,
  p.verified as bidder_verified
from public.market_bids b
join public.market_profiles p on p.id = b.bidder_id
where b.status in ('ACTIVE','WON','PARTIAL','LOST');

grant select on public.market_public_bid_book to anon, authenticated;

create or replace function public.market_admin_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or not public.market_is_admin(v_user) then
    raise exception 'Acceso reservado al administrador de Campo Lindo';
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'profiles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'display_name', p.display_name,
        'email', u.email,
        'account_type', p.account_type,
        'region', p.region,
        'comuna', p.comuna,
        'verified', p.verified,
        'verification_status', p.verification_status,
        'tier', p.tier,
        'rating', p.rating,
        'operations', p.operations,
        'completion_rate', p.completion_rate,
        'quality_score', p.quality_score,
        'created_at', p.created_at
      ) order by p.created_at desc)
      from public.market_profiles p
      left join auth.users u on u.id = p.id
    ), '[]'::jsonb),
    'listings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'owner_id', l.owner_id,
        'owner_name', p.display_name,
        'side', l.side,
        'mechanism', l.mechanism,
        'product', l.product,
        'variety', l.variety,
        'quality', l.quality,
        'unit', l.unit,
        'region', l.region,
        'comuna', l.comuna,
        'total_quantity', l.total_quantity,
        'available_quantity', l.available_quantity,
        'min_lot', l.min_lot,
        'price', l.price,
        'current_price', l.current_price,
        'bid_count', l.bid_count,
        'partial_fills', l.partial_fills,
        'fulfillment_date', l.fulfillment_date,
        'ends_at', l.ends_at,
        'status', l.status,
        'created_at', l.created_at
      ) order by l.created_at desc)
      from public.market_listings l
      join public.market_profiles p on p.id = l.owner_id
    ), '[]'::jsonb),
    'bids', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id,
        'listing_id', b.listing_id,
        'bidder_id', b.bidder_id,
        'bidder_name', p.display_name,
        'product', l.product,
        'unit_price', b.unit_price,
        'quantity', b.quantity,
        'allocated_quantity', b.allocated_quantity,
        'status', b.status,
        'created_at', b.created_at
      ) order by b.created_at desc)
      from public.market_bids b
      join public.market_profiles p on p.id = b.bidder_id
      join public.market_listings l on l.id = b.listing_id
    ), '[]'::jsonb),
    'trades', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'listing_id', t.listing_id,
        'seller_id', t.seller_id,
        'seller_name', ps.display_name,
        'buyer_id', t.buyer_id,
        'buyer_name', pb.display_name,
        'product', l.product,
        'variety', l.variety,
        'mechanism', t.mechanism,
        'quantity', t.quantity,
        'unit', t.unit,
        'unit_price', t.unit_price,
        'total_value', t.total_value,
        'status', t.status,
        'guarantee_status', t.guarantee_status,
        'created_at', t.created_at,
        'updated_at', t.updated_at
      ) order by t.created_at desc)
      from public.market_trades t
      join public.market_listings l on l.id = t.listing_id
      join public.market_profiles ps on ps.id = t.seller_id
      join public.market_profiles pb on pb.id = t.buyer_id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'trade_id', e.trade_id,
        'actor_id', e.actor_id,
        'event_type', e.event_type,
        'payload', e.payload,
        'created_at', e.created_at
      ) order by e.created_at desc)
      from public.market_trade_events e
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.market_admin_snapshot() from public, anon;
grant execute on function public.market_admin_snapshot() to authenticated;

create or replace function public.market_admin_set_verification(
  p_profile_id uuid,
  p_status text,
  p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_before public.market_profiles%rowtype;
  v_verified boolean;
begin
  if v_user is null or not public.market_is_admin(v_user) then
    raise exception 'Acceso reservado al administrador de Campo Lindo';
  end if;
  if p_status not in ('PENDING','IN_REVIEW','VERIFIED','REJECTED','SUSPENDED') then
    raise exception 'Estado de verificación inválido';
  end if;

  select * into v_before from public.market_profiles where id = p_profile_id for update;
  if not found then raise exception 'Usuario inexistente'; end if;
  v_verified := p_status = 'VERIFIED';

  update public.market_profiles
  set verification_status = p_status,
      verified = v_verified,
      tier = case
        when v_verified and tier = 'Nuevo' then 'Verificado'
        when not v_verified then 'Nuevo'
        else tier
      end
  where id = p_profile_id;

  insert into public.market_admin_audit(actor_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (
    v_user,
    'SET_VERIFICATION',
    'PROFILE',
    p_profile_id::text,
    to_jsonb(v_before),
    jsonb_build_object('verification_status', p_status, 'verified', v_verified),
    coalesce(p_reason, '')
  );
end;
$$;

revoke execute on function public.market_admin_set_verification(uuid,text,text) from public, anon;
grant execute on function public.market_admin_set_verification(uuid,text,text) to authenticated;

create or replace function public.market_admin_set_listing_status(
  p_listing_id uuid,
  p_status text,
  p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_before public.market_listings%rowtype;
begin
  if v_user is null or not public.market_is_admin(v_user) then
    raise exception 'Acceso reservado al administrador de Campo Lindo';
  end if;
  if p_status not in ('ACTIVE','EXPIRED','CANCELLED') then
    raise exception 'Estado administrativo inválido';
  end if;

  select * into v_before from public.market_listings where id = p_listing_id for update;
  if not found then raise exception 'Publicación inexistente'; end if;

  update public.market_listings set status = p_status where id = p_listing_id;
  insert into public.market_admin_audit(actor_id, action, entity_type, entity_id, before_data, after_data, reason)
  values (
    v_user,
    'SET_LISTING_STATUS',
    'LISTING',
    p_listing_id::text,
    to_jsonb(v_before),
    jsonb_build_object('status', p_status),
    coalesce(p_reason, '')
  );
end;
$$;

revoke execute on function public.market_admin_set_listing_status(uuid,text,text) from public, anon;
grant execute on function public.market_admin_set_listing_status(uuid,text,text) to authenticated;

-- Activación inicial del propietario (ejecutar una sola vez reemplazando el correo):
-- update public.market_profiles p
-- set is_admin = true
-- from auth.users u
-- where p.id = u.id and lower(u.email) = lower('CORREO_DEL_PROPIETARIO');
