import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GitCompare, Trash, ArrowRight } from 'lucide-react';
import { money, number, pct, UNIT_LABEL, uid, baseUnit, moneyFine } from '../lib/format';
import { computePricing, ingredientPricePerBase, materialUnitPrice, type PricingResult } from '../lib/pricing';
import type { Ingredient, Material } from '../lib/types';
import { ADJUSTMENT_LABEL, applyAdjustments, type Adjustment, type AdjustmentType, type ScenarioInput } from '../lib/scenarios';
import { AnimatedCounter } from './motion';
import { Card, CardHeader, cx, Field, IconButton, NumberInput, Select, TextInput } from './ui';

const PRESETS: { label: string; make: (b: ScenarioInput) => Adjustment | null }[] = [
  {
    label: '+15% em um ingrediente',
    make: (b) => (b.comp.ingredients[0] ? { id: uid(), type: 'ingredientPrice', ingredientId: b.comp.ingredients[0].ingredientId, percent: 15 } : null),
  },
  { label: 'Preço −10%', make: () => ({ id: uid(), type: 'salePrice', percent: -10 }) },
  { label: 'Produzir 10', make: () => ({ id: uid(), type: 'quantity', units: 10 }) },
  { label: 'Produzir 20', make: () => ({ id: uid(), type: 'quantity', units: 20 }) },
  { label: 'Produzir 50', make: () => ({ id: uid(), type: 'quantity', units: 50 }) },
  {
    label: 'Embalagem mais barata',
    make: (b) => {
      const line = b.comp.materials.find((l) => b.ctx.materials.find((m) => m.id === l.materialId)?.kind === 'embalagem') ?? b.comp.materials[0];
      if (!line) return null;
      const cur = b.ctx.materials.find((m) => m.id === line.materialId);
      // the closest cheaper option of the same kind is most likely a real substitute (box → cheaper box, not box → cupcake liner)
      const curPrice = cur ? materialUnitPrice(cur) : Infinity;
      const alt = b.ctx.materials
        .filter((m) => m.id !== line.materialId && m.kind === cur?.kind && materialUnitPrice(m) < curPrice)
        .sort((x, y) => materialUnitPrice(y) - materialUnitPrice(x))[0];
      return { id: uid(), type: 'swapMaterial', fromId: line.materialId, toId: alt?.id ?? line.materialId };
    },
  },
  { label: 'Aumentar margem', make: (b) => ({ id: uid(), type: 'margin', marginPct: Math.min(90, b.params.marginPct + 10) }) },
  { label: 'Incluir taxa de cartão', make: (b) => ({ id: uid(), type: 'cardFee', percent: b.params.cardFeePct }) },
  { label: 'Desconto promocional', make: () => ({ id: uid(), type: 'discount', percent: 10 }) },
  { label: 'Alterar tempo de preparo', make: (b) => ({ id: uid(), type: 'prepTime', minutes: b.comp.prepMinutes + 30 }) },
  {
    label: 'Comparar fornecedor',
    make: (b) => {
      const l = b.comp.ingredients[0];
      const ing = l && b.ctx.ingredients.find((i) => i.id === l.ingredientId);
      return ing ? { id: uid(), type: 'supplier', ingredientId: ing.id, packagePrice: ing.packagePrice, packageQty: ing.packageQty, supplier: '' } : null;
    },
  },
];

type Row = { label: string; get: (r: PricingResult) => number; fmt: (v: number) => string; better: 'up' | 'down' };
const ROWS: Row[] = [
  { label: 'Custo total da produção', get: (r) => r.totalCost, fmt: money, better: 'down' },
  { label: 'Custo unitário', get: (r) => r.unitCost, fmt: money, better: 'down' },
  { label: 'Preço de venda (efetivo)', get: (r) => r.effectivePrice, fmt: money, better: 'up' },
  { label: 'Lucro por unidade', get: (r) => r.unitProfit, fmt: money, better: 'up' },
  { label: 'Lucro total estimado', get: (r) => r.totalProfit, fmt: money, better: 'up' },
  { label: 'Margem de lucro', get: (r) => r.profitMarginPct, fmt: (v) => pct(v), better: 'up' },
  { label: 'Margem de contribuição', get: (r) => r.contributionMarginPct, fmt: (v) => pct(v), better: 'up' },
  { label: 'Preço mínimo', get: (r) => r.minPrice, fmt: money, better: 'down' },
  { label: 'Preço sugerido', get: (r) => r.suggestedPrice, fmt: money, better: 'down' },
];

