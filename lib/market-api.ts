import type { User } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import type { Listing } from './market';

type DbListing = {
  id: string; side: 'SELL' | 'BUY'; mechanism: 'FIXED' | 'AUCTION' | 'BUY_ORDER';
  product: string; variety: string; quality: string; unit: string; region: string; comuna: string;
  total_quantity: number; available_quantity: number; min_lot: number; price: number;
  current_price: number | null; bid_increment: number | null; ends_at: string; availability: string;
  description: string; partial_fills: boolean; status: Listing['status']; bid_count: number | null;
  owner: { id: string; display_name: string; region: string; comuna: string; verified: boolean; rating: number; operations: number; completion_rate: number; quality_score: number; tier: Listing['seller']['tier'] } | null;
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
    partialFills: row.partial_fills, status: row.status,
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
  endsAt: string;
};

export async function publishListing(draft: ListingDraft) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase no configurado');
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Debe ingresar antes de publicar.');
  const mechanism = draft.side === 'BUY' ? 'BUY_ORDER' : draft.mechanism;
  const { data, error } = await supabase.from('market_listings').insert({
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
    partial_fills: true,
    status: 'ACTIVE',
  }).select('id').single();
  if (error) throw error;
  return data.id as string;
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

export async function currentUser(): Promise<User | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}
