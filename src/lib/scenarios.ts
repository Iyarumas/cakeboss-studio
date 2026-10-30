import type { Composition, Ingredient, Material, PricingParams } from './types';
import type { PricingContext } from './pricing';

export type Adjustment =
  | { id: string; type: 'ingredientPrice'; ingredientId: string; percent: number }
  | { id: string; type: 'supplier'; ingredientId: string; packagePrice: number; packageQty: number; supplier: string }
  | { id: string; type: 'salePrice'; percent: number }
  | { id: string; type: 'quantity'; units: number }
  | { id: string; type: 'swapMaterial'; fromId: string; toId: string }
  | { id: string; type: 'margin'; marginPct: number }
  | { id: string; type: 'cardFee'; percent: number }
  | { id: string; type: 'discount'; percent: number }
  | { id: string; type: 'prepTime'; minutes: number };

export type AdjustmentType = Adjustment['type'];

export const ADJUSTMENT_LABEL: Record<AdjustmentType, string> = {
  ingredientPrice: 'Alterar custo de ingrediente',
  supplier: 'Comparar outro fornecedor',
  salePrice: 'Alterar preço de venda',
  quantity: 'Quantidade produzida',
  swapMaterial: 'Trocar embalagem / material',
  margin: 'Margem desejada',
  cardFee: 'Taxa de cartão',
  discount: 'Desconto promocional',
  prepTime: 'Tempo de preparo',
};

export interface ScenarioInput {
  comp: Composition;
  params: PricingParams;
  ctx: PricingContext;
}

/** Applies adjustments to copies of the inputs — the originals are never mutated. */
export function applyAdjustments(base: ScenarioInput, adjustments: Adjustment[]): ScenarioInput {
  let comp: Composition = { ...base.comp, materials: base.comp.materials.map((m) => ({ ...m })) };
  let params: PricingParams = { ...base.params };
  let ingredients: Ingredient[] = base.ctx.ingredients;
  const materials: Material[] = base.ctx.materials;

  for (const a of adjustments) {
    switch (a.type) {
      case 'ingredientPrice':
        ingredients = ingredients.map((i) => (i.id === a.ingredientId ? { ...i, packagePrice: i.packagePrice * (1 + a.percent / 100) } : i));
        break;
      case 'supplier':
        ingredients = ingredients.map((i) =>
          i.id === a.ingredientId ? { ...i, packagePrice: a.packagePrice, packageQty: a.packageQty, supplier: a.supplier } : i,
        );
        break;
      case 'salePrice':
        params = { ...params, salePrice: params.salePrice * (1 + a.percent / 100) };
        break;
      case 'quantity':
        params = { ...params, quantity: a.units };
        break;
      case 'swapMaterial':
        comp = { ...comp, materials: comp.materials.map((m) => (m.materialId === a.fromId ? { ...m, materialId: a.toId } : m)) };
        break;
      case 'margin':
        params = { ...params, marginPct: a.marginPct };
        break;
      case 'cardFee':
        params = { ...params, cardFeePct: a.percent };
        break;
      case 'discount':
        params = { ...params, discountPct: a.percent };
        break;
      case 'prepTime':
        comp = { ...comp, prepMinutes: a.minutes };
        break;
    }
  }
  return { comp, params, ctx: { ...base.ctx, ingredients, materials } };
}
