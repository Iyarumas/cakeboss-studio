import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useStore } from '../store/store';
import { money, pct, uid } from '../lib/format';
import { cakeQuote } from '../lib/cake';
import { storeSettings } from '../lib/shop';
import type { CakeSelection, OrderItem } from '../lib/types';
import { Button, NumberInput, Select, cx } from './ui';
import { Modal } from './motion';

function Pick({ on, onClick, disabled, children }: { on: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-lg border-2 px-2.5 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        on ? 'border-pink bg-pink-soft/50' : 'border-line hover:border-pink/40',
      )}
    >
      {on && <Check size={12} className="text-pink" />}
      {children}
    </button>
  );
}

/**
 * Builds a birthday cake inside an order/quote (for customers who order by WhatsApp or phone).
 * Shows cost, price and profit; the item keeps its cost and the fichas used for stock.
 */
export function CakeQuoteModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (item: OrderItem) => void }) {
  const { db, ctx } = useStore();
  const cakes = storeSettings(db.settings).cakes ?? [];
  const [cakeId, setCakeId] = useState('');
  const [sel, setSel] = useState<CakeSelection>({ sizeId: '', massaId: '', recheioIds: [] });
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState<number | null>(null); // manual price override
  const cake = cakes.find((c) => c.id === cakeId) ?? cakes[0];

  useEffect(() => {
    if (!open) return;
    setCakeId(cakes[0]?.id ?? '');
    setSel({ sizeId: '', massaId: cakes[0]?.massas.length === 1 ? cakes[0].massas[0].id : '', recheioIds: [] });
    setQty(1);
    setPrice(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const q = useMemo(() => (cake ? cakeQuote(cake, sel, db.recipes, ctx, db.settings) : null), [cake, sel, db.recipes, ctx, db.settings]);
  const ok = !!q && !q.problems.length && q.cost > 0;
  const unit = price ?? q?.price ?? 0;
  const v = (db.settings.cardFeePct + db.settings.commissionPct + db.settings.taxPct) / 100;
  const profit = ok ? unit * (1 - v) - q!.cost : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title="🎂 Montar bolo de aniversário"
      footer={
        cake && (
          <>
            <Button onClick={onClose}>Cancelar</Button>
            <Button
              variant="primary"
              disabled={!ok || !(unit > 0)}
              onClick={() => {
                onAdd({ id: uid(), recipeId: null, name: `${cake.name} (${q!.label})`, qty, unitPrice: Math.round(unit * 100) / 100, unitCost: Math.round(q!.cost * 10000) / 10000, components: q!.components });
                onClose();
              }}
            >
              Adicionar ao pedido
            </Button>
          </>
        )
      }
    >
      {!cake ? (
        <p className="text-sm text-muted">
          Nenhum bolo de aniversário cadastrado ainda. Cadastre em{' '}
          <Link to="/fichas?aba=bolos" className="font-semibold text-pink hover:underline" onClick={onClose}>
            Fichas técnicas → Bolos de aniversário
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-4">
          {cakes.length > 1 && (
            <Select aria-label="Bolo" value={cake.id} onChange={(e) => (setCakeId(e.target.value), setSel({ sizeId: '', massaId: '', recheioIds: [] }), setPrice(null))}>
              {cakes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
          <div>
            <div className="mb-1.5 text-[13px] font-semibold">Tamanho</div>
            <div className="flex flex-wrap gap-1.5">
              {cake.sizes.map((s) => (
                <Pick key={s.id} on={sel.sizeId === s.id} onClick={() => (setSel({ ...sel, sizeId: s.id }), setPrice(null))}>
                  {s.name}
                </Pick>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[13px] font-semibold">Massa</div>
            <div className="flex flex-wrap gap-1.5">
              {cake.massas.map((m) => (
                <Pick key={m.id} on={sel.massaId === m.id} onClick={() => (setSel({ ...sel, massaId: m.id }), setPrice(null))}>
                  {m.name}
                </Pick>
              ))}
            </div>
          </div>
          {cake.recheios.length > 0 && (
            <div>
              <div className="mb-1.5 text-[13px] font-semibold">
                Recheios <span className="font-normal text-muted">até {cake.maxRecheios} · {sel.recheioIds.length + 1} camadas de massa</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cake.recheios.map((r) => {
                  const on = sel.recheioIds.includes(r.id);
                  return (
                    <Pick
                      key={r.id}
                      on={on}
                      disabled={!on && sel.recheioIds.length >= cake.maxRecheios}
                      onClick={() => (setSel({ ...sel, recheioIds: on ? sel.recheioIds.filter((x) => x !== r.id) : [...sel.recheioIds, r.id] }), setPrice(null))}
                    >
                      {r.name}
                    </Pick>
                  );
                })}
              </div>
            </div>
          )}
          {cake.coberturas.length > 0 && (
            <div>
              <div className="mb-1.5 text-[13px] font-semibold">Cobertura</div>
              <div className="flex flex-wrap gap-1.5">
                <Pick on={!sel.coberturaId} onClick={() => (setSel({ ...sel, coberturaId: undefined }), setPrice(null))}>
                  Sem cobertura
                </Pick>
                {cake.coberturas.map((c) => (
                  <Pick key={c.id} on={sel.coberturaId === c.id} onClick={() => (setSel({ ...sel, coberturaId: c.id }), setPrice(null))}>
                    {c.name}
                  </Pick>
                ))}
              </div>
            </div>
          )}

          {q && ok ? (
            <div className="rounded-xl border border-line">
              <ul className="divide-y divide-divider text-sm">
                {q.parts.map((p) => (
                  <li key={p.label} className="flex justify-between px-4 py-2">
                    <span className="text-muted">{p.label}</span>
                    <span className="tabular">{money(p.cost)}</span>
                  </li>
                ))}
                <li className="flex justify-between bg-subtle px-4 py-2 font-semibold">
                  <span>Custo do bolo</span>
                  <span className="tabular">{money(q.cost)}</span>
                </li>
              </ul>
              <div className="grid gap-3 border-t border-divider p-4 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-muted">Preço calculado (margem {pct(cake.marginPct, 0)})</div>
                  <div className="text-lg font-bold tabular">{money(q.price)}</div>
                </div>
                <div>
                  <div className="mb-1 text-xs text-muted">Preço para este pedido</div>
                  <NumberInput value={unit} min={0} prefix="R$" onChange={(x) => setPrice(x)} />
                </div>
                <div>
                  <div className="text-xs text-muted">Lucro por bolo</div>
                  <div className={cx('text-lg font-bold tabular', profit >= 0 ? 'text-profit' : 'text-loss')}>
                    {money(profit)} <span className="text-xs font-medium">({unit > 0 ? pct((profit / unit) * 100) : '—'})</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-divider px-4 py-3 text-sm">
                <span className="text-muted">Quantidade</span>
                <NumberInput value={qty} min={1} onChange={(x) => setQty(Math.max(1, Math.round(x)))} className="w-24" />
              </div>
            </div>
          ) : (
            <p className="text-sm text-warn">{q?.problems.join(' · ') || 'As fichas das partes escolhidas ainda não têm ingredientes.'}</p>
          )}
        </div>
      )}
    </Modal>
  );
}
