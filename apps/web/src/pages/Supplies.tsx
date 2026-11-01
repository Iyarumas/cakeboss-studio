import { useState } from 'react';
import { motion } from 'motion/react';
import { Package, Pencil, Plus, Search, Trash, Wheat } from 'lucide-react';
import { useStore } from '../store/store';
import { baseUnit, compatibleUnits, date, money, moneyFine, nowIso, qtyBase, toBase, uid, UNIT_LABEL } from '@cakeboss/domain/format';
import { ingredientPricePerBase, materialUnitPrice } from '@cakeboss/domain/pricing';
import type { Ingredient, Material, MaterialKind, Unit } from '@cakeboss/domain/types';
import { Badge, Button, Card, EmptyState, Field, IconButton, NumberInput, PageHeader, Segmented, Select, TextInput, cx } from '../components/ui';
import { ConfirmDialog, Drawer, stagger, useToast } from '../components/motion';
import { PurchaseForm, type PurchasePreset } from '../components/PurchaseForm';
import { ShoppingCart } from 'lucide-react';

const newIngredient = (): Ingredient => ({ id: uid(), name: '', unit: 'kg', packageQty: 1, packagePrice: 0, supplier: '', stock: 0, minStock: 0, priceHistory: [], updatedAt: nowIso() });
const newMaterial = (kind: MaterialKind = 'embalagem'): Material => ({ id: uid(), name: '', kind, packageQty: 1, packagePrice: 0, supplier: '', stock: 0, minStock: 0, priceHistory: [], updatedAt: nowIso() });

