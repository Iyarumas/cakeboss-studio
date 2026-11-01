import { priceRecipe, type PricingContext } from './pricing';
import type { Order, OrderStatus, PaymentMethod, Recipe, Transaction } from './types';

export const STATUS: Record<OrderStatus, { label: string; tone: 'gray' | 'cacau' | 'pink' | 'amber' | 'green' | 'red' }> = {
  orcamento: { label: 'Orçamento', tone: 'gray' },
  confirmado: { label: 'Confirmado', tone: 'cacau' },
  em_producao: { label: 'Em produção', tone: 'pink' },
  pronto: { label: 'Pronto', tone: 'amber' },
  entregue: { label: 'Entregue', tone: 'green' },
  cancelado: { label: 'Cancelado', tone: 'red' },
};
export const STATUS_FLOW: OrderStatus[] = ['orcamento', 'confirmado', 'em_producao', 'pronto', 'entregue'];
/** Statuses in which the sale is firm, so its cost must be frozen. */
export const isFirm = (s: OrderStatus) => s !== 'orcamento' && s !== 'cancelado';
/** Statuses meaning the order is being (or was) produced: stock is taken out on the first one. */
export const consumesStock = (s: OrderStatus) => s === 'em_producao' || s === 'pronto' || s === 'entregue';
export const isOpen = (s: OrderStatus) => s !== 'entregue' && s !== 'cancelado';

export const METHOD_LABEL: Record<PaymentMethod, string> = { pix: 'Pix', dinheiro: 'Dinheiro', credito: 'Cartão de crédito', debito: 'Cartão de débito', outro: 'Outro' };
export const FEE_CATEGORY = 'Taxas de pagamento';
export const SALE_CATEGORY = 'Vendas';

export const EXPENSE_CATEGORIES = ['Ingredientes', 'Embalagens e adesivos', 'Gás', 'Energia elétrica', 'Água', 'Aluguel', 'Equipamentos', 'Transporte e entrega', 'Marketing', 'Impostos', FEE_CATEGORY, 'Pró-labore', 'Outros'];
export const INCOME_CATEGORIES = [SALE_CATEGORY, 'Outras receitas'];

export interface OrderTotals {
  subtotal: number;
  total: number;
  paid: number;
  remaining: number;
  fees: number;
  cost: number;
  /** true when at least one item has no frozen cost and the value is a current estimate */
  costEstimated: boolean;
  /** true when an item has no recipe and no frozen cost, so cost is unknown */
  costMissing: boolean;
  profit: number;
  marginPct: number;
  payment: 'pago' | 'parcial' | 'pendente';
}

/** Current unit cost of a recipe (one batch, current prices). */
export const currentUnitCost = (recipe: Recipe | undefined, ctx: PricingContext) => (recipe ? priceRecipe(recipe, ctx).unitCost : NaN);

export function orderTotals(order: Order, transactions: Transaction[], recipes: Recipe[], ctx: PricingContext): OrderTotals {
  const subtotal = order.items.reduce((a, i) => a + i.qty * i.unitPrice, 0);
  const total = Math.max(0, subtotal - (order.discount || 0) + (order.deliveryFee || 0));
  const linked = transactions.filter((t) => t.orderId === order.id);
  const paid = linked.filter((t) => t.type === 'entrada').reduce((a, t) => a + t.amount, 0);
  const fees = linked.filter((t) => t.type === 'saida').reduce((a, t) => a + t.amount, 0);

  let cost = 0;
  let costEstimated = false;
  let costMissing = false;
  for (const it of order.items) {
    if (it.unitCost != null) cost += it.qty * it.unitCost;
    else {
      const c = currentUnitCost(recipes.find((r) => r.id === it.recipeId), ctx);
      if (Number.isFinite(c)) {
        cost += it.qty * c;
        costEstimated = true;
      } else costMissing = true;
    }
  }
  const profit = total - fees - cost;
  return {
    subtotal,
    total,
    paid,
    remaining: Math.max(0, total - paid),
    fees,
    cost,
    costEstimated,
    costMissing,
    profit,
    marginPct: total > 0 ? (profit / total) * 100 : NaN,
    payment: total > 0 && paid >= total - 0.005 ? 'pago' : paid > 0 ? 'parcial' : 'pendente',
  };
}

/** Freezes the current unit cost of every item that doesn't have one yet. */
export function freezeCosts(order: Order, recipes: Recipe[], ctx: PricingContext): Order {
  const items = order.items.map((it) => {
    if (it.unitCost != null) return it;
    const c = currentUnitCost(recipes.find((r) => r.id === it.recipeId), ctx);
    return Number.isFinite(c) ? { ...it, unitCost: Math.round(c * 10000) / 10000 } : it;
  });
  return { ...order, items, costFrozenAt: order.costFrozenAt ?? new Date().toISOString() };
}
