import { useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, CalendarClock } from 'lucide-react';
import { useStore } from '../store/store';
import { money, relativeDay } from '@cakeboss/domain/format';
import { STATUS, type OrderTotals } from '@cakeboss/domain/orders';
import type { Order, OrderStatus } from '@cakeboss/domain/types';
import { Badge, cx } from './ui';
import { useToast } from './motion';

const COLUMNS: { status: OrderStatus; hint: string }[] = [
  { status: 'confirmado', hint: 'Esperando produção' },
  { status: 'em_producao', hint: 'Na cozinha agora' },
  { status: 'pronto', hint: 'Para entregar ou retirar' },
  { status: 'entregue', hint: 'Últimos 7 dias' },
];
const NEXT: Partial<Record<OrderStatus, OrderStatus>> = { confirmado: 'em_producao', em_producao: 'pronto', pronto: 'entregue' };
const DOT: Record<OrderStatus, string> = { orcamento: 'bg-muted', confirmado: 'bg-lilac', em_producao: 'bg-pink', pronto: 'bg-warn', entregue: 'bg-profit', cancelado: 'bg-loss' };
const PAY_LABEL = { pago: 'Pago', parcial: 'Parcial', pendente: 'A receber' };
const PAY_TONE = { pago: 'green', parcial: 'amber', pendente: 'gray' } as const;

/**
 * Orders as columns by status. Cards are dragged to the next column (mouse) or moved
 * with the arrow button (touch and keyboard); the card glides to its new column so the change is visible.
 */
export function OrderBoard({ rows, onOpen }: { rows: { o: Order; t: OrderTotals }[]; onOpen: (o: Order) => void }) {
  const { setOrderStatus } = useStore();
  const toast = useToast();
  const reduce = useReducedMotion();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<OrderStatus | null>(null);
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 3600e3;

  const move = (o: Order, to: OrderStatus) => {
    if (o.status === to) return;
    setOrderStatus(o.id, to);
    toast(`Pedido #${o.number} → ${STATUS[to].label}${to === 'em_producao' && !o.stockDeducted ? ' · ingredientes baixados do estoque' : ''}`);
  };

  return (
    <LayoutGroup>
      <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = rows
            .filter(({ o }) => o.status === col.status && (col.status !== 'entregue' || new Date(o.deliveryAt).getTime() >= weekAgo))
            .sort((a, b) => (col.status === 'entregue' ? b.o.deliveryAt.localeCompare(a.o.deliveryAt) : a.o.deliveryAt.localeCompare(b.o.deliveryAt)));
          const dropping = over === col.status && dragId !== null;
          return (
            <section
              key={col.status}
              aria-label={STATUS[col.status].label}
              onDragOver={(e) => {
                e.preventDefault();
                if (over !== col.status) setOver(col.status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const o = rows.find((r) => r.o.id === e.dataTransfer.getData('text/plain'))?.o;
                if (o) move(o, col.status);
                setOver(null);
                setDragId(null);
              }}
              className={cx(
                'flex min-h-[220px] flex-col rounded-xl border bg-subtle/60 transition-colors duration-150',
                dropping ? 'border-pink/50 bg-pink-soft/50' : 'border-divider',
              )}
            >
              <header className="flex items-center gap-2 px-3 pb-2 pt-3">
                <span className={cx('h-2 w-2 rounded-full', DOT[col.status])} />
                <h3 className="text-[13px] font-semibold">{STATUS[col.status].label}</h3>
                <span className="tabular rounded-full bg-surface px-1.5 text-[11px] font-medium text-muted ring-1 ring-line">{items.length}</span>
                <span className="ml-auto truncate text-[11px] text-muted">{col.hint}</span>
              </header>
              <ul className="flex flex-1 flex-col gap-2 px-2 pb-2">
                <AnimatePresence initial={false}>
                  {items.map(({ o, t }) => {
                    const late = col.status !== 'entregue' && new Date(o.deliveryAt).getTime() < now;
                    const next = NEXT[o.status];
                    return (
                      <motion.li
                        key={o.id}
                        layoutId={reduce ? undefined : `board-${o.id}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: dragId === o.id ? 0.45 : 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ layout: { duration: 0.28, ease: [0.23, 1, 0.32, 1] }, opacity: { duration: 0.15 } }}
                      >
                        <div
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', o.id);
                            e.dataTransfer.effectAllowed = 'move';
                            setDragId(o.id);
                          }}
                          onDragEnd={() => {
                            setDragId(null);
                            setOver(null);
                          }}
                          onClick={() => onOpen(o)}
                          onKeyDown={(e) => e.key === 'Enter' && onOpen(o)}
                          role="button"
                          tabIndex={0}
                          className="group cursor-grab rounded-lg border border-line bg-surface p-3 text-sm shadow-card transition-[border-color,box-shadow] duration-150 hover:border-pink/30 hover:shadow-pop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink/40 active:cursor-grabbing"
                        >
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">
                                #{o.number} · {o.customerName || 'Sem cliente'}
                              </div>
                              <div className="mt-0.5 truncate text-xs text-muted">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ') || 'sem itens'}</div>
                            </div>
                            {o.origin === 'loja' && <Badge tone="pink">loja</Badge>}
                          </div>
                          <div className={cx('mt-2.5 flex items-center gap-1.5 text-xs', late ? 'font-medium text-loss' : 'text-muted')}>
                            <CalendarClock size={13} />
                            {relativeDay(o.deliveryAt)}
                            {late && ' · atrasado'}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="tabular font-semibold">{money(t.total)}</span>
                            <Badge tone={PAY_TONE[t.payment]}>{PAY_LABEL[t.payment]}</Badge>
                            {next && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  move(o, next);
                                }}
                                title={`Mover para ${STATUS[next].label}`}
                                aria-label={`Mover pedido #${o.number} para ${STATUS[next].label}`}
                                className="ml-auto inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md border border-line px-2 text-[12px] font-medium text-muted transition-[color,border-color,transform] duration-150 ease-out hover:border-pink/40 hover:text-pink active:scale-[0.97]"
                              >
                                {STATUS[next].label} <ArrowRight size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
                {items.length === 0 && (
                  <li className="grid flex-1 place-items-center rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
                    {dropping ? 'Solte aqui' : 'Nenhum pedido'}
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
