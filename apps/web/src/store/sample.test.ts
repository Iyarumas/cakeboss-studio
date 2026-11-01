import { describe, expect, it } from 'vitest';
import { orderTotals } from '@cakeboss/domain/orders';
import { buildSample, buildSampleActivity, isSampleId } from './sample';
import { defaultSettings } from './store';

describe('dados de exemplo', () => {
  const s = buildSample();
  const settings = { ...defaultSettings(), ...s.settingsPatch };
  const ctx = { ingredients: s.ingredients, materials: s.materials, settings };
  const a = buildSampleActivity(s.recipes, s.ingredients, ctx, settings, 7);

  it('preenche todas as áreas do sistema', () => {
    expect(a.customers.length).toBeGreaterThan(0);
    expect(new Set(a.orders.map((o) => o.status))).toEqual(new Set(['entregue', 'pronto', 'em_producao', 'confirmado', 'orcamento']));
    expect(a.transactions.some((t) => t.type === 'entrada')).toBe(true);
    expect(a.transactions.some((t) => t.type === 'saida')).toBe(true);
    expect(a.purchases.length && a.productions.length && a.simulations.length && a.zones.length).toBeTruthy();
    expect(a.cake.massas.length && a.cake.recheios.length && a.cake.coberturas.length).toBeTruthy();
  });

  it('respeita as regras do banco (telefone, números de pedido, valores)', () => {
    for (const c of a.customers) expect(c.phone).toMatch(/^[0-9]{10,13}$/);
    expect(a.orders.map((o) => o.number)).toEqual([7, 8, 9, 10, 11]);
    for (const t of a.transactions) expect(t.amount).toBeGreaterThanOrEqual(0);
    for (const o of a.orders) for (const i of o.items) expect(i.qty).toBeGreaterThan(0);
  });

  it('custos vêm da precificação real das fichas', () => {
    for (const o of a.orders.filter((x) => x.status !== 'orcamento'))
      for (const i of o.items) expect(Number.isFinite(i.unitCost) && (i.unitCost ?? 0) > 0).toBe(true);
    for (const p of a.productions) expect(p.cost.totalCost).toBeGreaterThan(0);
  });

  it('pagamentos não passam do total do pedido', () => {
    const recipes = s.recipes;
    for (const o of a.orders) {
      const paid = a.transactions.filter((t) => t.orderId === o.id).reduce((x, t) => x + t.amount, 0);
      expect(paid).toBeLessThanOrEqual(orderTotals(o, a.transactions, recipes, ctx).total + 0.01);
    }
  });

  it('tudo que não tem marca "sample" é reconhecido pelo prefixo', () => {
    const ids = [...a.customers, ...a.orders, ...a.transactions, ...a.purchases, ...a.productions, ...a.simulations, ...a.zones, a.cake, a.promotion].map((x) => x.id);
    expect(ids.every(isSampleId)).toBe(true);
  });
});