export function ScenarioSimulator({ base, baseResult }: { base: ScenarioInput; baseResult: PricingResult }) {
  const [adjs, setAdjs] = useState<Adjustment[]>([]);
  const sim = useMemo(() => {
    const input = applyAdjustments(base, adjs);
    return computePricing(input.comp, input.params, input.ctx);
  }, [base, adjs]);

  const add = (a: Adjustment | null) => a && setAdjs((s) => [...s, a]);
  const update = (id: string, patch: Partial<Adjustment>) => setAdjs((s) => s.map((a) => (a.id === id ? ({ ...a, ...patch } as Adjustment) : a)));
  const compIngs = base.comp.ingredients.map((l) => base.ctx.ingredients.find((i) => i.id === l.ingredientId)).filter((i): i is NonNullable<typeof i> => !!i);
  const compMats = base.comp.materials.map((l) => base.ctx.materials.find((m) => m.id === l.materialId)).filter((m): m is NonNullable<typeof m> => !!m);

  return (
    <Card>
      <CardHeader
        icon={<GitCompare size={16} />}
        title="Simular cenários"
        subtitle="Teste mudanças sem alterar fichas, preços ou insumos cadastrados."
        actions={
          adjs.length > 0 && (
            <button type="button" className="text-sm font-medium text-muted hover:text-ink" onClick={() => setAdjs([])}>
              Limpar
            </button>
          )
        }
      />
      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="border-b border-divider p-5 lg:border-b-0 lg:border-r">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Adicionar ajuste</div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => {
              const disabled = p.make(base) === null;
              return (
                <button
                  key={p.label}
                  type="button"
                  disabled={disabled}
                  title={disabled ? 'Adicione itens à composição para usar este ajuste' : undefined}
                  onClick={() => add(p.make(base))}
                  className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-pink/40 hover:bg-pink-soft hover:text-pink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <ul className="mt-4 space-y-2">
            <AnimatePresence initial={false}>
              {adjs.map((a) => (
                <motion.li
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="rounded-xl border border-line bg-subtle/60 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-ink">{ADJUSTMENT_LABEL[a.type as AdjustmentType]}</span>
                    <IconButton label="Remover ajuste" onClick={() => setAdjs((s) => s.filter((x) => x.id !== a.id))}>
                      <Trash size={14} />
                    </IconButton>
                  </div>
                  <AdjustmentEditor a={a} update={(p) => update(a.id, p)} ings={compIngs} mats={compMats} allMats={base.ctx.materials} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {adjs.length === 0 && <p className="mt-4 text-sm text-muted">Escolha um ajuste acima. Você pode combinar vários — por exemplo, insumo mais caro + desconto promocional.</p>}
        </div>

        <div className="p-5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[440px] text-sm">
              <thead>
                <tr className="border-b border-divider text-left text-xs text-muted">
                  <th className="pb-2 font-medium">Indicador</th>
                  <th className="pb-2 text-right font-medium">Original</th>
                  <th className="pb-2 text-right font-medium">Simulado</th>
                  <th className="pb-2 text-right font-medium">Diferença</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {ROWS.map((row) => {
                  const o = row.get(baseResult);
                  const s = row.get(sim);
                  const diff = s - o;
                  const neutral = !Number.isFinite(diff) || Math.abs(diff) < 0.005;
                  const good = row.better === 'up' ? diff > 0 : diff < 0;
                  const isPct = row.fmt(1).includes('%');
                  return (
                    <tr key={row.label}>
                      <td className="py-2 text-ink">{row.label}</td>
                      <td className="py-2 text-right tabular text-muted">{row.fmt(o)}</td>
                      <td className="py-2 text-right font-semibold tabular">
                        <AnimatedCounter value={s} format={row.fmt} />
                      </td>
                      <td className={cx('py-2 text-right text-[13px] font-medium tabular', neutral ? 'text-muted' : good ? 'text-profit' : 'text-loss')}>
                        {neutral ? '—' : `${diff > 0 ? '+' : ''}${isPct ? `${number(diff)} p.p.` : money(diff)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sim.alerts.filter((a) => a.level === 'erro').length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-loss">
              {sim.alerts
                .filter((a) => a.level === 'erro')
                .map((a) => (
                  <li key={a.message}>• {a.message}</li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

function AdjustmentEditor({
  a,
  update,
  ings,
  mats,
  allMats,
}: {
  a: Adjustment;
  update: (p: Partial<Adjustment>) => void;
  ings: Ingredient[];
  mats: Material[];
  allMats: Material[];
}) {
  switch (a.type) {
    case 'ingredientPrice':
      return (
        <div className="grid grid-cols-[1fr_120px] gap-2">
          <Select aria-label="Ingrediente" value={a.ingredientId} onChange={(e) => update({ ingredientId: e.target.value })}>
            {ings.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
          <NumberInput aria-label="Variação" value={a.percent} suffix="%" onChange={(v) => update({ percent: v })} />
        </div>
      );
    case 'supplier': {
      const ing = ings.find((i) => i.id === a.ingredientId);
      const current = ing ? ingredientPricePerBase(ing) : 0;
      const alt = ing && a.packageQty > 0 ? ingredientPricePerBase({ ...ing, packagePrice: a.packagePrice, packageQty: a.packageQty }) : 0;
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Select
              aria-label="Ingrediente"
              value={a.ingredientId}
              onChange={(e) => {
                const n = ings.find((i) => i.id === e.target.value);
                update({ ingredientId: e.target.value, packagePrice: n?.packagePrice ?? 0, packageQty: n?.packageQty ?? 0 });
              }}
            >
              {ings.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </Select>
            <TextInput aria-label="Fornecedor" placeholder="Nome do fornecedor B" value={a.supplier} onChange={(e) => update({ supplier: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Preço da embalagem">
              <NumberInput value={a.packagePrice} min={0} prefix="R$" onChange={(v) => update({ packagePrice: v })} />
            </Field>
            <Field label={`Quantidade (${ing ? UNIT_LABEL[ing.unit] : ''})`}>
              <NumberInput value={a.packageQty} min={0} onChange={(v) => update({ packageQty: v })} />
            </Field>
          </div>
          {ing && (
            <p className="flex flex-wrap items-center gap-1 text-xs text-muted">
              {ing.supplier || 'Atual'}: {moneyFine(current)}/{UNIT_LABEL[baseUnit(ing.unit)]} <ArrowRight size={12} /> {a.supplier || 'Novo'}: <b className={alt < current ? 'text-profit' : alt > current ? 'text-loss' : ''}>{moneyFine(alt)}/{UNIT_LABEL[baseUnit(ing.unit)]}</b>
            </p>
          )}
        </div>
      );
    }
    case 'salePrice':
      return <NumberInput aria-label="Variação do preço" value={a.percent} suffix="%" onChange={(v) => update({ percent: v })} />;
    case 'quantity':
      return (
        <div className="flex items-center gap-2">
          <NumberInput aria-label="Unidades" value={a.units} min={1} suffix="un" onChange={(v) => update({ units: v })} className="w-32" />
          {[10, 20, 50].map((n) => (
            <button key={n} type="button" onClick={() => update({ units: n })} className={cx('h-8 rounded-md border px-2.5 text-xs font-medium', a.units === n ? 'border-pink/40 bg-pink-soft text-pink' : 'border-line hover:bg-surface')}>
              {n}
            </button>
          ))}
        </div>
      );
    case 'swapMaterial': {
      const from = allMats.find((m) => m.id === a.fromId);
      return (
        <div className="grid grid-cols-2 gap-2">
          <Select aria-label="Trocar" value={a.fromId} onChange={(e) => update({ fromId: e.target.value })}>
            {mats.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
          <Select aria-label="Por" value={a.toId} onChange={(e) => update({ toId: e.target.value })}>
            {allMats
              .filter((m) => !from || m.kind === from.kind)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {moneyFine(materialUnitPrice(m))}
                </option>
              ))}
          </Select>
          {a.fromId === a.toId && <p className="col-span-2 text-xs text-warn">Não há outro material do mesmo tipo cadastrado — escolha um substituto.</p>}
        </div>
      );
    }
    case 'margin':
      return <NumberInput aria-label="Margem desejada" value={a.marginPct} min={0} max={95} suffix="%" onChange={(v) => update({ marginPct: v })} />;
    case 'cardFee':
      return (
        <div>
          <NumberInput aria-label="Taxa de cartão" value={a.percent} min={0} max={30} suffix="%" onChange={(v) => update({ percent: v })} />
          {a.percent === 0 && <p className="mt-1 text-xs text-muted">Informe a taxa da sua maquininha.</p>}
        </div>
      );
    case 'discount':
      return <NumberInput aria-label="Desconto" value={a.percent} min={0} max={100} suffix="%" onChange={(v) => update({ percent: v })} />;
    case 'prepTime':
      return <NumberInput aria-label="Tempo de preparo" value={a.minutes} min={0} suffix="min" onChange={(v) => update({ minutes: v })} />;
  }
}
