import { computePricing, type PricingResult } from '@cakeboss/domain/pricing';
import { defaultSettings } from '../store/store';
import type { Composition, Ingredient, Material, Settings } from '@cakeboss/domain/types';

/** What the landing calculator asks, in the visitor's words. */
export interface QuoteInput {
  /** ingredients of one cake, in R$ */
  ingredients: number;
  /** box, board, ribbon, in R$ */
  packaging: number;
  /** hands-on time, in hours */
  hours: number;
  /** what the baker wants to earn per hour, in R$ */
  hourly: number;
  /** oven time, in minutes */
  ovenMinutes: number;
  /** price of a 13 kg gas cylinder, in R$ */
  gasCylinder: number;
  /** desired profit margin, % of the price */
  marginPct: number;
  /** card fee, % of the price */
  cardFeePct: number;
}

/** A typical home oven burns about a quarter of a kilo of gas per hour (13 kg cylinder). */
export const OVEN_KG_PER_HOUR = 0.25;

export const SAMPLE_QUOTE: QuoteInput = { ingredients: 38.4, packaging: 6.5, hours: 2, hourly: 15, ovenMinutes: 45, gasCylinder: 120, marginPct: 30, cardFeePct: 4 };

/**
 * Prices one cake with the SAME engine the panel uses (computePricing): the visitor's figures become a
 * one-cake recipe, an oven on gas and her hourly rate, so the landing never shows a number the system would not.
 */
export function landingQuote(q: QuoteInput): PricingResult {
  const settings: Settings = {
    ...defaultSettings(),
    gasMode: 'botijao',
    gasCylinderPrice: Math.max(0, q.gasCylinder),
    gasCylinderKg: 13,
    laborMonthly: Math.max(0, q.hourly),
    laborHoursMonth: 1,
    cardFeePct: Math.max(0, q.cardFeePct),
    commissionPct: 0,
    taxPct: 0,
    defaultMarginPct: q.marginPct,
    equipment: [{ id: 'forno', name: 'Forno', source: 'gas', consumption: OVEN_KG_PER_HOUR }],
    fixedCosts: [],
  };
  const ingredients: Ingredient[] = [
    { id: 'ing', name: 'Ingredientes', unit: 'un', packageQty: 1, packagePrice: Math.max(0, q.ingredients), supplier: '', stock: 0, minStock: 0, priceHistory: [], updatedAt: '' },
  ];
  const materials: Material[] = [
    { id: 'emb', name: 'Embalagem', kind: 'embalagem', packageQty: 1, packagePrice: Math.max(0, q.packaging), supplier: '', stock: 0, minStock: 0, priceHistory: [], updatedAt: '' },
  ];
  const comp: Composition = {
    yield: 1,
    unitLabel: 'bolo',
    prepMinutes: Math.max(0, q.hours) * 60,
    wastePct: 0,
    waterLiters: 0,
    ingredients: [{ ingredientId: 'ing', qty: 1, unit: 'un' }],
    materials: [{ materialId: 'emb', qty: 1, per: 'unit' }],
    equipment: q.ovenMinutes > 0 ? [{ equipmentId: 'forno', minutes: q.ovenMinutes }] : [],
    otherCosts: [],
  };
  return computePricing(
    comp,
    { quantity: 1, salePrice: 0, marginPct: q.marginPct, wastePct: 0, cardFeePct: settings.cardFeePct, commissionPct: 0, taxPct: 0, discountPct: 0 },
    { ingredients, materials, settings },
  );
}
