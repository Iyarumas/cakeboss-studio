import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Pencil, Plus, Trash, Wallet, Clock, PiggyBank } from 'lucide-react';
import { useStore } from '../store/store';
import { date, fromLocalDate, money, monthKey, monthLabel, nowIso, pct, toLocalDate, uid } from '../lib/format';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, METHOD_LABEL, orderTotals } from '../lib/orders';
import type { PaymentMethod, Transaction } from '../lib/types';
import { Badge, Button, Card, CardHeader, EmptyState, Field, IconButton, NumberInput, PageHeader, Segmented, Select, TextInput, cx } from '../components/ui';
import { AnimatedCounter, ConfirmDialog, Drawer, stagger, useToast } from '../components/motion';

type Period = 'mes' | 'anterior' | 'ano' | 'tudo';

function periodRange(p: Period): { from: string | null; to: string | null; label: string; byDay: boolean } {
  const now = new Date();
  const thisMonth = monthKey(now.toISOString());
  if (p === 'mes') return { from: thisMonth, to: thisMonth, label: monthLabel(thisMonth), byDay: true };
  if (p === 'anterior') {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const k = monthKey(d.toISOString());
    return { from: k, to: k, label: monthLabel(k), byDay: true };
  }
  if (p === 'ano') return { from: `${now.getFullYear()}-01`, to: `${now.getFullYear()}-12`, label: String(now.getFullYear()), byDay: false };
  return { from: null, to: null, label: 'todo o período', byDay: false };
}
const inRange = (iso: string, r: { from: string | null; to: string | null }) => {
  const k = monthKey(iso);
  return (!r.from || k >= r.from) && (!r.to || k <= r.to);
};

const blank = (type: Transaction['type']): Transaction => ({
  id: uid(),
  date: nowIso(),
  type,
  category: type === 'entrada' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0],
  description: '',
  amount: 0,
  method: 'pix',
  orderId: null,
  createdAt: nowIso(),
});

