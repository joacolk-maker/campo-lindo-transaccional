-- Campo Lindo Transaccional · esquema piloto
-- Ejecutar en el SQL Editor del proyecto Supabase de Campo Lindo.

create extension if not exists pgcrypto;

create table if not exists public.market_products (
  name text primary key,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.market_products (name) values
  ('Ají'),('Ajo'),('Apio'),('Cebolla'),('Choclo'),('Frutilla'),('Lechuga'),
  ('Limón'),('Mandarina'),('Naranja'),('Palta'),('Papa'),('Pepino ensalada'),
  ('Pimiento'),('Piña'),('Poroto granado'),('Repollo'),('Sandía'),('Tomate'),
  ('Zanahoria'),('Zapallo italiano')
on conflict (name) do update set active = true;

create table if not exists public.market_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Usuario Campo Lindo',
  account_type text not null default 'BOTH' check (account_type in ('SELLER','BUYER','BOTH')),
  region text not null default '',
  comuna text not null default '',
  verified boolean not null default false,
  tier text not null default 'Nuevo' check (tier in ('Nuevo','Verificado','Confiable','Destacado')),
  rating numeric(3,2) not null default 0 check (rating between 0 and 5),
  operations integer not null default 0 check (operations >= 0),
  completion_rate numeric(5,2) not null default 0 check (completion_rate between 0 and 100),
  quality_score numeric(5,2) not null default 0 check (quality_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.market_profiles(id),
  side text not null check (side in ('SELL','BUY')),
  mechanism text not null check (mechanism in ('FIXED','AUCTION','BUY_ORDER')),
  product text not null references public.market_products(name),
  variety text not null default 'Sin especificar',
  quality text not null,
  unit text not null,
  region text not null,
  comuna text not null,
  total_quantity numeric(16,3) not null check (total_quantity > 0),
  available_quantity numeric(16,3) not null check (available_quantity >= 0 and available_quantity <= total_quantity),
  min_lot numeric(16,3) not null check (min_lot > 0 and min_lot <= total_quantity),
  price numeric(16,2) not null check (price > 0),
  current_price numeric(16,2),
  bid_increment numeric(16,2),
  bid_count integer not null default 0 check (bid_count >= 0),
  partial_fills boolean not null default true,
  availability text not null default '',
  description text not null default '',
  image_paths text[] not null default '{}',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','RESERVED','SOLD','EXPIRED','CANCELLED')),
  terms_version text not null default 'pilot-1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check ((side = 'BUY' and mechanism = 'BUY_ORDER') or (side = 'SELL' and mechanism in ('FIXED','AUCTION'))),
  check ((mechanism = 'AUCTION' and current_price is not null and bid_increment is not null and bid_increment > 0) or mechanism <> 'AUCTION')
);

create index if not exists market_listings_active_idx on public.market_listings(status, side, mechanism, ends_at);
create index if not exists market_listings_product_region_idx on public.market_listings(product, region, status);
create index if not exists market_listings_owner_idx on public.market_listings(owner_id, created_at desc);

create table if not exists public.market_bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.market_listings(id) on delete cascade,
  bidder_id uuid not null references public.market_profiles(id),
  unit_price numeric(16,2) not null check (unit_price > 0),
  quantity numeric(16,3) not null check (quantity > 0),
  allocated_quantity numeric(16,3) not null default 0 check (allocated_quantity >= 0 and allocated_quantity <= quantity),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','OUTBID','WON','PARTIAL','LOST','CANCELLED')),
  terms_version text not null default 'pilot-1',
  created_at timestamptz not null default now()
);

create index if not exists market_bids_book_idx on public.market_bids(listing_id, unit_price desc, created_at asc);
create index if not exists market_bids_bidder_idx on public.market_bids(bidder_id, created_at desc);