function PriceHistory({ points, unitLabel }: { points: { date: string; packagePrice: number; packageQty: number }[]; unitLabel: string }) {
  if (points.length < 1) return null;
  return (
    <div className="mt-5">
      <div className="mb-2 text-[13px] font-medium">Histórico de preços</div>
      <ul className="divide-y divide-divider rounded-lg border border-line text-xs">
        {[...points].reverse().map((p, i) => (
          <li key={i} className="flex justify-between px-3 py-2">
            <span className="text-muted">{date(p.date)}</span>
            <span className="tabular">
              {money(p.packagePrice)} / {p.packageQty} {unitLabel}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IngredientsPage() {
  const { db, saveIngredient, deleteIngredient, loadSample } = useStore();
  const toast = useToast();
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [stockInput, setStockInput] = useState({ stock: 0, min: 0 });
  const [q, setQ] = useState('');
  const [del, setDel] = useState<Ingredient | null>(null);
  const [buy, setBuy] = useState<PurchasePreset | null>(null);
  const list = db.ingredients.filter((i) => i.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));

  const open = (i: Ingredient) => {
    setEditing({ ...i });
    // stock is edited in the purchase unit for convenience
    const f = toBase(1, i.unit);
    setStockInput({ stock: i.stock / f, min: i.minStock / f });
  };
  const save = () => {
    if (!editing || !editing.name.trim()) return toast('Informe o nome do ingrediente', 'error');
    const f = toBase(1, editing.unit);
    saveIngredient({ ...editing, name: editing.name.trim(), stock: stockInput.stock * f, minStock: stockInput.min * f });
    toast('Ingrediente salvo');
    setEditing(null);
  };

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show">
      <PageHeader
        title="Ingredientes"
        subtitle="Preço de compra, rendimento por embalagem e estoque. O custo por grama/ml/unidade é calculado automaticamente."
        actions={
          <>
            <Button onClick={() => setBuy({ kind: 'ingrediente' })}>
              <ShoppingCart size={16} /> Registrar compra
            </Button>
            <Button variant="primary" onClick={() => open(newIngredient())}>
              <Plus size={16} /> Novo ingrediente
            </Button>
          </>
        }
      />
      <motion.div variants={stagger.item}>
        <Card>
          {db.ingredients.length === 0 ? (
            <EmptyState
              icon={<Wheat size={22} />}
              title="Nenhum ingrediente cadastrado"
              text="Cadastre os ingredientes com o preço que você paga e o tamanho da embalagem."
              action={
                <>
                  <Button variant="primary" onClick={() => open(newIngredient())}>
                    <Plus size={16} /> Cadastrar ingrediente
                  </Button>
                  <Button onClick={loadSample}>Carregar dados de exemplo</Button>
                </>
              }
            />
          ) : (
            <>
              <div className="border-b border-divider p-4">
                <div className="relative max-w-xs">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <TextInput className="pl-9" placeholder="Buscar ingrediente" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-subtle/70 text-left text-xs text-muted">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Ingrediente</th>
                      <th className="px-3 py-2.5 font-medium">Embalagem</th>
                      <th className="px-3 py-2.5 text-right font-medium">Preço</th>
                      <th className="px-3 py-2.5 text-right font-medium">Custo base</th>
                      <th className="px-3 py-2.5 text-right font-medium">Estoque</th>
                      <th className="px-3 py-2.5 font-medium">Fornecedor</th>
                      <th className="w-24 px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {list.map((i) => {
                      const low = i.minStock > 0 && i.stock <= i.minStock;
                      return (
                        <tr key={i.id} className="hover:bg-subtle/50">
                          <td className="px-5 py-3 font-medium">
                            {i.name} {i.sample && <Badge tone="amber">exemplo</Badge>}
                          </td>
                          <td className="px-3 py-3 text-muted">
                            {i.packageQty} {UNIT_LABEL[i.unit]}
                          </td>
                          <td className={cx('px-3 py-3 text-right tabular', i.packagePrice <= 0 && 'text-warn')}>{i.packagePrice > 0 ? money(i.packagePrice) : 'sem preço'}</td>
                          <td className="px-3 py-3 text-right tabular text-muted">
                            {moneyFine(ingredientPricePerBase(i))}/{UNIT_LABEL[baseUnit(i.unit)]}
                          </td>
                          <td className={cx('px-3 py-3 text-right tabular', low ? 'font-medium text-warn' : 'text-ink')}>{qtyBase(i.stock, i.unit)}</td>
                          <td className="px-3 py-3 text-muted">{i.supplier || '—'}</td>
                          <td className="px-3 py-3">
                            <div className="flex justify-end gap-1">
                              <IconButton label="Registrar compra" onClick={() => setBuy({ kind: 'ingrediente', itemId: i.id })}>
                                <ShoppingCart size={15} />
                              </IconButton>
                              <IconButton label="Editar" onClick={() => open(i)}>
                                <Pencil size={15} />
                              </IconButton>
                              <IconButton label="Excluir" onClick={() => setDel(i)}>
                                <Trash size={15} />
                              </IconButton>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </motion.div>

      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing && db.ingredients.some((x) => x.id === editing.id) ? 'Editar ingrediente' : 'Novo ingrediente'}>
        {editing && (
          <form
            className="space-y-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <Field label="Nome">
              <TextInput autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex.: Chocolate em pó 50%" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantidade na embalagem">
                <NumberInput value={editing.packageQty} min={0} onChange={(v) => setEditing({ ...editing, packageQty: v })} />
              </Field>
              <Field label="Unidade de compra">
                <Select value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value as Unit })}>
                  {(['g', 'kg', 'ml', 'l', 'un'] as Unit[]).map((u) => (
                    <option key={u} value={u}>
                      {UNIT_LABEL[u]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Preço pago pela embalagem">
              <NumberInput value={editing.packagePrice} min={0} prefix="R$" onChange={(v) => setEditing({ ...editing, packagePrice: v })} />
            </Field>
            <div className="rounded-lg border border-line bg-subtle px-3 py-2 text-xs text-muted">
              Custo calculado: <b className="text-ink">{moneyFine(ingredientPricePerBase(editing))}</b> por {UNIT_LABEL[baseUnit(editing.unit)]}
            </div>
            <Field label="Fornecedor">
              <TextInput value={editing.supplier} onChange={(e) => setEditing({ ...editing, supplier: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Estoque atual (${UNIT_LABEL[editing.unit]})`}>
                <NumberInput value={stockInput.stock} onChange={(v) => setStockInput((s) => ({ ...s, stock: v }))} />
              </Field>
              <Field label={`Avisar quando ficar abaixo de (${UNIT_LABEL[editing.unit]})`}>
                <NumberInput value={stockInput.min} min={0} onChange={(v) => setStockInput((s) => ({ ...s, min: v }))} />
              </Field>
            </div>
            {compatibleUnits(editing.unit).length > 1 && <p className="text-xs text-muted">Nas fichas técnicas você pode usar {compatibleUnits(editing.unit).map((u) => UNIT_LABEL[u]).join(' ou ')}.</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => setEditing(null)}>Cancelar</Button>
              <Button variant="primary" type="submit">
                Salvar
              </Button>
            </div>
            <PriceHistory points={editing.priceHistory} unitLabel={UNIT_LABEL[editing.unit]} />
          </form>
        )}
      </Drawer>

      <Drawer open={!!buy} onClose={() => setBuy(null)} title="Registrar compra" width="max-w-lg">
        {buy && <PurchaseForm preset={buy} onDone={() => setBuy(null)} />}
      </Drawer>

      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        danger
        title="Excluir ingrediente?"
        confirmLabel="Excluir"
        onConfirm={() => {
          if (!del) return;
          const r = deleteIngredient(del.id);
          if (r.ok) toast('Ingrediente excluído');
          else toast(r.error, 'error');
        }}
      >
        <b>{del?.name}</b> será removido do cadastro. Ingredientes usados em fichas técnicas não podem ser excluídos.
      </ConfirmDialog>
    </motion.div>
  );
}

const KIND_LABEL: Record<MaterialKind, string> = { embalagem: 'Embalagem', adesivo: 'Adesivo', outro: 'Outro material' };

export function MaterialsPage() {
  const { db, saveMaterial, deleteMaterial, loadSample } = useStore();
  const toast = useToast();
  const [kind, setKind] = useState<'todos' | MaterialKind>('todos');
  const [editing, setEditing] = useState<Material | null>(null);
  const [del, setDel] = useState<Material | null>(null);
  const list = db.materials.filter((m) => kind === 'todos' || m.kind === kind).sort((a, b) => a.name.localeCompare(b.name));

  const save = () => {
    if (!editing || !editing.name.trim()) return toast('Informe o nome do material', 'error');
    saveMaterial({ ...editing, name: editing.name.trim() });
    toast('Material salvo');
    setEditing(null);
  };

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show">
      <PageHeader
        title="Embalagens e adesivos"
        subtitle="Caixas, forminhas, adesivos, fitas e outros materiais usados em cada produto."
        actions={
          <Button variant="primary" onClick={() => setEditing(newMaterial(kind === 'todos' ? 'embalagem' : kind))}>
            <Plus size={16} /> Novo material
          </Button>
        }
      />
      <motion.div variants={stagger.item}>
        <Card>
          <div className="border-b border-divider p-4">
            <Segmented
              value={kind}
              onChange={setKind}
              options={[
                { value: 'todos', label: 'Todos' },
                { value: 'embalagem', label: 'Embalagens' },
                { value: 'adesivo', label: 'Adesivos' },
                { value: 'outro', label: 'Outros' },
              ]}
            />
          </div>
          {list.length === 0 ? (
            <EmptyState
              icon={<Package size={22} />}
              title="Nada cadastrado aqui"
              text="Cadastre o pacote como você compra (ex.: 100 forminhas por R$ 8,00) — o custo por unidade é calculado."
              action={
                <>
                  <Button variant="primary" onClick={() => setEditing(newMaterial(kind === 'todos' ? 'embalagem' : kind))}>
                    <Plus size={16} /> Cadastrar material
                  </Button>
                  {db.materials.length === 0 && <Button onClick={loadSample}>Carregar dados de exemplo</Button>}
                </>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-subtle/70 text-left text-xs text-muted">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Material</th>
                    <th className="px-3 py-2.5 font-medium">Tipo</th>
                    <th className="px-3 py-2.5 text-right font-medium">Pacote</th>
                    <th className="px-3 py-2.5 text-right font-medium">Custo un.</th>
                    <th className="px-3 py-2.5 text-right font-medium">Estoque</th>
                    <th className="w-24 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {list.map((m) => (
                    <tr key={m.id} className="hover:bg-subtle/50">
                      <td className="px-5 py-3 font-medium">
                        {m.name} {m.sample && <Badge tone="amber">exemplo</Badge>}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={m.kind === 'embalagem' ? 'amber' : m.kind === 'adesivo' ? 'cacau' : 'gray'}>{KIND_LABEL[m.kind]}</Badge>
                      </td>
                      <td className="px-3 py-3 text-right tabular text-muted">
                        {m.packageQty} un · {money(m.packagePrice)}
                      </td>
                      <td className="px-3 py-3 text-right tabular">{moneyFine(materialUnitPrice(m))}</td>
                      <td className={cx('px-3 py-3 text-right tabular', m.minStock > 0 && m.stock <= m.minStock && 'font-medium text-warn')}>{m.stock} un</td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <IconButton label="Editar" onClick={() => setEditing({ ...m })}>
                            <Pencil size={15} />
                          </IconButton>
                          <IconButton label="Excluir" onClick={() => setDel(m)}>
                            <Trash size={15} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>

      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing && db.materials.some((x) => x.id === editing.id) ? 'Editar material' : 'Novo material'}>
        {editing && (
          <form
            className="space-y-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <Field label="Nome">
              <TextInput autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex.: Caixa para bolo 20 cm" />
            </Field>
            <Field label="Tipo">
              <Select value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value as MaterialKind })}>
                {(Object.keys(KIND_LABEL) as MaterialKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Unidades no pacote">
                <NumberInput value={editing.packageQty} min={0} onChange={(v) => setEditing({ ...editing, packageQty: v })} />
              </Field>
              <Field label="Preço do pacote">
                <NumberInput value={editing.packagePrice} min={0} prefix="R$" onChange={(v) => setEditing({ ...editing, packagePrice: v })} />
              </Field>
            </div>
            <div className="rounded-lg border border-line bg-subtle px-3 py-2 text-xs text-muted">
              Custo por unidade: <b className="text-ink">{moneyFine(materialUnitPrice(editing))}</b>
            </div>
            <Field label="Fornecedor">
              <TextInput value={editing.supplier} onChange={(e) => setEditing({ ...editing, supplier: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Estoque atual (un)">
                <NumberInput value={editing.stock} onChange={(v) => setEditing({ ...editing, stock: v })} />
              </Field>
              <Field label="Avisar quando ficar abaixo de (un)">
                <NumberInput value={editing.minStock} min={0} onChange={(v) => setEditing({ ...editing, minStock: v })} />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => setEditing(null)}>Cancelar</Button>
              <Button variant="primary" type="submit">
                Salvar
              </Button>
            </div>
            <PriceHistory points={editing.priceHistory} unitLabel="un" />
          </form>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        danger
        title="Excluir material?"
        confirmLabel="Excluir"
        onConfirm={() => {
          if (!del) return;
          const r = deleteMaterial(del.id);
          if (r.ok) toast('Material excluído');
          else toast(r.error, 'error');
        }}
      >
        <b>{del?.name}</b> será removido do cadastro. Materiais usados em fichas técnicas não podem ser excluídos.
      </ConfirmDialog>
    </motion.div>
  );
}
