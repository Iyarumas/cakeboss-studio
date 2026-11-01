import { describe, expect, it } from 'vitest';
import { OVEN_KG_PER_HOUR, SAMPLE_QUOTE, landingQuote } from './quote';

const cat = (r: ReturnType<typeof landingQuote>, key: string) => r.categories.find((c) => c.key === key)?.total ?? 0;

describe('calculadora da landing', () => {
  it('usa as mesmas partes de custo do sistema', () => {
    const r = landingQuote(SAMPLE_QUOTE);
    expect(cat(r, 'ingredientes')).toBeCloseTo(38.4, 2);
    expect(cat(r, 'embalagens')).toBeCloseTo(6.5, 2);
    expect(cat(r, 'maoDeObra')).toBeCloseTo(30, 2); // 2 h × R$ 15
    expect(cat(r, 'gas')).toBeCloseTo((45 / 60) * OVEN_KG_PER_HOUR * (120 / 13), 2);
    expect(r.unitCost).toBeCloseTo(38.4 + 6.5 + 30 + (45 / 60) * OVEN_KG_PER_HOUR * (120 / 13), 2);
  });

  it('preço sugerido = custo ÷ (1 − taxa − margem), e os números se conferem', () => {
    const r = landingQuote(SAMPLE_QUOTE);
    expect(r.suggestedPrice).toBeCloseTo(r.unitCost / (1 - 0.04 - 0.3), 2);
    expect(r.minPrice).toBeCloseTo(r.unitCost / (1 - 0.04), 2);
    // custo + taxa do cartão + lucro = preço
    expect(r.unitCost + r.suggestedPrice * 0.04 + r.suggestedPrice * 0.3).toBeCloseTo(r.suggestedPrice, 2);
  });

  it('sem forno não cobra gás', () => {
    expect(cat(landingQuote({ ...SAMPLE_QUOTE, ovenMinutes: 0 }), 'gas')).toBe(0);
  });
});