export default function FinancePage() {
  const { db, ctx, saveTransaction, deleteTransaction } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('mes');
  const [typeFilter, setTypeFilter] = useState<'todos' | 'entrada' | 'saida'>('todos');
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [del, setDel] = useState<Transaction | null>(null);
  const range = periodRange(period);

  const tx = useMemo(() => db.transactions.filter((t) => inRange(t.date, range)).sort((a, b) => b.date.localeCompare(a.date)), [db.transactions, range]);
  const income = tx.filter((t) => t.type === 'entrada').reduce((a, t) => a + t.amount, 0);
  const expense = tx.filter((t) => t.type === 'saida').reduce((a, t) => a + t.amount, 0);

  const totals = useMemo(() => db.orders.map((o) => ({ o, t: orderTotals(o, db.transactions, db.recipes, ctx) })), [db, ctx]);
  const receivable = totals.filter(({ o, t }) => o.status !== 'cancelado' && o.status !== 'orcamento' && t.remaining > 0.004);
  const receivableSum = receivable.reduce((a, x) => a + x.t.remaining, 0);
  const delivered = totals.filter(({ o }) => o.status === 'entregue' && inRange(o.deliveryAt, range));
  const deliveredRevenue = delivered.reduce((a, x) => a + x.t.total, 0);
  const deliveredProfit = delivered.filter((x) => !x.t.costMissing).reduce((a, x) => a + x.t.profit, 0);
  const deliveredMissing = delivered.some((x) => x.t.costMissing);

  const chart = useMemo(() => {
    const buckets = new Map<string, { k: string; label: string; Entradas: number; Saídas: number }>();
    for (const t of tx) {
      const local = toLocalDate(t.date);
      const k = range.byDay ? local : local.slice(0, 7);
      const label = range.byDay ? local.slice(8, 10) : monthLabel(k).slice(0, 3) + '/' + k.slice(2, 4);
      const b = buckets.get(k) ?? { k, label, Entradas: 0, Saídas: 0 };
      if (t.type === 'entrada') b.Entradas += t.amount;
      else b.Saídas += t.amount;
      buckets.set(k, b);
    }
    return [...buckets.values()].sort((a, b) => a.k.localeCompare(b.k)).map((b) => ({ ...b, Entradas: Math.round(b.Entradas * 100) / 100, Saídas: Math.round(b.Saídas * 100) / 100 }));
  }, [tx, range.byDay]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tx) if (t.type === 'saida') m.set(t.category, (m.get(t.category) ?? 0) + t.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [tx]);

  const shown = tx.filter((t) => typeFilter === 'todos' || t.type === typeFilter);

  const save = () => {
    if (!editing) return;
    if (!(editing.amount > 0)) return toast('Informe um valor maior que zero', 'error');
    saveTransaction({ ...editing, description: editing.description.trim() });
    toast(editing.type === 'entrada' ? 'Entrada salva' : 'Saída salva');
    setEditing(null);
  };

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show">
      <PageHeader
        title="Financeiro"
        subtitle="Dinheiro que entrou e saiu, valores a receber e lucro dos pedidos entregues."
        actions={
          <>
            <Button onClick={() => setEditing(blank('saida'))}>
              <ArrowDownRight size={16} className="text-loss" /> Nova saída
            </Button>
            <Button variant="primary" onClick={() => setEditing(blank('entrada'))}>
              <ArrowUpRight size={16} /> Nova entrada
            </Button>
          </>
        }
      />

      <motion.div variants={stagger.item} className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'mes', label: 'Este mês' },
            { value: 'anterior', label: 'Mês anterior' },
            { value: 'ano', label: 'Este ano' },
            { value: 'tudo', label: 'Tudo' },
          ]}
        />
        <span className="text-sm text-muted">{range.label.charAt(0).toUpperCase() + range.label.slice(1)}</span>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        {[
          { label: 'Entradas', value: income, icon: <ArrowUpRight size={16} />, tone: 'bg-profit-soft text-profit', foot: `${tx.filter((t) => t.type === 'entrada').length} lançamentos` },
          { label: 'Saídas', value: expense, icon: <ArrowDownRight size={16} />, tone: 'bg-loss-soft text-loss', foot: `${tx.filter((t) => t.type === 'saida').length} lançamentos` },
          { label: 'Saldo do período', value: income - expense, icon: <Wallet size={16} />, tone: income - expense >= 0 ? 'bg-profit-soft text-profit' : 'bg-loss-soft text-loss', foot: 'entradas − saídas' },
          { label: 'A receber', value: receivableSum, icon: <Clock size={16} />, tone: 'bg-warn-soft text-warn', foot: `${receivable.length} pedidos (qualquer data)` },
          {
            label: 'Lucro dos entregues',
            value: deliveredProfit,
            icon: <PiggyBank size={16} />,
            tone: 'bg-lilac-soft text-lilac',
            foot: deliveredRevenue > 0 ? `${delivered.length} pedidos · margem ${pct((deliveredProfit / deliveredRevenue) * 100)}` : `${delivered.length} pedidos`,
          },
        ].map((k) => (
          <motion.div key={k.label} variants={stagger.item} className={k.label === 'Lucro dos entregues' ? 'col-span-2 xl:col-span-1' : ''}>
            <Card className="h-full p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[13px] font-medium text-muted">{k.label}</span>
                <span className={cx('grid h-8 w-8 place-items-center rounded-lg', k.tone)}>{k.icon}</span>
              </div>
              <AnimatedCounter value={k.value} format={money} className={cx('mt-2 block text-2xl font-bold', k.label === 'Saldo do período' && k.value < 0 && 'text-loss')} />
              <div className="mt-1 text-xs text-muted">{k.foot}</div>
            </Card>
          </motion.div>
        ))}
      </div>
      {deliveredMissing && <p className="mt-2 text-xs text-warn">Algum pedido entregue tem item avulso sem custo conhecido e ficou fora do lucro.</p>}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <motion.div variants={stagger.item} className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader title="Entradas x Saídas" subtitle={range.byDay ? 'Por dia' : 'Por mês'} />
            {chart.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">Sem lançamentos no período.</p>
            ) : (
              <div className="h-[280px] p-4">
                <ResponsiveContainer>
                  <BarChart data={chart} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid vertical={false} stroke="rgb(var(--divider))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `R$${v}`} tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }} axisLine={false} tickLine={false} width={64} />
                    <Tooltip
                      cursor={{ fill: 'rgb(var(--subtle))' }}
                      content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
                            <div className="mb-1 font-semibold">{label}</div>
                            {payload.map((p) => (
                              <div key={String(p.dataKey)} className="flex items-center gap-2">
                                <i className="h-2 w-2 rounded-sm" style={{ background: p.color }} /> {String(p.dataKey)}: {money(Number(p.value))}
                              </div>
                            ))}
                          </div>
                        ) : null
                      }
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Entradas" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={28} animationDuration={500} />
                    <Bar dataKey="Saídas" fill="#DB2777" radius={[4, 4, 0, 0]} maxBarSize={28} animationDuration={500} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div variants={stagger.item} className="xl:col-span-4">
          <Card className="h-full">
            <CardHeader title="Saídas por categoria" />
            {byCategory.length === 0 ? (
              <p className="p-5 text-sm text-muted">Nenhuma saída no período.</p>
            ) : (
              <ul className="space-y-3 p-5">
                {byCategory.map(([cat, v]) => (
                  <li key={cat}>
                    <div className="flex justify-between text-[13px]">
                      <span className="font-medium">{cat}</span>
                      <span className="tabular text-muted">
                        {money(v)} · {pct((v / expense) * 100, 0)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-divider">
                      <motion.div className="h-full rounded-full bg-pink" initial={{ width: 0 }} animate={{ width: `${(v / byCategory[0][1]) * 100}%` }} transition={{ type: 'spring', stiffness: 160, damping: 24 }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </motion.div>

        <motion.div variants={stagger.item} className="xl:col-span-8">
          <Card>
            <CardHeader
              title="Lançamentos"
              actions={
                <Segmented
                  value={typeFilter}
                  onChange={setTypeFilter}
                  options={[
                    { value: 'todos', label: 'Todos' },
                    { value: 'entrada', label: 'Entradas' },
                    { value: 'saida', label: 'Saídas' },
                  ]}
                />
              }
            />
            {shown.length === 0 ? (
              <EmptyState
                icon={<Wallet size={22} />}
                title="Sem lançamentos"
                text="Pagamentos de pedidos entram aqui automaticamente. Lance também as compras e despesas da confeitaria."
                action={
                  <Button onClick={() => setEditing(blank('saida'))}>
                    <Plus size={16} /> Lançar despesa
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="bg-subtle/70 text-left text-xs text-muted">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Data</th>
                      <th className="px-3 py-2.5 font-medium">Descrição</th>
                      <th className="px-3 py-2.5 font-medium">Categoria</th>
                      <th className="px-3 py-2.5 text-right font-medium">Valor</th>
                      <th className="w-24 px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {shown.map((t) => {
                      const order = t.orderId ? db.orders.find((o) => o.id === t.orderId) : null;
                      return (
                        <tr key={t.id} className="hover:bg-subtle/50">
                          <td className="whitespace-nowrap px-5 py-3 text-muted">{date(t.date)}</td>
                          <td className="px-3 py-3">
                            <div className="font-medium">{t.description || t.category}</div>
                            <div className="text-xs text-muted">
                              {t.method ? METHOD_LABEL[t.method] : ''}
                              {order && (
                                <>
                                  {t.method ? ' · ' : ''}
                                  <button className="text-pink hover:underline" onClick={() => navigate(`/pedidos?pedido=${order.id}`)}>
                                    pedido #{order.number}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <Badge tone={t.type === 'entrada' ? 'green' : 'gray'}>{t.category}</Badge>
                          </td>
                          <td className={cx('whitespace-nowrap px-3 py-3 text-right font-semibold tabular', t.type === 'entrada' ? 'text-profit' : 'text-loss')}>
                            {t.type === 'entrada' ? '+' : '−'} {money(t.amount)}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex justify-end gap-1">
                              <IconButton label="Editar" onClick={() => setEditing({ ...t })}>
                                <Pencil size={15} />
                              </IconButton>
                              <IconButton label="Excluir" onClick={() => setDel(t)}>
                                <Trash size={15} />
                              </IconButton>
                            </div>
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

        <motion.div variants={stagger.item} className="xl:col-span-4">
          <Card>
            <CardHeader title="A receber" subtitle="Pedidos confirmados com saldo em aberto" />
            {receivable.length === 0 ? (
              <p className="p-5 text-sm text-muted">Nada pendente.</p>
            ) : (
              <ul className="divide-y divide-divider">
                {receivable
                  .sort((a, b) => a.o.deliveryAt.localeCompare(b.o.deliveryAt))
                  .map(({ o, t }) => (
                    <li key={o.id}>
                      <button type="button" onClick={() => navigate(`/pedidos?pedido=${o.id}`)} className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-subtle/60">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            #{o.number} · {o.customerName || 'sem cliente'}
                          </span>
                          <span className="text-xs text-muted">entrega {date(o.deliveryAt)}</span>
                        </span>
                        <span className="text-sm font-semibold tabular text-warn">{money(t.remaining)}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </motion.div>
      </div>

      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing ? (db.transactions.some((x) => x.id === editing.id) ? 'Editar lançamento' : editing.type === 'entrada' ? 'Nova entrada' : 'Nova saída') : ''}>
        {editing && (
          <form
            className="space-y-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <Segmented
              value={editing.type}
              onChange={(v) => setEditing({ ...editing, type: v, category: v === 'entrada' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0] })}
              options={[
                { value: 'entrada', label: 'Entrada' },
                { value: 'saida', label: 'Saída' },
              ]}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor">
                <NumberInput autoFocus value={editing.amount} min={0} prefix="R$" onChange={(v) => setEditing({ ...editing, amount: v })} />
              </Field>
              <Field label="Data">
                <TextInput type="date" value={toLocalDate(editing.date)} onChange={(e) => e.target.value && setEditing({ ...editing, date: fromLocalDate(e.target.value) })} />
              </Field>
            </div>
            <Field label="Categoria">
              <Select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                {(editing.type === 'entrada' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                  <option key={c}>{c}</option>
                ))}
                {![...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES].includes(editing.category) && <option>{editing.category}</option>}
              </Select>
            </Field>
            <Field label="Descrição">
              <TextInput value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder={editing.type === 'saida' ? 'Ex.: compra no atacado' : 'Ex.: venda na feira'} />
            </Field>
            <Field label="Forma de pagamento">
              <Select value={editing.method ?? ''} onChange={(e) => setEditing({ ...editing, method: (e.target.value || null) as PaymentMethod | null })}>
                <option value="">—</option>
                {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABEL[m]}
                  </option>
                ))}
              </Select>
            </Field>
            {editing.type === 'saida' && editing.category === 'Ingredientes' && (
              <p className="rounded-lg border border-line bg-subtle p-3 text-xs text-muted">
                Lançar a compra aqui registra o dinheiro que saiu. Para que o custo dos produtos mude, atualize também o preço em Ingredientes.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => setEditing(null)}>Cancelar</Button>
              <Button variant="primary" type="submit">
                Salvar
              </Button>
            </div>
          </form>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        danger
        title="Excluir lançamento?"
        confirmLabel="Excluir"
        onConfirm={() => {
          if (!del) return;
          deleteTransaction(del.id);
          toast('Lançamento excluído');
        }}
      >
        {del?.description || del?.category} · {del && money(del.amount)}
        {del?.orderId && <p className="mt-2 text-xs text-muted">Este lançamento está ligado a um pedido; o valor pago do pedido será recalculado.</p>}
      </ConfirmDialog>
    </motion.div>
  );
}
