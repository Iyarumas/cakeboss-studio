import { compatibleUnits, baseUnit, clamp, money, moneyFine, number, qtyBase, toBase, UNIT_LABEL } from './format';
import type { Composition, CostRecord, Ingredient, Material, PricingParams, Recipe, Settings } from './types';

export type CategoryKey =
  | 'ingredientes'
  | 'embalagens'
  | 'adesivos'
  | 'gas'
  | 'agua'
  | 'energia'
  | 'maoDeObra'
  | 'outros'
  | 'fixos'
  | 'perdas';

export const CATEGORIES: { key: CategoryKey; label: string; color: string }[] = [
  { key: 'ingredientes', label: 'Ingredientes', color: '#DB2777' },
  { key: 'embalagens', label: 'Embalagens', color: '#D97706' },
  { key: 'adesivos', label: 'Adesivos', color: '#8B5CF6' },
  { key: 'gas', label: 'Gás', color: '#EA580C' },
  { key: 'agua', label: 'Água', color: '#0EA5E9' },
  { key: 'energia', label: 'Energia elétrica', color: '#CA8A04' },
  { key: 'maoDeObra', label: 'Mão de obra', color: '#2563EB' },
  { key: 'outros', label: 'Outros custos', color: '#64748B' },
  { key: 'fixos', label: 'Rateio custos fixos', color: '#0D9488' },
  { key: 'perdas', label: 'Perdas e desperdício', color: '#DC2626' },
];

export interface CostCategory {
  key: CategoryKey;
  label: string;
  color: string;
  total: number;
  perUnit: number;
  pct: number;
  origin: string[];
}

export interface Alert {
  level: 'erro' | 'aviso' | 'info';
  message: string;
}

export interface PricingContext {
  ingredients: Ingredient[];
  materials: Material[];
  settings: Settings;
}

export interface PricingResult {
  quantity: number;
  batches: number;
  runs: number;
  usableUnits: number;
  lostUnits: number;
  categories: CostCategory[];
  totalCost: number;
  unitCost: number;
  variableUnitCost: number;
  fixedTotal: number;
  variablePct: number;
  listPrice: number;
  effectivePrice: number;
  variableExpensePerUnit: number;
  netPerUnit: number;
  unitProfit: number;
  totalProfit: number;
  revenue: number;
  profitMarginPct: number;
  contributionUnit: number;
  contributionMarginPct: number;
  markup: number;
  minPrice: number;
  suggestedPrice: number;
  suggestedRounded: number;
  alerts: Alert[];
}

/** Price of one unit of gas (kg for botijão, the bill's unit for piped gas). */
export const gasUnitPrice = (s: Settings) =>
  s.gasMode === 'encanado'
    ? s.gasBillConsumption > 0 ? s.gasBillValue / s.gasBillConsumption : 0
    : s.gasCylinderKg > 0 ? s.gasCylinderPrice / s.gasCylinderKg : 0;
export const gasUnitLabel = (s: Settings) => (s.gasMode === 'encanado' && s.gasBillUnit === 'm3' ? 'm³' : 'kg');

export const laborHourly = (s: Settings) => (s.laborHoursMonth > 0 ? s.laborMonthly / s.laborHoursMonth : 0);
export const fixedMonthly = (s: Settings) => s.fixedCosts.reduce((a, f) => a + (f.monthly || 0), 0);
export const fixedPerHour = (s: Settings) => (s.productiveHoursMonth > 0 ? fixedMonthly(s) / s.productiveHoursMonth : 0);
export const ingredientPricePerBase = (i: Ingredient) => {
  const q = toBase(i.packageQty, i.unit);
  return q > 0 ? i.packagePrice / q : 0;
};
export const materialUnitPrice = (m: Material) => (m.packageQty > 0 ? m.packagePrice / m.packageQty : 0);

export function defaultParams(recipe: Pick<Recipe, 'yield' | 'salePrice' | 'targetMarginPct' | 'wastePct'>, s: Settings): PricingParams {
  return {
    quantity: Math.max(1, recipe.yield),
    salePrice: recipe.salePrice ?? 0,
    marginPct: recipe.targetMarginPct ?? s.defaultMarginPct,
    wastePct: recipe.wastePct,
    cardFeePct: s.cardFeePct,
    commissionPct: s.commissionPct,
    taxPct: s.taxPct,
    discountPct: 0,
  };
}

