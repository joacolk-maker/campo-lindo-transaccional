import type { User } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import type { Activity, Listing, MarketAccess, MarketBid, MarketPortfolio } from './market';

type DbListing = {
  id: string; side: 'SELL' | 'BUY'; mechanism: 'FIXED' | 'AUCTION' | 'BUY_ORDER';
  product: string; variety: string; quality: string; unit: string; region: string; comuna: string;
  total_quantity: number; available_quantity: number; min_lot: number; price: number;
  current_price: number | null; bid_increment: number | null; ends_at: string; availability: string;
  description: string; partial_fills: boolean; status: Listing['status']; bid_count: number | null;
  fulfillment_date?: string | null; availability_mode?: 'NOW' | 'FUTURE' | null; created_at?: string;
  owner: { id: string; display_name: string; region: string; comuna: string; verified: boolean; rating: number; operations: number; completion_rate: number; quality_score: number; tier: Listing['seller']['tier'] } | null;
};

type DbTrade = {
  id: string;
  seller_id: string;
  buyer_id: string;
  quantity: number;
  unit: string;
  total_value: number;
  status: 'AWARDED' | 'PAYMENT_PENDING' | 'PAYMENT_CONFIRMED' | 'READY' | 'DELIVERED' | 'ACCEPTED' | 'DISPUTED' | 'CANCELLED';
  updated_at: string;
  listing: { product: string; variety: string } | null;
  seller: { display_name: string } | null;
  buyer: { display_name: string } | null;
};

const tradeStatus: Record<DbTrade['status'], Activity['status']> = {
  AWARDED: 'Adjudicada',
  PAYMENT_PENDING: 'Pago por confirmar',
  PAYMENT_CONFIRMED: 'Pago confirmado',
  READY: 'Lista para retiro',
  DELIVERED: 'Entregada',
  ACCEPTED: 'Aceptada',
  DISPUTED: 'En disputa',
  CANCELLED: 'Cancelada',
};

function mapListing(row: DbListing): Listing {
  const owner = row.owner;
  return {
    id: row.id, side: row.side, mechanism: row.mechanism, product: row.product,
    variety: row.variety, quality: row.quality, unit: row.unit, region: row.region,
    comuna: row.comuna, totalQuantity: Number(row.total_quantity), availableQuantity: Number(row.available_quantity),
    minLot: Number(row.min_lot), price: Number(row.price), currentPrice: row.current_price === null ? undefined : Number(row.current_price),
    bidIncrement: row.bid_increment === null ? undefined : Number(row.bid_increment), bidCount: row.bid_count ?? 0,
    endsAt: row.ends_at, availability: row.availability, description: row.description,
    partialFills: row.partial_fills, fulfillmentDate: row.fulfillment_date ?? undefined,
    availabilityMode: row.availability_mode ?? undefined, createdAt: row.created_at, status: row.status,
    seller: owner ? {
      id: owner.id, displayName: owner.display_name, location: `${owner.comuna}, ${owner.region}`,
      verified: owner.verified, rating: Number(owner.rating), operations: owner.operations,
      completionRate: Number(owner.completion_rate), qualityScore: Number(owner.quality_score), tier: owner.tier,
    } : { id: 'unknown', displayName: 'Usuario Campo Lindo', location: `${row.comuna}, ${row.region}`, verified: false, rating: 0, operations: 0, completionRate: 0, qualityScore: 0, tier: 'Nuevo' },
  };
}

export async function loadListings(): Promise<Listing[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase
    .from('market_listings')
    .select('*, owner:market_profiles!owner_id(id,display_name,region,comuna,verified,rating,operations,completion_rate,quality_score,tier)')
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as DbListing[]).map(mapListing);
}

