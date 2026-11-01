import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Calculator, Check, ChartPie, CircleDollarSign, FolderOpen, GitCompare, Info, Save, TriangleAlert, Undo2, Trash, TrendingDown, TrendingUp, Link2, Unlink2 } from 'lucide-react';
import { useStore } from '../store/store';
import { computePricing, defaultParams, emptyComposition, priceRecipe, type CategoryKey, type PricingResult } from '@cakeboss/domain/pricing';
import { clamp, date, dateTime, money, number, pct } from '@cakeboss/domain/format';
import type { Composition, PricingParams, Recipe } from '@cakeboss/domain/types';
import { Badge, Button, Card, CardHeader, cx, Field, NumberInput, Select, SliderField, TextInput } from '../components/ui';
import { AnimatedCounter, ConfirmDialog, Drawer, Modal, stagger, Tip, useToast } from '../components/motion';
import { CompositionEditor } from '../components/CompositionEditor';
import { CostBars, CostDonut } from '../components/CostCharts';
import { ScenarioSimulator } from '../components/ScenarioSimulator';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function initialFor(recipe: Recipe | null, settings: Parameters<typeof defaultParams>[1], ctx: Parameters<typeof computePricing>[2]) {
  if (!recipe) {
    const comp = emptyComposition();
    return { comp, params: defaultParams({ yield: 1, salePrice: null, targetMarginPct: settings.defaultMarginPct, wastePct: 0 }, settings) };
  }
  const comp: Composition = clone({
    yield: recipe.yield,
    unitLabel: recipe.unitLabel,
    prepMinutes: recipe.prepMinutes,
    wastePct: recipe.wastePct,
    waterLiters: recipe.waterLiters,
    ingredients: recipe.ingredients,
    materials: recipe.materials,
    equipment: recipe.equipment,
    otherCosts: recipe.otherCosts,
  });
  const params = defaultParams(recipe, settings);
  if (recipe.salePrice == null) {
    // no official price yet: start from the suggested price so the numbers are meaningful
    const r = computePricing(comp, params, ctx);
    if (Number.isFinite(r.suggestedRounded)) params.salePrice = r.suggestedRounded;
  }
  return { comp, params };
}

export default function Assistant() {
  const { db, ctx, saveSimulation, deleteSimulation, applyPrice } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const recipeId = search.get('ficha');
  const original = db.recipes.find((r) => r.id === recipeId) ?? null;

  const [state, setState] = useState(() => initialFor(original, db.settings, ctx));
  const loadedFor = useRef<string | null>(recipeId);
  useEffect(() => {
    if (loadedFor.current === recipeId) return;
    loadedFor.current = recipeId;
    setState(initialFor(original, db.settings, ctx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId]);

  const { comp, params } = state;
  const setComp = (c: Composition) => setState((s) => ({ ...s, comp: c }));
  const setParam = (patch: Partial<PricingParams>) => setState((s) => ({ ...s, params: { ...s.params, ...patch } }));

  const effComp = useMemo(() => ({ ...comp, wastePct: params.wastePct }), [comp, params.wastePct]);
  const result = useMemo(() => computePricing(effComp, params, ctx), [effComp, params, ctx]);
  const originalResult = useMemo(() => (original ? priceRecipe(original, ctx) : null), [original, ctx]);
  const modified = useMemo(() => {
    if (!original) return false;
    const o = initialFor(original, db.settings, ctx).comp;
    return JSON.stringify(o) !== JSON.stringify({ ...comp, wastePct: original.wastePct }) || params.wastePct !== original.wastePct;
  }, [original, comp, params.wastePct, db.settings, ctx]);

  const [activeCat, setActiveCat] = useState<CategoryKey | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [simName, setSimName] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);
  const scenarioRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  // Sticky side panel without its own scrollbar: when it is taller than the window it scrolls
  // along with the page and only sticks once its bottom edge is visible.
  const [stickTop, setStickTop] = useState(24);
  useEffect(() => {
    const el = summaryRef.current;
    if (!el) return;
    const update = () => setStickTop(Math.min(24, window.innerHeight - el.offsetHeight - 24));
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    update();
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const per = comp.unitLabel || 'unidade';
  // Slider ranges must not depend on the value being dragged, or the scale grows under the
  // thumb and the value runs away. Typed values above the range still work (thumb stays at the end).
  const finite = (v: number) => (Number.isFinite(v) ? v : 0);
  // Price range = price that reaches the margin slider's maximum (80%). It depends only on cost, fees and
  // discount — never on the current price or margin, which are linked and would feed each other.
  const v = result.variablePct / 100;
  const disc = Math.min(params.discountPct || 0, 99) / 100;
  const atMaxMargin = 1 - v - 0.8 > 0 ? finite(result.unitCost) / (1 - v - 0.8) / (1 - disc) : finite(result.minPrice) * 4;
  const priceMax = Math.max(10, Math.ceil(Math.max(atMaxMargin, (original?.salePrice ?? 0) * 1.2) / 10) * 10);
  const qtyMax = Math.max(100, Math.ceil((comp.yield * 20) / 50) * 50);

  const doSave = () => {
    const name = simName.trim() || `${original?.name ?? 'Nova simulação'} · ${money(params.salePrice)}`;
    saveSimulation({ name, recipeId: original?.id ?? null, composition: effComp, params, unitCost: result.unitCost, profitMarginPct: result.profitMarginPct });
    setSaveOpen(false);
    setSimName('');
    setSavedPulse(true);
    setTimeout(() => setSavedPulse(false), 1600);
    toast('Simulação salva');
  };

  const selectProduct = (id: string) => {
    if (id) setSearch({ ficha: id });
    else {
      setSearch({});
      loadedFor.current = null;
      setState(initialFor(null, db.settings, ctx));
    }
  };

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="pb-24 lg:pb-0">
      <motion.div variants={stagger.item} className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Assistente de Precificação</h1>
            <Badge tone="lilac">Simulação</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">Monte o produto, veja cada custo e descubra o preço certo. Nada aqui altera seus cadastros sem confirmação.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Produto" value={recipeId ?? ''} onChange={(e) => selectProduct(e.target.value)} className="w-64">
            <option value="">Nova simulação (em branco)</option>
            {db.recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <Button onClick={() => setListOpen(true)}>
            <FolderOpen size={16} /> Simulações ({db.simulations.length})
          </Button>
          <Button variant="primary" onClick={() => setSaveOpen(true)}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={savedPulse ? 'ok' : 'save'} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} className="inline-flex">
                {savedPulse ? <Check size={16} /> : <Save size={16} />}
              </motion.span>
            </AnimatePresence>
            {savedPulse ? 'Salva!' : 'Salvar simulação'}
          </Button>
        </div>
      </motion.div>

      {original && (
        <motion.div variants={stagger.item} className="mb-5 flex flex-col gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Ficha técnica:</span>
            <b>{original.name}</b>
            {original.salePrice != null ? <Badge tone="green">preço oficial {money(original.salePrice)}</Badge> : <Badge tone="amber">sem preço oficial</Badge>}
            {modified && <Badge tone="pink">composição alterada na simulação</Badge>}
          </div>
          <div className="flex flex-wrap gap-2">
            {modified && (
              <Button size="sm" variant="ghost" onClick={() => setState(initialFor(original, db.settings, ctx))}>
                <Undo2 size={15} /> Desfazer alterações
              </Button>
            )}
            <Button size="sm" onClick={() => scenarioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              <GitCompare size={15} /> Comparar cenários
            </Button>
            <Button size="sm" onClick={() => navigate(`/fichas/${original.id}`)}>
              <ArrowLeft size={15} /> Voltar à ficha técnica
            </Button>
            <Button size="sm" variant="primary" onClick={() => setApplyOpen(true)} disabled={!(params.salePrice > 0)}>
              <CircleDollarSign size={15} /> Aplicar preço à ficha
            </Button>
          </div>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={recipeId ?? 'new'}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(440px,38%)]"
        >
          <div className="min-w-0 space-y-5">
            {/* Área 1 */}
            <Card>
              <CardHeader icon={<Calculator size={16} />} title="1 · Montagem do produto" subtitle="Cada alteração recalcula os custos na hora." />
              <CompositionEditor value={comp} onChange={setComp} ctx={ctx} hideWaste />
            </Card>

            {/* Área 2 */}
            <Card>
              <CardHeader
                icon={<ChartPie size={16} />}
                title="2 · Composição dos custos"
                subtitle={`Por ${per} aproveitável · passe o mouse ou toque para ver a origem de cada valor`}
              />
              <div className="grid gap-6 p-5 md:grid-cols-[240px_minmax(0,1fr)] md:items-center">
                <div>
                  <CostDonut categories={result.categories} center={result.unitCost} centerLabel={`custo por ${per}`} per={per} active={activeCat} onActive={setActiveCat} size={230} />
                  <div className="mt-3 text-center text-xs text-muted">
                    Produção de {number(result.quantity)} {per} · {number(result.usableUnits)} aproveitáveis · {result.runs} lote(s)
                  </div>
                </div>
                <CostBars categories={result.categories} per={per} active={activeCat} onActive={setActiveCat} />
              </div>
            </Card>
          </div>

          {/* Área 3 */}
          <div ref={summaryRef} style={{ top: stickTop }} className="min-w-0 scroll-mt-4 xl:sticky xl:self-start">
            <PricingPanel result={result} params={params} setParam={setParam} per={per} priceMax={priceMax} qtyMax={qtyMax} original={original} originalResult={originalResult} />
          </div>
        </motion.div>
      </AnimatePresence>

      <div ref={scenarioRef} className="mt-5 scroll-mt-6">
        <ScenarioSimulator base={{ comp: effComp, params, ctx }} baseResult={result} />
      </div>

      {/* resumo fixo no celular */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-2.5 backdrop-blur xl:hidden">
        <button type="button" onClick={() => summaryRef.current?.scrollIntoView({ behavior: 'smooth' })} className="grid w-full grid-cols-3 gap-2 text-left">
          <MiniStat label={`Custo/${per}`} value={<AnimatedCounter value={result.unitCost} format={money} />} />
          <MiniStat label="Preço" value={<AnimatedCounter value={result.effectivePrice} format={money} />} />
          <MiniStat
            label="Margem"
            value={<AnimatedCounter value={result.profitMarginPct} format={(v) => pct(v)} className={result.unitProfit >= 0 ? 'text-profit' : 'text-loss'} />}
          />
        </button>
      </div>

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Salvar simulação"
        footer={
          <>
            <Button onClick={() => setSaveOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={doSave}>
              <Save size={16} /> Salvar
            </Button>
          </>
        }
      >
        <Field label="Nome da simulação" hint="A simulação fica salva separada da ficha técnica.">
          <TextInput autoFocus value={simName} onChange={(e) => setSimName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSave()} placeholder={`${original?.name ?? 'Nova simulação'} · ${money(params.salePrice)}`} />
        </Field>
        <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg border border-line bg-subtle p-3 text-center">
          <MiniStat label="Custo unitário" value={money(result.unitCost)} />
          <MiniStat label="Preço" value={money(params.salePrice)} />
          <MiniStat label="Margem" value={pct(result.profitMarginPct)} />
        </div>
      </Modal>

      <Drawer open={listOpen} onClose={() => setListOpen(false)} title="Simulações salvas">
        {db.simulations.length === 0 ? (
          <p className="p-5 text-sm text-muted">Nenhuma simulação salva ainda.</p>
        ) : (
          <ul className="divide-y divide-divider">
            {db.simulations.map((s, i) => (
              <motion.li key={s.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-muted">
                    {dateTime(s.createdAt)} · custo {money(s.unitCost)} · margem {pct(s.profitMarginPct)}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    const rid = s.recipeId && db.recipes.some((r) => r.id === s.recipeId) ? s.recipeId : null;
                    loadedFor.current = rid;
                    setSearch(rid ? { ficha: rid } : {});
                    setState({ comp: clone(s.composition), params: { ...s.params } });
                    setListOpen(false);
                    toast(`Simulação “${s.name}” carregada`, 'info');
                  }}
                >
                  Abrir
                </Button>
                <button className="rounded-md p-1.5 text-muted hover:bg-loss-soft hover:text-loss" aria-label="Excluir simulação" onClick={() => deleteSimulation(s.id)}>
                  <Trash size={15} />
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </Drawer>

      {original && (
        <ConfirmDialog
          open={applyOpen}
          onClose={() => setApplyOpen(false)}
          title="Atualizar preço oficial?"
          confirmLabel="Aplicar preço"
          onConfirm={() => {
            applyPrice(original.id, params.salePrice, originalResult?.unitCost ?? result.unitCost, params.marginPct);
            toast(`Preço de ${original.name} atualizado para ${money(params.salePrice)}`);
          }}
        >
          <p>
            O preço oficial de <b>{original.name}</b> passará de <b>{original.salePrice != null ? money(original.salePrice) : 'sem preço'}</b> para{' '}
            <b className="text-pink">{money(params.salePrice)}</b>.
          </p>
          {modified && (
            <p className="mt-3 rounded-lg border border-warn/30 bg-warn-soft p-3 text-xs text-ink">
              A composição foi alterada nesta simulação. Somente o <b>preço</b> será aplicado — os ingredientes e materiais da ficha técnica continuam como estão.
              {originalResult && (
                <>
                  {' '}
                  Com a ficha original, o custo unitário é {money(originalResult.unitCost)} e a margem com esse preço seria{' '}
                  {pct(((params.salePrice * (1 - result.variablePct / 100) - originalResult.unitCost) / params.salePrice) * 100)}.
                </>
              )}
            </p>
          )}
          <p className="mt-3 text-xs text-muted">A alteração fica registrada no histórico com o custo unitário atual.</p>
        </ConfirmDialog>
      )}
    </motion.div>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[11px] text-muted">{label}</div>
      <div className="truncate text-sm font-semibold tabular">{value}</div>
    </div>
  );
}

function Metric({ label, value, tip, tone, big }: { label: string; value: React.ReactNode; tip: string; tone?: 'green' | 'red'; big?: boolean }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="flex items-center gap-1 text-xs text-muted">
        {label}
        <Tip content={tip}>
          <Info size={12} className="cursor-help" tabIndex={0} aria-label={tip} />
        </Tip>
      </div>
      <div className={cx('mt-0.5 truncate font-semibold tabular', big ? 'text-xl' : 'text-[15px]', tone === 'green' ? 'text-profit' : tone === 'red' ? 'text-loss' : 'text-ink')}>{value}</div>
    </div>
  );
}

function PricingPanel({
  result: r,
  params,
  setParam,
  per,
  priceMax,
  qtyMax,
  original,
  originalResult,
}: {
  result: PricingResult;
  params: PricingParams;
  setParam: (p: Partial<PricingParams>) => void;
  per: string;
  priceMax: number;
  qtyMax: number;
  original: Recipe | null;
  originalResult: PricingResult | null;
}) {
  const profitTone = r.unitProfit >= 0 ? 'green' : 'red';
  // neutral until there is a price and a cost to compare
  const status: 'lucro' | 'prejuizo' | 'neutro' =
    !(r.effectivePrice > 0) || !(r.unitCost > 0) || Math.abs(r.unitProfit) < 0.005 ? 'neutro' : r.unitProfit > 0 ? 'lucro' : 'prejuizo';
  const price = r.effectivePrice;

  // Price ↔ margin link: moving one recalculates the other from the same formula as the
  // suggested price, so both sliders always describe the same situation.
  const [linked, setLinked] = useState(true);
  const v = r.variablePct / 100;
  const d = clamp(params.discountPct || 0, 0, 99.9) / 100;
  const marginForPrice = (p: number) => {
    const eff = p * (1 - d);
    return eff > 0 && Number.isFinite(r.unitCost) ? ((eff * (1 - v) - r.unitCost) / eff) * 100 : null;
  };
  const priceForMargin = (m: number) => {
    const denom = 1 - v - m / 100;
    return denom > 0 && Number.isFinite(r.unitCost) ? Math.round((r.unitCost / denom / (1 - d)) * 100) / 100 : null;
  };
  const setPrice = (p: number) => {
    const m = linked ? marginForPrice(p) : null;
    setParam(m === null ? { salePrice: p } : { salePrice: p, marginPct: clamp(Math.round(m * 10) / 10, 0, 95) });
  };
  const setMargin = (m: number) => {
    const mm = clamp(m, 0, 95);
    const p = linked ? priceForMargin(mm) : null;
    setParam(p === null ? { marginPct: mm } : { marginPct: mm, salePrice: p });
  };
  // when linked, the margin slider shows the real margin of the current price (cost may have changed meanwhile)
  /** profit relative to cost — what people usually mean by "cobrar 100% em cima do custo" */
  const onCost = r.unitCost > 0 ? (r.unitProfit / r.unitCost) * 100 : NaN;
  const shownMargin = linked && price > 0 && Number.isFinite(r.profitMarginPct) ? clamp(Math.round(r.profitMarginPct * 10) / 10, 0, 95) : params.marginPct;

  const split = price > 0 ? [Math.min(r.unitCost, price), r.variableExpensePerUnit, Math.max(0, r.unitProfit)] : [0, 0, 0];
  const splitTotal = Math.max(price, r.unitCost + r.variableExpensePerUnit) || 1;
  const snap = original?.priceSnapshot;
  const impact = snap && originalResult && snap.unitCost > 0 ? ((originalResult.unitCost - snap.unitCost) / snap.unitCost) * 100 : null;

  return (
    <section
      className={cx(
        'overflow-hidden rounded-card border-2 bg-surface shadow-card transition-colors duration-300',
        status === 'lucro' ? 'border-profit/60' : status === 'prejuizo' ? 'border-loss/60' : 'border-line',
      )}
    >
      <CardHeader icon={<CircleDollarSign size={16} />} title="3 · Preço e lucro" subtitle="Atualizado em tempo real" />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={status}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="status"
          className={cx(
            'flex items-center gap-2.5 border-b px-4 py-3 text-sm font-medium',
            status === 'lucro' ? 'border-profit/20 bg-profit-soft text-profit' : status === 'prejuizo' ? 'border-loss/20 bg-loss-soft text-loss' : 'border-divider bg-subtle text-muted',
          )}
        >
          {status === 'lucro' ? <TrendingUp size={18} /> : status === 'prejuizo' ? <TrendingDown size={18} /> : <Info size={18} />}
          <span>
            {status === 'lucro' && (
              <>
                Com lucro: você ganha <b>{money(r.unitProfit)}</b> por {per} · {pct(r.profitMarginPct)} do preço · {pct(onCost, 0)} sobre o custo
              </>
            )}
            {status === 'prejuizo' && (
              <>
                Prejuízo: você perde <b>{money(-r.unitProfit)}</b> por {per}. Cobre pelo menos <b>{money(r.minPrice)}</b>
              </>
            )}
            {status === 'neutro' && (r.effectivePrice > 0 ? 'Empate: o preço só cobre os custos, sem lucro' : 'Defina o preço de venda para ver se dá lucro')}
          </span>
        </motion.div>
      </AnimatePresence>

      <div className="grid grid-cols-2 border-b border-divider">
        <div className="border-r border-divider px-4 py-4">
          <div className="text-xs text-muted">Custo por {per}</div>
          <AnimatedCounter value={r.unitCost} format={money} className="mt-1 block text-2xl font-bold" />
        </div>
        <div className={cx('px-4 py-4 transition-colors duration-300', status === 'lucro' ? 'bg-profit-soft/50' : status === 'prejuizo' ? 'bg-loss-soft/50' : '')}>
          <div className="text-xs text-muted">Lucro por {per}</div>
          <AnimatedCounter value={r.unitProfit} format={money} className={cx('mt-1 block text-2xl font-bold', profitTone === 'green' ? 'text-profit' : 'text-loss')} />
        </div>
      </div>

      {/* para onde vai o preço */}
      <div className="border-b border-divider px-4 py-3">
        <div className="mb-1.5 flex justify-between text-xs text-muted">
          <span>Para onde vai o preço</span>
          <span className="tabular">{money(price)}</span>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-divider">
          {[
            { v: split[0], c: 'bg-ink/70', t: `Custo ${money(r.unitCost)}` },
            { v: split[1], c: 'bg-warn', t: `Taxas e impostos ${money(r.variableExpensePerUnit)}` },
            { v: split[2], c: 'bg-profit', t: `Lucro ${money(Math.max(0, r.unitProfit))}` },
          ].map((s, i) => (
            <motion.div key={i} className={cx('h-full', s.c)} title={s.t} animate={{ width: `${(s.v / splitTotal) * 100}%` }} transition={{ type: 'spring', stiffness: 200, damping: 28 }} />
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <i className="h-2 w-2 rounded-sm bg-ink/70" /> custo
          </span>
          <span className="flex items-center gap-1">
            <i className="h-2 w-2 rounded-sm bg-warn" /> taxas {pct(r.variablePct, 1)}
          </span>
          <span className="flex items-center gap-1">
            <i className="h-2 w-2 rounded-sm bg-profit" /> lucro
          </span>
          {r.unitProfit < 0 && <span className="font-medium text-loss">prejuízo de {money(-r.unitProfit)} por {per}</span>}
        </div>
      </div>

      <div className="space-y-4 border-b border-divider px-4 py-4">
        <SliderField
          label="Preço de venda"
          value={params.salePrice}
          onChange={setPrice}
          min={0}
          max={priceMax}
          step={0.1}
          prefix="R$"
          marker={Number.isFinite(r.minPrice) ? { value: r.minPrice, label: `mínimo ${money(r.minPrice)}` } : undefined}
        />
        <div className="-my-1 flex justify-center">
          <button
            type="button"
            onClick={() => {
              if (!linked && price > 0) setPrice(params.salePrice);
              setLinked(!linked);
            }}
            aria-pressed={linked}
            title={linked ? 'Preço e margem se ajustam juntos. Clique para separar.' : 'Preço e margem independentes. Clique para ligar.'}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
              linked ? 'border-lilac/30 bg-lilac-soft text-lilac' : 'border-line text-muted hover:text-ink',
            )}
          >
            {linked ? <Link2 size={12} /> : <Unlink2 size={12} />}
            {linked ? 'Preço e margem ligados' : 'Preço e margem separados'}
          </button>
        </div>
        <SliderField
          label={linked ? 'Margem de lucro' : 'Margem de lucro desejada'}
          value={shownMargin}
          onChange={setMargin}
          min={0}
          max={80}
          step={1}
          suffix="%"
          hint={
            linked && r.unitProfit < 0 && price > 0
              ? 'Preço abaixo do custo: margem negativa'
              : price > 0 && Number.isFinite(onCost)
                ? `Parte do preço que é lucro. Sobre o custo, o lucro é de ${pct(onCost, 0)}.`
                : 'Parte do preço que é lucro (nunca passa de 100%).'
          }
        />
        <SliderField label={`Quantidade produzida (${per})`} value={params.quantity} onChange={(v) => setParam({ quantity: Math.max(0, v) })} min={1} max={qtyMax} step={1} />
        <SliderField label="Desperdício" value={params.wastePct} onChange={(v) => setParam({ wastePct: clamp(v, 0, 95) })} min={0} max={40} step={0.5} suffix="%" hint={`${number(r.lostUnits)} ${per} perdidas`} />
      </div>

      <div className="border-b border-divider bg-gradient-to-br from-pink-soft/60 to-lilac-soft/40 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1 text-xs font-medium text-pink">
              Preço sugerido para {pct(params.marginPct, 0)} de margem
              <Tip content="Custo unitário ÷ (1 − despesas de venda% − margem%). Garante a margem desejada sobre o preço, depois de taxas e impostos.">
                <Info size={12} className="cursor-help" />
              </Tip>
            </div>
            <AnimatedCounter value={r.suggestedPrice} format={money} className="mt-0.5 block text-2xl font-bold text-ink" />
            {Number.isFinite(r.suggestedRounded) && <div className="text-xs text-muted">arredondado: {money(r.suggestedRounded)}</div>}
          </div>
          <Button size="sm" variant="primary" disabled={!Number.isFinite(r.suggestedRounded)} onClick={() => setPrice(r.suggestedRounded)}>
            Usar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-divider bg-divider [&>*]:bg-surface">
        <Metric label="Custo total da produção" value={<AnimatedCounter value={r.totalCost} format={money} />} tip="Soma de todos os custos para produzir a quantidade informada, incluindo perdas." />
        <Metric label="Lucro total estimado" value={<AnimatedCounter value={r.totalProfit} format={money} />} tone={r.totalProfit >= 0 ? 'green' : 'red'} tip="Lucro por unidade × unidades aproveitáveis vendidas." />
        <Metric label="Margem de lucro" value={<AnimatedCounter value={r.profitMarginPct} format={(v) => pct(v)} />} tone={profitTone} tip="Lucro ÷ preço de venda. Quanto de cada real vendido sobra depois de TODOS os custos e taxas." />
        <Metric
          label="Margem de contribuição"
          value={<AnimatedCounter value={r.contributionMarginPct} format={(v) => pct(v)} />}
          tip="(Preço − taxas − custos variáveis) ÷ preço. Não desconta o rateio de custos fixos: mostra quanto cada venda contribui para pagar os fixos e gerar lucro."
        />
        <Metric
          label="Lucro sobre o custo"
          value={Number.isFinite(onCost) && price > 0 ? `${pct(onCost, 0)} · ${number(r.markup)}×` : '—'}
          tone={price > 0 && Number.isFinite(onCost) ? (onCost >= 0 ? 'green' : 'red') : undefined}
          tip="Lucro ÷ custo. 100% = você ganha o mesmo que gastou. O número com × é o markup: preço ÷ custo (2× = vende pelo dobro do custo). Diferente da margem, que é sobre o preço e nunca passa de 100%."
        />
        <Metric label="Preço mínimo" value={<AnimatedCounter value={r.minPrice} format={money} />} tip="Preço que cobre custo + taxas com lucro zero. Abaixo disso há prejuízo." />
      </div>

      <details className="group border-b border-divider">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium hover:bg-subtle/60">
          Despesas de venda e desconto
          <span className="text-xs tabular text-muted">
            {pct(r.variablePct)}
            {params.discountPct > 0 && ` · desc. ${pct(params.discountPct, 0)}`}
          </span>
        </summary>
        <div className="grid grid-cols-2 gap-3 px-4 pb-4">
          <Field label="Taxa de cartão">
            <NumberInput value={params.cardFeePct} min={0} max={30} suffix="%" onChange={(v) => setParam({ cardFeePct: v })} />
          </Field>
          <Field label="Comissões">
            <NumberInput value={params.commissionPct} min={0} max={50} suffix="%" onChange={(v) => setParam({ commissionPct: v })} />
          </Field>
          <Field label="Impostos sobre venda">
            <NumberInput value={params.taxPct} min={0} max={50} suffix="%" onChange={(v) => setParam({ taxPct: v })} />
          </Field>
          <Field label="Desconto promocional">
            <NumberInput value={params.discountPct} min={0} max={100} suffix="%" onChange={(v) => setParam({ discountPct: v })} />
          </Field>
          <p className="col-span-2 text-xs text-muted">Padrões vêm de Custos operacionais. Alterar aqui vale só para esta simulação.</p>
        </div>
      </details>

      {impact !== null && snap && originalResult && (
        <div className="border-b border-divider px-4 py-3 text-xs">
          <div className="font-medium text-ink">Impacto dos preços dos insumos</div>
          <p className="mt-1 text-muted">
            Quando o preço foi definido ({date(snap.date)}), a ficha custava <b className="text-ink">{money(snap.unitCost)}</b> por {per}. Hoje custa{' '}
            <b className={impact > 0.05 ? 'text-loss' : impact < -0.05 ? 'text-profit' : 'text-ink'}>{money(originalResult.unitCost)}</b> ({impact > 0 ? '+' : ''}
            {pct(impact)}). Preço sugerido atual da ficha: <b className="text-ink">{money(originalResult.suggestedPrice)}</b>.
          </p>
        </div>
      )}

      <AnimatePresence initial={false}>
        {r.alerts.length > 0 && (
          <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1.5 px-4 py-3">
            {r.alerts.map((a) => (
              <li
                key={a.message}
                className={cx(
                  'flex gap-2 rounded-lg px-2.5 py-2 text-xs',
                  a.level === 'erro' ? 'bg-loss-soft text-loss' : a.level === 'aviso' ? 'bg-warn-soft text-warn' : 'bg-subtle text-muted',
                )}
              >
                {a.level === 'info' ? <Info size={14} className="mt-px shrink-0" /> : <TriangleAlert size={14} className="mt-px shrink-0" />}
                <span>
                  {a.message}
                  {a.message.includes('Custos operacionais') && (
                    <>
                      {' '}
                      <Link to="/custos" className="font-semibold underline">
                        Configurar
                      </Link>
                    </>
                  )}
                </span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  );
}