/**
 * Prices a production run.
 *
 * - Ingredients, water and "other costs" scale linearly with batches (quantity / yield).
 * - Labor, equipment (gas/energy), per-batch materials and the fixed-cost allocation
 *   are charged per *started* batch (runs = ceil(batches)), since an oven run or a
 *   preparation session can't be split.
 * - Per-unit materials (box, sticker) are only charged for usable units.
 * - Waste removes a share of produced units; the cost of the lost units is shown
 *   separately as "perdas" and is absorbed by the usable units.
 * - Fixed costs enter only through the hourly allocation, never through utilities or
 *   labor, so they are not counted twice.
 */
export function computePricing(comp: Composition, params: PricingParams, ctx: PricingContext): PricingResult {
  const s = ctx.settings;
  const alerts: Alert[] = [];
  const ingMap = new Map(ctx.ingredients.map((i) => [i.id, i]));
  const matMap = new Map(ctx.materials.map((m) => [m.id, m]));
  const eqMap = new Map(s.equipment.map((e) => [e.id, e]));

  const quantity = Math.max(0, params.quantity || 0);
  const yieldPerBatch = Math.max(0, comp.yield || 0);
  const batches = yieldPerBatch > 0 ? quantity / yieldPerBatch : 0;
  const runs = Math.ceil(batches - 1e-9);
  const waste = clamp(params.wastePct || 0, 0, 95) / 100;
  const usableUnits = quantity * (1 - waste);
  const lostUnits = quantity - usableUnits;

  if (yieldPerBatch <= 0) alerts.push({ level: 'erro', message: 'Informe o rendimento por lote para calcular o custo unitário.' });
  if (quantity <= 0) alerts.push({ level: 'erro', message: 'Informe a quantidade produzida.' });

  // batch-based cost (affected by waste) vs per-unit-material cost (only usable units)
  const raw: Record<CategoryKey, { batch: number; unit: number; origin: string[] }> = Object.fromEntries(
    CATEGORIES.map((c) => [c.key, { batch: 0, unit: 0, origin: [] as string[] }]),
  ) as never;

  for (const line of comp.ingredients) {
    const ing = ingMap.get(line.ingredientId);
    if (!ing) {
      alerts.push({ level: 'erro', message: 'Um ingrediente da composição não existe mais no cadastro.' });
      continue;
    }
    if (!compatibleUnits(ing.unit).includes(line.unit)) {
      alerts.push({ level: 'erro', message: `${ing.name}: unidade ${UNIT_LABEL[line.unit]} incompatível com o cadastro (${UNIT_LABEL[ing.unit]}).` });
      continue;
    }
    const ppb = ingredientPricePerBase(ing);
    if (ppb <= 0) alerts.push({ level: 'aviso', message: `${ing.name} está sem preço de compra — custo considerado R$ 0,00.` });
    const used = toBase(line.qty, line.unit) * batches;
    const cost = used * ppb;
    raw.ingredientes.batch += cost;
    raw.ingredientes.origin.push(`${ing.name}: ${qtyBase(used, ing.unit)} × ${moneyFine(ppb)}/${UNIT_LABEL[baseUnit(ing.unit)]} = ${money(cost)}`);
  }

  for (const line of comp.materials) {
    const mat = matMap.get(line.materialId);
    if (!mat) {
      alerts.push({ level: 'erro', message: 'Um material da composição não existe mais no cadastro.' });
      continue;
    }
    const up = materialUnitPrice(mat);
    if (up <= 0) alerts.push({ level: 'aviso', message: `${mat.name} está sem preço de compra — custo considerado R$ 0,00.` });
    const key: CategoryKey = mat.kind === 'embalagem' ? 'embalagens' : mat.kind === 'adesivo' ? 'adesivos' : 'outros';
    if (line.per === 'unit') {
      const count = line.qty * usableUnits;
      raw[key].unit += count * up;
      raw[key].origin.push(`${mat.name}: ${number(count)} un (${number(line.qty)} por unidade aproveitável) × ${moneyFine(up)} = ${money(count * up)}`);
    } else {
      const count = line.qty * runs;
      raw[key].batch += count * up;
      raw[key].origin.push(`${mat.name}: ${number(count)} un (${number(line.qty)} por lote × ${runs} lote(s)) × ${moneyFine(up)} = ${money(count * up)}`);
    }
  }

  let gasUsed = false;
  let energyUsed = false;
  for (const line of comp.equipment) {
    const eq = eqMap.get(line.equipmentId);
    if (!eq) {
      alerts.push({ level: 'erro', message: 'Um equipamento da composição foi removido dos custos operacionais.' });
      continue;
    }
    const hours = (line.minutes / 60) * runs;
    if (eq.source === 'gas') {
      gasUsed = true;
      const used = hours * eq.consumption;
      const price = gasUnitPrice(s);
      const u = gasUnitLabel(s);
      const cost = used * price;
      raw.gas.batch += cost;
      raw.gas.origin.push(`${eq.name}: ${number(hours)} h × ${number(eq.consumption)} ${u}/h × ${moneyFine(price)}/${u} = ${money(cost)}`);
    } else {
      energyUsed = true;
      const kwh = hours * eq.consumption;
      const cost = kwh * s.energyPricePerKwh;
      raw.energia.batch += cost;
      raw.energia.origin.push(`${eq.name}: ${number(hours)} h × ${number(eq.consumption)} kW × ${moneyFine(s.energyPricePerKwh)}/kWh = ${money(cost)}`);
    }
  }
  if (gasUsed && gasUnitPrice(s) <= 0) alerts.push({ level: 'aviso', message: 'Preço do gás não informado em Custos operacionais — gás considerado R$ 0,00.' });
  if (energyUsed && s.energyPricePerKwh <= 0) alerts.push({ level: 'aviso', message: 'Tarifa de energia não informada em Custos operacionais — energia considerada R$ 0,00.' });

  if (comp.waterLiters > 0) {
    const liters = comp.waterLiters * batches;
    const cost = (liters / 1000) * s.waterPricePerM3;
    raw.agua.batch += cost;
    raw.agua.origin.push(`${number(liters)} L × ${money(s.waterPricePerM3)}/m³ = ${money(cost)}`);
    if (s.waterPricePerM3 <= 0) alerts.push({ level: 'aviso', message: 'Tarifa de água não informada em Custos operacionais — água considerada R$ 0,00.' });
  }

  const hourly = laborHourly(s);
  const prepHours = (comp.prepMinutes / 60) * runs;
  if (comp.prepMinutes > 0) {
    const cost = prepHours * hourly;
    raw.maoDeObra.batch += cost;
    raw.maoDeObra.origin.push(`${number(prepHours)} h × ${moneyFine(hourly)}/h (${money(s.laborMonthly)} ÷ ${number(s.laborHoursMonth)} h/mês) = ${money(cost)}`);
    if (hourly <= 0) alerts.push({ level: 'aviso', message: 'Valor da mão de obra não configurado — sua hora de trabalho está saindo de graça.' });
  } else {
    alerts.push({ level: 'aviso', message: 'Tempo de preparo não informado — mão de obra e rateio de custos fixos ficam zerados.' });
  }

  for (const oc of comp.otherCosts) {
    const cost = (oc.value || 0) * batches;
    raw.outros.batch += cost;
    raw.outros.origin.push(`${oc.name || 'Custo extra'}: ${money(oc.value)} por lote × ${number(batches)} lote(s) = ${money(cost)}`);
  }

  const fph = fixedPerHour(s);
  const fixedRaw = prepHours * fph;
  if (fixedRaw > 0) {
    raw.fixos.batch += fixedRaw;
    raw.fixos.origin.push(`${number(prepHours)} h × ${moneyFine(fph)}/h (${money(fixedMonthly(s))} fixos ÷ ${number(s.productiveHoursMonth)} h produtivas/mês) = ${money(fixedRaw)}`);
  }
  if (fixedMonthly(s) > 0 && s.productiveHoursMonth <= 0)
    alerts.push({ level: 'aviso', message: 'Informe as horas produtivas por mês para ratear os custos fixos.' });

  // waste: share of batch-based cost that went into lost units
  let lossTotal = 0;
  const lossOrigin: string[] = [];
  const display: Record<CategoryKey, number> = {} as never;
  for (const c of CATEGORIES) {
    if (c.key === 'perdas') continue;
    const r = raw[c.key];
    const lost = r.batch * waste;
    lossTotal += lost;
    if (lost > 0.0049) lossOrigin.push(`${c.label}: ${money(lost)}`);
    display[c.key] = r.batch - lost + r.unit;
  }
  display.perdas = lossTotal;
  if (waste > 0) raw.perdas.origin.push(`${number(lostUnits)} de ${number(quantity)} unidades perdidas (${number(waste * 100)}%)`, ...lossOrigin);

  const totalCost = Object.values(display).reduce((a, b) => a + b, 0);
  const unitCost = usableUnits > 0 ? totalCost / usableUnits : NaN;
  const categories: CostCategory[] = CATEGORIES.map((c) => ({
    ...c,
    total: display[c.key],
    perUnit: usableUnits > 0 ? display[c.key] / usableUnits : 0,
    pct: totalCost > 0 ? (display[c.key] / totalCost) * 100 : 0,
    origin: raw[c.key].origin,
  }));

  const variablePct = clamp((params.cardFeePct || 0) + (params.commissionPct || 0) + (params.taxPct || 0), 0, 100);
  const v = variablePct / 100;
  const d = clamp(params.discountPct || 0, 0, 100) / 100;
  const m = clamp(params.marginPct || 0, 0, 100) / 100;
  const listPrice = Math.max(0, params.salePrice || 0);
  const effectivePrice = listPrice * (1 - d);
  const variableExpensePerUnit = effectivePrice * v;
  const netPerUnit = effectivePrice - variableExpensePerUnit;
  const unitProfit = netPerUnit - unitCost;
  const fixedTotal = fixedRaw; // includes the share lost to waste
  const variableUnitCost = usableUnits > 0 ? (totalCost - fixedTotal) / usableUnits : NaN;
  const contributionUnit = netPerUnit - variableUnitCost;

  // prices are list prices (before promotional discount)
  const minPrice = v < 1 && d < 1 ? unitCost / (1 - v) / (1 - d) : NaN;
  const denom = 1 - v - m;
  const suggestedPrice = denom > 0 && d < 1 ? unitCost / denom / (1 - d) : NaN;
  if (denom <= 0) alerts.push({ level: 'erro', message: 'Margem desejada + despesas de venda somam 100% ou mais — não existe preço que atinja essa margem.' });

  if (listPrice <= 0) alerts.push({ level: 'info', message: 'Preço de venda não definido — use o preço sugerido como ponto de partida.' });
  else if (Number.isFinite(minPrice) && listPrice < minPrice - 0.004)
    alerts.push({ level: 'erro', message: `Preço abaixo do mínimo (${money(minPrice)}): cada unidade vendida dá prejuízo.` });

  return {
    quantity,
    batches,
    runs,
    usableUnits,
    lostUnits,
    categories,
    totalCost,
    unitCost,
    variableUnitCost,
    fixedTotal,
    variablePct,
    listPrice,
    effectivePrice,
    variableExpensePerUnit,
    netPerUnit,
    unitProfit,
    totalProfit: unitProfit * usableUnits,
    revenue: effectivePrice * usableUnits,
    profitMarginPct: effectivePrice > 0 ? (unitProfit / effectivePrice) * 100 : NaN,
    contributionUnit,
    contributionMarginPct: effectivePrice > 0 ? (contributionUnit / effectivePrice) * 100 : NaN,
    markup: unitCost > 0 ? effectivePrice / unitCost : NaN,
    minPrice,
    suggestedPrice,
    suggestedRounded: Number.isFinite(suggestedPrice) ? Math.max(0, Math.ceil(suggestedPrice * 2 - 1e-9) / 2) : NaN,
    alerts: dedupe(alerts),
  };
}

function dedupe(alerts: Alert[]) {
  const seen = new Set<string>();
  return alerts.filter((a) => (seen.has(a.message) ? false : (seen.add(a.message), true)));
}

export function costRecord(r: PricingResult): CostRecord {
  return {
    totalCost: r.totalCost,
    unitCost: r.unitCost,
    usableUnits: r.usableUnits,
    breakdown: Object.fromEntries(r.categories.map((c) => [c.key, c.total])),
  };
}

/** Prices a recipe for one batch with its official price and the default sale expenses. */
export function priceRecipe(recipe: Recipe, ctx: PricingContext) {
  return computePricing(recipe, { ...defaultParams(recipe, ctx.settings), quantity: Math.max(1, recipe.yield) }, ctx);
}

export function emptyComposition(): Composition {
  return { yield: 1, unitLabel: 'un', prepMinutes: 0, wastePct: 0, waterLiters: 0, ingredients: [], materials: [], equipment: [], otherCosts: [] };
}
