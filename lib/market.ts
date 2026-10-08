export const PRODUCTS = [
  'Ají', 'Ajo', 'Apio', 'Cebolla', 'Choclo', 'Frutilla', 'Lechuga',
  'Limón', 'Mandarina', 'Naranja', 'Palta', 'Papa', 'Pepino ensalada',
  'Pimiento', 'Piña', 'Poroto granado', 'Repollo', 'Sandía', 'Tomate',
  'Zanahoria', 'Zapallo italiano',
] as const;

export const REGIONS = [
  'Región de Arica y Parinacota', 'Región de Coquimbo', 'Región de Valparaíso',
  'Región Metropolitana', 'Región del Maule', 'Región de Ñuble',
  'Región del Biobío', 'Región de La Araucanía', 'Región de Los Lagos',
] as const;

export type ListingMechanism = 'FIXED' | 'AUCTION' | 'BUY_ORDER';
export type ListingStatus = 'DRAFT' | 'ACTIVE' | 'RESERVED' | 'SOLD' | 'EXPIRED' | 'CANCELLED';

export type Seller = {
  id: string;
  displayName: string;
  location: string;
  verified: boolean;
  rating: number;
  operations: number;
  completionRate: number;
  qualityScore: number;
  tier: 'Nuevo' | 'Verificado' | 'Confiable' | 'Destacado';
};

export type Listing = {
  id: string;
  side: 'SELL' | 'BUY';
  mechanism: ListingMechanism;
  product: string;
  variety: string;
  quality: string;
  unit: string;
  region: string;
  comuna: string;
  totalQuantity: number;
  availableQuantity: number;
  minLot: number;
  price: number;
  currentPrice?: number;
  bidIncrement?: number;
  bidCount: number;
  endsAt: string;
  availability: string;
  description: string;
  partialFills: boolean;
  fulfillmentDate?: string;
  availabilityMode?: 'NOW' | 'FUTURE';
  createdAt?: string;
  status: ListingStatus;
  seller: Seller;
};

export type MarketAccess = {
  id: string;
  displayName: string;
  verified: boolean;
  verificationStatus: 'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  isAdmin: boolean;
};

export type MarketBid = {
  id: string;
  listingId: string;
  product: string;
  variety: string;
  unitPrice: number;
  quantity: number;
  allocatedQuantity: number;
  status: 'ACTIVE' | 'OUTBID' | 'WON' | 'PARTIAL' | 'LOST' | 'CANCELLED';
  createdAt: string;
};

export type MarketPortfolio = {
  listings: Listing[];
  bids: MarketBid[];
  trades: Activity[];
};

export type Activity = {
  id: string;
  side: 'BUY' | 'SELL';
  product: string;
  counterparty: string;
  quantity: number;
  unit: string;
  total: number;
  status: 'Adjudicada' | 'Pago por confirmar' | 'Pago confirmado' | 'Lista para retiro' | 'Entregada' | 'Aceptada' | 'En disputa' | 'Cancelada';
  updatedAt: string;
};

