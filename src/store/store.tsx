import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { nowIso, toBase, uid } from '../lib/format';
import { computePricing, costRecord, defaultParams, type PricingContext } from '../lib/pricing';
import type { Purchase, Unit, Customer, DB, HistoryEntry, Ingredient, Material, Order, OrderStatus, PaymentMethod, Production, Recipe, Settings, Simulation, Transaction } from '../lib/types';
import { FEE_CATEGORY, METHOD_LABEL, SALE_CATEGORY, STATUS, consumesStock, freezeCosts, isFirm } from '../lib/orders';
import { buildSample } from './sample';
import { defaultTemplates } from '../lib/whatsapp';

const KEY = 'docegestao:db';

export const defaultSettings = (): Settings => ({
  businessName: 'Minha Confeitaria',
  ownerName: '',
  theme: 'light',
  gasMode: 'botijao',
  gasCylinderPrice: 0,
  gasCylinderKg: 13,
  gasBillValue: 0,
  gasBillConsumption: 0,
  gasBillUnit: 'm3',
  energyPricePerKwh: 0,
  waterPricePerM3: 0,
  laborMonthly: 0,
  laborHoursMonth: 0,
  fixedCosts: [],
  productiveHoursMonth: 0,
  cardFeePct: 0,
  commissionPct: 0,
  taxPct: 0,
  defaultMarginPct: 30,
  equipment: [],
  pixKey: '',
  messageTemplates: defaultTemplates(),
});

export const emptyDb = (): DB => ({
  version: 1,
  customers: [],
  orders: [],
  transactions: [],
  purchases: [],
  ingredients: [],
  materials: [],
  recipes: [],
  simulations: [],
  productions: [],
  history: [],
  settings: defaultSettings(),
});

/** Fills in fields added after the data was saved, so older data (local or cloud) opens in the current version. */
export function normalizeDb(parsed: DB): DB {
  const settings = { ...defaultSettings(), ...parsed.settings };
  // older versions stored only a price per kg: turn it back into a P13 cylinder price
  const legacy = (parsed.settings as { gasPricePerKg?: number }).gasPricePerKg;
  if (legacy && !settings.gasCylinderPrice) settings.gasCylinderPrice = Math.round(legacy * settings.gasCylinderKg * 100) / 100;
  delete (settings as { gasPricePerKg?: number }).gasPricePerKg;
  return { ...emptyDb(), ...parsed, settings };
}

/** Data kept in this browser (demo store and the pre-cloud version of the system). */
export function loadLocal(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyDb();
    return normalizeDb(JSON.parse(raw) as DB);
  } catch {
    return emptyDb();
  }
}

/** True when this browser holds real work worth bringing into a new account. */
export function hasLocalData(): boolean {
  const d = loadLocal();
  return [d.recipes, d.ingredients, d.orders, d.customers, d.transactions].some((xs) => xs.some((x) => !(x as { sample?: boolean }).sample));
}

type Result = { ok: true } | { ok: false; error: string };

interface Store {
  db: DB;
  ctx: PricingContext;
  persistError: boolean;
  updateSettings: (patch: Partial<Settings>, message?: string) => void;
  saveIngredient: (i: Ingredient) => void;
  deleteIngredient: (id: string) => Result;
  saveMaterial: (m: Material) => void;
  deleteMaterial: (id: string) => Result;
  saveRecipe: (r: Recipe) => void;
  deleteRecipe: (id: string) => void;
  applyPrice: (recipeId: string, price: number, unitCost: number, marginPct?: number) => void;
  saveSimulation: (s: Omit<Simulation, 'id' | 'createdAt'>) => Simulation;
  deleteSimulation: (id: string) => void;
  registerProduction: (recipeId: string, quantity: number, deductStock: boolean) => Production | null;
  deleteProduction: (id: string) => void;
  registerPurchase: (p: PurchaseInput) => void;
  deletePurchase: (id: string) => void;
  saveCustomer: (c: Customer) => void;
  deleteCustomer: (id: string) => void;
  saveOrder: (o: Order) => Order;
  setOrderStatus: (id: string, status: OrderStatus) => void;
  deleteOrder: (id: string) => Result;
  registerPayment: (orderId: string, amount: number, method: PaymentMethod, date: string, feePct: number) => void;
  saveTransaction: (t: Transaction) => void;
  deleteTransaction: (id: string) => void;
  loadSample: () => void;
  clearSample: () => void;
  restoreBackup: (data: DB) => void;
}

