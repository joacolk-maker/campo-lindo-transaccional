'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { currentUser, loadAdminSnapshot, loadMarketAccess, setListingStatus, setProfileVerification, type AdminSnapshot } from '@/lib/market-api';
import type { MarketAccess } from '@/lib/market';
import { currency, quantity } from '@/lib/market';
import styles from './admin.module.css';

type Tab = 'overview' | 'orders' | 'users' | 'bids' | 'trades';
const emptySnapshot: AdminSnapshot = { generated_at: '', profiles: [], listings: [], bids: [], trades: [], events: [] };
const previewSnapshot: AdminSnapshot = {
  generated_at: '2026-10-08T22:00:00Z',
  profiles: [
    { id: '11111111-1111-1111-1111-111111111111', display_name: 'Agrícola Santa María', email: 'operaciones@agricola.cl', account_type: 'SELLER', region: 'Región Metropolitana', comuna: 'Melipilla', verified: true, verification_status: 'VERIFIED', tier: 'Confiable', rating: 4.8, operations: 38, completion_rate: 97, quality_score: 95, created_at: '2026-09-20T14:00:00Z' },
    { id: '22222222-2222-2222-2222-222222222222', display_name: 'Distribuidora Central', email: 'compras@distribuidora.cl', account_type: 'BUYER', region: 'Región Metropolitana', comuna: 'Santiago', verified: false, verification_status: 'IN_REVIEW', tier: 'Nuevo', rating: 0, operations: 0, completion_rate: 0, quality_score: 0, created_at: '2026-10-08T18:00:00Z' },
  ],
  listings: [
    { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', owner_id: '11111111-1111-1111-1111-111111111111', owner_name: 'Agrícola Santa María', side: 'SELL', mechanism: 'AUCTION', product: 'Papa', variety: 'Asterix', quality: 'Primera', unit: 'kg', region: 'Región Metropolitana', comuna: 'Melipilla', total_quantity: 18000, available_quantity: 18000, min_lot: 2000, price: 520, current_price: 565, bid_count: 7, partial_fills: true, fulfillment_date: '2026-10-15', ends_at: '2026-10-12T18:00:00Z', status: 'ACTIVE', created_at: '2026-10-08T16:00:00Z' },
    { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', owner_id: '22222222-2222-2222-2222-222222222222', owner_name: 'Distribuidora Central', side: 'BUY', mechanism: 'BUY_ORDER', product: 'Cebolla', variety: 'Valenciana', quality: 'Primera', unit: 'malla 20 kg', region: 'Región Metropolitana', comuna: 'Santiago', total_quantity: 400, available_quantity: 400, min_lot: 50, price: 11000, current_price: null, bid_count: 0, partial_fills: true, fulfillment_date: '2026-10-20', ends_at: '2026-10-22T18:00:00Z', status: 'ACTIVE', created_at: '2026-10-08T19:00:00Z' },
  ],
  bids: [{ id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', listing_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', bidder_id: '22222222-2222-2222-2222-222222222222', bidder_name: 'Distribuidora Central', product: 'Papa', unit_price: 565, quantity: 3000, allocated_quantity: 0, status: 'ACTIVE', created_at: '2026-10-08T20:00:00Z' }],
  trades: [{ id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', listing_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', seller_id: '11111111-1111-1111-1111-111111111111', seller_name: 'Agrícola Santa María', buyer_id: '22222222-2222-2222-2222-222222222222', buyer_name: 'Distribuidora Central', product: 'Papa', variety: 'Asterix', mechanism: 'FIXED', quantity: 2500, unit: 'kg', unit_price: 540, total_value: 1350000, status: 'PAYMENT_PENDING', guarantee_status: 'NOT_ENABLED', created_at: '2026-10-07T18:00:00Z', updated_at: '2026-10-08T12:00:00Z' }],
  events: [],
};
const when = (value: string) => new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
const statusLabel: Record<string, string> = { ACTIVE: 'Activa', SOLD: 'Cerrada', EXPIRED: 'Vencida', CANCELLED: 'Cancelada', DRAFT: 'Borrador', RESERVED: 'Reservada', PENDING: 'Pendiente', IN_REVIEW: 'En revisión', VERIFIED: 'Verificado', REJECTED: 'Rechazado', SUSPENDED: 'Suspendido', WON: 'Ganadora', PARTIAL: 'Parcial', LOST: 'No adjudicada', OUTBID: 'Superada', AWARDED: 'Adjudicada', PAYMENT_PENDING: 'Pago pendiente', PAYMENT_CONFIRMED: 'Pago confirmado', READY: 'Lista para retiro', DELIVERED: 'Entregada', ACCEPTED: 'Aceptada', DISPUTED: 'En disputa' };

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [access, setAccess] = useState<MarketAccess | null>(null);
  const [snapshot, setSnapshot] = useState<AdminSnapshot>(emptySnapshot);
  const [tab, setTab] = useState<Tab>('overview');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState('');

  async function refresh() {
    const data = await loadAdminSnapshot();
    setSnapshot(data);
  }

  useEffect(() => {
    let active = true;
    if (location.hostname === '127.0.0.1' && new URLSearchParams(location.search).get('preview') === '1') {
      Promise.resolve().then(() => {
        if (!active) return;
        setUser({ id: 'preview-admin', email: 'admin@campolindo.cl' } as User);
        setAccess({ id: 'preview-admin', displayName: 'Administrador Campo Lindo', verified: true, verificationStatus: 'VERIFIED', isAdmin: true });
        setSnapshot(previewSnapshot);
        setLoading(false);
      });
      return () => { active = false; };
    }
    currentUser().then(async (authenticated) => {
      if (!active) return;
      setUser(authenticated);
      if (!authenticated) return;
      const marketAccess = await loadMarketAccess();
      if (!active) return;
      setAccess(marketAccess);
      if (marketAccess?.isAdmin) {
        const data = await loadAdminSnapshot();
        if (active) setSnapshot(data);
      }
    }).catch((cause) => setMessage(cause instanceof Error ? cause.message : 'No fue posible cargar el mantenedor.')).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const listings = useMemo(() => snapshot.listings.filter((item) => `${item.product} ${item.variety} ${item.owner_name} ${item.comuna} ${item.id}`.toLowerCase().includes(query.toLowerCase())), [snapshot.listings, query]);
  const profiles = useMemo(() => snapshot.profiles.filter((item) => `${item.display_name} ${item.email ?? ''} ${item.region} ${item.comuna}`.toLowerCase().includes(query.toLowerCase())), [snapshot.profiles, query]);
  const bids = useMemo(() => snapshot.bids.filter((item) => `${item.product} ${item.bidder_name} ${item.id}`.toLowerCase().includes(query.toLowerCase())), [snapshot.bids, query]);
  const trades = useMemo(() => snapshot.trades.filter((item) => `${item.product} ${item.seller_name} ${item.buyer_name} ${item.id}`.toLowerCase().includes(query.toLowerCase())), [snapshot.trades, query]);
  const activeListings = snapshot.listings.filter((item) => item.status === 'ACTIVE');
  const supplyValue = activeListings.filter((item) => item.side === 'SELL').reduce((sum, item) => sum + Number(item.available_quantity) * Number(item.price), 0);
  const demandValue = activeListings.filter((item) => item.side === 'BUY').reduce((sum, item) => sum + Number(item.available_quantity) * Number(item.price), 0);
  const tradedValue = snapshot.trades.reduce((sum, item) => sum + Number(item.total_value), 0);

  async function changeVerification(profileId: string, status: MarketAccess['verificationStatus']) {
    const action = status === 'VERIFIED' ? 'verificar' : status === 'SUSPENDED' ? 'suspender' : 'cambiar el estado de';
    if (!window.confirm(`¿Confirma ${action} este usuario? La acción quedará auditada.`)) return;
    setWorking(profileId); setMessage('');
    try { await setProfileVerification(profileId, status, 'Actualización desde el mantenedor'); await refresh(); setMessage('Estado del usuario actualizado y registrado.'); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'No fue posible actualizar el usuario.'); }
    finally { setWorking(''); }
  }

  async function changeListing(listingId: string, status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED') {
    if (!window.confirm(`¿Confirma cambiar esta publicación a ${statusLabel[status]}? La acción quedará auditada.`)) return;
    setWorking(listingId); setMessage('');
    try { await setListingStatus(listingId, status, 'Actualización desde el mantenedor'); await refresh(); setMessage('Estado de la publicación actualizado y registrado.'); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'No fue posible actualizar la publicación.'); }
    finally { setWorking(''); }
  }

  if (loading) return <main className={styles.gate}><i /><h1>Abriendo el mantenedor…</h1></main>;
  if (!user) return <main className={styles.gate}><span>CL</span><p>ACCESO PROTEGIDO</p><h1>Ingrese con la cuenta administradora de Campo Lindo.</h1><Link href="/">Volver al mercado e ingresar</Link></main>;
  if (!access?.isAdmin) return <main className={styles.gate}><span>!</span><p>ACCESO RESTRINGIDO</p><h1>Esta cuenta no tiene permisos de administrador.</h1><small>El mantenedor nunca utiliza una clave secreta en el navegador. El permiso debe asignarse directamente en Supabase.</small><Link href="/cuenta">Volver a mi cuenta</Link></main>;

  return <main className={styles.app}>
    <aside className={styles.sidebar}>
      <Link className={styles.brand} href="/"><span>CL</span><div><strong>Campo Lindo</strong><small>Mantenedor</small></div></Link>
      <nav>
        <button className={tab === 'overview' ? styles.active : ''} onClick={() => setTab('overview')}><i>⌂</i>Resumen</button>
        <button className={tab === 'orders' ? styles.active : ''} onClick={() => setTab('orders')}><i>⇅</i>Órdenes <b>{snapshot.listings.length}</b></button>
        <button className={tab === 'users' ? styles.active : ''} onClick={() => setTab('users')}><i>◎</i>Usuarios <b>{snapshot.profiles.length}</b></button>
        <button className={tab === 'bids' ? styles.active : ''} onClick={() => setTab('bids')}><i>↗</i>Pujas <b>{snapshot.bids.length}</b></button>
        <button className={tab === 'trades' ? styles.active : ''} onClick={() => setTab('trades')}><i>✓</i>Operaciones <b>{snapshot.trades.length}</b></button>
      </nav>
      <div className={styles.sidebarFoot}><span>{access.displayName.slice(0, 2).toUpperCase()}</span><div><strong>{access.displayName}</strong><small>Administrador</small></div><Link href="/cuenta">↗</Link></div>
    </aside>

    <section className={styles.main}>
      <header className={styles.topbar}><div><p>CONTROL OPERACIONAL</p><h1>{tab === 'overview' ? 'Resumen del mercado' : tab === 'orders' ? 'Órdenes de compra y venta' : tab === 'users' ? 'Participantes y verificación' : tab === 'bids' ? 'Libro consolidado de pujas' : 'Operaciones adjudicadas'}</h1></div><div><span><i /> Base en línea</span><button onClick={() => void refresh()}>Actualizar</button></div></header>
      {message && <div className={styles.message}>{message}<button onClick={() => setMessage('')}>×</button></div>}

      {tab === 'overview' && <>
        <section className={styles.metrics}>
          <Metric label="Oferta activa" value={currency.format(supplyValue)} note={`${activeListings.filter((item) => item.side === 'SELL').length} publicaciones`} tone="green" />
          <Metric label="Demanda activa" value={currency.format(demandValue)} note={`${activeListings.filter((item) => item.side === 'BUY').length} órdenes`} tone="blue" />
          <Metric label="Valor operado" value={currency.format(tradedValue)} note={`${snapshot.trades.length} operaciones`} tone="gold" />
          <Metric label="Por verificar" value={String(snapshot.profiles.filter((item) => !item.verified).length)} note="participantes pendientes" tone="red" />
        </section>
        <section className={styles.overviewGrid}>
          <article className={styles.panel}><PanelHead label="MERCADO ABIERTO" title="Últimas órdenes" action={() => setTab('orders')} /><div className={styles.miniList}>{snapshot.listings.slice(0, 6).map((item) => <div key={item.id}><i className={item.side === 'BUY' ? styles.buy : styles.sell}>{item.side === 'BUY' ? 'C' : 'V'}</i><span><strong>{item.product} · {item.variety}</strong><small>{item.owner_name} · {when(item.created_at)}</small></span><b>{currency.format(Number(item.price))}</b><em>{statusLabel[item.status]}</em></div>)}{!snapshot.listings.length && <Empty text="No hay órdenes registradas." />}</div></article>
          <article className={styles.panel}><PanelHead label="GESTIÓN DE RIESGO" title="Usuarios pendientes" action={() => setTab('users')} /><div className={styles.miniList}>{snapshot.profiles.filter((item) => !item.verified).slice(0, 6).map((item) => <div key={item.id}><i className={styles.avatar}>{item.display_name.slice(0, 2).toUpperCase()}</i><span><strong>{item.display_name}</strong><small>{item.email ?? 'Sin correo'} · {item.comuna || 'Ubicación pendiente'}</small></span><em>{statusLabel[item.verification_status]}</em></div>)}{!snapshot.profiles.filter((item) => !item.verified).length && <Empty text="No hay verificaciones pendientes." />}</div></article>
        </section>
        <section className={styles.flow}><div><p>EMBUDO OPERACIONAL</p><h2>Del interés al cumplimiento</h2></div>{[['Publicaciones',snapshot.listings.length],['Pujas',snapshot.bids.length],['Adjudicaciones',snapshot.trades.length],['Aceptadas',snapshot.trades.filter((item)=>item.status==='ACCEPTED').length]].map(([label,value], index)=><article key={String(label)}><span>0{index+1}</span><strong>{value}</strong><small>{label}</small></article>)}</section>
      </>}

      {tab !== 'overview' && <section className={styles.dataPanel}>
        <div className={styles.toolbar}><label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por usuario, producto, comuna o identificador" /></label><small>Actualizado {snapshot.generated_at ? when(snapshot.generated_at) : '—'}</small></div>

        {tab === 'orders' && <div className={styles.table}><div className={`${styles.tableRow} ${styles.orders} ${styles.tableHead}`}><span>Orden</span><span>Participante</span><span>Producto</span><span>Lado</span><span>Volumen</span><span>Precio</span><span>Estado</span><span>Control</span></div>{listings.map((item) => <div className={`${styles.tableRow} ${styles.orders}`} key={item.id}><span><strong>{item.id.slice(0,8).toUpperCase()}</strong><small>{when(item.created_at)}</small></span><span><strong>{item.owner_name}</strong><small>{item.comuna}, {item.region}</small></span><span><strong>{item.product}</strong><small>{item.variety} · {item.quality}</small></span><span><i className={item.side === 'BUY' ? styles.buy : styles.sell}>{item.side === 'BUY' ? 'Compra' : 'Venta'}</i><small>{item.mechanism}</small></span><span><strong>{quantity.format(Number(item.total_quantity))} {item.unit}</strong><small>{quantity.format(Number(item.available_quantity))} disponibles</small></span><span><strong>{currency.format(Number(item.current_price ?? item.price))}</strong><small>lote mín. {quantity.format(Number(item.min_lot))}</small></span><span><em>{statusLabel[item.status] ?? item.status}</em><small>{item.bid_count} pujas</small></span><span className={styles.actions}>{item.status === 'ACTIVE' ? <button disabled={working === item.id} onClick={() => void changeListing(item.id,'CANCELLED')}>Cancelar</button> : <button disabled={working === item.id} onClick={() => void changeListing(item.id,'ACTIVE')}>Reactivar</button>}</span></div>)}{!listings.length && <Empty text="No hay órdenes para esta búsqueda." />}</div>}

        {tab === 'users' && <div className={styles.table}><div className={`${styles.tableRow} ${styles.users} ${styles.tableHead}`}><span>Participante</span><span>Contacto</span><span>Tipo</span><span>Ubicación</span><span>Historial</span><span>Verificación</span><span>Control</span></div>{profiles.map((item) => <div className={`${styles.tableRow} ${styles.users}`} key={item.id}><span><strong>{item.display_name}</strong><small>{item.id.slice(0,8).toUpperCase()}</small></span><span><strong>{item.email ?? 'Sin correo'}</strong><small>Alta {when(item.created_at)}</small></span><span><strong>{item.account_type}</strong><small>{item.tier}</small></span><span><strong>{item.comuna || 'Pendiente'}</strong><small>{item.region || 'Sin región'}</small></span><span><strong>{item.operations} operaciones</strong><small>{Number(item.completion_rate).toFixed(0)}% cumplimiento · {Number(item.rating).toFixed(1)} ★</small></span><span><em>{statusLabel[item.verification_status]}</em></span><span className={styles.actions}>{item.verified ? <button className={styles.danger} disabled={working === item.id} onClick={() => void changeVerification(item.id,'SUSPENDED')}>Suspender</button> : <><button disabled={working === item.id} onClick={() => void changeVerification(item.id,'IN_REVIEW')}>Revisar</button><button className={styles.approve} disabled={working === item.id} onClick={() => void changeVerification(item.id,'VERIFIED')}>Verificar</button></>}</span></div>)}{!profiles.length && <Empty text="No hay usuarios para esta búsqueda." />}</div>}

        {tab === 'bids' && <div className={styles.table}><div className={`${styles.tableRow} ${styles.bids} ${styles.tableHead}`}><span>Puja</span><span>Subasta</span><span>Comprador</span><span>Precio</span><span>Cantidad</span><span>Asignado</span><span>Estado</span></div>{bids.map((item) => <div className={`${styles.tableRow} ${styles.bids}`} key={item.id}><span><strong>{item.id.slice(0,8).toUpperCase()}</strong><small>{when(item.created_at)}</small></span><span><strong>{item.product}</strong><small>{item.listing_id.slice(0,8).toUpperCase()}</small></span><span><strong>{item.bidder_name}</strong><small>{item.bidder_id.slice(0,8).toUpperCase()}</small></span><span><strong>{currency.format(Number(item.unit_price))}</strong></span><span><strong>{quantity.format(Number(item.quantity))}</strong></span><span><strong>{quantity.format(Number(item.allocated_quantity))}</strong></span><span><em>{statusLabel[item.status] ?? item.status}</em></span></div>)}{!bids.length && <Empty text="No hay pujas para esta búsqueda." />}</div>}

        {tab === 'trades' && <div className={styles.table}><div className={`${styles.tableRow} ${styles.trades} ${styles.tableHead}`}><span>Operación</span><span>Producto</span><span>Vendedor</span><span>Comprador</span><span>Cantidad</span><span>Valor</span><span>Estado</span></div>{trades.map((item) => <div className={`${styles.tableRow} ${styles.trades}`} key={item.id}><span><strong>{item.id.slice(0,8).toUpperCase()}</strong><small>{when(item.created_at)}</small></span><span><strong>{item.product}</strong><small>{item.variety} · {item.mechanism}</small></span><span><strong>{item.seller_name}</strong></span><span><strong>{item.buyer_name}</strong></span><span><strong>{quantity.format(Number(item.quantity))} {item.unit}</strong><small>{currency.format(Number(item.unit_price))} unitario</small></span><span><strong>{currency.format(Number(item.total_value))}</strong></span><span><em>{statusLabel[item.status] ?? item.status}</em><small>{item.guarantee_status}</small></span></div>)}{!trades.length && <Empty text="No hay operaciones para esta búsqueda." />}</div>}
      </section>}
    </section>
  </main>;
}

function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone: string }) { return <article className={`${styles.metric} ${styles[tone]}`}><span>{label}</span><strong>{value}</strong><small>{note}</small><i /></article>; }
function PanelHead({ label, title, action }: { label: string; title: string; action: () => void }) { return <header className={styles.panelHead}><div><p>{label}</p><h2>{title}</h2></div><button onClick={action}>Ver todo →</button></header>; }
function Empty({ text }: { text: string }) { return <div className={styles.empty}><span>◎</span><strong>{text}</strong></div>; }
