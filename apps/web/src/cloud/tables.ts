/**
 * The bakery's data in the cloud, one row per record (supabase/migrations). The panel keeps working on the
 * same in-memory DB object it always used; this module loads that object from the tables and, after each
 * change, writes only the rows that changed. Row-level security decides what may be read or written.
 */
import type { CakeProduct, Customer, DB, HistoryEntry, Ingredient, Material, Order, OrderItem, OrderStatus, Production, Promotion, Purchase, Recipe, Settings, Simulation, StoreSettings, Transaction } from '@cakeboss/domain/types';
import { supabase } from '../lib/supabase';
import { defaultSettings, emptyDb } from '../store/store';
import { defaultStore } from '@cakeboss/domain/shop';

type Row = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/* ---------------------------------------------------------------- order status: app ↔ database */

const TO_DB: Record<OrderStatus, string> = { orcamento: 'orcamento', confirmado: 'confirmado', em_producao: 'em_preparo', pronto: 'pronto', entregue: 'concluido', cancelado: 'cancelado' };
const FROM_DB: Record<string, OrderStatus> = { orcamento: 'orcamento', aguardando: 'orcamento', confirmado: 'confirmado', em_preparo: 'em_producao', pronto: 'pronto', saiu_entrega: 'pronto', concluido: 'entregue', cancelado: 'cancelado' };

/* ---------------------------------------------------------------- photos go to Storage */

const BUCKET = 'store-media';
async function uploadDataUrl(ws: string, key: string, dataUrl: string | undefined | null): Promise<string | null> {
  if (!dataUrl) return null;
  if (!dataUrl.startsWith('data:')) return dataUrl;
  const blob = await (await fetch(dataUrl)).blob();
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${ws}/${key}-${Date.now().toString(36)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: true });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/* ---------------------------------------------------------------- rows → app objects */

