import { describe, expect, it } from 'vitest';
import { computePricing, gasUnitLabel, gasUnitPrice, type PricingContext } from './pricing';
import { applyAdjustments } from './scenarios';
import type { Composition, PricingParams, Settings } from './types';

const settings: Settings = {
  businessName: '', ownerName: '', theme: 'light',
  gasMode: 'botijao', gasCylinderPrice: 104, gasCylinderKg: 13, gasBillValue: 0, gasBillConsumption: 0, gasBillUnit: 'm3', energyPricePerKwh: 1, waterPricePerM3: 10,
  laborMonthly: 1000, laborHoursMonth: 100,
  fixedCosts: [{ id: 'f', name: 'aluguel', monthly: 500 }], productiveHoursMonth: 100,
  cardFeePct: 5, commissionPct: 0, taxPct: 0, defaultMarginPct: 20,
  equipment: [{ id: 'forno', name: 'Forno', source: 'gas', consumption: 0.5 }],
  pixKey: '', messageTemplates: [],
};
const ctx: PricingContext = {
  settings,
  ingredients: [{ id: 'far', name: 'Farinha', unit: 'kg', packageQty: 1, packagePrice: 10, supplier: '', stock: 0, minStock: 0, priceHistory: [], updatedAt: '' }],
  materials: [
    { id: 'box', name: 'Caixa', kind: 'embalagem', packageQty: 10, packagePrice: 10, supplier: '', stock: 0, minStock: 0, priceHistory: [], updatedAt: '' },
    { id: 'box2', name: 'Caixa barata', kind: 'embalagem', packageQty: 10, packagePrice: 5, supplier: '', stock: 0, minStock: 0, priceHistory: [], updatedAt: '' },
  ],
};
const comp: Composition = {
  yield: 10, unitLabel: 'un', prepMinutes: 60, wastePct: 0, waterLiters: 0,
  ingredients: [{ ingredientId: 'far', qty: 500, unit: 'g' }],
  materials: [{ materialId: 'box', qty: 1, per: 'unit' }],
  equipment: [], otherCosts: [],
};
const params: PricingParams = { quantity: 10, salePrice: 5, marginPct: 20, wastePct: 0, cardFeePct: 5, commissionPct: 0, taxPct: 0, discountPct: 0 };
const cat = (r: ReturnType<typeof computePricing>, k: string) => r.categories.find((c) => c.key === k)!.total;

