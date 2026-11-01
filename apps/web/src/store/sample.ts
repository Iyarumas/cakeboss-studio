import { nowIso, uid } from '@cakeboss/domain/format';
import { costRecord, defaultParams, priceRecipe, type PricingContext } from '@cakeboss/domain/pricing';
import { SALE_CATEGORY } from '@cakeboss/domain/orders';
import type {
  CakeProduct,
  Customer,
  DeliveryZone,
  Equipment,
  FixedCost,
  Ingredient,
  Material,
  Order,
  OrderItem,
  OrderStatus,
  Production,
  Promotion,
  Purchase,
  Recipe,
  Settings,
  Simulation,
  StoreSettings,
  Transaction,
  Unit,
} from '@cakeboss/domain/types';

/** Example records of the kinds that have no `sample` flag carry this id prefix, so "Remover exemplos" finds them. */
export const SAMPLE_PREFIX = 'ex-';
export const isSampleId = (id: string) => id.startsWith(SAMPLE_PREFIX);
const exId = () => SAMPLE_PREFIX + uid();

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
      storeDescription: 'Brigadeiro de chocolate 50% com granulado belga.',
    }),
    recipe({
      name: 'Brownie recheado (exemplo)',
      category: 'Brownies',
      yield: 12,
      unitLabel: 'un',
      prepMinutes: 50,
      wastePct: 3,
      waterLiters: 2,
      ingredients: [
        { ingredientId: farinha.id, qty: 150, unit: 'g' },
        { ingredientId: acucar.id, qty: 250, unit: 'g' },
        { ingredientId: ovos.id, qty: 4, unit: 'un' },
        { ingredientId: manteiga.id, qty: 200, unit: 'g' },
        { ingredientId: choco.id, qty: 120, unit: 'g' },
        { ingredientId: lc.id, qty: 395, unit: 'g' },
      ],
      materials: [{ materialId: adesivo.id, qty: 1, per: 'unit' }],
      equipment: [
        { equipmentId: forno.id, minutes: 30 },
        { equipmentId: batedeira.id, minutes: 5 },
      ],
      otherCosts: [],
      salePrice: 12,
      targetMarginPct: 35,
      storeDescription: 'Brownie úmido recheado com brigadeiro.',
    }),
    // parts of the built birthday cake: one ficha per layer, not sold on their own
    recipe({
      name: 'Massa de chocolate (exemplo)',
      category: 'Bolo montado',
      yield: 1,
      unitLabel: 'camada',
      prepMinutes: 40,
      wastePct: 0,
      waterLiters: 1,
      ingredients: [
        { ingredientId: farinha.id, qty: 150, unit: 'g' },
        { ingredientId: acucar.id, qty: 120, unit: 'g' },
        { ingredientId: ovos.id, qty: 2, unit: 'un' },
        { ingredientId: choco.id, qty: 50, unit: 'g' },
        { ingredientId: leite.id, qty: 120, unit: 'ml' },
      ],
      materials: [],
      equipment: [{ equipmentId: forno.id, minutes: 35 }],
      otherCosts: [],
      salePrice: null,
      targetMarginPct: 30,
      storeVisible: false,
    }),
    recipe({
      name: 'Recheio de brigadeiro (exemplo)',
      category: 'Bolo montado',
      yield: 1,
      unitLabel: 'camada',
      prepMinutes: 25,
      wastePct: 0,
      waterLiters: 0.5,
      ingredients: [
        { ingredientId: lc.id, qty: 395, unit: 'g' },
        { ingredientId: creme.id, qty: 100, unit: 'g' },
        { ingredientId: choco.id, qty: 30, unit: 'g' },
      ],
      materials: [],
      equipment: [{ equipmentId: fogao.id, minutes: 20 }],
      otherCosts: [],
      salePrice: null,
      targetMarginPct: 30,
      storeVisible: false,
    }),
    recipe({
      name: 'Recheio de leite condensado com creme (exemplo)',
      category: 'Bolo montado',
      yield: 1,
      unitLabel: 'camada',
      prepMinutes: 20,
      wastePct: 0,
      waterLiters: 0.5,
      ingredients: [
        { ingredientId: lc.id, qty: 395, unit: 'g' },
        { ingredientId: creme.id, qty: 200, unit: 'g' },
        { ingredientId: leite.id, qty: 100, unit: 'ml' },
      ],
      materials: [],
      equipment: [{ equipmentId: fogao.id, minutes: 15 }],
      otherCosts: [],
      salePrice: null,
      targetMarginPct: 30,
      storeVisible: false,
    }),
    recipe({
      name: 'Cobertura de ganache (exemplo)',
      category: 'Bolo montado',
      yield: 1,
      unitLabel: 'bolo',
      prepMinutes: 15,
      wastePct: 0,
      waterLiters: 0.3,
      ingredients: [
        { ingredientId: creme.id, qty: 200, unit: 'g' },
        { ingredientId: choco.id, qty: 60, unit: 'g' },
        { ingredientId: manteiga.id, qty: 20, unit: 'g' },
      ],
      materials: [],
      equipment: [{ equipmentId: fogao.id, minutes: 8 }],
      otherCosts: [],
      salePrice: null,
      targetMarginPct: 30,
      storeVisible: false,
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

/** Store texts the example fills in when empty; "Remover exemplos" clears them only if they were not changed. */
export const SAMPLE_STORE_TEXT: Pick<StoreSettings, 'whatsapp' | 'pickupAddress' | 'about' | 'tagline'> = {
  whatsapp: '47999990000',
  pickupAddress: 'Rua das Flores, 120, Centro (exemplo)',
  about: 'Doces sob encomenda feitos em casa, com ingredientes selecionados. Este texto é um exemplo.',
  tagline: 'Delícias artesanais, feitas com carinho',
};

/**
 * Example day-to-day activity built on top of the example fichas: customers, orders in every stage,
 * money in and out over the last months, purchases, productions, a price simulation, a built cake,
 * delivery cities and a promotion. Costs come from the real pricing of the example fichas.
 */
export function buildSampleActivity(recipes: Recipe[], ingredients: Ingredient[], ctx: PricingContext, settings: Settings, firstNumber: number) {
  const byName = (n: string) => recipes.find((r) => r.name.startsWith(n))!;
  const brigadeiro = byName('Brigadeiro gourmet');
  const brownie = byName('Brownie recheado');
  const bolo = byName('Bolo de chocolate');
  const massa = byName('Massa de chocolate');
  const recBrig = byName('Recheio de brigadeiro');
  const recLeite = byName('Recheio de leite condensado');
  const ganache = byName('Cobertura de ganache');
  const unitCost = (r: Recipe) => Math.round(priceRecipe(r, ctx).unitCost * 100) / 100;

  const at = (days: number, hour = 10) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  const now = nowIso();

  const customer = (name: string, phone: string, notes = '', city = 'Navegantes'): Customer => ({
    id: exId(),
    name,
    phone,
    notes,
    createdAt: at(-40),
    address: { city, district: 'Centro', street: 'Rua Exemplo', number: '100', complement: '', reference: '' },
  });
  const customers = [
    customer('Ana Souza (exemplo)', '47999990001', 'Prefere menos açúcar no recheio.'),
    customer('Carla Mendes (exemplo)', '47999990002', 'Cliente fiel, encomenda todo mês.'),
    customer('Juliana Pereira (exemplo)', '47999990003', '', 'Itajaí'),
    customer('Marcos Lima (exemplo)', '47999990004', 'Pede sempre para retirar.'),
  ];
  const [ana, carla, juliana, marcos] = customers;

  const item = (r: Recipe, qty: number, unitPrice: number, frozen: boolean, name = r.name.replace(' (exemplo)', '')): OrderItem => ({
    id: uid(),
    recipeId: r.id,
    name,
    qty,
    unitPrice,
    unitCost: frozen ? unitCost(r) : null,
  });
  let n = firstNumber;
  const order = (c: Customer, status: OrderStatus, deliveryDays: number, items: (frozen: boolean) => OrderItem[], extra: Partial<Order> = {}): Order => {
    const frozen = status !== 'orcamento';
    return {
      id: exId(),
      number: n++,
      customerId: c.id,
      customerName: c.name,
      items: items(frozen),
      deliveryAt: at(deliveryDays, 15),
      status,
      discount: 0,
      deliveryFee: 0,
      notes: '',
      costFrozenAt: frozen ? at(deliveryDays - 3) : null,
      stockDeducted: false,
      createdAt: at(deliveryDays - 5),
      updatedAt: now,
      ...extra,
    };
  };
  const orders: Order[] = [
    order(carla, 'entregue', -6, (f) => [item(bolo, 1, 120, f, 'Bolo de chocolate 20 cm'), item(brigadeiro, 50, 3.5, f)], { notes: 'Aniversário da filha. Escrever "Parabéns, Lia".' }),
    order(ana, 'pronto', 0, (f) => [item(brigadeiro, 100, 3.5, f), item(brownie, 12, 12, f)], { deliveryFee: 10, fulfillment: { type: 'entrega', fee: 10 }, notes: 'Entregar até as 16h.' }),
    order(juliana, 'em_producao', 1, (f) => [item(brownie, 24, 12, f)], { deliveryFee: 15, discount: 18, fulfillment: { type: 'entrega', fee: 15 } }),
    order(marcos, 'confirmado', 3, (f) => [item(bolo, 1, 120, f, 'Bolo de chocolate 20 cm'), item(brigadeiro, 30, 3.5, f)], { fulfillment: { type: 'retirada', fee: 0 } }),
    order(ana, 'orcamento', 10, (f) => [item(brigadeiro, 200, 3.2, f), item(brownie, 30, 11, f)], { notes: 'Orçamento para casamento, 120 convidados.' }),
  ];
  const [entregue, pronto, , confirmado] = orders;

  const tx = (days: number, type: Transaction['type'], category: string, description: string, amount: number, method: Transaction['method'], orderId: string | null = null): Transaction => ({
    id: exId(),
    date: at(days, 12),
    type,
    category,
    description,
    amount,
    method,
    orderId,
    createdAt: at(days, 12),
  });
  const transactions: Transaction[] = [
    // the delivered order paid in full, the ready one half paid, the confirmed one with a deposit
    tx(-9, 'entrada', SALE_CATEGORY, `Sinal do pedido #${entregue.number}`, 145, 'pix', entregue.id),
    tx(-6, 'entrada', SALE_CATEGORY, `Restante do pedido #${entregue.number}`, 150, 'pix', entregue.id),
    tx(-2, 'entrada', SALE_CATEGORY, `Sinal do pedido #${pronto.number}`, 250, 'pix', pronto.id),
    tx(-1, 'entrada', SALE_CATEGORY, `Sinal do pedido #${confirmado.number}`, 110, 'credito', confirmado.id),
    // earlier months, so the chart has history
    tx(-75, 'entrada', SALE_CATEGORY, 'Vendas da feirinha (exemplo)', 640, 'dinheiro'),
    tx(-48, 'entrada', SALE_CATEGORY, 'Encomendas da semana (exemplo)', 890, 'pix'),
    tx(-20, 'entrada', SALE_CATEGORY, 'Doces para festa (exemplo)', 1180, 'pix'),
    tx(-70, 'saida', 'Ingredientes', 'Mercado do mês (exemplo)', 420, 'debito'),
    tx(-45, 'saida', 'Ingredientes', 'Mercado do mês (exemplo)', 515, 'debito'),
    tx(-40, 'saida', 'Gás', 'Botijão P13 (exemplo)', 115, 'pix'),
    tx(-15, 'saida', 'Embalagens e adesivos', 'Caixas e forminhas (exemplo)', 96, 'pix'),
    tx(-10, 'saida', 'Aluguel', 'Aluguel do espaço (exemplo)', 400, 'pix'),
    tx(-5, 'saida', 'Marketing', 'Impulsionamento no Instagram (exemplo)', 50, 'credito'),
  ];

  // purchases already counted in the example stock: they only record the history and the expense
  const purchase = (days: number, ing: Ingredient, packages: number): { p: Purchase; t: Transaction } => {
    const t = tx(days, 'saida', 'Ingredientes', `Compra: ${ing.name}`, packages * ing.packagePrice, 'pix');
    return {
      t,
      p: {
        id: exId(),
        date: at(days, 9),
        kind: 'ingrediente',
        itemId: ing.id,
        itemName: ing.name,
        packages,
        packageQty: ing.packageQty,
        unit: ing.unit,
        pricePerPackage: ing.packagePrice,
        total: packages * ing.packagePrice,
        supplier: 'Atacadão (exemplo)',
        stockAdded: 0,
        transactionId: t.id,
      },
    };
  };
  const lc = ingredients.find((i) => i.name.startsWith('Leite condensado'))!;
  const granulado = ingredients.find((i) => i.name.startsWith('Granulado'))!;
  const choco = ingredients.find((i) => i.name.startsWith('Chocolate em pó'))!;
  const buys = [purchase(-12, lc, 6), purchase(-12, choco, 1)];
  transactions.push(...buys.map((b) => b.t));

  const production = (r: Recipe, quantity: number, days: number): Production => ({
    id: exId(),
    recipeId: r.id,
    recipeName: r.name,
    quantity,
    date: at(days, 8),
    cost: costRecord(priceRecipe(r, ctx)),
    salePrice: r.salePrice,
    stockDeducted: false,
  });
  const productions = [production(brigadeiro, 2, -6), production(brownie, 1, -2), production(bolo, 1, -7)];

  const simCost = unitCost(brigadeiro);
  const simulations: Simulation[] = [
    {
      id: exId(),
      name: 'Brigadeiro a R$ 4,00 (exemplo)',
      recipeId: brigadeiro.id,
      composition: {
        yield: brigadeiro.yield,
        unitLabel: brigadeiro.unitLabel,
        prepMinutes: brigadeiro.prepMinutes,
        wastePct: brigadeiro.wastePct,
        waterLiters: brigadeiro.waterLiters,
        ingredients: brigadeiro.ingredients,
        materials: brigadeiro.materials,
        equipment: brigadeiro.equipment,
        otherCosts: brigadeiro.otherCosts,
      },
      params: { ...defaultParams(brigadeiro, settings), salePrice: 4 },
      unitCost: simCost,
      profitMarginPct: Math.round(((4 - simCost) / 4) * 1000) / 10,
      createdAt: at(-3),
    },
  ];

  const cake: CakeProduct = {
    id: exId(),
    name: 'Bolo de aniversário (exemplo)',
    description: 'Escolha o tamanho, a massa, até 2 recheios e a cobertura.',
    visible: true,
    refDiameter: 20,
    sizes: [
      { id: exId(), name: 'P · 15 cm (10 fatias)', diameter: 15, massa: 0.6, recheio: 0.6, cobertura: 0.6, extra: 6 },
      { id: exId(), name: 'M · 20 cm (20 fatias)', diameter: 20, massa: 1, recheio: 1, cobertura: 1, extra: 8 },
      { id: exId(), name: 'G · 25 cm (30 fatias)', diameter: 25, massa: 1.6, recheio: 1.6, cobertura: 1.5, extra: 12 },
    ],
    massas: [{ id: exId(), name: 'Chocolate', recipeId: massa.id }],
    recheios: [
      { id: exId(), name: 'Brigadeiro', recipeId: recBrig.id },
      { id: exId(), name: 'Leite condensado com creme', recipeId: recLeite.id },
    ],
    coberturas: [{ id: exId(), name: 'Ganache', recipeId: ganache.id }],
    maxRecheios: 2,
    marginPct: 40,
    // straight from stock: no ficha needed for a single item
    adicionais: [{ id: exId(), name: 'Granulado crocante', source: 'estoque', ingredientId: granulado.id, qty: 60 }],
    decoracoes: [{ id: exId(), name: 'Confeitos de chocolate por cima', source: 'estoque', ingredientId: granulado.id, qty: 40 }],
  };

  const zones: DeliveryZone[] = [
    { id: exId(), city: 'Navegantes', fee: 8 },
    { id: exId(), city: 'Itajaí', fee: 15 },
  ];
  const promotion: Promotion = {
    id: exId(),
    name: 'Semana do brownie (exemplo)',
    kind: 'percent',
    value: 10,
    recipeIds: [brownie.id],
    startsOn: null,
    endsOn: null,
    active: true,
    createdAt: now,
  };

  return { customers, orders, transactions, purchases: buys.map((b) => b.p), productions, simulations, cake, zones, promotion };
}
