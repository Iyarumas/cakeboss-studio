import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ChevronDown, Clock, Flame, Package, Plus, Trash, Wheat, Wrench } from 'lucide-react';
import { compatibleUnits, money, toBase, uid, UNIT_LABEL } from '../lib/format';
import { ingredientPricePerBase, materialUnitPrice, type PricingContext } from '../lib/pricing';
import type { Composition, Unit } from '../lib/types';
import { cx, Field, IconButton, NumberInput, Select, TextInput } from './ui';

export function Panel({ title, icon, summary, children, defaultOpen = true }: { title: string; icon: ReactNode; summary?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-divider last:border-b-0">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-subtle/60">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-subtle text-muted">{icon}</span>
        <span className="flex-1 text-sm font-semibold text-ink">{title}</span>
        {summary && <span className="text-xs tabular text-muted">{summary}</span>}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} className="text-muted">
          <ChevronDown size={16} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const rowAnim = { initial: { opacity: 0, height: 0 }, animate: { opacity: 1, height: 'auto' }, exit: { opacity: 0, height: 0 }, transition: { type: 'spring' as const, stiffness: 420, damping: 38 } };

export function CompositionEditor({
  value,
  onChange,
  ctx,
  hideWaste,
}: {
  value: Composition;
  onChange: (c: Composition) => void;
  ctx: PricingContext;
  hideWaste?: boolean;
}) {
  const set = (patch: Partial<Composition>) => onChange({ ...value, ...patch });
  const ingMap = new Map(ctx.ingredients.map((i) => [i.id, i]));
  const matMap = new Map(ctx.materials.map((m) => [m.id, m]));
  const eqs = ctx.settings.equipment;

  const ingTotal = value.ingredients.reduce((a, l) => {
    const i = ingMap.get(l.ingredientId);
    return a + (i ? toBase(l.qty, l.unit) * ingredientPricePerBase(i) : 0);
  }, 0);
  const matPerUnit = value.materials.reduce((a, l) => {
    const m = matMap.get(l.materialId);
    return a + (m ? l.qty * materialUnitPrice(m) : 0);
  }, 0);

  return (
    <div>
      <Panel title="Rendimento e preparo" icon={<Clock size={15} />} summary={`${value.yield} ${value.unitLabel} · ${value.prepMinutes} min`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Rendimento por lote">
            <NumberInput value={value.yield} min={0} onChange={(v) => set({ yield: v })} />
          </Field>
          <Field label="Unidade">
            <TextInput value={value.unitLabel} onChange={(e) => set({ unitLabel: e.target.value })} placeholder="un, fatia, pote" />
          </Field>
          <Field label="Tempo de preparo" hint="mão de obra ativa por lote">
            <NumberInput value={value.prepMinutes} min={0} suffix="min" onChange={(v) => set({ prepMinutes: v })} />
          </Field>
          {!hideWaste ? (
            <Field label="Perdas" hint="unidades perdidas">
              <NumberInput value={value.wastePct} min={0} max={95} suffix="%" onChange={(v) => set({ wastePct: v })} />
            </Field>
          ) : (
            <Field label="Água" hint="litros por lote">
              <NumberInput value={value.waterLiters} min={0} suffix="L" onChange={(v) => set({ waterLiters: v })} />
            </Field>
          )}
          {!hideWaste && (
            <Field label="Água" hint="litros por lote (lavagem, preparo)">
              <NumberInput value={value.waterLiters} min={0} suffix="L" onChange={(v) => set({ waterLiters: v })} />
            </Field>
          )}
        </div>
      </Panel>

      <Panel title="Ingredientes" icon={<Wheat size={15} />} summary={`${value.ingredients.length} itens · ${money(ingTotal)}/lote`}>
        {ctx.ingredients.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhum ingrediente cadastrado.{' '}
            <Link to="/ingredientes" className="font-medium text-pink hover:underline">
              Cadastrar ingredientes
            </Link>
          </p>
        ) : (
          <>
            <ul className="divide-y divide-divider rounded-lg border border-line">
              <AnimatePresence initial={false}>
                {value.ingredients.map((l, idx) => {
                  const ing = ingMap.get(l.ingredientId);
                  const units: Unit[] = ing ? compatibleUnits(ing.unit) : ['g'];
                  const cost = ing ? toBase(l.qty, l.unit) * ingredientPricePerBase(ing) : 0;
                  const update = (patch: Partial<typeof l>) => set({ ingredients: value.ingredients.map((x, i) => (i === idx ? { ...x, ...patch } : x)) });
                  return (
                    <motion.li key={`${l.ingredientId}-${idx}`} {...rowAnim} className="overflow-hidden">
                      <div className="grid grid-cols-[1fr_auto] items-center gap-2 p-2 sm:grid-cols-[1fr_110px_80px_90px_auto]">
                        <Select
                          aria-label="Ingrediente"
                          value={l.ingredientId}
                          onChange={(e) => {
                            const ni = ingMap.get(e.target.value);
                            update({ ingredientId: e.target.value, unit: ni ? (compatibleUnits(ni.unit).includes(l.unit) ? l.unit : compatibleUnits(ni.unit)[0]) : l.unit });
                          }}
                          className="col-span-1"
                        >
                          {!ing && <option value={l.ingredientId}>(removido)</option>}
                          {ctx.ingredients.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </Select>
                        <IconButton label="Remover ingrediente" onClick={() => set({ ingredients: value.ingredients.filter((_, i) => i !== idx) })} className="sm:order-last">
                          <Trash size={15} />
                        </IconButton>
                        <NumberInput aria-label="Quantidade" value={l.qty} min={0} onChange={(v) => update({ qty: v })} />
                        <Select aria-label="Unidade" value={l.unit} onChange={(e) => update({ unit: e.target.value as Unit })}>
                          {units.map((u) => (
                            <option key={u} value={u}>
                              {UNIT_LABEL[u]}
                            </option>
                          ))}
                        </Select>
                        <span className={cx('text-right text-sm font-medium tabular', ing && ingredientPricePerBase(ing) <= 0 ? 'text-warn' : 'text-ink')}>{money(cost)}</span>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
            <AddRow
              label="Adicionar ingrediente"
              options={ctx.ingredients.map((i) => ({ id: i.id, name: i.name }))}
              onAdd={(id) => {
                const i = ingMap.get(id)!;
                set({ ingredients: [...value.ingredients, { ingredientId: id, qty: 0, unit: compatibleUnits(i.unit)[0] }] });
              }}
            />
          </>
        )}
      </Panel>

      <Panel title="Embalagens, adesivos e materiais" icon={<Package size={15} />} summary={`${value.materials.length} itens · ${money(matPerUnit)}`}>
        {ctx.materials.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhum material cadastrado.{' '}
            <Link to="/materiais" className="font-medium text-pink hover:underline">
              Cadastrar embalagens e adesivos
            </Link>
          </p>
        ) : (
          <>
            <ul className="divide-y divide-divider rounded-lg border border-line">
              <AnimatePresence initial={false}>
                {value.materials.map((l, idx) => {
                  const m = matMap.get(l.materialId);
                  const update = (patch: Partial<typeof l>) => set({ materials: value.materials.map((x, i) => (i === idx ? { ...x, ...patch } : x)) });
                  return (
                    <motion.li key={`${l.materialId}-${idx}`} {...rowAnim} className="overflow-hidden">
                      <div className="grid grid-cols-[1fr_auto] items-center gap-2 p-2 sm:grid-cols-[1fr_90px_130px_90px_auto]">
                        <Select aria-label="Material" value={l.materialId} onChange={(e) => update({ materialId: e.target.value })}>
                          {!m && <option value={l.materialId}>(removido)</option>}
                          {ctx.materials.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name}
                            </option>
                          ))}
                        </Select>
                        <IconButton label="Remover material" onClick={() => set({ materials: value.materials.filter((_, i) => i !== idx) })} className="sm:order-last">
                          <Trash size={15} />
                        </IconButton>
                        <NumberInput aria-label="Quantidade" value={l.qty} min={0} suffix="un" onChange={(v) => update({ qty: v })} />
                        <Select aria-label="Aplicação" value={l.per} onChange={(e) => update({ per: e.target.value as 'unit' | 'batch' })}>
                          <option value="unit">por unidade</option>
                          <option value="batch">por lote</option>
                        </Select>
                        <span className="text-right text-sm font-medium tabular">{money(m ? l.qty * materialUnitPrice(m) : 0)}</span>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
            <AddRow
              label="Adicionar material"
              options={ctx.materials.map((m) => ({ id: m.id, name: `${m.name} · ${m.kind}` }))}
              onAdd={(id) => set({ materials: [...value.materials, { materialId: id, qty: 1, per: 'unit' }] })}
            />
          </>
        )}
      </Panel>

      <Panel title="Equipamentos" icon={<Flame size={15} />} summary={`${value.equipment.length} em uso`} defaultOpen={value.equipment.length > 0}>
        {eqs.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhum equipamento cadastrado.{' '}
            <Link to="/custos" className="font-medium text-pink hover:underline">
              Cadastrar em Custos operacionais
            </Link>
          </p>
        ) : (
          <>
            <ul className="divide-y divide-divider rounded-lg border border-line">
              <AnimatePresence initial={false}>
                {value.equipment.map((l, idx) => (
                  <motion.li key={`${l.equipmentId}-${idx}`} {...rowAnim} className="overflow-hidden">
                    <div className="grid grid-cols-[1fr_120px_auto] items-center gap-2 p-2">
                      <Select aria-label="Equipamento" value={l.equipmentId} onChange={(e) => set({ equipment: value.equipment.map((x, i) => (i === idx ? { ...x, equipmentId: e.target.value } : x)) })}>
                        {eqs.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name} ({e.source === 'gas' ? 'gás' : 'elétrico'})
                          </option>
                        ))}
                      </Select>
                      <NumberInput aria-label="Minutos por lote" value={l.minutes} min={0} suffix="min" onChange={(v) => set({ equipment: value.equipment.map((x, i) => (i === idx ? { ...x, minutes: v } : x)) })} />
                      <IconButton label="Remover equipamento" onClick={() => set({ equipment: value.equipment.filter((_, i) => i !== idx) })}>
                        <Trash size={15} />
                      </IconButton>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            <AddRow label="Adicionar equipamento" options={eqs.map((e) => ({ id: e.id, name: e.name }))} onAdd={(id) => set({ equipment: [...value.equipment, { equipmentId: id, minutes: 30 }] })} />
          </>
        )}
      </Panel>

      <Panel title="Outros custos do lote" icon={<Wrench size={15} />} summary={money(value.otherCosts.reduce((a, o) => a + o.value, 0))} defaultOpen={value.otherCosts.length > 0}>
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {value.otherCosts.map((o) => (
              <motion.li key={o.id} {...rowAnim} className="overflow-hidden">
                <div className="grid grid-cols-[1fr_130px_auto] items-center gap-2">
                  <TextInput aria-label="Descrição" value={o.name} placeholder="Ex.: frete de insumos, topo de bolo" onChange={(e) => set({ otherCosts: value.otherCosts.map((x) => (x.id === o.id ? { ...x, name: e.target.value } : x)) })} />
                  <NumberInput aria-label="Valor por lote" value={o.value} min={0} prefix="R$" onChange={(v) => set({ otherCosts: value.otherCosts.map((x) => (x.id === o.id ? { ...x, value: v } : x)) })} />
                  <IconButton label="Remover custo" onClick={() => set({ otherCosts: value.otherCosts.filter((x) => x.id !== o.id) })}>
                    <Trash size={15} />
                  </IconButton>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <button type="button" onClick={() => set({ otherCosts: [...value.otherCosts, { id: uid(), name: '', value: 0 }] })} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-pink hover:underline">
          <Plus size={15} /> Adicionar custo
        </button>
      </Panel>
    </div>
  );
}

function AddRow({ label, options, onAdd }: { label: string; options: { id: string; name: string }[]; onAdd: (id: string) => void }) {
  return (
    <div className="mt-2">
      <Select
        aria-label={label}
        value=""
        onChange={(e) => {
          if (e.target.value) onAdd(e.target.value);
        }}
        className="h-9 max-w-xs border-dashed text-pink"
      >
        <option value="">+ {label}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
