import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { MessageCircle, Pencil, Plus } from 'lucide-react';
import { useStore } from '../store/store';
import { customerStats } from '../lib/customers';
import { date, money, monthLabel, number, pct } from '../lib/format';
import { STATUS, orderTotals } from '../lib/orders';
import type { Customer } from '../lib/types';
import { Badge, Button, cx } from './ui';
import { AnimatedCounter, stagger } from './motion';

const PAY = { pago: { tone: 'green', label: 'Pago' }, parcial: { tone: 'amber', label: 'Parcial' }, pendente: { tone: 'gray', label: 'A receber' } } as const;

function Kpi({ label, children, foot, tone }: { label: string; children: ReactNode; foot?: ReactNode; tone?: 'green' | 'red' | 'amber' }) {
  return (
    <motion.div variants={stagger.item} className="bg-surface px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={cx('mt-0.5 text-lg font-semibold tabular', tone === 'green' ? 'text-profit' : tone === 'red' ? 'text-loss' : tone === 'amber' ? 'text-warn' : 'text-ink')}>{children}</div>
      {foot && <div className="text-[11px] text-muted">{foot}</div>}
    </motion.div>
  );
}

/** Purchase history and indicators of one customer. */
export function CustomerProfile({ customer, onEdit, onWhatsApp }: { customer: Customer; onEdit: () => void; onWhatsApp: () => void }) {
  const { db, ctx } = useStore();
  const navigate = useNavigate();
  const s = useMemo(() => customerStats(customer.id, db.orders, db.transactions, db.recipes, ctx), [customer.id, db, ctx]);
  const history = db.orders.filter((o) => o.customerId === customer.id).sort((a, b) => b.deliveryAt.localeCompare(a.deliveryAt));
  const maxFav = s.favorites[0]?.value || 1;

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="pb-6">
      <div className="flex items-start gap-3 border-b border-divider px-5 py-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-lilac-soft text-base font-semibold text-lilac">{customer.name.slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{customer.name}</div>
          <div className="text-xs text-muted">
            {customer.phone || 'sem telefone'}
            {s.firstAt && ` · cliente desde ${date(s.firstAt)}`}
          </div>
          {customer.notes && <p className="mt-1.5 rounded-lg bg-subtle px-2.5 py-1.5 text-xs text-ink">{customer.notes}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-divider px-5 py-3">
        <Button size="sm" variant="primary" onClick={() => navigate(`/pedidos?cliente=${customer.id}&novo=1`)}>
          <Plus size={14} /> Novo pedido
        </Button>
        <Button size="sm" onClick={onWhatsApp}>
          <MessageCircle size={14} className="text-profit" /> WhatsApp
        </Button>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Pencil size={14} /> Editar
        </Button>
      </div>

      {s.orders.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted">
          Nenhuma compra confirmada ainda{s.quotes ? ` (${s.quotes} orçamento${s.quotes > 1 ? 's' : ''} em aberto)` : ''}.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px border-b border-divider bg-divider sm:grid-cols-3">
            <Kpi label="Total comprado">
              <AnimatedCounter value={s.total} format={money} />
            </Kpi>
            <Kpi label="Pedidos" foot={[s.quotes && `${s.quotes} orçamento(s)`, s.cancelled && `${s.cancelled} cancelado(s)`].filter(Boolean).join(' · ') || undefined}>
              {s.orders.length}
            </Kpi>
            <Kpi label="Ticket médio">
              <AnimatedCounter value={s.avgTicket} format={money} />
            </Kpi>
            <Kpi label="Lucro gerado" tone={s.profit >= 0 ? 'green' : 'red'} foot={s.profitPartial ? 'sem itens avulsos sem custo' : Number.isFinite(s.marginPct) ? `margem ${pct(s.marginPct)}` : undefined}>
              <AnimatedCounter value={s.profit} format={money} />
            </Kpi>
            <Kpi label="Costuma pedir" foot={s.avgIntervalDays === null ? 'precisa de 2+ pedidos' : undefined}>
              {s.avgIntervalDays === null ? '—' : `a cada ${number(Math.round(s.avgIntervalDays))} dias`}
            </Kpi>
            <Kpi label="Em aberto" tone={s.owed > 0.004 ? 'amber' : undefined} foot={s.daysSinceLast !== null ? (s.daysSinceLast === 0 ? 'último pedido hoje ou agendado' : `último pedido há ${s.daysSinceLast} dias`) : undefined}>
              {money(s.owed)}
            </Kpi>
          </div>

          <div className="grid gap-5 px-5 pt-5 sm:grid-cols-2">
            <motion.section variants={stagger.item}>
              <h3 className="mb-2 text-[13px] font-semibold">Mais comprados</h3>
              <ul className="space-y-2">
                {s.favorites.map((f) => (
                  <li key={f.name}>
                    <div className="flex justify-between gap-2 text-[13px]">
                      <span className="truncate">{f.name}</span>
                      <span className="shrink-0 tabular text-muted">
                        {number(f.qty)} · {money(f.value)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-divider">
                      <motion.div className="h-full rounded-full bg-pink" initial={{ width: 0 }} animate={{ width: `${(f.value / maxFav) * 100}%` }} transition={{ type: 'spring', stiffness: 160, damping: 24 }} />
                    </div>
                  </li>
                ))}
              </ul>
            </motion.section>
            <motion.section variants={stagger.item}>
              <h3 className="mb-2 text-[13px] font-semibold">Compras nos últimos 6 meses</h3>
              <div className="h-[120px]">
                <ResponsiveContainer>
                  <BarChart data={s.monthly.map((m) => ({ ...m, label: monthLabel(m.key).slice(0, 3) }))} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgb(var(--subtle))' }}
                      content={({ active, payload }) =>
                        active && payload?.[0] ? (
                          <div className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-pop">
                            {monthLabel(payload[0].payload.key)}: <b>{money(Number(payload[0].value))}</b>
                          </div>
                        ) : null
                      }
                    />
                    <Bar dataKey="value" fill="#DB2777" radius={[4, 4, 0, 0]} maxBarSize={26} animationDuration={500} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.section>
          </div>
        </>
      )}

      {history.length > 0 && (
        <motion.section variants={stagger.item} className="px-5 pt-5">
          <h3 className="mb-2 text-[13px] font-semibold">Histórico de pedidos</h3>
          <ul className="divide-y divide-divider overflow-hidden rounded-xl border border-line">
            {history.map((o) => {
              const t = orderTotals(o, db.transactions, db.recipes, ctx);
              return (
                <li key={o.id}>
                  <button type="button" onClick={() => navigate(`/pedidos?pedido=${o.id}`)} className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-subtle/60">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                        #{o.number} · {date(o.deliveryAt)}
                        <Badge tone={STATUS[o.status].tone}>{STATUS[o.status].label}</Badge>
                        {o.status !== 'orcamento' && o.status !== 'cancelado' && <Badge tone={PAY[t.payment].tone}>{PAY[t.payment].label}</Badge>}
                      </div>
                      <div className="truncate text-xs text-muted">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={cx('text-sm font-semibold tabular', o.status === 'cancelado' && 'text-muted line-through')}>{money(t.total)}</div>
                      {o.status !== 'cancelado' && !t.costMissing && <div className={cx('text-[11px] tabular', t.profit >= 0 ? 'text-profit' : 'text-loss')}>lucro {money(t.profit)}</div>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </motion.section>
      )}
    </motion.div>
  );
}