const ingredientFrom = (r: Row): Ingredient => ({
  id: r.id as string, name: r.name as string, unit: r.unit as Ingredient['unit'], packageQty: num(r.package_qty), packagePrice: num(r.package_price),
  supplier: (r.supplier as string) ?? '', stock: num(r.stock), minStock: num(r.min_stock), priceHistory: (r.price_history as Ingredient['priceHistory']) ?? [],
  sample: (r.sample as boolean) || undefined, updatedAt: r.updated_at as string,
});
const materialFrom = (r: Row): Material => ({
  id: r.id as string, name: r.name as string, kind: r.kind as Material['kind'], packageQty: num(r.package_qty), packagePrice: num(r.package_price),
  supplier: (r.supplier as string) ?? '', stock: num(r.stock), minStock: num(r.min_stock), priceHistory: (r.price_history as Material['priceHistory']) ?? [],
  sample: (r.sample as boolean) || undefined, updatedAt: r.updated_at as string,
});
const recipeFrom = (r: Row): Recipe => ({
  ...(r.composition as object as Recipe),
  id: r.id as string, name: r.name as string, category: (r.category as string) ?? '', salePrice: numOrNull(r.sale_price), targetMarginPct: num(r.target_margin_pct),
  priceSnapshot: (r.price_snapshot as Recipe['priceSnapshot']) ?? null, sample: (r.sample as boolean) || undefined, createdAt: r.created_at as string, updatedAt: r.updated_at as string,
  storeVisible: r.store_visible as boolean, storeDescription: (r.store_description as string) ?? undefined, storeImage: (r.store_image_path as string) ?? undefined,
  storeOptions: ((r.store_options as Recipe['storeOptions']) ?? []).length ? (r.store_options as Recipe['storeOptions']) : undefined,
});
const customerFrom = (r: Row): Customer => ({
  id: r.id as string, name: r.name as string, phone: (r.phone as string) ?? '', notes: (r.notes as string) ?? '', createdAt: r.created_at as string,
  email: (r.email as string) ?? undefined, address: (r.address as Customer['address']) ?? undefined,
});
const itemFrom = (r: Row): OrderItem => ({
  id: r.id as string, recipeId: (r.recipe_id as string) ?? (r.cake_product_id as string) ?? null, name: r.name as string, qty: num(r.qty), unitPrice: num(r.unit_price),
  unitCost: numOrNull(r.unit_cost), ...splitParts(r.components),
});
type Part = { recipeId: string; batches: number } | { ingredientId: string; qty: number };
// built cakes: fichas (recipeId) and stock items (ingredientId) share the order_items.components column
const splitParts = (v: unknown): Pick<OrderItem, 'components' | 'stockItems'> => {
  const all = Array.isArray(v) ? (v as Part[]) : [];
  const components = all.filter((x): x is { recipeId: string; batches: number } => 'recipeId' in x);
  const stockItems = all.filter((x): x is { ingredientId: string; qty: number } => 'ingredientId' in x);
  return { components: components.length ? components : undefined, stockItems: stockItems.length ? stockItems : undefined };
};
const orderFrom = (r: Row, items: OrderItem[]): Order => ({
  id: r.id as string, number: num(r.number), customerId: (r.customer_id as string) ?? null, customerName: (r.customer_name as string) ?? '', items,
  deliveryAt: r.delivery_at as string, status: FROM_DB[r.production_status as string] ?? 'confirmado', discount: num(r.discount), deliveryFee: num(r.delivery_fee),
  notes: (r.notes as string) ?? '', costFrozenAt: (r.cost_frozen_at as string) ?? null, origin: r.origin === 'loja' ? 'loja' : undefined,
  fulfillment: r.fulfillment_type === 'entrega' ? { type: 'entrega', address: (r.delivery_address as Customer['address']) ?? undefined, fee: num(r.delivery_fee) } : r.origin === 'loja' ? { type: 'retirada', fee: 0 } : undefined,
  payment: r.payment_method ? { method: r.payment_method as never, note: '' } : undefined, stockDeducted: (r.stock_deducted as boolean) || undefined,
  createdAt: r.created_at as string, updatedAt: r.updated_at as string,
});
const txFrom = (r: Row): Transaction => ({
  id: r.id as string, date: r.date as string, type: r.type as Transaction['type'], category: r.category as string, description: (r.description as string) ?? '',
  amount: num(r.amount), method: (r.method as Transaction['method']) ?? null, orderId: (r.order_id as string) ?? null, createdAt: r.created_at as string,
});
const purchaseFrom = (r: Row): Purchase => ({
  id: r.id as string, date: r.date as string, kind: r.kind as Purchase['kind'], itemId: r.item_id as string, itemName: r.item_name as string, packages: num(r.packages),
  packageQty: num(r.package_qty), unit: r.unit as Purchase['unit'], pricePerPackage: num(r.price_per_package), total: num(r.total), supplier: (r.supplier as string) ?? '',
  stockAdded: num(r.stock_added), transactionId: (r.transaction_id as string) ?? null,
});
const productionFrom = (r: Row): Production => ({
  id: r.id as string, recipeId: r.recipe_id as string, recipeName: r.recipe_name as string, quantity: num(r.quantity), date: r.date as string,
  cost: r.cost as Production['cost'], salePrice: numOrNull(r.sale_price), stockDeducted: r.stock_deducted as boolean,
});
const simulationFrom = (r: Row): Simulation => ({
  id: r.id as string, name: r.name as string, recipeId: (r.recipe_id as string) ?? null, composition: r.composition as Simulation['composition'], params: r.params as Simulation['params'],
  unitCost: num(r.unit_cost), profitMarginPct: num(r.profit_margin_pct), createdAt: r.created_at as string,
});
const historyFrom = (r: Row): HistoryEntry => ({ id: r.id as string, at: r.at as string, type: r.type as HistoryEntry['type'], message: r.message as string, detail: (r.detail as string) ?? undefined });
const promotionFrom = (r: Row): Promotion => ({
  id: r.id as string, name: r.name as string, kind: r.kind as Promotion['kind'], value: num(r.value), recipeIds: (r.recipe_ids as string[]) ?? [],
  startsOn: (r.starts_on as string) ?? null, endsOn: (r.ends_on as string) ?? null, active: r.active as boolean, createdAt: r.created_at as string,
});

