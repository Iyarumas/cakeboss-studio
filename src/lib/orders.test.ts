import { describe, expect, it } from 'vitest';
import { freezeCosts, orderTotals } from './orders';
import type { PricingContext } from './pricing';
import type { Order, Recipe, Settings, Transaction } from './types';

const settings = {
  businessName: '', ownerName: '', theme: 'light', gasMode: 'botijao', gasCylinderPrice: 0, gasCylinderKg: 13, gasBillValue: 0, gasBillConsumption: 0, gasBillUnit: 'm3', energyPricePerKwh: 0, waterPricePerM3: 0,
  laborMonthly: 0, laborHoursMonth: 0, fixedCosts: [], productiveHoursMonth: 0, cardFeePct: 0, commissionPct: 0, taxPct: 0,
  defaultMarginPct: 30, equipment: [], pixKey: '', messageTemplates: [],
} as Settings;
const ing = { id: 'i', name: 'Chocolate', unit: 'un' as const, packageQty: 1, packagePrice: 2, supplier: '', stock: 0, minStock: 0, priceHistory: [], updatedAt: '' };
const recipe: Recipe = {
  id: 'r', name: 'Brigadeiro', category: '', yield: 10, unitLabel: 'un', prepMinutes: 0, wastePct: 0, waterLiters: 0,
  ingredients: [{ ingredientId: 'i', qty: 10, unit: 'un' }], materials: [], equipment: [], otherCosts: [],
  salePrice: 5, targetMarginPct: 30, priceSnapshot: null, createdAt: '', updatedAt: '',
};
const ctx: PricingContext = { settings, ingredients: [ing], materials: [] };
const order: Order = {
  id: 'o', number: 1, customerId: null, customerName: 'Ana', deliveryAt: '', status: 'orcamento', discount: 5, deliveryFee: 10,
  notes: '', costFrozenAt: null, createdAt: '', updatedAt: '',
  items: [{ id: 'a', recipeId: 'r', name: 'Brigadeiro', qty: 20, unitPrice: 5, unitCost: null }],
};
const tx = (type: 'entrada' | 'saida', amount: number): Transaction => ({ id: Math.random() + '', date: '', type, category: '', description: '', amount, method: 'credito', orderId: 'o', createdAt: '' });

describe('orderTotals', () => {
  it('soma itens, desconto e taxa de entrega e estima o custo atual', () => {
    const t = orderTotals(order, [], [recipe], ctx);
    expect(t.subtotal).toBe(100);
    expect(t.total).toBe(105);
    expect(t.cost).toBeCloseTo(40); // custo unitário 2
    expect(t.costEstimated).toBe(true);
    expect(t.profit).toBeCloseTo(65);
    expect(t.payment).toBe('pendente');
  });

  it('desconta taxas de pagamento do lucro e calcula o saldo', () => {
    const t = orderTotals(order, [tx('entrada', 50), tx('saida', 2)], [recipe], ctx);
    expect(t.paid).toBe(50);
    expect(t.remaining).toBe(55);
    expect(t.profit).toBeCloseTo(63);
    expect(t.payment).toBe('parcial');
  });

  it('custo congelado não muda quando o insumo sobe', () => {
    const frozen = freezeCosts(order, [recipe], ctx);
    const pricier: PricingContext = { ...ctx, ingredients: [{ ...ing, packagePrice: 4 }] };
    const t = orderTotals(frozen, [], [recipe], pricier);
    expect(t.cost).toBeCloseTo(40);
    expect(t.costEstimated).toBe(false);
    expect(orderTotals(order, [], [recipe], pricier).cost).toBeCloseTo(80);
  });

  it('item avulso sem ficha deixa o custo desconhecido', () => {
    const t = orderTotals({ ...order, items: [...order.items, { id: 'b', recipeId: null, name: 'Topo', qty: 1, unitPrice: 20, unitCost: null }] }, [], [recipe], ctx);
    expect(t.costMissing).toBe(true);
  });
});

describe('whatsapp', () => {
  it('normaliza telefone brasileiro', async () => {
    const { normalizePhone } = await import('./whatsapp');
    expect(normalizePhone('(51) 99999-8888')).toBe('5551999998888');
    expect(normalizePhone('+55 51 99999-8888')).toBe('5551999998888');
    expect(normalizePhone('051 3333-4444')).toBe('555133334444');
    expect(normalizePhone('1234')).toBe('');
  });
  it('preenche variáveis e mantém as vazias visíveis', async () => {
    const { fillTemplate, missingVars } = await import('./whatsapp');
    const t = fillTemplate('Oi, {cliente}! Pix: {pix}', { cliente: 'Ana', pix: '' });
    expect(t).toBe('Oi, Ana! Pix: {pix}');
    expect(missingVars(t)).toEqual(['pix']);
  });
});

describe('indicadores do cliente', () => {
  it('soma compras firmes, ticket médio, frequência e favoritos', async () => {
    const { customerStats } = await import('./customers');
    const mk = (id: string, day: string, qty: number, status: Order['status'] = 'entregue'): Order => ({
      ...order, id, customerId: 'c1', status, deliveryAt: `${day}T12:00:00.000Z`, discount: 0, deliveryFee: 0,
      items: [{ id: 'x' + id, recipeId: 'r', name: 'Brigadeiro', qty, unitPrice: 5, unitCost: 2 }],
    });
    const orders = [mk('a', '2026-10-01', 10), mk('b', '2026-10-11', 20), mk('c', '2026-10-21', 30), mk('d', '2026-10-25', 99, 'orcamento'), mk('e', '2026-10-26', 99, 'cancelado')];
    const s = customerStats('c1', orders, [tx('entrada', 0)], [recipe], ctx, new Date('2026-10-31T12:00:00Z'));
    expect(s.orders.length).toBe(3);
    expect(s.quotes).toBe(1);
    expect(s.cancelled).toBe(1);
    expect(s.total).toBe(300);
    expect(s.avgTicket).toBe(100);
    expect(s.profit).toBeCloseTo(180); // (5 − 2) × 60
    expect(s.avgIntervalDays).toBeCloseTo(10);
    expect(s.daysSinceLast).toBe(10);
    expect(s.favorites[0]).toEqual({ name: 'Brigadeiro', qty: 60, value: 300 });
    expect(s.monthly[5].value).toBe(300);
  });
});
