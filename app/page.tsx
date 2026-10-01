'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import './activity.css';
import { buyNow, currentUser, loadActivities, loadListings, placeBid, publishListing, sendMagicLink, signInWithPassword, signOut, signUpWithPassword, supplyBuyOrder } from '@/lib/market-api';
import { fallbackCatalog, loadMarketCatalog } from '@/lib/market-catalog';
import { currency, DEMO_ACTIVITY, DEMO_LISTINGS, PRODUCTS, quantity, REGIONS, type Activity, type Listing } from '@/lib/market';

type Modal = 'listing' | 'publish' | 'login' | 'activity' | null;

type WebMcpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: unknown) => unknown | Promise<unknown>;
};

declare global {
  interface Document {
    readonly modelContext?: {
      registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
  }
}

const mechanismLabel = (listing: Listing) => listing.mechanism === 'FIXED' ? 'Compra inmediata' : listing.mechanism === 'AUCTION' ? 'Subasta abierta' : 'Orden de compra';
const sideLabel = (listing: Listing) => listing.side === 'BUY' ? 'Demanda' : 'Oferta';

function remainingLabel(endsAt: string) {
  const milliseconds = new Date(endsAt).getTime() - Date.now();
  if (milliseconds <= 0) return 'Finalizada';
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  if (hours >= 24) return `${Math.floor(hours / 24)} d ${hours % 24} h`;
  return `${hours} h ${minutes} min`;
}

function ListingCard({ listing, onOpen }: { listing: Listing; onOpen: (listing: Listing) => void }) {
  const displayPrice = listing.mechanism === 'AUCTION' ? listing.currentPrice ?? listing.price : listing.price;
  return (
    <article className="listing-card">
      <div className="listing-topline">
        <span className={`mechanism ${listing.mechanism.toLowerCase()}`}>{mechanismLabel(listing)}</span>
        <span className="time-left" suppressHydrationWarning>{listing.mechanism === 'AUCTION' ? `Cierra en ${remainingLabel(listing.endsAt)}` : `Disponible hasta ${new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' }).format(new Date(listing.endsAt))}`}</span>
      </div>
      <div className="produce-heading"><span className={`produce-icon produce-${listing.product.toLowerCase().replaceAll(' ', '-')}`} /> <div><p>{listing.variety} · {listing.quality}</p><h3>{listing.product}</h3></div></div>
      <div className="seller-line"><span className="verified-dot">✓</span><div><strong>{listing.seller.displayName}</strong><small>{listing.seller.location} · {listing.seller.rating.toFixed(1)} ★ · {listing.seller.operations} operaciones</small></div></div>
      <div className="listing-price"><span>{listing.side === 'BUY' ? 'Precio máximo' : listing.mechanism === 'AUCTION' ? 'Mejor oferta' : 'Precio publicado'}</span><strong>{currency.format(displayPrice)}</strong><small>por {listing.unit}</small></div>
      <div className="listing-facts">
        <div><span>Disponible</span><strong>{quantity.format(listing.availableQuantity)} {listing.unit}</strong></div>
        <div><span>Lote mínimo</span><strong>{quantity.format(listing.minLot)} {listing.unit}</strong></div>
        <div><span>{listing.mechanism === 'AUCTION' ? 'Pujas' : 'Entrega'}</span><strong>{listing.mechanism === 'AUCTION' ? listing.bidCount : listing.availability}</strong></div>
      </div>
      <button className="card-action" onClick={() => onOpen(listing)}>{listing.side === 'BUY' ? 'Revisar demanda' : listing.mechanism === 'AUCTION' ? 'Participar en subasta' : 'Comprar ahora'} <span>→</span></button>
    </article>
  );
}

function ListingDialog({ listing, onClose, onComplete, live, user }: { listing: Listing; onClose: () => void; onComplete: (activity: Activity) => void; live: boolean; user: User | null }) {
  const base = listing.mechanism === 'AUCTION' ? (listing.currentPrice ?? listing.price) + (listing.bidIncrement ?? 1) : listing.price;
  const [bidPrice, setBidPrice] = useState(base);
  const [amount, setAmount] = useState(listing.minLot);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');

  async function submit() {
    setWorking(true); setMessage('');
    try {
      if (live && !user) throw new Error('Debe ingresar para realizar esta operación.');
      if (listing.mechanism === 'AUCTION') {
        if (live) await placeBid(listing.id, bidPrice, amount);
        setMessage('Oferta ingresada. Quedó registrada como una puja vinculante.');
      } else if (listing.mechanism === 'FIXED') {
        if (live) await buyNow(listing.id, amount);
        setMessage('Cantidad reservada. La operación fue creada correctamente.');
      } else {
        if (live) await supplyBuyOrder(listing.id, amount);
        setMessage('Interés registrado. El comprador recibirá la propuesta de abastecimiento.');
      }
      onComplete({ id: `OP-${Math.floor(1100 + Math.random() * 800)}`, side: listing.side === 'BUY' ? 'SELL' : 'BUY', product: `${listing.product} ${listing.variety}`, counterparty: listing.seller.displayName, quantity: amount, unit: listing.unit, total: amount * (listing.mechanism === 'AUCTION' ? bidPrice : listing.price), status: listing.mechanism === 'AUCTION' ? 'Adjudicada' : 'Pago por confirmar', updatedAt: 'Ahora' });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No fue posible registrar la operación.'); }
    finally { setWorking(false); }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="listing-dialog" role="dialog" aria-modal="true" aria-label={`Detalle de ${listing.product}`} onMouseDown={(event) => event.stopPropagation()}>
    <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
    <p className="eyebrow">{sideLabel(listing)} · {mechanismLabel(listing)}</p>
    <h2>{listing.product} <em>{listing.variety}</em></h2>
    <div className="dialog-grid">
      <div className="dialog-main">
        <p className="listing-description">{listing.description}</p>
        <dl className="spec-list">
          <div><dt>Calidad</dt><dd>{listing.quality}</dd></div><div><dt>Unidad</dt><dd>{listing.unit}</dd></div>
          <div><dt>Zona</dt><dd>{listing.comuna}, {listing.region}</dd></div><div><dt>Disponibilidad</dt><dd>{listing.availability}</dd></div>
          <div><dt>Cantidad</dt><dd>{quantity.format(listing.availableQuantity)} {listing.unit}</dd></div><div><dt>Adjudicación parcial</dt><dd>{listing.partialFills ? 'Permitida' : 'No permitida'}</dd></div>
        </dl>
        <a className="odepa-link" href="https://joacolk-maker.github.io/campo-claro-odepa/" target="_blank" rel="noreferrer">Consultar referencia ODEPA ↗</a>
        <article className="seller-profile"><div className="avatar">{listing.seller.displayName.slice(0, 2).toUpperCase()}</div><div><span className="profile-tier">{listing.seller.tier}</span><h3>{listing.seller.displayName} <i>✓</i></h3><p>{listing.seller.location} · Identidad verificada</p><div className="score-row"><span><strong>{listing.seller.rating.toFixed(1)}</strong> reputación</span><span><strong>{listing.seller.completionRate}%</strong> cumplimiento</span><span><strong>{listing.seller.qualityScore}%</strong> conformidad</span></div></div></article>
      </div>
      <aside className="transaction-box">
        <span>{listing.mechanism === 'AUCTION' ? 'Mejor precio actual' : listing.side === 'BUY' ? 'Precio máximo comprador' : 'Precio de compra'}</span>
        <strong>{currency.format(listing.mechanism === 'AUCTION' ? listing.currentPrice ?? listing.price : listing.price)}</strong><small>por {listing.unit}</small>
        {listing.mechanism === 'AUCTION' && <label>Su oferta por unidad<input type="number" min={base} step={listing.bidIncrement ?? 1} value={bidPrice} onChange={(event) => setBidPrice(Number(event.target.value))} /></label>}
        <label>Cantidad<input type="number" min={listing.minLot} step={listing.minLot} max={listing.availableQuantity} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label>
        <p>Lote mínimo: {quantity.format(listing.minLot)} {listing.unit}. Valor estimado: <b>{currency.format(amount * (listing.mechanism === 'AUCTION' ? bidPrice : listing.price))}</b>.</p>
        <button disabled={working || amount < listing.minLot} onClick={submit}>{working ? 'Registrando…' : listing.mechanism === 'AUCTION' ? 'Ingresar oferta vinculante' : listing.side === 'BUY' ? 'Ofrecer abastecimiento' : 'Reservar compra'} <span>→</span></button>
        {message && <div className="transaction-message">{message}</div>}
        <small className="terms-note">Al continuar acepta las condiciones, cantidad y precio indicados. La identidad completa se comparte sólo al adjudicar.</small>
      </aside>
    </div>
  </section></div>;
}

type Draft = { side: 'SELL' | 'BUY'; mechanism: 'FIXED' | 'AUCTION' | 'BUY_ORDER'; product: string; variety: string; quality: string; unit: string; region: string; comuna: string; totalQuantity: number; minLot: number; price: number; bidIncrement: number; durationHours: number; description: string; availability: string; availabilityMode: 'NOW' | 'FUTURE'; fulfillmentDate: string };
const EMPTY_DRAFT: Draft = { side: 'SELL', mechanism: 'FIXED', product: '', variety: '', quality: '', unit: '', region: 'Región Metropolitana', comuna: '', totalQuantity: 1000, minLot: 100, price: 0, bidIncrement: 10, durationHours: 336, description: '', availability: '', availabilityMode: 'NOW', fulfillmentDate: '' };
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
const displayDate = (value: string) => new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));

function PublishDialog({ onClose, onCreated, live, user }: { onClose: () => void; onCreated: (listing: Listing) => void; live: boolean; user: User | null }) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT); const [message, setMessage] = useState(''); const [working, setWorking] = useState(false);
  const [catalog, setCatalog] = useState(fallbackCatalog); const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  useEffect(() => { let active = true; void loadMarketCatalog().then((data) => { if (active) { setCatalog(data); setCatalogState('ready'); } }).catch(() => { if (active) setCatalogState('fallback'); }); return () => { active = false; }; }, []);
  const varietyOptions = draft.product ? Object.keys(catalog[draft.product] ?? {}) : [];
  const qualityOptions = draft.product && draft.variety ? catalog[draft.product]?.[draft.variety] ?? [] : [];
  const durationOptions = draft.mechanism === 'AUCTION'
    ? [[24, '24 horas'], [48, '48 horas'], [72, '72 horas'], [168, '7 días']] as const
    : draft.side === 'BUY'
      ? [[168, '7 días'], [336, '14 días'], [720, '30 días']] as const
      : [[168, '7 días'], [336, '14 días'], [720, '30 días'], [1080, '45 días']] as const;
  const dateRequired = draft.side === 'BUY' || draft.availabilityMode === 'FUTURE';
  async function submit(event: FormEvent) {
    event.preventDefault(); setWorking(true); setMessage('');
    try {
      if (live && !user) throw new Error('Debe ingresar antes de publicar.');
      if (!draft.product || !draft.variety || !draft.quality) throw new Error('Seleccione producto, variedad y calidad.');
      if (dateRequired && !draft.fulfillmentDate) throw new Error('Indique la fecha estimada.');
      const endsAt = new Date(Date.now() + draft.durationHours * 3_600_000).toISOString();
      const timing = draft.side === 'BUY' ? `Entrega requerida: ${displayDate(draft.fulfillmentDate)}` : draft.availabilityMode === 'NOW' ? 'Disponible ahora' : `Cosecha estimada: ${displayDate(draft.fulfillmentDate)}`;
      const availability = [timing, draft.availability.trim()].filter(Boolean).join(' · ');
      const id = live ? String(await publishListing({ ...draft, availability, endsAt })) : `demo-${Date.now()}`;
      onCreated({ id, side: draft.side, mechanism: draft.side === 'BUY' ? 'BUY_ORDER' : draft.mechanism, product: draft.product, variety: draft.variety, quality: draft.quality, unit: draft.unit, region: draft.region, comuna: draft.comuna || 'Comuna por confirmar', totalQuantity: draft.totalQuantity, availableQuantity: draft.totalQuantity, minLot: draft.minLot, price: draft.price, currentPrice: draft.mechanism === 'AUCTION' ? draft.price : undefined, bidIncrement: draft.mechanism === 'AUCTION' ? draft.bidIncrement : undefined, bidCount: 0, endsAt, availability, description: draft.description || 'Publicación ingresada por un usuario verificado.', partialFills: true, status: 'ACTIVE', seller: { id: user?.id ?? 'demo-user', displayName: draft.side === 'BUY' ? 'Comprador piloto' : 'Productor piloto', location: `${draft.comuna || 'Comuna'}, ${draft.region}`, verified: true, rating: 5, operations: 0, completionRate: 100, qualityScore: 100, tier: 'Verificado' } });
      setMessage('Publicación creada correctamente.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No fue posible publicar.'); }
    finally { setWorking(false); }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><form className="publish-dialog" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={onClose}>×</button><p className="eyebrow">Nueva publicación</p><h2>Publique una <em>oferta o demanda.</em></h2>
    <div className="publish-side"><button type="button" className={draft.side === 'SELL' ? 'active' : ''} onClick={() => setDraft((current) => ({ ...current, side: 'SELL', mechanism: 'FIXED', durationHours: 336 }))}>Quiero vender</button><button type="button" className={draft.side === 'BUY' ? 'active' : ''} onClick={() => setDraft((current) => ({ ...current, side: 'BUY', mechanism: 'BUY_ORDER', durationHours: 336, fulfillmentDate: '' }))}>Quiero comprar</button></div>
    <div className="publish-grid">
      <label>Producto<select required value={draft.product} onChange={(e) => setDraft((current) => ({ ...current, product: e.target.value, variety: '', quality: '' }))}><option value="">Seleccione producto</option>{PRODUCTS.map((item) => <option key={item}>{item}</option>)}</select><small>{catalogState === 'loading' ? 'Cargando catálogo ODEPA…' : catalogState === 'fallback' ? 'Catálogo básico disponible' : 'Catálogo ODEPA actualizado'}</small></label>
      <label>Variedad<select required disabled={!draft.product} value={draft.variety} onChange={(e) => setDraft((current) => ({ ...current, variety: e.target.value, quality: '' }))}><option value="">{draft.product ? 'Seleccione variedad' : 'Primero seleccione producto'}</option>{varietyOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Calidad<select required disabled={!draft.variety} value={draft.quality} onChange={(e) => set('quality', e.target.value)}><option value="">{draft.variety ? 'Seleccione calidad' : 'Primero seleccione variedad'}</option>{qualityOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Unidad<input required value={draft.unit} onChange={(e) => set('unit', e.target.value)} placeholder="Ej. malla 20 kg" /></label>
      <label>Región<select value={draft.region} onChange={(e) => set('region', e.target.value)}>{REGIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Comuna<input required value={draft.comuna} onChange={(e) => set('comuna', e.target.value)} /></label>
      <label>Cantidad total<input type="number" min="1" value={draft.totalQuantity} onChange={(e) => set('totalQuantity', Number(e.target.value))} /></label>
      <label>Lote mínimo<input type="number" min="1" value={draft.minLot} onChange={(e) => set('minLot', Number(e.target.value))} /></label>
      {draft.side === 'SELL' && <label>Modalidad<select value={draft.mechanism} onChange={(e) => { const mechanism = e.target.value as Draft['mechanism']; setDraft((current) => ({ ...current, mechanism, durationHours: mechanism === 'AUCTION' ? 48 : 336 })); }}><option value="FIXED">Compra inmediata</option><option value="AUCTION">Subasta abierta</option></select></label>}
      <label>{draft.side === 'BUY' ? 'Precio máximo' : draft.mechanism === 'AUCTION' ? 'Precio inicial' : 'Precio publicado'}<input type="number" min="1" value={draft.price || ''} onChange={(e) => set('price', Number(e.target.value))} /></label>
      {draft.mechanism === 'AUCTION' && <label>Incremento mínimo<input type="number" min="1" value={draft.bidIncrement} onChange={(e) => set('bidIncrement', Number(e.target.value))} /></label>}
      <label>{draft.mechanism === 'AUCTION' ? 'Duración de subasta' : 'Vigencia de publicación'}<select value={draft.durationHours} onChange={(e) => set('durationHours', Number(e.target.value))}>{durationOptions.map(([hours, label]) => <option value={hours} key={hours}>{label}</option>)}</select></label>
      {draft.side === 'SELL' && <label>Disponibilidad<select value={draft.availabilityMode} onChange={(e) => setDraft((current) => ({ ...current, availabilityMode: e.target.value as Draft['availabilityMode'], fulfillmentDate: '' }))}><option value="NOW">Disponible ahora</option><option value="FUTURE">Cosecha futura</option></select></label>}
      {dateRequired && <label>{draft.side === 'SELL' ? 'Fecha estimada de cosecha' : 'Fecha requerida de entrega'}<input required type="date" min={today()} value={draft.fulfillmentDate} onChange={(e) => set('fulfillmentDate', e.target.value)} /></label>}
      <label className="wide">Condiciones de disponibilidad<input value={draft.availability} onChange={(e) => set('availability', e.target.value)} placeholder={draft.side === 'SELL' ? 'Ej. Retiro en predio, horario y ventana estimada' : 'Ej. Lugar de recepción y tolerancia de fecha'} /></label>
      <label className="wide">Descripción<textarea value={draft.description} onChange={(e) => set('description', e.target.value)} placeholder="Calibre, envase, estado, condición de retiro y tolerancias…" /></label>
    </div>
    <button className="publish-submit" disabled={working || !draft.product || !draft.variety || !draft.quality || !draft.unit || !draft.comuna || !draft.price || draft.minLot > draft.totalQuantity || (dateRequired && !draft.fulfillmentDate)}>{working ? 'Publicando…' : 'Publicar y aceptar condiciones'} <span>→</span></button>{message && <div className="transaction-message">{message}</div>}
  </form></div>;
}

type AuthMode = 'login' | 'register' | 'magic';

function LoginDialog({ onClose, user, onUserChange }: { onClose: () => void; user: User | null; onUserChange: (user: User | null) => void }) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setWorking(true); setMessage('');
    try {
      if (mode === 'magic') {
        await sendMagicLink(email);
        setMessage('Le enviamos un enlace seguro a su correo.');
      } else if (mode === 'register') {
        const authenticated = await signUpWithPassword(displayName, email, password);
        if (authenticated) {
          onUserChange(authenticated);
          setMessage('Cuenta creada. La sesión quedó iniciada.');
        } else {
          setMessage('Cuenta creada. Revise su correo una sola vez para confirmar la dirección.');
        }
      } else {
        const authenticated = await signInWithPassword(email, password);
        onUserChange(authenticated);
        setMessage('Sesión iniciada correctamente.');
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No fue posible completar el acceso.'); }
    finally { setWorking(false); }
  }

  async function closeSession() {
    setWorking(true); setMessage('');
    try { await signOut(); onUserChange(null); onClose(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No fue posible cerrar la sesión.'); setWorking(false); }
  }

  if (user) return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="login-dialog" role="dialog" aria-modal="true" aria-label="Mi cuenta" onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={onClose}>×</button><p className="eyebrow">Cuenta activa</p><h2>Mi cuenta</h2><p className="account-email">{user.email}</p><p>Su identidad y antecedentes comerciales se validan antes de habilitar operaciones vinculantes.</p><button type="button" className="auth-primary" disabled={working} onClick={closeSession}>{working ? 'Cerrando…' : 'Cerrar sesión'}</button>{message && <div className="transaction-message">{message}</div>}</section></div>;

  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><form className="login-dialog" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={onClose}>×</button><p className="eyebrow">Acceso seguro</p><h2>{mode === 'register' ? <>Cree su cuenta en <em>Campo Lindo.</em></> : <>Ingrese a <em>Campo Lindo.</em></>}</h2>
    {mode !== 'magic' && <div className="auth-tabs"><button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setMessage(''); }}>Ingresar</button><button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setMessage(''); }}>Crear cuenta</button></div>}
    {mode === 'register' && <label>Nombre o razón social<input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nombre comercial" /></label>}
    <label>Correo electrónico<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@empresa.cl" /></label>
    {mode !== 'magic' && <label>Contraseña<input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" /></label>}
    <button className="auth-primary" disabled={working}>{working ? 'Procesando…' : mode === 'register' ? 'Crear cuenta' : mode === 'magic' ? 'Enviar enlace de acceso' : 'Ingresar'} <span>→</span></button>
    <button type="button" className="magic-option" onClick={() => { setMode(mode === 'magic' ? 'login' : 'magic'); setMessage(''); }}>{mode === 'magic' ? 'Volver al acceso con contraseña' : 'Prefiero recibir un enlace por correo'}</button>
    <p className="verification-note">Para ofertar o publicar, el perfil deberá estar verificado.</p>{message && <div className="transaction-message">{message}</div>}
  </form></div>;
}

export default function Home() {
  const [listings, setListings] = useState<Listing[]>(DEMO_LISTINGS); const [source, setSource] = useState<'loading' | 'live' | 'demo'>('loading');
  const [user, setUser] = useState<User | null>(null); const [modal, setModal] = useState<Modal>(null); const [selected, setSelected] = useState<Listing | null>(null);
  const [product, setProduct] = useState('Todos los productos'); const [region, setRegion] = useState('Todas las regiones'); const [marketSide, setMarketSide] = useState<'ALL' | 'SELL' | 'BUY'>('ALL'); const [mode, setMode] = useState('Todas las modalidades');
  const [activities, setActivities] = useState<Activity[]>(DEMO_ACTIVITY); const [, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([loadListings(), currentUser()]).then(([data, authenticated]) => {
      if (!active) return;
      setListings(data); setSource('live'); setUser(authenticated); setActivities([]);
      if (authenticated) void loadActivities(authenticated.id).then((items) => { if (active) setActivities(items); }).catch(() => undefined);
    }).catch(() => { if (active) setSource('demo'); });
    return () => { active = false; };
  }, []);
  useEffect(() => { const timer = window.setInterval(() => setTick((v) => v + 1), 60_000); return () => window.clearInterval(timer); }, []);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await context.registerTool({
        name: 'search_market',
        title: 'Buscar en el mercado',
        description: 'Filtra las publicaciones visibles por producto, región, lado y modalidad.',
        inputSchema: {
          type: 'object',
          properties: {
            product: { type: 'string', enum: PRODUCTS },
            region: { type: 'string', enum: REGIONS },
            side: { type: 'string', enum: ['ALL', 'SELL', 'BUY'] },
            mechanism: { type: 'string', enum: ['ALL', 'FIXED', 'AUCTION', 'BUY_ORDER'] },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute(input) {
          const request = (input ?? {}) as { product?: string; region?: string; side?: 'ALL' | 'SELL' | 'BUY'; mechanism?: 'ALL' | 'FIXED' | 'AUCTION' | 'BUY_ORDER' };
          const nextProduct = request.product && (PRODUCTS as readonly string[]).includes(request.product) ? request.product : 'Todos los productos';
          const nextRegion = request.region && (REGIONS as readonly string[]).includes(request.region) ? request.region : 'Todas las regiones';
          const nextSide = request.side ?? 'ALL';
          const nextMode = !request.mechanism || request.mechanism === 'ALL' ? 'Todas las modalidades' : request.mechanism;
          setProduct(nextProduct); setRegion(nextRegion); setMarketSide(nextSide); setMode(nextMode);
          window.location.hash = 'mercado';
          const count = listings.filter((item) => (nextProduct === 'Todos los productos' || item.product === nextProduct) && (nextRegion === 'Todas las regiones' || item.region === nextRegion) && (nextSide === 'ALL' || item.side === nextSide) && (nextMode === 'Todas las modalidades' || item.mechanism === nextMode)).length;
          return { visibleListings: count, product: nextProduct, region: nextRegion, side: nextSide, mechanism: nextMode };
        },
      }, { signal: lifecycle.signal });
      await context.registerTool({
        name: 'start_listing_publication',
        title: 'Iniciar publicación',
        description: 'Abre el formulario visible para preparar una nueva oferta o demanda; no publica ni compromete una operación.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute() { setModal('publish'); return { opened: true, submitted: false }; },
      }, { signal: lifecycle.signal });
    };
    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, [listings]);

  const filtered = useMemo(() => listings.filter((item) => (product === 'Todos los productos' || item.product === product) && (region === 'Todas las regiones' || item.region === region) && (marketSide === 'ALL' || item.side === marketSide) && (mode === 'Todas las modalidades' || item.mechanism === mode)), [listings, product, region, marketSide, mode]);
  const stats = useMemo(() => ({ offers: listings.filter((item) => item.side === 'SELL').length, demand: listings.filter((item) => item.side === 'BUY').length, auctions: listings.filter((item) => item.mechanism === 'AUCTION').length }), [listings]);
  function openListing(item: Listing) { setSelected(item); setModal('listing'); }

  return <main>
    <header className="topbar"><a className="brand" href="#inicio"><span className="brand-mark"><i /></span><span>Campo Lindo <b>Transaccional</b></span></a><nav><a className="active" href="#mercado">Mercado</a><a href="#funciona">Cómo funciona</a><a href="#actividad">Mi actividad</a></nav><a className="analytics-link" href="https://joacolk-maker.github.io/campo-claro-odepa/" target="_blank" rel="noreferrer">Referencia ODEPA ↗</a><button className="login-button" onClick={() => setModal('login')}>{user ? 'Mi cuenta' : 'Ingresar'}</button></header>
    <section className="hero" id="inicio"><div><p className="eyebrow">Mercado agrícola · Chile</p><h1>Compre y venda con <em>reglas claras.</em></h1><p className="hero-copy">Ofertas reales, subastas abiertas y órdenes de compra para frutas y hortalizas. Cada precio, cantidad y compromiso queda registrado.</p><div className="hero-actions"><button onClick={() => setModal('publish')}>Publicar oferta o demanda <span>→</span></button><a href="#mercado">Explorar mercado</a></div></div><aside className="market-summary"><p>Mercado activo</p><div><strong>{stats.offers}</strong><span>ofertas disponibles</span></div><div><strong>{stats.demand}</strong><span>órdenes de compra</span></div><div><strong>{stats.auctions}</strong><span>subastas abiertas</span></div><small><i /> {source === 'live' ? 'Conectado a Supabase' : source === 'loading' ? 'Conectando…' : 'Vista demostrativa del piloto'}</small></aside></section>
    <section className="market-section" id="mercado"><div className="section-intro"><div><p className="eyebrow">Libro de mercado</p><h2>Oferta y demanda <em>en un solo lugar.</em></h2></div><button onClick={() => setModal('publish')}>+ Nueva publicación</button></div>
      <div className="filters"><label>Producto<select value={product} onChange={(e) => setProduct(e.target.value)}><option>Todos los productos</option>{PRODUCTS.map((item) => <option key={item}>{item}</option>)}</select></label><label>Región<select value={region} onChange={(e) => setRegion(e.target.value)}><option>Todas las regiones</option>{REGIONS.map((item) => <option key={item}>{item}</option>)}</select></label><label>Modalidad<select value={mode} onChange={(e) => setMode(e.target.value)}><option>Todas las modalidades</option><option value="FIXED">Compra inmediata</option><option value="AUCTION">Subasta abierta</option><option value="BUY_ORDER">Orden de compra</option></select></label><div className="side-filter"><button className={marketSide === 'ALL' ? 'active' : ''} onClick={() => setMarketSide('ALL')}>Todo</button><button className={marketSide === 'SELL' ? 'active' : ''} onClick={() => setMarketSide('SELL')}>Venden</button><button className={marketSide === 'BUY' ? 'active' : ''} onClick={() => setMarketSide('BUY')}>Compran</button></div></div>
      <div className="market-count"><span>{filtered.length} publicaciones</span><small>Precios expresados exclusivamente en la unidad indicada</small></div>
      <div className="listings-grid">{filtered.map((item) => <ListingCard key={item.id} listing={item} onOpen={openListing} />)}{!filtered.length && <div className="no-results"><strong>No hay publicaciones para estos filtros.</strong><span>Pruebe otra región, producto o modalidad.</span></div>}</div>
    </section>
    <section className="trust-section" id="funciona"><div className="trust-heading"><p className="eyebrow">Cómo funciona</p><h2>Una operación completa, <em>no sólo un contacto.</em></h2></div><div className="steps"><article><span>01</span><h3>Publicación verificable</h3><p>Producto, calidad, unidad, ubicación general, cantidad, lote mínimo y condiciones quedan definidos.</p></article><article><span>02</span><h3>Precio y adjudicación</h3><p>Compra inmediata, subasta o demanda. Las pujas se ordenan por precio y luego por hora.</p></article><article><span>03</span><h3>Operación registrada</h3><p>Al cerrar se crea una orden con contraparte, precio, cantidad, fecha y obligaciones aceptadas.</p></article><article><span>04</span><h3>Entrega y reputación</h3><p>Las partes confirman retiro o entrega, adjuntan evidencia y construyen su historial comercial.</p></article></div></section>
    <section className="activity-section" id="actividad"><div className="activity-heading"><div><p className="eyebrow">Panel transaccional</p><h2>Mis operaciones</h2></div><button onClick={() => setModal('activity')}>Ver historial completo</button></div><div className="activity-table"><div className="activity-row activity-header"><span>Operación</span><span>Producto</span><span>Contraparte</span><span>Valor</span><span>Estado</span></div>{activities.slice(0, 3).map((item) => <div className="activity-row" key={item.id}><strong>{item.id}<small>{item.updatedAt}</small></strong><span>{item.product}<small>{quantity.format(item.quantity)} {item.unit}</small></span><span>{item.counterparty}</span><b>{currency.format(item.total)}</b><i className={`status status-${item.status.toLowerCase().replaceAll(' ', '-')}`}>{item.status}</i></div>)}{!activities.length && <div className="activity-empty">{source === 'live' && !user ? 'Ingrese para ver sus operaciones reales.' : 'Aún no registra operaciones.'}</div>}</div></section>
    <footer><div className="brand"><span className="brand-mark"><i /></span><span>Campo Lindo Transaccional</span></div><p>Piloto experimental · Información ODEPA utilizada únicamente como referencia de mercado.</p></footer>
    {modal === 'listing' && selected && <ListingDialog listing={selected} onClose={() => setModal(null)} live={source === 'live'} user={user} onComplete={(activity) => setActivities((current) => [activity, ...current])} />}
    {modal === 'publish' && <PublishDialog onClose={() => setModal(null)} live={source === 'live'} user={user} onCreated={(listing) => { setListings((current) => [listing, ...current]); setModal(null); }} />}
    {modal === 'login' && <LoginDialog onClose={() => setModal(null)} user={user} onUserChange={setUser} />}
    {modal === 'activity' && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><section className="history-dialog" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setModal(null)}>×</button><p className="eyebrow">Trazabilidad</p><h2>Historial de operaciones</h2>{activities.map((item) => <div className="history-row" key={item.id}><div><strong>{item.id} · {item.product}</strong><span>{item.counterparty} · {item.updatedAt}</span></div><div><b>{currency.format(item.total)}</b><i className="status">{item.status}</i></div></div>)}{!activities.length && <div className="history-empty">{source === 'live' && !user ? 'Ingrese para consultar su historial.' : 'Aún no hay operaciones registradas.'}</div>}</section></div>}
  </main>;
}