export async function loadActivities(userId: string): Promise<Activity[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase
    .from('market_trades')
    .select('id,seller_id,buyer_id,quantity,unit,total_value,status,updated_at,listing:market_listings!listing_id(product,variety),seller:market_profiles!seller_id(display_name),buyer:market_profiles!buyer_id(display_name)')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as DbTrade[]).map((row) => {
    const buying = row.buyer_id === userId;
    const product = row.listing ? `${row.listing.product} ${row.listing.variety}` : 'Producto';
    return {
      id: row.id.slice(0, 8).toUpperCase(),
      side: buying ? 'BUY' : 'SELL',
      product,
      counterparty: buying ? (row.seller?.display_name ?? 'Vendedor verificado') : (row.buyer?.display_name ?? 'Comprador verificado'),
      quantity: Number(row.quantity),
      unit: row.unit,
      total: Number(row.total_value),
      status: tradeStatus[row.status],
      updatedAt: new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(row.updated_at)),
    };
  });
}

export async function loadMyListings(userId: string): Promise<Listing[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase
    .from('market_listings')
    .select('*, owner:market_profiles!owner_id(id,display_name,region,comuna,verified,rating,operations,completion_rate,quality_score,tier)')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as DbListing[]).map(mapListing);
}

type DbBid = {
  id: string;
  listing_id: string;
  unit_price: number;
  quantity: number;
  allocated_quantity: number;
  status: MarketBid['status'];
  created_at: string;
  listing: { product: string; variety: string } | null;
};

export async function loadMyBids(userId: string): Promise<MarketBid[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase
    .from('market_bids')
    .select('id,listing_id,unit_price,quantity,allocated_quantity,status,created_at,listing:market_listings!listing_id(product,variety)')
    .eq('bidder_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as DbBid[]).map((row) => ({
    id: row.id,
    listingId: row.listing_id,
    product: row.listing?.product ?? 'Producto',
    variety: row.listing?.variety ?? '',
    unitPrice: Number(row.unit_price),
    quantity: Number(row.quantity),
    allocatedQuantity: Number(row.allocated_quantity),
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function loadPortfolio(userId: string): Promise<MarketPortfolio> {
  const [listings, bids, trades] = await Promise.all([
    loadMyListings(userId),
    loadMyBids(userId),
    loadActivities(userId),
  ]);
  return { listings, bids, trades };
}

export async function loadMarketAccess(): Promise<MarketAccess | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const modern = await supabase
    .from('market_profiles')
    .select('id,display_name,verified,verification_status,is_admin')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (!modern.error && modern.data) {
    const row = modern.data as { id: string; display_name: string; verified: boolean; verification_status: MarketAccess['verificationStatus']; is_admin: boolean };
    return { id: row.id, displayName: row.display_name, verified: row.verified, verificationStatus: row.verification_status, isAdmin: row.is_admin };
  }

  const legacy = await supabase
    .from('market_profiles')
    .select('id,display_name,verified')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (legacy.error) throw legacy.error;
  if (!legacy.data) return null;
  const row = legacy.data as { id: string; display_name: string; verified: boolean };
  return {
    id: row.id,
    displayName: row.display_name,
    verified: row.verified,
    verificationStatus: row.verified ? 'VERIFIED' : 'PENDING',
    isAdmin: false,
  };
}

export async function placeBid(listingId: string, unitPrice: number, bidQuantity: number) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase.rpc('market_place_bid', {
    p_listing_id: listingId, p_unit_price: unitPrice, p_quantity: bidQuantity,
  });
  if (error) throw error;
  return data;
}

export async function buyNow(listingId: string, buyQuantity: number) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase.rpc('market_buy_now', {
    p_listing_id: listingId, p_quantity: buyQuantity,
  });
  if (error) throw error;
  return data;
}

export async function supplyBuyOrder(listingId: string, supplyQuantity: number) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase.rpc('market_supply_buy_order', {
    p_listing_id: listingId, p_quantity: supplyQuantity,
  });
  if (error) throw error;
  return data;
}

export type ListingDraft = {
  side: 'SELL' | 'BUY'; mechanism: 'FIXED' | 'AUCTION' | 'BUY_ORDER';
  product: string; variety: string; quality: string; unit: string;
  region: string; comuna: string; totalQuantity: number; minLot: number;
  price: number; bidIncrement: number; description: string; availability: string;
  endsAt: string; partialFills: boolean; fulfillmentDate: string; availabilityMode: 'NOW' | 'FUTURE';
};

