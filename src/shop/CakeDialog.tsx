import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ShoppingBag, X } from 'lucide-react';
import { useStore } from '../store/store';
import { money } from '../lib/format';
import { cakeQuote } from '../lib/cake';
import type { CakeComponent, CakeProduct, CakeSelection } from '../lib/types';
import { Button, cx } from '../components/ui';
import { AnimatedCounter, useToast } from '../components/motion';
import { QtyStepper, useShop } from './ShopApp';

/** Rough color of a layer from its name, for the stacked-cake preview. */
const COLORS: [RegExp, string][] = [
  [/nutella|chocolate|brigadeiro|cacau|trufa/i, '#4A2414'],
  [/ninho|leite|branco|baunilha|coco|chantininho|chantilly|creme/i, '#FFF4DE'],
  [/morango|frutas vermelhas|cereja/i, '#F472B6'],
  [/doce de leite|caramelo|paçoca|amendoim/i, '#C9894B'],
  [/maracujá|limão|abacaxi/i, '#FDE68A'],
  [/red velvet|vermelho/i, '#B91C1C'],
  [/cenoura|laranja/i, '#F59E0B'],
];
const colorOf = (name: string, fallback: string) => COLORS.find(([re]) => re.test(name))?.[1] ?? fallback;
/** Massas look like sponge cake (lighter), so a chocolate massa and a Nutella filling stay apart. */
const MASSA: [RegExp, string][] = [
  [/chocolate|cacau|nega maluca/i, '#9A6744'],
  [/red velvet|vermelh/i, '#B4383F'],
  [/cenoura|laranja/i, '#E9A651'],
];
const massaColor = (name: string) => MASSA.find(([re]) => re.test(name))?.[1] ?? '#F1D3A1';

function Chip({ on, onClick, disabled, children, title }: { on: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cx(
        'flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        on ? 'border-pink bg-pink-soft/50' : 'border-line hover:border-pink/40',
      )}
    >
      <span className={cx('grid h-4 w-4 shrink-0 place-items-center rounded-full border', on ? 'border-pink bg-pink text-white' : 'border-line')}>{on && <Check size={11} />}</span>
      {children}
    </button>
  );
}

