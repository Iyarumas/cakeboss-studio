import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { MessageCircle, Pencil, Plus, Search, Trash, Users } from 'lucide-react';
import { WhatsAppDialog } from '../components/WhatsAppDialog';
import { CustomerProfile } from '../components/CustomerProfile';
import { useStore } from '../store/store';
import { date, money, nowIso, uid } from '@cakeboss/domain/format';
import { orderTotals } from '@cakeboss/domain/orders';
import type { Customer } from '@cakeboss/domain/types';
import { Button, Card, EmptyState, Field, IconButton, PageHeader, TextInput } from '../components/ui';
import { ConfirmDialog, Drawer, stagger, useToast } from '../components/motion';

export const newCustomer = (name = ''): Customer => ({ id: uid(), name, phone: '', notes: '', createdAt: nowIso() });

export default function CustomersPage() {
  const { db, ctx, saveCustomer, deleteCustomer } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Customer | null>(null);
  const [del, setDel] = useState<Customer | null>(null);
  const [wa, setWa] = useState<Customer | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const profile = db.customers.find((c) => c.id === profileId) ?? null;

  const rows = useMemo(
    () =>
      db.customers
        .filter((c) => `${c.name} ${c.phone}`.toLowerCase().includes(q.toLowerCase()))
        .map((c) => {
          const orders = db.orders.filter((o) => o.customerId === c.id && o.status !== 'cancelado');
          const spent = orders.reduce((a, o) => a + orderTotals(o, db.transactions, db.recipes, ctx).total, 0);
          const last = orders.map((o) => o.deliveryAt).sort().pop();
          return { c, count: orders.length, spent, last };
        })
        .sort((a, b) => a.c.name.localeCompare(b.c.name)),
    [db, ctx, q],
  );

  const save = () => {
    if (!editing?.name.trim()) return toast('Informe o nome do cliente', 'error');
    saveCustomer({ ...editing, name: editing.name.trim() });
    toast('Cliente salvo');
    setEditing(null);
  };

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show">
      <PageHeader
        title="Clientes"
        subtitle="Contatos e histórico de compras de quem encomenda com você."
        actions={
          <Button variant="primary" onClick={() => setEditing(newCustomer())}>
            <Plus size={16} /> Novo cliente
          </Button>
        }
      />
      <motion.div variants={stagger.item}>
        <Card>
          {db.customers.length === 0 ? (
            <EmptyState
              icon={<Users size={22} />}
              title="Nenhum cliente cadastrado"
              text="Cadastre aqui ou direto ao criar um pedido."
              action={
                <Button variant="primary" onClick={() => setEditing(newCustomer())}>
                  <Plus size={16} /> Cadastrar cliente
                </Button>
              }
            />
          ) : (
            <>
              <div className="border-b border-divider p-4">
                <div className="relative max-w-xs">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <TextInput className="pl-9" placeholder="Buscar por nome ou telefone" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-subtle/70 text-left text-xs text-muted">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Cliente</th>
                      <th className="px-3 py-2.5 font-medium">Telefone</th>
                      <th className="px-3 py-2.5 text-right font-medium">Pedidos</th>
                      <th className="px-3 py-2.5 text-right font-medium">Total comprado</th>
                      <th className="px-3 py-2.5 font-medium">Último pedido</th>
                      <th className="w-32 px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider">
                    {rows.map(({ c, count, spent, last }) => (
                      <tr key={c.id} className="cursor-pointer hover:bg-subtle/50" onClick={(e) => !(e.target as HTMLElement).closest('button') && setProfileId(c.id)}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lilac-soft text-xs font-semibold text-lilac">{c.name.slice(0, 1).toUpperCase()}</span>
                            <div className="min-w-0">
                              <button type="button" onClick={() => setProfileId(c.id)} className="block max-w-full truncate text-left font-medium hover:text-pink hover:underline">
                                {c.name}
                              </button>
                              {c.notes && <div className="truncate text-xs text-muted">{c.notes}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-muted">{c.phone || '—'}</td>
                        <td className="px-3 py-3 text-right tabular">
                          {count > 0 ? (
                            <button className="font-medium text-pink hover:underline" onClick={() => navigate(`/pedidos?cliente=${c.id}`)}>
                              {count}
                            </button>
                          ) : (
                            0
                          )}
                        </td>
                        <td className="px-3 py-3 text-right tabular">{money(spent)}</td>
                        <td className="px-3 py-3 text-muted">{last ? date(last) : '—'}</td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-1">
                            <IconButton label="Enviar WhatsApp" onClick={() => setWa(c)}>
                              <MessageCircle size={15} className="text-profit" />
                            </IconButton>
                            <IconButton label="Editar" onClick={() => setEditing({ ...c })}>
                              <Pencil size={15} />
                            </IconButton>
                            <IconButton label="Excluir" onClick={() => setDel(c)}>
                              <Trash size={15} />
                            </IconButton>
                          </div>
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

      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing && db.customers.some((x) => x.id === editing.id) ? 'Editar cliente' : 'Novo cliente'}>
        {editing && (
          <form
            className="space-y-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <Field label="Nome">
              <TextInput autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label="Telefone / WhatsApp">
              <TextInput inputMode="tel" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} placeholder="(00) 00000-0000" />
            </Field>
            <Field label="Observações" hint="Preferências, alergias, endereço de entrega…">
              <textarea
                rows={4}
                value={editing.notes}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-pink/60 focus:outline-none focus:ring-2 focus:ring-pink/20"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setEditing(null)}>Cancelar</Button>
              <Button variant="primary" type="submit">
                Salvar
              </Button>
            </div>
          </form>
        )}
      </Drawer>

      <Drawer open={!!profile} onClose={() => setProfileId(null)} title="Ficha do cliente" width="max-w-2xl">
        {profile && (
          <CustomerProfile
            customer={profile}
            onEdit={() => {
              setProfileId(null);
              setEditing({ ...profile });
            }}
            onWhatsApp={() => setWa(profile)}
          />
        )}
      </Drawer>
      <WhatsAppDialog open={!!wa} onClose={() => setWa(null)} customerName={wa?.name ?? ''} phone={wa?.phone ?? ''} />
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        danger
        title="Excluir cliente?"
        confirmLabel="Excluir"
        onConfirm={() => {
          if (!del) return;
          deleteCustomer(del.id);
          toast('Cliente excluído');
        }}
      >
        <b>{del?.name}</b> sai do cadastro. Os pedidos dele continuam no sistema com o nome registrado.
      </ConfirmDialog>
    </motion.div>
  );
}
