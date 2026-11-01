import { useState } from 'react';
import { Pause, Pencil, Play, Plus, Tag, Trash } from 'lucide-react';
import { useStore } from '../store/store';
import { money, nowIso, uid } from '../lib/format';
import { priceRecipe } from '../lib/pricing';
import { applyPromotion, promotionLabel, promotionState, type PromotionState } from '../lib/promotions';
import { storeProducts, storeSettings } from '../lib/shop';
import type { Promotion } from '../lib/types';
import { Badge, Button, Card, CardHeader, Field, IconButton, NumberInput, Segmented, TextInput, cx } from './ui';
import { ConfirmDialog, Drawer, useToast } from './motion';

const STATE_TONE: Record<PromotionState, 'green' | 'lilac' | 'gray' | 'amber'> = { ativa: 'green', agendada: 'lilac', encerrada: 'gray', pausada: 'amber' };

const blank = (): Promotion => ({ id: uid(), name: '', kind: 'percent', value: 10, recipeIds: [], startsOn: null, endsOn: null, active: true, createdAt: nowIso() });

/** Promotions are saved on their own, like the built cakes, so they never mix with unsaved store settings. */
export function PromotionsCard() {
  const { db, ctx, updateSettings } = useStore();
  const toast = useToast();
  const st = storeSettings(db.settings);
  const promos = st.promotions ?? [];
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [removing, setRemoving] = useState<Promotion | null>(null);

  const write = (list: Promotion[], message: string) => updateSettings({ store: { ...storeSettings(db.settings), promotions: list } }, message);
  const save = (p: Promotion) => {
    const exists = promos.some((x) => x.id === p.id);
    write(exists ? promos.map((x) => (x.id === p.id ? p : x)) : [p, ...promos], exists ? `Promoção atualizada: ${p.name}` : `Promoção criada: ${p.name}`);
    toast('Promoção salva');
    setEditing(null);
  };

  return (
    <Card>
      <CardHeader
        icon={<Tag size={16} />}
        title="Promoções"
        subtitle="Escolha os produtos e o desconto. A loja mostra o preço antigo riscado e cobra o preço da promoção."
        actions={
          <Button size="sm" variant="primary" onClick={() => setEditing(blank())}>
            <Plus size={14} /> Nova promoção
          </Button>
        }
      />
      {promos.length === 0 ? (
        <p className="p-5 text-sm text-muted">Nenhuma promoção ainda. Crie uma para destacar produtos com desconto, por um período ou até você pausar.</p>
      ) : (
        <ul className="divide-y divide-divider">
          {promos.map((p) => {
            const state = promotionState(p);
            const names = db.recipes.filter((r) => p.recipeIds.includes(r.id)).map((r) => r.name);
            return (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                    <Badge tone={STATE_TONE[state]}>{state}</Badge>
                    <span className="text-sm text-pink">{promotionLabel(p)}</span>
                  </div>
                  <div className="truncate text-xs text-muted">
                    {names.length ? names.join(', ') : 'sem produtos'}
                    {(p.startsOn || p.endsOn) && ` · ${p.startsOn ? p.startsOn.split('-').reverse().join('/') : 'agora'} até ${p.endsOn ? p.endsOn.split('-').reverse().join('/') : 'pausar'}`}
                  </div>
                </div>
                <IconButton label={p.active ? 'Pausar' : 'Retomar'} onClick={() => write(promos.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)), `${p.active ? 'Promoção pausada' : 'Promoção retomada'}: ${p.name}`)}>
                  {p.active ? <Pause size={15} /> : <Play size={15} />}
                </IconButton>
                <IconButton label="Editar" onClick={() => setEditing(JSON.parse(JSON.stringify(p)))}>
                  <Pencil size={15} />
                </IconButton>
                <IconButton label="Excluir" onClick={() => setRemoving(p)}>
                  <Trash size={15} />
                </IconButton>
              </li>
            );
          })}
        </ul>
      )}

      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing && promos.some((x) => x.id === editing.id) ? 'Editar promoção' : 'Nova promoção'} width="max-w-xl">
        {editing && <PromotionForm key={editing.id} initial={editing} onCancel={() => setEditing(null)} onSave={save} ctx={ctx} />}
      </Drawer>
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && write(promos.filter((x) => x.id !== removing.id), `Promoção excluída: ${removing.name}`)}
        title="Excluir promoção?"
        confirmLabel="Excluir"
        danger
      >
        A promoção “{removing?.name}” sai da loja na hora. Pedidos já feitos não mudam.
      </ConfirmDialog>
    </Card>
  );
}

