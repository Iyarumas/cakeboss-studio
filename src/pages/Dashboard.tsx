import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, Boxes, Calculator, ClipboardList, Clock, Flame, Percent, ScrollText, ShoppingBag, Sparkles, TriangleAlert, Wallet, Wheat } from 'lucide-react';
import { useStore } from '../store/store';
import { CATEGORIES, computePricing, defaultParams, priceRecipe, type CostCategory } from '../lib/pricing';
import { dateTime, money, monthKey, number, pct, qtyBase } from '../lib/format';
import { orderTotals } from '../lib/orders';
import { UpcomingOrders } from './Orders';
import { Button, Card, CardHeader, Select, SliderField, cx } from '../components/ui';
import { AnimatedCounter, stagger } from '../components/motion';
import { CostBars, CostDonut } from '../components/CostCharts';

function Kpi({ label, value, icon, foot, tone }: { label: string; value: ReactNode; icon: ReactNode; foot?: ReactNode; tone?: 'pink' | 'lilac' | 'green' | 'amber' | 'red' }) {
  const t = { pink: 'bg-pink-soft text-pink', lilac: 'bg-lilac-soft text-lilac', green: 'bg-profit-soft text-profit', amber: 'bg-warn-soft text-warn', red: 'bg-loss-soft text-loss' }[tone ?? 'pink'];
  return (
    <motion.div variants={stagger.item}>
      <Card className="h-full p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[13px] font-medium text-muted">{label}</span>
          <span className={cx('grid h-8 w-8 place-items-center rounded-lg', t)}>{icon}</span>
        </div>
        <div className="mt-2 text-2xl font-bold tabular">{value}</div>
        {foot && <div className="mt-1 text-xs text-muted">{foot}</div>}
      </Card>
    </motion.div>
  );
}