describe('computePricing', () => {
  it('soma custos diretos e rateio fixo de um lote', () => {
    const r = computePricing(comp, params, ctx);
    expect(cat(r, 'ingredientes')).toBeCloseTo(5);
    expect(cat(r, 'embalagens')).toBeCloseTo(10);
    expect(cat(r, 'maoDeObra')).toBeCloseTo(10);
    expect(cat(r, 'fixos')).toBeCloseTo(5);
    expect(r.totalCost).toBeCloseTo(30);
    expect(r.unitCost).toBeCloseTo(3);
  });

  it('diferencia margem de lucro, margem de contribuição e markup', () => {
    const r = computePricing(comp, params, ctx);
    expect(r.unitProfit).toBeCloseTo(5 * 0.95 - 3); // 1,75
    expect(r.profitMarginPct).toBeCloseTo(35);
    expect(r.contributionMarginPct).toBeCloseTo(((4.75 - 2.5) / 5) * 100); // fixos fora
    expect(r.markup).toBeCloseTo(5 / 3);
    expect(r.totalProfit).toBeCloseTo(17.5);
  });

  it('calcula preço mínimo e preço sugerido sobre o preço', () => {
    const r = computePricing(comp, params, ctx);
    expect(r.minPrice).toBeCloseTo(3 / 0.95);
    expect(r.suggestedPrice).toBeCloseTo(3 / 0.75);
    const check = computePricing(comp, { ...params, salePrice: r.suggestedPrice }, ctx);
    expect(check.profitMarginPct).toBeCloseTo(20);
    const zero = computePricing(comp, { ...params, salePrice: r.minPrice }, ctx);
    expect(zero.unitProfit).toBeCloseTo(0);
  });

  it('perdas: custo das unidades perdidas é absorvido pelas aproveitáveis', () => {
    const r = computePricing(comp, { ...params, wastePct: 10 }, ctx);
    // lote 20 (ingred+mão+fixo) + 9 caixas
    expect(r.usableUnits).toBeCloseTo(9);
    expect(r.totalCost).toBeCloseTo(29);
    expect(cat(r, 'perdas')).toBeCloseTo(2);
    expect(r.unitCost).toBeCloseTo(29 / 9);
  });

  it('cobra tempo e equipamento por lote iniciado', () => {
    const r = computePricing({ ...comp, equipment: [{ equipmentId: 'forno', minutes: 30 }] }, { ...params, quantity: 15 }, ctx);
    expect(r.runs).toBe(2);
    expect(cat(r, 'ingredientes')).toBeCloseTo(7.5);
    expect(cat(r, 'maoDeObra')).toBeCloseTo(20);
    expect(cat(r, 'gas')).toBeCloseTo(2 * 0.5 * 0.5 * 8);
    expect(r.totalCost).toBeCloseTo(7.5 + 15 + 20 + 10 + 4);
  });

  it('desconto reduz o preço efetivo e as taxas incidem sobre ele', () => {
    const r = computePricing(comp, { ...params, discountPct: 10 }, ctx);
    expect(r.effectivePrice).toBeCloseTo(4.5);
    expect(r.unitProfit).toBeCloseTo(4.5 * 0.95 - 3);
  });

  it('alerta quando margem + despesas >= 100% e não inventa preço', () => {
    const r = computePricing(comp, { ...params, marginPct: 96 }, ctx);
    expect(Number.isNaN(r.suggestedPrice)).toBe(true);
    expect(r.alerts.some((a) => a.level === 'erro')).toBe(true);
  });

  it('alerta sobre preço de insumo ausente', () => {
    const c2 = { ...ctx, ingredients: [{ ...ctx.ingredients[0], packagePrice: 0 }] };
    const r = computePricing(comp, params, c2);
    expect(r.alerts.some((a) => a.message.includes('sem preço'))).toBe(true);
  });
});

describe('cenários', () => {
  it('aplica ajustes sem alterar os dados originais', () => {
    const before = JSON.stringify({ comp, params, ctx });
    const s = applyAdjustments({ comp, params, ctx }, [
      { id: '1', type: 'ingredientPrice', ingredientId: 'far', percent: 15 },
      { id: '2', type: 'swapMaterial', fromId: 'box', toId: 'box2' },
    ]);
    expect(JSON.stringify({ comp, params, ctx })).toBe(before);
    const r = computePricing(s.comp, s.params, s.ctx);
    expect(cat(r, 'ingredientes')).toBeCloseTo(5.75);
    expect(cat(r, 'embalagens')).toBeCloseTo(5);
  });
});

describe('gás', () => {
  it('botijão: preço pago ÷ kg do botijão', () => {
    expect(gasUnitPrice({ ...settings, gasMode: 'botijao', gasCylinderPrice: 117, gasCylinderKg: 13 })).toBeCloseTo(9);
  });
  it('encanado: valor do boleto ÷ consumo, na unidade do boleto', () => {
    const s = { ...settings, gasMode: 'encanado' as const, gasBillValue: 90, gasBillConsumption: 6, gasBillUnit: 'm3' as const };
    expect(gasUnitPrice(s)).toBeCloseTo(15);
    expect(gasUnitLabel(s)).toBe('m³');
    const r = computePricing({ ...comp, equipment: [{ equipmentId: 'forno', minutes: 60 }] }, params, { ...ctx, settings: s });
    expect(cat(r, 'gas')).toBeCloseTo(0.5 * 15); // 1 h × 0,5 m³/h × R$ 15
  });
  it('sem preço do gás gera alerta', () => {
    const s = { ...settings, gasCylinderPrice: 0 };
    const r = computePricing({ ...comp, equipment: [{ equipmentId: 'forno', minutes: 60 }] }, params, { ...ctx, settings: s });
    expect(r.alerts.some((a) => a.message.includes('gás'))).toBe(true);
  });
});
