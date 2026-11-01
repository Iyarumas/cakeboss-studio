export type MascotCharacter = 'docinho' | 'brigadinho' | 'mila' | 'fatinha' | 'rosquinha' | 'biscoitinho';

export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'un';
export type MaterialKind = 'embalagem' | 'adesivo' | 'outro';
export type EnergySource = 'gas' | 'energia';

export interface PricePoint {
  date: string;
  packagePrice: number;
  packageQty: number;
}

export interface Ingredient {
  id: string;
  name: string;
  /** Purchase unit; stock and recipe quantities are stored in the base unit (g, ml or un). */
  unit: Unit;
  packageQty: number;
  packagePrice: number;
  supplier: string;
  stock: number;
  minStock: number;
  priceHistory: PricePoint[];
  sample?: boolean;
  updatedAt: string;
}

export interface Material {
  id: string;
  name: string;
  kind: MaterialKind;
  packageQty: number;
  packagePrice: number;
  supplier: string;
  stock: number;
  minStock: number;
  priceHistory: PricePoint[];
  sample?: boolean;
  updatedAt: string;
}

export interface Equipment {
  id: string;
  name: string;
  source: EnergySource;
  /** gas: kg/h (botijão) or bill unit per hour (gás encanado) · energia: kW */
  consumption: number;
}

export interface FixedCost {
  id: string;
  name: string;
  monthly: number;
}

export interface MessageTemplate {
  id: string;
  name: string;
  /** 'pedido' templates use order variables; 'geral' ones work anywhere */
  scope: 'pedido' | 'geral';
  text: string;
}

export interface Settings {
  businessName: string;
  ownerName: string;
  theme: 'light' | 'dark';
  /** botijão: price from cylinder price ÷ kg · encanado: bill value ÷ billed consumption */
  gasMode: 'botijao' | 'encanado';
  gasCylinderPrice: number;
  gasCylinderKg: number;
  gasBillValue: number;
  gasBillConsumption: number;
  gasBillUnit: 'm3' | 'kg';
  energyPricePerKwh: number;
  waterPricePerM3: number;
  laborMonthly: number;
  laborHoursMonth: number;
  fixedCosts: FixedCost[];
  productiveHoursMonth: number;
  cardFeePct: number;
  commissionPct: number;
  taxPct: number;
  defaultMarginPct: number;
  equipment: Equipment[];
  pixKey: string;
  messageTemplates: MessageTemplate[];
  /** Docinho, the helper mascot (on unless turned off) */
  mascotEnabled?: boolean;
  mascotCharacter?: MascotCharacter;
  /** optional second mascot; when set, the two split the work by topic */
  mascotSecond?: MascotCharacter | null;
  /** job of the first mascot when there are two (the second takes the other) */
  mascotFirstRole?: 'pedidos' | 'financas';
  /** first-access welcome already shown */
  onboarded?: boolean;
  /** brand color of the admin: a preset id from lib/theme or "#RRGGBB" (unset = rosa) */
  accentAdmin?: string;
  /** brand color of the customer store (unset = same as the admin) */
  accentShop?: string;
  store?: StoreSettings;
}

export interface IngredientLine {
  ingredientId: string;
  qty: number;
  unit: Unit;
}

export interface MaterialLine {
  materialId: string;
  qty: number;
  per: 'unit' | 'batch';
}

export interface EquipmentLine {
  equipmentId: string;
  minutes: number;
}

export interface OtherCost {
  id: string;
  name: string;
  value: number;
}

/** What it takes to make one batch of a product. Shared by fichas técnicas and simulations. */
export interface Composition {
  yield: number;
  unitLabel: string;
  prepMinutes: number;
  wastePct: number;
  waterLiters: number;
  ingredients: IngredientLine[];
  materials: MaterialLine[];
  equipment: EquipmentLine[];
  otherCosts: OtherCost[];
}

export interface PriceSnapshot {
  date: string;
  unitCost: number;
  salePrice: number;
}

