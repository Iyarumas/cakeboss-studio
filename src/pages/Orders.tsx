import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { CircleDollarSign, Plus, Search, ShoppingBag, Trash, TriangleAlert, X } from 'lucide-react';
import { useStore } from '../store/store';
import { date, dateTime, fromLocalDate, fromLocalDateTime, money, nowIso, pct, relativeDay, toLocalDate, toLocalDateTime, uid } from '../lib/format';
import { METHOD_LABEL, STATUS, STATUS_FLOW, currentUnitCost, isOpen, orderTotals } from '../lib/orders';
import type { Order, OrderItem, OrderStatus, PaymentMethod } from '../lib/types';
import { Badge, Button, Card, CardHeader, EmptyState, Field, IconButton, NumberInput, PageHeader, Segmented, Select, TextInput, cx } from '../components/ui';
import { AnimatedCounter, ConfirmDialog, Drawer, Modal, stagger, useToast } from '../components/motion';
import { newCustomer } from './Customers';
import { WhatsAppDialog } from '../components/WhatsAppDialog';
import { addressLine } from '../lib/shop';
import { CakeQuoteModal } from '../components/CakeQuoteModal';
import { orderVars } from '../lib/whatsapp';
import { MessageCircle } from 'lucide-react';

type Filter = 'abertos' | 'orcamento' | 'entregue' | 'cancelado' | 'todos';

const defaultDelivery = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(14, 0, 0, 0);
  return d.toISOString();
};

const newOrder = (): Order => ({
  id: uid(),
  number: 0,
  customerId: null,
  customerName: '',
  items: [],
  deliveryAt: defaultDelivery(),
  status: 'orcamento',
  discount: 0,
  deliveryFee: 0,
  notes: '',
  costFrozenAt: null,
  createdAt: nowIso(),
  updatedAt: nowIso(),
});

const PAY_TONE = { pago: 'green', parcial: 'amber', pendente: 'gray' } as const;
const PAY_LABEL = { pago: 'Pago', parcial: 'Parcial', pendente: 'A receber' };

