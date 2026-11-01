import type { Address, CakeSelection, DeliveryZone, PaymentMethod, Recipe, Settings, StoreSettings } from './types';

/** Navegantes (SC) and neighboring cities. Fees start empty: a city is only offered once its fee is set. */
export const DEFAULT_CITIES = ['Navegantes', 'Itajaí', 'Penha', 'Balneário Piçarras', 'Luiz Alves', 'Ilhota'];

export const defaultStore = (): StoreSettings => ({
  enabled: true,
  whatsapp: '',
  pickupAddress: '',
  leadDays: 2,
  about: '',
  zones: DEFAULT_CITIES.map((city, i) => ({ id: `zona-${i}`, city, fee: null })),
});

export const storeSettings = (s: Settings): StoreSettings => ({ ...defaultStore(), ...s.store });

export const activeZones = (st: StoreSettings): (DeliveryZone & { fee: number })[] => st.zones.filter((z): z is DeliveryZone & { fee: number } => z.fee !== null && z.fee >= 0 && !!z.city.trim());

/** Products shown in the store: recipes with an official price that weren't hidden. */
export const storeProducts = (recipes: Recipe[]) => recipes.filter((r) => r.salePrice != null && r.salePrice > 0 && r.storeVisible !== false);

/**
 * Payment rules:
 * - delivery: only Pix or credit card, paid before production;
 * - pickup: Pix, card or cash at pickup.
 * Cash on delivery only when agreed on WhatsApp (outside the online checkout).
 */
export function allowedPayments(type: 'retirada' | 'entrega'): { method: PaymentMethod; label: string; note: string }[] {
  const pix = { method: 'pix' as const, label: 'Pix', note: 'Pague antes da produção. A chave Pix aparece ao finalizar o pedido.' };
  const card = { method: 'credito' as const, label: 'Cartão de crédito', note: 'Enviamos o link de pagamento do Mercado Pago pelo WhatsApp. Pague antes da produção.' };
  if (type === 'entrega') return [pix, card];
  return [pix, card, { method: 'dinheiro', label: 'Dinheiro na retirada', note: 'Pague em dinheiro quando vier buscar.' }];
}

/** Earliest date (yyyy-mm-dd, local) a customer can choose. */
export function earliestDate(leadDays: number, now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() + Math.max(0, leadDays));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const emptyAddress = (city = ''): Address => ({ city, district: '', street: '', number: '', complement: '', reference: '' });

export const addressMissing = (a?: Address) => !a || !a.city || !a.district.trim() || !a.street.trim() || !a.number.trim();

export const addressLine = (a: Address) =>
  [`${a.street}, ${a.number}`, a.complement, a.district, a.city].filter((x) => x && x.trim()).join(' · ') + (a.reference ? ` (ref.: ${a.reference})` : '');

/** Chosen options of a product: group id → choice ids. */
export type Selection = Record<string, string[]>;

export interface CartLine {
  /** product + chosen options; two different flavor choices are two lines */
  key: string;
  /** recipe id, or the cake id for built cakes */
  recipeId: string;
  qty: number;
  options?: Selection;
  cake?: CakeSelection;
}

export const lineKey = (recipeId: string, sel: Selection = {}) =>
  `${recipeId}|${Object.keys(sel)
    .filter((g) => sel[g]?.length)
    .sort()
    .map((g) => `${g}:${[...sel[g]].sort().join(',')}`)
    .join(';')}`;

/** Keeps only choices that still exist and respects each group's limit. */
export function cleanSelection(r: Recipe, sel: Selection = {}): Selection {
  const out: Selection = {};
  for (const g of r.storeOptions ?? []) {
    const ids = (sel[g.id] ?? []).filter((id) => g.choices.some((c) => c.id === id)).slice(0, Math.max(1, g.max));
    if (ids.length) out[g.id] = ids;
  }
  return out;
}

/** Price of one unit with the chosen options (never below zero). */
export function unitPriceFor(r: Recipe, sel: Selection = {}) {
  let p = r.salePrice ?? 0;
  for (const g of r.storeOptions ?? []) for (const id of sel[g.id] ?? []) p += g.choices.find((c) => c.id === id)?.priceDelta ?? 0;
  return Math.max(0, Math.round(p * 100) / 100);
}

/** "Tamanho: 20 cm · Recheio: Ninho, Morango" */
export function selectionLabel(r: Recipe, sel: Selection = {}) {
  return (r.storeOptions ?? [])
    .filter((g) => sel[g.id]?.length)
    .map((g) => `${g.name}: ${sel[g.id].map((id) => g.choices.find((c) => c.id === id)?.name ?? '').filter(Boolean).join(', ')}`)
    .join(' · ');
}

/** Names of required groups the customer still has to choose. */
export const missingChoices = (r: Recipe, sel: Selection = {}) => (r.storeOptions ?? []).filter((g) => g.required && g.choices.length && !sel[g.id]?.length).map((g) => g.name);

/** Lowest possible price, for "a partir de" on the menu. */
export function startingPrice(r: Recipe) {
  let p = r.salePrice ?? 0;
  for (const g of r.storeOptions ?? []) {
    if (!g.choices.length) continue;
    const deltas = g.choices.map((c) => c.priceDelta).sort((a, b) => a - b);
    // required groups add at least their cheapest choice; optional ones only if a choice is negative
    if (g.required) p += deltas[0];
    else if (deltas[0] < 0) p += deltas[0];
  }
  return Math.max(0, p);
}

export const hasOptions = (r: Recipe) => (r.storeOptions ?? []).some((g) => g.choices.length);
