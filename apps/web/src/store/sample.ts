import { nowIso, uid } from '@cakeboss/domain/format';
import type { Equipment, FixedCost, Ingredient, Material, Recipe, Unit } from '@cakeboss/domain/types';

/**
 * Optional example data, loaded only when the user asks for it. Every item is
 * flagged `sample: true`, shown with an "exemplo" badge and removable in one click.
 * Prices are rough references, not real quotes — the user should replace them.
 */
export function buildSample() {
  const t = nowIso();
  const ing = (name: string, unit: Unit, packageQty: number, packagePrice: number, stock: number, minStock: number): Ingredient => ({
    id: uid(),
    name,
    unit,
    packageQty,
    packagePrice,
    supplier: 'Exemplo',
    stock,
    minStock,
    priceHistory: [{ date: t, packagePrice, packageQty }],
    sample: true,
    updatedAt: t,
  });
  const mat = (name: string, kind: Material['kind'], packageQty: number, packagePrice: number, stock: number, minStock: number): Material => ({
    id: uid(),
    name,
    kind,
    packageQty,
    packagePrice,
    supplier: 'Exemplo',
    stock,
    minStock,
    priceHistory: [{ date: t, packagePrice, packageQty }],
    sample: true,
    updatedAt: t,
  });

  const farinha = ing('Farinha de trigo', 'kg', 1, 6.5, 3000, 1000);
  const acucar = ing('Açúcar refinado', 'kg', 1, 5.2, 2000, 1000);
  const ovos = ing('Ovos', 'un', 30, 22, 24, 12);
  const manteiga = ing('Manteiga sem sal', 'g', 500, 24, 400, 250);
  const choco = ing('Chocolate em pó 50%', 'kg', 1, 38, 300, 500);
  const lc = ing('Leite condensado', 'g', 395, 7.5, 1580, 790);
  const creme = ing('Creme de leite', 'g', 200, 3.8, 400, 400);
  const leite = ing('Leite integral', 'l', 1, 5.5, 2000, 1000);
  const granulado = ing('Granulado de chocolate', 'g', 500, 18, 600, 200);

  const caixaBolo = mat('Caixa para bolo 25 cm', 'embalagem', 10, 35, 8, 5);
  const caixaBolo2 = mat('Caixa para bolo 25 cm (econômica)', 'embalagem', 10, 24, 0, 0);
  const forminha = mat('Forminha nº 4', 'embalagem', 100, 8, 150, 100);
  const caixa4 = mat('Caixa para 4 doces', 'embalagem', 20, 22, 12, 10);
  const adesivo = mat('Adesivo com logo', 'adesivo', 100, 25, 60, 30);
  const fita = mat('Fita de cetim (metro)', 'outro', 50, 12, 30, 10);

  const forno: Equipment = { id: 'eq-sample-forno', name: 'Forno a gás (exemplo)', source: 'gas', consumption: 0.225 };
  const fogao: Equipment = { id: 'eq-sample-fogao', name: 'Boca do fogão (exemplo)', source: 'gas', consumption: 0.15 };
  const batedeira: Equipment = { id: 'eq-sample-batedeira', name: 'Batedeira planetária (exemplo)', source: 'energia', consumption: 0.6 };

  const recipe = (r: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt' | 'sample' | 'priceSnapshot'>): Recipe => ({
    ...r,
    id: uid(),
    priceSnapshot: null,
    sample: true,
    createdAt: t,
    updatedAt: t,
  });

  const recipes: Recipe[] = [
    recipe({
      name: 'Bolo de chocolate (exemplo)',
      category: 'Bolos',
      yield: 1,
      unitLabel: 'bolo',
      prepMinutes: 90,
      wastePct: 0,
      waterLiters: 5,
      ingredients: [
        { ingredientId: farinha.id, qty: 300, unit: 'g' },
        { ingredientId: acucar.id, qty: 250, unit: 'g' },
        { ingredientId: ovos.id, qty: 4, unit: 'un' },
        { ingredientId: choco.id, qty: 100, unit: 'g' },
        { ingredientId: manteiga.id, qty: 150, unit: 'g' },
        { ingredientId: leite.id, qty: 240, unit: 'ml' },
        { ingredientId: lc.id, qty: 790, unit: 'g' },
        { ingredientId: creme.id, qty: 200, unit: 'g' },
      ],
      materials: [
        { materialId: caixaBolo.id, qty: 1, per: 'unit' },
        { materialId: adesivo.id, qty: 1, per: 'unit' },
        { materialId: fita.id, qty: 1, per: 'unit' },
      ],
      equipment: [
        { equipmentId: forno.id, minutes: 45 },
        { equipmentId: fogao.id, minutes: 20 },
        { equipmentId: batedeira.id, minutes: 10 },
      ],
      otherCosts: [],
      salePrice: null,
      targetMarginPct: 30,
    }),
    recipe({
      name: 'Brigadeiro gourmet (exemplo)',
      category: 'Docinhos',
      yield: 25,
      unitLabel: 'un',
      prepMinutes: 60,
      wastePct: 4,
      waterLiters: 2,
      ingredients: [
        { ingredientId: lc.id, qty: 395, unit: 'g' },
        { ingredientId: creme.id, qty: 100, unit: 'g' },
        { ingredientId: choco.id, qty: 30, unit: 'g' },
        { ingredientId: manteiga.id, qty: 15, unit: 'g' },
        { ingredientId: granulado.id, qty: 120, unit: 'g' },
      ],
      materials: [
        { materialId: forminha.id, qty: 1, per: 'unit' },
        { materialId: caixa4.id, qty: 0.25, per: 'unit' },
        { materialId: adesivo.id, qty: 0.25, per: 'unit' },
      ],
      equipment: [{ equipmentId: fogao.id, minutes: 25 }],
      otherCosts: [],
      salePrice: 3.5,
      targetMarginPct: 35,
    }),
  ];

  const fixedCosts: FixedCost[] = [
    { id: uid(), name: 'Aluguel / espaço (exemplo)', monthly: 400 },
    { id: uid(), name: 'Internet e celular (exemplo)', monthly: 120 },
    { id: uid(), name: 'DAS MEI (exemplo)', monthly: 81 },
  ];

  return {
    ingredients: [farinha, acucar, ovos, manteiga, choco, lc, creme, leite, granulado],
    materials: [caixaBolo, caixaBolo2, forminha, caixa4, adesivo, fita],
    recipes,
    settingsPatch: {
      gasCylinderPrice: 115,
      energyPricePerKwh: 0.95,
      waterPricePerM3: 12,
      laborMonthly: 3000,
      laborHoursMonth: 160,
      fixedCosts,
      productiveHoursMonth: 120,
      cardFeePct: 3.5,
      equipment: [forno, fogao, batedeira],
    },
  };
}