export async function publishListing(draft: ListingDraft) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Debe ingresar antes de publicar.');
  const mechanism = draft.side === 'BUY' ? 'BUY_ORDER' : draft.mechanism;
  const baseInsert = {
    owner_id: auth.user.id,
    side: draft.side,
    mechanism,
    product: draft.product,
    variety: draft.variety || 'Sin especificar',
    quality: draft.quality,
    unit: draft.unit,
    region: draft.region,
    comuna: draft.comuna,
    total_quantity: draft.totalQuantity,
    available_quantity: draft.totalQuantity,
    min_lot: draft.minLot,
    price: draft.price,
    current_price: mechanism === 'AUCTION' ? draft.price : null,
    bid_increment: mechanism === 'AUCTION' ? draft.bidIncrement : null,
    ends_at: draft.endsAt,
    availability: draft.availability,
    description: draft.description,
    partial_fills: draft.partialFills,
    status: 'ACTIVE',
  };
  const enrichedInsert = {
    ...baseInsert,
    fulfillment_date: draft.fulfillmentDate || null,
    availability_mode: draft.availabilityMode,
  };
  let result = await supabase.from('market_listings').insert(enrichedInsert).select('id').single();
  if (result.error && (result.error.code === 'PGRST204' || result.error.code === '42703')) {
    result = await supabase.from('market_listings').insert(baseInsert).select('id').single();
  }
  const { data, error } = result;
  if (error) throw error;
  return data.id as string;
}

export type AdminProfile = {
  id: string; display_name: string; email: string | null; account_type: string; region: string; comuna: string;
  verified: boolean; verification_status: MarketAccess['verificationStatus']; tier: string; rating: number;
  operations: number; completion_rate: number; quality_score: number; created_at: string;
};

export type AdminListing = {
  id: string; owner_id: string; owner_name: string; side: 'SELL' | 'BUY'; mechanism: string; product: string;
  variety: string; quality: string; unit: string; region: string; comuna: string; total_quantity: number;
  available_quantity: number; min_lot: number; price: number; current_price: number | null; bid_count: number;
  partial_fills: boolean; fulfillment_date: string | null; ends_at: string; status: Listing['status']; created_at: string;
};

export type AdminBid = {
  id: string; listing_id: string; bidder_id: string; bidder_name: string; product: string; unit_price: number;
  quantity: number; allocated_quantity: number; status: string; created_at: string;
};

export type AdminTrade = {
  id: string; listing_id: string; seller_id: string; seller_name: string; buyer_id: string; buyer_name: string;
  product: string; variety: string; mechanism: string; quantity: number; unit: string; unit_price: number;
  total_value: number; status: string; guarantee_status: string; created_at: string; updated_at: string;
};

export type AdminSnapshot = {
  generated_at: string;
  profiles: AdminProfile[];
  listings: AdminListing[];
  bids: AdminBid[];
  trades: AdminTrade[];
  events: Array<{ id: number; trade_id: string; actor_id: string | null; event_type: string; payload: Record<string, unknown>; created_at: string }>;
};

export async function loadAdminSnapshot(): Promise<AdminSnapshot> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase.rpc('market_admin_snapshot');
  if (error) throw error;
  return data as AdminSnapshot;
}

export async function setProfileVerification(profileId: string, status: MarketAccess['verificationStatus'], reason = '') {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const { error } = await supabase.rpc('market_admin_set_verification', { p_profile_id: profileId, p_status: status, p_reason: reason });
  if (error) throw error;
}

export async function setListingStatus(listingId: string, status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED', reason = '') {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const { error } = await supabase.rpc('market_admin_set_listing_status', { p_listing_id: listingId, p_status: status, p_reason: reason });
  if (error) throw error;
}

export async function sendMagicLink(email: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: typeof window === 'undefined' ? undefined : window.location.href },
  });
  if (error) throw error;
}

export async function signInWithPassword(email: string, password: string): Promise<User> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('No fue posible iniciar la sesión.');
  return data.user;
}

export async function signUpWithPassword(displayName: string, email: string, password: string): Promise<User | null> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: typeof window === 'undefined' ? undefined : window.location.href,
      data: { display_name: displayName },
    },
  });
  if (error) throw error;
  return data.session ? data.user : null;
}

export async function signOut() {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function currentUser(): Promise<User | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}