export interface Recipe extends Composition {
  id: string;
  name: string;
  category: string;
  salePrice: number | null;
  targetMarginPct: number;
  priceSnapshot: PriceSnapshot | null;
  sample?: boolean;
  createdAt: string;
  updatedAt: string;
  /** shown in the online store (needs an official price) */
  storeVisible?: boolean;
  storeDescription?: string;
  /** product photo for the store (data URL, already shrunk) */
  storeImage?: string;
  /** what the customer can choose in the store: sizes, flavors, fillings… */
  storeOptions?: OptionGroup[];
}

export interface OptionChoice {
  id: string;
  name: string;
  /** added to (or, if negative, taken from) the product price */
  priceDelta: number;
}

export interface OptionGroup {
  id: string;
  name: string;
  required: boolean;
  /** how many choices the customer can pick (1 = single choice) */
  max: number;
  choices: OptionChoice[];
}

export interface PricingParams {
  quantity: number;
  salePrice: number;
  marginPct: number;
  wastePct: number;
  cardFeePct: number;
  commissionPct: number;
  taxPct: number;
  discountPct: number;
}

export interface Simulation {
  id: string;
  name: string;
  recipeId: string | null;
  composition: Composition;
  params: PricingParams;
  unitCost: number;
  profitMarginPct: number;
  createdAt: string;
}

export interface CostRecord {
  totalCost: number;
  unitCost: number;
  usableUnits: number;
  breakdown: Record<string, number>;
}

export interface Production {
  id: string;
  recipeId: string;
  recipeName: string;
  quantity: number;
  date: string;
  cost: CostRecord;
  salePrice: number | null;
  stockDeducted: boolean;
}

export interface HistoryEntry {
  id: string;
  at: string;
  type: 'preco' | 'ficha' | 'insumo' | 'producao' | 'simulacao' | 'config' | 'sistema' | 'pedido' | 'financeiro';
  message: string;
  detail?: string;
}

export interface Address {
  city: string;
  district: string;
  street: string;
  number: string;
  complement: string;
  reference: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  notes: string;
  createdAt: string;
  /** filled when the customer signed up in the online store */
  email?: string;
  address?: Address;
}

export interface DeliveryZone {
  id: string;
  city: string;
  /** null = not configured yet: the city is not offered for delivery */
  fee: number | null;
}

export interface StoreSettings {
  enabled: boolean;
  whatsapp: string;
  pickupAddress: string;
  /** minimum days between the order and the delivery/pickup date */
  leadDays: number;
  about: string;
  zones: DeliveryZone[];
  /** cakes the customer builds: size + massa + fillings + topping, priced from the fichas técnicas */
  cakes?: CakeProduct[];
  /** discounts the baker runs on chosen products */
  promotions?: Promotion[];
  /** store's own logo (small data URL until photos move to Storage) and the name shown on the store */
  logo?: string;
  storeName?: string;
  /** short line under the store name, e.g. "Delícias artesanais, feitas com carinho" */
  tagline?: string;
}

/** A discount on chosen store products, optionally limited to a date range (local dates, inclusive). */
export interface Promotion {
  id: string;
  name: string;
  /** percent: value is % off · off: value is R$ off each unit */
  kind: 'percent' | 'off';
  value: number;
  recipeIds: string[];
  /** yyyy-mm-dd or null for "from now" / "no end" */
  startsOn: string | null;
  endsOn: string | null;
  /** paused promotions stay saved but do not apply */
  active: boolean;
  createdAt: string;
}

/** A part of a built cake, pointing to the ficha técnica of ONE layer at the reference size. */
export interface CakeComponent {
  id: string;
  name: string;
  recipeId: string;
}

/** A size the baker offers, with how many recipes (fichas) of each part it takes. */
export interface CakeSize {
  id: string;
  name: string;
  /** optional, only used to suggest the amounts by area */
  diameter: number;
  /** recipes of massa per layer */
  massa: number;
  /** recipes of recheio per layer */
  recheio: number;
  /** recipes of cobertura for the whole cake */
  cobertura: number;
  /** fixed extra per cake of this size (box, board…), in R$ */
  extra: number;
}

