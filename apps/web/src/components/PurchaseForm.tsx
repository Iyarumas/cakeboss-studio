import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { useStore } from '../store/store';
import { baseUnit, compatibleUnits, fromLocalDate, money, moneyFine, nowIso, number, pct, qtyBase, toBase, toLocalDate, uid, UNIT_LABEL } from '@cakeboss/domain/format';
import { METHOD_LABEL } from '@cakeboss/domain/orders';
import type { Ingredient, Material, MaterialKind, PaymentMethod, Unit } from '@cakeboss/domain/types';
import { Button, Field, NumberInput, Segmented, Select, TextInput } from './ui';
import { useToast } from './motion';

export interface PurchasePreset {
  kind: 'ingrediente' | 'material';
  itemId?: string;
}

/** Records a purchase: adds stock, optionally updates the cost price and posts the expense to Financeiro. */
export function PurchaseForm({ preset, onDone }: { preset?: PurchasePreset; onDone: () => void }) {
  const { db, registerPurchase } = useStore();
  const toast = useToast();
  const [kind, setKind] = useState<'ingrediente' | 'material'>(preset?.kind ?? 'ingrediente');
  const items: (Ingredient | Material)[] = kind === 'ingrediente' ? db.ingredients : db.materials;
  const [itemId, setItemId] = useState<string>(preset?.itemId ?? items[0]?.id ?? '__new');
  const existing = items.find((x) => x.id === itemId);
  const isNew = !existing;

  const [name, setName] = useState('');
  const [matKind, setMatKind] = useState<MaterialKind>('embalagem');
  const [unit, setUnit] = useState<Unit>(existing && 'unit' in existing ? existing.unit : 'g');
  const [packageQty, setPackageQty] = useState(existing?.packageQty ?? 1);
  const [packages, setPackages] = useState(1);
  const [pricePerPackage, setPricePerPackage] = useState(existing?.packagePrice ?? 0);
  const [supplier, setSupplier] = useState(existing?.supplier ?? '');
  const [day, setDay] = useState(toLocalDate(nowIso()));
  const pkgBase = kind === 'ingrediente' ? toBase(packageQty, unit) : packageQty;
  const [minPackages, setMinPackages] = useState(existing && pkgBase > 0 ? Math.round((existing.minStock / pkgBase) * 100) / 100 : 0);
  const [updatePrice, setUpdatePrice] = useState(true);
  const [toFinance, setToFinance] = useState(true);
  const [method, setMethod] = useState<PaymentMethod>('pix');

  const pick = (id: string, k = kind) => {
    setItemId(id);
    const it = (k === 'ingrediente' ? db.ingredients : db.materials).find((x) => x.id === id);
    if (it) {
      const u = 'unit' in it ? it.unit : 'un';
      setUnit(u);
      setPackageQty(it.packageQty);
      setPricePerPackage(it.packagePrice);
      setSupplier(it.supplier);
      const base = k === 'ingrediente' ? toBase(it.packageQty, u) : it.packageQty;
      setMinPackages(base > 0 ? Math.round((it.minStock / base) * 100) / 100 : 0);
    } else {
      setName('');
      setPackageQty(1);
      setPricePerPackage(0);
      setMinPackages(0);
      setUnit(k === 'ingrediente' ? 'g' : 'un');
    }
  };

  const units: Unit[] = kind === 'material' ? ['un'] : existing && 'unit' in existing ? compatibleUnits(existing.unit) : ['g', 'kg', 'ml', 'l', 'un'];
  const total = packages * pricePerPackage;
  const added = packages * pkgBase;
  const itemUnit: Unit = kind === 'material' ? 'un' : existing && 'unit' in existing ? existing.unit : unit;
  const newPricePerBase = pkgBase > 0 ? pricePerPackage / pkgBase : 0;
  const oldPricePerBase = existing ? existing.packagePrice / (kind === 'ingrediente' ? toBase(existing.packageQty, itemUnit) : existing.packageQty || 1) : NaN;
  const priceDiff = Number.isFinite(oldPricePerBase) && oldPricePerBase > 0 ? ((newPricePerBase - oldPricePerBase) / oldPricePerBase) * 100 : null;
  const usedIn = useMemo(
    () => (existing ? db.recipes.filter((r) => (kind === 'ingrediente' ? r.ingredients.some((l) => l.ingredientId === existing.id) : r.materials.some((l) => l.materialId === existing.id))).length : 0),
    [db.recipes, existing, kind],
  );

  const submit = () => {
    if (isNew && !name.trim()) return toast('Informe o nome do item', 'error');
    if (!(packages > 0) || !(packageQty > 0)) return toast('Informe a quantidade comprada', 'error');
    const minStock = minPackages * pkgBase;
    const base = { id: uid(), name: name.trim(), packageQty, packagePrice: pricePerPackage, supplier, stock: 0, minStock, priceHistory: [], updatedAt: nowIso() };
    const item: Ingredient | Material = existing
      ? { ...existing, minStock }
      : kind === 'ingrediente'
        ? ({ ...base, unit } as Ingredient)
        : ({ ...base, kind: matKind } as Material);
    registerPurchase({ kind, item, packages, packageQty, unit: kind === 'material' ? 'un' : unit, pricePerPackage, supplier: supplier.trim(), date: fromLocalDate(day), updatePrice, toFinance, method });
    toast(`Compra registrada · estoque +${qtyBase(added, itemUnit)}`);
    onDone();
  };

  const unitWord = kind === 'material' ? 'unidades' : UNIT_LABEL[unit];

  return (
    <form
      className="space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Segmented
        value={kind}
        onChange={(k) => {
          setKind(k);
          const first = (k === 'ingrediente' ? db.ingredients : db.materials)[0]?.id ?? '__new';
          pick(first, k);
        }}
        options={[
          { value: 'ingrediente', label: 'Ingrediente' },
          { value: 'material', label: 'Embalagem / material' },
        ]}
      />

      <Field label="Item comprado">
        <Select value={itemId} onChange={(e) => pick(e.target.value)}>
          {items
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          <option value="__new">+ Cadastrar novo {kind === 'ingrediente' ? 'ingrediente' : 'material'}…</option>
        </Select>
      </Field>

      <AnimatePresence initial={false}>
        {isNew && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="grid gap-3 overflow-hidden sm:grid-cols-2">
            <Field label="Nome" className={kind === 'ingrediente' ? 'sm:col-span-2' : ''}>
              <TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'ingrediente' ? 'Ex.: Leite condensado' : 'Ex.: Caixa para bolo 20 cm'} />
            </Field>
            {kind === 'material' && (
              <Field label="Tipo">
                <Select value={matKind} onChange={(e) => setMatKind(e.target.value as MaterialKind)}>
                  <option value="embalagem">Embalagem</option>
                  <option value="adesivo">Adesivo</option>
                  <option value="outro">Outro material</option>
                </Select>
              </Field>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantas embalagens/pacotes">
          <NumberInput value={packages} min={0} onChange={setPackages} />
        </Field>
        <Field label={kind === 'material' ? 'Unidades por pacote' : 'Conteúdo de cada embalagem'}>
          <div className="flex gap-2">
            <NumberInput value={packageQty} min={0} onChange={setPackageQty} className="flex-1" />
            {kind === 'ingrediente' && (
              <Select aria-label="Unidade" value={unit} onChange={(e) => setUnit(e.target.value as Unit)} className="w-20">
                {units.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABEL[u]}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </Field>
        <Field label="Preço de cada embalagem">
          <NumberInput value={pricePerPackage} min={0} prefix="R$" onChange={setPricePerPackage} />
        </Field>
        <Field label="Total pago">
          <NumberInput value={Math.round(total * 100) / 100} min={0} prefix="R$" onChange={(v) => packages > 0 && setPricePerPackage(v / packages)} />
        </Field>
        <Field label="Fornecedor">
          <TextInput value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Ex.: Atacadão" />
        </Field>
        <Field label="Data da compra">
          <TextInput type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
        </Field>
      </div>

      <Field
        label="Avisar quando restarem menos de"
        hint={minPackages > 0 ? `aviso quando o estoque ficar em ${qtyBase(minPackages * pkgBase, itemUnit)} ou menos` : 'deixe 0 para não avisar'}
      >
        <NumberInput value={minPackages} min={0} suffix="embalagens" onChange={setMinPackages} />
      </Field>

      <div className="space-y-2 rounded-lg border border-line bg-subtle p-3 text-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          Estoque: <b className="tabular">{existing ? qtyBase(existing.stock, itemUnit) : '0'}</b>
          <ArrowRight size={13} className="text-muted" />
          <b className="tabular text-profit">{qtyBase((existing?.stock ?? 0) + added, itemUnit)}</b>
          <span className="text-xs text-muted">
            (+{number(packages)} × {number(packageQty)} {unitWord})
          </span>
        </div>
        <div className="text-xs text-muted">
          Custo desta compra: <b className="text-ink">{moneyFine(newPricePerBase)}</b> por {UNIT_LABEL[baseUnit(kind === 'material' ? 'un' : unit)]}
          {priceDiff !== null && Math.abs(priceDiff) >= 0.05 && (
            <span className={priceDiff > 0 ? 'text-loss' : 'text-profit'}>
              {' '}
              ({priceDiff > 0 ? '+' : ''}
              {pct(priceDiff)} vs. preço cadastrado)
            </span>
          )}
        </div>
      </div>

      {existing && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={updatePrice} onChange={(e) => setUpdatePrice(e.target.checked)} className="mt-0.5 h-4 w-4 accent-pink-600" />
          <span>
            Usar o preço desta compra como custo atual
            <span className="block text-xs text-muted">{usedIn > 0 ? `Atualiza o custo de ${usedIn} ficha(s) técnica(s) que usam este item.` : 'Nenhuma ficha usa este item ainda.'}</span>
          </span>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={toFinance} onChange={(e) => setToFinance(e.target.checked)} className="h-4 w-4 accent-pink-600" />
          Lançar {money(total)} como saída no Financeiro
        </label>
        {toFinance && (
          <Select aria-label="Forma de pagamento" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="h-8 w-44 text-[13px]">
            {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {METHOD_LABEL[m]}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-divider pt-4">
        <Button onClick={onDone}>Cancelar</Button>
        <Button variant="primary" type="submit">
          Registrar compra
        </Button>
      </div>
    </form>
  );
}
