import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Boxes, Droplets, Factory, Flame, Plus, Trash, Users, Zap, Building2, Receipt } from 'lucide-react';
import { parseBackup, useStore } from '../store/store';
import { dateTime, money, moneyFine, number, qtyBase, uid } from '../lib/format';
import { fixedMonthly, fixedPerHour, gasUnitLabel, gasUnitPrice, laborHourly, priceRecipe } from '../lib/pricing';
import type { DB, EnergySource, Settings } from '../lib/types';
import { Badge, Button, Card, CardHeader, EmptyState, Field, IconButton, NumberInput, PageHeader, Segmented, Select, TextInput, cx } from '../components/ui';
import { ConfirmDialog, Drawer, stagger, useToast } from '../components/motion';
import { PurchaseForm, type PurchasePreset } from '../components/PurchaseForm';
import { ShoppingCart } from 'lucide-react';
import { SupportCard } from '../components/SupportCard';
import { MessagesCard } from '../components/MessagesCard';
import { MascotPicker } from '../components/mascot/MascotPicker';

/** Reference average for a domestic oven on a P13 cylinder; always editable. */
const OVEN_GLP_KG_H = 0.225;

/** Edits a copy of the settings and saves explicitly, so nothing changes by accident. */
export function OperatingCostsPage() {
  const { db, updateSettings } = useStore();
  const toast = useToast();
  const [s, setS] = useState<Settings>(() => JSON.parse(JSON.stringify(db.settings)));
  const set = (p: Partial<Settings>) => setS((x) => ({ ...x, ...p }));
  const dirty = JSON.stringify(s) !== JSON.stringify(db.settings);
  const save = () => {
    // theme may have been toggled from the sidebar meanwhile
    updateSettings({ ...s, theme: db.settings.theme }, 'Custos operacionais atualizados');
    toast('Custos operacionais salvos');
  };

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show">
      <PageHeader
        title="Custos operacionais"
        subtitle="Tarifas, mão de obra, custos fixos e taxas de venda usados em todas as precificações."
        actions={
          <Button variant="primary" onClick={save} disabled={!dirty}>
            {dirty ? 'Salvar alterações' : 'Salvo'}
          </Button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <motion.div variants={stagger.item}>
          <Card className="h-full">
            <CardHeader
              icon={<Flame size={16} />}
              title="Gás"
              subtitle="Como você paga o gás? O custo entra pelo tempo de uso de cada equipamento a gás."
            />
            <div className="space-y-4 p-5">
              <Segmented
                value={s.gasMode}
                onChange={(v) => set({ gasMode: v })}
                options={[
                  { value: 'botijao', label: 'Botijão' },
                  { value: 'encanado', label: 'Gás encanado (boleto)' },
                ]}
              />
              {s.gasMode === 'botijao' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Preço pago no botijão">
                    <NumberInput value={s.gasCylinderPrice} min={0} prefix="R$" onChange={(v) => set({ gasCylinderPrice: v })} />
                  </Field>
                  <Field label="Tamanho do botijão">
                    <Select value={String(s.gasCylinderKg)} onChange={(e) => set({ gasCylinderKg: Number(e.target.value) })}>
                      {[2, 5, 8, 13, 20, 45].map((kg) => (
                        <option key={kg} value={kg}>
                          P{kg} · {kg} kg
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Valor do gás no boleto">
                    <NumberInput value={s.gasBillValue} min={0} prefix="R$" onChange={(v) => set({ gasBillValue: v })} />
                  </Field>
                  <Field label="Consumo no boleto">
                    <NumberInput value={s.gasBillConsumption} min={0} onChange={(v) => set({ gasBillConsumption: v })} />
                  </Field>
                  <Field label="Unidade do boleto">
                    <Select value={s.gasBillUnit} onChange={(e) => set({ gasBillUnit: e.target.value as 'm3' | 'kg' })}>
                      <option value="m3">m³</option>
                      <option value="kg">kg</option>
                    </Select>
                  </Field>
                  <p className="text-xs text-muted sm:col-span-3">Use o valor e o consumo do mesmo mês, como aparecem no boleto do condomínio ou da distribuidora.</p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-line bg-subtle px-4 py-3 text-sm">
                <span>
                  Custo do gás: <b className="tabular">{gasUnitPrice(s) > 0 ? `${moneyFine(gasUnitPrice(s))} por ${gasUnitLabel(s)}` : 'não informado'}</b>
                </span>
                {s.gasMode === 'botijao' && s.gasCylinderPrice > 0 && (
                  <span className="text-xs text-muted">
                    Forno a {OVEN_GLP_KG_H.toLocaleString('pt-BR')} kg/h: o botijão dura ≈ {number(s.gasCylinderKg / OVEN_GLP_KG_H)} h e cada hora custa ≈ {money(OVEN_GLP_KG_H * gasUnitPrice(s))}
                  </span>
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={stagger.item}>
          <Card className="h-full">
            <CardHeader icon={<Zap size={16} />} title="Energia e água" subtitle="Tarifas das contas de luz e de água." />
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              <Field label="Energia (R$/kWh)" hint="veja na conta de luz">
                <NumberInput value={s.energyPricePerKwh} min={0} prefix="R$" onChange={(v) => set({ energyPricePerKwh: v })} />
              </Field>
              <Field label="Água (R$/m³)" hint="veja na conta de água">
                <NumberInput value={s.waterPricePerM3} min={0} prefix="R$" onChange={(v) => set({ waterPricePerM3: v })} />
              </Field>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={stagger.item}>
          <Card className="h-full">
            <CardHeader icon={<Users size={16} />} title="Mão de obra" subtitle="Quanto vale a sua hora de trabalho na produção." />
            <div className="grid gap-3 p-5 sm:grid-cols-3">
              <Field label="Retirada mensal desejada">
                <NumberInput value={s.laborMonthly} min={0} prefix="R$" onChange={(v) => set({ laborMonthly: v })} />
              </Field>
              <Field label="Horas trabalhadas/mês">
                <NumberInput value={s.laborHoursMonth} min={0} suffix="h" onChange={(v) => set({ laborHoursMonth: v })} />
              </Field>
              <div className="rounded-lg border border-line bg-subtle px-3 py-2">
                <div className="text-xs text-muted">Valor da hora</div>
                <div className="text-lg font-semibold tabular">{laborHourly(s) > 0 ? money(laborHourly(s)) : '—'}</div>
              </div>
              <p className="text-xs text-muted sm:col-span-3">Não inclua esse valor também nos custos fixos — ele já entra em cada produto pelo tempo de preparo.</p>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={stagger.item}>
          <Card className="h-full">
            <CardHeader icon={<Building2 size={16} />} title="Custos fixos mensais" subtitle="Rateados por hora de produção." />
            <div className="p-5">
              <ul className="space-y-2">
                {s.fixedCosts.map((f) => (
                  <li key={f.id} className="grid grid-cols-[1fr_140px_auto] gap-2">
                    <TextInput aria-label="Descrição" value={f.name} placeholder="Ex.: aluguel, internet, MEI" onChange={(e) => set({ fixedCosts: s.fixedCosts.map((x) => (x.id === f.id ? { ...x, name: e.target.value } : x)) })} />
                    <NumberInput aria-label="Valor mensal" value={f.monthly} min={0} prefix="R$" onChange={(v) => set({ fixedCosts: s.fixedCosts.map((x) => (x.id === f.id ? { ...x, monthly: v } : x)) })} />
                    <IconButton label="Remover" onClick={() => set({ fixedCosts: s.fixedCosts.filter((x) => x.id !== f.id) })}>
                      <Trash size={15} />
                    </IconButton>
                  </li>
                ))}
              </ul>
              <button type="button" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-pink hover:underline" onClick={() => set({ fixedCosts: [...s.fixedCosts, { id: uid(), name: '', monthly: 0 }] })}>
                <Plus size={15} /> Adicionar custo fixo
              </button>
              <div className="mt-4 grid gap-3 border-t border-divider pt-4 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-muted">Total mensal</div>
                  <div className="font-semibold tabular">{money(fixedMonthly(s))}</div>
                </div>
                <Field label="Horas produtivas/mês">
                  <NumberInput value={s.productiveHoursMonth} min={0} suffix="h" onChange={(v) => set({ productiveHoursMonth: v })} />
                </Field>
                <div>
                  <div className="text-xs text-muted">Rateio por hora</div>
                  <div className="font-semibold tabular">{fixedPerHour(s) > 0 ? moneyFine(fixedPerHour(s)) : '—'}</div>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted">Não inclua gás, energia e água consumidos na produção: eles já são calculados pelos equipamentos.</p>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={stagger.item}>
          <Card className="h-full">
            <CardHeader icon={<Receipt size={16} />} title="Despesas de venda" subtitle="Percentuais descontados do preço em cada venda." />
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              <Field label="Taxa de cartão / maquininha">
                <NumberInput value={s.cardFeePct} min={0} max={30} suffix="%" onChange={(v) => set({ cardFeePct: v })} />
              </Field>
              <Field label="Comissões (apps, revenda)">
                <NumberInput value={s.commissionPct} min={0} max={50} suffix="%" onChange={(v) => set({ commissionPct: v })} />
              </Field>
              <Field label="Impostos sobre a venda" hint="Ex.: Simples Nacional. MEI paga valor fixo — lance em custos fixos.">
                <NumberInput value={s.taxPct} min={0} max={50} suffix="%" onChange={(v) => set({ taxPct: v })} />
              </Field>
              <Field label="Margem de lucro padrão">
                <NumberInput value={s.defaultMarginPct} min={0} max={95} suffix="%" onChange={(v) => set({ defaultMarginPct: v })} />
              </Field>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={stagger.item} className="lg:col-span-2">
          <Card>
            <CardHeader icon={<Zap size={16} />} title="Equipamentos" subtitle="Consumo usado para calcular gás e energia por minuto de uso." />
            <div className="p-5">
              {s.equipment.length === 0 && <p className="mb-3 text-sm text-muted">Cadastre forno, fogão, batedeira, freezer… com o consumo informado pelo fabricante.</p>}
              <ul className="space-y-2">
                {s.equipment.map((e) => (
                  <li key={e.id} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_160px_160px_auto]">
                    <TextInput aria-label="Nome" value={e.name} className="col-span-2 sm:col-span-1" placeholder="Ex.: Forno de embutir" onChange={(ev) => set({ equipment: s.equipment.map((x) => (x.id === e.id ? { ...x, name: ev.target.value } : x)) })} />
                    <Select aria-label="Fonte" value={e.source} onChange={(ev) => set({ equipment: s.equipment.map((x) => (x.id === e.id ? { ...x, source: ev.target.value as EnergySource } : x)) })}>
                      <option value="gas">Gás</option>
                      <option value="energia">Energia elétrica</option>
                    </Select>
                    <NumberInput
                      aria-label="Consumo"
                      value={e.consumption}
                      min={0}
                      suffix={e.source === 'gas' ? `${gasUnitLabel(s)}/h` : 'kW'}
                      onChange={(v) => set({ equipment: s.equipment.map((x) => (x.id === e.id ? { ...x, consumption: v } : x)) })}
                    />
                    <IconButton label="Remover" onClick={() => set({ equipment: s.equipment.filter((x) => x.id !== e.id) })}>
                      <Trash size={15} />
                    </IconButton>
                  </li>
                ))}
              </ul>
              <button type="button" className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-pink hover:underline" onClick={() => set({ equipment: [...s.equipment, { id: uid(), name: '', source: 'gas', consumption: gasUnitLabel(s) === 'kg' ? OVEN_GLP_KG_H : 0 }] })}>
                <Plus size={15} /> Adicionar equipamento
              </button>
              <div className="mt-3 space-y-1 text-xs text-muted">
                <p>
                  Equipamentos a gás: consumo em {gasUnitLabel(s)} por hora. Referência: forno doméstico ≈ {OVEN_GLP_KG_H.toLocaleString('pt-BR')} kg/h de gás de botijão (já vem preenchido). Para valores exatos, veja o manual.
                </p>
                {gasUnitLabel(s) !== gasUnitLabel(db.settings) && s.equipment.some((e) => e.source === 'gas') && (
                  <p className="font-medium text-warn">Você mudou a unidade do gás para {gasUnitLabel(s)}: revise o consumo dos equipamentos a gás antes de salvar.</p>
                )}
                <p className="flex items-center gap-1.5">
                  <Droplets size={13} /> A água é informada em litros por lote em cada ficha técnica.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function ProductionsPage() {
  const { db, ctx, registerProduction, deleteProduction } = useStore();
  const toast = useToast();
  const [recipeId, setRecipeId] = useState(db.recipes[0]?.id ?? '');
  const [qty, setQty] = useState(db.recipes[0]?.yield ?? 1);
  const [deduct, setDeduct] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [del, setDel] = useState<string | null>(null);
  const recipe = db.recipes.find((r) => r.id === recipeId);
  const preview = useMemo(() => (recipe ? priceRecipe({ ...recipe, yield: recipe.yield }, ctx) : null), [recipe, ctx]);

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show">
      <PageHeader title="Produções" subtitle="Registre o que foi produzido. O custo do momento fica guardado como histórico e o estoque pode ser baixado." />
      <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <motion.div variants={stagger.item}>
          <Card>
            <CardHeader icon={<Factory size={16} />} title="Registrar produção" />
            {db.recipes.length === 0 ? (
              <p className="p-5 text-sm text-muted">
                Crie uma{' '}
                <Link className="font-medium text-pink hover:underline" to="/fichas/nova">
                  ficha técnica
                </Link>{' '}
                primeiro.
              </p>
            ) : (
              <div className="space-y-4 p-5">
                <Field label="Produto">
                  <Select
                    value={recipeId}
                    onChange={(e) => {
                      setRecipeId(e.target.value);
                      setQty(db.recipes.find((r) => r.id === e.target.value)?.yield ?? 1);
                    }}
                  >
                    {db.recipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={`Quantidade produzida (${recipe?.unitLabel ?? 'un'})`}>
                  <NumberInput value={qty} min={0} onChange={setQty} />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={deduct} onChange={(e) => setDeduct(e.target.checked)} className="h-4 w-4 accent-pink-600" />
                  Baixar ingredientes e materiais do estoque
                </label>
                {preview && <p className="text-xs text-muted">Custo atual por {recipe?.unitLabel}: {money(preview.unitCost)}</p>}
                <Button variant="primary" className="w-full" disabled={!(qty > 0)} onClick={() => setConfirm(true)}>
                  Confirmar produção
                </Button>
              </div>
            )}
          </Card>
        </motion.div>
        <motion.div variants={stagger.item}>
          <Card>
            <CardHeader title="Histórico de produções" subtitle="Custos gravados no momento da confirmação." />
            {db.productions.length === 0 ? (
              <EmptyState icon={<Factory size={22} />} title="Nenhuma produção registrada" text="As produções confirmadas aparecem aqui com o custo da época." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-subtle/70 text-left text-xs text-muted">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Data</th>
                      <th className="px-3 py-2.5 font-medium">Produto</th>
                      <th className="px-3 py-2.5 text-right font-medium">Qtd.</th>
                      <th className="px-3 py-2.5 text-right font-medium">Custo total</th>
                      <th className="px-3 py-2.5 text-right font-medium">Custo un.</th>
                      <th className="w-12 px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {db.productions.map((p) => (
                      <tr key={p.id}>
                        <td className="px-5 py-3 text-muted">{dateTime(p.date)}</td>
                        <td className="px-3 py-3 font-medium">
                          {p.recipeName} {p.stockDeducted && <Badge tone="gray">estoque baixado</Badge>}
                        </td>
                        <td className="px-3 py-3 text-right tabular">{number(p.quantity)}</td>
                        <td className="px-3 py-3 text-right tabular">{money(p.cost.totalCost)}</td>
                        <td className="px-3 py-3 text-right tabular">{money(p.cost.unitCost)}</td>
                        <td className="px-3 py-3">
                          <IconButton label="Remover registro" onClick={() => setDel(p.id)}>
                            <Trash size={15} />
                          </IconButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Confirmar produção?"
        onConfirm={() => {
          const p = registerProduction(recipeId, qty, deduct);
          if (p) toast(`Produção registrada · custo ${money(p.cost.totalCost)}`);
        }}
      >
        Registrar <b>{number(qty)} {recipe?.unitLabel}</b> de <b>{recipe?.name}</b>. O custo atual será gravado no histórico{deduct ? ' e o estoque será baixado' : ''}.
      </ConfirmDialog>
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        danger
        title="Remover registro?"
        confirmLabel="Remover"
        onConfirm={() => {
          if (del) deleteProduction(del);
          toast('Registro removido');
        }}
      >
        O registro sai do histórico. Se o estoque foi baixado, ele <b>não</b> é devolvido automaticamente — ajuste em Ingredientes/Materiais se necessário.
      </ConfirmDialog>
    </motion.div>
  );
}

export function StockPage() {
  const { db } = useStore();
  const [buy, setBuy] = useState<PurchasePreset | null>(null);
  const items = [
    ...db.ingredients.map((i) => ({ id: i.id, buyKind: 'ingrediente' as const, name: i.name, kind: 'Ingrediente', stock: i.stock, min: i.minStock, label: qtyBase(i.stock, i.unit), minLabel: qtyBase(i.minStock, i.unit), to: '/ingredientes' })),
    ...db.materials.map((m) => ({ id: m.id, buyKind: 'material' as const, name: m.name, kind: m.kind === 'adesivo' ? 'Adesivo' : m.kind === 'embalagem' ? 'Embalagem' : 'Material', stock: m.stock, min: m.minStock, label: `${number(m.stock)} un`, minLabel: `${number(m.minStock)} un`, to: '/materiais' })),
  ]
    .map((x) => ({ ...x, ratio: x.min > 0 ? x.stock / x.min : Infinity }))
    .sort((a, b) => a.ratio - b.ratio);

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show">
      <PageHeader
        title="Estoque"
        subtitle="Ordenado pelos itens mais perto de acabar. Compras somam ao estoque; pedidos em produção e produções registradas descontam."
        actions={
          <Button variant="primary" onClick={() => setBuy({ kind: 'ingrediente' })}>
            <ShoppingCart size={16} /> Registrar compra
          </Button>
        }
      />
      <motion.div variants={stagger.item}>
        <Card>
          {items.length === 0 ? (
            <EmptyState icon={<Boxes size={22} />} title="Nada em estoque" text="Cadastre ingredientes e materiais para acompanhar o estoque." />
          ) : (
            <ul className="divide-y divide-divider">
              {items.map((x) => {
                const low = x.min > 0 && x.stock <= x.min;
                const pctBar = x.min > 0 ? Math.min(100, (x.stock / (x.min * 2)) * 100) : 100;
                return (
                  <li key={x.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-5 py-3 sm:grid-cols-[1fr_200px_140px_auto]">
                    <div className="min-w-0">
                      <Link to={x.to} className="truncate font-medium hover:text-pink">
                        {x.name}
                      </Link>
                      <div className="text-xs text-muted">{x.kind}{x.min > 0 ? ` · mínimo ${x.minLabel}` : ' · sem mínimo definido'}</div>
                    </div>
                    <div className="hidden h-2 overflow-hidden rounded-full bg-divider sm:block">
                      <motion.div className={cx('h-full rounded-full', x.stock <= 0 ? 'bg-loss' : low ? 'bg-warn' : 'bg-profit')} initial={{ width: 0 }} animate={{ width: `${Math.max(0, pctBar)}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
                    </div>
                    <div className={cx('text-right text-sm font-semibold tabular', x.stock <= 0 ? 'text-loss' : low ? 'text-warn' : 'text-ink')}>
                      {x.stock < 0 ? `faltam ${x.label.replace('-', '')}` : x.label}
                    </div>
                    <IconButton label="Registrar compra" onClick={() => setBuy({ kind: x.buyKind, itemId: x.id })}>
                      <ShoppingCart size={15} />
                    </IconButton>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </motion.div>
      <Drawer open={!!buy} onClose={() => setBuy(null)} title="Registrar compra" width="max-w-lg">
        {buy && <PurchaseForm preset={buy} onDone={() => setBuy(null)} />}
      </Drawer>
    </motion.div>
  );
}

export function HistoryPage() {
  const { db } = useStore();
  const tone = { preco: 'pink', ficha: 'lilac', insumo: 'amber', producao: 'green', simulacao: 'gray', config: 'gray', sistema: 'gray', pedido: 'lilac', financeiro: 'green' } as const;
  const label = { preco: 'Preço', ficha: 'Ficha', insumo: 'Insumo', producao: 'Produção', simulacao: 'Simulação', config: 'Configuração', sistema: 'Sistema', pedido: 'Pedido', financeiro: 'Financeiro' };
  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show">
      <PageHeader title="Histórico" subtitle="Registro das alterações importantes: preços, fichas, insumos e produções." />
      <motion.div variants={stagger.item}>
        <Card>
          {db.history.length === 0 ? (
            <EmptyState icon={<Receipt size={22} />} title="Sem registros" text="As alterações aparecem aqui assim que forem feitas." />
          ) : (
            <ul className="divide-y divide-divider">
              {db.history.map((h) => (
                <li key={h.id} className="flex gap-3 px-5 py-3">
                  <Badge tone={tone[h.type]} className="mt-0.5 w-24 justify-center">
                    {label[h.type]}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">{h.message}</div>
                    {h.detail && <div className="text-xs text-muted">{h.detail}</div>}
                  </div>
                  <span className="shrink-0 text-xs text-muted">{dateTime(h.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}

export function SettingsPage() {
  const { db, updateSettings, loadSample, clearSample, restoreBackup } = useStore();
  const toast = useToast();
  const [name, setName] = useState(db.settings.businessName);
  const [owner, setOwner] = useState(db.settings.ownerName);
  const [removeSample, setRemoveSample] = useState(false);
  const [pending, setPending] = useState<{ data: DB; file: string } | null>(null);
  const hasSample = db.recipes.some((r) => r.sample) || db.ingredients.some((i) => i.sample) || db.materials.some((m) => m.sample);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `docegestao-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show">
      <PageHeader title="Configurações" subtitle="Dados do negócio, aparência, mensagens do WhatsApp e suporte." />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-5">
          <motion.div variants={stagger.item}>
            <Card>
              <CardHeader title="Negócio" />
              <form
                className="grid gap-3 p-5 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  updateSettings({ businessName: name.trim(), ownerName: owner.trim() }, 'Dados do negócio atualizados');
                  toast('Dados salvos');
                }}
              >
                <Field label="Nome da confeitaria">
                  <TextInput value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Seu nome" hint="Usado na saudação do dashboard">
                  <TextInput value={owner} onChange={(e) => setOwner(e.target.value)} />
                </Field>
                <div className="sm:col-span-2">
                  <Button type="submit" variant="primary" disabled={name === db.settings.businessName && owner === db.settings.ownerName}>
                    Salvar
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
          <motion.div variants={stagger.item}>
            <Card>
              <CardHeader title="Aparência" />
              <div className="flex items-center justify-between gap-4 p-5">
                <div>
                  <div className="text-sm font-medium">Tema</div>
                  <div className="text-xs text-muted">O sistema abre no tema claro por padrão.</div>
                </div>
                <div className="inline-flex rounded-lg border border-line bg-subtle p-0.5">
                  {(['light', 'dark'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => updateSettings({ theme: t })}
                      className={cx('h-8 rounded-md px-3 text-[13px] font-medium', db.settings.theme === t ? 'border border-line bg-surface text-ink shadow-sm' : 'text-muted')}
                    >
                      {t === 'light' ? 'Claro' : 'Escuro'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-divider p-5">
                <div>
                  <div className="text-sm font-medium">Mascote Docinho 🧁</div>
                  <div className="text-xs text-muted">Dá avisos e dicas e passeia só pelos espaços vazios da tela.</div>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={db.settings.mascotEnabled !== false}
                    onChange={(e) => updateSettings({ mascotEnabled: e.target.checked })}
                    aria-label="Mostrar mascote"
                  />
                  <span className="h-6 w-11 rounded-full bg-divider transition-colors peer-checked:bg-pink peer-focus-visible:ring-2 peer-focus-visible:ring-pink/40" />
                  <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                </label>
              </div>
              {db.settings.mascotEnabled !== false && <MascotPicker />}
            </Card>
          </motion.div>
          <motion.div variants={stagger.item}>
            <Card>
              <CardHeader title="Dados" subtitle="Os dados ficam salvos neste navegador. Faça backups com frequência." />
              <div className="divide-y divide-divider">
                <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-medium">Dados de exemplo</div>
                    <div className="text-xs text-muted">Produtos e insumos fictícios para conhecer o sistema, marcados como “exemplo”.</div>
                  </div>
                  {hasSample ? (
                    <Button variant="danger" onClick={() => setRemoveSample(true)}>
                      Remover exemplos
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        loadSample();
                        toast('Dados de exemplo carregados');
                      }}
                    >
                      Carregar exemplos
                    </Button>
                  )}
                </div>
                <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-medium">Backup</div>
                    <div className="text-xs text-muted">Exporte um arquivo .json com tudo e guarde em local seguro. Para restaurar, importe o arquivo.</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={exportData}>Exportar backup</Button>
                    <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-subtle focus-within:ring-2 focus-within:ring-pink/40">
                      Importar backup
                      <input
                        type="file"
                        accept="application/json,.json"
                        className="sr-only"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (!f) return;
                          const r = parseBackup(await f.text());
                          if (!r.ok) return toast(r.error, 'error');
                          setPending({ data: r.data, file: f.name });
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
          <motion.div variants={stagger.item}>
            <SupportCard />
          </motion.div>
        </div>
        <div className="space-y-5">
          <motion.div variants={stagger.item}>
            <MessagesCard />
          </motion.div>
        </div>
      </div>
      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        danger
        title="Restaurar este backup?"
        confirmLabel="Substituir e restaurar"
        onConfirm={() => {
          if (!pending) return;
          restoreBackup(pending.data);
          toast('Backup restaurado');
        }}
      >
        {pending && (
          <>
            <p>
              O arquivo <b>{pending.file}</b> tem {pending.data.recipes.length} fichas, {pending.data.ingredients.length} ingredientes, {pending.data.orders.length} pedidos e {pending.data.customers.length} clientes.
            </p>
            <p className="mt-2">
              <b>Todos os dados atuais deste navegador serão substituídos</b> por ele. Se quiser guardar os atuais, clique em Cancelar e exporte um backup antes.
            </p>
          </>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={removeSample}
        onClose={() => setRemoveSample(false)}
        danger
        title="Remover dados de exemplo?"
        confirmLabel="Remover exemplos"
        onConfirm={() => {
          clearSample();
          toast('Dados de exemplo removidos');
        }}
      >
        Saem os ingredientes, materiais e fichas marcados como “exemplo”. Seus próprios cadastros continuam. Se alguma ficha sua usa um ingrediente de exemplo, cadastre-o antes, senão a ficha ficará sem ele.
      </ConfirmDialog>
    </motion.div>
  );
}