/* ---------------------------------------------------------------- app objects → rows */

const ingredientRow = (ws: string, i: Ingredient) => ({ workspace_id: ws, id: i.id, name: i.name, unit: i.unit, package_qty: i.packageQty, package_price: i.packagePrice, supplier: i.supplier, stock: i.stock, min_stock: i.minStock, price_history: i.priceHistory, sample: !!i.sample, updated_at: i.updatedAt || new Date().toISOString() });
const materialRow = (ws: string, m: Material) => ({ workspace_id: ws, id: m.id, name: m.name, kind: m.kind, package_qty: m.packageQty, package_price: m.packagePrice, supplier: m.supplier, stock: m.stock, min_stock: m.minStock, price_history: m.priceHistory, sample: !!m.sample, updated_at: m.updatedAt || new Date().toISOString() });
const recipeRow = async (ws: string, r: Recipe) => {
  const { id, name, category, salePrice, targetMarginPct, priceSnapshot, sample, createdAt, updatedAt, storeVisible, storeDescription, storeImage, storeOptions, ...composition } = r;
  return {
    workspace_id: ws, id, name, category: category ?? '', composition, sale_price: salePrice, target_margin_pct: targetMarginPct, price_snapshot: priceSnapshot, sample: !!sample,
    store_visible: storeVisible !== false, store_description: storeDescription ?? null, store_image_path: await uploadDataUrl(ws, `recipes/${id}`, storeImage), store_options: storeOptions ?? [],
    created_at: createdAt, updated_at: updatedAt,
  };
};
const customerRow = (ws: string, c: Customer) => ({ workspace_id: ws, id: c.id, name: c.name, phone: c.phone ?? '', email: c.email ?? null, address: c.address ?? null, notes: c.notes ?? '', created_at: c.createdAt });
const orderTotals = (o: Order) => {
  const subtotal = Math.round(o.items.reduce((a, i) => a + i.qty * i.unitPrice, 0) * 100) / 100;
  return { subtotal, total: Math.max(0, Math.round((subtotal - (o.discount || 0) + (o.deliveryFee || 0)) * 100) / 100) };
};
/** Columns the panel may change on an existing order (the database refuses the others). */
const orderUpdate = (o: Order) => ({
  customer_id: o.customerId, customer_name: o.customerName, production_status: TO_DB[o.status], payment_method: o.payment?.method ?? null,
  fulfillment_type: o.fulfillment?.type ?? 'retirada', delivery_address: o.fulfillment?.address ?? null, delivery_at: o.deliveryAt,
  ...(o.origin === 'loja' ? {} : { ...orderTotals(o), discount: o.discount || 0, delivery_fee: o.deliveryFee || 0 }),
  notes: o.notes, cost_frozen_at: o.costFrozenAt, stock_deducted: !!o.stockDeducted, updated_at: o.updatedAt,
});
const orderInsert = (ws: string, o: Order) => ({ workspace_id: ws, id: o.id, number: o.number, origin: 'painel', created_at: o.createdAt, ...orderUpdate(o), ...orderTotals(o), discount: o.discount || 0, delivery_fee: o.deliveryFee || 0 });
const itemRows = (ws: string, o: Order, cakeIds: Set<string>) =>
  o.items.map((i) => ({
    workspace_id: ws, order_id: o.id, id: i.id, recipe_id: i.recipeId && !cakeIds.has(i.recipeId) ? i.recipeId : null, cake_product_id: i.recipeId && cakeIds.has(i.recipeId) ? i.recipeId : null,
    name: i.name, qty: i.qty, unit_price: i.unitPrice, unit_cost: i.unitCost,
    components: i.components?.length || i.stockItems?.length ? [...(i.components ?? []), ...(i.stockItems ?? [])] : null,
  }));
const txRow = (ws: string, t: Transaction) => ({ workspace_id: ws, id: t.id, date: t.date, type: t.type, category: t.category, description: t.description, amount: Math.abs(t.amount), method: t.method, order_id: t.orderId, source: 'manual', created_at: t.createdAt });
const purchaseRow = (ws: string, p: Purchase) => ({ workspace_id: ws, id: p.id, date: p.date, kind: p.kind, item_id: p.itemId, item_name: p.itemName, packages: p.packages, package_qty: p.packageQty, unit: p.unit, price_per_package: p.pricePerPackage, total: p.total, supplier: p.supplier, stock_added: p.stockAdded, transaction_id: p.transactionId });
const productionRow = (ws: string, p: Production) => ({ workspace_id: ws, id: p.id, recipe_id: p.recipeId, recipe_name: p.recipeName, quantity: p.quantity, date: p.date, cost: p.cost, sale_price: p.salePrice, stock_deducted: p.stockDeducted });
const simulationRow = (ws: string, s: Simulation) => ({ workspace_id: ws, id: s.id, name: s.name, recipe_id: s.recipeId, composition: s.composition, params: s.params, unit_cost: Number.isFinite(s.unitCost) ? s.unitCost : null, profit_margin_pct: Number.isFinite(s.profitMarginPct) ? s.profitMarginPct : null, created_at: s.createdAt });
const historyRow = (ws: string, h: HistoryEntry) => ({ workspace_id: ws, id: h.id, at: h.at, type: h.type, message: h.message, detail: h.detail ?? null });
const promotionRow = (ws: string, p: Promotion) => ({ workspace_id: ws, id: p.id, name: p.name, kind: p.kind, value: p.value, recipe_ids: p.recipeIds, starts_on: p.startsOn, ends_on: p.endsOn, active: p.active, created_at: p.createdAt || new Date().toISOString() });
const cakeRow = async (ws: string, c: CakeProduct) => {
  const { image, ...config } = c;
  return { workspace_id: ws, id: c.id, name: c.name, visible: c.visible, image_path: await uploadDataUrl(ws, `cakes/${c.id}`, image), config, updated_at: new Date().toISOString() };
};

/* ---------------------------------------------------------------- load */

