import type { Promotion } from './types';

/** Today as yyyy-mm-dd in local time. */
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export type PromotionState = 'ativa' | 'agendada' | 'encerrada' | 'pausada';

export function promotionState(p: Promotion, today = localDay()): PromotionState {
  if (!p.active) return 'pausada';
  if (p.startsOn && today < p.startsOn) return 'agendada';
  if (p.endsOn && today > p.endsOn) return 'encerrada';
  return 'ativa';
}

const valid = (p: Promotion) => Number.isFinite(p.value) && p.value > 0 && (p.kind !== 'percent' || p.value < 100);

/** Price after the promotion, rounded to cents and never below zero. */
export function applyPromotion(price: number, p: Promotion) {
  const after = p.kind === 'percent' ? price * (1 - p.value / 100) : price - p.value;
  return Math.max(0, Math.round(after * 100) / 100);
}

/** The running promotion that gives this product the lowest price, if any. */
export function promotionFor(recipeId: string, promos: Promotion[] | undefined, basePrice: number, today = localDay()): Promotion | null {
  let best: Promotion | null = null;
  for (const p of promos ?? []) {
    if (!valid(p) || promotionState(p, today) !== 'ativa' || !p.recipeIds.includes(recipeId)) continue;
    if (!best || applyPromotion(basePrice, p) < applyPromotion(basePrice, best)) best = p;
  }
  return best;
}

/** Price the customer pays for one unit: the base price with the best running promotion applied. */
export function promoPrice(recipeId: string, basePrice: number, promos: Promotion[] | undefined, today = localDay()) {
  const promo = promotionFor(recipeId, promos, basePrice, today);
  return { price: promo ? applyPromotion(basePrice, promo) : basePrice, promo };
}

/** "20% off" / "R$ 5 off" for labels. */
export const promotionLabel = (p: Promotion) =>
  p.kind === 'percent' ? `${String(p.value).replace('.', ',')}% off` : `${p.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} off`;