create table if not exists public.market_trades (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.market_listings(id),
  bid_id uuid references public.market_bids(id),
  seller_id uuid not null references public.market_profiles(id),
  buyer_id uuid not null references public.market_profiles(id),
  mechanism text not null check (mechanism in ('FIXED','AUCTION','BUY_ORDER')),
  quantity numeric(16,3) not null check (quantity > 0),
  unit text not null,
  unit_price numeric(16,2) not null check (unit_price > 0),
  total_value numeric(18,2) generated always as (quantity * unit_price) stored,
  status text not null default 'AWARDED' check (status in ('AWARDED','PAYMENT_PENDING','PAYMENT_CONFIRMED','READY','DELIVERED','ACCEPTED','DISPUTED','CANCELLED')),
  guarantee_status text not null default 'NOT_ENABLED' check (guarantee_status in ('NOT_ENABLED','PENDING','HELD','RELEASED','FORFEITED','REFUNDED')),
  terms_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_trades_seller_idx on public.market_trades(seller_id, created_at desc);
create index if not exists market_trades_buyer_idx on public.market_trades(buyer_id, created_at desc);

create table if not exists public.market_trade_events (
  id bigint generated always as identity primary key,
  trade_id uuid not null references public.market_trades(id) on delete cascade,
  actor_id uuid references public.market_profiles(id),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists market_trade_events_trade_idx on public.market_trade_events(trade_id, created_at);

create table if not exists public.market_ratings (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.market_trades(id),
  rater_id uuid not null references public.market_profiles(id),
  rated_id uuid not null references public.market_profiles(id),
  overall smallint not null check (overall between 1 and 5),
  compliance smallint not null check (compliance between 1 and 5),
  quality smallint not null check (quality between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  unique (trade_id, rater_id),
  check (rater_id <> rated_id)
);

create or replace function public.market_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists market_profiles_touch on public.market_profiles;
create trigger market_profiles_touch before update on public.market_profiles
for each row execute function public.market_touch_updated_at();
drop trigger if exists market_listings_touch on public.market_listings;
create trigger market_listings_touch before update on public.market_listings
for each row execute function public.market_touch_updated_at();
drop trigger if exists market_trades_touch on public.market_trades;
create trigger market_trades_touch before update on public.market_trades
for each row execute function public.market_touch_updated_at();

create or replace function public.market_normalize_listing()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then new.owner_id = auth.uid(); end if;
  new.available_quantity = new.total_quantity;
  new.bid_count = 0;
  new.starts_at = now();
  if new.status not in ('DRAFT','ACTIVE') then new.status = 'DRAFT'; end if;
  if new.side = 'BUY' then
    new.mechanism = 'BUY_ORDER'; new.current_price = null; new.bid_increment = null;
  elsif new.mechanism = 'AUCTION' then
    new.current_price = new.price;
  else
    new.mechanism = 'FIXED'; new.current_price = null; new.bid_increment = null;
  end if;
  return new;
end;
$$;

drop trigger if exists market_listings_normalize on public.market_listings;
create trigger market_listings_normalize before insert on public.market_listings
for each row execute function public.market_normalize_listing();

create or replace function public.market_prevent_terms_change()
returns trigger language plpgsql as $$
begin
  if old.bid_count > 0 and (
    new.product is distinct from old.product or new.variety is distinct from old.variety or
    new.quality is distinct from old.quality or new.unit is distinct from old.unit or
    new.region is distinct from old.region or new.comuna is distinct from old.comuna or
    new.total_quantity is distinct from old.total_quantity or new.min_lot is distinct from old.min_lot or
    new.price is distinct from old.price or new.bid_increment is distinct from old.bid_increment or
    new.partial_fills is distinct from old.partial_fills or new.availability is distinct from old.availability or
    new.description is distinct from old.description
  ) then
    raise exception 'Las condiciones no pueden modificarse después de la primera puja';
  end if;
  return new;
end;
$$;

drop trigger if exists market_listings_lock_terms on public.market_listings;
create trigger market_listings_lock_terms before update on public.market_listings
for each row execute function public.market_prevent_terms_change();

create or replace function public.market_create_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.market_profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Usuario Campo Lindo'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists market_profile_on_signup on auth.users;
create trigger market_profile_on_signup after insert on auth.users
for each row execute function public.market_create_profile();

insert into public.market_profiles (id, display_name)
select id, coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1), 'Usuario Campo Lindo')
from auth.users
on conflict (id) do nothing;

create or replace function public.market_assert_verified(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.market_profiles where id = p_user and verified) then
    raise exception 'Su perfil debe estar verificado para operar';
  end if;
end;
$$;

create or replace function public.market_place_bid(p_listing_id uuid, p_unit_price numeric, p_quantity numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_listing public.market_listings%rowtype;
  v_bid_id uuid;
  v_min_price numeric;
begin
  if v_user is null then raise exception 'Debe ingresar para ofertar'; end if;
  perform public.market_assert_verified(v_user);
  select * into v_listing from public.market_listings where id = p_listing_id for update;
  if not found then raise exception 'Publicación inexistente'; end if;
  if v_listing.owner_id = v_user then raise exception 'No puede ofertar sobre su propia publicación'; end if;
  if v_listing.mechanism <> 'AUCTION' or v_listing.status <> 'ACTIVE' or v_listing.ends_at <= now() then raise exception 'La subasta no está activa'; end if;
  if p_quantity < v_listing.min_lot or p_quantity > v_listing.available_quantity then raise exception 'Cantidad fuera de los límites permitidos'; end if;
  if not v_listing.partial_fills and p_quantity <> v_listing.available_quantity then raise exception 'Esta subasta exige tomar el lote completo'; end if;
  v_min_price := coalesce(v_listing.current_price, v_listing.price) + v_listing.bid_increment;
  if p_unit_price < v_min_price then raise exception 'La oferta mínima es %', v_min_price; end if;

  insert into public.market_bids (listing_id, bidder_id, unit_price, quantity, terms_version)
  values (v_listing.id, v_user, p_unit_price, p_quantity, v_listing.terms_version)
  returning id into v_bid_id;

  update public.market_listings set
    current_price = p_unit_price,
    bid_count = bid_count + 1,
    ends_at = case when ends_at - now() <= interval '2 minutes' then ends_at + interval '5 minutes' else ends_at end
  where id = v_listing.id;
  return v_bid_id;
end;
$$;

create or replace function public.market_buy_now(p_listing_id uuid, p_quantity numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_listing public.market_listings%rowtype;
  v_trade_id uuid;
begin
  if v_user is null then raise exception 'Debe ingresar para comprar'; end if;
  perform public.market_assert_verified(v_user);
  select * into v_listing from public.market_listings where id = p_listing_id for update;
  if not found then raise exception 'Publicación inexistente'; end if;
  if v_listing.owner_id = v_user then raise exception 'No puede comprar su propia publicación'; end if;
  if v_listing.side <> 'SELL' or v_listing.mechanism <> 'FIXED' or v_listing.status <> 'ACTIVE' or v_listing.ends_at <= now() then raise exception 'La compra inmediata no está disponible'; end if;
  if p_quantity < v_listing.min_lot or p_quantity > v_listing.available_quantity then raise exception 'Cantidad fuera de los límites permitidos'; end if;
  if not v_listing.partial_fills and p_quantity <> v_listing.available_quantity then raise exception 'Esta publicación exige comprar el lote completo'; end if;

  insert into public.market_trades (listing_id, seller_id, buyer_id, mechanism, quantity, unit, unit_price, terms_snapshot)
  values (v_listing.id, v_listing.owner_id, v_user, 'FIXED', p_quantity, v_listing.unit, v_listing.price,
    jsonb_build_object('product',v_listing.product,'variety',v_listing.variety,'quality',v_listing.quality,'unit',v_listing.unit,'region',v_listing.region,'comuna',v_listing.comuna,'availability',v_listing.availability,'terms_version',v_listing.terms_version))
  returning id into v_trade_id;

  update public.market_listings set available_quantity = available_quantity - p_quantity,
    status = case when available_quantity - p_quantity = 0 then 'SOLD' else status end
  where id = v_listing.id;
  insert into public.market_trade_events (trade_id, actor_id, event_type) values (v_trade_id, v_user, 'TRADE_CREATED');
  return v_trade_id;
end;
$$;

create or replace function public.market_supply_buy_order(p_listing_id uuid, p_quantity numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_listing public.market_listings%rowtype;
  v_trade_id uuid;
begin
  if v_user is null then raise exception 'Debe ingresar para ofrecer abastecimiento'; end if;
  perform public.market_assert_verified(v_user);
  select * into v_listing from public.market_listings where id = p_listing_id for update;
  if not found then raise exception 'Orden de compra inexistente'; end if;
  if v_listing.owner_id = v_user then raise exception 'No puede abastecer su propia orden'; end if;
  if v_listing.side <> 'BUY' or v_listing.mechanism <> 'BUY_ORDER' or v_listing.status <> 'ACTIVE' or v_listing.ends_at <= now() then raise exception 'La orden de compra no está disponible'; end if;
  if p_quantity < v_listing.min_lot or p_quantity > v_listing.available_quantity then raise exception 'Cantidad fuera de los límites permitidos'; end if;
  if not v_listing.partial_fills and p_quantity <> v_listing.available_quantity then raise exception 'Esta orden exige abastecer el lote completo'; end if;

  insert into public.market_trades (listing_id, seller_id, buyer_id, mechanism, quantity, unit, unit_price, terms_snapshot)
  values (v_listing.id, v_user, v_listing.owner_id, 'BUY_ORDER', p_quantity, v_listing.unit, v_listing.price,
    jsonb_build_object('product',v_listing.product,'variety',v_listing.variety,'quality',v_listing.quality,'unit',v_listing.unit,'region',v_listing.region,'comuna',v_listing.comuna,'availability',v_listing.availability,'terms_version',v_listing.terms_version))
  returning id into v_trade_id;

  update public.market_listings set available_quantity = available_quantity - p_quantity,
    status = case when available_quantity - p_quantity = 0 then 'SOLD' else status end
  where id = v_listing.id;
  insert into public.market_trade_events (trade_id, actor_id, event_type) values (v_trade_id, v_user, 'SUPPLY_ACCEPTED');
  return v_trade_id;
end;
$$;

create or replace function public.market_close_auction(p_listing_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_listing public.market_listings%rowtype;
  v_bid public.market_bids%rowtype;
  v_remaining numeric;
  v_allocated numeric;
  v_trade_id uuid;
  v_count integer := 0;
begin
  select * into v_listing from public.market_listings where id = p_listing_id for update;
  if not found then raise exception 'Publicación inexistente'; end if;
  if auth.uid() is distinct from v_listing.owner_id and coalesce(auth.role(),'') <> 'service_role' then raise exception 'No autorizado'; end if;
  if v_listing.mechanism <> 'AUCTION' or v_listing.status <> 'ACTIVE' or v_listing.ends_at > now() then raise exception 'La subasta aún no puede cerrarse'; end if;
  v_remaining := v_listing.available_quantity;
  for v_bid in select * from public.market_bids where listing_id = p_listing_id and status = 'ACTIVE' order by unit_price desc, created_at asc loop
    exit when v_remaining < v_listing.min_lot;
    v_allocated := least(v_bid.quantity, v_remaining);
    if v_allocated < v_bid.quantity and not v_listing.partial_fills then continue; end if;
    if v_allocated < v_listing.min_lot then continue; end if;
    insert into public.market_trades (listing_id,bid_id,seller_id,buyer_id,mechanism,quantity,unit,unit_price,terms_snapshot)
    values (v_listing.id,v_bid.id,v_listing.owner_id,v_bid.bidder_id,'AUCTION',v_allocated,v_listing.unit,v_bid.unit_price,
      jsonb_build_object('product',v_listing.product,'variety',v_listing.variety,'quality',v_listing.quality,'unit',v_listing.unit,'region',v_listing.region,'comuna',v_listing.comuna,'availability',v_listing.availability,'terms_version',v_listing.terms_version))
    returning id into v_trade_id;
    update public.market_bids set allocated_quantity = v_allocated, status = case when v_allocated = quantity then 'WON' else 'PARTIAL' end where id = v_bid.id;
    insert into public.market_trade_events (trade_id, actor_id, event_type) values (v_trade_id, v_listing.owner_id, 'AUCTION_AWARDED');
    v_remaining := v_remaining - v_allocated;
    v_count := v_count + 1;
  end loop;
  update public.market_bids set status = 'LOST' where listing_id = p_listing_id and status = 'ACTIVE';
  update public.market_listings set available_quantity = v_remaining, status = case when v_count > 0 then 'SOLD' else 'EXPIRED' end where id = p_listing_id;
  return v_count;
end;
$$;

create or replace view public.market_public_bid_book as
select listing_id, unit_price, quantity, created_at,
  'B-' || upper(substr(md5(bidder_id::text || listing_id::text),1,4)) as bidder_alias
from public.market_bids
where status in ('ACTIVE','WON','PARTIAL','LOST');

alter table public.market_products enable row level security;
alter table public.market_profiles enable row level security;
alter table public.market_listings enable row level security;
alter table public.market_bids enable row level security;
alter table public.market_trades enable row level security;
alter table public.market_trade_events enable row level security;
alter table public.market_ratings enable row level security;

drop policy if exists market_products_read on public.market_products;
create policy market_products_read on public.market_products for select using (active);
drop policy if exists market_profiles_read on public.market_profiles;
create policy market_profiles_read on public.market_profiles for select using (true);
drop policy if exists market_profiles_own_update on public.market_profiles;
create policy market_profiles_own_update on public.market_profiles for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists market_listings_read on public.market_listings;
create policy market_listings_read on public.market_listings for select using (status = 'ACTIVE' or auth.uid() = owner_id);
drop policy if exists market_listings_insert on public.market_listings;
create policy market_listings_insert on public.market_listings for insert with check (auth.uid() = owner_id and status in ('DRAFT','ACTIVE') and exists (select 1 from public.market_profiles p where p.id = auth.uid() and p.verified));
drop policy if exists market_listings_own_update on public.market_listings;
create policy market_listings_own_update on public.market_listings for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists market_bids_parties_read on public.market_bids;
create policy market_bids_parties_read on public.market_bids for select using (auth.uid() = bidder_id or exists (select 1 from public.market_listings l where l.id = listing_id and l.owner_id = auth.uid()));
drop policy if exists market_trades_parties_read on public.market_trades;
create policy market_trades_parties_read on public.market_trades for select using (auth.uid() in (seller_id,buyer_id));
drop policy if exists market_trade_events_parties_read on public.market_trade_events;
create policy market_trade_events_parties_read on public.market_trade_events for select using (exists (select 1 from public.market_trades t where t.id = trade_id and auth.uid() in (t.seller_id,t.buyer_id)));
drop policy if exists market_ratings_read on public.market_ratings;
create policy market_ratings_read on public.market_ratings for select using (true);
drop policy if exists market_ratings_insert on public.market_ratings;
create policy market_ratings_insert on public.market_ratings for insert with check (auth.uid() = rater_id and exists (select 1 from public.market_trades t where t.id = trade_id and t.status = 'ACCEPTED' and auth.uid() in (t.seller_id,t.buyer_id) and rated_id in (t.seller_id,t.buyer_id)));

grant select on public.market_products, public.market_profiles, public.market_listings, public.market_public_bid_book to anon, authenticated;
grant insert on public.market_listings to authenticated;
revoke update on public.market_profiles, public.market_listings from authenticated;
grant update (display_name, account_type, region, comuna) on public.market_profiles to authenticated;
grant update (variety, quality, unit, region, comuna, total_quantity, min_lot, price, bid_increment, partial_fills, availability, description, image_paths) on public.market_listings to authenticated;
grant select on public.market_bids, public.market_trades, public.market_trade_events to authenticated;
grant select, insert on public.market_ratings to authenticated;
revoke insert, update, delete on public.market_bids, public.market_trades, public.market_trade_events from anon, authenticated;
revoke execute on function public.market_place_bid(uuid,numeric,numeric) from public, anon;
revoke execute on function public.market_buy_now(uuid,numeric) from public, anon;
revoke execute on function public.market_supply_buy_order(uuid,numeric) from public, anon;
revoke execute on function public.market_close_auction(uuid) from public, anon;
grant execute on function public.market_place_bid(uuid,numeric,numeric) to authenticated;
grant execute on function public.market_buy_now(uuid,numeric) to authenticated;
grant execute on function public.market_supply_buy_order(uuid,numeric) to authenticated;
grant execute on function public.market_close_auction(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('market-listings','market-listings',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists market_listing_images_read on storage.objects;
create policy market_listing_images_read on storage.objects for select using (bucket_id = 'market-listings');
drop policy if exists market_listing_images_insert on storage.objects;
create policy market_listing_images_insert on storage.objects for insert to authenticated with check (bucket_id = 'market-listings' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists market_listing_images_own_delete on storage.objects;
create policy market_listing_images_own_delete on storage.objects for delete to authenticated using (bucket_id = 'market-listings' and owner_id = auth.uid()::text);
