import { useMemo, useState, type ReactNode } from 'react';
import { Camera, ExternalLink, Plus, Sparkles, Trash, TriangleAlert } from 'lucide-react';
import { useStore } from '../store/store';
import { baseUnit, money, nowIso, number, uid } from '@cakeboss/domain/format';
import { emptyComposition } from '@cakeboss/domain/pricing';
import { CAKE_CATEGORY, areaFactor, cakeQuote, extraCost, layerCost } from '@cakeboss/domain/cake';
import { shrinkImage } from '../lib/image';
import type { CakeComponent, CakeExtra, CakeProduct, CakeSize, Recipe } from '@cakeboss/domain/types';
import { Button, Field, IconButton, NumberInput, Select, TextInput, cx } from './ui';
import { useToast } from './motion';

export const newCake = (): CakeProduct => ({
  id: uid(),
  name: 'Bolo de festa',
  description: '',
  visible: true,
  refDiameter: 20,
  sizes: [],
  massas: [],
  recheios: [],
  coberturas: [],
  maxRecheios: 2,
  marginPct: 40,
  adicionais: [],
  decoracoes: [],
});

/** Fichas offered for a cake part: only the cake's own fichas, plus whatever is already linked. */
function useCakeFichas(selected: string | undefined) {
  const { db } = useStore();
  return db.recipes.filter((x) => x.category === CAKE_CATEGORY || x.id === selected);
}

