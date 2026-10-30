import { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, ShoppingCart, Trash } from 'lucide-react';
import { useStore } from '../store/store';
import { date, money, number, qtyBase, UNIT_LABEL } from '../lib/format';
import type { Purchase } from '../lib/types';
import { Badge, Button, Card, EmptyState, IconButton, PageHeader } from '../components/ui';
import { ConfirmDialog, Drawer, stagger, useToast } from '../components/motion';
import { PurchaseForm, type PurchasePreset } from '../components/PurchaseForm';

export default function PurchasesPage() {
  const { db, deletePurchase } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState<PurchasePreset | null>(null);
  const [del, setDel] = useState<Purchase | null>(null);
  const monthTotal = db.purchases.filter((p) => p.date.slice(0, 7) === new Date().toISOString().slice(0, 7)).reduce((a, p) => a + p.total, 0);

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show">
      <PageHeader
        title="Compras"
        subtitle="Cada compra entra no estoque, atualiza o custo do item e pode ir direto para o Financeiro."
        actions={
          <Button variant="primary" onClick={() => setOpen({ kind: 'ingrediente' })}>
            <Plus size={16} /> Registrar compra
          </Button>
        }
      />
      <motion.div variants={stagger.item}>
        <Card>
          {db.purchases.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart size={22} />}
              title="Nenhuma compra registrada"
              text="Comprou 50 caixas de leite condensado? Registre aqui: o estoque sobe e o custo fica atualizado."
              action={
                <Button variant="primary" onClick={() => setOpen({ kind: 'ingrediente' })}>
                  <Plus size={16} /> Registrar compra
                </Button>
              }
            />
          ) : (
            <>
              <div className="border-b border-divider px-5 py-3 text-sm text-muted">
                Comprado neste mês: <b className="text-ink">{money(monthTotal)}</b>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-subtle/70 text-left text-xs text-muted">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Data</th>
                      <th className="px-3 py-2.5 font-medium">Item</th>
                      <th className="px-3 py-2.5 font-medium">Quantidade</th>
                      <th className="px-3 py-2.5 text-right font-medium">Preço un.</th>
                      <th className="px-3 py-2.5 text-right font-medium">Total</th>
                      <th className="px-3 py-2.5 font-medium">Fornecedor</th>
                      <th className="w-12 px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {db.purchases.map((p) => (
                      <tr key={p.id} className="hover:bg-subtle/50">
                        <td className="whitespace-nowrap px-5 py-3 text-muted">{date(p.date)}</td>
                        <td className="px-3 py-3">
                          <div className="font-medium">{p.itemName}</div>
                          <Badge tone={p.kind === 'ingrediente' ? 'pink' : 'amber'}>{p.kind === 'ingrediente' ? 'Ingrediente' : 'Material'}</Badge>
                        </td>
                        <td className="px-3 py-3">
                          {number(p.packages)} × {number(p.packageQty)} {p.kind === 'material' ? 'un' : UNIT_LABEL[p.unit]}
                          <div className="text-xs text-muted">+{qtyBase(p.stockAdded, p.unit)} no estoque</div>
                        </td>
                        <td className="px-3 py-3 text-right tabular">{money(p.pricePerPackage)}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular">{money(p.total)}</td>
                        <td className="px-3 py-3 text-muted">
                          {p.supplier || '—'}
                          {p.transactionId && <div className="text-xs">no financeiro</div>}
                        </td>
                        <td className="px-3 py-3">
                          <IconButton label="Excluir compra" onClick={() => setDel(p)}>
                            <Trash size={15} />
                          </IconButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </motion.div>

      <Drawer open={!!open} onClose={() => setOpen(null)} title="Registrar compra" width="max-w-lg">
        {open && <PurchaseForm preset={open} onDone={() => setOpen(null)} />}
      </Drawer>
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        danger
        title="Excluir compra?"
        confirmLabel="Excluir"
        onConfirm={() => {
          if (!del) return;
          deletePurchase(del.id);
          toast('Compra excluída');
        }}
      >
        {del && (
          <>
            Remove <b>{qtyBase(del.stockAdded, del.unit)}</b> de {del.itemName} do estoque{del.transactionId ? ' e o lançamento no Financeiro' : ''}. O preço de custo do item não volta ao anterior — ajuste em Ingredientes se precisar.
          </>
        )}
      </ConfirmDialog>
    </motion.div>
  );
}