function PricingWidget() {
  const { db, ctx } = useStore();
  const navigate = useNavigate();
  const [id, setId] = useState(db.recipes[0]?.id ?? '');
  const recipe = db.recipes.find((r) => r.id === id) ?? db.recipes[0];
  const base = useMemo(() => (recipe ? priceRecipe(recipe, ctx) : null), [recipe, ctx]);
  const [price, setPrice] = useState(0);
  useEffect(() => {
    if (recipe && base) setPrice(recipe.salePrice ?? (Number.isFinite(base.suggestedRounded) ? base.suggestedRounded : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe?.id]);
  const r = useMemo(() => (recipe ? computePricing(recipe, { ...defaultParams(recipe, db.settings), salePrice: price }, ctx) : null), [recipe, price, ctx, db.settings]);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        icon={<Calculator size={16} />}
        title="Assistente de Precificação"
        subtitle="Simulação rápida — não altera o preço oficial"
        actions={
          recipe && (
            <Button size="sm" onClick={() => navigate(`/assistente?ficha=${recipe.id}`)}>
              Abrir completo <ArrowRight size={14} />
            </Button>
          )
        }
      />
      {!recipe || !r ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-sm text-muted">
          Crie uma ficha técnica para precificar.
          <Button className="mt-3" size="sm" variant="primary" onClick={() => navigate('/fichas/nova')}>
            Nova ficha técnica
          </Button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4 p-5">
          <Select aria-label="Produto" value={recipe.id} onChange={(e) => setId(e.target.value)}>
            {db.recipes.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-4">
            <CostDonut categories={r.categories} center={r.unitCost} centerLabel="" size={96} per={recipe.unitLabel} />
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <div>
                <div className="text-[11px] text-muted">Custo/{recipe.unitLabel}</div>
                <AnimatedCounter value={r.unitCost} format={money} className="text-base font-semibold" />
              </div>
              <div>
                <div className="text-[11px] text-muted">Lucro/{recipe.unitLabel}</div>
                <AnimatedCounter value={r.unitProfit} format={money} className={cx('text-base font-semibold', r.unitProfit >= 0 ? 'text-profit' : 'text-loss')} />
              </div>
              <div>
                <div className="text-[11px] text-muted">Margem</div>
                <AnimatedCounter value={r.profitMarginPct} format={(v) => pct(v)} className={cx('text-base font-semibold', r.unitProfit >= 0 ? 'text-profit' : 'text-loss')} />
              </div>
              <div>
                <div className="text-[11px] text-muted">Sugerido</div>
                <AnimatedCounter value={r.suggestedPrice} format={money} className="text-base font-semibold text-pink" />
              </div>
            </div>
          </div>
          <SliderField
            label="Preço de venda"
            value={price}
            onChange={setPrice}
            min={0}
            max={Math.max(10, Math.ceil((Math.max(Number.isFinite(r.suggestedPrice) ? r.suggestedPrice : 0, Number.isFinite(r.minPrice) ? r.minPrice : 0, recipe.salePrice ?? 0) * 2.5) / 5) * 5)}
            step={0.1}
            prefix="R$"
            marker={Number.isFinite(r.minPrice) ? { value: r.minPrice, label: `mínimo ${money(r.minPrice)}` } : undefined}
          />
        </div>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const { db, ctx, loadSample } = useStore();
  const navigate = useNavigate();
  const priced = useMemo(() => db.recipes.map((r) => ({ r, p: priceRecipe(r, ctx) })), [db.recipes, ctx]);
  const withPrice = priced.filter((x) => x.r.salePrice != null && x.r.salePrice > 0);
  const avgMargin = withPrice.length ? withPrice.reduce((a, x) => a + x.p.profitMarginPct, 0) / withPrice.length : NaN;
  const belowTarget = withPrice.filter((x) => x.p.profitMarginPct < x.r.targetMarginPct - 0.05);
  const month = monthKey(new Date().toISOString());
  const monthTx = db.transactions.filter((t) => monthKey(t.date) === month);
  const received = monthTx.filter((t) => t.type === 'entrada').reduce((a, t) => a + t.amount, 0);
  const spent = monthTx.filter((t) => t.type === 'saida').reduce((a, t) => a + t.amount, 0);
  const receivable = db.orders
    .filter((o) => o.status !== 'cancelado' && o.status !== 'orcamento')
    .reduce((a, o) => a + orderTotals(o, db.transactions, db.recipes, ctx).remaining, 0);
  const lowStock = [
    ...db.ingredients.filter((i) => i.minStock > 0 && i.stock <= i.minStock).map((i) => ({ id: i.id, name: i.name, label: qtyBase(i.stock, i.unit), ratio: i.stock / i.minStock, to: '/ingredientes' })),
    ...db.materials.filter((m) => m.minStock > 0 && m.stock <= m.minStock).map((m) => ({ id: m.id, name: m.name, label: `${number(m.stock)} un`, ratio: m.stock / m.minStock, to: '/materiais' })),
  ].sort((a, b) => a.ratio - b.ratio);

  const aggregate: CostCategory[] = useMemo(() => {
    const tot: Record<string, number> = {};
    for (const { p } of priced) for (const c of p.categories) tot[c.key] = (tot[c.key] ?? 0) + c.total;
    const sum = Object.values(tot).reduce((a, b) => a + b, 0);
    return CATEGORIES.map((c) => ({ ...c, total: tot[c.key] ?? 0, perUnit: tot[c.key] ?? 0, pct: sum > 0 ? ((tot[c.key] ?? 0) / sum) * 100 : 0, origin: [] }));
  }, [priced]);
  const aggTotal = aggregate.reduce((a, c) => a + c.total, 0);

  const marginData = withPrice.map((x) => ({ name: x.r.name, margem: Math.round(x.p.profitMarginPct * 10) / 10, alvo: x.r.targetMarginPct }));
  const owner = db.settings.ownerName;

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show">
      <motion.div variants={stagger.item} className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Olá{owner ? `, ${owner}` : ''}! 👋</h1>
        <p className="mt-1 text-sm text-muted">Resumo dos custos e preços da {db.settings.businessName || 'sua confeitaria'}.</p>
      </motion.div>

      {db.recipes.length === 0 ? (
        <motion.div variants={stagger.item}>
          <Card>
            <CardHeader icon={<Sparkles size={16} />} title="Vamos começar" subtitle="Quatro passos para descobrir o preço certo de cada produto." />
            <ol className="grid gap-px bg-divider sm:grid-cols-2 xl:grid-cols-4 [&>*]:bg-surface">
              {[
                { n: 1, t: 'Custos operacionais', d: 'Gás, energia, sua hora de trabalho e custos fixos.', to: '/custos', icon: <Flame size={18} /> },
                { n: 2, t: 'Ingredientes e materiais', d: 'Preço, tamanho da embalagem, estoque e quando avisar que está acabando.', to: '/ingredientes', icon: <Wheat size={18} /> },
                { n: 3, t: 'Ficha técnica', d: 'A receita de um lote e quanto ela rende.', to: '/fichas/nova', icon: <ClipboardList size={18} /> },
                { n: 4, t: 'Assistente', d: 'Veja custo, lucro e o preço sugerido em tempo real.', to: '/assistente', icon: <Calculator size={18} /> },
              ].map((s) => (
                <li key={s.n}>
                  <Link to={s.to} className="group flex h-full flex-col gap-2 p-5 hover:bg-subtle/60">
                    <span className="flex items-center gap-2 text-pink">
                      {s.icon}
                      <span className="text-xs font-semibold">Passo {s.n}</span>
                    </span>
                    <span className="font-semibold">{s.t}</span>
                    <span className="text-sm text-muted">{s.d}</span>
                    <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-pink opacity-0 transition-opacity group-hover:opacity-100">
                      Abrir <ArrowRight size={14} />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-divider px-5 py-4 text-sm text-muted">
              Quer ver como funciona antes de cadastrar? Carregue dados de exemplo (removíveis a qualquer momento).
              <Button onClick={loadSample}>Carregar dados de exemplo</Button>
            </div>
          </Card>
        </motion.div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Fichas técnicas" value={db.recipes.length} icon={<ClipboardList size={16} />} foot={`${db.recipes.length - withPrice.length} sem preço oficial`} />
            <Kpi
              label="Margem média"
              value={<AnimatedCounter value={avgMargin} format={(v) => pct(v)} />}
              icon={<Percent size={16} />}
              tone={Number.isFinite(avgMargin) && avgMargin < 0 ? 'red' : 'green'}
              foot="produtos com preço"
            />
            <Kpi label="Abaixo da margem" value={belowTarget.length} icon={<TriangleAlert size={16} />} tone={belowTarget.length ? 'red' : 'green'} foot="margem < desejada" />
            <Kpi label="Recebido no mês" value={<AnimatedCounter value={received} format={money} />} icon={<Wallet size={16} />} tone="green" foot={`saídas ${money(spent)}`} />
            <Kpi label="A receber" value={<AnimatedCounter value={receivable} format={money} />} icon={<Clock size={16} />} tone="amber" foot="pedidos confirmados" />
            <Kpi label="Estoque baixo" value={lowStock.length} icon={<Boxes size={16} />} tone={lowStock.length ? 'amber' : 'green'} foot="itens no mínimo" />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <motion.div variants={stagger.item} className="xl:col-span-5">
              <PricingWidget />
            </motion.div>
            <motion.div variants={stagger.item} className="xl:col-span-7">
              <Card className="flex h-full flex-col">
                <CardHeader title="Margem de lucro por produto" subtitle="Comparada à margem desejada de cada ficha" />
                {marginData.length === 0 ? (
                  <p className="flex flex-1 items-center justify-center p-6 text-sm text-muted">Nenhum produto com preço oficial ainda.</p>
                ) : (
                  <div className="h-full min-h-[260px] flex-1 p-4">
                    <ResponsiveContainer width="100%" height={Math.max(220, marginData.length * 44)}>
                      <BarChart data={marginData} layout="vertical" margin={{ left: 8, right: 24 }}>
                        <CartesianGrid horizontal={false} stroke="rgb(var(--divider))" />
                        <XAxis type="number" unit="%" tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12, fill: 'rgb(var(--text))' }} axisLine={false} tickLine={false} />
                        <ReferenceLine x={0} stroke="rgb(var(--border))" />
                        <Tooltip
                          cursor={{ fill: 'rgb(var(--subtle))' }}
                          content={({ active, payload }) =>
                            active && payload?.[0] ? (
                              <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
                                <div className="font-semibold">{payload[0].payload.name}</div>
                                <div>Margem: {pct(payload[0].payload.margem)}</div>
                                <div className="text-muted">Desejada: {pct(payload[0].payload.alvo, 0)}</div>
                              </div>
                            ) : null
                          }
                        />
                        <Bar dataKey="margem" radius={[0, 6, 6, 0]} barSize={18} animationDuration={500}>
                          {marginData.map((d) => (
                            <Cell key={d.name} fill={d.margem < 0 ? '#DC2626' : d.margem < d.alvo ? '#D97706' : '#059669'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </motion.div>

            <motion.div variants={stagger.item} className="xl:col-span-12">
              <Card>
                <CardHeader
                  icon={<ShoppingBag size={16} />}
                  title="Próximos pedidos"
                  subtitle="Confirmados, em produção e prontos"
                  actions={
                    <Button size="sm" onClick={() => navigate('/pedidos')}>
                      Ver pedidos
                    </Button>
                  }
                />
                <UpcomingOrders limit={6} />
              </Card>
            </motion.div>

            <motion.div variants={stagger.item} className="xl:col-span-4">
              <Card className="h-full">
                <CardHeader title="Composição de custos" subtitle="Soma de um lote de cada ficha técnica" />
                <div className="p-5">
                  <CostDonut categories={aggregate} center={aggTotal} centerLabel="todas as fichas" per="lote" size={170} />
                  <div className="mt-4">
                    <CostBars categories={aggregate} per="lote" limit={5} />
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div variants={stagger.item} className="xl:col-span-4">
              <Card className="h-full">
                <CardHeader
                  title="Controle de estoque"
                  subtitle="Itens no mínimo ou abaixo"
                  actions={
                    <Button size="sm" onClick={() => navigate('/estoque')}>
                      Ver todos
                    </Button>
                  }
                />
                {lowStock.length === 0 ? (
                  <p className="p-5 text-sm text-muted">Nenhum item abaixo do mínimo.</p>
                ) : (
                  <ul className="divide-y divide-divider">
                    {lowStock.slice(0, 6).map((x) => (
                      <li key={x.id} className="flex items-center gap-3 px-5 py-2.5">
                        <Link to={x.to} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-pink">
                          {x.name}
                        </Link>
                        <span className="text-xs tabular text-muted">{x.label}</span>
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-divider">
                          <motion.div className={cx('h-full rounded-full', x.ratio <= 0.5 ? 'bg-loss' : 'bg-warn')} initial={{ width: 0 }} animate={{ width: `${Math.max(4, Math.min(100, x.ratio * 100))}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </motion.div>

            <motion.div variants={stagger.item} className="xl:col-span-4">
              <Card className="h-full">
                <CardHeader
                  icon={<ScrollText size={16} />}
                  title="Atividade recente"
                  actions={
                    <Button size="sm" onClick={() => navigate('/historico')}>
                      Histórico
                    </Button>
                  }
                />
                <ul className="divide-y divide-divider">
                  {db.history.slice(0, 6).map((h) => (
                    <li key={h.id} className="px-5 py-2.5">
                      <div className="truncate text-sm">{h.message}</div>
                      <div className="text-xs text-muted">{dateTime(h.at)}</div>
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          </div>
        </>
      )}
    </motion.div>
  );
}