/**
 * Something extra on a built cake: an add-in for the fillings (chocolate picado, bombom, KitKat…) or a
 * decoration (morangos, raspas…). It comes from a ficha técnica, or straight from one stock item.
 */
export interface CakeExtra {
  id: string;
  name: string;
  source: 'ficha' | 'estoque';
  /** source = ficha: one receita at the reference size */
  recipeId?: string;
  /** source = estoque: the ingredient and how much goes in a cake of the reference size, in its base unit (g, ml, un) */
  ingredientId?: string;
  qty?: number;
}

export interface CakeProduct {
  id: string;
  name: string;
  description: string;
  image?: string;
  visible: boolean;
  /** diameter (cm) of the cake the fichas were written for — only used for suggestions */
  refDiameter: number;
  sizes: CakeSize[];
  massas: CakeComponent[];
  recheios: CakeComponent[];
  coberturas: CakeComponent[];
  maxRecheios: number;
  marginPct: number;
  /** add-ins mixed into the fillings, the customer picks any */
  adicionais?: CakeExtra[];
  /** decorations on top, the customer picks any */
  decoracoes?: CakeExtra[];
}

export interface CakeSelection {
  sizeId: string;
  massaId: string;
  recheioIds: string[];
  coberturaId?: string;
  adicionalIds?: string[];
  decoracaoIds?: string[];
}

export type OrderStatus = 'orcamento' | 'confirmado' | 'em_producao' | 'pronto' | 'entregue' | 'cancelado';
export type PaymentMethod = 'pix' | 'dinheiro' | 'credito' | 'debito' | 'outro';

export interface OrderItem {
  id: string;
  recipeId: string | null;
  name: string;
  qty: number;
  unitPrice: number;
  /** Unit cost frozen when the order is confirmed; null while it is only a quote. */
  unitCost: number | null;
  /** built cakes: fichas used and how many batches of each, to take them out of stock */
  components?: { recipeId: string; batches: number }[];
  /** built cakes: stock items used straight (morangos, KitKat…), in the ingredient's base unit per cake */
  stockItems?: { ingredientId: string; qty: number }[];
}

export interface Order {
  id: string;
  number: number;
  customerId: string | null;
  customerName: string;
  items: OrderItem[];
  deliveryAt: string;
  status: OrderStatus;
  discount: number;
  deliveryFee: number;
  notes: string;
  costFrozenAt: string | null;
  /** where the order came from; absent = created in the admin */
  origin?: 'loja';
  fulfillment?: { type: 'retirada' | 'entrega'; address?: Address; fee: number };
  /** what the customer chose in the store (payment itself is confirmed by the admin) */
  payment?: { method: PaymentMethod; note: string };
  /** true once the ingredients for this order were taken out of stock */
  stockDeducted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  date: string;
  type: 'entrada' | 'saida';
  category: string;
  description: string;
  amount: number;
  method: PaymentMethod | null;
  orderId: string | null;
  createdAt: string;
}

export interface Purchase {
  id: string;
  date: string;
  kind: 'ingrediente' | 'material';
  itemId: string;
  itemName: string;
  packages: number;
  /** size of one package, in `unit` */
  packageQty: number;
  unit: Unit;
  pricePerPackage: number;
  total: number;
  supplier: string;
  /** stock added, in the item's base unit */
  stockAdded: number;
  transactionId: string | null;
}

export interface DB {
  version: 1;
  customers: Customer[];
  orders: Order[];
  transactions: Transaction[];
  purchases: Purchase[];
  ingredients: Ingredient[];
  materials: Material[];
  recipes: Recipe[];
  simulations: Simulation[];
  productions: Production[];
  history: HistoryEntry[];
  settings: Settings;
}
