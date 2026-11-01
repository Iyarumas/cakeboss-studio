import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CakesManager } from '../components/CakesManager';
import { motion } from 'motion/react';
import { Calculator, ClipboardList, Copy, Plus, Save, Trash, TrendingUp, ArrowLeft } from 'lucide-react';
import { useStore } from '../store/store';
import { emptyComposition, priceRecipe } from '@cakeboss/domain/pricing';
import { CAKE_CATEGORY, layerCost } from '@cakeboss/domain/cake';
import { date, money, nowIso, pct, uid } from '@cakeboss/domain/format';
import type { Recipe } from '@cakeboss/domain/types';
import { Badge, Button, Card, CardHeader, EmptyState, Field, NumberInput, PageHeader, Segmented, TextInput, cx } from '../components/ui';
import { AnimatedCounter, ConfirmDialog, stagger, useToast } from '../components/motion';
import { CompositionEditor } from '../components/CompositionEditor';
import { CostBars, CostDonut } from '../components/CostCharts';

export function RecipesPage() {
  const { db, ctx, saveRecipe, loadSample } = useStore();
  const [params, setParams] = useSearchParams();
  const tab = params.get('aba') === 'bolos' ? 'bolos' : 'fichas';
  const navigate = useNavigate();
  const toast = useToast();
  // fichas that only exist to build cakes live in the Bolos de aniversário tab
  const rows = useMemo(
    () => db.recipes.filter((r) => r.category !== CAKE_CATEGORY).map((r) => ({ r, p: priceRecipe(r, ctx) })).sort((a, b) => a.r.name.localeCompare(b.r.name)),
    [db.recipes, ctx],
  );

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show">
      <PageHeader
        title="Fichas técnicas"
        subtitle="A receita de cada produto: ingredientes, materiais, tempo e rendimento. Base de todos os cálculos."
        actions={
          <Button variant="primary" onClick={() => navigate('/fichas/nova')}>
            <Plus size={16} /> Nova ficha
          </Button>
        }
      />
      <motion.div variants={stagger.item} className="mb-5">
        <Segmented
          value={tab}
          onChange={(t) => setParams(t === 'bolos' ? { aba: 'bolos' } : {})}
          options={[
            { value: 'fichas', label: 'Fichas técnicas' },
            { value: 'bolos', label: '🎂 Bolos de aniversário' },
          ]}
        />
      </motion.div>
      {tab === 'bolos' ? (
        <>
          <CakesManager />
          <CakeFichas />
        </>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList size={22} />}
            title="Nenhuma ficha técnica"
            text="Crie a ficha de um produto para calcular o custo e o preço de venda."
            action={
              <>
                <Button variant="primary" onClick={() => navigate('/fichas/nova')}>
                  <Plus size={16} /> Criar ficha técnica
                </Button>
                {db.ingredients.length === 0 && <Button onClick={loadSample}>Carregar dados de exemplo</Button>}
              </>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ r, p }) => {
            const drift = r.priceSnapshot && r.priceSnapshot.unitCost > 0 ? ((p.unitCost - r.priceSnapshot.unitCost) / r.priceSnapshot.unitCost) * 100 : null;
            return (
              <motion.div key={r.id} variants={stagger.item} whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
                <Card className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-2 border-b border-divider px-5 py-4">
                    <div className="min-w-0">
                      <Link to={`/fichas/${r.id}`} className="block truncate font-semibold hover:text-pink">
                        {r.name}
                      </Link>
                      <div className="mt-0.5 text-xs text-muted">
                        {r.category || 'Sem categoria'} · rende {r.yield} {r.unitLabel}
                      </div>
                    </div>
                    {r.sample && <Badge tone="amber">exemplo</Badge>}
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-divider border-b border-divider text-center">
                    <div className="px-2 py-3">
                      <div className="text-[11px] text-muted">Custo/{r.unitLabel}</div>
                      <div className="text-sm font-semibold tabular">{money(p.unitCost)}</div>
                    </div>
                    <div className="px-2 py-3">
                      <div className="text-[11px] text-muted">Preço</div>
                      <div className="text-sm font-semibold tabular">{r.salePrice != null ? money(r.salePrice) : '—'}</div>
                    </div>
                    <div className="px-2 py-3">
                      <div className="text-[11px] text-muted">Margem</div>
                      <div className={cx('text-sm font-semibold tabular', r.salePrice == null ? 'text-muted' : p.unitProfit >= 0 ? 'text-profit' : 'text-loss')}>{r.salePrice != null ? pct(p.profitMarginPct) : '—'}</div>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col justify-end gap-3 px-5 py-3">
                    {drift !== null && Math.abs(drift) >= 2 && (
                      <div className={cx('flex items-center gap-1.5 text-xs', drift > 0 ? 'text-loss' : 'text-profit')}>
                        <TrendingUp size={13} className={drift < 0 ? 'rotate-180' : ''} /> Custo {drift > 0 ? 'subiu' : 'caiu'} {pct(Math.abs(drift))} desde o último preço ({date(r.priceSnapshot!.date)})
                      </div>
                    )}
                    {r.salePrice == null && <div className="text-xs text-warn">Sem preço oficial — use o assistente para definir.</div>}
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="primary" onClick={() => navigate(`/assistente?ficha=${r.id}`)}>
                        <Calculator size={14} /> Precificar
                      </Button>
                      <Button size="sm" onClick={() => navigate(`/fichas/${r.id}`)}>
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const copy: Recipe = { ...JSON.parse(JSON.stringify(r)), id: uid(), name: `${r.name} (cópia)`, sample: false, priceSnapshot: null, createdAt: nowIso() };
                          saveRecipe(copy);
                          toast('Ficha duplicada');
                        }}
                      >
                        <Copy size={14} /> Duplicar
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

const blankRecipe = (margin: number): Recipe => ({
  ...emptyComposition(),
  id: uid(),
  name: '',
  category: '',
  salePrice: null,
  targetMarginPct: margin,
  priceSnapshot: null,
  createdAt: nowIso(),
  updatedAt: nowIso(),
});

/** The fichas used only by birthday cakes (massas, recheios, coberturas, adicionais, decoração). */
function CakeFichas() {
  const { db, ctx } = useStore();
  const fichas = db.recipes.filter((r) => r.category === CAKE_CATEGORY).sort((a, b) => a.name.localeCompare(b.name));
  if (!fichas.length) return null;
  return (
    <motion.div variants={stagger.item} className="mt-5">
      <Card>
        <CardHeader title="Fichas dos bolos" subtitle="Massas, recheios, coberturas, adicionais e decoração. Ficam só aqui e não aparecem como produtos na loja." />
        <ul className="divide-y divide-divider">
          {fichas.map((r) => {
            const cost = layerCost(r.id, db.recipes, ctx);
            return (
              <li key={r.id}>
                <Link to={`/fichas/${r.id}`} className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-subtle/60">
                  <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                  {!r.ingredients.length ? <Badge tone="amber">sem ingredientes</Badge> : <span className="tabular text-muted">{cost !== null ? `${money(cost)} por receita` : '—'}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </motion.div>
  );
}

export function RecipeEditorPage() {
  const { id } = useParams();
  const { db, ctx, saveRecipe, deleteRecipe } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const existing = db.recipes.find((r) => r.id === id);
  const [draft, setDraft] = useState<Recipe>(() => (existing ? JSON.parse(JSON.stringify(existing)) : blankRecipe(db.settings.defaultMarginPct)));
  const [del, setDel] = useState(false);
  const result = useMemo(() => priceRecipe(draft, ctx), [draft, ctx]);
  const dirty = !existing || JSON.stringify(existing) !== JSON.stringify(draft);

  if (id !== 'nova' && !existing)
    return (
      <Card>
        <EmptyState icon={<ClipboardList size={22} />} title="Ficha não encontrada" text="Ela pode ter sido excluída." action={<Button onClick={() => navigate('/fichas')}>Voltar às fichas</Button>} />
      </Card>
    );

  const save = () => {
    if (!draft.name.trim()) return toast('Dê um nome para a ficha técnica', 'error');
    if (!(draft.yield > 0)) return toast('Informe o rendimento por lote', 'error');
    saveRecipe({ ...draft, name: draft.name.trim() });
    toast('Ficha técnica salva');
    if (!existing) navigate(`/fichas/${draft.id}`, { replace: true });
  };

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show">
      <div className="mb-4">
        <Link to="/fichas" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft size={15} /> Fichas técnicas
        </Link>
      </div>
      <PageHeader
        title={existing ? existing.name : 'Nova ficha técnica'}
        subtitle={existing ? `Atualizada em ${date(existing.updatedAt)}` : 'Preencha a receita de um lote.'}
        actions={
          <>
            {existing && (
              <Button variant="danger" onClick={() => setDel(true)}>
                <Trash size={16} /> Excluir
              </Button>
            )}
            {existing && (
              <Button onClick={() => navigate(`/assistente?ficha=${existing.id}`)} disabled={dirty} title={dirty ? 'Salve as alterações antes' : undefined}>
                <Calculator size={16} /> Abrir no assistente
              </Button>
            )}
            <Button variant="primary" onClick={save} disabled={!dirty}>
              <Save size={16} /> {dirty ? 'Salvar ficha' : 'Salvo'}
            </Button>
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <motion.div variants={stagger.item} className="space-y-5">
          <Card>
            <CardHeader title="Identificação" />
            <div className="grid gap-3 p-5 sm:grid-cols-3">
              <Field label="Nome do produto" className="sm:col-span-2">
                <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Bolo de morango 20 cm" />
              </Field>
              <Field label="Categoria">
                <TextInput value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="Bolos, Docinhos…" />
              </Field>
              <Field label="Margem de lucro desejada" hint="Usada para o preço sugerido">
                <NumberInput value={draft.targetMarginPct} min={0} max={95} suffix="%" onChange={(v) => setDraft({ ...draft, targetMarginPct: v })} />
              </Field>
            </div>
          </Card>
          <Card>
            <CardHeader title="Composição de um lote" subtitle="Quantidades usadas para produzir um lote (o rendimento)." />
            <CompositionEditor value={draft} onChange={(c) => setDraft({ ...draft, ...c })} ctx={ctx} />
          </Card>
        </motion.div>

        <motion.div variants={stagger.item} className="xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardHeader title="Custo do lote" subtitle={`${draft.yield} ${draft.unitLabel} por lote`} />
            <div className="p-5">
              <CostDonut categories={result.categories} center={result.unitCost} centerLabel={`por ${draft.unitLabel}`} per={draft.unitLabel} size={190} />
              <div className="mt-4">
                <CostBars categories={result.categories} per={draft.unitLabel} limit={5} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px border-t border-divider bg-divider [&>*]:bg-surface">
              <div className="px-4 py-3">
                <div className="text-xs text-muted">Preço oficial</div>
                <div className="font-semibold tabular">{draft.salePrice != null ? money(draft.salePrice) : '—'}</div>
              </div>
              <div className="px-4 py-3">
                <div className="text-xs text-muted">Sugerido ({pct(draft.targetMarginPct, 0)})</div>
                <AnimatedCounter value={result.suggestedPrice} format={money} className="font-semibold text-pink" />
              </div>
            </div>
            <p className="border-t border-divider px-4 py-3 text-xs text-muted">O preço oficial só muda pelo Assistente de Precificação, com confirmação.</p>
          </Card>
        </motion.div>
      </div>

      <ConfirmDialog
        open={del}
        onClose={() => setDel(false)}
        danger
        title="Excluir ficha técnica?"
        confirmLabel="Excluir"
        onConfirm={() => {
          if (!existing) return;
          deleteRecipe(existing.id);
          toast('Ficha excluída');
          navigate('/fichas');
        }}
      >
        <b>{existing?.name}</b> será excluída. Produções já registradas mantêm o custo histórico.
      </ConfirmDialog>
    </motion.div>
  );
}
