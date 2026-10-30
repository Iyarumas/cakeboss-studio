import { describe, expect, it } from 'vitest';
import { areaFactor, cakeQuote } from './cake';
import type { PricingContext } from './pricing';
import type { CakeProduct, Recipe, Settings } from './types';

const settings = {
  gasMode: 'botijao', gasCylinderPrice: 0, gasCylinderKg: 13, gasBillValue: 0, gasBillConsumption: 0, gasBillUnit: 'm3',
  energyPricePerKwh: 0, waterPricePerM3: 0, laborMonthly: 0, laborHoursMonth: 0, fixedCosts: [], productiveHoursMonth: 0,
  cardFeePct: 0, commissionPct: 0, taxPct: 0, defaultMarginPct: 30, equipment: [], pixKey: '', messageTemplates: [],
} as unknown as Settings;
const ing = (id: string, price: number) => ({ id, name: id, unit: 'un' as const, packageQty: 1, packagePrice: price, supplier: '', stock: 0, minStock: 0, priceHistory: [], updatedAt: '' });
// each ficha = 1 layer at 20 cm, made of one "unit" ingredient with the given price
const ficha = (id: string, ingredientId: string): Recipe =>
  ({ id, name: id, category: '', yield: 1, unitLabel: 'camada', prepMinutes: 0, wastePct: 0, waterLiters: 0, ingredients: [{ ingredientId, qty: 1, unit: 'un' }], materials: [], equipment: [], otherCosts: [], salePrice: null, targetMarginPct: 30, priceSnapshot: null, createdAt: '', updatedAt: '' }) as Recipe;
const ctx: PricingContext = { settings, ingredients: [ing('i-massa', 10), ing('i-ninho', 8), ing('i-nutella', 14), ing('i-cob', 6)], materials: [] };
const recipes = [ficha('massa', 'i-massa'), ficha('ninho', 'i-ninho'), ficha('nutella', 'i-nutella'), ficha('cob', 'i-cob')];
const cake: CakeProduct = {
  id: 'c', name: 'Bolo', description: '', visible: true, refDiameter: 20, maxRecheios: 3, marginPct: 50,
  sizes: [{ id: 's20', name: '20 cm', diameter: 20, massa: 1, recheio: 1, cobertura: 1, extra: 0 }, { id: 's30', name: '30 cm', diameter: 30, massa: 2, recheio: 1.5, cobertura: 2.5, extra: 5 }],
  massas: [{ id: 'm', name: 'Chocolate', recipeId: 'massa' }],
  recheios: [{ id: 'r1', name: 'Ninho', recipeId: 'ninho' }, { id: 'r2', name: 'Nutella', recipeId: 'nutella' }],
  coberturas: [{ id: 'c1', name: 'Chantininho', recipeId: 'cob' }],
};

describe('bolo montado', () => {
  it('sugestão pela área: 30 cm ≈ 2,25× o de 20 cm', () => {
    expect(areaFactor(30, 20)).toBe(2.25);
    expect(areaFactor(10, 20)).toBe(0.25);
  });

  it('2 recheios = 3 camadas de massa + 2 de recheio', () => {
    const q = cakeQuote(cake, { sizeId: 's20', massaId: 'm', recheioIds: ['r1', 'r2'] }, recipes, ctx, settings);
    expect(q.cost).toBeCloseTo(3 * 10 + 8 + 14);
    expect(q.price).toBe(104); // 52 ÷ (1 − 0,5)
    expect(q.components.find((c) => c.recipeId === 'massa')?.batches).toBe(3);
  });

  it('usa as receitas que a confeiteira definiu para cada tamanho e soma os extras', () => {
    const q = cakeQuote(cake, { sizeId: 's30', massaId: 'm', recheioIds: ['r1'], coberturaId: 'c1' }, recipes, ctx, settings);
    // 2 camadas × 2 receitas de massa + 1,5 de recheio + 2,5 de cobertura + R$ 5 de extras
    expect(q.cost).toBeCloseTo(2 * 2 * 10 + 1.5 * 8 + 2.5 * 6 + 5);
  });

  it('avisa quando falta escolha', () => {
    expect(cakeQuote(cake, { sizeId: '', massaId: 'm', recheioIds: [] }, recipes, ctx, settings).problems.length).toBeGreaterThan(0);
  });
});
