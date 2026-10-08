'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { currentUser, loadMarketAccess, loadPortfolio } from '@/lib/market-api';
import { currency, quantity, type MarketAccess, type MarketPortfolio } from '@/lib/market';
import styles from './cuenta.module.css';

const emptyPortfolio: MarketPortfolio = { listings: [], bids: [], trades: [] };
const dateTime = (value?: string) => value ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
const listingStatus: Record<string, string> = { DRAFT: 'Borrador', ACTIVE: 'Activa', RESERVED: 'Reservada', SOLD: 'Cerrada', EXPIRED: 'Vencida', CANCELLED: 'Cancelada' };
const bidStatus: Record<string, string> = { ACTIVE: 'Vigente', OUTBID: 'Superada', WON: 'Ganadora', PARTIAL: 'Parcial', LOST: 'No adjudicada', CANCELLED: 'Cancelada' };

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [access, setAccess] = useState<MarketAccess | null>(null);
  const [portfolio, setPortfolio] = useState<MarketPortfolio>(emptyPortfolio);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'orders' | 'bids' | 'trades'>('orders');

  useEffect(() => {
    let active = true;
    currentUser().then(async (authenticated) => {
      if (!active) return;
      setUser(authenticated);
      if (!authenticated) return;
      const [marketAccess, marketPortfolio] = await Promise.all([loadMarketAccess(), loadPortfolio(authenticated.id)]);
      if (!active) return;
      setAccess(marketAccess);
      setPortfolio(marketPortfolio);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : 'No fue posible cargar la cuenta.')).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const committedValue = useMemo(() => portfolio.trades.reduce((sum, item) => sum + item.total, 0), [portfolio.trades]);
  const openOrders = portfolio.listings.filter((item) => item.status === 'ACTIVE').length;

  return <main className={styles.shell}>
    <header className={styles.header}>
      <Link className={styles.brand} href="/"><span>CL</span><div><strong>Campo Lindo</strong><small>Mi mercado</small></div></Link>
      <nav><Link href="/">Mercado público</Link>{access?.isAdmin && <Link className={styles.adminLink} href="/admin">Mantenedor</Link>}</nav>
    </header>

    {loading ? <section className={styles.state}><i /><h1>Cargando su actividad comercial…</h1></section> : !user ? <section className={styles.state}><span>◎</span><p>Acceso requerido</p><h1>Ingrese para consultar sus órdenes y operaciones.</h1><Link href="/">Volver al mercado e ingresar</Link></section> : error ? <section className={styles.state}><span>!</span><p>No fue posible cargar la información</p><h1>{error}</h1><button onClick={() => location.reload()}>Reintentar</button></section> : <>
      <section className={styles.hero}>
        <div><p>CUENTA COMERCIAL</p><h1>{access?.displayName ?? user.email}</h1><span>{user.email}</span></div>
        <div className={`${styles.verification} ${access?.verified ? styles.verified : ''}`}><i>{access?.verified ? '✓' : '!'}</i><div><small>Estado de verificación</small><strong>{access?.verified ? 'Identidad verificada' : access?.verificationStatus === 'IN_REVIEW' ? 'En revisión' : 'Pendiente'}</strong></div></div>
      </section>

      <section className={styles.metrics}>
        <article><span>Órdenes abiertas</span><strong>{openOrders}</strong><small>ofertas y demandas propias</small></article>
        <article><span>Pujas vigentes</span><strong>{portfolio.bids.filter((item) => item.status === 'ACTIVE').length}</strong><small>compromisos en subastas</small></article>
        <article><span>Operaciones</span><strong>{portfolio.trades.length}</strong><small>adjudicadas o cerradas</small></article>
        <article><span>Valor comprometido</span><strong>{currency.format(committedValue)}</strong><small>historial de operaciones</small></article>
      </section>

      {!access?.verified && <aside className={styles.notice}><div><strong>Su cuenta todavía no está habilitada para operar.</strong><p>Campo Lindo debe verificar la identidad comercial antes de aceptar publicaciones, compras o pujas. Los intentos rechazados no crean órdenes.</p></div><span>PENDIENTE DE REVISIÓN</span></aside>}

      <section className={styles.workspace}>
        <div className={styles.workspaceHead}><div><p>TRAZABILIDAD PERSONAL</p><h2>Mis órdenes y compromisos</h2></div><Link href="/?publicar=1">+ Nueva publicación</Link></div>
        <div className={styles.tabs}>
          <button className={tab === 'orders' ? styles.active : ''} onClick={() => setTab('orders')}>Publicaciones <b>{portfolio.listings.length}</b></button>
          <button className={tab === 'bids' ? styles.active : ''} onClick={() => setTab('bids')}>Pujas <b>{portfolio.bids.length}</b></button>
          <button className={tab === 'trades' ? styles.active : ''} onClick={() => setTab('trades')}>Operaciones <b>{portfolio.trades.length}</b></button>
        </div>

        {tab === 'orders' && <div className={styles.table}>
          <div className={styles.tableHead}><span>Orden</span><span>Producto</span><span>Lado</span><span>Cantidad</span><span>Precio</span><span>Estado</span></div>
          {portfolio.listings.map((item) => <div className={styles.row} key={item.id}><span><strong>{item.id.slice(0, 8).toUpperCase()}</strong><small>{dateTime(item.createdAt)}</small></span><span><strong>{item.product}</strong><small>{item.variety} · {item.quality}</small></span><span><i className={item.side === 'BUY' ? styles.buy : styles.sell}>{item.side === 'BUY' ? 'Compra' : 'Venta'}</i></span><span><strong>{quantity.format(item.totalQuantity)} {item.unit}</strong><small>{quantity.format(item.availableQuantity)} disponibles</small></span><span><strong>{currency.format(item.price)}</strong><small>por {item.unit}</small></span><span><i className={styles.status}>{listingStatus[item.status] ?? item.status}</i></span></div>)}
          {!portfolio.listings.length && <Empty text="Aún no ha publicado ofertas ni demandas." />}
        </div>}

        {tab === 'bids' && <div className={styles.table}>
          <div className={styles.tableHead}><span>Puja</span><span>Producto</span><span>Precio</span><span>Cantidad</span><span>Asignación</span><span>Estado</span></div>
          {portfolio.bids.map((item) => <div className={styles.row} key={item.id}><span><strong>{item.id.slice(0, 8).toUpperCase()}</strong><small>{dateTime(item.createdAt)}</small></span><span><strong>{item.product}</strong><small>{item.variety}</small></span><span><strong>{currency.format(item.unitPrice)}</strong></span><span><strong>{quantity.format(item.quantity)}</strong></span><span><strong>{quantity.format(item.allocatedQuantity)}</strong></span><span><i className={styles.status}>{bidStatus[item.status] ?? item.status}</i></span></div>)}
          {!portfolio.bids.length && <Empty text="Aún no registra pujas en subastas." />}
        </div>}

        {tab === 'trades' && <div className={styles.table}>
          <div className={styles.tableHead}><span>Operación</span><span>Producto</span><span>Contraparte</span><span>Cantidad</span><span>Valor</span><span>Estado</span></div>
          {portfolio.trades.map((item) => <div className={styles.row} key={item.id}><span><strong>{item.id}</strong><small>{item.updatedAt}</small></span><span><strong>{item.product}</strong><small>{item.side === 'BUY' ? 'Compra' : 'Venta'}</small></span><span><strong>{item.counterparty}</strong></span><span><strong>{quantity.format(item.quantity)} {item.unit}</strong></span><span><strong>{currency.format(item.total)}</strong></span><span><i className={styles.status}>{item.status}</i></span></div>)}
          {!portfolio.trades.length && <Empty text="Aún no registra operaciones adjudicadas." />}
        </div>}
      </section>
    </>}
  </main>;
}

function Empty({ text }: { text: string }) {
  return <div className={styles.empty}><span>◎</span><strong>{text}</strong><p>Las órdenes confirmadas aparecerán aquí con su identificador y estado real.</p></div>;
}