export default function OrdersPage() {
  const { db, ctx, setOrderStatus } = useStore();
  const [params, setParams] = useSearchParams();
  const customerFilter = params.get('cliente');
  const [filter, setFilter] = useState<Filter>(() => (params.get('filtro') as Filter | null) ?? (customerFilter ? 'todos' : 'abertos'));
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Order | null>(null);

  useEffect(() => {
    const id = params.get('pedido');
    if (id) {
      const o = db.orders.find((x) => x.id === id);
      if (o) setEditing(JSON.parse(JSON.stringify(o)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('pedido')]);

  const rows = useMemo(() => {
    const list = db.orders
      .filter((o) => !customerFilter || o.customerId === customerFilter)
      .filter((o) =>
        filter === 'todos' ? true : filter === 'abertos' ? isOpen(o.status) && o.status !== 'orcamento' : o.status === filter,
      )
      .filter((o) => `${o.number} ${o.customerName} ${o.items.map((i) => i.name).join(' ')}`.toLowerCase().includes(q.toLowerCase()))
      .map((o) => ({ o, t: orderTotals(o, db.transactions, db.recipes, ctx) }));
    // open orders: soonest delivery first; closed: most recent first
    return filter === 'abertos' || filter === 'orcamento' ? list.sort((a, b) => a.o.deliveryAt.localeCompare(b.o.deliveryAt)) : list.sort((a, b) => b.o.deliveryAt.localeCompare(a.o.deliveryAt));
  }, [db, ctx, filter, q, customerFilter]);

  // "Novo pedido" from a customer profile: open a blank order already set to that customer
  useEffect(() => {
    if (params.get('novo') !== '1') return;
    const c = db.customers.find((x) => x.id === params.get('cliente'));
    setEditing({ ...newOrder(), customerId: c?.id ?? null, customerName: c?.name ?? '' });
    params.delete('novo');
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('novo')]);

  const [cakeFirst, setCakeFirst] = useState(false);
  const close = () => {
    setCakeFirst(false);
    setEditing(null);
    if (params.get('pedido')) {
      params.delete('pedido');
      setParams(params, { replace: true });
    }
  };
  const customerName = customerFilter ? db.customers.find((c) => c.id === customerFilter)?.name : null;
  const now = Date.now();

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show">
      <PageHeader
        title="Pedidos"
        subtitle="Encomendas, orçamentos, entregas e pagamentos."
        actions={
          <>
            <Button
              onClick={() => {
                setCakeFirst(true);
                setEditing({ ...newOrder(), customerId: customerFilter, customerName: customerName ?? '' });
              }}
            >
              🎂 Orçamento de bolo
            </Button>
            <Button variant="primary" onClick={() => setEditing({ ...newOrder(), customerId: customerFilter, customerName: customerName ?? '' })}>
              <Plus size={16} /> Novo pedido
            </Button>
          </>
        }
      />
      <motion.div variants={stagger.item}>
        <Card>
          <div className="flex flex-col gap-3 border-b border-divider p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="overflow-x-auto">
              <Segmented
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'abertos', label: 'Em andamento' },
                  { value: 'orcamento', label: 'Orçamentos' },
                  { value: 'entregue', label: 'Entregues' },
                  { value: 'cancelado', label: 'Cancelados' },
                  { value: 'todos', label: 'Todos' },
                ]}
              />
            </div>
            <div className="flex items-center gap-2">
              {customerName && (
                <button
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-lilac-soft px-3 text-[13px] font-medium text-lilac"
                  onClick={() => {
                    params.delete('cliente');
                    setParams(params);
                  }}
                >
                  {customerName} <X size={14} />
                </button>
              )}
              <div className="relative w-full lg:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <TextInput className="pl-9" placeholder="Buscar pedido" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
          </div>
          {rows.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag size={22} />}
              title={db.orders.length ? 'Nenhum pedido neste filtro' : 'Nenhum pedido ainda'}
              text={db.orders.length ? 'Troque o filtro acima para ver outros pedidos.' : 'Registre encomendas e orçamentos para acompanhar entregas, pagamentos e lucro.'}
              action={
                <Button variant="primary" onClick={() => setEditing(newOrder())}>
                  <Plus size={16} /> Novo pedido
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-subtle/70 text-left text-xs text-muted">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Pedido</th>
                    <th className="px-3 py-2.5 font-medium">Entrega</th>
                    <th className="px-3 py-2.5 font-medium">Itens</th>
                    <th className="px-3 py-2.5 text-right font-medium">Total</th>
                    <th className="px-3 py-2.5 text-right font-medium">Lucro</th>
                    <th className="px-3 py-2.5 font-medium">Pagamento</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {rows.map(({ o, t }) => {
                    const late = isOpen(o.status) && new Date(o.deliveryAt).getTime() < now;
                    return (
                      <tr key={o.id} className="cursor-pointer hover:bg-subtle/50" onClick={() => setEditing(JSON.parse(JSON.stringify(o)))}>
                        <td className="px-5 py-3">
                          <div className="font-medium">
                            #{o.number} · {o.customerName || 'Sem cliente'} {o.origin === 'loja' && <Badge tone="pink">loja</Badge>}
                          </div>
                          <div className="text-xs text-muted">criado {date(o.createdAt)}</div>
                        </td>
                        <td className={cx('px-3 py-3', late ? 'font-medium text-loss' : 'text-ink')}>
                          {relativeDay(o.deliveryAt)}
                          {late && <div className="text-xs">atrasado</div>}
                        </td>
                        <td className="max-w-[220px] px-3 py-3 text-muted">
                          <div className="truncate">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ') || '—'}</div>
                        </td>
                        <td className="px-3 py-3 text-right font-medium tabular">{money(t.total)}</td>
                        <td className={cx('px-3 py-3 text-right tabular', t.profit >= 0 ? 'text-profit' : 'text-loss')}>
                          {t.costMissing ? '—' : money(t.profit)}
                          {t.costEstimated && !t.costMissing && <div className="text-[11px] text-muted">estimado</div>}
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={PAY_TONE[t.payment]}>{PAY_LABEL[t.payment]}</Badge>
                          {t.payment === 'parcial' && <div className="mt-0.5 text-[11px] text-muted">falta {money(t.remaining)}</div>}
                        </td>
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <Select aria-label="Status" value={o.status} onChange={(e) => setOrderStatus(o.id, e.target.value as OrderStatus)} className="h-8 w-36 text-[13px]">
                            {(Object.keys(STATUS) as OrderStatus[]).map((s) => (
                              <option key={s} value={s}>
                                {STATUS[s].label}
                              </option>
                            ))}
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>

      <Drawer open={!!editing} onClose={close} width="max-w-2xl" title={editing && db.orders.some((x) => x.id === editing.id) ? `Pedido #${db.orders.find((x) => x.id === editing.id)!.number}` : 'Novo pedido'}>
        {editing && <OrderEditor key={editing.id} initial={editing} onDone={close} startWithCake={cakeFirst} />}
      </Drawer>
    </motion.div>
  );
}

function OrderEditor({ initial, onDone, startWithCake }: { initial: Order; onDone: () => void; startWithCake?: boolean }) {
  const { db, ctx, saveOrder, saveCustomer, deleteOrder, registerPayment, deleteTransaction } = useStore();
  const toast = useToast();
  const [o, setO] = useState<Order>(initial);
  const [newCust, setNewCust] = useState<{ name: string; phone: string } | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [cakeOpen, setCakeOpen] = useState(!!startWithCake);
  const [del, setDel] = useState(false);
  const saved = db.orders.find((x) => x.id === o.id);
  const t = orderTotals(o, db.transactions, db.recipes, ctx);
  const payments = db.transactions.filter((x) => x.orderId === o.id);
  const dirty = !saved || JSON.stringify(saved) !== JSON.stringify(o) || !!newCust;

  const setItem = (id: string, patch: Partial<OrderItem>) => setO({ ...o, items: o.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  const addItem = (recipeId: string | null) => {
    const r = db.recipes.find((x) => x.id === recipeId);
    const price = r ? (r.salePrice ?? 0) : 0;
    setO({ ...o, items: [...o.items, { id: uid(), recipeId, name: r?.name ?? '', qty: 1, unitPrice: price, unitCost: null }] });
  };

  const save = (): Order | null => {
    let order = o;
    if (newCust) {
      if (!newCust.name.trim()) {
        toast('Informe o nome do novo cliente', 'error');
        return null;
      }
      const c = { ...newCustomer(newCust.name.trim()), phone: newCust.phone };
      saveCustomer(c);
      order = { ...order, customerId: c.id, customerName: c.name };
      setNewCust(null);
    }
    if (order.items.length === 0) {
      toast('Adicione pelo menos um item', 'error');
      return null;
    }
    if (order.items.some((i) => !i.name.trim())) {
      toast('Dê um nome para cada item avulso', 'error');
      return null;
    }
    const res = saveOrder(order);
    setO(res);
    toast(saved ? 'Pedido atualizado' : `Pedido #${res.number} criado`);
    return res;
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cliente">
            <Select
              value={newCust ? '__new' : (o.customerId ?? (o.customerName ? '__free' : ''))}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '__new') return setNewCust({ name: '', phone: '' });
                setNewCust(null);
                if (v === '' || v === '__free') return setO({ ...o, customerId: null, customerName: v === '' ? '' : o.customerName });
                setO({ ...o, customerId: v, customerName: db.customers.find((c) => c.id === v)?.name ?? '' });
              }}
            >
              <option value="">Sem cliente</option>
              {o.customerId && !db.customers.some((c) => c.id === o.customerId) && <option value={o.customerId}>{o.customerName} (excluído)</option>}
              {!o.customerId && o.customerName && <option value="__free">{o.customerName}</option>}
              {db.customers
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              <option value="__new">+ Novo cliente…</option>
            </Select>
          </Field>
          <Field label="Entrega">
            <TextInput type="datetime-local" value={toLocalDateTime(o.deliveryAt)} onChange={(e) => e.target.value && setO({ ...o, deliveryAt: fromLocalDateTime(e.target.value) })} />
          </Field>
          {saved && (
            <div className="sm:col-span-2 -mt-1">
              <Button size="sm" onClick={() => setWaOpen(true)}>
                <MessageCircle size={15} className="text-profit" /> Enviar WhatsApp para {o.customerName ? o.customerName.split(' ')[0] : 'o cliente'}
              </Button>
            </div>
          )}
          <AnimatePresence>
            {newCust && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="grid gap-3 overflow-hidden sm:col-span-2 sm:grid-cols-2">
                <Field label="Nome do novo cliente">
                  <TextInput autoFocus value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} />
                </Field>
                <Field label="Telefone">
                  <TextInput inputMode="tel" value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} />
                </Field>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {o.origin === 'loja' && (
          <div className="rounded-xl border border-pink/30 bg-pink-soft/40 p-4 text-sm">
            <div className="font-semibold text-pink">Pedido feito pela loja online</div>
            <div className="mt-1 text-ink">
              {o.fulfillment?.type === 'entrega' && o.fulfillment.address
                ? `Entrega: ${addressLine(o.fulfillment.address)} · frete ${money(o.fulfillment.fee)}`
                : 'Retirada no local'}
            </div>
            {o.payment && (
              <div className="mt-1 text-muted">
                Pagamento escolhido: <b className="text-ink">{METHOD_LABEL[o.payment.method]}</b> — {o.payment.note}
              </div>
            )}
            {o.status === 'orcamento' && <div className="mt-2 text-xs text-muted">Confirme o pagamento e mude o status para “Confirmado” para seguir com a produção.</div>}
          </div>
        )}

        <div>
          <div className="mb-2 text-[13px] font-medium">Status</div>
          <div className="flex flex-wrap gap-1.5">
            {[...STATUS_FLOW, 'cancelado' as const].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setO({ ...o, status: s })}
                className={cx(
                  'h-8 rounded-full border px-3 text-[13px] font-medium transition-colors',
                  o.status === s ? (s === 'cancelado' ? 'border-loss/40 bg-loss-soft text-loss' : 'border-pink/40 bg-pink-soft text-pink') : 'border-line text-muted hover:bg-subtle hover:text-ink',
                )}
              >
                {STATUS[s].label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {o.costFrozenAt
              ? `Custo dos itens registrado em ${dateTime(o.costFrozenAt)} — mudanças de preço de insumos não alteram este pedido.`
              : 'Orçamento: o custo acompanha os preços atuais. Ao confirmar, o custo do dia fica registrado.'}
            {o.stockDeducted ? ' Ingredientes já baixados do estoque.' : ' Ao passar para Em produção, os ingredientes saem do estoque automaticamente.'}
          </p>
        </div>

        <Card as="div" className="shadow-none">
          <CardHeader title="Itens" className="py-3" />
          <ul className="divide-y divide-divider">
            <AnimatePresence initial={false}>
              {o.items.map((it) => {
                const r = db.recipes.find((x) => x.id === it.recipeId);
                const unitCost = it.unitCost ?? currentUnitCost(r, ctx);
                const below = Number.isFinite(unitCost) && it.unitPrice > 0 && it.unitPrice < unitCost;
                return (
                  <motion.li key={it.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="grid grid-cols-[1fr_auto] gap-2 px-4 py-3 sm:grid-cols-[1fr_80px_120px_90px_auto] sm:items-center">
                      {it.recipeId ? (
                        <Select
                          aria-label="Produto"
                          value={it.recipeId}
                          onChange={(e) => {
                            const nr = db.recipes.find((x) => x.id === e.target.value);
                            setItem(it.id, { recipeId: e.target.value, name: nr?.name ?? it.name, unitPrice: nr?.salePrice ?? it.unitPrice, unitCost: null });
                          }}
                        >
                          {!r && <option value={it.recipeId}>{it.name} (ficha excluída)</option>}
                          {db.recipes.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <TextInput aria-label="Item avulso" placeholder="Descrição do item" value={it.name} onChange={(e) => setItem(it.id, { name: e.target.value })} />
                      )}
                      <IconButton label="Remover item" className="sm:order-last" onClick={() => setO({ ...o, items: o.items.filter((x) => x.id !== it.id) })}>
                        <Trash size={15} />
                      </IconButton>
                      <NumberInput aria-label="Quantidade" value={it.qty} min={0} onChange={(v) => setItem(it.id, { qty: v })} />
                      <NumberInput aria-label="Preço unitário" value={it.unitPrice} min={0} prefix="R$" onChange={(v) => setItem(it.id, { unitPrice: v })} />
                      <span className="text-right text-sm font-semibold tabular">{money(it.qty * it.unitPrice)}</span>
                    </div>
                    <div className="-mt-1 flex flex-wrap gap-x-3 px-4 pb-2.5 text-[11px] text-muted">
                      <span>
                        custo un.: {Number.isFinite(unitCost) ? money(unitCost) : 'desconhecido (item avulso)'}
                        {it.unitCost == null && Number.isFinite(unitCost) && ' (atual)'}
                      </span>
                      {r && r.salePrice == null && <span className="text-warn">ficha sem preço oficial</span>}
                      {below && <span className="font-medium text-loss">preço abaixo do custo</span>}
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
          <div className="flex flex-wrap gap-2 border-t border-divider px-4 py-3">
            <Select aria-label="Adicionar produto" value="" onChange={(e) => e.target.value && addItem(e.target.value)} className="h-9 max-w-xs border-dashed text-pink">
              <option value="">+ Adicionar produto</option>
              {db.recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.salePrice != null ? `· ${money(r.salePrice)}` : ''}
                </option>
              ))}
            </Select>
            <Button size="sm" variant="ghost" onClick={() => addItem(null)}>
              <Plus size={14} /> Item avulso
            </Button>
            <Button size="sm" onClick={() => setCakeOpen(true)}>
              🎂 Montar bolo
            </Button>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Desconto">
            <NumberInput value={o.discount} min={0} prefix="R$" onChange={(v) => setO({ ...o, discount: v })} />
          </Field>
          <Field label="Taxa de entrega cobrada">
            <NumberInput value={o.deliveryFee} min={0} prefix="R$" onChange={(v) => setO({ ...o, deliveryFee: v })} />
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <textarea
              rows={2}
              value={o.notes}
              onChange={(e) => setO({ ...o, notes: e.target.value })}
              placeholder="Tema, sabor, recado no topo, endereço…"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-pink/60 focus:outline-none focus:ring-2 focus:ring-pink/20"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-divider sm:grid-cols-4 [&>*]:bg-surface">
          <div className="px-4 py-3">
            <div className="text-xs text-muted">Total</div>
            <AnimatedCounter value={t.total} format={money} className="text-lg font-bold" />
          </div>
          <div className="px-4 py-3">
            <div className="text-xs text-muted">Custo {o.costFrozenAt ? 'registrado' : 'estimado'}</div>
            <div className="text-lg font-semibold tabular">{t.costMissing ? '—' : <AnimatedCounter value={t.cost} format={money} />}</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-xs text-muted">Lucro {t.fees > 0 ? '(após taxas)' : ''}</div>
            <div className={cx('text-lg font-semibold', t.profit >= 0 ? 'text-profit' : 'text-loss')}>{t.costMissing ? '—' : <AnimatedCounter value={t.profit} format={money} />}</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-xs text-muted">Margem</div>
            <div className={cx('text-lg font-semibold tabular', t.profit >= 0 ? 'text-profit' : 'text-loss')}>{t.costMissing ? '—' : pct(t.marginPct)}</div>
          </div>
        </div>
        {t.costMissing && (
          <p className="flex items-center gap-1.5 text-xs text-warn">
            <TriangleAlert size={13} /> Há item avulso sem ficha técnica: o custo é desconhecido, então o lucro não é calculado.
          </p>
        )}

        {saved && (
          <Card as="div" className="shadow-none">
            <CardHeader
              title="Pagamentos"
              subtitle={`Recebido ${money(t.paid)} de ${money(t.total)}`}
              className="py-3"
              actions={
                <Button size="sm" variant="primary" onClick={() => setPayOpen(true)} disabled={dirty || t.remaining <= 0} title={dirty ? 'Salve o pedido antes' : undefined}>
                  <CircleDollarSign size={14} /> Registrar pagamento
                </Button>
              }
            />
            <div className="px-4 pt-3">
              <div className="h-2 overflow-hidden rounded-full bg-divider">
                <motion.div className="h-full rounded-full bg-profit" animate={{ width: `${t.total > 0 ? Math.min(100, (t.paid / t.total) * 100) : 0}%` }} transition={{ type: 'spring', stiffness: 160, damping: 24 }} />
              </div>
            </div>
            {payments.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">Nenhum pagamento registrado.</p>
            ) : (
              <ul className="divide-y divide-divider px-1 py-1">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="flex-1">
                      {p.type === 'entrada' ? 'Recebido' : 'Taxa'} · {p.method ? METHOD_LABEL[p.method] : ''} <span className="text-xs text-muted">{date(p.date)}</span>
                    </span>
                    <span className={cx('tabular', p.type === 'entrada' ? 'text-profit' : 'text-loss')}>
                      {p.type === 'entrada' ? '+' : '−'}
                      {money(p.amount)}
                    </span>
                    <IconButton label="Excluir lançamento" onClick={() => deleteTransaction(p.id)}>
                      <Trash size={14} />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-divider bg-surface px-5 py-3">
        {saved ? (
          <Button variant="danger" size="sm" onClick={() => setDel(true)}>
            Excluir
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button onClick={onDone}>{dirty ? 'Descartar' : 'Fechar'}</Button>
          <Button variant="primary" onClick={() => save()} disabled={!dirty}>
            {saved ? (dirty ? 'Salvar alterações' : 'Salvo') : 'Criar pedido'}
          </Button>
        </div>
      </div>

      <CakeQuoteModal open={cakeOpen} onClose={() => setCakeOpen(false)} onAdd={(item) => setO({ ...o, items: [...o.items, item] })} />
      <WhatsAppDialog
        open={waOpen}
        onClose={() => setWaOpen(false)}
        customerName={o.customerName}
        phone={db.customers.find((c) => c.id === o.customerId)?.phone ?? ''}
        orderVars={orderVars(o, t)}
      />
      <PaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        remaining={t.remaining}
        onConfirm={(amount, method, d, fee) => {
          registerPayment(o.id, amount, method, d, fee);
          toast(`Pagamento de ${money(amount)} registrado`);
        }}
      />
      <ConfirmDialog
        open={del}
        onClose={() => setDel(false)}
        danger
        title={`Excluir pedido #${o.number}?`}
        confirmLabel="Excluir"
        onConfirm={() => {
          const r = deleteOrder(o.id);
          if (r.ok) {
            toast('Pedido excluído');
            onDone();
          } else toast(r.error, 'error');
        }}
      >
        O pedido será removido. Para manter o registro, prefira mudar o status para <b>Cancelado</b>.
      </ConfirmDialog>
    </div>
  );
}

function PaymentModal({ open, onClose, remaining, onConfirm }: { open: boolean; onClose: () => void; remaining: number; onConfirm: (amount: number, method: PaymentMethod, date: string, feePct: number) => void }) {
  const { db } = useStore();
  const [amount, setAmount] = useState(remaining);
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [day, setDay] = useState(toLocalDate(nowIso()));
  const [fee, setFee] = useState(0);
  useEffect(() => {
    if (open) {
      setAmount(Math.round(remaining * 100) / 100);
      setDay(toLocalDate(nowIso()));
    }
  }, [open, remaining]);
  useEffect(() => setFee(method === 'credito' || method === 'debito' ? db.settings.cardFeePct : 0), [method, db.settings.cardFeePct]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar pagamento"
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!(amount > 0)}
            onClick={() => {
              onConfirm(amount, method, fromLocalDate(day), fee);
              onClose();
            }}
          >
            Registrar
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Valor recebido" hint={`Falta receber ${money(remaining)}`}>
          <NumberInput value={amount} min={0} prefix="R$" onChange={setAmount} />
        </Field>
        <Field label="Data">
          <TextInput type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
        </Field>
        <Field label="Forma de pagamento">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {METHOD_LABEL[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Taxa cobrada" hint={fee > 0 ? `${money((amount * fee) / 100)} lançado como saída` : 'sem taxa'}>
          <NumberInput value={fee} min={0} max={30} suffix="%" onChange={setFee} />
        </Field>
      </div>
      <p className="mt-3 text-xs text-muted">O valor entra no Financeiro como venda; a taxa, se houver, como saída ligada a este pedido.</p>
    </Modal>
  );
}

/** Compact list of upcoming orders for the dashboard. */
export function UpcomingOrders({ limit = 5 }: { limit?: number }) {
  const { db, ctx } = useStore();
  const navigate = useNavigate();
  const list = db.orders
    .filter((o) => isOpen(o.status) && o.status !== 'orcamento')
    .sort((a, b) => a.deliveryAt.localeCompare(b.deliveryAt))
    .slice(0, limit);
  const now = Date.now();
  if (!list.length) return <p className="p-5 text-sm text-muted">Nenhum pedido em andamento.</p>;
  return (
    <ul className="divide-y divide-divider">
      {list.map((o) => {
        const t = orderTotals(o, db.transactions, db.recipes, ctx);
        const late = new Date(o.deliveryAt).getTime() < now;
        return (
          <li key={o.id}>
            <button type="button" onClick={() => navigate(`/pedidos?pedido=${o.id}`)} className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-subtle/60">
              <span className={cx('w-24 shrink-0 text-xs font-medium', late ? 'text-loss' : 'text-muted')}>{relativeDay(o.deliveryAt)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</span>
                <span className="block truncate text-xs text-muted">
                  #{o.number} · {o.customerName || 'sem cliente'} · {money(t.total)}
                </span>
              </span>
              <Badge tone={STATUS[o.status].tone}>{STATUS[o.status].label}</Badge>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