/** Stacked layers that follow the customer's choices. */
function CakeStack({ cake, sel }: { cake: CakeProduct; sel: CakeSelection }) {
  const reduce = useReducedMotion();
  const massa = cake.massas.find((m) => m.id === sel.massaId);
  const recheios = sel.recheioIds.map((id) => cake.recheios.find((r) => r.id === id)).filter((r): r is CakeComponent => !!r);
  const cobertura = cake.coberturas.find((c) => c.id === sel.coberturaId);
  const sizeIdx = Math.max(0, cake.sizes.findIndex((s) => s.id === sel.sizeId));
  const width = 55 + (cake.sizes.length > 1 ? (sizeIdx / (cake.sizes.length - 1)) * 40 : 30); // % of the box
  const mColor = massa ? massaColor(massa.name) : '#EADBC8';
  const layers: { key: string; color: string; h: number; label: string }[] = [];
  const n = recheios.length;
  for (let i = 0; i <= n; i++) {
    layers.push({ key: `m${i}`, color: mColor, h: 30, label: massa ? `Massa ${massa.name}` : 'Massa' });
    if (i < n) layers.push({ key: `r${i}-${recheios[i].id}`, color: colorOf(recheios[i].name, '#F9A8D4'), h: 14, label: `Recheio ${recheios[i].name}` });
  }
  const spring = { type: 'spring' as const, stiffness: 260, damping: 22 };
  return (
    <div className="relative flex h-full min-h-[300px] flex-col items-center justify-end pb-10">
      <motion.div className="flex w-full flex-col-reverse items-center" animate={{ width: `${width}%` }} transition={spring}>
        <AnimatePresence initial={false}>
          {layers.map((l) => (
            <motion.div
              key={l.key}
              layout
              title={l.label}
              initial={reduce ? false : { opacity: 0, y: -40, scaleX: 0.9 }}
              animate={{ opacity: 1, y: 0, scaleX: 1 }}
              exit={{ opacity: 0, x: 40 }}
              transition={spring}
              className="w-full border-x border-black/5 shadow-[inset_0_-3px_0_rgba(0,0,0,0.06)]"
              style={{ height: l.h, background: l.color }}
            />
          ))}
        </AnimatePresence>
        <AnimatePresence>
          {cobertura && (
            <motion.div
              key={cobertura.id}
              initial={reduce ? false : { opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={spring}
              className="relative -mb-1 h-5 w-[104%] rounded-t-2xl"
              style={{ background: colorOf(cobertura.name, '#FFE4EF') }}
              title={`Cobertura ${cobertura.name}`}
            >
              {/* drips */}
              {[8, 22, 37, 55, 70, 86].map((x, i) => (
                <span key={x} className="absolute top-full rounded-b-full" style={{ left: `${x}%`, width: 9, height: 10 + (i % 3) * 6, background: colorOf(cobertura.name, '#FFE4EF') }} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      <div className="mt-0 h-3 rounded-full bg-white shadow-md" style={{ width: `${Math.min(100, width + 14)}%` }} />
      <div className="absolute bottom-3 text-xs font-medium text-muted">{cake.sizes[sizeIdx]?.name}</div>
    </div>
  );
}

/** Birthday cake builder: size, massa, fillings and topping, with a price preview from the fichas. */
export function CakeDialog({ cake, onClose }: { cake: CakeProduct | null; onClose: () => void }) {
  const { db, ctx } = useStore();
  const { addCake, openCart } = useShop();
  const toast = useToast();
  const [sel, setSel] = useState<CakeSelection>({ sizeId: '', massaId: '', recheioIds: [] });
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!cake) return;
    setSel({ sizeId: '', massaId: cake.massas.length === 1 ? cake.massas[0].id : '', recheioIds: [] });
    setQty(1);
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [cake, onClose]);

  const quote = useMemo(() => (cake ? cakeQuote(cake, sel, db.recipes, ctx, db.settings) : null), [cake, sel, db.recipes, ctx, db.settings]);
  // price of each size with what is chosen so far (or the cheapest massa/filling), shown on the size chips
  const sizePrices = useMemo(() => {
    if (!cake) return {} as Record<string, number>;
    const massaId = sel.massaId || cake.massas[0]?.id || '';
    const recheioIds = sel.recheioIds.length ? sel.recheioIds : cake.recheios[0] ? [cake.recheios[0].id] : [];
    return Object.fromEntries(cake.sizes.map((s) => [s.id, cakeQuote(cake, { ...sel, sizeId: s.id, massaId, recheioIds }, db.recipes, ctx, db.settings).price]));
  }, [cake, sel, db.recipes, ctx, db.settings]);

  if (!cake) return null;
  const ready = quote && !quote.problems.length && quote.price > 0;
  const full = sel.recheioIds.length >= cake.maxRecheios;

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[3px]" onClick={onClose} />
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={cake.name}
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="relative grid max-h-[94vh] w-full max-w-5xl overflow-hidden rounded-t-3xl bg-surface shadow-pop sm:rounded-3xl md:grid-cols-[1fr_1.1fr]"
        >
          <button onClick={onClose} aria-label="Fechar" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink shadow hover:bg-white">
            <X size={18} />
          </button>

          <div className="relative hidden bg-gradient-to-br from-pink-100 via-rose-50 to-violet-100 md:block">
            {cake.image && <img src={cake.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />}
            <div className="relative h-full p-8">
              <CakeStack cake={cake} sel={sel} />
            </div>
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-pink">Monte seu bolo</div>
                <h2 className="mt-1 text-2xl font-bold">{cake.name}</h2>
                {cake.description && <p className="mt-1 text-sm text-muted">{cake.description}</p>}
              </div>

              <div className="h-44 rounded-2xl bg-gradient-to-br from-pink-100 via-rose-50 to-violet-100 md:hidden">
                <CakeStack cake={cake} sel={sel} />
              </div>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold">1. Tamanho</legend>
                <div role="radiogroup" aria-label="Tamanho" className="flex flex-wrap gap-2">
                  {cake.sizes.map((s) => (
                    <Chip key={s.id} on={sel.sizeId === s.id} onClick={() => setSel({ ...sel, sizeId: s.id })}>
                      <span className="font-medium">{s.name}</span>
                      {sizePrices[s.id] > 0 && <span className="text-xs tabular text-muted">{money(sizePrices[s.id])}</span>}
                    </Chip>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-semibold">2. Massa</legend>
                <div role="radiogroup" aria-label="Massa" className="flex flex-wrap gap-2">
                  {cake.massas.map((m) => (
                    <Chip key={m.id} on={sel.massaId === m.id} onClick={() => setSel({ ...sel, massaId: m.id })}>
                      <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: massaColor(m.name) }} />
                      <span className="font-medium">{m.name}</span>
                    </Chip>
                  ))}
                </div>
              </fieldset>

              {cake.recheios.length > 0 && (
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold">
                    3. Recheios <span className="font-normal text-muted">— até {cake.maxRecheios} ({sel.recheioIds.length + 1} camadas de massa)</span>
                  </legend>
                  <div role="group" aria-label="Recheios" className="flex flex-wrap gap-2">
                    {cake.recheios.map((r) => {
                      const on = sel.recheioIds.includes(r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          disabled={!on && full}
                          onClick={() => setSel({ ...sel, recheioIds: on ? sel.recheioIds.filter((x) => x !== r.id) : [...sel.recheioIds, r.id] })}
                          className={cx(
                            'flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                            on ? 'border-pink bg-pink-soft/50' : 'border-line hover:border-pink/40',
                          )}
                        >
                          <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: colorOf(r.name, '#F9A8D4') }} />
                          <span className="font-medium">{r.name}</span>
                          {on && <span className="rounded-full bg-pink px-1.5 text-[10px] font-bold text-white">{sel.recheioIds.indexOf(r.id) + 1}</span>}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {cake.coberturas.length > 0 && (
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold">4. Cobertura</legend>
                  <div role="radiogroup" aria-label="Cobertura" className="flex flex-wrap gap-2">
                    <Chip on={!sel.coberturaId} onClick={() => setSel({ ...sel, coberturaId: undefined })}>
                      <span className="font-medium">Sem cobertura</span>
                    </Chip>
                    {cake.coberturas.map((c) => (
                      <Chip key={c.id} on={sel.coberturaId === c.id} onClick={() => setSel({ ...sel, coberturaId: c.id })}>
                        <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: colorOf(c.name, '#FFE4EF') }} />
                        <span className="font-medium">{c.name}</span>
                      </Chip>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>

            <div className="border-t border-divider bg-subtle/60 p-5">
              {quote?.label && <p className="mb-2 text-xs text-muted">{quote.label}</p>}
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-xs text-muted">Prévia do valor{qty > 1 && ` (${qty} bolos)`}</div>
                  {ready ? <AnimatedCounter value={quote.price * qty} format={money} className="text-3xl font-bold" /> : <div className="text-lg font-semibold text-muted">monte o bolo</div>}
                </div>
                <QtyStepper value={qty} onChange={(q) => setQty(Math.max(1, q))} min={1} />
              </div>
              <Button
                variant="primary"
                className="mt-4 h-12 w-full text-base"
                disabled={!ready}
                onClick={() => {
                  addCake(cake.id, sel, qty);
                  toast(`${cake.name} no carrinho`);
                  onClose();
                  openCart();
                }}
              >
                <ShoppingBag size={18} /> Adicionar ao carrinho
              </Button>
              {quote && quote.problems.length > 0 && <p className="mt-2 text-center text-xs text-warn">{quote.problems.join(' · ')}</p>}
              <p className="mt-2 text-center text-[11px] text-muted">Valor calculado com os custos atuais; a confeitaria confirma no pedido.</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
