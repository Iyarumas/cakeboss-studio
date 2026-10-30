import { priceRecipe, type PricingContext } from './pricing';
import type { CakeComponent, CakeProduct, CakeSelection, Recipe, Settings } from './types';

/**
 * Built cakes ("bolo montado").
 *
 * Each massa / recheio / cobertura points to a ficha técnica (one "receita").
 * The baker registers each size with how many receitas it takes: massa and recheio per layer,
 * cobertura for the whole cake. With N fillings the cake has N + 1 massa layers and N filling layers.
 *
 *   cost = (N+1)·size.massa·massa + Σ size.recheio·recheio_i + size.cobertura·cobertura + size.extra
 *   price = cost ÷ (1 − sale fees − margin), rounded up to R$ 0,50
 */

/** Suggestion only: area of a diameter relative to the reference size. */
export const areaFactor = (diameter: number, refDiameter: number) => (refDiameter > 0 ? Math.round(((diameter / refDiameter) ** 2) * 100) / 100 : 1);

/** Cost of one receita (one batch of the ficha técnica, divided by its yield). */
export function layerCost(recipeId: string, recipes: Recipe[], ctx: PricingContext): number | null {
  const r = recipes.find((x) => x.id === recipeId);
  if (!r) return null;
  const p = priceRecipe(r, ctx);
  return Number.isFinite(p.totalCost) ? p.totalCost / Math.max(1, r.yield) : null;
}

export interface CakeQuote {
  cost: number;
  price: number;
  /** cost per part, for the admin */
  parts: { label: string; cost: number }[];
  /** fichas and batches used, to take them out of stock */
  components: { recipeId: string; batches: number }[];
  /** something can't be priced (deleted ficha, missing choice) */
  problems: string[];
  label: string;
}

const find = (list: CakeComponent[], id?: string) => list.find((c) => c.id === id);

export function cakeQuote(cake: CakeProduct, sel: CakeSelection, recipes: Recipe[], ctx: PricingContext, settings: Settings): CakeQuote {
  const problems: string[] = [];
  const parts: CakeQuote['parts'] = [];
  const components: CakeQuote['components'] = [];
  const size = cake.sizes.find((s) => s.id === sel.sizeId);
  const massa = find(cake.massas, sel.massaId);
  const recheios = sel.recheioIds.map((id) => find(cake.recheios, id)).filter((c): c is CakeComponent => !!c);
  const cobertura = find(cake.coberturas, sel.coberturaId);
  if (!size) problems.push('Escolha o tamanho');
  if (!massa) problems.push('Escolha a massa');
  if (!recheios.length && cake.recheios.length) problems.push('Escolha pelo menos 1 recheio');

  const add = (c: CakeComponent, receitas: number, label: string) => {
    const unit = layerCost(c.recipeId, recipes, ctx);
    if (unit === null) {
      problems.push(`A ficha técnica de "${c.name}" não existe mais`);
      return;
    }
    parts.push({ label, cost: unit * receitas });
    components.push({ recipeId: c.recipeId, batches: receitas });
  };
  if (size && massa) {
    const layers = recheios.length + 1;
    add(massa, layers * size.massa, `Massa ${massa.name}: ${layers} camada${layers > 1 ? 's' : ''}`);
    for (const r of recheios) add(r, size.recheio, `Recheio ${r.name}`);
    if (cobertura) add(cobertura, size.cobertura, `Cobertura ${cobertura.name}`);
    if (size.extra) parts.push({ label: `Extras do tamanho ${size.name}`, cost: size.extra });
  }

  const cost = parts.reduce((a, p) => a + p.cost, 0);
  const v = (settings.cardFeePct + settings.commissionPct + settings.taxPct) / 100;
  const m = cake.marginPct / 100;
  const raw = v + m < 1 ? cost / (1 - v - m) : NaN;
  const price = Number.isFinite(raw) && cost > 0 ? Math.ceil(raw * 2 - 1e-9) / 2 : 0;
  if (v + m >= 1) problems.push('Margem + taxas somam 100% ou mais');

  const label = [size?.name, massa && `Massa: ${massa.name}`, recheios.length && `Recheio${recheios.length > 1 ? 's' : ''}: ${recheios.map((r) => r.name).join(', ')}`, cobertura && `Cobertura: ${cobertura.name}`]
    .filter(Boolean)
    .join(' · ');
  return { cost, price, parts, components: components.filter((c) => c.batches > 0), problems, label };
}

/** Cheapest possible cake (smallest-cost size, massa and filling) for "a partir de". */
export function cakeStartingPrice(cake: CakeProduct, recipes: Recipe[], ctx: PricingContext, settings: Settings) {
  let best = Infinity;
  for (const s of cake.sizes)
    for (const m of cake.massas) {
      const recheio = cake.recheios.length ? [cake.recheios.reduce((a, b) => ((layerCost(a.recipeId, recipes, ctx) ?? Infinity) <= (layerCost(b.recipeId, recipes, ctx) ?? Infinity) ? a : b)).id] : [];
      const q = cakeQuote(cake, { sizeId: s.id, massaId: m.id, recheioIds: recheio }, recipes, ctx, settings);
      if (!q.problems.length && q.price > 0) best = Math.min(best, q.price);
    }
  return Number.isFinite(best) ? best : null;
}

/** A cake is sellable when it has at least one size and one massa. */
export const cakeReady = (c: CakeProduct) => c.visible && c.sizes.length > 0 && c.massas.length > 0;
