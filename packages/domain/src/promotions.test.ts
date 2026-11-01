import { describe, expect, it } from 'vitest';
import { applyPromotion, promoPrice, promotionState } from './promotions';
import type { Promotion } from './types';

const promo = (p: Partial<Promotion>): Promotion => ({ id: 'p', name: 'Semana do brownie', kind: 'percent', value: 20, recipeIds: ['brownie'], startsOn: null, endsOn: null, active: true, createdAt: '', ...p });

describe('promoções da loja', () => {
  it('aplica porcentagem e valor fixo, sem passar de zero', () => {
    expect(applyPromotion(10, promo({ kind: 'percent', value: 20 }))).toBe(8);
    expect(applyPromotion(10, promo({ kind: 'off', value: 3.5 }))).toBe(6.5);
    expect(applyPromotion(10, promo({ kind: 'off', value: 15 }))).toBe(0);
  });

  it('só vale nos produtos escolhidos e dentro das datas', () => {
    const p = promo({ startsOn: '2026-11-01', endsOn: '2026-11-07' });
    expect(promoPrice('brownie', 10, [p], '2026-11-03').price).toBe(8);
    expect(promoPrice('bolo', 10, [p], '2026-11-03').price).toBe(10);
    expect(promoPrice('brownie', 10, [p], '2026-10-31').price).toBe(10);
    expect(promoPrice('brownie', 10, [p], '2026-11-08').price).toBe(10);
    expect(promotionState(p, '2026-10-31')).toBe('agendada');
    expect(promotionState(p, '2026-11-08')).toBe('encerrada');
  });

  it('pausada não vale; com duas, vale a mais barata para o cliente', () => {
    expect(promoPrice('brownie', 10, [promo({ active: false })]).price).toBe(10);
    const r = promoPrice('brownie', 10, [promo({ id: 'a', value: 10 }), promo({ id: 'b', kind: 'off', value: 3 })]);
    expect(r.price).toBe(7);
    expect(r.promo?.id).toBe('b');
  });

  it('ignora promoção inválida (100% ou valor zero)', () => {
    expect(promoPrice('brownie', 10, [promo({ value: 100 })]).price).toBe(10);
    expect(promoPrice('brownie', 10, [promo({ value: 0 })]).price).toBe(10);
  });
});
