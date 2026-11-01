import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ShoppingBag, X } from 'lucide-react';
import { money } from '@cakeboss/domain/format';
import { missingChoices, selectionLabel, unitPriceFor, type Selection } from '@cakeboss/domain/shop';
import { promoPrice, promotionLabel } from '@cakeboss/domain/promotions';
import type { OptionGroup, Recipe } from '@cakeboss/domain/types';
import { Button, cx } from '../components/ui';
import { AnimatedCounter, useToast } from '../components/motion';
import { QtyStepper, useShop } from './ShopApp';
import { artFor, cleanName } from './art';

const deltaLabel = (d: number) => (d > 0 ? `+ ${money(d)}` : d < 0 ? `− ${money(-d)}` : '');

function GroupPicker({ g, value, onChange }: { g: OptionGroup; value: string[]; onChange: (ids: string[]) => void }) {
  const single = g.max <= 1;
  const full = !single && value.length >= g.max;
  return (
    <fieldset>
      <legend className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold">
        {g.name}
        <span className="text-xs font-normal text-muted">{single ? 'escolha 1' : `escolha até ${g.max}`}</span>
        {g.required ? <span className="rounded-full bg-pink-soft px-2 py-0.5 text-[10px] font-semibold text-pink">obrigatório</span> : <span className="text-[11px] text-muted">opcional</span>}
      </legend>
      <div role={single ? 'radiogroup' : 'group'} aria-label={g.name} className="flex flex-wrap gap-2">
        {g.choices.map((c) => {
          const on = value.includes(c.id);
          const off = !on && full;
          return (
            <button
              key={c.id}
              type="button"
              role={single ? 'radio' : 'checkbox'}
              aria-checked={on}
              disabled={off}
              onClick={() => onChange(single ? (on && !g.required ? [] : [c.id]) : on ? value.filter((x) => x !== c.id) : [...value, c.id])}
              className={cx(
                'flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                on ? 'border-pink bg-pink-soft/50 text-ink' : 'border-line hover:border-pink/40',
              )}
            >
              <span className={cx('grid h-4 w-4 shrink-0 place-items-center border', single ? 'rounded-full' : 'rounded', on ? 'border-pink bg-pink text-white' : 'border-line')}>
                {on && <Check size={11} />}
              </span>
              <span className="font-medium">{c.name}</span>
              {c.priceDelta !== 0 && <span className="text-xs tabular text-muted">{deltaLabel(c.priceDelta)}</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Product window: big photo, description, sizes/flavors and a live price preview. */
export function ProductDialog({ recipe, onClose }: { recipe: Recipe | null; onClose: () => void }) {
  const { add, openCart } = useShop();
  const toast = useToast();
  const reduce = useReducedMotion();
  const [sel, setSel] = useState<Selection>({});
  const [qty, setQty] = useState(1);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!recipe) return;
    // single-choice required groups with only one choice are picked for the customer
    const pre: Selection = {};
    for (const g of recipe.storeOptions ?? []) if (g.required && g.choices.length === 1) pre[g.id] = [g.choices[0].id];
    setSel(pre);
    setQty(1);
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [recipe, onClose]);

  const groups = (recipe?.storeOptions ?? []).filter((g) => g.choices.length);
  const { promotions } = useShop();
  const base = recipe ? unitPriceFor(recipe, sel) : 0;
  const { price: unit, promo } = recipe ? promoPrice(recipe.id, base, promotions) : { price: 0, promo: null };
  const missing = recipe ? missingChoices(recipe, sel) : [];
  const [emoji, grad] = recipe ? artFor(recipe) : ['', ''];

  return (
    <AnimatePresence>
      {recipe && (
        <motion.div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[3px]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={cleanName(recipe.name)}
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="relative grid max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-t-3xl bg-surface shadow-pop sm:rounded-3xl md:grid-cols-2"
          >
            <button onClick={onClose} aria-label="Fechar" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink shadow hover:bg-white">
              <X size={18} />
            </button>

            {/* photo (hover to zoom) or illustration */}
            <div
              className={`relative min-h-[260px] overflow-hidden bg-gradient-to-br md:min-h-[520px] ${grad}`}
              onPointerMove={(e) => {
                if (!recipe.storeImage || reduce || e.pointerType === 'touch') return;
                const b = e.currentTarget.getBoundingClientRect();
                setZoom({ x: ((e.clientX - b.left) / b.width) * 100, y: ((e.clientY - b.top) / b.height) * 100 });
              }}
              onPointerLeave={() => setZoom(null)}
            >
              {recipe.storeImage ? (
                <img
                  src={recipe.storeImage}
                  alt={cleanName(recipe.name)}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-200"
                  style={zoom ? { transform: 'scale(1.8)', transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center">
                  <motion.span className="select-none text-[140px] drop-shadow-2xl" animate={reduce ? undefined : { y: [0, -10, 0], rotate: [-3, 3, -3] }} transition={{ duration: 4, repeat: Infinity }}>
                    {emoji}
                  </motion.span>
                  <span className="absolute bottom-3 left-3 rounded-full bg-white/80 px-2.5 py-1 text-[11px] text-muted backdrop-blur">foto em breve</span>
                </div>
              )}
              {recipe.storeImage && !zoom && <span className="pointer-events-none absolute bottom-3 left-3 hidden rounded-full bg-black/50 px-2.5 py-1 text-[11px] text-white sm:block">passe o mouse para ampliar</span>}
            </div>

            <div className="flex min-h-0 flex-col">
              <div className="flex-1 space-y-5 overflow-y-auto p-6">
                <div>
                  {recipe.category && <div className="text-xs font-semibold uppercase tracking-wider text-pink">{recipe.category}</div>}
                  <h2 className="mt-1 text-2xl font-bold leading-tight">{cleanName(recipe.name)}</h2>
                  {recipe.storeDescription && <p className="mt-2 text-sm leading-relaxed text-muted">{recipe.storeDescription}</p>}
                  <div className="mt-2 text-sm text-muted">
                    {money(recipe.salePrice ?? 0)} por {recipe.unitLabel}
                    {groups.length > 0 && ' (preço base)'}
                    {promo && (
                      <span className="ml-2 rounded-full bg-pink px-2 py-0.5 text-xs font-semibold text-white">
                        {promo.name}: {promotionLabel(promo)}
                      </span>
                    )}
                  </div>
                </div>
                {groups.map((g) => (
                  <GroupPicker key={g.id} g={g} value={sel[g.id] ?? []} onChange={(ids) => setSel((s) => ({ ...s, [g.id]: ids }))} />
                ))}
              </div>

              {/* live price preview */}
              <div className="border-t border-divider bg-subtle/60 p-5">
                {selectionLabel(recipe, sel) && <p className="mb-2 text-xs text-muted">{selectionLabel(recipe, sel)}</p>}
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-xs text-muted">
                      {money(unit)} × {qty}
                    </div>
                    <AnimatedCounter value={unit * qty} format={money} className="text-3xl font-bold" />
                  </div>
                  <QtyStepper value={qty} onChange={(q) => setQty(Math.max(1, q))} min={1} />
                </div>
                <Button
                  variant="primary"
                  className="mt-4 h-12 w-full text-base"
                  disabled={missing.length > 0}
                  onClick={() => {
                    add(recipe.id, qty, sel);
                    toast(`${cleanName(recipe.name)} no carrinho`);
                    onClose();
                    openCart();
                  }}
                >
                  <ShoppingBag size={18} /> Adicionar ao carrinho
                </Button>
                {missing.length > 0 && <p className="mt-2 text-center text-xs text-warn">Escolha: {missing.join(', ')}</p>}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