function PromotionForm({ initial, onSave, onCancel, ctx }: { initial: Promotion; onSave: (p: Promotion) => void; onCancel: () => void; ctx: ReturnType<typeof useStore>['ctx'] }) {
  const { db } = useStore();
  const [p, setP] = useState<Promotion>(initial);
  const [error, setError] = useState('');
  const products = storeProducts(db.recipes);
  const set = (patch: Partial<Promotion>) => setP((x) => ({ ...x, ...patch }));
  const toggle = (id: string) => set({ recipeIds: p.recipeIds.includes(id) ? p.recipeIds.filter((x) => x !== id) : [...p.recipeIds, id] });

  const submit = () => {
    if (!p.name.trim()) return setError('Dê um nome para a promoção, por exemplo “Semana do brownie”.');
    if (!(p.value > 0) || (p.kind === 'percent' && p.value >= 100)) return setError(p.kind === 'percent' ? 'O desconto precisa ficar entre 1% e 99%.' : 'O desconto precisa ser maior que zero.');
    if (!p.recipeIds.length) return setError('Escolha pelo menos um produto.');
    if (p.startsOn && p.endsOn && p.endsOn < p.startsOn) return setError('A data de fim precisa ser depois do início.');
    onSave({ ...p, name: p.name.trim() });
  };

  return (
    <div className="space-y-5 p-5">
      <Field label="Nome da promoção" hint="Aparece na loja, junto do desconto.">
        <TextInput value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Semana do brownie" maxLength={60} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tipo de desconto">
          <Segmented
            value={p.kind}
            onChange={(kind) => set({ kind })}
            options={[
              { value: 'percent', label: '% do preço' },
              { value: 'off', label: 'R$ por unidade' },
            ]}
          />
        </Field>
        <Field label="Desconto">
          <NumberInput value={p.value} min={0} max={p.kind === 'percent' ? 99 : 10000} prefix={p.kind === 'off' ? 'R$' : undefined} suffix={p.kind === 'percent' ? '%' : undefined} onChange={(value) => set({ value })} />
        </Field>
        <Field label="Começa em" hint="Em branco: já começa.">
          <TextInput type="date" value={p.startsOn ?? ''} onChange={(e) => set({ startsOn: e.target.value || null })} />
        </Field>
        <Field label="Termina em" hint="Em branco: até você pausar.">
          <TextInput type="date" value={p.endsOn ?? ''} onChange={(e) => set({ endsOn: e.target.value || null })} />
        </Field>
      </div>

      <div>
        <div className="mb-2 text-[13px] font-medium">Produtos na promoção</div>
        {products.length === 0 ? (
          <p className="text-sm text-muted">Nenhum produto na loja ainda. Defina preço oficial e deixe o produto visível na loja.</p>
        ) : (
          <ul className="divide-y divide-divider rounded-lg border border-line">
            {products.map((r) => {
              const base = r.salePrice ?? 0;
              const after = applyPromotion(base, p);
              const { unitCost } = priceRecipe(r, ctx);
              const loss = Number.isFinite(unitCost) && after < unitCost;
              const on = p.recipeIds.includes(r.id);
              return (
                <li key={r.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm">
                    <input type="checkbox" checked={on} onChange={() => toggle(r.id)} className="h-4 w-4 accent-[rgb(var(--pink))]" />
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    <span className="tabular text-muted line-through">{money(base)}</span>
                    <span className={cx('tabular font-semibold', loss ? 'text-loss' : 'text-ink')}>{money(after)}</span>
                  </label>
                  {on && loss && <p className="px-10 pb-2 text-xs text-loss">Abaixo do custo ({money(unitCost)} por {r.unitLabel}): cada venda dá prejuízo.</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-loss/25 bg-loss-soft px-3 py-2 text-sm text-loss">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" onClick={submit}>
          Salvar promoção
        </Button>
      </div>
    </div>
  );
}