export const DEMO_LISTINGS: Listing[] = [
  {
    id: 'papas-melipilla', side: 'SELL', mechanism: 'AUCTION', product: 'Papa',
    variety: 'Asterix', quality: 'Primera', unit: 'kg', region: 'Región Metropolitana', comuna: 'Melipilla',
    totalQuantity: 18000, availableQuantity: 18000, minLot: 2000, price: 520,
    currentPrice: 565, bidIncrement: 10, bidCount: 7, endsAt: '2026-09-30T18:00:00-03:00',
    availability: '2–4 oct', description: 'Papa de guarda, calibre parejo, sin lavar. Retiro en predio.', partialFills: true, status: 'ACTIVE',
    seller: { id: 's1', displayName: 'Agrícola Santa María', location: 'Melipilla, RM', verified: true, rating: 4.8, operations: 38, completionRate: 97, qualityScore: 95, tier: 'Destacado' },
  },
  {
    id: 'cebollas-curico', side: 'SELL', mechanism: 'FIXED', product: 'Cebolla',
    variety: 'Valenciana', quality: 'Primera', unit: 'malla 20 kg', region: 'Región del Maule', comuna: 'Curicó',
    totalQuantity: 620, availableQuantity: 420, minLot: 40, price: 11800,
    bidCount: 0, endsAt: '2026-10-02T13:00:00-03:00', availability: '30 sep–3 oct',
    description: 'Cebolla seca y curada, cuello cerrado, malla incluida.', partialFills: true, status: 'ACTIVE',
    seller: { id: 's2', displayName: 'Productores del Maule', location: 'Curicó, Maule', verified: true, rating: 4.6, operations: 21, completionRate: 95, qualityScore: 93, tier: 'Confiable' },
  },
  {
    id: 'paltas-quillota', side: 'SELL', mechanism: 'AUCTION', product: 'Palta',
    variety: 'Hass', quality: 'Primera', unit: 'caja 10 kg', region: 'Región de Valparaíso', comuna: 'Quillota',
    totalQuantity: 300, availableQuantity: 300, minLot: 30, price: 26500,
    currentPrice: 28100, bidIncrement: 250, bidCount: 11, endsAt: '2026-09-29T22:30:00-03:00',
    availability: '30 sep–1 oct', description: 'Calibre 50–60, cosecha reciente. Retiro o transporte de tercero.', partialFills: true, status: 'ACTIVE',
    seller: { id: 's3', displayName: 'Agrícola El Molino', location: 'Quillota, Valparaíso', verified: true, rating: 4.9, operations: 64, completionRate: 99, qualityScore: 97, tier: 'Destacado' },
  },
  {
    id: 'tomate-limache', side: 'SELL', mechanism: 'FIXED', product: 'Tomate',
    variety: 'Larga vida', quality: 'Primera', unit: 'caja 18 kg', region: 'Región de Valparaíso', comuna: 'Limache',
    totalQuantity: 240, availableQuantity: 240, minLot: 20, price: 17200,
    bidCount: 0, endsAt: '2026-09-30T12:00:00-03:00', availability: '30 sep',
    description: 'Color pintón, calibre homogéneo, caja retornable no incluida.', partialFills: true, status: 'ACTIVE',
    seller: { id: 's4', displayName: 'Huerto Los Aromos', location: 'Limache, Valparaíso', verified: true, rating: 4.5, operations: 14, completionRate: 93, qualityScore: 94, tier: 'Confiable' },
  },
  {
    id: 'compra-limon', side: 'BUY', mechanism: 'BUY_ORDER', product: 'Limón',
    variety: 'Eureka', quality: 'Primera', unit: 'malla 20 kg', region: 'Región Metropolitana', comuna: 'Santiago',
    totalQuantity: 180, availableQuantity: 180, minLot: 60, price: 23500,
    bidCount: 0, endsAt: '2026-10-01T10:00:00-03:00', availability: 'Entrega 2 oct',
    description: 'Compra programada para distribuidor. Entrega en centro de Santiago.', partialFills: true, status: 'ACTIVE',
    seller: { id: 'b1', displayName: 'Distribuidora Central', location: 'Santiago, RM', verified: true, rating: 4.7, operations: 46, completionRate: 98, qualityScore: 96, tier: 'Destacado' },
  },
  {
    id: 'compra-zanahoria', side: 'BUY', mechanism: 'BUY_ORDER', product: 'Zanahoria',
    variety: 'Sin especificar', quality: 'Primera', unit: 'saco 25 kg', region: 'Región del Biobío', comuna: 'Concepción',
    totalQuantity: 320, availableQuantity: 320, minLot: 80, price: 9400,
    bidCount: 0, endsAt: '2026-10-03T14:00:00-03:00', availability: 'Entrega 4–5 oct',
    description: 'Lavada, calibre comercial. Se aceptan entregas parciales.', partialFills: true, status: 'ACTIVE',
    seller: { id: 'b2', displayName: 'Abastecimientos del Sur', location: 'Concepción, Biobío', verified: true, rating: 4.6, operations: 32, completionRate: 96, qualityScore: 95, tier: 'Confiable' },
  },
];

export const DEMO_ACTIVITY: Activity[] = [
  { id: 'OP-1048', side: 'BUY', product: 'Papa Asterix', counterparty: 'Agrícola Santa María', quantity: 3000, unit: 'kg', total: 1695000, status: 'Adjudicada', updatedAt: 'Hoy, 17:42' },
  { id: 'OP-1041', side: 'SELL', product: 'Cebolla Valenciana', counterparty: 'Comprador verificado B-184', quantity: 80, unit: 'mallas', total: 944000, status: 'Lista para retiro', updatedAt: 'Hoy, 10:18' },
  { id: 'OP-1029', side: 'BUY', product: 'Tomate larga vida', counterparty: 'Huerto Los Aromos', quantity: 30, unit: 'cajas', total: 516000, status: 'Entregada', updatedAt: '27 sept, 16:05' },
];

export const currency = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
export const quantity = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });
