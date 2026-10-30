import { isFirm, orderTotals, type OrderTotals } from './orders';
import type { PricingContext } from './pricing';
import type { Order, Recipe, Transaction } from './types';

export interface CustomerStats {
  /** firm orders (confirmed onwards, not cancelled) */
  orders: { o: Order; t: OrderTotals }[];
  quotes: number;
  cancelled: number;
  total: number;
  avgTicket: number;
  profit: number;
  /** some order has an item without known cost, so profit excludes it */
  profitPartial: boolean;
  marginPct: number;
  owed: number;
  firstAt: string | null;
  lastAt: string | null;
  daysSinceLast: number | null;
  /** average days between consecutive orders; null with fewer than 2 orders */
  avgIntervalDays: number | null;
  favorites: { name: string; qty: number; value: number }[];
  monthly: { key: string; value: number }[];
}

const DAY = 86_400_000;
/** Whole calendar days between two dates in local time ("yesterday 23:00" → today = 1). */
const calendarDays = (from: Date, to: Date) =>
  Math.round((new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime() - new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()) / DAY);

export function customerStats(customerId: string, all: Order[], transactions: Transaction[], recipes: Recipe[], ctx: PricingContext, now = new Date()): CustomerStats {
  const mine = all.filter((o) => o.customerId === customerId);
  const orders = mine
    .filter((o) => isFirm(o.status))
    .map((o) => ({ o, t: orderTotals(o, transactions, recipes, ctx) }))
    .sort((a, b) => a.o.deliveryAt.localeCompare(b.o.deliveryAt));

  const total = orders.reduce((a, x) => a + x.t.total, 0);
  const known = orders.filter((x) => !x.t.costMissing);
  const profit = known.reduce((a, x) => a + x.t.profit, 0);
  const knownRevenue = known.reduce((a, x) => a + x.t.total, 0);

  const dates = orders.map((x) => new Date(x.o.deliveryAt).getTime());
  const intervals = dates.slice(1).map((d, i) => (d - dates[i]) / DAY);
  const last = dates.length ? Math.max(...dates) : null;

  const fav = new Map<string, { name: string; qty: number; value: number }>();
  for (const { o } of orders)
    for (const it of o.items) {
      const key = it.recipeId ?? `avulso:${it.name.toLowerCase()}`;
      const f = fav.get(key) ?? { name: it.name, qty: 0, value: 0 };
      f.qty += it.qty;
      f.value += it.qty * it.unitPrice;
      fav.set(key, f);
    }

  // last 6 months, including empty ones, oldest first
  const monthly: { key: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const value = orders
      .filter((x) => {
        const od = new Date(x.o.deliveryAt);
        return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth();
      })
      .reduce((a, x) => a + x.t.total, 0);
    monthly.push({ key, value });
  }

  return {
    orders,
    quotes: mine.filter((o) => o.status === 'orcamento').length,
    cancelled: mine.filter((o) => o.status === 'cancelado').length,
    total,
    avgTicket: orders.length ? total / orders.length : NaN,
    profit,
    profitPartial: known.length < orders.length,
    marginPct: knownRevenue > 0 ? (profit / knownRevenue) * 100 : NaN,
    owed: orders.reduce((a, x) => a + x.t.remaining, 0),
    firstAt: orders[0]?.o.deliveryAt ?? null,
    lastAt: last !== null ? new Date(last).toISOString() : null,
    daysSinceLast: last !== null ? Math.max(0, calendarDays(new Date(last), now)) : null,
    avgIntervalDays: intervals.length ? intervals.reduce((a, b) => a + b, 0) / intervals.length : null,
    favorites: [...fav.values()].sort((a, b) => b.value - a.value).slice(0, 5),
    monthly,
  };
}