async function all(table: string, ws: string, order?: string): Promise<Row[]> {
  const out: Row[] = [];
  // the API returns up to 1000 rows per call: page through bigger tables
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select('*').eq('workspace_id', ws).range(from, from + 999);
    if (order) q = q.order(order, { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    out.push(...(data as Row[]));
    if (!data || data.length < 1000) return out;
  }
}

export async function loadTenant(ws: string): Promise<DB> {
  const [ing, mat, rec, cus, ord, items, tx, pur, prod, sim, hist, settings, store, zones, promos, cakes] = await Promise.all([
    all('ingredients', ws), all('materials', ws), all('recipes', ws), all('customers', ws), all('orders', ws, 'created_at'), all('order_items', ws),
    all('transactions', ws, 'date'), all('purchases', ws, 'date'), all('productions', ws, 'date'), all('simulations', ws, 'created_at'), all('activity_log', ws, 'at'),
    supabase.from('workspace_settings').select('settings').eq('workspace_id', ws).maybeSingle(),
    supabase.from('store_settings').select('*').eq('workspace_id', ws).maybeSingle(),
    all('delivery_zones', ws), all('promotions', ws, 'created_at'), all('cake_products', ws),
  ]);
  if (settings.error) throw settings.error;
  if (store.error) throw store.error;
  const byOrder = new Map<string, OrderItem[]>();
  for (const it of items) byOrder.set(it.order_id as string, [...(byOrder.get(it.order_id as string) ?? []), itemFrom(it)]);
  const st = store.data as Row | null;
  const storeSettings: StoreSettings = {
    ...defaultStore(),
    enabled: (st?.enabled as boolean) ?? false,
    whatsapp: (st?.whatsapp as string) ?? '',
    pickupAddress: (st?.pickup_address as string) ?? '',
    leadDays: Math.round(num(st?.lead_hours ?? 48) / 24),
    about: (st?.description as string) ?? '',
    storeName: (st?.display_name as string) ?? undefined,
    tagline: (st?.tagline as string) ?? undefined,
    logo: (st?.logo_path as string) ?? undefined,
    zones: zones.map((z) => ({ id: z.id as string, city: z.city as string, fee: num(z.fee) })),
    cakes: cakes.map((c) => ({ ...(c.config as CakeProduct), id: c.id as string, name: c.name as string, visible: c.visible as boolean, image: (c.image_path as string) ?? undefined })),
    promotions: promos.map(promotionFrom),
  };
  const s: Settings = { ...defaultSettings(), ...((settings.data?.settings as Partial<Settings>) ?? {}), store: storeSettings };
  return {
    ...emptyDb(),
    ingredients: ing.map(ingredientFrom),
    materials: mat.map(materialFrom),
    recipes: rec.map(recipeFrom),
    customers: cus.map(customerFrom),
    orders: ord.map((o) => orderFrom(o, byOrder.get(o.id as string) ?? [])),
    transactions: tx.map(txFrom),
    purchases: pur.map(purchaseFrom),
    productions: prod.map(productionFrom),
    simulations: sim.map(simulationFrom),
    history: hist.map(historyFrom).slice(0, 500),
    settings: s,
  };
}

/* ---------------------------------------------------------------- save only what changed */

type Ops = { upserts: Row[]; deletes: string[] };
function diff<T extends { id: string }>(prev: T[], next: T[]): { added: T[]; changed: T[]; removed: string[] } {
  const before = new Map(prev.map((x) => [x.id, x]));
  const after = new Set(next.map((x) => x.id));
  const added: T[] = [];
  const changed: T[] = [];
  for (const x of next) {
    const old = before.get(x.id);
    if (!old) added.push(x);
    else if (old !== x) changed.push(x);
  }
  return { added, changed, removed: prev.filter((x) => !after.has(x.id)).map((x) => x.id) };
}

async function check<T>(p: PromiseLike<{ error: unknown } & T>) {
  const r = await p;
  if (r.error) throw r.error;
  return r;
}

async function syncSimple<T extends { id: string }>(ws: string, table: string, prev: T[], next: T[], toRow: (ws: string, x: T) => Row | Promise<Row>, opts: { appendOnly?: boolean } = {}) {
  const d = diff(prev, next);
  const ops: Ops = { upserts: await Promise.all([...d.added, ...(opts.appendOnly ? [] : d.changed)].map((x) => toRow(ws, x))), deletes: opts.appendOnly ? [] : d.removed };
  if (ops.upserts.length) await check(supabase.from(table).upsert(ops.upserts, { onConflict: 'workspace_id,id' }));
  if (ops.deletes.length) await check(supabase.from(table).delete().eq('workspace_id', ws).in('id', ops.deletes));
}

/** Writes the difference between two versions of the bakery's data. Throws on the first failure; the caller retries. */
export async function saveDiff(ws: string, prev: DB, next: DB): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  if (prev.ingredients !== next.ingredients) tasks.push(syncSimple(ws, 'ingredients', prev.ingredients, next.ingredients, ingredientRow));
  if (prev.materials !== next.materials) tasks.push(syncSimple(ws, 'materials', prev.materials, next.materials, materialRow));
  if (prev.recipes !== next.recipes) tasks.push(syncSimple(ws, 'recipes', prev.recipes, next.recipes, recipeRow));
  if (prev.simulations !== next.simulations) tasks.push(syncSimple(ws, 'simulations', prev.simulations, next.simulations, simulationRow));
  if (prev.productions !== next.productions) tasks.push(syncSimple(ws, 'productions', prev.productions, next.productions, productionRow));
  if (prev.purchases !== next.purchases) tasks.push(syncSimple(ws, 'purchases', prev.purchases, next.purchases, purchaseRow));
  if (prev.history !== next.history) tasks.push(syncSimple(ws, 'activity_log', prev.history, next.history, historyRow, { appendOnly: true }));
  // customers before orders and transactions, which point to them
  if (prev.customers !== next.customers) await syncSimple(ws, 'customers', prev.customers, next.customers, customerRow);
  if (prev.orders !== next.orders) await syncOrders(ws, prev, next);
  if (prev.transactions !== next.transactions) tasks.push(syncSimple(ws, 'transactions', prev.transactions, next.transactions, txRow));
  if (prev.settings !== next.settings) tasks.push(syncSettings(ws, prev.settings, next.settings));
  await Promise.all(tasks);
}

async function syncOrders(ws: string, prev: DB, next: DB) {
  const d = diff(prev.orders, next.orders);
  const cakeIds = new Set((next.settings.store?.cakes ?? []).map((c) => c.id));
  if (d.added.length) {
    await check(supabase.from('orders').insert(d.added.map((o) => orderInsert(ws, o))));
    const rows = d.added.flatMap((o) => itemRows(ws, o, cakeIds));
    if (rows.length) await check(supabase.from('order_items').insert(rows));
  }
  for (const o of d.changed) {
    const old = prev.orders.find((x) => x.id === o.id)!;
    await check(supabase.from('orders').update(orderUpdate(o)).eq('workspace_id', ws).eq('id', o.id));
    // items of panel orders are replaced when they changed; store orders keep the items the customer paid for
    if (o.origin !== 'loja' && old.items !== o.items) {
      await check(supabase.from('order_items').delete().eq('workspace_id', ws).eq('order_id', o.id));
      const rows = itemRows(ws, o, cakeIds);
      if (rows.length) await check(supabase.from('order_items').insert(rows));
    }
  }
  if (d.removed.length) await check(supabase.from('orders').delete().eq('workspace_id', ws).in('id', d.removed));
}

async function syncSettings(ws: string, prev: Settings, next: Settings) {
  const { store: nextStore, ...rest } = next;
  const { store: prevStore, ...prevRest } = prev;
  const tasks: Promise<unknown>[] = [];
  if (JSON.stringify(rest) !== JSON.stringify(prevRest)) tasks.push(check(supabase.from('workspace_settings').upsert({ workspace_id: ws, settings: rest, updated_at: new Date().toISOString() })));
  const a = nextStore ?? defaultStore();
  const b = prevStore ?? defaultStore();
  if (a !== b) {
    tasks.push(
      (async () => {
        const logo = a.logo !== b.logo ? await uploadDataUrl(ws, 'logo', a.logo) : a.logo ?? null;
        await check(
          supabase.from('store_settings').upsert({
            workspace_id: ws, enabled: a.enabled, display_name: a.storeName?.trim() || null, tagline: a.tagline?.trim() || null, logo_path: logo,
            description: a.about || null, whatsapp: a.whatsapp.replace(/\D/g, '') || null, pickup_address: a.pickupAddress || null,
            delivery_enabled: a.zones.some((z) => z.fee !== null && z.fee >= 0), lead_hours: Math.max(0, a.leadDays) * 24,
            accent: next.accentShop ?? next.accentAdmin ?? null, updated_at: new Date().toISOString(),
          }),
        );
      })(),
    );
    const zonesNow = a.zones.filter((z) => z.fee !== null && z.city.trim()) as { id: string; city: string; fee: number }[];
    const zonesBefore = b.zones.filter((z) => z.fee !== null && z.city.trim()) as { id: string; city: string; fee: number }[];
    if (JSON.stringify(zonesNow) !== JSON.stringify(zonesBefore)) tasks.push(syncSimple(ws, 'delivery_zones', zonesBefore.map((z) => ({ ...z })), zonesNow.map((z) => ({ ...z })), (w, z) => ({ workspace_id: w, id: z.id, city: z.city.trim(), fee: z.fee, active: true })));
    if (a.promotions !== b.promotions) tasks.push(syncSimple(ws, 'promotions', b.promotions ?? [], a.promotions ?? [], promotionRow));
    if (a.cakes !== b.cakes) tasks.push(syncSimple(ws, 'cake_products', b.cakes ?? [], a.cakes ?? [], cakeRow));
  }
  await Promise.all(tasks);
}