export interface PurchaseInput {
  kind: 'ingrediente' | 'material';
  /** existing item (possibly with edited minStock) or a brand-new one */
  item: Ingredient | Material;
  packages: number;
  packageQty: number;
  unit: Unit;
  pricePerPackage: number;
  supplier: string;
  date: string;
  updatePrice: boolean;
  toFinance: boolean;
  method: PaymentMethod | null;
}

const LIST_KEYS = ['customers', 'orders', 'transactions', 'purchases', 'ingredients', 'materials', 'recipes', 'simulations', 'productions', 'history'] as const;

/** Reads a backup file made by "Exportar backup". Returns an error message instead of guessing. */
export function parseBackup(text: string): { ok: true; data: DB } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'O arquivo não é um backup válido (JSON ilegível).' };
  }
  const o = raw as Partial<DB> | null;
  if (!o || typeof o !== 'object' || o.version !== 1 || typeof o.settings !== 'object' || !Array.isArray(o.recipes) || !Array.isArray(o.ingredients))
    return { ok: false, error: 'Este arquivo não parece ser um backup do CakeBoss.' };
  const data = { ...emptyDb(), ...o } as DB;
  for (const k of LIST_KEYS) if (!Array.isArray(data[k])) (data as unknown as Record<string, unknown[]>)[k] = [];
  return { ok: true, data };
}

const StoreContext = createContext<Store | null>(null);

const entry = (type: HistoryEntry['type'], message: string, detail?: string): HistoryEntry => ({ id: uid(), at: nowIso(), type, message, detail });

/** Records a production of `quantity` units of `r`: stores its cost of the day and (optionally) takes ingredients and materials out of stock. */
function produce(d: DB, r: Recipe, quantity: number, ctx: PricingContext, deductStock: boolean, label = r.name): { d: DB; prod: Production } {
  const result = computePricing(r, { ...defaultParams(r, d.settings), quantity }, ctx);
  const prod: Production = { id: uid(), recipeId: r.id, recipeName: label, quantity, date: nowIso(), cost: costRecord(result), salePrice: r.salePrice, stockDeducted: deductStock };
  let { ingredients, materials } = d;
  if (deductStock) {
    const batches = r.yield > 0 ? quantity / r.yield : 0;
    const runs = Math.ceil(batches - 1e-9);
    ingredients = ingredients.map((i) => {
      const used = r.ingredients.filter((l) => l.ingredientId === i.id).reduce((a, l) => a + toBase(l.qty, l.unit) * batches, 0);
      return used ? { ...i, stock: i.stock - used } : i;
    });
    materials = materials.map((m) => {
      const used = r.materials.filter((l) => l.materialId === m.id).reduce((a, l) => a + (l.per === 'unit' ? l.qty * result.usableUnits : l.qty * runs), 0);
      return used ? { ...m, stock: m.stock - used } : m;
    });
  }
  return { d: { ...d, ingredients, materials, productions: [prod, ...d.productions] }, prod };
}

