import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDown, ArrowUp, Plus, Trash } from 'lucide-react';
import { money, uid } from '@cakeboss/domain/format';
import { startingPrice } from '@cakeboss/domain/shop';
import type { OptionGroup, Recipe } from '@cakeboss/domain/types';
import { Button, Field, IconButton, NumberInput, Select, TextInput } from './ui';

const PRESETS: { name: string; required: boolean; max: number; hint: string }[] = [
  { name: 'Tamanho', required: true, max: 1, hint: 'ex.: 15 cm, 20 cm, 25 cm' },
  { name: 'Sabor', required: true, max: 1, hint: 'ex.: Ninho, Nutella' },
  { name: 'Massa', required: true, max: 1, hint: 'ex.: chocolate, baunilha' },
  { name: 'Recheio', required: true, max: 2, hint: 'até 2 recheios' },
  { name: 'Cobertura', required: false, max: 1, hint: 'opcional' },
  { name: 'Adicionais', required: false, max: 3, hint: 'ex.: topo de bolo, vela' },
];

/**
 * Sizes, flavors, fillings… the customer chooses in the store.
 * Each choice adds (or subtracts) a value from the product's official price.
 */
export function OptionsEditor({ recipe, onSave, onCancel }: { recipe: Recipe; onSave: (groups: OptionGroup[]) => void; onCancel: () => void }) {
  const [groups, setGroups] = useState<OptionGroup[]>(() => JSON.parse(JSON.stringify(recipe.storeOptions ?? [])));
  const [error, setError] = useState('');
  const base = recipe.salePrice ?? 0;
  const setGroup = (id: string, p: Partial<OptionGroup>) => setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, ...p } : g)));
  const move = (i: number, d: -1 | 1) =>
    setGroups((gs) => {
      const n = [...gs];
      [n[i], n[i + d]] = [n[i + d], n[i]];
      return n;
    });
  const preview = { ...recipe, storeOptions: groups };
  const maxPrice = groups.reduce((p, g) => p + [...g.choices.map((c) => c.priceDelta)].sort((a, b) => b - a).slice(0, Math.max(1, g.max)).filter((d) => d > 0 || g.required).reduce((a, b) => a + b, 0), base);

  const save = () => {
    const clean = groups
      .map((g) => ({ ...g, name: g.name.trim(), max: Math.max(1, Math.round(g.max)), choices: g.choices.map((c) => ({ ...c, name: c.name.trim() })).filter((c) => c.name) }))
      .filter((g) => g.name || g.choices.length);
    const bad = clean.find((g) => !g.name || !g.choices.length);
    if (bad) return setError(bad.name ? `"${bad.name}" não tem nenhuma opção.` : 'Dê um nome para cada grupo (ex.: Tamanho, Sabor).');
    onSave(clean);
  };

  return (
    <div className="space-y-5 p-5">
      <p className="text-sm text-muted">
        Preço oficial de <b className="text-ink">{recipe.name}</b>: <b className="text-ink">{money(base)}</b> por {recipe.unitLabel}. Cada opção soma (ou desconta) um valor desse preço.
      </p>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Adicionar grupo</div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              title={p.hint}
              onClick={() => setGroups((gs) => [...gs, { id: uid(), name: p.name, required: p.required, max: p.max, choices: [{ id: uid(), name: '', priceDelta: 0 }] }])}
              className="rounded-full border border-line px-3 py-1.5 text-[13px] font-medium hover:border-pink/40 hover:bg-pink-soft hover:text-pink"
            >
              + {p.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setGroups((gs) => [...gs, { id: uid(), name: '', required: false, max: 1, choices: [{ id: uid(), name: '', priceDelta: 0 }] }])}
            className="rounded-full border border-dashed border-line px-3 py-1.5 text-[13px] font-medium text-muted hover:text-ink"
          >
            + Outro
          </button>
        </div>
      </div>

      {groups.length === 0 && <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">Sem opções: o cliente compra o produto do jeito que está, pelo preço oficial.</p>}

      <ul className="space-y-4">
        <AnimatePresence initial={false}>
          {groups.map((g, i) => (
            <motion.li key={g.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20 }} className="rounded-2xl border border-line bg-subtle/50 p-4">
              <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_150px_120px_auto]">
                <TextInput aria-label="Nome do grupo" value={g.name} onChange={(e) => setGroup(g.id, { name: e.target.value })} placeholder="Ex.: Sabor" />
                <div className="flex items-center sm:order-last">
                  <IconButton label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp size={14} />
                  </IconButton>
                  <IconButton label="Descer" disabled={i === groups.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown size={14} />
                  </IconButton>
                  <IconButton label="Excluir grupo" onClick={() => setGroups((gs) => gs.filter((x) => x.id !== g.id))}>
                    <Trash size={14} />
                  </IconButton>
                </div>
                <Select aria-label="Obrigatório" value={g.required ? 'sim' : 'nao'} onChange={(e) => setGroup(g.id, { required: e.target.value === 'sim' })}>
                  <option value="sim">Obrigatório</option>
                  <option value="nao">Opcional</option>
                </Select>
                <Select aria-label="Quantas o cliente escolhe" value={String(g.max)} onChange={(e) => setGroup(g.id, { max: Number(e.target.value) })}>
                  <option value="1">Escolhe 1</option>
                  {[2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      Até {n}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="mt-3 grid grid-cols-[1fr_130px_auto] gap-2 px-1 text-[11px] font-medium text-muted">
                <span>Opção</span>
                <span>Acréscimo (use − para desconto)</span>
              </div>
              <ul className="mt-1 space-y-2">
                {g.choices.map((c) => (
                  <li key={c.id} className="grid grid-cols-[1fr_130px_auto] items-center gap-2">
                    <TextInput
                      aria-label="Opção"
                      value={c.name}
                      placeholder={g.name.toLowerCase().includes('tamanho') ? 'Ex.: 20 cm (serve 15)' : 'Ex.: Ninho com morango'}
                      onChange={(e) => setGroup(g.id, { choices: g.choices.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)) })}
                    />
                    <NumberInput aria-label="Acréscimo" value={c.priceDelta} prefix="R$" onChange={(v) => setGroup(g.id, { choices: g.choices.map((x) => (x.id === c.id ? { ...x, priceDelta: v } : x)) })} />
                    <IconButton label="Remover opção" onClick={() => setGroup(g.id, { choices: g.choices.filter((x) => x.id !== c.id) })}>
                      <Trash size={14} />
                    </IconButton>
                    {g.max <= 1 && c.priceDelta !== 0 && (
                      <span className="col-span-3 -mt-1 text-[11px] text-muted">
                        produto com esta opção: {money(base + c.priceDelta)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setGroup(g.id, { choices: [...g.choices, { id: uid(), name: '', priceDelta: 0 }] })} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-pink hover:underline">
                <Plus size={14} /> Adicionar opção
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {groups.some((g) => g.choices.length) && (
        <Field label="Prévia do preço na loja">
          <div className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
            O cliente vê <b>a partir de {money(startingPrice(preview))}</b>
            {maxPrice > startingPrice(preview) && <> e pode chegar a <b>{money(maxPrice)}</b> com as opções mais caras</>}.
          </div>
        </Field>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-loss-soft px-3 py-2 text-sm text-loss">
          {error}
        </p>
      )}
      <p className="text-xs text-muted">O custo e o lucro do pedido continuam calculados pela ficha técnica do produto. Se um tamanho maior gasta bem mais ingredientes, vale criar uma ficha técnica só para ele.</p>
      <div className="flex justify-end gap-2 border-t border-divider pt-4">
        <Button onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" onClick={save}>
          Salvar opções
        </Button>
      </div>
    </div>
  );
}