/** Creates an empty ficha that lives in Bolos de aniversário (not in the product list). */
function useCreateCakeFicha() {
  const { db, saveRecipe } = useStore();
  const toast = useToast();
  return (name: string) => {
    const r: Recipe = {
      ...emptyComposition(),
      unitLabel: 'receita',
      id: uid(),
      name,
      category: CAKE_CATEGORY,
      salePrice: null,
      targetMarginPct: db.settings.defaultMarginPct,
      priceSnapshot: null,
      storeVisible: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    saveRecipe(r);
    toast(`Ficha "${name}" criada — abra e coloque os ingredientes`);
    return r.id;
  };
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="flex items-center gap-2.5 font-semibold">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-pink to-lilac text-xs text-white">{n}</span>
        {title}
      </h3>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Massas, recheios or coberturas: each one linked to a ficha técnica of ONE receita. */
function Components({ kind, list, onChange }: { kind: 'Massa' | 'Recheio' | 'Cobertura'; list: CakeComponent[]; onChange: (l: CakeComponent[]) => void }) {
  const { db, ctx } = useStore();
  const set = (id: string, p: Partial<CakeComponent>) => onChange(list.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const create = useCreateCakeFicha();
  const createFicha = (c: CakeComponent) => set(c.id, { recipeId: create(`${kind} ${c.name || 'nova'} (1 receita)`) });

  return (
    <div className="space-y-2">
      {list.map((c) => {
        const r = db.recipes.find((x) => x.id === c.recipeId);
        const cost = c.recipeId ? layerCost(c.recipeId, db.recipes, ctx) : null;
        const empty = r && !r.ingredients.length;
        return (
          <ComponentRow
            key={c.id}
            c={c}
            kind={kind}
            r={r}
            cost={cost}
            empty={!!empty}
            onSet={(p) => set(c.id, p)}
            onRemove={() => onChange(list.filter((x) => x.id !== c.id))}
            onCreate={() => createFicha(c)}
          />
        );
      })}
      <button type="button" onClick={() => onChange([...list, { id: uid(), name: '', recipeId: '' }])} className="inline-flex items-center gap-1 text-sm font-medium text-pink hover:underline">
        <Plus size={14} /> Adicionar {kind.toLowerCase()}
      </button>
    </div>
  );
}

/** One massa, recheio or cobertura with its ficha técnica (only the cake's own fichas are offered). */
function ComponentRow({
  c,
  kind,
  r,
  cost,
  empty,
  onSet,
  onRemove,
  onCreate,
}: {
  c: CakeComponent;
  kind: string;
  r?: Recipe;
  cost: number | null;
  empty: boolean;
  onSet: (p: Partial<CakeComponent>) => void;
  onRemove: () => void;
  onCreate: () => void;
}) {
  const fichas = useCakeFichas(c.recipeId);
  const set = (_id: string, p: Partial<CakeComponent>) => onSet(p);
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
        <TextInput
          aria-label={`Nome do ${kind.toLowerCase()}`}
          value={c.name}
          onChange={(e) => set(c.id, { name: e.target.value })}
          placeholder={kind === 'Massa' ? 'Ex.: Chocolate' : kind === 'Recheio' ? 'Ex.: Ninho' : 'Ex.: Chantininho'}
        />
        <IconButton label="Remover" className="sm:order-last" onClick={onRemove}>
          <Trash size={14} />
        </IconButton>
        <div className="col-span-2 flex gap-2 sm:col-span-1">
          <Select aria-label="Ficha técnica" value={c.recipeId} onChange={(e) => set(c.id, { recipeId: e.target.value })} className="flex-1">
            <option value="">Escolha a ficha técnica…</option>
            {fichas.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </Select>
          {!c.recipeId && (
            <Button size="sm" className="h-10 shrink-0" onClick={onCreate}>
              <Plus size={14} /> Criar ficha
            </Button>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {!c.recipeId ? (
          <span className="text-warn">Escolha ou crie a ficha técnica com os ingredientes de 1 receita.</span>
        ) : empty ? (
          <span className="flex items-center gap-1 text-warn">
            <TriangleAlert size={12} /> A ficha ainda não tem ingredientes — custo R$ 0,00.
          </span>
        ) : (
          <span className="text-muted">
            Custo de 1 receita: <b className="text-ink">{cost !== null ? money(cost) : '—'}</b>
          </span>
        )}
        {r && (
          <a href={`/fichas/${r.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-pink hover:underline">
            {empty ? 'Colocar ingredientes' : 'Abrir ficha'} <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * Add-ins (inside the fillings) or decorations (on top). Each one is either a ficha técnica or one item
 * straight from stock (morangos, KitKat, chocolate picado) with how much goes in a cake of the reference size.
 */
function Extras({ kind, list, refDiameter, onChange }: { kind: 'adicional' | 'decoracao'; list: CakeExtra[]; refDiameter: number; onChange: (l: CakeExtra[]) => void }) {
  const { db, ctx } = useStore();
  const create = useCreateCakeFicha();
  const set = (id: string, p: Partial<CakeExtra>) => onChange(list.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const label = kind === 'adicional' ? 'adicional' : 'decoração';
  const fichas = db.recipes.filter((x) => x.category === CAKE_CATEGORY || list.some((e) => e.recipeId === x.id));
  return (
    <div className="space-y-2">
      {list.map((e) => {
        const ing = db.ingredients.find((i) => i.id === e.ingredientId);
        const cost = extraCost(e, db.recipes, ctx);
        return (
          <div key={e.id} className="rounded-xl border border-line p-3">
            <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_auto_auto]">
              <TextInput
                aria-label={`Nome do ${label}`}
                value={e.name}
                onChange={(ev) => set(e.id, { name: ev.target.value })}
                placeholder={kind === 'adicional' ? 'Ex.: Chocolate picado, Bombom, KitKat' : 'Ex.: Morangos, Raspas de chocolate'}
              />
              <IconButton label="Remover" className="sm:order-last" onClick={() => onChange(list.filter((x) => x.id !== e.id))}>
                <Trash size={14} />
              </IconButton>
              <div className="col-span-2 inline-flex rounded-lg border border-line p-0.5 text-xs sm:col-span-1" role="radiogroup" aria-label="De onde vem">
                {(['estoque', 'ficha'] as const).map((src) => (
                  <button
                    key={src}
                    type="button"
                    role="radio"
                    aria-checked={e.source === src}
                    onClick={() => set(e.id, { source: src })}
                    className={cx('h-9 flex-1 rounded-md px-3 font-medium transition-colors', e.source === src ? 'bg-pink-soft text-pink' : 'text-muted hover:text-ink')}
                  >
                    {src === 'estoque' ? 'Item do estoque' : 'Ficha técnica'}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2">
              {e.source === 'estoque' ? (
                <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr]">
                  <Select aria-label="Ingrediente do estoque" value={e.ingredientId ?? ''} onChange={(ev) => set(e.id, { ingredientId: ev.target.value })}>
                    <option value="">Escolha o item do estoque…</option>
                    {db.ingredients.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </Select>
                  <NumberInput aria-label={`Quantidade num bolo de ${refDiameter} cm`} value={e.qty ?? 0} min={0} suffix={ing ? baseUnit(ing.unit) : ''} onChange={(v) => set(e.id, { qty: v })} />
                </div>
              ) : (
                <div className="flex gap-2">
                  <Select aria-label="Ficha técnica" value={e.recipeId ?? ''} onChange={(ev) => set(e.id, { recipeId: ev.target.value })} className="flex-1">
                    <option value="">Escolha a ficha técnica…</option>
                    {fichas.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </Select>
                  {!e.recipeId && (
                    <Button
                      size="sm"
                      className="h-10 shrink-0"
                      onClick={() =>
                        set(e.id, {
                          recipeId: create(`${kind === 'adicional' ? 'Adicional' : 'Decoração'} ${e.name || 'nova'} (1 receita)`),
                        })
                      }
                    >
                      <Plus size={14} /> Criar ficha
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div className="mt-1.5 text-xs">
              {cost === null ? (
                <span className="text-warn">{e.source === 'estoque' ? `Escolha o item e quanto vai num bolo de ${refDiameter} cm.` : 'Escolha ou crie a ficha técnica.'}</span>
              ) : (
                <span className="text-muted">
                  Custo num bolo de {refDiameter} cm: <b className="text-ink">{money(cost)}</b>
                  {e.source === 'estoque' && ' · sai do estoque quando o pedido entra em produção'}
                </span>
              )}
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => onChange([...list, { id: uid(), name: '', source: 'estoque', qty: 0 }])}
        className="inline-flex items-center gap-1 text-sm font-medium text-pink hover:underline"
      >
        <Plus size={14} /> Adicionar {label}
      </button>
    </div>
  );
}

/**
 * Guided set-up of a built cake: sizes (with how many receitas each takes), massas, recheios
 * and coberturas linked to fichas técnicas, and a live price table.
 */
export function CakeEditor({ initial, onSave, onCancel, onDelete }: { initial: CakeProduct; onSave: (c: CakeProduct) => void; onCancel: () => void; onDelete?: () => void }) {
  const { db, ctx } = useStore();
  const toast = useToast();
  const [c, setC] = useState<CakeProduct>(() => JSON.parse(JSON.stringify(initial)));
  const [error, setError] = useState('');
  const set = (p: Partial<CakeProduct>) => setC((x) => ({ ...x, ...p }));
  const setSize = (id: string, p: Partial<CakeSize>) => set({ sizes: c.sizes.map((s) => (s.id === id ? { ...s, ...p } : s)) });

  // price table: cheapest massa, with 1…max fillings (cheapest ones), no cobertura
  const table = useMemo(() => {
    const byCost = (l: CakeComponent[]) => [...l].filter((x) => x.recipeId).sort((a, b) => (layerCost(a.recipeId, db.recipes, ctx) ?? 0) - (layerCost(b.recipeId, db.recipes, ctx) ?? 0));
    const massa = byCost(c.massas)[0];
    const recheios = byCost(c.recheios);
    const counts = Array.from({ length: Math.min(c.maxRecheios, Math.max(1, recheios.length)) }, (_, i) => i + 1);
    return {
      counts,
      rows: c.sizes.map((s) => ({
        s,
        cells: counts.map((n) =>
          massa
            ? cakeQuote(
                c,
                {
                  sizeId: s.id,
                  massaId: massa.id,
                  recheioIds: recheios.slice(0, n).map((r) => r.id),
                },
                db.recipes,
                ctx,
                db.settings,
              )
            : null,
        ),
      })),
    };
  }, [c, db.recipes, ctx, db.settings]);

  const save = () => {
    setError('');
    if (!c.name.trim()) return setError('Dê um nome ao bolo.');
    if (!c.sizes.length) return setError('Cadastre pelo menos um tamanho.');
    if (c.sizes.some((s) => !s.name.trim() || !(s.massa > 0))) return setError('Cada tamanho precisa de nome e de quantas receitas de massa leva por camada.');
    if (!c.massas.some((m) => m.recipeId && m.name.trim())) return setError('Cadastre pelo menos uma massa com ficha técnica.');
    const clean = (l: CakeComponent[]) => l.filter((x) => x.name.trim() && x.recipeId).map((x) => ({ ...x, name: x.name.trim() }));
    const extras = (l: CakeExtra[] = []) => l.filter((x) => x.name.trim() && (x.source === 'ficha' ? !!x.recipeId : !!x.ingredientId && (x.qty ?? 0) > 0)).map((x) => ({ ...x, name: x.name.trim() }));
    onSave({
      ...c,
      name: c.name.trim(),
      massas: clean(c.massas),
      recheios: clean(c.recheios),
      coberturas: clean(c.coberturas),
      adicionais: extras(c.adicionais),
      decoracoes: extras(c.decoracoes),
    });
  };

  return (
    <div className="space-y-4 p-5">
      <Step n={1} title="Bolo">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Nome na loja">
            <TextInput value={c.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <label
            className="relative grid h-[68px] w-[68px] cursor-pointer place-items-center self-end overflow-hidden rounded-xl border border-dashed border-line bg-subtle text-muted hover:border-pink/50 hover:text-pink"
            title="Foto"
          >
            {c.image ? <img src={c.image} alt="" className="h-full w-full object-cover" /> : <Camera size={20} />}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Foto do bolo"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  set({ image: await shrinkImage(f) });
                } catch (err) {
                  toast(err instanceof Error ? err.message : 'Não foi possível usar esta foto', 'error');
                }
              }}
            />
          </label>
        </div>
        <Field label="Descrição" className="mt-3">
          <TextInput value={c.description} onChange={(e) => set({ description: e.target.value })} placeholder="Ex.: Monte seu bolo do seu jeito: tamanho, massa e até 2 recheios." />
        </Field>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Margem de lucro" hint="Usada para calcular o preço na loja.">
            <NumberInput value={c.marginPct} min={0} max={90} suffix="%" onChange={(v) => set({ marginPct: v })} />
          </Field>
          <label className="flex items-center gap-2 self-center text-sm">
            <input type="checkbox" checked={c.visible} onChange={(e) => set({ visible: e.target.checked })} className="h-4 w-4 accent-pink-600" />
            Mostrar na loja
          </label>
        </div>
      </Step>

      <Step n={2} title="Massas" hint="Para cada massa, uma ficha técnica com os ingredientes de 1 receita de massa (1 camada do bolo de referência).">
        <Components kind="Massa" list={c.massas} onChange={(massas) => set({ massas })} />
      </Step>

      <Step n={3} title="Recheios" hint="Uma ficha técnica por recheio, com os ingredientes de 1 receita (1 camada).">
        <Components kind="Recheio" list={c.recheios} onChange={(recheios) => set({ recheios })} />
        <Field
          label="Quantos recheios o cliente pode escolher"
          className="mt-3 max-w-xs"
          hint={`${c.maxRecheios} ${c.maxRecheios === 1 ? 'recheio' : 'recheios'} = ${c.maxRecheios + 1} camadas de massa + ${c.maxRecheios} de recheio.`}
        >
          <Select value={String(c.maxRecheios)} onChange={(e) => set({ maxRecheios: Number(e.target.value) })}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                Até {n}
              </option>
            ))}
          </Select>
        </Field>
      </Step>

      <Step
        n={4}
        title="Adicionais nos recheios (opcional)"
        hint={`Chocolate picado, bombom, KitKat… O cliente escolhe quantos quiser. Informe quanto vai num bolo de ${c.refDiameter} cm; nos outros tamanhos cresce junto com o recheio.`}
      >
        <Extras kind="adicional" list={c.adicionais ?? []} refDiameter={c.refDiameter} onChange={(adicionais) => set({ adicionais })} />
      </Step>

      <Step n={5} title="Coberturas (opcional)" hint="Ficha técnica com 1 receita de cobertura.">
        <Components kind="Cobertura" list={c.coberturas} onChange={(coberturas) => set({ coberturas })} />
      </Step>

      <Step n={6} title="Decoração (opcional)" hint={`Morangos, raspas de chocolate, confeitos… Informe quanto vai num bolo de ${c.refDiameter} cm; nos outros tamanhos cresce junto com a cobertura.`}>
        <Extras kind="decoracao" list={c.decoracoes ?? []} refDiameter={c.refDiameter} onChange={(decoracoes) => set({ decoracoes })} />
      </Step>

      <Step n={7} title="Tamanhos" hint="Para cada tamanho, quantas receitas você usa: de massa por camada, de recheio por camada e de cobertura no bolo todo. Extras = caixa, disco, topo…">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="text-left text-[11px] text-muted">
              <tr>
                <th className="pb-1.5 font-medium">Tamanho</th>
                <th className="pb-1.5 font-medium">Massa/camada</th>
                <th className="pb-1.5 font-medium">Recheio/camada</th>
                <th className="pb-1.5 font-medium">Cobertura</th>
                <th className="pb-1.5 font-medium">Extras R$</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {c.sizes.map((s) => (
                <tr key={s.id} className="align-top">
                  <td className="py-1 pr-2">
                    <TextInput aria-label="Nome do tamanho" value={s.name} onChange={(e) => setSize(s.id, { name: e.target.value })} placeholder="20 cm (serve 20)" />
                  </td>
                  <td className="py-1 pr-2">
                    <NumberInput aria-label="Receitas de massa por camada" value={s.massa} min={0} suffix="rec." onChange={(v) => setSize(s.id, { massa: v })} />
                  </td>
                  <td className="py-1 pr-2">
                    <NumberInput aria-label="Receitas de recheio por camada" value={s.recheio} min={0} suffix="rec." onChange={(v) => setSize(s.id, { recheio: v })} />
                  </td>
                  <td className="py-1 pr-2">
                    <NumberInput aria-label="Receitas de cobertura" value={s.cobertura} min={0} suffix="rec." onChange={(v) => setSize(s.id, { cobertura: v })} />
                  </td>
                  <td className="py-1 pr-2">
                    <NumberInput aria-label="Extras" value={s.extra} min={0} prefix="R$" onChange={(v) => setSize(s.id, { extra: v })} />
                  </td>
                  <td className="py-1">
                    <IconButton label="Remover tamanho" onClick={() => set({ sizes: c.sizes.filter((x) => x.id !== s.id) })}>
                      <Trash size={14} />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() =>
              set({
                sizes: [
                  ...c.sizes,
                  {
                    id: uid(),
                    name: '',
                    diameter: 0,
                    massa: 1,
                    recheio: 1,
                    cobertura: 1,
                    extra: 0,
                  },
                ],
              })
            }
          >
            <Plus size={14} /> Adicionar tamanho
          </Button>
          {!c.sizes.length && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                set({
                  sizes: [10, 15, 20, 25, 35].map((d) => ({
                    id: uid(),
                    name: `${d} cm`,
                    diameter: d,
                    massa: 0,
                    recheio: 0,
                    cobertura: 0,
                    extra: 0,
                  })),
                })
              }
            >
              Criar 10, 15, 20, 25 e 35 cm
            </Button>
          )}
        </div>
        {c.sizes.some((s) => s.diameter > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-subtle px-3 py-2 text-xs text-muted">
            <Sparkles size={13} className="text-lilac" />
            Não sabe as quantidades? Se suas fichas são para um bolo de
            <NumberInput value={c.refDiameter} min={1} suffix="cm" onChange={(v) => set({ refDiameter: v })} className="w-24" />
            <button
              type="button"
              className="font-semibold text-pink hover:underline"
              onClick={() =>
                set({
                  sizes: c.sizes.map((s) =>
                    s.diameter > 0
                      ? {
                          ...s,
                          massa: areaFactor(s.diameter, c.refDiameter),
                          recheio: areaFactor(s.diameter, c.refDiameter),
                          cobertura: areaFactor(s.diameter, c.refDiameter),
                        }
                      : s,
                  ),
                })
              }
            >
              sugerir pelo tamanho
            </button>
            <span>(você pode ajustar depois).</span>
          </div>
        )}
      </Step>

      <Step n={8} title="Prévia dos preços na loja" hint={`Com a massa e os recheios mais baratos, sem cobertura, margem de ${number(c.marginPct)}% e as taxas de venda de Custos operacionais.`}>
        {!table.rows.length || !c.massas.some((m) => m.recipeId) ? (
          <p className="text-sm text-muted">Cadastre tamanhos e pelo menos uma massa para ver os preços.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="text-left text-[11px] text-muted">
                <tr>
                  <th className="pb-1.5 font-medium">Tamanho</th>
                  {table.counts.map((n) => (
                    <th key={n} className="pb-1.5 text-right font-medium">
                      {n} recheio{n > 1 ? 's' : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {table.rows.map(({ s, cells }) => (
                  <tr key={s.id}>
                    <td className="py-2 font-medium">{s.name || '—'}</td>
                    {cells.map((q, i) => (
                      <td key={i} className="py-2 text-right tabular">
                        {q && !q.problems.length ? (
                          <>
                            <div className={cx('font-semibold', q.cost === 0 && 'text-warn')}>{money(q.price)}</div>
                            <div className="text-[11px] text-muted">custo {money(q.cost)}</div>
                          </>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Step>

      {error && (
        <p role="alert" className="rounded-lg bg-loss-soft px-3 py-2 text-sm text-loss">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-2 border-t border-divider pt-4">
        {onDelete ? (
          <Button variant="danger" size="sm" onClick={onDelete}>
            Excluir bolo
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button onClick={onCancel}>Cancelar</Button>
          <Button variant="primary" onClick={save}>
            Salvar bolo
          </Button>
        </div>
      </div>
    </div>
  );
}