/** Takes an order's recipes out of stock (called once, when it first enters production). */
function produceOrder(d: DB, order: Order, ctx: PricingContext): DB {
  let next = d;
  for (const it of order.items) {
    const r = d.recipes.find((x) => x.id === it.recipeId);
    if (r && it.qty > 0) next = produce(next, r, it.qty, ctx, true, `${r.name} · pedido #${order.number}`).d;
    // birthday cakes: each part (massa, recheios, cobertura) is its own ficha, in batches
    for (const c of it.components ?? []) {
      const cr = d.recipes.find((x) => x.id === c.recipeId);
      if (cr && c.batches > 0 && it.qty > 0) next = produce(next, cr, c.batches * it.qty * Math.max(1, cr.yield), ctx, true, `${cr.name} · ${it.name.split(' (')[0]} · pedido #${order.number}`).d;
    }
  }
  return next;
}

/**
 * Without `persist` the data lives in this browser (localStorage). With it, the caller saves each change
 * (the cloud account) and `initial` is where the data starts.
 */
export function StoreProvider({ children, initial, persist }: { children: ReactNode; initial?: DB; persist?: (db: DB) => void }) {
  const [db, setDb] = useState<DB>(() => (initial ? normalizeDb(initial) : loadLocal()));
  const [persistError, setPersistError] = useState(false);
  const first = useRef(true);
  const persistRef = useRef(persist);
  persistRef.current = persist;
  const local = !persist;

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (persistRef.current) {
      persistRef.current(db);
      return;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      setPersistError(false);
    } catch {
      setPersistError(true);
    }
  }, [db]);

  // keep several open tabs in sync, otherwise the last tab to save would overwrite the others
  useEffect(() => {
    if (!local) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) setDb(loadLocal());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [local]);

  useEffect(() => {
    document.documentElement.dataset.theme = db.settings.theme;
  }, [db.settings.theme]);

  const mutate = useCallback((fn: (d: DB) => DB) => setDb((d) => fn(d)), []);
  const withLog = (d: DB, ...e: HistoryEntry[]): DB => ({ ...d, history: [...e, ...d.history].slice(0, 500) });

  const ctx = useMemo<PricingContext>(() => ({ ingredients: db.ingredients, materials: db.materials, settings: db.settings }), [db]);

  const store = useMemo<Store>(() => {
    const priceChanged = (prev: { packagePrice: number; packageQty: number } | undefined, next: { packagePrice: number; packageQty: number }) =>
      !prev || prev.packagePrice !== next.packagePrice || prev.packageQty !== next.packageQty;

    return {
      db,
      ctx,
      persistError,
      updateSettings: (patch, message) =>
        mutate((d) => {
          const next = { ...d, settings: { ...d.settings, ...patch } };
          return message ? withLog(next, entry('config', message)) : next;
        }),
      saveIngredient: (i) =>
        mutate((d) => {
          const prev = d.ingredients.find((x) => x.id === i.id);
          const changed = priceChanged(prev, i);
          const item: Ingredient = {
            ...i,
            updatedAt: nowIso(),
            priceHistory: changed ? [...i.priceHistory, { date: nowIso(), packagePrice: i.packagePrice, packageQty: i.packageQty }] : i.priceHistory,
          };
          const list = prev ? d.ingredients.map((x) => (x.id === i.id ? item : x)) : [...d.ingredients, item];
          return withLog(
            { ...d, ingredients: list },
            entry('insumo', prev ? `Ingrediente atualizado: ${i.name}` : `Ingrediente cadastrado: ${i.name}`, changed && prev ? `Preço: R$ ${prev.packagePrice.toFixed(2)} → R$ ${i.packagePrice.toFixed(2)}` : undefined),
          );
        }),
      deleteIngredient: (id) => {
        const used = db.recipes.filter((r) => r.ingredients.some((l) => l.ingredientId === id));
        if (used.length) return { ok: false, error: `Usado em: ${used.map((r) => r.name).join(', ')}. Remova das fichas antes de excluir.` };
        mutate((d) => {
          const it = d.ingredients.find((x) => x.id === id);
          return withLog({ ...d, ingredients: d.ingredients.filter((x) => x.id !== id) }, entry('insumo', `Ingrediente excluído: ${it?.name ?? ''}`));
        });
        return { ok: true };
      },
      saveMaterial: (m) =>
        mutate((d) => {
          const prev = d.materials.find((x) => x.id === m.id);
          const changed = priceChanged(prev, m);
          const item: Material = {
            ...m,
            updatedAt: nowIso(),
            priceHistory: changed ? [...m.priceHistory, { date: nowIso(), packagePrice: m.packagePrice, packageQty: m.packageQty }] : m.priceHistory,
          };
          const list = prev ? d.materials.map((x) => (x.id === m.id ? item : x)) : [...d.materials, item];
          return withLog({ ...d, materials: list }, entry('insumo', prev ? `Material atualizado: ${m.name}` : `Material cadastrado: ${m.name}`));
        }),
      deleteMaterial: (id) => {
        const used = db.recipes.filter((r) => r.materials.some((l) => l.materialId === id));
        if (used.length) return { ok: false, error: `Usado em: ${used.map((r) => r.name).join(', ')}. Remova das fichas antes de excluir.` };
        mutate((d) => {
          const it = d.materials.find((x) => x.id === id);
          return withLog({ ...d, materials: d.materials.filter((x) => x.id !== id) }, entry('insumo', `Material excluído: ${it?.name ?? ''}`));
        });
        return { ok: true };
      },
      saveRecipe: (r) =>
        mutate((d) => {
          const exists = d.recipes.some((x) => x.id === r.id);
          const item = { ...r, updatedAt: nowIso() };
          return withLog(
            { ...d, recipes: exists ? d.recipes.map((x) => (x.id === r.id ? item : x)) : [...d.recipes, item] },
            entry('ficha', exists ? `Ficha técnica atualizada: ${r.name}` : `Ficha técnica criada: ${r.name}`),
          );
        }),
      deleteRecipe: (id) =>
        mutate((d) => {
          const it = d.recipes.find((x) => x.id === id);
          return withLog({ ...d, recipes: d.recipes.filter((x) => x.id !== id) }, entry('ficha', `Ficha técnica excluída: ${it?.name ?? ''}`));
        }),
      applyPrice: (recipeId, price, unitCost, marginPct) =>
        mutate((d) => {
          const r = d.recipes.find((x) => x.id === recipeId);
          if (!r) return d;
          const prev = r.salePrice;
          const updated: Recipe = {
            ...r,
            salePrice: Math.round(price * 100) / 100,
            targetMarginPct: marginPct ?? r.targetMarginPct,
            priceSnapshot: { date: nowIso(), unitCost, salePrice: Math.round(price * 100) / 100 },
            updatedAt: nowIso(),
          };
          return withLog(
            { ...d, recipes: d.recipes.map((x) => (x.id === recipeId ? updated : x)) },
            entry('preco', `Preço oficial de ${r.name} atualizado`, `${prev != null ? `R$ ${prev.toFixed(2)}` : 'sem preço'} → R$ ${price.toFixed(2)} · custo unitário R$ ${unitCost.toFixed(2)}`),
          );
        }),
      saveSimulation: (s) => {
        const sim: Simulation = { ...s, id: uid(), createdAt: nowIso() };
        mutate((d) => withLog({ ...d, simulations: [sim, ...d.simulations] }, entry('simulacao', `Simulação salva: ${s.name}`)));
        return sim;
      },
      deleteSimulation: (id) =>
        mutate((d) => {
          const it = d.simulations.find((x) => x.id === id);
          return withLog({ ...d, simulations: d.simulations.filter((x) => x.id !== id) }, entry('simulacao', `Simulação excluída: ${it?.name ?? ''}`));
        }),
      registerProduction: (recipeId, quantity, deductStock) => {
        const r = db.recipes.find((x) => x.id === recipeId);
        if (!r || quantity <= 0) return null;
        const { prod } = produce(db, r, quantity, ctx, deductStock);
        mutate((d) => {
          const next = produce(d, r, quantity, ctx, deductStock).d;
          next.productions[0] = prod; // keep the record the caller got back
          return withLog(
            next,
            entry('producao', `Produção registrada: ${quantity} ${r.unitLabel} de ${r.name}`, `Custo total R$ ${prod.cost.totalCost.toFixed(2)} · unitário R$ ${prod.cost.unitCost.toFixed(2)}${deductStock ? ' · estoque baixado' : ''}`),
          );
        });
        return prod;
      },
      deleteProduction: (id) =>
        mutate((d) => {
          const p = d.productions.find((x) => x.id === id);
          return withLog(
            { ...d, productions: d.productions.filter((x) => x.id !== id) },
            entry('producao', `Registro de produção removido: ${p?.recipeName ?? ''}`, p?.stockDeducted ? 'O estoque baixado não foi devolvido automaticamente.' : undefined),
          );
        }),
      registerPurchase: (p) =>
        mutate((d) => {
          const isIng = p.kind === 'ingrediente';
          const added = p.packages * (isIng ? toBase(p.packageQty, p.unit) : p.packageQty);
          const total = Math.round(p.packages * p.pricePerPackage * 100) / 100;
          const list: (Ingredient | Material)[] = isIng ? d.ingredients : d.materials;
          const prev = list.find((x) => x.id === p.item.id);
          const priceUpdate = !prev || p.updatePrice;
          const item = {
            ...p.item,
            stock: (prev?.stock ?? 0) + added,
            supplier: p.supplier || p.item.supplier,
            ...(priceUpdate ? { packagePrice: p.pricePerPackage, packageQty: p.packageQty, ...(isIng ? { unit: p.unit } : {}) } : {}),
            priceHistory: priceUpdate ? [...p.item.priceHistory, { date: p.date, packagePrice: p.pricePerPackage, packageQty: p.packageQty }] : p.item.priceHistory,
            updatedAt: nowIso(),
          };
          const nextList = prev ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
          const tx: Transaction | null = p.toFinance
            ? {
                id: uid(),
                date: p.date,
                type: 'saida',
                category: isIng ? 'Ingredientes' : 'Embalagens e adesivos',
                description: `Compra: ${p.packages}× ${item.name}${p.supplier ? ` (${p.supplier})` : ''}`,
                amount: total,
                method: p.method,
                orderId: null,
                createdAt: nowIso(),
              }
            : null;
          const purchase: Purchase = {
            id: uid(),
            date: p.date,
            kind: p.kind,
            itemId: item.id,
            itemName: item.name,
            packages: p.packages,
            packageQty: p.packageQty,
            unit: p.unit,
            pricePerPackage: p.pricePerPackage,
            total,
            supplier: p.supplier,
            stockAdded: added,
            transactionId: tx?.id ?? null,
          };
          return withLog(
            {
              ...d,
              ...(isIng ? { ingredients: nextList as Ingredient[] } : { materials: nextList as Material[] }),
              purchases: [purchase, ...d.purchases],
              transactions: tx ? [tx, ...d.transactions] : d.transactions,
            },
            entry('insumo', `Compra registrada: ${p.packages}× ${item.name}${prev ? '' : ' (novo cadastro)'}`, `Total R$ ${total.toFixed(2)}${priceUpdate ? ' · preço de custo atualizado' : ''}${tx ? ' · lançado no financeiro' : ''}`),
          );
        }),
      deletePurchase: (id) =>
        mutate((d) => {
          const p = d.purchases.find((x) => x.id === id);
          if (!p) return d;
          const sub = <T extends { id: string; stock: number }>(xs: T[]) => xs.map((x) => (x.id === p.itemId ? { ...x, stock: x.stock - p.stockAdded } : x));
          return withLog(
            {
              ...d,
              ingredients: p.kind === 'ingrediente' ? sub(d.ingredients) : d.ingredients,
              materials: p.kind === 'material' ? sub(d.materials) : d.materials,
              purchases: d.purchases.filter((x) => x.id !== id),
              transactions: p.transactionId ? d.transactions.filter((t) => t.id !== p.transactionId) : d.transactions,
            },
            entry('insumo', `Compra excluída: ${p.packages}× ${p.itemName}`, 'Estoque devolvido e lançamento financeiro removido. O preço de custo não foi alterado.'),
          );
        }),
      saveCustomer: (c) =>
        mutate((d) => {
          const exists = d.customers.some((x) => x.id === c.id);
          return withLog(
            { ...d, customers: exists ? d.customers.map((x) => (x.id === c.id ? c : x)) : [...d.customers, c] },
            entry('pedido', exists ? `Cliente atualizado: ${c.name}` : `Cliente cadastrado: ${c.name}`),
          );
        }),
      deleteCustomer: (id) =>
        mutate((d) => {
          const c = d.customers.find((x) => x.id === id);
          return withLog({ ...d, customers: d.customers.filter((x) => x.id !== id) }, entry('pedido', `Cliente excluído: ${c?.name ?? ''}`, 'Pedidos antigos mantêm o nome do cliente.'));
        }),
      saveOrder: (o) => {
        const prev = db.orders.find((x) => x.id === o.id);
        let order: Order = { ...o, number: prev ? prev.number : Math.max(0, ...db.orders.map((x) => x.number)) + 1, updatedAt: nowIso() };
        // a firm sale keeps the cost of the day it was confirmed
        if (isFirm(order.status)) order = freezeCosts(order, db.recipes, ctx);
        const produced = !order.stockDeducted && consumesStock(order.status);
        if (produced) order = { ...order, stockDeducted: true };
        mutate((d) => {
          const exists = d.orders.some((x) => x.id === order.id);
          const base = produced ? produceOrder(d, order, ctx) : d;
          return withLog(
            { ...base, orders: exists ? base.orders.map((x) => (x.id === order.id ? order : x)) : [order, ...base.orders] },
            entry('pedido', `${exists ? 'Pedido atualizado' : 'Pedido criado'}: #${order.number} · ${order.customerName || 'sem cliente'}`, `Status: ${STATUS[order.status].label}${produced ? ' · ingredientes baixados do estoque' : ''}`),
          );
        });
        return order;
      },
      setOrderStatus: (id, status) => {
        const o = db.orders.find((x) => x.id === id);
        if (!o || o.status === status) return;
        let next: Order = { ...o, status, updatedAt: nowIso() };
        if (isFirm(status)) next = freezeCosts(next, db.recipes, ctx);
        const produced = !next.stockDeducted && consumesStock(status);
        if (produced) next = { ...next, stockDeducted: true };
        mutate((d) => {
          const base = produced ? produceOrder(d, next, ctx) : d;
          const notes = [next.costFrozenAt && !o.costFrozenAt && 'custo dos itens registrado', produced && 'ingredientes baixados do estoque'].filter(Boolean).join(' · ');
          return withLog({ ...base, orders: base.orders.map((x) => (x.id === id ? next : x)) }, entry('pedido', `Pedido #${o.number}: ${STATUS[o.status].label} → ${STATUS[status].label}`, notes || undefined));
        });
      },
      deleteOrder: (id) => {
        if (db.transactions.some((t) => t.orderId === id)) return { ok: false, error: 'Este pedido tem pagamentos lançados. Cancele o pedido ou exclua os lançamentos no Financeiro antes.' };
        mutate((d) => {
          const o = d.orders.find((x) => x.id === id);
          return withLog({ ...d, orders: d.orders.filter((x) => x.id !== id) }, entry('pedido', `Pedido excluído: #${o?.number ?? ''}`));
        });
        return { ok: true };
      },
      registerPayment: (orderId, amount, method, date, feePct) => {
        const o = db.orders.find((x) => x.id === orderId);
        if (!o || !(amount > 0)) return;
        const t: Transaction[] = [
          { id: uid(), date, type: 'entrada', category: SALE_CATEGORY, description: `Pedido #${o.number} · ${o.customerName || 'sem cliente'}`, amount, method, orderId, createdAt: nowIso() },
        ];
        const fee = Math.round(amount * feePct) / 100;
        if (fee > 0)
          t.push({ id: uid(), date, type: 'saida', category: FEE_CATEGORY, description: `Taxa ${METHOD_LABEL[method]} (${feePct}%) · pedido #${o.number}`, amount: fee, method, orderId, createdAt: nowIso() });
        mutate((d) =>
          withLog(
            { ...d, transactions: [...t, ...d.transactions] },
            entry('financeiro', `Pagamento recebido: pedido #${o.number}`, `R$ ${amount.toFixed(2)} via ${METHOD_LABEL[method]}${fee > 0 ? ` · taxa R$ ${fee.toFixed(2)}` : ''}`),
          ),
        );
      },
      saveTransaction: (t) =>
        mutate((d) => {
          const exists = d.transactions.some((x) => x.id === t.id);
          return withLog(
            { ...d, transactions: exists ? d.transactions.map((x) => (x.id === t.id ? t : x)) : [t, ...d.transactions] },
            entry('financeiro', `${exists ? 'Lançamento editado' : t.type === 'entrada' ? 'Entrada lançada' : 'Saída lançada'}: ${t.description || t.category}`, `R$ ${t.amount.toFixed(2)}`),
          );
        }),
      deleteTransaction: (id) =>
        mutate((d) => {
          const t = d.transactions.find((x) => x.id === id);
          return withLog({ ...d, transactions: d.transactions.filter((x) => x.id !== id) }, entry('financeiro', `Lançamento excluído: ${t?.description || t?.category || ''}`, t ? `R$ ${t.amount.toFixed(2)}` : undefined));
        }),
      restoreBackup: (data) => setDb(withLog({ ...emptyDb(), ...data, settings: { ...defaultSettings(), ...data.settings } }, entry('sistema', 'Backup restaurado', `${data.recipes.length} fichas · ${data.orders.length} pedidos · ${data.customers.length} clientes`))),
      loadSample: () =>
        mutate((d) => {
          const s = buildSample();
          // never overwrite values the user already configured
          const settings = { ...d.settings };
          for (const k of ['gasCylinderPrice', 'energyPricePerKwh', 'waterPricePerM3', 'laborMonthly', 'laborHoursMonth', 'productiveHoursMonth', 'cardFeePct'] as const)
            if (!settings[k]) settings[k] = s.settingsPatch[k];
          if (!settings.fixedCosts.length) settings.fixedCosts = s.settingsPatch.fixedCosts;
          settings.equipment = [...settings.equipment.filter((e) => !e.id.startsWith('eq-sample-')), ...s.settingsPatch.equipment];
          return withLog(
            {
              ...d,
              ingredients: [...d.ingredients, ...s.ingredients],
              materials: [...d.materials, ...s.materials],
              recipes: [...d.recipes, ...s.recipes],
              settings,
            },
            entry('sistema', 'Dados de exemplo carregados'),
          );
        }),
      clearSample: () =>
        mutate((d) => {
          const sampleEq = new Set(['eq-sample-forno', 'eq-sample-fogao', 'eq-sample-batedeira']);
          return withLog(
            {
              ...d,
              ingredients: d.ingredients.filter((x) => !x.sample),
              materials: d.materials.filter((x) => !x.sample),
              recipes: d.recipes.filter((x) => !x.sample),
              settings: { ...d.settings, equipment: d.settings.equipment.filter((e) => !sampleEq.has(e.id)) },
            },
            entry('sistema', 'Dados de exemplo removidos', 'Custos operacionais preenchidos pelo exemplo foram mantidos; revise-os em Custos operacionais.'),
          );
        }),
    };
  }, [db, ctx, persistError, mutate]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore fora do StoreProvider');
  return s;
}
